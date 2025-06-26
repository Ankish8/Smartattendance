import dotenv from 'dotenv';
import { z } from 'zod';
import { logger } from './logger';

// Load environment variables
dotenv.config();

// Define the schema for environment variables
const envSchema = z.object({
  // Server Configuration
  PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_VERSION: z.string().default('v1'),

  // Database Configuration
  DATABASE_URL: z.string().min(1, 'Database URL is required'),

  // Redis Configuration
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_PASSWORD: z.string().optional(),

  // JWT Configuration
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT refresh secret must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // DeepSeek AI Configuration
  DEEPSEEK_API_KEY: z.string().min(1, 'DeepSeek API key is required'),
  DEEPSEEK_BASE_URL: z.string().default('https://api.deepseek.com'),

  // File Upload Configuration
  MAX_FILE_SIZE: z.string().default('10485760').transform(Number), // 10MB
  UPLOAD_PATH: z.string().default('./uploads'),
  ALLOWED_FILE_TYPES: z.string().default('csv,xlsx,xls'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform(Number), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100').transform(Number),

  // Session Configuration
  SESSION_SECRET: z.string().min(32, 'Session secret must be at least 32 characters'),
  SESSION_MAX_AGE: z.string().default('86400000').transform(Number), // 24 hours

  // Security
  BCRYPT_SALT_ROUNDS: z.string().default('12').transform(Number),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
  LOG_FILE: z.string().default('./logs/app.log'),

  // CORS Configuration
  CORS_ORIGIN: z.string().default('http://localhost:3001'),

  // Email Configuration
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().default('587').transform(Number),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  FROM_EMAIL: z.string().default('noreply@smartattend.com'),

  // Webhook Configuration
  WEBHOOK_SECRET: z.string().optional(),

  // Performance Monitoring
  ENABLE_METRICS: z.string().default('true').transform(value => value === 'true'),
  METRICS_PORT: z.string().default('9090').transform(Number),

  // AI Processing Configuration
  AI_CONFIDENCE_THRESHOLD: z.string().default('0.7').transform(Number),
  MAX_PROCESSING_TIME: z.string().default('30000').transform(Number), // 30 seconds
  ENABLE_LEARNING_FEEDBACK: z.string().default('true').transform(value => value === 'true'),
});

// Parse and validate environment variables
let env: z.infer<typeof envSchema>;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    logger.error('Environment validation failed:', {
      errors: error.errors,
    });
    
    // Log specific missing or invalid variables
    error.errors.forEach((err) => {
      logger.error(`Environment variable ${err.path.join('.')}: ${err.message}`);
    });
  }
  
  process.exit(1);
}

// Export the validated environment variables
export const config = {
  server: {
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    apiVersion: env.API_VERSION,
  },
  database: {
    url: env.DATABASE_URL,
  },
  redis: {
    url: env.REDIS_URL,
    password: env.REDIS_PASSWORD,
  },
  jwt: {
    secret: env.JWT_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },
  deepseek: {
    apiKey: env.DEEPSEEK_API_KEY,
    baseUrl: env.DEEPSEEK_BASE_URL,
    model: 'deepseek-chat',
    maxTokens: 2000,
    temperature: 0.1,
  },
  upload: {
    maxFileSize: env.MAX_FILE_SIZE,
    uploadPath: env.UPLOAD_PATH,
    allowedFileTypes: env.ALLOWED_FILE_TYPES.split(','),
  },
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  },
  session: {
    secret: env.SESSION_SECRET,
    maxAge: env.SESSION_MAX_AGE,
  },
  security: {
    bcryptSaltRounds: env.BCRYPT_SALT_ROUNDS,
  },
  logging: {
    level: env.LOG_LEVEL,
    file: env.LOG_FILE,
  },
  cors: {
    origin: env.CORS_ORIGIN,
  },
  email: {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.FROM_EMAIL,
  },
  webhook: {
    secret: env.WEBHOOK_SECRET,
  },
  metrics: {
    enabled: env.ENABLE_METRICS,
    port: env.METRICS_PORT,
  },
  ai: {
    confidenceThreshold: env.AI_CONFIDENCE_THRESHOLD,
    maxProcessingTime: env.MAX_PROCESSING_TIME,
    enableLearningFeedback: env.ENABLE_LEARNING_FEEDBACK,
  },
};

export default config;