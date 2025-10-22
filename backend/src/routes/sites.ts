import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../server.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOwnership } from '../middleware/rbac.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const createSiteSchema = z.object({
  domain: z.string().min(1).max(253),
  documentRoot: z.string().default('public_html'),
  phpVersion: z.string().default('8.2'),
});

const updateSiteSchema = z.object({
  documentRoot: z.string().optional(),
  phpVersion: z.string().optional(),
  sslEnabled: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function siteRoutes(fastify: FastifyInstance) {
  // Get all sites for authenticated user
  fastify.get('/', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const authRequest = request as AuthenticatedRequest;
    
    try {
      const sites = await prisma.site.findMany({
        where: {
          userId: authRequest.user.id,
        },
        include: {
          domains: true,
          databases: true,
          emailAccounts: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return reply.send({
        success: true,
        data: sites,
      });
    } catch (error) {
      fastify.log.error('Failed to get sites:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get sites',
      });
    }
  });

  // Get single site
  fastify.get('/:id', {
    preHandler: [requireAuth, requireOwnership('userId')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    
    try {
      const site = await prisma.site.findUnique({
        where: { id },
        include: {
          domains: true,
          databases: true,
          emailAccounts: true,
          user: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      });

      if (!site) {
        return reply.status(404).send({
          success: false,
          error: 'Site not found',
        });
      }

      return reply.send({
        success: true,
        data: site,
      });
    } catch (error) {
      fastify.log.error('Failed to get site:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get site',
      });
    }
  });

  // Create new site
  fastify.post('/', {
    preHandler: [requireAuth],
    schema: {
      body: createSiteSchema,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const authRequest = request as AuthenticatedRequest;
    const { domain, documentRoot, phpVersion } = request.body as z.infer<typeof createSiteSchema>;
    
    try {
      // Check if domain already exists
      const existingSite = await prisma.site.findUnique({
        where: { domain },
      });

      if (existingSite) {
        return reply.status(409).send({
          success: false,
          error: 'Domain already exists',
        });
      }

      const site = await prisma.site.create({
        data: {
          domain,
          documentRoot,
          phpVersion,
          userId: authRequest.user.id,
        },
        include: {
          domains: true,
          databases: true,
          emailAccounts: true,
        },
      });

      return reply.status(201).send({
        success: true,
        data: site,
        message: 'Site created successfully',
      });
    } catch (error) {
      fastify.log.error('Failed to create site:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to create site',
      });
    }
  });

  // Update site
  fastify.put('/:id', {
    preHandler: [requireAuth, requireOwnership('userId')],
    schema: {
      body: updateSiteSchema,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const updateData = request.body as z.infer<typeof updateSiteSchema>;
    
    try {
      const site = await prisma.site.update({
        where: { id },
        data: updateData,
        include: {
          domains: true,
          databases: true,
          emailAccounts: true,
        },
      });

      return reply.send({
        success: true,
        data: site,
        message: 'Site updated successfully',
      });
    } catch (error) {
      fastify.log.error('Failed to update site:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to update site',
      });
    }
  });

  // Delete site
  fastify.delete('/:id', {
    preHandler: [requireAuth, requireOwnership('userId')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    
    try {
      await prisma.site.delete({
        where: { id },
      });

      return reply.send({
        success: true,
        message: 'Site deleted successfully',
      });
    } catch (error) {
      fastify.log.error('Failed to delete site:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to delete site',
      });
    }
  });
}
