import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

class DatabaseConnection {
  private static instance: PrismaClient;

  public static getInstance(): PrismaClient {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new PrismaClient({
        log: [
          {
            emit: 'event',
            level: 'query',
          },
          {
            emit: 'event',
            level: 'error',
          },
          {
            emit: 'event',
            level: 'info',
          },
          {
            emit: 'event',
            level: 'warn',
          },
        ],
      });

      // Log database queries in development
      if (process.env.NODE_ENV === 'development') {
        DatabaseConnection.instance.$on('query', (e) => {
          logger.debug('Database Query:', {
            query: e.query,
            params: e.params,
            duration: `${e.duration}ms`,
          });
        });
      }

      DatabaseConnection.instance.$on('error', (e) => {
        logger.error('Database Error:', e);
      });

      DatabaseConnection.instance.$on('info', (e) => {
        logger.info('Database Info:', e);
      });

      DatabaseConnection.instance.$on('warn', (e) => {
        logger.warn('Database Warning:', e);
      });
    }

    return DatabaseConnection.instance;
  }

  public static async connect(): Promise<void> {
    try {
      const prisma = DatabaseConnection.getInstance();
      await prisma.$connect();
      logger.info('Database connected successfully');
    } catch (error) {
      logger.error('Database connection failed:', error);
      throw error;
    }
  }

  public static async disconnect(): Promise<void> {
    try {
      const prisma = DatabaseConnection.getInstance();
      await prisma.$disconnect();
      logger.info('Database disconnected successfully');
    } catch (error) {
      logger.error('Database disconnection failed:', error);
      throw error;
    }
  }

  public static async healthCheck(): Promise<boolean> {
    try {
      const prisma = DatabaseConnection.getInstance();
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      logger.error('Database health check failed:', error);
      return false;
    }
  }
}

export const prisma = DatabaseConnection.getInstance();
export { DatabaseConnection };