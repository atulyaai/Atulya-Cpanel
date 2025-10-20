import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { DatabaseService } from '../services/DatabaseService.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { UserRole } from '@prisma/client';

const createDatabaseSchema = z.object({
  name: z.string().min(1).max(64).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Invalid database name format'),
  username: z.string().min(1).max(32).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Invalid username format').optional(),
  password: z.string().min(8).max(128).optional(),
  siteId: z.string().optional(),
});

const executeQuerySchema = z.object({
  query: z.string().min(1).max(10000),
});

export async function databaseRoutes(fastify: FastifyInstance) {
  const databaseService = new DatabaseService();

  // Test database connection
  fastify.get('/test-connection', {
    preHandler: [requireAuth, requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const isConnected = await databaseService.testConnection();
      return reply.send({
        success: true,
        data: { connected: isConnected },
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to test database connection',
      });
    }
  });

  // Get all databases for user
  fastify.get('/', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authRequest = request as any;
      const databases = await databaseService.getDatabases(authRequest.user);
      
      return reply.send({
        success: true,
        data: databases,
      });
    } catch (error) {
      fastify.log.error('Failed to get databases:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get databases',
      });
    }
  });

  // Get all databases (admin only)
  fastify.get('/all', {
    preHandler: [requireAuth, requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const databases = await databaseService.getAllDatabases();
      
      return reply.send({
        success: true,
        data: databases,
      });
    } catch (error) {
      fastify.log.error('Failed to get all databases:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get all databases',
      });
    }
  });

  // Get database by ID
  fastify.get('/:id', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authRequest = request as any;
      const { id } = request.params as { id: string };
      
      const database = await databaseService.getDatabase(authRequest.user, id);
      
      if (!database) {
        return reply.status(404).send({
          success: false,
          error: 'Database not found',
        });
      }

      return reply.send({
        success: true,
        data: database,
      });
    } catch (error) {
      fastify.log.error('Failed to get database:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get database',
      });
    }
  });

  // Create database
  fastify.post('/', {
    preHandler: [requireAuth],
    schema: {
      body: createDatabaseSchema,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authRequest = request as any;
      const data = request.body as z.infer<typeof createDatabaseSchema>;
      
      const database = await databaseService.createDatabase(authRequest.user, data);
      
      return reply.status(201).send({
        success: true,
        data: database,
        message: 'Database created successfully',
      });
    } catch (error) {
      fastify.log.error('Failed to create database:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create database',
      });
    }
  });

  // Update database
  fastify.put('/:id', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authRequest = request as any;
      const { id } = request.params as { id: string };
      const updates = request.body as { isActive?: boolean };
      
      const database = await databaseService.updateDatabase(authRequest.user, id, updates);
      
      return reply.send({
        success: true,
        data: database,
        message: 'Database updated successfully',
      });
    } catch (error) {
      fastify.log.error('Failed to update database:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update database',
      });
    }
  });

  // Delete database
  fastify.delete('/:id', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authRequest = request as any;
      const { id } = request.params as { id: string };
      
      await databaseService.deleteDatabase(authRequest.user, id);
      
      return reply.send({
        success: true,
        message: 'Database deleted successfully',
      });
    } catch (error) {
      fastify.log.error('Failed to delete database:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete database',
      });
    }
  });

  // Get database information
  fastify.get('/:id/info', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authRequest = request as any;
      const { id } = request.params as { id: string };
      
      const info = await databaseService.getDatabaseInfo(authRequest.user, id);
      
      return reply.send({
        success: true,
        data: info,
      });
    } catch (error) {
      fastify.log.error('Failed to get database info:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get database info',
      });
    }
  });

  // Execute SQL query
  fastify.post('/:id/query', {
    preHandler: [requireAuth],
    schema: {
      body: executeQuerySchema,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authRequest = request as any;
      const { id } = request.params as { id: string };
      const { query } = request.body as z.infer<typeof executeQuerySchema>;
      
      const result = await databaseService.executeQuery(authRequest.user, id, query);
      
      return reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      fastify.log.error('Failed to execute query:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute query',
      });
    }
  });

  // Backup database
  fastify.post('/:id/backup', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authRequest = request as any;
      const { id } = request.params as { id: string };
      const { outputPath } = request.body as { outputPath: string };
      
      await databaseService.backupDatabase(authRequest.user, id, outputPath);
      
      return reply.send({
        success: true,
        message: 'Database backup completed',
      });
    } catch (error) {
      fastify.log.error('Failed to backup database:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to backup database',
      });
    }
  });

  // Restore database
  fastify.post('/:id/restore', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authRequest = request as any;
      const { id } = request.params as { id: string };
      const { backupPath } = request.body as { backupPath: string };
      
      await databaseService.restoreDatabase(authRequest.user, id, backupPath);
      
      return reply.send({
        success: true,
        message: 'Database restored successfully',
      });
    } catch (error) {
      fastify.log.error('Failed to restore database:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to restore database',
      });
    }
  });

  // Get database statistics
  fastify.get('/stats/overview', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authRequest = request as any;
      const stats = await databaseService.getStatistics(authRequest.user);
      
      return reply.send({
        success: true,
        data: stats,
      });
    } catch (error) {
      fastify.log.error('Failed to get database statistics:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get database statistics',
      });
    }
  });

  // Cleanup on server shutdown
  fastify.addHook('onClose', async () => {
    await databaseService.cleanup();
  });
}
