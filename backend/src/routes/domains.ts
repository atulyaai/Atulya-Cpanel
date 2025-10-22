import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../server.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOwnership } from '../middleware/rbac.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const createDomainSchema = z.object({
  name: z.string().min(1).max(253),
  type: z.enum(['PRIMARY', 'SUBDOMAIN', 'ADDON']).default('SUBDOMAIN'),
  siteId: z.string(),
});

const updateDomainSchema = z.object({
  name: z.string().min(1).max(253).optional(),
  type: z.enum(['PRIMARY', 'SUBDOMAIN', 'ADDON']).optional(),
  isActive: z.boolean().optional(),
});

export async function domainRoutes(fastify: FastifyInstance) {
  // Get all domains for user
  fastify.get('/', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const authRequest = request as AuthenticatedRequest;
    
    try {
      const { page = 1, limit = 10, siteId } = request.query as {
        page?: number;
        limit?: number;
        siteId?: string;
      };

      const skip = (page - 1) * limit;
      
      const where = {
        site: {
          userId: authRequest.user.id,
        },
        ...(siteId ? { siteId } : {}),
      };

      const [domains, total] = await Promise.all([
        prisma.domain.findMany({
          where,
          include: {
            site: {
              select: {
                id: true,
                domain: true,
                sslEnabled: true,
              },
            },
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.domain.count({ where }),
      ]);

      return reply.send({
        success: true,
        data: domains,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      fastify.log.error('Failed to get domains:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get domains',
      });
    }
  });

  // Get single domain
  fastify.get('/:id', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    
    try {
      const domain = await prisma.domain.findFirst({
        where: {
          id,
          site: {
            userId: (request as AuthenticatedRequest).user.id,
          },
        },
        include: {
          site: {
            select: {
              id: true,
              domain: true,
              sslEnabled: true,
            },
          },
        },
      });

      if (!domain) {
        return reply.status(404).send({
          success: false,
          error: 'Domain not found',
        });
      }

      return reply.send({
        success: true,
        data: domain,
      });
    } catch (error) {
      fastify.log.error('Failed to get domain:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get domain',
      });
    }
  });

  // Create domain
  fastify.post('/', {
    preHandler: [requireAuth],
    schema: {
      body: createDomainSchema,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const authRequest = request as AuthenticatedRequest;
    const { name, type, siteId } = request.body as z.infer<typeof createDomainSchema>;
    
    try {
      // Check if site exists and belongs to user
      const site = await prisma.site.findFirst({
        where: {
          id: siteId,
          userId: authRequest.user.id,
        },
      });

      if (!site) {
        return reply.status(404).send({
          success: false,
          error: 'Site not found',
        });
      }

      // Check if domain already exists
      const existingDomain = await prisma.domain.findUnique({
        where: { name },
      });

      if (existingDomain) {
        return reply.status(409).send({
          success: false,
          error: 'Domain already exists',
        });
      }

      const domain = await prisma.domain.create({
        data: {
          name,
          type,
          siteId,
        },
        include: {
          site: {
            select: {
              id: true,
              domain: true,
              sslEnabled: true,
            },
          },
        },
      });

      return reply.status(201).send({
        success: true,
        data: domain,
        message: 'Domain created successfully',
      });
    } catch (error) {
      fastify.log.error('Failed to create domain:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to create domain',
      });
    }
  });

  // Update domain
  fastify.put('/:id', {
    preHandler: [requireAuth],
    schema: {
      body: updateDomainSchema,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const updateData = request.body as z.infer<typeof updateDomainSchema>;
    
    try {
      // Check if domain exists and belongs to user
      const existingDomain = await prisma.domain.findFirst({
        where: {
          id,
          site: {
            userId: (request as AuthenticatedRequest).user.id,
          },
        },
      });

      if (!existingDomain) {
        return reply.status(404).send({
          success: false,
          error: 'Domain not found',
        });
      }

      // Check for name conflicts if name is being updated
      if (updateData.name && updateData.name !== existingDomain.name) {
        const conflictDomain = await prisma.domain.findUnique({
          where: { name: updateData.name },
        });

        if (conflictDomain) {
          return reply.status(409).send({
            success: false,
            error: 'Domain name already exists',
          });
        }
      }

      const domain = await prisma.domain.update({
        where: { id },
        data: updateData,
        include: {
          site: {
            select: {
              id: true,
              domain: true,
              sslEnabled: true,
            },
          },
        },
      });

      return reply.send({
        success: true,
        data: domain,
        message: 'Domain updated successfully',
      });
    } catch (error) {
      fastify.log.error('Failed to update domain:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to update domain',
      });
    }
  });

  // Delete domain
  fastify.delete('/:id', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    
    try {
      // Check if domain exists and belongs to user
      const existingDomain = await prisma.domain.findFirst({
        where: {
          id,
          site: {
            userId: (request as AuthenticatedRequest).user.id,
          },
        },
      });

      if (!existingDomain) {
        return reply.status(404).send({
          success: false,
          error: 'Domain not found',
        });
      }

      await prisma.domain.delete({
        where: { id },
      });

      return reply.send({
        success: true,
        message: 'Domain deleted successfully',
      });
    } catch (error) {
      fastify.log.error('Failed to delete domain:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to delete domain',
      });
    }
  });

  // Check domain availability
  fastify.get('/check/:name', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { name } = request.params as { name: string };
    
    try {
      const existingDomain = await prisma.domain.findUnique({
        where: { name },
      });

      return reply.send({
        success: true,
        data: {
          available: !existingDomain,
          domain: name,
        },
      });
    } catch (error) {
      fastify.log.error('Failed to check domain availability:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to check domain availability',
      });
    }
  });

  // Get domain statistics
  fastify.get('/stats/overview', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const authRequest = request as AuthenticatedRequest;
    
    try {
      const [totalDomains, activeDomains, primaryDomains, subdomains, addonDomains] = await Promise.all([
        prisma.domain.count({
          where: {
            site: {
              userId: authRequest.user.id,
            },
          },
        }),
        prisma.domain.count({
          where: {
            site: {
              userId: authRequest.user.id,
            },
            isActive: true,
          },
        }),
        prisma.domain.count({
          where: {
            site: {
              userId: authRequest.user.id,
            },
            type: 'PRIMARY',
          },
        }),
        prisma.domain.count({
          where: {
            site: {
              userId: authRequest.user.id,
            },
            type: 'SUBDOMAIN',
          },
        }),
        prisma.domain.count({
          where: {
            site: {
              userId: authRequest.user.id,
            },
            type: 'ADDON',
          },
        }),
      ]);

      return reply.send({
        success: true,
        data: {
          totalDomains,
          activeDomains,
          inactiveDomains: totalDomains - activeDomains,
          primaryDomains,
          subdomains,
          addonDomains,
        },
      });
    } catch (error) {
      fastify.log.error('Failed to get domain statistics:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get domain statistics',
      });
    }
  });
}
