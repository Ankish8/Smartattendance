import { Response, NextFunction } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import csv from 'csv-parser';
import { prisma } from '@/config/database';
import { AIMatchingService } from '@/services/aiMatching';
import { AuthenticatedRequest, ApiResponse, Role } from '@/types';
import { asyncHandler, ApiError, NotFoundError } from '@/utils/errors';
import { logger } from '@/config/logger';
import { config } from '@/config/env';

const aiMatchingService = new AIMatchingService();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: config.upload.maxFileSize,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = config.upload.allowedFileTypes;
    const fileExtension = path.extname(file.originalname).toLowerCase().slice(1);
    
    if (allowedTypes.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new ApiError(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`, 400));
    }
  }
});

// Validation schemas
const sessionIdSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
});

const attendanceRecordSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  studentId: z.string().uuid('Invalid student ID'),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
  notes: z.string().optional(),
});

const bulkAttendanceSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  records: z.array(z.object({
    studentId: z.string().uuid('Invalid student ID'),
    status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
    notes: z.string().optional(),
  })),
});

const feedbackSchema = z.object({
  originalName: z.string().min(1, 'Original name is required'),
  correctStudentId: z.string().uuid('Invalid student ID'),
  wasCorrect: z.boolean(),
  confidence: z.number().min(0).max(1),
  context: z.record(z.any()).optional(),
});

const querySchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 10),
  sortBy: z.string().optional().default('markedAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']).optional(),
  sessionId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export class AttendanceController {
  /**
   * Upload and process attendance file
   * POST /api/attendance/upload
   */
  uploadFile = [
    upload.single('file'),
    asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      if (!req.file) {
        throw new ApiError('No file uploaded', 400);
      }

      const { sessionId } = req.body;
      let validatedSessionId: string | undefined;

      // Validate session ID if provided
      if (sessionId) {
        validatedSessionId = sessionIdSchema.parse({ sessionId }).sessionId;
        
        // Verify session exists and user has access
        const session = await prisma.session.findUnique({
          where: { id: validatedSessionId },
        });

        if (!session) {
          throw new NotFoundError('Session not found');
        }

        // Check permissions
        if (req.user.role !== Role.ADMIN && 
            session.createdById !== req.user.id && 
            session.teacherId !== req.user.id) {
          throw new ApiError('Insufficient permissions to upload to this session', 403);
        }
      }

      try {
        // Save file upload record
        const fileUpload = await prisma.fileUpload.create({
          data: {
            sessionId: validatedSessionId,
            originalName: req.file.originalname,
            fileName: req.file.filename,
            filePath: req.file.path,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            uploadedBy: req.user.id,
            processingStatus: 'PENDING',
          },
        });

        // Process file asynchronously
        this.processFileAsync(fileUpload.id, req.file.path, validatedSessionId);

        const response: ApiResponse = {
          success: true,
          message: 'File uploaded successfully and is being processed',
          data: {
            fileId: fileUpload.id,
            originalName: fileUpload.originalName,
            processingStatus: fileUpload.processingStatus,
          },
        };

        logger.info(`File uploaded for processing: ${req.file.originalname} by user ${req.user.id}`);
        res.status(201).json(response);

      } catch (error) {
        // Clean up file if database operation fails
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        throw error;
      }
    })
  ];

  /**
   * Get processing status of uploaded file
   * GET /api/attendance/upload/:fileId/status
   */
  getProcessingStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { fileId } = req.params;

    const fileUpload = await prisma.fileUpload.findUnique({
      where: { id: fileId },
      include: {
        processedRecords: true,
      },
    });

    if (!fileUpload) {
      throw new NotFoundError('File not found');
    }

    // Check permissions
    if (req.user.role !== Role.ADMIN && fileUpload.uploadedBy !== req.user.id) {
      throw new ApiError('Insufficient permissions', 403);
    }

    const response: ApiResponse = {
      success: true,
      message: 'Processing status retrieved successfully',
      data: {
        fileId: fileUpload.id,
        processingStatus: fileUpload.processingStatus,
        processingResult: fileUpload.processingResult,
        processingErrors: fileUpload.processingErrors,
        processedAt: fileUpload.processedAt,
        recordCount: fileUpload.processedRecords.length,
      },
    };

    res.status(200).json(response);
  });

  /**
   * Mark individual attendance
   * POST /api/attendance/mark
   */
  markAttendance = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const validatedData = attendanceRecordSchema.parse(req.body);

    // Verify session exists and user has access
    const session = await prisma.session.findUnique({
      where: { id: validatedData.sessionId },
    });

    if (!session) {
      throw new NotFoundError('Session not found');
    }

    // Check permissions
    if (req.user.role !== Role.ADMIN && 
        session.createdById !== req.user.id && 
        session.teacherId !== req.user.id) {
      throw new ApiError('Insufficient permissions to mark attendance for this session', 403);
    }

    // Verify student exists
    const student = await prisma.student.findUnique({
      where: { id: validatedData.studentId },
    });

    if (!student) {
      throw new NotFoundError('Student not found');
    }

    // Create or update attendance record
    const attendanceRecord = await prisma.attendanceRecord.upsert({
      where: {
        sessionId_studentId: {
          sessionId: validatedData.sessionId,
          studentId: validatedData.studentId,
        },
      },
      update: {
        status: validatedData.status,
        notes: validatedData.notes,
        verifiedBy: req.user.id,
        verifiedAt: new Date(),
      },
      create: {
        sessionId: validatedData.sessionId,
        studentId: validatedData.studentId,
        status: validatedData.status,
        notes: validatedData.notes,
        aiMethod: 'manual',
        confidence: 1.0,
        verifiedBy: req.user.id,
        verifiedAt: new Date(),
      },
    });

    const response: ApiResponse = {
      success: true,
      message: 'Attendance marked successfully',
      data: { attendanceRecord },
    };

    logger.info(`Attendance marked: ${validatedData.status} for student ${validatedData.studentId} in session ${validatedData.sessionId}`);
    res.status(201).json(response);
  });

  /**
   * Mark bulk attendance
   * POST /api/attendance/bulk-mark
   */
  markBulkAttendance = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const validatedData = bulkAttendanceSchema.parse(req.body);

    // Verify session exists and user has access
    const session = await prisma.session.findUnique({
      where: { id: validatedData.sessionId },
    });

    if (!session) {
      throw new NotFoundError('Session not found');
    }

    // Check permissions
    if (req.user.role !== Role.ADMIN && 
        session.createdById !== req.user.id && 
        session.teacherId !== req.user.id) {
      throw new ApiError('Insufficient permissions to mark attendance for this session', 403);
    }

    // Verify all students exist
    const studentIds = validatedData.records.map(record => record.studentId);
    const existingStudents = await prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true },
    });

    if (existingStudents.length !== studentIds.length) {
      throw new ApiError('One or more students not found', 400);
    }

    // Create attendance records
    const attendanceRecords = await Promise.all(
      validatedData.records.map(async (record) => {
        return prisma.attendanceRecord.upsert({
          where: {
            sessionId_studentId: {
              sessionId: validatedData.sessionId,
              studentId: record.studentId,
            },
          },
          update: {
            status: record.status,
            notes: record.notes,
            verifiedBy: req.user!.id,
            verifiedAt: new Date(),
          },
          create: {
            sessionId: validatedData.sessionId,
            studentId: record.studentId,
            status: record.status,
            notes: record.notes,
            aiMethod: 'manual',
            confidence: 1.0,
            verifiedBy: req.user!.id,
            verifiedAt: new Date(),
          },
        });
      })
    );

    const response: ApiResponse = {
      success: true,
      message: `${attendanceRecords.length} attendance records marked successfully`,
      data: { attendanceRecords },
    };

    logger.info(`Bulk attendance marked: ${attendanceRecords.length} records for session ${validatedData.sessionId}`);
    res.status(201).json(response);
  });

  /**
   * Get attendance records
   * GET /api/attendance
   */
  getAttendanceRecords = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const query = querySchema.parse(req.query);
    const { page, limit, sortBy, sortOrder, status, sessionId, studentId, startDate, endDate } = query;

    // Build where clause
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (sessionId) {
      where.sessionId = sessionId;
    }

    if (studentId) {
      where.studentId = studentId;
    }

    if (startDate || endDate) {
      where.markedAt = {};
      if (startDate) {
        where.markedAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.markedAt.lte = new Date(endDate);
      }
    }

    // Add permission-based filtering
    if (req.user.role === Role.STUDENT) {
      const studentProfile = await prisma.student.findUnique({
        where: { userId: req.user.id },
        select: { id: true },
      });

      if (!studentProfile) {
        throw new NotFoundError('Student profile not found');
      }

      where.studentId = studentProfile.id;
    } else if (req.user.role === Role.TEACHER) {
      // Teachers can only see their own sessions
      where.session = {
        OR: [
          { teacherId: req.user.id },
          { createdById: req.user.id },
        ],
      };
    }

    // Get total count
    const total = await prisma.attendanceRecord.count({ where });

    // Get paginated results
    const records = await prisma.attendanceRecord.findMany({
      where,
      include: {
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        session: {
          select: {
            id: true,
            title: true,
            subject: true,
            scheduledAt: true,
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });

    const response: ApiResponse = {
      success: true,
      message: 'Attendance records retrieved successfully',
      data: { records },
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    res.status(200).json(response);
  });

  /**
   * Get attendance analytics
   * GET /api/attendance/analytics
   */
  getAttendanceAnalytics = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { sessionId, startDate, endDate } = req.query;

    // Build where clause
    const where: any = {};

    if (sessionId) {
      where.sessionId = sessionId as string;
    }

    if (startDate || endDate) {
      where.markedAt = {};
      if (startDate) {
        where.markedAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.markedAt.lte = new Date(endDate as string);
      }
    }

    // Add permission-based filtering
    if (req.user.role === Role.STUDENT) {
      const studentProfile = await prisma.student.findUnique({
        where: { userId: req.user.id },
        select: { id: true },
      });

      if (studentProfile) {
        where.studentId = studentProfile.id;
      }
    } else if (req.user.role === Role.TEACHER) {
      where.session = {
        OR: [
          { teacherId: req.user.id },
          { createdById: req.user.id },
        ],
      };
    }

    // Get analytics data
    const [
      totalRecords,
      statusCounts,
      subjectCounts,
      recentTrends
    ] = await Promise.all([
      prisma.attendanceRecord.count({ where }),
      
      prisma.attendanceRecord.groupBy({
        by: ['status'],
        where,
        _count: { status: true },
      }),
      
      prisma.attendanceRecord.groupBy({
        by: ['session'],
        where,
        _count: { session: true },
        include: {
          session: {
            select: { subject: true },
          },
        },
      }),
      
      prisma.attendanceRecord.findMany({
        where,
        select: {
          markedAt: true,
          status: true,
        },
        orderBy: { markedAt: 'desc' },
        take: 30,
      }),
    ]);

    const analytics = {
      totalRecords,
      attendanceByStatus: statusCounts.reduce((acc, item) => {
        acc[item.status] = item._count.status;
        return acc;
      }, {} as Record<string, number>),
      attendanceBySubject: {}, // Will be populated from session data
      recentTrends: this.processRecentTrends(recentTrends),
    };

    const response: ApiResponse = {
      success: true,
      message: 'Attendance analytics retrieved successfully',
      data: { analytics },
    };

    res.status(200).json(response);
  });

  /**
   * Provide feedback for AI matching
   * POST /api/attendance/feedback
   */
  provideFeedback = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const validatedData = feedbackSchema.parse(req.body);

    await aiMatchingService.processFeedback(
      validatedData.originalName,
      validatedData.correctStudentId,
      validatedData.wasCorrect,
      validatedData.confidence,
      { ...validatedData.context, userId: req.user.id }
    );

    const response: ApiResponse = {
      success: true,
      message: 'Feedback recorded successfully',
    };

    res.status(200).json(response);
  });

  /**
   * Process uploaded file asynchronously
   */
  private async processFileAsync(fileId: string, filePath: string, sessionId?: string): Promise<void> {
    try {
      // Update status to processing
      await prisma.fileUpload.update({
        where: { id: fileId },
        data: { processingStatus: 'PROCESSING' },
      });

      // Read CSV file
      const csvData = await this.readCsvFile(filePath);

      // Process with AI matching
      const result = await aiMatchingService.processAttendanceMatching({
        fileName: path.basename(filePath),
        csvData,
        sessionId,
      });

      // Save processed records
      const processedRecords = await Promise.all([
        ...result.matches.map(match => 
          prisma.processedRecord.create({
            data: {
              fileUploadId: fileId,
              originalData: match.additionalData || {},
              processedData: {
                originalName: match.originalName,
                studentId: match.studentId,
                studentName: match.studentName,
                confidence: match.confidence,
                method: match.method,
              },
              matchedStudentId: match.studentId,
              confidence: match.confidence,
              matchMethod: match.method,
              isVerified: match.confidence >= 0.9,
            },
          })
        ),
        ...result.unmatched.map(unmatched => 
          prisma.processedRecord.create({
            data: {
              fileUploadId: fileId,
              originalData: unmatched.additionalData || {},
              processedData: {
                originalName: unmatched.originalName,
                reason: unmatched.reason,
                suggestions: unmatched.suggestions,
              },
              confidence: 0,
              matchMethod: 'none',
              isVerified: false,
            },
          })
        ),
      ]);

      // Update file upload status
      await prisma.fileUpload.update({
        where: { id: fileId },
        data: {
          processingStatus: 'COMPLETED',
          processingResult: result,
          processedAt: new Date(),
        },
      });

      logger.info(`File processing completed: ${fileId}, ${processedRecords.length} records processed`);

    } catch (error) {
      logger.error(`File processing failed: ${fileId}`, error);
      
      await prisma.fileUpload.update({
        where: { id: fileId },
        data: {
          processingStatus: 'FAILED',
          processingErrors: {
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
          },
        },
      });
    }
  }

  /**
   * Read CSV file and return as string
   */
  private async readCsvFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let csvContent = '';
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          if (!csvContent) {
            // Add headers
            csvContent = Object.keys(row).join(',') + '\n';
          }
          csvContent += Object.values(row).join(',') + '\n';
        })
        .on('end', () => {
          resolve(csvContent);
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  /**
   * Process recent trends data
   */
  private processRecentTrends(records: any[]): any[] {
    const trendMap = new Map<string, { present: number, total: number }>();

    records.forEach(record => {
      const date = record.markedAt.toISOString().split('T')[0];
      const existing = trendMap.get(date) || { present: 0, total: 0 };
      
      existing.total += 1;
      if (record.status === 'PRESENT') {
        existing.present += 1;
      }
      
      trendMap.set(date, existing);
    });

    return Array.from(trendMap.entries())
      .map(([date, data]) => ({
        date,
        attendance: data.total > 0 ? (data.present / data.total) * 100 : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}