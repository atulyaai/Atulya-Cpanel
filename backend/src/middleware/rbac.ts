import { FastifyRequest, FastifyReply } from 'fastify';
import { UserRole } from '@prisma/client';
import { AuthenticatedRequest } from './auth.js';

export function requireRole(allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const authRequest = request as AuthenticatedRequest;
    
    if (!authRequest.user) {
      return reply.status(401).send({
        success: false,
        error: 'Authentication required',
      });
    }

    if (!allowedRoles.includes(authRequest.user.role)) {
      return reply.status(403).send({
        success: false,
        error: 'Insufficient permissions',
      });
    }
  };
}

export function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  return requireRole([UserRole.ADMIN])(request, reply);
}

export function requireAdminOrReseller(request: FastifyRequest, reply: FastifyReply) {
  return requireRole([UserRole.ADMIN, UserRole.RESELLER])(request, reply);
}

export function requireAnyUser(request: FastifyRequest, reply: FastifyReply) {
  return requireRole([UserRole.ADMIN, UserRole.RESELLER, UserRole.USER])(request, reply);
}

// Resource ownership check
export function requireOwnership(resourceUserIdField: string = 'userId') {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const authRequest = request as AuthenticatedRequest;
    
    if (!authRequest.user) {
      return reply.status(401).send({
        success: false,
        error: 'Authentication required',
      });
    }

    // Admins can access all resources
    if (authRequest.user.role === UserRole.ADMIN) {
      return;
    }

    // Check if user owns the resource
    const resourceUserId = (request.params as any)[resourceUserIdField];
    
    if (authRequest.user.id !== resourceUserId) {
      return reply.status(403).send({
        success: false,
        error: 'Access denied: Resource not owned by user',
      });
    }
  };
}
