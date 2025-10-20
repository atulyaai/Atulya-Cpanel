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
import { setupWebSocket } from './utils/websocket.js';
import { setupJobs } from './jobs/index.js';
import path from 'path';

// Initialize Prisma
export const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

// Create Fastify instance
const fastify = Fastify({
  logger: {
    level: env.LOG_LEVEL,
    file: env.LOG_FILE,
  },
  trustProxy: true,
});

// Register plugins
async function registerPlugins() {
  // CORS
  await fastify.register(cors, {
    origin: [env.FRONTEND_URL],
    credentials: true,
  });

  // JWT
  await fastify.register(jwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: env.JWT_EXPIRES_IN,
    },
    verify: {
      maxAge: env.JWT_EXPIRES_IN,
    },
  });

  // Multipart for file uploads
  await fastify.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB
    },
  });

  // Static files
  await fastify.register(staticFiles, {
    root: path.join(process.cwd(), 'uploads'),
    prefix: '/uploads/',
  });

  // WebSocket support
  await fastify.register(websocket);
}

// Register middleware
async function registerMiddleware() {
  // Error handler
  fastify.setErrorHandler(errorHandler);

  // Rate limiting
  fastify.register(rateLimiter);

  // Audit logging
  fastify.register(auditLogger);
}

// Register routes
async function registerRoutes() {
  // Health check
  fastify.get('/health', async (request, reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // API routes
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
}

// Setup WebSocket and jobs
async function setupInfrastructure() {
  await setupWebSocket(fastify);
  await setupJobs();
}

// Graceful shutdown
async function gracefulShutdown() {
  fastify.log.info('Shutting down gracefully...');
  
  try {
    // Cleanup WebSocket service
    const webSocketService = (fastify as any).websocketService;
    if (webSocketService) {
      webSocketService.cleanup();
    }
    
    await fastify.close();
    await prisma.$disconnect();
    fastify.log.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    fastify.log.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Start server
async function start() {
  try {
    // Register everything
    await registerPlugins();
    await registerMiddleware();
    await registerRoutes();
    await setupInfrastructure();

    // Start server
    await fastify.listen({
      port: env.PORT,
      host: env.HOST,
    });

    fastify.log.info(`🚀 Atulya Panel Backend running on http://${env.HOST}:${env.PORT}`);
    fastify.log.info(`📊 Environment: ${env.NODE_ENV}`);
    fastify.log.info(`🗄️ Database: ${env.DATABASE_URL.split('@')[1] || 'local'}`);
    fastify.log.info(`⚙️ Provider: ${env.PROVIDER}`);

  } catch (error) {
    fastify.log.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  fastify.log.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  fastify.log.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
start();
