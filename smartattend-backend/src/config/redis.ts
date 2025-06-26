import { createClient, RedisClientType } from 'redis';
import { logger } from './logger';

class RedisConnection {
  private static instance: RedisClientType;

  public static getInstance(): RedisClientType {
    if (!RedisConnection.instance) {
      RedisConnection.instance = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        password: process.env.REDIS_PASSWORD || undefined,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries >= 20) {
              logger.error('Too many Redis reconnection attempts, giving up');
              return new Error('Too many Redis reconnection attempts');
            }
            return Math.min(retries * 50, 500);
          },
        },
      });

      RedisConnection.instance.on('error', (err) => {
        logger.error('Redis Client Error:', err);
      });

      RedisConnection.instance.on('connect', () => {
        logger.info('Redis connected successfully');
      });

      RedisConnection.instance.on('ready', () => {
        logger.info('Redis client is ready');
      });

      RedisConnection.instance.on('end', () => {
        logger.info('Redis connection ended');
      });

      RedisConnection.instance.on('reconnecting', () => {
        logger.warn('Redis reconnecting...');
      });
    }

    return RedisConnection.instance;
  }

  public static async connect(): Promise<void> {
    try {
      const client = RedisConnection.getInstance();
      if (!client.isOpen) {
        await client.connect();
      }
      logger.info('Redis connected successfully');
    } catch (error) {
      logger.error('Redis connection failed:', error);
      throw error;
    }
  }

  public static async disconnect(): Promise<void> {
    try {
      const client = RedisConnection.getInstance();
      if (client.isOpen) {
        await client.disconnect();
      }
      logger.info('Redis disconnected successfully');
    } catch (error) {
      logger.error('Redis disconnection failed:', error);
      throw error;
    }
  }

  public static async healthCheck(): Promise<boolean> {
    try {
      const client = RedisConnection.getInstance();
      await client.ping();
      return true;
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return false;
    }
  }

  // Utility methods for caching
  public static async get(key: string): Promise<string | null> {
    try {
      const client = RedisConnection.getInstance();
      return await client.get(key);
    } catch (error) {
      logger.error('Redis GET error:', error);
      return null;
    }
  }

  public static async set(key: string, value: string, ttl?: number): Promise<boolean> {
    try {
      const client = RedisConnection.getInstance();
      if (ttl) {
        await client.setEx(key, ttl, value);
      } else {
        await client.set(key, value);
      }
      return true;
    } catch (error) {
      logger.error('Redis SET error:', error);
      return false;
    }
  }

  public static async del(key: string): Promise<boolean> {
    try {
      const client = RedisConnection.getInstance();
      await client.del(key);
      return true;
    } catch (error) {
      logger.error('Redis DEL error:', error);
      return false;
    }
  }

  public static async exists(key: string): Promise<boolean> {
    try {
      const client = RedisConnection.getInstance();
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXISTS error:', error);
      return false;
    }
  }
}

export const redisClient = RedisConnection.getInstance();
export { RedisConnection };