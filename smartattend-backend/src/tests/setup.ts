import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { RedisConnection } from '@/config/redis';

// Mock Prisma
jest.mock('@/config/database', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
  DatabaseConnection: {
    getInstance: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    healthCheck: jest.fn(),
  },
}));

// Mock Redis
jest.mock('@/config/redis', () => ({
  __esModule: true,
  redisClient: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    ping: jest.fn(),
  },
  RedisConnection: {
    getInstance: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    healthCheck: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
  },
}));

// Mock OpenAI
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    columns: [],
                    confidence: 0.8,
                  }),
                },
              },
            ],
          }),
        },
      },
    })),
  };
});

// Mock Logger
jest.mock('@/config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  httpLogger: {
    http: jest.fn(),
  },
}));

beforeEach(() => {
  mockReset(prismaMock);
});

declare global {
  var __PRISMAMOCK__: DeepMockProxy<PrismaClient>;
}

global.__PRISMAMOCK__ = mockDeep<PrismaClient>();

export const prismaMock = global.__PRISMAMOCK__;

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.OPENAI_API_KEY = 'test-openai-key';