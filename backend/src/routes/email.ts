import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { EmailService } from '../services/EmailService.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';

const createEmailAccountSchema = z.object({
  email: secureEmailRegex(),
  password: z.string().min(8).max(128).optional(),
  quota: z.number().min(100).max(10240).optional(), // 100MB to 10GB
  forwardTo: z.string().email().optional(),
  catchAll: z.boolean().optional(),
  siteId: z.string().optional(),
});

const createEmailDomainSchema = z.object({
  domain: z.string().min(1).max(255),
  siteId: z.string().optional(),
});

function secureEmailRegex() {
  return z.string().min(1).max(255).regex(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'Invalid email format');
}

export async function emailRoutes(fastify: FastifyInstance) {
  const emailService = new EmailService();

  // Test email server connection
  fastify.get('/test-connection', {
    preHandler: [requireAuth, requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const isConnected = await emailService.testConnection();
      return reply.send({
        success: true,
        data: { connected: isConnected },
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to test email server connection',
      });
    }
  });

  // Install email server
  fastify.post('/install', {
    preHandler: [requireAuth, requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await emailService.installEmailServer();
      return reply.send({
        success: true,
        message: 'Email server installed successfully',
      });
    } catch (error) {
      fastify.log.error('Failed to install email server:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to install email server',
      });
    }
  });

  // Get server status
  fastify.get('/status', {
    preHandler: [requireAuth, requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const status = await emailService.getServerStatus();
      return reply.send({
        success: true,
        data: status,
      });
    } catch (error) {
      fastify.log.error('Failed to get email server status:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get email server status',
      });
    }
  });

  // List email domains
  fastify.get('/domains', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authRequest = request as any;
      const domains = await emailService.listDomains(authRequest.user);
      
      return reply.send({
        success: true,
        data: domains,
      });
    } catch (error) {
      fastify.log.error('Failed to list email domains:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to list email domains',
      });
    }
  });

  // Create email domain
  fastify.post('/domains', {
    preHandler: [requireAuth],
    schema: {
      body: createEmailDomainSchema,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authRequest = request as any;
      const data = request.body as z.infer<typeof createEmailDomainSchema>;
      
      const domain = await emailService.createDomain(authRequest.user, data);
      
      return reply.status(201).send({
        success: true,
        data: domain,
        message: 'Email domain created successfully',
      });
    } catch (error) {
      fastify.log.error('Failed to create email domain:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create email domain',
      });
    }
  });

  // Delete email domain
  fastify.delete('/domains/:domain', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authRequest = request as any;
      const { domain } = request.params as { domain: string };
      
      await emailService.deleteDomain(authRequest.user, domain);
      
      return reply.send({
        success: true,
        message: 'Email domain deleted successfully',
      });
    } catch (error) {
      fastify.log.error('Failed to delete email domain:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete email domain',
      });
    }
  });

  // Get all email accounts for user
  fastify.get('/accounts', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authRequest = request as any;
      const accounts = await emailService.getAccounts(authRequest.user);
      
      return reply.send({
        success: true,
        data: accounts,
      });
    } catch (error) {
      fastify.log.error('Failed to get email accounts:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get email accounts',
      });
    }
  });

  // Get all email accounts (admin only)
  fastify.get('/accounts/all', {
    preHandler: [requireAuth, requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const accounts = await emailService.getAllAccounts();
      
      return reply.send({
        success: true,
        data: accounts,
      });
    } catch (error) {
      fastify.log.error('Failed to get all email accounts:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get all email accounts',
      });
    }
  });

  // Get email account by ID
  fastify.get('/accounts/:id', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authRequest = request as any;
      const { id } = request.params as { id: string };
      
      const account = await emailService.getAccount(authRequest.user, id);
      
      if (!account) {
        return reply.status(404).send({
          success: false,
          error: 'Email account not found',
        });
      }

      return reply.send({
        success: true,
        data: account,
      });
    } catch (error) {
      fastify.log.error('Failed to get email account:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get email account',
      });
    }
  });

  // Create email account
  fastify.post('/accounts', {
    preHandler: [requireAuth],
    schema: {
      body: createEmailAccountSchema,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authRequest = request as any;
      const data = request.body as z.infer<typeof createEmailAccountSchema>;
      
      const account = await emailService.createAccount(authRequest.user, data);
      
      return reply.status(201).send({
        success: true,
        data: account,
        message: 'Email account created successfully',
      });
    } catch (error) {
      fastify.log.error('Failed to create email account:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create email account',
      });
    }
  });

  // Update email account
  fastify.put('/accounts/:id', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authRequest = request as any;
      const { id } = request.params as { id: string };
      const updates = request.body as {
        password?: string;
        quota?: number;
        isActive?: boolean;
        forwardTo?: string;
        catchAll?: boolean;
      };
      
      const account = await emailService.updateAccount(authRequest.user, id, updates);
      
      return reply.send({
        success: true,
        data: account,
        message: 'Email account updated successfully',
      });
    } catch (error) {
      fastify.log.error('Failed to update email account:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update email account',
      });
    }
  });

  // Delete email account
  fastify.delete('/accounts/:id', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authRequest = request as any;
      const { id } = request.params as { id: string };
      
      await emailService.deleteAccount(authRequest.user, id);
      
      return reply.send({
        success: true,
        message: 'Email account deleted successfully',
      });
    } catch (error) {
      fastify.log.error('Failed to delete email account:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete email account',
      });
    }
  });

  // Get email quota usage
  fastify.get('/accounts/:id/quota', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authRequest = request as any;
      const { id } = request.params as { id: string };
      
      const quota = await emailService.getQuotaUsage(authRequest.user, id);
      
      return reply.send({
        success: true,
        data: quota,
      });
    } catch (error) {
      fastify.log.error('Failed to get email quota usage:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get email quota usage',
      });
    }
  });

  // Get email statistics
  fastify.get('/statistics', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authRequest = request as any;
      const stats = await emailService.getStatistics(authRequest.user);
      
      return reply.send({
        success: true,
        data: stats,
      });
    } catch (error) {
      fastify.log.error('Failed to get email statistics:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get email statistics',
      });
    }
  });

  // Cleanup on server shutdown
  fastify.addHook('onClose', async () => {
    await emailService.cleanup();
  });
}
