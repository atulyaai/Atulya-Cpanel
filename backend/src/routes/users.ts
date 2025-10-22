import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../server.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin, requireAdminOrReseller } from '../middleware/rbac.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

const createUserSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30),
  password: z.string().min(8),
  role: z.enum(['ADMIN', 'RESELLER', 'USER']).default('USER'),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  username: z.string().min(3).max(30).optional(),
  role: z.enum(['ADMIN', 'RESELLER', 'USER']).optional(),
  isActive: z.boolean().optional(),
});

const changePasswordSchema = z.object({
  newPassword: z.string().min(8),
});

export async function userRoutes(fastify: FastifyInstance) {
  // Get all users (admin only)
  fastify.get('/', {
    preHandler: [requireAuth, requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { page = 1, limit = 10, search = '' } = request.query as {
        page?: number;
        limit?: number;
        search?: string;
      };

      const skip = (page - 1) * limit;
      
      const where = search ? {
        OR: [
          { email: { contains: search, mode: 'insensitive' as const } },
          { username: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {};

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            username: true,
            role: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            lastLogin: true,
            _count: {
              select: {
                sites: true,
                databases: true,
                emailAccounts: true,
              },
            },
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.user.count({ where }),
      ]);

      return reply.send({
        success: true,
        data: users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      fastify.log.error('Failed to get users:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get users',
      });
    }
  });

  // Get single user
  fastify.get('/:id', {
    preHandler: [requireAuth, requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          lastLogin: true,
          sites: {
            select: {
              id: true,
              domain: true,
              isActive: true,
              createdAt: true,
            },
          },
          databases: {
            select: {
              id: true,
              name: true,
              isActive: true,
              createdAt: true,
            },
          },
          emailAccounts: {
            select: {
              id: true,
              email: true,
              isActive: true,
              createdAt: true,
            },
          },
        },
      });

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: 'User not found',
        });
      }

      return reply.send({
        success: true,
        data: user,
      });
    } catch (error) {
      fastify.log.error('Failed to get user:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get user',
      });
    }
  });

  // Create user
  fastify.post('/', {
    preHandler: [requireAuth, requireAdmin],
    schema: {
      body: createUserSchema,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, username, password, role } = request.body as z.infer<typeof createUserSchema>;
    
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [{ email }, { username }],
        },
      });

      if (existingUser) {
        return reply.status(409).send({
          success: false,
          error: 'User already exists',
          details: existingUser.email === email ? 'Email already registered' : 'Username already taken',
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, env.BCRYPT_ROUNDS);

      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          username,
          password: hashedPassword,
          role,
        },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return reply.status(201).send({
        success: true,
        data: user,
        message: 'User created successfully',
      });
    } catch (error) {
      fastify.log.error('Failed to create user:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to create user',
      });
    }
  });

  // Update user
  fastify.put('/:id', {
    preHandler: [requireAuth, requireAdmin],
    schema: {
      body: updateUserSchema,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const updateData = request.body as z.infer<typeof updateUserSchema>;
    
    try {
      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id },
      });

      if (!existingUser) {
        return reply.status(404).send({
          success: false,
          error: 'User not found',
        });
      }

      // Check for email/username conflicts
      if (updateData.email || updateData.username) {
        const conflictUser = await prisma.user.findFirst({
          where: {
            AND: [
              { id: { not: id } },
            ],
            OR: [
              ...(updateData.email ? [{ email: updateData.email }] : []),
              ...(updateData.username ? [{ username: updateData.username }] : []),
            ],
          },
        });

        if (conflictUser) {
          return reply.status(409).send({
            success: false,
            error: 'Email or username already exists',
          });
        }
      }

      const user = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return reply.send({
        success: true,
        data: user,
        message: 'User updated successfully',
      });
    } catch (error) {
      fastify.log.error('Failed to update user:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to update user',
      });
    }
  });

  // Delete user
  fastify.delete('/:id', {
    preHandler: [requireAuth, requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    
    try {
      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id },
      });

      if (!existingUser) {
        return reply.status(404).send({
          success: false,
          error: 'User not found',
        });
      }

      // Prevent deletion of admin users
      if (existingUser.role === 'ADMIN') {
        return reply.status(403).send({
          success: false,
          error: 'Cannot delete admin users',
        });
      }

      await prisma.user.delete({
        where: { id },
      });

      return reply.send({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error) {
      fastify.log.error('Failed to delete user:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to delete user',
      });
    }
  });

  // Change user password
  fastify.put('/:id/password', {
    preHandler: [requireAuth, requireAdmin],
    schema: {
      body: changePasswordSchema,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { newPassword } = request.body as z.infer<typeof changePasswordSchema>;
    
    try {
      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id },
      });

      if (!existingUser) {
        return reply.status(404).send({
          success: false,
          error: 'User not found',
        });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);

      await prisma.user.update({
        where: { id },
        data: { password: hashedPassword },
      });

      return reply.send({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      fastify.log.error('Failed to change password:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to change password',
      });
    }
  });

  // Get user statistics
  fastify.get('/stats/overview', {
    preHandler: [requireAuth, requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const [totalUsers, activeUsers, adminUsers, resellerUsers, regularUsers] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.user.count({ where: { role: 'ADMIN' } }),
        prisma.user.count({ where: { role: 'RESELLER' } }),
        prisma.user.count({ where: { role: 'USER' } }),
      ]);

      return reply.send({
        success: true,
        data: {
          totalUsers,
          activeUsers,
          inactiveUsers: totalUsers - activeUsers,
          adminUsers,
          resellerUsers,
          regularUsers,
        },
      });
    } catch (error) {
      fastify.log.error('Failed to get user statistics:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get user statistics',
      });
    }
  });
}
