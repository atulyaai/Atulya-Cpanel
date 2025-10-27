import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import staticFiles from '@fastify/static';
import websocket from '@fastify/websocket';
import { PrismaClient } from '@prisma/client';
import { env } from './config/env.js';
import { errorHandler } from './utils/errorHandler.js';
import { auditLogger } from './middleware/auditLogger.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { securityMiddleware } from './middleware/security.js';
import { authRoutes } from './routes/auth.js';
import { siteRoutes } from './routes/sites.js';
import { databaseRoutes } from './routes/databases.js';
import { emailRoutes } from './routes/email.js';
import { domainRoutes } from './routes/domains.js';
import { backupRoutes } from './routes/backups.js';
import { cronRoutes } from './routes/cron.js';
import { fileRoutes } from './routes/files.js';
import { sslRoutes } from './routes/ssl.js';
import { userRoutes } from './routes/users.js';
import { metricsRoutes } from './routes/metrics.js';
import { monitoringRoutes } from './routes/monitoring.js';
import { serviceRoutes } from './routes/services.js';
import { setupWebSocket } from './utils/websocket.js';
import { setupJobs } from './jobs/index.js';
import path from 'path';

/**
 * Initialize Prisma database client with environment-specific logging
 * Development: Full logging, Production: Error-only logging
 */
export const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

/**
 * Create Fastify server instance with production-ready configuration
 * - Trust proxy for proper IP detection behind load balancers
 * - Configurable logging level and file output
 */
const fastify = Fastify({
  logger: {
    level: env.LOG_LEVEL,
    file: env.LOG_FILE,
  },
  trustProxy: true, // Required for proper IP detection behind proxies
});

/**
 * Register all Fastify plugins in the correct order
 * - CORS: Cross-origin resource sharing for frontend communication
 * - JWT: JSON Web Token authentication with configurable expiration
 * - Multipart: File upload support with 100MB size limit
 * - Static: Serve uploaded files from /uploads directory
 * - WebSocket: Real-time communication for system monitoring
 */
async function registerPlugins() {
  // Enable CORS for frontend communication
  await fastify.register(cors, {
    origin: [env.FRONTEND_URL],
    credentials: true, // Allow cookies and authorization headers
  });

  // Configure JWT authentication with refresh token support
  await fastify.register(jwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: env.JWT_EXPIRES_IN, // Access token expiration
    },
    verify: {
      maxAge: env.JWT_EXPIRES_IN, // Token validation window
    },
  });

  // Enable file uploads with security limits
  await fastify.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB maximum file size
    },
  });

  // Serve static files from uploads directory
  await fastify.register(staticFiles, {
    root: path.join(process.cwd(), 'uploads'),
    prefix: '/uploads/', // Access files via /uploads/filename
  });

  // Enable WebSocket for real-time system monitoring
  await fastify.register(websocket);
}

/**
 * Register middleware in the correct order for security and functionality
 * - Error Handler: Centralized error processing and logging
 * - Security Middleware: Rate limiting, security headers, input validation
 * - Audit Logger: Track all API requests for security and compliance
 */
async function registerMiddleware() {
  // Set global error handler for consistent error responses
  fastify.setErrorHandler(errorHandler);

  // Apply comprehensive security middleware
  fastify.register(securityMiddleware);

  // Enable audit logging for all requests
  fastify.register(auditLogger);
}

/**
 * Register all API routes with proper versioning and organization
 * All routes are prefixed with /api/v1 for version management
 */
async function registerRoutes() {
  // Health check endpoint for load balancers and monitoring
  fastify.get('/health', async (request, reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Register all API route modules with version prefix
  await fastify.register(authRoutes, { prefix: '/api/v1/auth' });
  await fastify.register(siteRoutes, { prefix: '/api/v1/sites' });
  await fastify.register(databaseRoutes, { prefix: '/api/v1/databases' });
  await fastify.register(emailRoutes, { prefix: '/api/v1/email' });
  await fastify.register(domainRoutes, { prefix: '/api/v1/domains' });
  await fastify.register(backupRoutes, { prefix: '/api/v1/backups' });
  await fastify.register(cronRoutes, { prefix: '/api/v1/cron' });
  await fastify.register(fileRoutes, { prefix: '/api/v1/files' });
  await fastify.register(sslRoutes, { prefix: '/api/v1/ssl' });
  await fastify.register(userRoutes, { prefix: '/api/v1/users' });
  await fastify.register(metricsRoutes, { prefix: '/api/v1/metrics' });
  await fastify.register(monitoringRoutes, { prefix: '/api/v1/monitoring' });
  await fastify.register(serviceRoutes, { prefix: '/api/v1' });
}

/**
 * Setup infrastructure services for real-time monitoring and background jobs
 * - WebSocket: Real-time system metrics and alerts
 * - Jobs: Scheduled tasks for maintenance and automation
 */
async function setupInfrastructure() {
  await setupWebSocket(fastify); // Initialize real-time monitoring
  await setupJobs(); // Start background job processing
}

/**
 * Graceful shutdown handler for clean server termination
 * Ensures all connections are properly closed and resources are freed
 */
async function gracefulShutdown() {
  fastify.log.info('Shutting down gracefully...');

  try {
    // Cleanup WebSocket service to prevent memory leaks
    const webSocketService = (fastify as any).websocketService;
    if (webSocketService) {
      webSocketService.cleanup();
    }

    // Close server and database connections
    await fastify.close();
    await prisma.$disconnect();
    fastify.log.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    fastify.log.error('Error during shutdown:', error);
    process.exit(1);
  }
}

/**
 * Main server startup function
 * Initializes all components in the correct order for proper functionality
 */
async function start() {
  try {
    // Register all components in dependency order
    await registerPlugins(); // Core plugins first
    await registerMiddleware(); // Middleware before routes
    await registerRoutes(); // API routes
    await setupInfrastructure(); // Background services

    // Start the server on configured host and port
    await fastify.listen({
      port: env.PORT,
      host: env.HOST,
    });

    // Log successful startup with key information
    fastify.log.info(`🚀 Atulya Panel Backend running on http://${env.HOST}:${env.PORT}`);
    fastify.log.info(`📊 Environment: ${env.NODE_ENV}`);
    fastify.log.info(`🗄️ Database: ${env.DATABASE_URL.split('@')[1] || 'local'}`);
    fastify.log.info(`⚙️ Provider: ${env.PROVIDER}`);

  } catch (error) {
    fastify.log.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Register signal handlers for graceful shutdown
process.on('SIGTERM', gracefulShutdown); // Termination signal from system
process.on('SIGINT', gracefulShutdown);  // Interrupt signal (Ctrl+C)

// Handle uncaught exceptions and unhandled promise rejections
process.on('uncaughtException', (error) => {
  fastify.log.error('Uncaught Exception:', error);
  process.exit(1); // Exit immediately on uncaught exceptions
});

process.on('unhandledRejection', (reason, promise) => {
  fastify.log.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1); // Exit immediately on unhandled rejections
});

// Start the server
start();