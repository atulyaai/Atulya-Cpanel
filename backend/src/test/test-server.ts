import Fastify from 'fastify';
import { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import staticFiles from '@fastify/static';
import websocket from '@fastify/websocket';
import { env } from '../config/env.js';
import { errorHandler } from '../utils/errorHandler.js';
import { auditLogger } from '../middleware/auditLogger.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { securityMiddleware } from '../middleware/security.js';
import { authRoutes } from '../routes/auth.js';
import { siteRoutes } from '../routes/sites.js';
import { databaseRoutes } from '../routes/databases.js';
import { emailRoutes } from '../routes/email.js';
import { domainRoutes } from '../routes/domains.js';
import { backupRoutes } from '../routes/backups.js';
import { cronRoutes } from '../routes/cron.js';
import { fileRoutes } from '../routes/files.js';
import { sslRoutes } from '../routes/ssl.js';
import { userRoutes } from '../routes/users.js';
import { metricsRoutes } from '../routes/metrics.js';
import { monitoringRoutes } from '../routes/monitoring.js';
import { serviceRoutes } from '../routes/services.js';
import path from 'path';

export async function build(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: false, // Disable logging in tests
    trustProxy: true,
  });

  // Register plugins
  await fastify.register(cors, {
    origin: [env.FRONTEND_URL],
    credentials: true,
  });

  await fastify.register(jwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: env.JWT_EXPIRES_IN,
    },
    verify: {
      maxAge: env.JWT_EXPIRES_IN,
    },
  });

  await fastify.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024,
    },
  });

  await fastify.register(staticFiles, {
    root: path.join(process.cwd(), 'uploads'),
    prefix: '/uploads/',
  });

  await fastify.register(websocket);

  // Register middleware
  fastify.setErrorHandler(errorHandler);
  await fastify.register(securityMiddleware);
  await fastify.register(auditLogger);

  // Register routes
  fastify.get('/health', async (request, reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

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

  return fastify;
}