import { FastifyRequest, FastifyReply } from 'fastify';
import { JWT } from '@fastify/jwt';
import { prisma } from '../server.js';
import { User } from '@prisma/client';

declare module 'fastify' {
  interface FastifyRequest {
    jwt: JWT;
    user: User;
  }
}

export interface AuthenticatedRequest extends FastifyRequest {
  user: User;
}

export async function authenticateUser(request: FastifyRequest, reply: FastifyReply) {
  try {
    const token = request.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return reply.status(401).send({
        success: false,
        error: 'Authentication required',
      });
    }

    // Verify token and check expiration
    const decoded = request.jwt.verify(token) as { 
      userId: string; 
      exp: number; 
      iat: number; 
    };
    
    // Check token expiration
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < now) {
      return reply.status(401).send({
        success: false,
        error: 'Token expired',
      });
    }
    
    // Only load essential user data, not sensitive relations
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true,
      },
    });

    if (!user || !user.isActive) {
      return reply.status(401).send({
        success: false,
        error: 'Authentication failed',
      });
    }

    request.user = user as User;
  } catch (error) {
    // Log the actual error for debugging but don't expose it
    console.error('Authentication error:', error);
    return reply.status(401).send({
      success: false,
      error: 'Authentication failed',
    });
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  return authenticateUser(request, reply);
}

export async function optionalAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    await authenticateUser(request, reply);
  } catch (error) {
    // Continue without authentication for optional auth
  }
}
