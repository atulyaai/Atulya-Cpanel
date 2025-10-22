import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../server.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOwnership } from '../middleware/rbac.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import fs from 'fs-extra';
import path from 'path';
import { env } from '../config/env.js';

const createBackupSchema = z.object({
  siteId: z.string(),
  type: z.enum(['FULL', 'INCREMENTAL', 'DATABASE']).default('FULL'),
  includeFiles: z.boolean().default(true),
  includeDatabase: z.boolean().default(true),
  includeEmail: z.boolean().default(false),
});

const restoreBackupSchema = z.object({
  backupId: z.string(),
  restoreTo: z.string().optional(),
});

export async function backupRoutes(fastify: FastifyInstance) {
  // Get all backups for user
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

      const [backups, total] = await Promise.all([
        prisma.backup.findMany({
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
        prisma.backup.count({ where }),
      ]);

      return reply.send({
        success: true,
        data: backups,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      fastify.log.error('Failed to get backups:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get backups',
      });
    }
  });

  // Get single backup
  fastify.get('/:id', {
    preHandler: [requireAuth, requireOwnership('userId')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    
    try {
      const backup = await prisma.backup.findUnique({
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

      if (!backup) {
        return reply.status(404).send({
          success: false,
          error: 'Backup not found',
        });
      }

      return reply.send({
        success: true,
        data: backup,
      });
    } catch (error) {
      fastify.log.error('Failed to get backup:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get backup',
      });
    }
  });

  // Create backup
  fastify.post('/', {
    preHandler: [requireAuth],
    schema: {
      body: createBackupSchema,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const authRequest = request as AuthenticatedRequest;
    const { siteId, type, includeFiles, includeDatabase, includeEmail } = request.body as z.infer<typeof createBackupSchema>;
    
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

      // Create backup record
      const backup = await prisma.backup.create({
        data: {
          type,
          status: 'PENDING',
          userId: authRequest.user.id,
          siteId,
        },
      });

      // Start backup process (this would be handled by a job queue in production)
      // For now, we'll simulate the backup process
      setTimeout(async () => {
        try {
          const backupPath = path.join(env.SITES_ROOT, 'backups', `${backup.id}.tar.gz`);
          
          // Create backup directory if it doesn't exist
          await fs.ensureDir(path.dirname(backupPath));
          
          // Simulate backup creation
          const backupSize = Math.floor(Math.random() * 1000000000); // Random size for demo
          
          await prisma.backup.update({
            where: { id: backup.id },
            data: {
              status: 'COMPLETED',
              size: BigInt(backupSize),
              location: backupPath,
              completedAt: new Date(),
            },
          });
        } catch (error) {
          await prisma.backup.update({
            where: { id: backup.id },
            data: {
              status: 'FAILED',
            },
          });
        }
      }, 5000); // Simulate 5 second backup

      return reply.status(201).send({
        success: true,
        data: backup,
        message: 'Backup started successfully',
      });
    } catch (error) {
      fastify.log.error('Failed to create backup:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to create backup',
      });
    }
  });

  // Restore backup
  fastify.post('/:id/restore', {
    preHandler: [requireAuth, requireOwnership('userId')],
    schema: {
      body: restoreBackupSchema,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { restoreTo } = request.body as z.infer<typeof restoreBackupSchema>;
    
    try {
      const backup = await prisma.backup.findUnique({
        where: { id },
        include: {
          site: true,
        },
      });

      if (!backup) {
        return reply.status(404).send({
          success: false,
          error: 'Backup not found',
        });
      }

      if (backup.status !== 'COMPLETED') {
        return reply.status(400).send({
          success: false,
          error: 'Backup is not ready for restoration',
        });
      }

      if (!backup.location || !await fs.pathExists(backup.location)) {
        return reply.status(400).send({
          success: false,
          error: 'Backup file not found',
        });
      }

      // Update backup status to indicate restoration is in progress
      await prisma.backup.update({
        where: { id },
        data: {
          status: 'IN_PROGRESS',
        },
      });

      // Simulate restoration process
      setTimeout(async () => {
        try {
          // In a real implementation, this would restore the backup
          // For now, we'll just mark it as completed
          await prisma.backup.update({
            where: { id },
            data: {
              status: 'COMPLETED',
            },
          });
        } catch (error) {
          await prisma.backup.update({
            where: { id },
            data: {
              status: 'FAILED',
            },
          });
        }
      }, 10000); // Simulate 10 second restoration

      return reply.send({
        success: true,
        message: 'Backup restoration started',
      });
    } catch (error) {
      fastify.log.error('Failed to restore backup:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to restore backup',
      });
    }
  });

  // Download backup
  fastify.get('/:id/download', {
    preHandler: [requireAuth, requireOwnership('userId')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    
    try {
      const backup = await prisma.backup.findUnique({
        where: { id },
      });

      if (!backup) {
        return reply.status(404).send({
          success: false,
          error: 'Backup not found',
        });
      }

      if (backup.status !== 'COMPLETED') {
        return reply.status(400).send({
          success: false,
          error: 'Backup is not ready for download',
        });
      }

      if (!backup.location || !await fs.pathExists(backup.location)) {
        return reply.status(400).send({
          success: false,
          error: 'Backup file not found',
        });
      }

      // Set appropriate headers for file download
      reply.header('Content-Type', 'application/gzip');
      reply.header('Content-Disposition', `attachment; filename="backup-${id}.tar.gz"`);
      
      // Stream the file
      const fileStream = fs.createReadStream(backup.location);
      return reply.send(fileStream);
    } catch (error) {
      fastify.log.error('Failed to download backup:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to download backup',
      });
    }
  });

  // Delete backup
  fastify.delete('/:id', {
    preHandler: [requireAuth, requireOwnership('userId')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    
    try {
      const backup = await prisma.backup.findUnique({
        where: { id },
      });

      if (!backup) {
        return reply.status(404).send({
          success: false,
          error: 'Backup not found',
        });
      }

      // Delete backup file if it exists
      if (backup.location && await fs.pathExists(backup.location)) {
        await fs.remove(backup.location);
      }

      // Delete backup record
      await prisma.backup.delete({
        where: { id },
      });

      return reply.send({
        success: true,
        message: 'Backup deleted successfully',
      });
    } catch (error) {
      fastify.log.error('Failed to delete backup:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to delete backup',
      });
    }
  });

  // Get backup statistics
  fastify.get('/stats/overview', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const authRequest = request as AuthenticatedRequest;
    
    try {
      const [totalBackups, completedBackups, failedBackups, totalSize] = await Promise.all([
        prisma.backup.count({
          where: { userId: authRequest.user.id },
        }),
        prisma.backup.count({
          where: { 
            userId: authRequest.user.id,
            status: 'COMPLETED',
          },
        }),
        prisma.backup.count({
          where: { 
            userId: authRequest.user.id,
            status: 'FAILED',
          },
        }),
        prisma.backup.aggregate({
          where: { 
            userId: authRequest.user.id,
            status: 'COMPLETED',
          },
          _sum: {
            size: true,
          },
        }),
      ]);

      return reply.send({
        success: true,
        data: {
          totalBackups,
          completedBackups,
          failedBackups,
          pendingBackups: totalBackups - completedBackups - failedBackups,
          totalSize: totalSize._sum.size || BigInt(0),
        },
      });
    } catch (error) {
      fastify.log.error('Failed to get backup statistics:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get backup statistics',
      });
    }
  });
}
