import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { SSLProvider } from '../providers/SSLProvider.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { env } from '../config/env.js';

const issueSSLSchema = z.object({
  domain: z.string().min(1),
  email: z.string().email().optional(),
  staging: z.boolean().optional(),
  forceRenewal: z.boolean().optional(),
  webroot: z.string().optional(),
});

const wildcardSSLSchema = z.object({
  domain: z.string().min(1),
  email: z.string().email().optional(),
  staging: z.boolean().optional(),
  dnsProvider: z.string().min(1),
  dnsCredentials: z.record(z.string()).optional(),
});

export async function sslRoutes(fastify: FastifyInstance) {
  const sslProvider = new SSLProvider();

  // Check if Certbot is installed
  fastify.get('/status', {
    preHandler: [requireAuth, requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const isInstalled = await sslProvider.isCertbotInstalled();
      return reply.send({
        success: true,
        data: {
          installed: isInstalled,
          staging: env.SSL_STAGING,
        },
      });
    } catch (error) {
      fastify.log.error('Failed to check SSL status:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to check SSL status',
      });
    }
  });

  // Install Certbot
  fastify.post('/install', {
    preHandler: [requireAuth, requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await sslProvider.installCertbot();
      return reply.send({
        success: true,
        message: 'Certbot installed successfully',
      });
    } catch (error) {
      fastify.log.error('Failed to install Certbot:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to install Certbot',
      });
    }
  });

  // List all SSL certificates
  fastify.get('/certificates', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const certificates = await sslProvider.listCertificates();
      return reply.send({
        success: true,
        data: certificates,
      });
    } catch (error) {
      fastify.log.error('Failed to list certificates:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to list certificates',
      });
    }
  });

  // Get certificate information
  fastify.get('/certificates/:domain', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { domain } = request.params as { domain: string };
      const certificate = await sslProvider.getCertificateInfo(domain);
      
      return reply.send({
        success: true,
        data: certificate,
      });
    } catch (error) {
      fastify.log.error('Failed to get certificate info:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get certificate info',
      });
    }
  });

  // Issue SSL certificate
  fastify.post('/issue', {
    preHandler: [requireAuth],
    schema: {
      body: issueSSLSchema,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = request.body as z.infer<typeof issueSSLSchema>;
      const certificate = await sslProvider.issueCertificate(data);
      
      return reply.send({
        success: true,
        data: certificate,
        message: 'SSL certificate issued successfully',
      });
    } catch (error) {
      fastify.log.error('Failed to issue SSL certificate:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to issue SSL certificate',
      });
    }
  });

  // Issue wildcard certificate
  fastify.post('/issue-wildcard', {
    preHandler: [requireAuth],
    schema: {
      body: wildcardSSLSchema,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = request.body as z.infer<typeof wildcardSSLSchema>;
      const certificate = await sslProvider.issueWildcardCertificate(data);
      
      return reply.send({
        success: true,
        data: certificate,
        message: 'Wildcard SSL certificate issued successfully',
      });
    } catch (error) {
      fastify.log.error('Failed to issue wildcard certificate:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to issue wildcard certificate',
      });
    }
  });

  // Renew certificate
  fastify.post('/renew/:domain', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { domain } = request.params as { domain: string };
      const certificates = await sslProvider.renewCertificate(domain);
      
      return reply.send({
        success: true,
        data: certificates,
        message: 'SSL certificate renewed successfully',
      });
    } catch (error) {
      fastify.log.error('Failed to renew certificate:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to renew certificate',
      });
    }
  });

  // Renew all certificates
  fastify.post('/renew-all', {
    preHandler: [requireAuth, requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const certificates = await sslProvider.renewCertificate();
      
      return reply.send({
        success: true,
        data: certificates,
        message: 'All SSL certificates renewed successfully',
      });
    } catch (error) {
      fastify.log.error('Failed to renew all certificates:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to renew all certificates',
      });
    }
  });

  // Revoke certificate
  fastify.delete('/certificates/:domain', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { domain } = request.params as { domain: string };
      await sslProvider.revokeCertificate(domain);
      
      return reply.send({
        success: true,
        message: 'SSL certificate revoked successfully',
      });
    } catch (error) {
      fastify.log.error('Failed to revoke certificate:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to revoke certificate',
      });
    }
  });

  // Test certificate
  fastify.get('/test/:domain', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { domain } = request.params as { domain: string };
      const testResult = await sslProvider.testCertificate(domain);
      
      return reply.send({
        success: true,
        data: testResult,
      });
    } catch (error) {
      fastify.log.error('Failed to test certificate:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to test certificate',
      });
    }
  });

  // Check certificate expiry
  fastify.get('/expiry-check', {
    preHandler: [requireAuth, requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { days } = request.query as { days?: string };
      const daysThreshold = days ? parseInt(days) : 30;
      
      const expiringCertificates = await sslProvider.checkExpiry(daysThreshold);
      
      return reply.send({
        success: true,
        data: expiringCertificates,
      });
    } catch (error) {
      fastify.log.error('Failed to check certificate expiry:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to check certificate expiry',
      });
    }
  });

  // Setup auto-renewal
  fastify.post('/setup-auto-renewal', {
    preHandler: [requireAuth, requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await sslProvider.setupAutoRenewal();
      
      return reply.send({
        success: true,
        message: 'Auto-renewal setup completed successfully',
      });
    } catch (error) {
      fastify.log.error('Failed to setup auto-renewal:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to setup auto-renewal',
      });
    }
  });

  // Configure Nginx SSL
  fastify.post('/configure-nginx/:domain', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { domain } = request.params as { domain: string };
      await sslProvider.configureNginxSSL(domain);
      
      return reply.send({
        success: true,
        message: 'Nginx SSL configuration updated successfully',
      });
    } catch (error) {
      fastify.log.error('Failed to configure Nginx SSL:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to configure Nginx SSL',
      });
    }
  });

  // Get SSL statistics
  fastify.get('/statistics', {
    preHandler: [requireAuth, requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const statistics = await sslProvider.getSSLStatistics();
      
      return reply.send({
        success: true,
        data: statistics,
      });
    } catch (error) {
      fastify.log.error('Failed to get SSL statistics:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get SSL statistics',
      });
    }
  });
}
