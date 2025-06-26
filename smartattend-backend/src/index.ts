import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Server } from 'socket.io';
import { createServer } from 'http';

// Import configurations
import { config } from '@/config/env';
import { logger, httpLogger } from '@/config/logger';
import { DatabaseConnection } from '@/config/database';
import { RedisConnection } from '@/config/redis';

// Import middleware
import { 
  corsOptions, 
  generalRateLimit,
  helmetConfig,
  compressionConfig,
  securityHeaders,
  httpsRedirect,
  validateRequest 
} from '@/middleware/security';

// Import routes
import authRoutes from '@/routes/auth';
import attendanceRoutes from '@/routes/attendance';

// Import utilities
import { 
  globalErrorHandler,
  handleUnhandledRejections,
  handleUncaughtExceptions,
  handleGracefulShutdown,
  ApiError 
} from '@/utils/errors';
import { AuthenticatedRequest } from '@/types';

class SmartAttendApp {
  private app: express.Application;
  private server: any;
  private io: Server;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: corsOptions,
      transports: ['websocket', 'polling'],
    });

    this.initializeErrorHandlers();
    this.initializeMiddleware();
    this.initializeSwagger();
    this.initializeRoutes();
    this.initializeSocketIO();
    this.initializeGlobalErrorHandler();
  }

  /**
   * Initialize error handlers for unhandled rejections and exceptions
   */
  private initializeErrorHandlers(): void {
    handleUnhandledRejections();
    handleUncaughtExceptions();
  }

  /**
   * Initialize middleware
   */
  private initializeMiddleware(): void {
    // Trust proxy for accurate IP addresses
    this.app.set('trust proxy', 1);

    // Security middleware
    this.app.use(httpsRedirect);
    this.app.use(helmetConfig);
    this.app.use(securityHeaders);
    
    // CORS
    this.app.use(cors(corsOptions));
    
    // Compression
    this.app.use(compressionConfig);
    
    // Rate limiting
    this.app.use(generalRateLimit);
    
    // Request validation
    this.app.use(validateRequest);
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // HTTP request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        httpLogger.http(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`, {
          method: req.method,
          url: req.originalUrl,
          status: res.statusCode,
          duration,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
        });
      });
      
      next();
    });

    // Add request ID for tracing
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      req.id = req.headers['x-request-id'] as string || 
               `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      res.setHeader('X-Request-ID', req.id);
      next();
    });
  }

  /**
   * Initialize Swagger documentation
   */
  private initializeSwagger(): void {
    const swaggerOptions = {
      definition: {
        openapi: '3.0.0',
        info: {
          title: 'SmartAttend API',
          version: '1.0.0',
          description: 'AI-powered attendance tracking system API',
          contact: {
            name: 'SmartAttend Team',
            email: 'api@smartattend.com',
          },
          license: {
            name: 'MIT',
            url: 'https://opensource.org/licenses/MIT',
          },
        },
        servers: [
          {
            url: `http://localhost:${config.server.port}/api`,
            description: 'Development server',
          },
          {
            url: 'https://api.smartattend.com/api',
            description: 'Production server',
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
        security: [
          {
            bearerAuth: [],
          },
        ],
      },
      apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
    };

    const swaggerSpec = swaggerJsdoc(swaggerOptions);

    // Serve Swagger documentation
    this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'SmartAttend API Documentation',
    }));

    // Serve OpenAPI JSON
    this.app.get('/api-docs.json', (req: Request, res: Response) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerSpec);
    });

    logger.info('Swagger documentation initialized at /api-docs');
  }

  /**
   * Initialize routes
   */
  private initializeRoutes(): void {
    // Health check endpoint
    this.app.get('/health', async (req: Request, res: Response) => {
      try {
        const [dbHealthy, redisHealthy] = await Promise.all([
          DatabaseConnection.healthCheck(),
          RedisConnection.healthCheck(),
        ]);

        const health = {
          status: dbHealthy && redisHealthy ? 'healthy' : 'unhealthy',
          timestamp: new Date().toISOString(),
          services: {
            database: dbHealthy,
            redis: redisHealthy,
            openai: !!config.openai.apiKey,
          },
          performance: {
            uptime: process.uptime(),
            memory: {
              used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
              total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
              percentage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100),
            },
            cpu: process.cpuUsage(),
          },
        };

        res.status(dbHealthy && redisHealthy ? 200 : 503).json(health);
      } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: 'Health check failed',
        });
      }
    });

    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/attendance', attendanceRoutes);

    // API info endpoint
    this.app.get('/api', (req: Request, res: Response) => {
      res.json({
        name: 'SmartAttend API',
        version: '1.0.0',
        description: 'AI-powered attendance tracking system',
        documentation: '/api-docs',
        endpoints: {
          auth: '/api/auth',
          attendance: '/api/attendance',
          health: '/health',
        },
        timestamp: new Date().toISOString(),
      });
    });

    // 404 handler for API routes
    this.app.all('/api/*', (req: Request, res: Response) => {
      throw new ApiError(`Route ${req.originalUrl} not found`, 404);
    });

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        message: 'Welcome to SmartAttend API',
        version: '1.0.0',
        documentation: '/api-docs',
        api: '/api',
        health: '/health',
      });
    });

    logger.info('Routes initialized successfully');
  }

  /**
   * Initialize Socket.IO for real-time features
   */
  private initializeSocketIO(): void {
    this.io.on('connection', (socket) => {
      logger.info(`Client connected: ${socket.id}`);

      // Handle authentication
      socket.on('authenticate', async (token: string) => {
        try {
          // TODO: Implement JWT verification for socket connections
          socket.emit('authenticated', { success: true });
          logger.info(`Socket authenticated: ${socket.id}`);
        } catch (error) {
          socket.emit('authentication_error', { message: 'Invalid token' });
          logger.warn(`Socket authentication failed: ${socket.id}`);
        }
      });

      // Handle joining rooms for real-time updates
      socket.on('join_session', (sessionId: string) => {
        socket.join(`session_${sessionId}`);
        logger.info(`Socket ${socket.id} joined session ${sessionId}`);
      });

      socket.on('leave_session', (sessionId: string) => {
        socket.leave(`session_${sessionId}`);
        logger.info(`Socket ${socket.id} left session ${sessionId}`);
      });

      socket.on('disconnect', (reason) => {
        logger.info(`Client disconnected: ${socket.id}, reason: ${reason}`);
      });
    });

    // Expose io instance for use in controllers
    this.app.set('io', this.io);

    logger.info('Socket.IO initialized successfully');
  }

  /**
   * Initialize global error handler
   */
  private initializeGlobalErrorHandler(): void {
    // 404 handler for non-API routes
    this.app.all('*', (req: Request, res: Response) => {
      throw new ApiError(`Route ${req.originalUrl} not found`, 404);
    });

    // Global error handler
    this.app.use((error: any, req: Request, res: Response, next: NextFunction) => {
      globalErrorHandler(error, res);
    });
  }

  /**
   * Start the server
   */
  public async start(): Promise<void> {
    try {
      // Connect to databases
      await DatabaseConnection.connect();
      await RedisConnection.connect();

      // Start server
      this.server = this.server.listen(config.server.port, () => {
        logger.info(`🚀 SmartAttend API server started on port ${config.server.port}`);
        logger.info(`📖 API Documentation: http://localhost:${config.server.port}/api-docs`);
        logger.info(`🔍 Health Check: http://localhost:${config.server.port}/health`);
        logger.info(`🌍 Environment: ${config.server.nodeEnv}`);
      });

      // Setup graceful shutdown
      handleGracefulShutdown(this.server);

      // Additional startup tasks
      await this.performStartupTasks();

    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  /**
   * Perform additional startup tasks
   */
  private async performStartupTasks(): Promise<void> {
    try {
      // Run database migrations if needed
      // await prisma.$migrate.deploy();

      // Seed initial data if needed
      // await this.seedInitialData();

      // Clear expired tokens from Redis
      await this.clearExpiredTokens();

      logger.info('Startup tasks completed successfully');
    } catch (error) {
      logger.warn('Some startup tasks failed:', error);
    }
  }

  /**
   * Clear expired tokens from Redis
   */
  private async clearExpiredTokens(): Promise<void> {
    try {
      const client = RedisConnection.getInstance();
      const keys = await client.keys('password_reset:*');
      
      if (keys.length > 0) {
        await client.del(keys);
        logger.info(`Cleared ${keys.length} expired password reset tokens`);
      }
    } catch (error) {
      logger.warn('Failed to clear expired tokens:', error);
    }
  }

  /**
   * Get Express app instance
   */
  public getApp(): express.Application {
    return this.app;
  }

  /**
   * Get Socket.IO instance
   */
  public getIO(): Server {
    return this.io;
  }
}

// Create and start the application
const app = new SmartAttendApp();

// Start server if this file is run directly
if (require.main === module) {
  app.start().catch((error) => {
    logger.error('Failed to start application:', error);
    process.exit(1);
  });
}

export default app;