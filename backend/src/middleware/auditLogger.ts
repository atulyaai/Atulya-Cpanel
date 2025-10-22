import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../server.js';
import { AuthenticatedRequest } from './auth.js';
import fp from 'fastify-plugin';

async function auditLoggerPlugin(fastify: FastifyInstance) {
  // Add audit logging hook
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    // Skip audit logging for health checks and static files
    if (request.url === '/health' || request.url.startsWith('/uploads/')) {
      return;
    }

    // Get user info if authenticated
    const authRequest = request as AuthenticatedRequest;
    const userId = authRequest.user?.id;

    // Log the request
    try {
      await prisma.auditLog.create({
        data: {
          userId: userId || 'anonymous',
          action: `${request.method} ${request.url}`,
          resource: request.url,
          resourceId: (request.params as any)?.id,
          details: {
            method: request.method,
            url: request.url,
            query: request.query || null,
            body: request.method !== 'GET' ? request.body || null : null,
          },
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
      });
    } catch (error) {
      fastify.log.error('Failed to create audit log:', error as Error);
      // Don't fail the request if audit logging fails
    }
  });
}

export const auditLogger = fp(auditLoggerPlugin, {
  name: 'auditLogger',
});
