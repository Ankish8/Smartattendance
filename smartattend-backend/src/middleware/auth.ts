import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '@/config/database';
import { logger } from '@/config/logger';
import { config } from '@/config/env';
import { AuthenticatedRequest, JwtPayload, Role } from '@/types';
import { ApiError } from '@/utils/errors';

/**
 * Middleware to authenticate JWT tokens
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError('Access token required', 401);
    }

    const token = authHeader.substring(7);
    
    // Verify JWT token
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    
    // Fetch user from database to ensure they still exist and are active
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new ApiError('User not found', 401);
    }

    if (!user.isActive) {
      throw new ApiError('Account is deactivated', 401);
    }

    // Attach user to request object
    req.user = user;

    // Update last login time
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid JWT token:', error.message);
      return next(new ApiError('Invalid access token', 401));
    }
    
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn('Expired JWT token');
      return next(new ApiError('Access token expired', 401));
    }

    next(error);
  }
};

/**
 * Middleware to authorize specific roles
 */
export const authorize = (roles: Role[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new ApiError('Authentication required', 401);
      }

      if (!roles.includes(req.user.role)) {
        logger.warn(`Unauthorized access attempt by user ${req.user.id} with role ${req.user.role}`);
        throw new ApiError('Insufficient permissions', 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware for admin-only access
 */
export const adminOnly = authorize([Role.ADMIN]);

/**
 * Middleware for teacher and admin access
 */
export const teacherOrAdmin = authorize([Role.TEACHER, Role.ADMIN]);

/**
 * Middleware for student and above access
 */
export const studentOrAbove = authorize([Role.STUDENT, Role.TEACHER, Role.ADMIN]);

/**
 * Optional authentication middleware
 * Doesn't throw error if no token provided, but validates if present
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
        },
      });

      if (user && user.isActive) {
        req.user = user;
      }
    } catch (error) {
      // Silently ignore invalid tokens for optional auth
      logger.debug('Optional auth failed:', error instanceof Error ? error.message : 'Unknown error');
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to check if user owns the resource or has admin privileges
 */
export const ownerOrAdmin = (userIdField: string = 'userId') => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ApiError('Authentication required', 401);
      }

      // Admin can access everything
      if (req.user.role === Role.ADMIN) {
        return next();
      }

      const resourceUserId = req.params[userIdField] || req.body[userIdField];
      
      if (!resourceUserId) {
        throw new ApiError('Resource user ID not found', 400);
      }

      if (req.user.id !== resourceUserId) {
        throw new ApiError('Access denied: You can only access your own resources', 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware to validate refresh token
 */
export const validateRefreshToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      throw new ApiError('Refresh token required', 400);
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as JwtPayload;
    
    // Check if refresh token exists in database
    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
          },
        },
      },
    });

    if (!tokenRecord) {
      throw new ApiError('Invalid refresh token', 401);
    }

    if (tokenRecord.expiresAt < new Date()) {
      // Remove expired token
      await prisma.refreshToken.delete({
        where: { id: tokenRecord.id },
      });
      throw new ApiError('Refresh token expired', 401);
    }

    if (!tokenRecord.user.isActive) {
      throw new ApiError('Account is deactivated', 401);
    }

    req.user = tokenRecord.user;
    req.body.tokenRecord = tokenRecord;

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid refresh token:', error.message);
      return next(new ApiError('Invalid refresh token', 401));
    }
    
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn('Expired refresh token');
      return next(new ApiError('Refresh token expired', 401));
    }

    next(error);
  }
};