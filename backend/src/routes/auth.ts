import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../server.js';
import { env } from '../config/env.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/auth.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30),
  password: z.string().min(8),
});

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
});

export async function authRoutes(fastify: FastifyInstance) {
  // Login
  fastify.post('/login', {
    schema: {
      body: loginSchema,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    // Rate limiting for login attempts
    const clientId = request.ip || 'unknown';
    const loginAttempts = (fastify as any).loginAttempts || new Map();
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxAttempts = 5;
    
    // Clean up old attempts
    for (const [key, data] of loginAttempts.entries()) {
      if (data.resetTime < now) {
        loginAttempts.delete(key);
      }
    }
    
    const attempts = loginAttempts.get(clientId) || { count: 0, resetTime: now + windowMs };
    
    if (attempts.count >= maxAttempts && attempts.resetTime > now) {
      return reply.status(429).send({
        success: false,
        error: 'Too many login attempts. Please try again later.',
      });
    }
    const { email, password } = request.body as z.infer<typeof loginSchema>;

    try {
      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user || !user.isActive) {
        // Increment failed attempts
        attempts.count++;
        loginAttempts.set(clientId, attempts);
        (fastify as any).loginAttempts = loginAttempts;
        
        return reply.status(401).send({
          success: false,
          error: 'Invalid credentials',
        });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        // Increment failed attempts
        attempts.count++;
        loginAttempts.set(clientId, attempts);
        (fastify as any).loginAttempts = loginAttempts;
        
        return reply.status(401).send({
          success: false,
          error: 'Invalid credentials',
        });
      }
      
      // Reset attempts on successful login
      loginAttempts.delete(clientId);
      (fastify as any).loginAttempts = loginAttempts;

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      });

      // Generate tokens
      const accessToken = fastify.jwt.sign(
        { userId: user.id },
        { expiresIn: env.JWT_EXPIRES_IN }
      );

      const refreshToken = fastify.jwt.sign(
        { userId: user.id, type: 'refresh' },
        { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
      );

      // Store refresh token in database
      await prisma.session.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      });

      const { password: _, ...userWithoutPassword } = user;

      return reply.send({
        success: true,
        data: {
          user: userWithoutPassword,
          accessToken,
          refreshToken,
        },
      });
    } catch (error) {
      fastify.log.error('Login error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Login failed',
      });
    }
  });

  // Register
  fastify.post('/register', {
    schema: {
      body: registerSchema,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, username, password } = request.body as z.infer<typeof registerSchema>;

    try {
      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email },
            { username },
          ],
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
          role: 'USER', // Default role
        },
      });

      const { password: _, ...userWithoutPassword } = user;

      return reply.status(201).send({
        success: true,
        data: {
          user: userWithoutPassword,
          message: 'User created successfully',
        },
      });
    } catch (error) {
      fastify.log.error('Registration error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Registration failed',
      });
    }
  });

  // Refresh token
  fastify.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const { refreshToken } = request.body as { refreshToken: string };

    try {
      // Verify refresh token
      const decoded = fastify.jwt.verify(refreshToken) as { userId: string; type: string };

      if (decoded.type !== 'refresh') {
        return reply.status(401).send({
          success: false,
          error: 'Invalid refresh token',
        });
      }

      // Check if session exists and is valid
      const session = await prisma.session.findUnique({
        where: { token: refreshToken },
        include: { user: true },
      });

      if (!session || session.expiresAt < new Date() || !session.user.isActive) {
        return reply.status(401).send({
          success: false,
          error: 'Invalid or expired refresh token',
        });
      }

      // Generate new access token
      const accessToken = fastify.jwt.sign(
        { userId: session.user.id },
        { expiresIn: env.JWT_EXPIRES_IN }
      );

      const { password: _, ...userWithoutPassword } = session.user;

      return reply.send({
        success: true,
        data: {
          user: userWithoutPassword,
          accessToken,
        },
      });
    } catch (error) {
      return reply.status(401).send({
        success: false,
        error: 'Invalid refresh token',
      });
    }
  });

  // Logout
  fastify.post('/logout', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const authRequest = request as AuthenticatedRequest;
    const { refreshToken } = request.body as { refreshToken?: string };

    try {
      // Delete refresh token if provided
      if (refreshToken) {
        await prisma.session.deleteMany({
          where: {
            token: refreshToken,
            userId: authRequest.user.id,
          },
        });
      }

      return reply.send({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      fastify.log.error('Logout error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Logout failed',
      });
    }
  });

  // Get current user
  fastify.get('/me', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const authRequest = request as AuthenticatedRequest;
    const { password: _, ...userWithoutPassword } = authRequest.user;

    return reply.send({
      success: true,
      data: { user: userWithoutPassword },
    });
  });

  // Change password
  fastify.put('/change-password', {
    preHandler: [requireAuth],
    schema: {
      body: changePasswordSchema,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const authRequest = request as AuthenticatedRequest;
    const { currentPassword, newPassword } = request.body as z.infer<typeof changePasswordSchema>;

    try {
      // Get user with password from database
      const userWithPassword = await prisma.user.findUnique({
        where: { id: authRequest.user.id },
        select: { password: true }
      });

      if (!userWithPassword) {
        return reply.status(404).send({
          success: false,
          error: 'User not found',
        });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, userWithPassword.password);
      if (!isValidPassword) {
        return reply.status(400).send({
          success: false,
          error: 'Current password is incorrect',
        });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);

      // Update password
      await prisma.user.update({
        where: { id: authRequest.user.id },
        data: { password: hashedPassword },
      });

      return reply.send({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      fastify.log.error('Change password error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to change password',
      });
    }
  });

  // Logout from all devices
  fastify.post('/logout-all', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const authRequest = request as AuthenticatedRequest;

    try {
      // Delete all sessions for user
      await prisma.session.deleteMany({
        where: { userId: authRequest.user.id },
      });

      return reply.send({
        success: true,
        message: 'Logged out from all devices',
      });
    } catch (error) {
      fastify.log.error('Logout all error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to logout from all devices',
      });
    }
  });
}
