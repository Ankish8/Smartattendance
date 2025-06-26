const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
const port = 3000;

// Middleware
app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:3001', 'http://localhost:3002'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize DeepSeek AI client
const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'smartattend-backend',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API Info endpoint
app.get('/api/info', (req, res) => {
  res.json({
    name: 'SmartAttend Backend API',
    version: '1.0.0',
    description: 'AI-powered attendance tracking system',
    features: [
      'CSV file processing',
      'AI name matching with DeepSeek',
      'Real-time processing',
      'Confidence scoring'
    ],
    endpoints: {
      health: '/health',
      upload: '/api/upload',
      process: '/api/process',
      test: '/api/test-ai'
    }
  });
});

// Test AI endpoint
app.post('/api/test-ai', async (req, res) => {
  try {
    console.log('🤖 Testing DeepSeek AI integration...');
    
    if (!process.env.DEEPSEEK_API_KEY) {
      return res.status(400).json({
        success: false,
        error: 'DeepSeek API key not configured'
      });
    }
    
    const response = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{
        role: 'user',
        content: 'You are SmartAttend AI. Respond with JSON: {"status": "operational", "message": "Ready for attendance matching", "capabilities": ["name matching", "CSV processing", "confidence scoring"]}'
      }],
      temperature: 0.1,
      max_tokens: 150
    });
    
    const aiResponse = response.choices[0]?.message?.content;
    
    res.json({
      success: true,
      message: 'DeepSeek AI integration successful!',
      ai_response: aiResponse,
      config: {
        model: 'deepseek-chat',
        baseUrl: process.env.DEEPSEEK_BASE_URL,
        status: 'configured'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ AI test failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Process attendance file
app.post('/api/process-attendance', async (req, res) => {
  try {
    const { csvData, students = [], options = {} } = req.body;
    
    if (!csvData) {
      return res.status(400).json({
        success: false,
        error: 'CSV data is required'
      });
    }
    
    console.log('📊 Processing attendance data...');
    
    // Parse CSV data
    const rows = csvData.split('\\n').map(row => 
      row.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
    ).filter(row => row.some(cell => cell.length > 0));
    
    if (rows.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'CSV must contain headers and at least one data row'
      });
    }
    
    const headers = rows[0];
    const dataRows = rows.slice(1);
    
    // Sample student database (in real app, this would come from database)
    const sampleStudents = students.length > 0 ? students : [
      { id: 1, name: 'John Smith', email: 'john.smith@university.edu' },
      { id: 2, name: 'Emily Johnson', email: 'emily.johnson@university.edu' },
      { id: 3, name: 'Michael Brown', email: 'michael.brown@university.edu' },
      { id: 4, name: 'Sarah Davis', email: 'sarah.davis@university.edu' },
      { id: 5, name: 'David Wilson', email: 'david.wilson@university.edu' }
    ];
    
    // Use AI for intelligent matching
    const prompt = `
You are an expert at matching student names from attendance records to a student database.

Student Database:
${JSON.stringify(sampleStudents, null, 2)}

CSV Headers: ${JSON.stringify(headers)}
Data Rows to Match: ${JSON.stringify(dataRows.slice(0, 10))} // First 10 rows

Task: Match each name to a student ID with confidence score (0-1).

Rules:
1. Consider name variations, nicknames, typos
2. Use email if available for exact matching  
3. Handle partial names, different orders
4. Assign confidence based on match quality

Return JSON:
{
  "matches": [
    {
      "originalName": "name from CSV",
      "studentId": "matched_student_id", 
      "studentName": "full student name",
      "confidence": 0.95,
      "method": "exact|partial|email|pattern"
    }
  ],
  "unmatched": [
    {
      "originalName": "name from CSV",
      "reason": "no similar names found"
    }
  ]
}`;

    const response = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 1000
    });
    
    const aiResponseText = response.choices[0]?.message?.content;
    let aiResult;
    
    try {
      // Extract JSON from AI response
      const jsonMatch = aiResponseText.match(/\{[\s\S]*\}/);
      aiResult = jsonMatch ? JSON.parse(jsonMatch[0]) : { matches: [], unmatched: [] };
    } catch (parseError) {
      console.warn('Failed to parse AI response, using fallback');
      aiResult = { matches: [], unmatched: [] };
    }
    
    const processingResult = {
      success: true,
      message: 'Attendance processing completed',
      data: {
        totalRows: dataRows.length,
        headers: headers,
        matches: aiResult.matches || [],
        unmatched: aiResult.unmatched || [],
        confidence: aiResult.matches ? 
          aiResult.matches.reduce((sum, m) => sum + m.confidence, 0) / aiResult.matches.length : 0,
        processingTime: Date.now() - Date.now()
      },
      ai_raw_response: aiResponseText,
      timestamp: new Date().toISOString()
    };
    
    console.log(`✅ Processed ${dataRows.length} rows, ${aiResult.matches?.length || 0} matches found`);
    
    res.json(processingResult);
    
  } catch (error) {
    console.error('❌ Processing failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// File upload simulation endpoint
app.post('/api/upload', (req, res) => {
  try {
    const { fileName, fileContent } = req.body;
    
    if (!fileName || !fileContent) {
      return res.status(400).json({
        success: false,
        error: 'fileName and fileContent are required'
      });
    }
    
    console.log(`📁 File uploaded: ${fileName}`);
    
    res.json({
      success: true,
      message: 'File uploaded successfully',
      file: {
        name: fileName,
        size: fileContent.length,
        type: fileName.endsWith('.csv') ? 'text/csv' : 'unknown',
        uploadedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Upload failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    available_endpoints: ['/health', '/api/info', '/api/test-ai', '/api/process-attendance', '/api/upload']
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(``);
  console.log(`🚀 SmartAttend Backend API running on port ${port}`);
  console.log(`📡 Health: http://localhost:${port}/health`);
  console.log(`📋 API Info: http://localhost:${port}/api/info`);
  console.log(`🤖 AI Test: http://localhost:${port}/api/test-ai`);
  console.log(`📊 Process: http://localhost:${port}/api/process-attendance`);
  console.log(``);
});