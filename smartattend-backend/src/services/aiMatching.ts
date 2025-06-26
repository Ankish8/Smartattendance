import OpenAI from 'openai';
import { prisma } from '@/config/database';
import { logger } from '@/config/logger';
import { config } from '@/config/env';
import { 
  AIMatchingRequest, 
  AIMatchingResult, 
  MatchedRecord, 
  UnmatchedRecord,
  DetectedColumn,
  ColumnDetectionResult 
} from '@/types';
import { ApiError } from '@/utils/errors';
import { redisClient, RedisConnection } from '@/config/redis';

export class AIMatchingService {
  private aiClient: OpenAI;
  private confidenceThreshold: number;
  private maxProcessingTime: number;

  constructor() {
    // Use DeepSeek API only
    this.aiClient = new OpenAI({
      apiKey: config.deepseek.apiKey,
      baseURL: config.deepseek.baseUrl,
    });
    this.confidenceThreshold = config.ai.confidenceThreshold;
    this.maxProcessingTime = config.ai.maxProcessingTime;
  }

  /**
   * Main method to process attendance matching
   */
  async processAttendanceMatching(request: AIMatchingRequest): Promise<AIMatchingResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Starting AI matching for file: ${request.fileName}`);
      
      // Parse CSV data
      const csvRows = await this.parseCsvData(request.csvData);
      
      if (csvRows.length === 0) {
        throw new ApiError('No data found in CSV file', 400);
      }

      // Detect columns
      const columnDetection = await this.detectColumns(csvRows);
      
      // Get student database for matching
      const students = await this.getStudentDatabase(request.sessionId);
      
      // Perform AI matching
      const aiMatches = await this.performAIMatching(csvRows, students, columnDetection);
      
      // Fallback to pattern matching for unmatched records
      const patternMatches = await this.performPatternMatching(
        aiMatches.unmatched,
        students,
        columnDetection
      );

      // Combine results
      const allMatches = [...aiMatches.matches, ...patternMatches.matches];
      const stillUnmatched = patternMatches.unmatched;

      // Calculate overall confidence
      const overallConfidence = this.calculateOverallConfidence(allMatches);
      
      const processingTime = Date.now() - startTime;
      
      const result: AIMatchingResult = {
        matches: allMatches,
        unmatched: stillUnmatched,
        confidence: overallConfidence,
        processingTime,
        method: aiMatches.matches.length > 0 ? 'hybrid' : 'pattern',
      };

      // Cache result for learning
      if (config.ai.enableLearningFeedback) {
        await this.cacheMatchingResult(request.fileName, result);
      }

      logger.info(`AI matching completed in ${processingTime}ms with ${overallConfidence.toFixed(2)} confidence`);
      
      return result;
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('AI matching failed:', error);
      
      return {
        matches: [],
        unmatched: [],
        confidence: 0,
        processingTime,
        method: 'ai',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Parse CSV data into structured format
   */
  private async parseCsvData(csvData: string): Promise<string[][]> {
    const rows = csvData.split('\n').map(row => 
      row.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
    ).filter(row => row.some(cell => cell.length > 0));

    return rows;
  }

  /**
   * Detect column types using AI
   */
  async detectColumns(csvRows: string[][]): Promise<ColumnDetectionResult> {
    try {
      if (csvRows.length === 0) {
        throw new ApiError('No data provided for column detection', 400);
      }

      const headers = csvRows[0];
      const sampleRows = csvRows.slice(1, Math.min(6, csvRows.length)); // Take up to 5 sample rows

      const prompt = `
Analyze this CSV data and identify column types. Return a JSON object with column analysis.

Headers: ${JSON.stringify(headers)}
Sample data: ${JSON.stringify(sampleRows)}

Identify these column types:
- name: Full name, first name, last name
- email: Email addresses
- id: Student ID, roll number, registration number
- date: Dates, timestamps
- status: Attendance status (present, absent, etc.)
- other: Any other type

Return JSON format:
{
  "columns": [
    {
      "index": 0,
      "name": "column_name",
      "type": "name|email|id|date|status|other",
      "confidence": 0.95,
      "samples": ["sample1", "sample2"]
    }
  ],
  "confidence": 0.85
}`;

      const response = await this.aiClient.chat.completions.create({
        model: config.deepseek.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: config.deepseek.temperature,
        max_tokens: config.deepseek.maxTokens,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new ApiError('No response from AI service', 500);
      }

      const aiResult = JSON.parse(content);
      
      // Convert to our format
      const detectedColumns: DetectedColumn[] = aiResult.columns.map((col: any, index: number) => ({
        index: col.index,
        name: headers[col.index] || `Column ${col.index + 1}`,
        type: col.type,
        confidence: col.confidence,
        samples: sampleRows.map(row => row[col.index]).filter(Boolean).slice(0, 3),
      }));

      // Find specific columns
      const nameColumn = detectedColumns.find(col => col.type === 'name');
      const emailColumn = detectedColumns.find(col => col.type === 'email');
      const idColumn = detectedColumns.find(col => col.type === 'id');
      const dateColumn = detectedColumns.find(col => col.type === 'date');
      const statusColumn = detectedColumns.find(col => col.type === 'status');

      return {
        columns: detectedColumns,
        nameColumn,
        emailColumn,
        idColumn,
        dateColumn,
        statusColumn,
        confidence: aiResult.confidence,
      };

    } catch (error) {
      logger.warn('AI column detection failed, using fallback:', error);
      return this.fallbackColumnDetection(csvRows);
    }
  }

  /**
   * Fallback column detection using pattern matching
   */
  private fallbackColumnDetection(csvRows: string[][]): ColumnDetectionResult {
    const headers = csvRows[0];
    const sampleRows = csvRows.slice(1, Math.min(6, csvRows.length));

    const detectedColumns: DetectedColumn[] = headers.map((header, index) => {
      const headerLower = header.toLowerCase();
      const samples = sampleRows.map(row => row[index]).filter(Boolean);
      
      let type: DetectedColumn['type'] = 'other';
      let confidence = 0.5;

      // Pattern-based detection
      if (headerLower.includes('name') || headerLower.includes('student')) {
        type = 'name';
        confidence = 0.8;
      } else if (headerLower.includes('email') || headerLower.includes('mail')) {
        type = 'email';
        confidence = 0.9;
      } else if (headerLower.includes('id') || headerLower.includes('roll') || headerLower.includes('reg')) {
        type = 'id';
        confidence = 0.8;
      } else if (headerLower.includes('date') || headerLower.includes('time')) {
        type = 'date';
        confidence = 0.7;
      } else if (headerLower.includes('status') || headerLower.includes('attendance')) {
        type = 'status';
        confidence = 0.8;
      }

      // Validate with sample data
      if (samples.length > 0) {
        if (type === 'email' && !samples.some(s => s.includes('@'))) {
          type = 'other';
          confidence = 0.3;
        }
      }

      return {
        index,
        name: header,
        type,
        confidence,
        samples: samples.slice(0, 3),
      };
    });

    const nameColumn = detectedColumns.find(col => col.type === 'name');
    const emailColumn = detectedColumns.find(col => col.type === 'email');
    const idColumn = detectedColumns.find(col => col.type === 'id');
    const dateColumn = detectedColumns.find(col => col.type === 'date');
    const statusColumn = detectedColumns.find(col => col.type === 'status');

    return {
      columns: detectedColumns,
      nameColumn,
      emailColumn,
      idColumn,
      dateColumn,
      statusColumn,
      confidence: 0.6,
    };
  }

  /**
   * Get student database for matching
   */
  private async getStudentDatabase(sessionId?: string): Promise<any[]> {
    let students;

    if (sessionId) {
      // Get enrolled students for specific session
      students = await prisma.student.findMany({
        where: {
          enrollments: {
            some: {
              sessionId,
              isActive: true,
            },
          },
        },
        include: {
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    } else {
      // Get all active students
      students = await prisma.student.findMany({
        where: {
          user: {
            isActive: true,
          },
        },
        include: {
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    }

    return students.map(student => ({
      id: student.id,
      studentId: student.studentId,
      firstName: student.user.firstName,
      lastName: student.user.lastName,
      fullName: `${student.user.firstName} ${student.user.lastName}`,
      email: student.user.email,
    }));
  }

  /**
   * Perform AI-based matching
   */
  private async performAIMatching(
    csvRows: string[][],
    students: any[],
    columnDetection: ColumnDetectionResult
  ): Promise<{ matches: MatchedRecord[]; unmatched: UnmatchedRecord[] }> {
    try {
      const dataRows = csvRows.slice(1);
      const matches: MatchedRecord[] = [];
      const unmatched: UnmatchedRecord[] = [];

      // Create student lookup data
      const studentData = students.map(s => ({
        id: s.id,
        names: [s.firstName, s.lastName, s.fullName],
        email: s.email,
        studentId: s.studentId,
      }));

      const prompt = `
You are an expert at matching student names from attendance records to a student database.

Student Database:
${JSON.stringify(studentData, null, 2)}

CSV Data to Match:
${JSON.stringify(dataRows.slice(0, 20), null, 2)} // Limit for token efficiency

Column Information:
${JSON.stringify(columnDetection, null, 2)}

Task: Match each row to a student ID with confidence score (0-1).

Rules:
1. Consider name variations, nicknames, typos
2. Use email if available for exact matching
3. Use student ID if available
4. Handle partial names, different orders
5. Assign confidence based on match quality

Return JSON format:
{
  "matches": [
    {
      "originalName": "name from CSV",
      "studentId": "matched_student_id",
      "studentName": "full student name",
      "confidence": 0.95,
      "method": "exact|partial|email|id",
      "rowIndex": 0
    }
  ],
  "unmatched": [
    {
      "originalName": "name from CSV",
      "reason": "no similar names found",
      "rowIndex": 1
    }
  ]
}`;

      const response = await this.aiClient.chat.completions.create({
        model: config.deepseek.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: config.deepseek.temperature,
        max_tokens: config.deepseek.maxTokens,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new ApiError('No response from AI matching service', 500);
      }

      const aiResult = JSON.parse(content);

      // Process matches
      for (const match of aiResult.matches || []) {
        if (match.confidence >= this.confidenceThreshold) {
          const student = students.find(s => s.id === match.studentId);
          if (student) {
            matches.push({
              originalName: match.originalName,
              studentId: match.studentId,
              studentName: match.studentName,
              confidence: match.confidence,
              method: 'ai',
              additionalData: this.extractRowData(dataRows[match.rowIndex], columnDetection),
            });
          }
        } else {
          unmatched.push({
            originalName: match.originalName,
            reason: `Low confidence: ${match.confidence}`,
            suggestions: [{
              studentId: match.studentId,
              studentName: match.studentName,
              confidence: match.confidence,
            }],
          });
        }
      }

      // Add AI unmatched records
      for (const unmatchedRecord of aiResult.unmatched || []) {
        unmatched.push({
          originalName: unmatchedRecord.originalName,
          reason: unmatchedRecord.reason,
        });
      }

      return { matches, unmatched };

    } catch (error) {
      logger.error('AI matching failed:', error);
      // Return empty results to fallback to pattern matching
      return { matches: [], unmatched: [] };
    }
  }

  /**
   * Perform pattern-based matching as fallback
   */
  private async performPatternMatching(
    unmatchedRecords: UnmatchedRecord[],
    students: any[],
    columnDetection: ColumnDetectionResult
  ): Promise<{ matches: MatchedRecord[]; unmatched: UnmatchedRecord[] }> {
    const matches: MatchedRecord[] = [];
    const stillUnmatched: UnmatchedRecord[] = [];

    for (const record of unmatchedRecords) {
      const bestMatch = this.findBestPatternMatch(record.originalName, students);
      
      if (bestMatch && bestMatch.confidence >= this.confidenceThreshold) {
        matches.push({
          originalName: record.originalName,
          studentId: bestMatch.studentId,
          studentName: bestMatch.studentName,
          confidence: bestMatch.confidence,
          method: 'pattern',
          additionalData: record.additionalData,
        });
      } else {
        stillUnmatched.push({
          ...record,
          suggestions: bestMatch ? [bestMatch] : [],
        });
      }
    }

    return { matches, stillUnmatched };
  }

  /**
   * Find best pattern match using string similarity
   */
  private findBestPatternMatch(name: string, students: any[]): { 
    studentId: string; 
    studentName: string; 
    confidence: number 
  } | null {
    let bestMatch = null;
    let bestScore = 0;

    const cleanName = name.toLowerCase().trim();

    for (const student of students) {
      const scores = [
        this.calculateSimilarity(cleanName, student.fullName.toLowerCase()),
        this.calculateSimilarity(cleanName, student.firstName.toLowerCase()),
        this.calculateSimilarity(cleanName, student.lastName.toLowerCase()),
        this.calculateSimilarity(cleanName, `${student.firstName} ${student.lastName}`.toLowerCase()),
        this.calculateSimilarity(cleanName, `${student.lastName} ${student.firstName}`.toLowerCase()),
      ];

      const maxScore = Math.max(...scores);

      if (maxScore > bestScore) {
        bestScore = maxScore;
        bestMatch = {
          studentId: student.id,
          studentName: student.fullName,
          confidence: maxScore,
        };
      }
    }

    return bestMatch;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;

    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(null));

    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    const maxLen = Math.max(len1, len2);
    return (maxLen - matrix[len1][len2]) / maxLen;
  }

  /**
   * Extract additional data from CSV row
   */
  private extractRowData(row: string[], columnDetection: ColumnDetectionResult): Record<string, any> {
    const data: Record<string, any> = {};

    columnDetection.columns.forEach((col, index) => {
      if (row[col.index]) {
        data[col.name] = row[col.index];
      }
    });

    return data;
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(matches: MatchedRecord[]): number {
    if (matches.length === 0) return 0;

    const totalConfidence = matches.reduce((sum, match) => sum + match.confidence, 0);
    return totalConfidence / matches.length;
  }

  /**
   * Cache matching result for learning
   */
  private async cacheMatchingResult(fileName: string, result: AIMatchingResult): Promise<void> {
    try {
      const cacheKey = `matching_result:${fileName}:${Date.now()}`;
      await RedisConnection.set(cacheKey, JSON.stringify(result), 24 * 60 * 60); // 24 hours
    } catch (error) {
      logger.warn('Failed to cache matching result:', error);
    }
  }

  /**
   * Learn from feedback
   */
  async processFeedback(
    originalName: string,
    correctStudentId: string,
    wasCorrect: boolean,
    confidence: number,
    context?: any
  ): Promise<void> {
    try {
      await prisma.aIFeedback.create({
        data: {
          originalName,
          matchedStudentId: wasCorrect ? correctStudentId : '',
          confidence,
          wasCorrect,
          correctedStudentId: wasCorrect ? undefined : correctStudentId,
          feedbackBy: context?.userId || 'system',
          context: context || {},
        },
      });

      logger.info(`AI feedback recorded: ${originalName} -> ${correctStudentId} (${wasCorrect ? 'correct' : 'incorrect'})`);
    } catch (error) {
      logger.error('Failed to record AI feedback:', error);
    }
  }
}