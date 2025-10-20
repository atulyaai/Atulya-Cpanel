import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MonitoringProvider } from '../providers/MonitoringProvider.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { WebSocketService } from '../services/WebSocketService.js';
import { prisma } from '../server.js';

export async function monitoringRoutes(fastify: FastifyInstance) {
  const monitoringProvider = new MonitoringProvider();
  const webSocketService = fastify.websocketService as WebSocketService;

  // Get system metrics
  fastify.get('/system', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const metrics = await monitoringProvider.getSystemMetrics();
      
      return reply.send({
        success: true,
        data: metrics,
      });
    } catch (error) {
      fastify.log.error('Failed to get system metrics:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get system metrics',
      });
    }
  });

  // Get site metrics
  fastify.get('/sites', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authRequest = request as any;
      
      // Get user's sites
      const sites = await prisma.site.findMany({
        where: {
          userId: authRequest.user.id,
        },
        select: {
          id: true,
          domain: true,
        }
      });

      const metrics = await monitoringProvider.getSiteMetrics(sites);
      
      return reply.send({
        success: true,
        data: metrics,
      });
    } catch (error) {
      fastify.log.error('Failed to get site metrics:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get site metrics',
      });
    }
  });

  // Get database metrics
  fastify.get('/databases', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const metrics = await monitoringProvider.getDatabaseMetrics();
      
      return reply.send({
        success: true,
        data: metrics,
      });
    } catch (error) {
      fastify.log.error('Failed to get database metrics:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get database metrics',
      });
    }
  });

  // Get email metrics
  fastify.get('/email', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const metrics = await monitoringProvider.getEmailMetrics();
      
      return reply.send({
        success: true,
        data: metrics,
      });
    } catch (error) {
      fastify.log.error('Failed to get email metrics:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get email metrics',
      });
    }
  });

  // Get system alerts
  fastify.get('/alerts', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const systemMetrics = await monitoringProvider.getSystemMetrics();
      const alerts = monitoringProvider.getSystemAlerts(systemMetrics);
      
      return reply.send({
        success: true,
        data: alerts,
      });
    } catch (error) {
      fastify.log.error('Failed to get system alerts:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get system alerts',
      });
    }
  });

  // Get monitoring statistics
  fastify.get('/stats', {
    preHandler: [requireAuth, requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const [systemMetrics, siteMetrics, databaseMetrics, emailMetrics] = await Promise.all([
        monitoringProvider.getSystemMetrics(),
        prisma.site.count(),
        prisma.database.count(),
        prisma.emailAccount.count(),
      ]);

      const stats = {
        system: {
          cpu: systemMetrics.cpu.usage,
          memory: systemMetrics.memory.percentage,
          disk: systemMetrics.disk.percentage,
          load: systemMetrics.load.avg1m,
          uptime: systemMetrics.uptime,
        },
        sites: {
          total: siteMetrics,
          active: systemMetrics.services.nginx ? siteMetrics : 0,
        },
        databases: {
          total: databaseMetrics,
          active: systemMetrics.services.mysql ? databaseMetrics : 0,
        },
        email: {
          total: emailMetrics,
          active: systemMetrics.services.postfix ? emailMetrics : 0,
        },
        services: systemMetrics.services,
      };

      return reply.send({
        success: true,
        data: stats,
      });
    } catch (error) {
      fastify.log.error('Failed to get monitoring statistics:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get monitoring statistics',
      });
    }
  });

  // Get WebSocket connection statistics (admin only)
  fastify.get('/websocket/stats', {
    preHandler: [requireAuth, requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = webSocketService.getConnectionStats();
      
      return reply.send({
        success: true,
        data: stats,
      });
    } catch (error) {
      fastify.log.error('Failed to get WebSocket stats:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get WebSocket statistics',
      });
    }
  });

  // Test monitoring provider
  fastify.get('/test', {
    preHandler: [requireAuth, requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const startTime = Date.now();
      
      // Test all monitoring functions
      const [systemMetrics, databaseMetrics, emailMetrics] = await Promise.all([
        monitoringProvider.getSystemMetrics(),
        monitoringProvider.getDatabaseMetrics(),
        monitoringProvider.getEmailMetrics(),
      ]);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      const testResults = {
        systemMetrics: {
          success: !!systemMetrics,
          cpu: systemMetrics.cpu.usage,
          memory: systemMetrics.memory.percentage,
          disk: systemMetrics.disk.percentage,
        },
        databaseMetrics: {
          success: Array.isArray(databaseMetrics),
          count: databaseMetrics.length,
        },
        emailMetrics: {
          success: !!emailMetrics,
          totalAccounts: emailMetrics.totalAccounts,
        },
        performance: {
          responseTime,
          timestamp: new Date(),
        },
      };

      return reply.send({
        success: true,
        data: testResults,
      });
    } catch (error) {
      fastify.log.error('Monitoring test failed:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Monitoring test failed',
      });
    }
  });

  // Get monitoring history (if implemented)
  fastify.get('/history/:type', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { type } = request.params as { type: string };
      const { hours = 24 } = request.query as { hours?: number };

      // For now, return empty history - would need to implement metrics storage
      const history = {
        type,
        hours,
        data: [],
        message: 'Monitoring history not yet implemented'
      };

      return reply.send({
        success: true,
        data: history,
      });
    } catch (error) {
      fastify.log.error('Failed to get monitoring history:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get monitoring history',
      });
    }
  });

  // Health check endpoint
  fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const systemMetrics = await monitoringProvider.getSystemMetrics();
      
      const health = {
        status: 'healthy',
        timestamp: new Date(),
        system: {
          cpu: systemMetrics.cpu.usage,
          memory: systemMetrics.memory.percentage,
          disk: systemMetrics.disk.percentage,
        },
        services: systemMetrics.services,
        uptime: systemMetrics.uptime,
      };

      // Determine overall health status
      if (systemMetrics.cpu.usage > 95 || 
          systemMetrics.memory.percentage > 95 || 
          systemMetrics.disk.percentage > 95) {
        health.status = 'critical';
      } else if (systemMetrics.cpu.usage > 80 || 
                 systemMetrics.memory.percentage > 80 || 
                 systemMetrics.disk.percentage > 80) {
        health.status = 'warning';
      }

      return reply.send({
        success: true,
        data: health,
      });
    } catch (error) {
      fastify.log.error('Health check failed:', error);
      return reply.status(500).send({
        success: false,
        error: 'Health check failed',
      });
    }
  });
}