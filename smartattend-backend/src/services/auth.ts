import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/config/database';
import { logger } from '@/config/logger';
import { config } from '@/config/env';
import { 
  LoginCredentials, 
  RegisterData, 
  JwtPayload, 
  TokenPair,
  Role 
} from '@/types';
import { 
  ApiError, 
  AuthenticationError, 
  ConflictError, 
  NotFoundError 
} from '@/utils/errors';
import { RedisConnection } from '@/config/redis';

export class AuthService {
  /**
   * Register a new user
   */
  async register(userData: RegisterData): Promise<{ user: any; tokens: TokenPair }> {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email },
      });

      if (existingUser) {
        throw new ConflictError('User with this email already exists');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, config.security.bcryptSaltRounds);

      // Create user
      const user = await prisma.user.create({
        data: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          password: hashedPassword,
          role: userData.role || Role.STUDENT,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });

      // Create student profile if role is student
      if (user.role === Role.STUDENT) {
        await prisma.student.create({
          data: {
            userId: user.id,
          },
        });
      }

      // Generate tokens
      const tokens = await this.generateTokens(user);

      // Log user registration
      logger.info(`New user registered: ${user.email} (${user.role})`);

      // Create audit log
      await this.createAuditLog({
        userId: user.id,
        action: 'user_registered',
        resource: 'user',
        resourceId: user.id,
        details: { email: user.email, role: user.role },
      });

      return { user, tokens };
    } catch (error) {
      logger.error('User registration failed:', error);
      throw error;
    }
  }

  /**
   * Login user
   */
  async login(credentials: LoginCredentials): Promise<{ user: any; tokens: TokenPair }> {
    try {
      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: credentials.email },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          password: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
        },
      });

      if (!user) {
        throw new AuthenticationError('Invalid email or password');
      }

      if (!user.isActive) {
        throw new AuthenticationError('Account is deactivated');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
      if (!isPasswordValid) {
        throw new AuthenticationError('Invalid email or password');
      }

      // Remove password from user object
      const { password, ...userWithoutPassword } = user;

      // Generate tokens
      const tokens = await this.generateTokens(userWithoutPassword);

      // Update last login time
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      // Log successful login
      logger.info(`User logged in: ${user.email}`);

      // Create audit log
      await this.createAuditLog({
        userId: user.id,
        action: 'user_login',
        resource: 'user',
        resourceId: user.id,
        details: { email: user.email, lastLoginAt: new Date() },
      });

      return { user: userWithoutPassword, tokens };
    } catch (error) {
      logger.error('User login failed:', error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<TokenPair> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as JwtPayload;

      // Find refresh token in database
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
        throw new AuthenticationError('Invalid refresh token');
      }

      if (tokenRecord.expiresAt < new Date()) {
        // Remove expired token
        await prisma.refreshToken.delete({
          where: { id: tokenRecord.id },
        });
        throw new AuthenticationError('Refresh token expired');
      }

      if (!tokenRecord.user.isActive) {
        throw new AuthenticationError('Account is deactivated');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(tokenRecord.user);

      // Remove old refresh token
      await prisma.refreshToken.delete({
        where: { id: tokenRecord.id },
      });

      logger.info(`Token refreshed for user: ${tokenRecord.user.email}`);

      return tokens;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid refresh token');
      }
      throw error;
    }
  }

  /**
   * Logout user
   */
  async logout(refreshToken: string): Promise<void> {
    try {
      // Remove refresh token from database
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      });

      // Add token to blacklist in Redis
      const decoded = jwt.decode(refreshToken) as any;
      if (decoded?.jti) {
        const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
        if (expiresIn > 0) {
          await RedisConnection.set(`blacklist:${decoded.jti}`, 'true', expiresIn);
        }
      }

      logger.info('User logged out successfully');
    } catch (error) {
      logger.error('Logout failed:', error);
      throw error;
    }
  }

  /**
   * Logout from all devices
   */
  async logoutAll(userId: string): Promise<void> {
    try {
      // Remove all refresh tokens for user
      await prisma.refreshToken.deleteMany({
        where: { userId },
      });

      // Create audit log
      await this.createAuditLog({
        userId,
        action: 'user_logout_all',
        resource: 'user',
        resourceId: userId,
        details: { reason: 'logout_all_devices' },
      });

      logger.info(`User logged out from all devices: ${userId}`);
    } catch (error) {
      logger.error('Logout all failed:', error);
      throw error;
    }
  }

  /**
   * Change password
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    try {
      // Find user
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, password: true, email: true },
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        throw new AuthenticationError('Current password is incorrect');
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, config.security.bcryptSaltRounds);

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedNewPassword },
      });

      // Logout from all devices for security
      await this.logoutAll(userId);

      // Create audit log
      await this.createAuditLog({
        userId,
        action: 'password_changed',
        resource: 'user',
        resourceId: userId,
        details: { email: user.email },
      });

      logger.info(`Password changed for user: ${user.email}`);
    } catch (error) {
      logger.error('Password change failed:', error);
      throw error;
    }
  }

  /**
   * Reset password request
   */
  async requestPasswordReset(email: string): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, firstName: true, lastName: true },
      });

      if (!user) {
        // Don't reveal if user exists
        logger.warn(`Password reset requested for non-existent email: ${email}`);
        return;
      }

      // Generate reset token
      const resetToken = uuidv4();
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store reset token in Redis
      await RedisConnection.set(
        `password_reset:${resetToken}`,
        user.id,
        60 * 60 // 1 hour
      );

      // Create audit log
      await this.createAuditLog({
        userId: user.id,
        action: 'password_reset_requested',
        resource: 'user',
        resourceId: user.id,
        details: { email: user.email },
      });

      // TODO: Send email with reset token
      logger.info(`Password reset requested for user: ${user.email}`);
    } catch (error) {
      logger.error('Password reset request failed:', error);
      throw error;
    }
  }

  /**
   * Reset password
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      // Get user ID from Redis
      const userId = await RedisConnection.get(`password_reset:${token}`);
      if (!userId) {
        throw new AuthenticationError('Invalid or expired reset token');
      }

      // Find user
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true },
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, config.security.bcryptSaltRounds);

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

      // Remove reset token
      await RedisConnection.del(`password_reset:${token}`);

      // Logout from all devices
      await this.logoutAll(userId);

      // Create audit log
      await this.createAuditLog({
        userId,
        action: 'password_reset_completed',
        resource: 'user',
        resourceId: userId,
        details: { email: user.email },
      });

      logger.info(`Password reset completed for user: ${user.email}`);
    } catch (error) {
      logger.error('Password reset failed:', error);
      throw error;
    }
  }

  /**
   * Generate JWT tokens
   */
  private async generateTokens(user: any): Promise<TokenPair> {
    const payload: JwtPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    // Generate access token
    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
      jwtid: uuidv4(),
    });

    // Generate refresh token
    const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn,
      jwtid: uuidv4(),
    });

    // Store refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  /**
   * Create audit log entry
   */
  private async createAuditLog(data: {
    userId?: string;
    action: string;
    resource: string;
    resourceId?: string;
    details?: any;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      await prisma.auditLog.create({
        data,
      });
    } catch (error) {
      logger.error('Failed to create audit log:', error);
    }
  }

  /**
   * Verify user permissions
   */
  async verifyPermissions(userId: string, requiredRole: Role): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, isActive: true },
      });

      if (!user || !user.isActive) {
        return false;
      }

      const roleHierarchy = {
        [Role.STUDENT]: 1,
        [Role.TEACHER]: 2,
        [Role.ADMIN]: 3,
      };

      return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
    } catch (error) {
      logger.error('Permission verification failed:', error);
      return false;
    }
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId: string): Promise<any> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          emailVerified: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          studentProfile: {
            include: {
              enrollments: {
                include: {
                  session: {
                    select: {
                      id: true,
                      title: true,
                      subject: true,
                      scheduledAt: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      return user;
    } catch (error) {
      logger.error('Failed to get user profile:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(
    userId: string,
    updateData: {
      firstName?: string;
      lastName?: string;
      preferences?: any;
    }
  ): Promise<any> {
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          preferences: true,
          updatedAt: true,
        },
      });

      // Create audit log
      await this.createAuditLog({
        userId,
        action: 'profile_updated',
        resource: 'user',
        resourceId: userId,
        details: updateData,
      });

      logger.info(`Profile updated for user: ${user.email}`);

      return user;
    } catch (error) {
      logger.error('Profile update failed:', error);
      throw error;
    }
  }
}