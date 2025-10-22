import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../server.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOwnership } from '../middleware/rbac.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import cron from 'node-cron';

const createCronJobSchema = z.object({
  schedule: z.string().min(1),
  command: z.string().min(1),
  siteId: z.string().optional(),
});

const updateCronJobSchema = z.object({
  schedule: z.string().min(1).optional(),
  command: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

export async function cronRoutes(fastify: FastifyInstance) {
  // Get all cron jobs for user
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
        userId: authRequest.user.id,
        ...(siteId ? { siteId } : {}),
      };

      const [cronJobs, total] = await Promise.all([
        prisma.cronJob.findMany({
          where,
          include: {
            site: {
              select: {
                id: true,
                domain: true,
              },
            },
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.cronJob.count({ where }),
      ]);

      return reply.send({
        success: true,
        data: cronJobs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      fastify.log.error('Failed to get cron jobs:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get cron jobs',
      });
    }
  });

  // Get single cron job
  fastify.get('/:id', {
    preHandler: [requireAuth, requireOwnership('userId')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    
    try {
      const cronJob = await prisma.cronJob.findUnique({
        where: { id },
        include: {
          site: {
            select: {
              id: true,
              domain: true,
            },
          },
        },
      });

      if (!cronJob) {
        return reply.status(404).send({
          success: false,
          error: 'Cron job not found',
        });
      }

      return reply.send({
        success: true,
        data: cronJob,
      });
    } catch (error) {
      fastify.log.error('Failed to get cron job:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get cron job',
      });
    }
  });

  // Create cron job
  fastify.post('/', {
    preHandler: [requireAuth],
    schema: {
      body: createCronJobSchema,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const authRequest = request as AuthenticatedRequest;
    const { schedule, command, siteId } = request.body as z.infer<typeof createCronJobSchema>;
    
    try {
      // Validate cron schedule
      if (!cron.validate(schedule)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid cron schedule format',
        });
      }

      // Check if site exists and belongs to user (if provided)
      if (siteId) {
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
      }

      // Calculate next run time
      const nextRun = cron.getNextRun(schedule);

      const cronJob = await prisma.cronJob.create({
        data: {
          schedule,
          command,
          isActive: true,
          nextRun,
          userId: authRequest.user.id,
          siteId,
        },
        include: {
          site: {
            select: {
              id: true,
              domain: true,
            },
          },
        },
      });

      return reply.status(201).send({
        success: true,
        data: cronJob,
        message: 'Cron job created successfully',
      });
    } catch (error) {
      fastify.log.error('Failed to create cron job:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to create cron job',
      });
    }
  });

  // Update cron job
  fastify.put('/:id', {
    preHandler: [requireAuth, requireOwnership('userId')],
    schema: {
      body: updateCronJobSchema,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const updateData = request.body as z.infer<typeof updateCronJobSchema>;
    
    try {
      // Validate cron schedule if provided
      if (updateData.schedule && !cron.validate(updateData.schedule)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid cron schedule format',
        });
      }

      // Calculate next run time if schedule is updated
      const updateFields: any = { ...updateData };
      if (updateData.schedule) {
        updateFields.nextRun = cron.getNextRun(updateData.schedule);
      }

      const cronJob = await prisma.cronJob.update({
        where: { id },
        data: updateFields,
        include: {
          site: {
            select: {
              id: true,
              domain: true,
            },
          },
        },
      });

      return reply.send({
        success: true,
        data: cronJob,
        message: 'Cron job updated successfully',
      });
    } catch (error) {
      fastify.log.error('Failed to update cron job:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to update cron job',
      });
    }
  });

  // Delete cron job
  fastify.delete('/:id', {
    preHandler: [requireAuth, requireOwnership('userId')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    
    try {
      await prisma.cronJob.delete({
        where: { id },
      });

      return reply.send({
        success: true,
        message: 'Cron job deleted successfully',
      });
    } catch (error) {
      fastify.log.error('Failed to delete cron job:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to delete cron job',
      });
    }
  });

  // Execute cron job manually
  fastify.post('/:id/execute', {
    preHandler: [requireAuth, requireOwnership('userId')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    
    try {
      const cronJob = await prisma.cronJob.findUnique({
        where: { id },
      });

      if (!cronJob) {
        return reply.status(404).send({
          success: false,
          error: 'Cron job not found',
        });
      }

      // Update last run time
      await prisma.cronJob.update({
        where: { id },
        data: {
          lastRun: new Date(),
          nextRun: cron.getNextRun(cronJob.schedule),
        },
      });

      // In a real implementation, this would execute the command
      // For now, we'll just simulate execution
      fastify.log.info(`Executing cron job: ${cronJob.command}`);

      return reply.send({
        success: true,
        message: 'Cron job executed successfully',
      });
    } catch (error) {
      fastify.log.error('Failed to execute cron job:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to execute cron job',
      });
    }
  });

  // Get cron job statistics
  fastify.get('/stats/overview', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const authRequest = request as AuthenticatedRequest;
    
    try {
      const [totalJobs, activeJobs, inactiveJobs] = await Promise.all([
        prisma.cronJob.count({
          where: { userId: authRequest.user.id },
        }),
        prisma.cronJob.count({
          where: { 
            userId: authRequest.user.id,
            isActive: true,
          },
        }),
        prisma.cronJob.count({
          where: { 
            userId: authRequest.user.id,
            isActive: false,
          },
        }),
      ]);

      return reply.send({
        success: true,
        data: {
          totalJobs,
          activeJobs,
          inactiveJobs,
        },
      });
    } catch (error) {
      fastify.log.error('Failed to get cron job statistics:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get cron job statistics',
      });
    }
  });
}
