import { Response } from 'express';
import { ZodError, ZodIssue } from 'zod';
import { Prisma } from '@prisma/client';
import { logger } from '@/config/logger';
import { ValidationError } from '@/types';

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public errors?: ValidationError[];

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    errors?: ValidationError[]
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errors = errors;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Custom validation error class
 */
export class ValidationApiError extends ApiError {
  constructor(message: string, errors: ValidationError[]) {
    super(message, 400, true, errors);
  }
}

/**
 * Custom authentication error class
 */
export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication required') {
    super(message, 401);
  }
}

/**
 * Custom authorization error class
 */
export class AuthorizationError extends ApiError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403);
  }
}

/**
 * Custom not found error class
 */
export class NotFoundError extends ApiError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

/**
 * Custom conflict error class
 */
export class ConflictError extends ApiError {
  constructor(message: string = 'Resource already exists') {
    super(message, 409);
  }
}

/**
 * Custom rate limit error class
 */
export class RateLimitError extends ApiError {
  constructor(message: string = 'Too many requests') {
    super(message, 429);
  }
}

/**
 * Custom internal server error class
 */
export class InternalServerError extends ApiError {
  constructor(message: string = 'Internal server error') {
    super(message, 500);
  }
}

/**
 * Convert Zod errors to validation errors
 */
export const formatZodErrors = (error: ZodError): ValidationError[] => {
  return error.issues.map((issue: ZodIssue) => ({
    field: issue.path.join('.'),
    message: issue.message,
    value: issue.received || undefined,
  }));
};

/**
 * Convert Prisma errors to API errors
 */
export const handlePrismaError = (error: Prisma.PrismaClientKnownRequestError): ApiError => {
  switch (error.code) {
    case 'P2002':
      // Unique constraint violation
      const field = error.meta?.target as string[] | undefined;
      const fieldName = field ? field[0] : 'field';
      return new ConflictError(`${fieldName} already exists`);

    case 'P2025':
      // Record not found
      return new NotFoundError('Record not found');

    case 'P2003':
      // Foreign key constraint violation
      return new ApiError('Referenced record does not exist', 400);

    case 'P2014':
      // Required relation violation
      return new ApiError('Required relation is missing', 400);

    case 'P2015':
      // Related record not found
      return new NotFoundError('Related record not found');

    case 'P2021':
      // Table does not exist
      return new InternalServerError('Database table does not exist');

    case 'P2022':
      // Column does not exist
      return new InternalServerError('Database column does not exist');

    default:
      logger.error('Unhandled Prisma error:', {
        code: error.code,
        message: error.message,
        meta: error.meta,
      });
      return new InternalServerError('Database operation failed');
  }
};

/**
 * Send error response
 */
export const sendErrorResponse = (res: Response, error: ApiError): void => {
  const response = {
    success: false,
    message: error.message,
    ...(error.errors && { errors: error.errors }),
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  };

  res.status(error.statusCode).json(response);
};

/**
 * Global error handler
 */
export const globalErrorHandler = (error: any, res: Response): void => {
  let apiError: ApiError;

  // Handle different types of errors
  if (error instanceof ApiError) {
    apiError = error;
  } else if (error instanceof ZodError) {
    const validationErrors = formatZodErrors(error);
    apiError = new ValidationApiError('Validation failed', validationErrors);
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    apiError = handlePrismaError(error);
  } else if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    logger.error('Unknown Prisma error:', error);
    apiError = new InternalServerError('Database operation failed');
  } else if (error instanceof Prisma.PrismaClientRustPanicError) {
    logger.error('Prisma client panic:', error);
    apiError = new InternalServerError('Database client error');
  } else if (error instanceof Prisma.PrismaClientInitializationError) {
    logger.error('Prisma initialization error:', error);
    apiError = new InternalServerError('Database connection failed');
  } else if (error instanceof Prisma.PrismaClientValidationError) {
    logger.error('Prisma validation error:', error);
    apiError = new ApiError('Invalid database query', 400);
  } else if (error.name === 'CastError') {
    // MongoDB ObjectId cast error
    apiError = new ApiError('Invalid ID format', 400);
  } else if (error.code === 11000) {
    // MongoDB duplicate key error
    apiError = new ConflictError('Duplicate entry');
  } else if (error.name === 'ValidationError') {
    // Mongoose validation error
    const validationErrors: ValidationError[] = Object.values(error.errors).map((err: any) => ({
      field: err.path,
      message: err.message,
      value: err.value,
    }));
    apiError = new ValidationApiError('Validation failed', validationErrors);
  } else {
    // Generic error
    logger.error('Unhandled error:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    apiError = new InternalServerError();
  }

  // Log error if it's operational
  if (apiError.isOperational) {
    logger.warn('Operational error:', {
      message: apiError.message,
      statusCode: apiError.statusCode,
      errors: apiError.errors,
    });
  } else {
    logger.error('Non-operational error:', {
      message: apiError.message,
      statusCode: apiError.statusCode,
      stack: apiError.stack,
    });
  }

  sendErrorResponse(res, apiError);
};

/**
 * Async error handler wrapper
 */
export const asyncHandler = (fn: Function) => {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Handle unhandled promise rejections
 */
export const handleUnhandledRejections = (): void => {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });
};

/**
 * Handle uncaught exceptions
 */
export const handleUncaughtExceptions = (): void => {
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
  });
};

/**
 * Graceful shutdown handler
 */
export const handleGracefulShutdown = (server: any): void => {
  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};