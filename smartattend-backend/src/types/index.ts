import { Request } from 'express';
import { User, Role, AttendanceStatus, SessionStatus, ProcessingStatus } from '@prisma/client';

// Extended Express Request interface with user information
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: Role;
    firstName: string;
    lastName: string;
  };
}

// API Response interfaces
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: any[];
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Authentication interfaces
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: Role;
}

export interface JwtPayload {
  id: string;
  email: string;
  role: Role;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// Student interfaces
export interface StudentData {
  studentId?: string;
  phoneNumber?: string;
  address?: string;
  dateOfBirth?: Date;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  subjects?: string[];
}

export interface StudentProfile extends StudentData {
  id: string;
  userId: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

// Session interfaces
export interface SessionData {
  title: string;
  description?: string;
  subject: string;
  location?: string;
  scheduledAt: Date;
  duration: number;
  maxCapacity?: number;
  requiresAttendance?: boolean;
  teacherId?: string;
}

export interface SessionDetails extends SessionData {
  id: string;
  status: SessionStatus;
  createdById: string;
  enrolledStudents?: number;
  attendanceRecords?: AttendanceRecord[];
}

// Attendance interfaces
export interface AttendanceData {
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  notes?: string;
}

export interface AttendanceRecord extends AttendanceData {
  id: string;
  confidence?: number;
  matchedName?: string;
  aiMethod?: string;
  markedAt: Date;
  verifiedAt?: Date;
  verifiedBy?: string;
}

// File upload interfaces
export interface FileUploadData {
  sessionId?: string;
  originalName: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
}

export interface FileUploadDetails extends FileUploadData {
  id: string;
  processingStatus: ProcessingStatus;
  processingResult?: any;
  processingErrors?: any;
  aiAnalysis?: any;
  processedAt?: Date;
}

// AI matching interfaces
export interface AIMatchingRequest {
  fileName: string;
  csvData: string;
  sessionId?: string;
  options?: {
    confidenceThreshold?: number;
    enableLearning?: boolean;
    fallbackToPattern?: boolean;
  };
}

export interface AIMatchingResult {
  matches: MatchedRecord[];
  unmatched: UnmatchedRecord[];
  confidence: number;
  processingTime: number;
  method: 'ai' | 'pattern' | 'hybrid';
  errors?: string[];
}

export interface MatchedRecord {
  originalName: string;
  studentId: string;
  studentName: string;
  confidence: number;
  method: 'ai' | 'pattern' | 'exact';
  additionalData?: Record<string, any>;
}

export interface UnmatchedRecord {
  originalName: string;
  reason: string;
  suggestions?: {
    studentId: string;
    studentName: string;
    confidence: number;
  }[];
  additionalData?: Record<string, any>;
}

// Column detection interfaces
export interface DetectedColumn {
  index: number;
  name: string;
  type: 'name' | 'email' | 'id' | 'date' | 'status' | 'other';
  confidence: number;
  samples: string[];
}

export interface ColumnDetectionResult {
  columns: DetectedColumn[];
  nameColumn?: DetectedColumn;
  emailColumn?: DetectedColumn;
  idColumn?: DetectedColumn;
  dateColumn?: DetectedColumn;
  statusColumn?: DetectedColumn;
  confidence: number;
}

// Analytics interfaces
export interface AttendanceStats {
  totalSessions: number;
  totalStudents: number;
  averageAttendance: number;
  attendanceByStatus: Record<AttendanceStatus, number>;
  attendanceBySubject: Record<string, number>;
  recentTrends: {
    date: string;
    attendance: number;
  }[];
}

export interface SessionAnalytics {
  sessionId: string;
  totalEnrolled: number;
  totalPresent: number;
  totalAbsent: number;
  totalLate: number;
  attendanceRate: number;
  aiMatchingAccuracy?: number;
  processingTime?: number;
}

// Audit log interfaces
export interface AuditLogData {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
}

// System settings interfaces
export interface SystemSetting {
  id: string;
  key: string;
  value: any;
  category?: string;
}

// Error interfaces
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ApiError extends Error {
  statusCode: number;
  isOperational: boolean;
  errors?: ValidationError[];
}

// WebSocket interfaces
export interface SocketUser {
  id: string;
  email: string;
  role: Role;
}

export interface ProcessingUpdate {
  fileId: string;
  status: ProcessingStatus;
  progress?: number;
  message?: string;
  result?: AIMatchingResult;
}

// Health check interfaces
export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  services: {
    database: boolean;
    redis: boolean;
    openai: boolean;
  };
  performance: {
    uptime: number;
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: number;
  };
}

// Configuration interfaces
export interface AIConfig {
  provider: 'openai' | 'deepseek';
  model: string;
  temperature: number;
  maxTokens: number;
  confidenceThreshold: number;
  enableLearning: boolean;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

// Export all types from Prisma
export * from '@prisma/client';