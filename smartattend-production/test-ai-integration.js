#!/usr/bin/env node

/**
 * SmartAttend AI Integration Test Suite
 * Tests the complete AI workflow in production environment
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configuration
const config = {
  apiUrl: process.env.API_URL || 'http://localhost:3000/api',
  testDataDir: './test-data',
  outputDir: './test-results',
  confidenceThreshold: 0.7,
  maxProcessingTime: 30000, // 30 seconds
};

// Test data samples
const testData = {
  students: [
    { firstName: 'John', lastName: 'Smith', email: 'john.smith@university.edu', studentId: 'ST001' },
    { firstName: 'Emily', lastName: 'Johnson', email: 'emily.johnson@university.edu', studentId: 'ST002' },
    { firstName: 'Michael', lastName: 'Brown', email: 'michael.brown@university.edu', studentId: 'ST003' },
    { firstName: 'Sarah', lastName: 'Davis', email: 'sarah.davis@university.edu', studentId: 'ST004' },
    { firstName: 'David', lastName: 'Wilson', email: 'david.wilson@university.edu', studentId: 'ST005' },
    { firstName: 'Lisa', lastName: 'Miller', email: 'lisa.miller@university.edu', studentId: 'ST006' },
    { firstName: 'Robert', lastName: 'Garcia', email: 'robert.garcia@university.edu', studentId: 'ST007' },
    { firstName: 'Jennifer', lastName: 'Martinez', email: 'jennifer.martinez@university.edu', studentId: 'ST008' },
    { firstName: 'William', lastName: 'Anderson', email: 'william.anderson@university.edu', studentId: 'ST009' },
    { firstName: 'Ashley', lastName: 'Taylor', email: 'ashley.taylor@university.edu', studentId: 'ST010' }
  ],
  attendanceData: [
    // Perfect matches
    'John Smith,john.smith@university.edu,Present',
    'Emily Johnson,emily.johnson@university.edu,Present',
    'Michael Brown,michael.brown@university.edu,Present',
    
    // Name variations
    'J. Smith,john.smith@university.edu,Present',
    'Emily J.,emily.johnson@university.edu,Present',
    'Mike Brown,,Present',
    
    // Typos and misspellings
    'Sarah Daviss,sarah.davis@university.edu,Present',
    'Dvid Wilson,david.wilson@university.edu,Present',
    'Lisa Miler,,Present',
    
    // Different name orders
    'Garcia, Robert,robert.garcia@university.edu,Present',
    'Martinez Jennifer,jennifer.martinez@university.edu,Present',
    
    // Partial names
    'Will Anderson,,Present',
    'Ashley T.,,Present',
    
    // Non-existent students (should be unmatched)
    'Unknown Student,,Present',
    'Jane Doe,jane.doe@university.edu,Present'
  ]
};

// Utility functions
const log = (message, level = 'INFO') => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`);
};

const error = (message) => log(message, 'ERROR');
const success = (message) => log(message, 'SUCCESS');
const warning = (message) => log(message, 'WARNING');

// Test runner class
class AIIntegrationTester {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      tests: []
    };
    this.authToken = null;
    this.testSession = null;
  }

  async initialize() {
    log('Initializing AI Integration Test Suite...');
    
    // Create necessary directories
    if (!fs.existsSync(config.testDataDir)) {
      fs.mkdirSync(config.testDataDir, { recursive: true });
    }
    if (!fs.existsSync(config.outputDir)) {
      fs.mkdirSync(config.outputDir, { recursive: true });
    }

    // Generate test CSV file
    this.generateTestCSV();
    
    log('Initialization completed');
  }

  generateTestCSV() {
    const csvHeader = 'Student Name,Email,Status';
    const csvContent = [csvHeader, ...testData.attendanceData].join('\n');
    
    const csvPath = path.join(config.testDataDir, 'test-attendance.csv');
    fs.writeFileSync(csvPath, csvContent);
    
    log(`Test CSV file generated: ${csvPath}`);
  }

  async authenticateUser() {
    log('Authenticating test user...');
    
    try {
      // Try to register/login test user
      const response = await axios.post(`${config.apiUrl}/auth/login`, {
        email: 'test@smartattend.com',
        password: 'TestPassword123!'
      });

      this.authToken = response.data.accessToken;
      success('Authentication successful');
      return true;
    } catch (error) {
      // If login fails, try to register
      try {
        await axios.post(`${config.apiUrl}/auth/register`, {
          email: 'test@smartattend.com',
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User',
          role: 'TEACHER'
        });

        // Login after registration
        const loginResponse = await axios.post(`${config.apiUrl}/auth/login`, {
          email: 'test@smartattend.com',
          password: 'TestPassword123!'
        });

        this.authToken = loginResponse.data.accessToken;
        success('User registered and authenticated');
        return true;
      } catch (registerError) {
        error(`Authentication failed: ${registerError.message}`);
        return false;
      }
    }
  }

  async createTestSession() {
    log('Creating test session...');
    
    try {
      const response = await axios.post(
        `${config.apiUrl}/attendance/sessions`,
        {
          title: 'AI Test Session',
          description: 'Session for testing AI matching functionality',
          subject: 'Computer Science',
          scheduledAt: new Date().toISOString(),
          duration: 60
        },
        {
          headers: { Authorization: `Bearer ${this.authToken}` }
        }
      );

      this.testSession = response.data;
      success(`Test session created: ${this.testSession.id}`);
      return true;
    } catch (error) {
      error(`Failed to create test session: ${error.message}`);
      return false;
    }
  }

  async enrollTestStudents() {
    log('Enrolling test students...');
    
    try {
      // Create students in database
      for (const student of testData.students) {
        try {
          // Register student
          await axios.post(`${config.apiUrl}/auth/register`, {
            email: student.email,
            password: 'StudentPassword123!',
            firstName: student.firstName,
            lastName: student.lastName,
            role: 'STUDENT'
          });

          // Enroll in session
          await axios.post(
            `${config.apiUrl}/attendance/sessions/${this.testSession.id}/enroll`,
            { studentEmail: student.email },
            {
              headers: { Authorization: `Bearer ${this.authToken}` }
            }
          );
        } catch (enrollError) {
          // Student might already exist, continue
          warning(`Student enrollment warning: ${enrollError.message}`);
        }
      }

      success('Test students enrolled');
      return true;
    } catch (error) {
      error(`Failed to enroll students: ${error.message}`);
      return false;
    }
  }

  async testFileUpload() {
    log('Testing file upload...');
    
    const testName = 'File Upload Test';
    const startTime = Date.now();

    try {
      const csvPath = path.join(config.testDataDir, 'test-attendance.csv');
      const formData = new FormData();
      const fileBuffer = fs.readFileSync(csvPath);
      const blob = new Blob([fileBuffer], { type: 'text/csv' });
      
      formData.append('file', blob, 'test-attendance.csv');
      formData.append('sessionId', this.testSession.id);

      const response = await axios.post(
        `${config.apiUrl}/attendance/upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${this.authToken}`,
            'Content-Type': 'multipart/form-data'
          },
          timeout: config.maxProcessingTime
        }
      );

      const processingTime = Date.now() - startTime;
      
      this.recordTestResult(testName, true, {
        processingTime,
        uploadResponse: response.data
      });

      success(`File upload test passed (${processingTime}ms)`);
      return response.data;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      this.recordTestResult(testName, false, {
        processingTime,
        error: error.message
      });

      error(`File upload test failed: ${error.message}`);
      return null;
    }
  }

  async testAIMatching(uploadResult) {
    log('Testing AI matching accuracy...');
    
    const testName = 'AI Matching Accuracy Test';
    const startTime = Date.now();

    try {
      if (!uploadResult || !uploadResult.matches) {
        throw new Error('No upload result provided');
      }

      const { matches, unmatched, confidence } = uploadResult;
      const processingTime = Date.now() - startTime;

      // Analyze results
      const analysis = {
        totalRecords: testData.attendanceData.length,
        matchedRecords: matches.length,
        unmatchedRecords: unmatched.length,
        overallConfidence: confidence,
        processingTime
      };

      // Test accuracy expectations
      const expectedMatches = 12; // Based on our test data
      const accuracyThreshold = 0.8; // 80% accuracy expected

      const accuracy = matches.length / expectedMatches;
      const passed = accuracy >= accuracyThreshold && confidence >= config.confidenceThreshold;

      this.recordTestResult(testName, passed, {
        ...analysis,
        accuracy,
        expectedMatches,
        accuracyThreshold,
        confidenceThreshold: config.confidenceThreshold,
        detailedMatches: matches.map(m => ({
          originalName: m.originalName,
          matchedStudent: m.studentName,
          confidence: m.confidence,
          method: m.method
        })),
        unmatchedDetails: unmatched.map(u => ({
          originalName: u.originalName,
          reason: u.reason,
          suggestions: u.suggestions || []
        }))
      });

      if (passed) {
        success(`AI matching test passed - Accuracy: ${(accuracy * 100).toFixed(1)}%, Confidence: ${(confidence * 100).toFixed(1)}%`);
      } else {
        error(`AI matching test failed - Accuracy: ${(accuracy * 100).toFixed(1)}%, Confidence: ${(confidence * 100).toFixed(1)}%`);
      }

      return passed;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      this.recordTestResult(testName, false, {
        processingTime,
        error: error.message
      });

      error(`AI matching test failed: ${error.message}`);
      return false;
    }
  }

  async testPerformance() {
    log('Testing AI processing performance...');
    
    const testName = 'Performance Test';
    const startTime = Date.now();

    try {
      // Test multiple concurrent uploads
      const concurrentTests = 3;
      const promises = [];

      for (let i = 0; i < concurrentTests; i++) {
        promises.push(this.testFileUpload());
      }

      const results = await Promise.all(promises);
      const processingTime = Date.now() - startTime;
      
      const successfulResults = results.filter(r => r !== null);
      const averageProcessingTime = processingTime / concurrentTests;
      
      const passed = averageProcessingTime < config.maxProcessingTime && successfulResults.length === concurrentTests;

      this.recordTestResult(testName, passed, {
        concurrentTests,
        successfulResults: successfulResults.length,
        totalProcessingTime: processingTime,
        averageProcessingTime,
        maxAllowedTime: config.maxProcessingTime
      });

      if (passed) {
        success(`Performance test passed - Average time: ${averageProcessingTime.toFixed(0)}ms`);
      } else {
        error(`Performance test failed - Average time: ${averageProcessingTime.toFixed(0)}ms`);
      }

      return passed;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      this.recordTestResult(testName, false, {
        processingTime,
        error: error.message
      });

      error(`Performance test failed: ${error.message}`);
      return false;
    }
  }

  async testHealthChecks() {
    log('Testing system health...');
    
    const testName = 'System Health Test';

    try {
      const healthResponse = await axios.get(`${config.apiUrl.replace('/api', '')}/health`);
      const health = healthResponse.data;

      const passed = health.status === 'healthy' && 
                    health.services.database && 
                    health.services.redis &&
                    health.services.openai;

      this.recordTestResult(testName, passed, {
        healthStatus: health
      });

      if (passed) {
        success('System health test passed - All services healthy');
      } else {
        error('System health test failed - Some services unhealthy');
      }

      return passed;
    } catch (error) {
      this.recordTestResult(testName, false, {
        error: error.message
      });

      error(`System health test failed: ${error.message}`);
      return false;
    }
  }

  recordTestResult(testName, passed, details = {}) {
    this.results.total++;
    if (passed) {
      this.results.passed++;
    } else {
      this.results.failed++;
    }

    this.results.tests.push({
      name: testName,
      passed,
      timestamp: new Date().toISOString(),
      details
    });
  }

  async run() {
    log('=== Starting SmartAttend AI Integration Tests ===');
    
    try {
      await this.initialize();
      
      // Health check first
      await this.testHealthChecks();
      
      // Authentication
      if (!(await this.authenticateUser())) {
        throw new Error('Authentication failed');
      }

      // Setup test environment
      if (!(await this.createTestSession())) {
        throw new Error('Test session creation failed');
      }

      if (!(await this.enrollTestStudents())) {
        throw new Error('Student enrollment failed');
      }

      // Core AI functionality tests
      const uploadResult = await this.testFileUpload();
      if (uploadResult) {
        await this.testAIMatching(uploadResult);
      }

      // Performance tests
      await this.testPerformance();

      // Generate report
      this.generateReport();

      log('=== AI Integration Tests Completed ===');
      
    } catch (error) {
      error(`Test suite failed: ${error.message}`);
      this.generateReport();
      process.exit(1);
    }
  }

  generateReport() {
    const report = {
      summary: {
        total: this.results.total,
        passed: this.results.passed,
        failed: this.results.failed,
        successRate: this.results.total > 0 ? (this.results.passed / this.results.total * 100).toFixed(1) : 0,
        executedAt: new Date().toISOString()
      },
      tests: this.results.tests,
      configuration: config,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };

    const reportPath = path.join(config.outputDir, `ai-integration-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    log(`\n=== Test Report ===`);
    log(`Total Tests: ${report.summary.total}`);
    log(`Passed: ${report.summary.passed}`);
    log(`Failed: ${report.summary.failed}`);
    log(`Success Rate: ${report.summary.successRate}%`);
    log(`Report saved: ${reportPath}`);

    if (this.results.failed > 0) {
      error('Some tests failed. Check the detailed report for more information.');
      process.exit(1);
    } else {
      success('All tests passed successfully!');
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new AIIntegrationTester();
  tester.run().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = AIIntegrationTester;