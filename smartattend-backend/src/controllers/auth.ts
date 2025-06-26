import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthService } from '@/services/auth';
import { AuthenticatedRequest, ApiResponse } from '@/types';
import { asyncHandler } from '@/utils/errors';
import { logger } from '@/config/logger';

const authService = new AuthService();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  role: z.enum(['STUDENT', 'TEACHER', 'ADMIN']).optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128),
});

const resetPasswordRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  preferences: z.record(z.any()).optional(),
});

export class AuthController {
  /**
   * Register a new user
   * POST /api/auth/register
   */
  register = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const validatedData = registerSchema.parse(req.body);
    
    const result = await authService.register(validatedData);
    
    const response: ApiResponse = {
      success: true,
      message: 'User registered successfully',
      data: {
        user: result.user,
        tokens: result.tokens,
      },
    };
    
    logger.info(`User registered: ${result.user.email}`);
    res.status(201).json(response);
  });

  /**
   * Login user
   * POST /api/auth/login
   */
  login = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const validatedData = loginSchema.parse(req.body);
    
    const result = await authService.login(validatedData);
    
    const response: ApiResponse = {
      success: true,
      message: 'Login successful',
      data: {
        user: result.user,
        tokens: result.tokens,
      },
    };
    
    logger.info(`User logged in: ${result.user.email}`);
    res.status(200).json(response);
  });

  /**
   * Refresh access token
   * POST /api/auth/refresh
   */
  refreshToken = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { refreshToken } = refreshTokenSchema.parse(req.body);
    
    const tokens = await authService.refreshToken(refreshToken);
    
    const response: ApiResponse = {
      success: true,
      message: 'Token refreshed successfully',
      data: { tokens },
    };
    
    res.status(200).json(response);
  });

  /**
   * Logout user
   * POST /api/auth/logout
   */
  logout = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { refreshToken } = refreshTokenSchema.parse(req.body);
    
    await authService.logout(refreshToken);
    
    const response: ApiResponse = {
      success: true,
      message: 'Logout successful',
    };
    
    res.status(200).json(response);
  });

  /**
   * Logout from all devices
   * POST /api/auth/logout-all
   */
  logoutAll = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }
    
    await authService.logoutAll(req.user.id);
    
    const response: ApiResponse = {
      success: true,
      message: 'Logged out from all devices successfully',
    };
    
    res.status(200).json(response);
  });

  /**
   * Change password
   * POST /api/auth/change-password
   */
  changePassword = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    
    await authService.changePassword(req.user.id, currentPassword, newPassword);
    
    const response: ApiResponse = {
      success: true,
      message: 'Password changed successfully',
    };
    
    res.status(200).json(response);
  });

  /**
   * Request password reset
   * POST /api/auth/reset-password-request
   */
  requestPasswordReset = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { email } = resetPasswordRequestSchema.parse(req.body);
    
    await authService.requestPasswordReset(email);
    
    const response: ApiResponse = {
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent',
    };
    
    res.status(200).json(response);
  });

  /**
   * Reset password
   * POST /api/auth/reset-password
   */
  resetPassword = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);
    
    await authService.resetPassword(token, newPassword);
    
    const response: ApiResponse = {
      success: true,
      message: 'Password reset successfully',
    };
    
    res.status(200).json(response);
  });

  /**
   * Get current user profile
   * GET /api/auth/profile
   */
  getProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }
    
    const profile = await authService.getUserProfile(req.user.id);
    
    const response: ApiResponse = {
      success: true,
      message: 'Profile retrieved successfully',
      data: { user: profile },
    };
    
    res.status(200).json(response);
  });

  /**
   * Update user profile
   * PATCH /api/auth/profile
   */
  updateProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const updateData = updateProfileSchema.parse(req.body);
    
    const updatedUser = await authService.updateUserProfile(req.user.id, updateData);
    
    const response: ApiResponse = {
      success: true,
      message: 'Profile updated successfully',
      data: { user: updatedUser },
    };
    
    res.status(200).json(response);
  });

  /**
   * Verify authentication status
   * GET /api/auth/verify
   */
  verify = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }
    
    const response: ApiResponse = {
      success: true,
      message: 'Authentication verified',
      data: {
        user: {
          id: req.user.id,
          email: req.user.email,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          role: req.user.role,
        },
      },
    };
    
    res.status(200).json(response);
  });
}