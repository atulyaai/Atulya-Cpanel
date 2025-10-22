import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../server.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { MonitoringProvider } from '../providers/MonitoringProvider.js';

export async function metricsRoutes(fastify: FastifyInstance) {
  const monitoringProvider = new MonitoringProvider();

  // Get system metrics
  fastify.get('/system', {
    preHandler: [requireAuth, requireAdmin],
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
    const authRequest = request as AuthenticatedRequest;
    
    try {
      const sites = await prisma.site.findMany({
        where: {
          userId: authRequest.user.id,
        },
        select: {
          id: true,
          domain: true,
        },
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
    preHandler: [requireAuth, requireAdmin],
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

  // Get user statistics
  fastify.get('/user-stats', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const authRequest = request as AuthenticatedRequest;
    
    try {
      const [sites, databases, emailAccounts, domains, backups, cronJobs] = await Promise.all([
        prisma.site.count({
          where: { userId: authRequest.user.id },
        }),
        prisma.database.count({
          where: { userId: authRequest.user.id },
        }),
        prisma.emailAccount.count({
          where: { userId: authRequest.user.id },
        }),
        prisma.domain.count({
          where: {
            site: {
              userId: authRequest.user.id,
            },
          },
        }),
        prisma.backup.count({
          where: { userId: authRequest.user.id },
        }),
        prisma.cronJob.count({
          where: { userId: authRequest.user.id },
        }),
      ]);

      return reply.send({
        success: true,
        data: {
          sites,
          databases,
          emailAccounts,
          domains,
          backups,
          cronJobs,
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

  // Get admin statistics
  fastify.get('/admin-stats', {
    preHandler: [requireAuth, requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const [
        totalUsers,
        activeUsers,
        totalSites,
        totalDatabases,
        totalEmailAccounts,
        totalDomains,
        totalBackups,
        totalCronJobs,
        systemMetrics
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.site.count(),
        prisma.database.count(),
        prisma.emailAccount.count(),
        prisma.domain.count(),
        prisma.backup.count(),
        prisma.cronJob.count(),
        monitoringProvider.getSystemMetrics(),
      ]);

      return reply.send({
        success: true,
        data: {
          users: {
            total: totalUsers,
            active: activeUsers,
            inactive: totalUsers - activeUsers,
          },
          resources: {
            sites: totalSites,
            databases: totalDatabases,
            emailAccounts: totalEmailAccounts,
            domains: totalDomains,
            backups: totalBackups,
            cronJobs: totalCronJobs,
          },
          system: systemMetrics,
        },
      });
    } catch (error) {
      fastify.log.error('Failed to get admin statistics:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get admin statistics',
      });
    }
  });

  // Get dashboard overview
  fastify.get('/dashboard', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const authRequest = request as AuthenticatedRequest;
    
    try {
      const [userStats, recentSites, recentBackups, systemAlerts] = await Promise.all([
        // User statistics
        Promise.all([
          prisma.site.count({
            where: { userId: authRequest.user.id },
          }),
          prisma.database.count({
            where: { userId: authRequest.user.id },
          }),
          prisma.emailAccount.count({
            where: { userId: authRequest.user.id },
          }),
          prisma.domain.count({
            where: {
              site: {
                userId: authRequest.user.id,
              },
            },
          }),
        ]),
        // Recent sites
        prisma.site.findMany({
          where: { userId: authRequest.user.id },
          select: {
            id: true,
            domain: true,
            isActive: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
        // Recent backups
        prisma.backup.findMany({
          where: { userId: authRequest.user.id },
          select: {
            id: true,
            type: true,
            status: true,
            size: true,
            createdAt: true,
            site: {
              select: {
                domain: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
        // System alerts (admin only)
        authRequest.user.role === 'ADMIN' ? (async () => {
          const systemMetrics = await monitoringProvider.getSystemMetrics();
          return monitoringProvider.getSystemAlerts(systemMetrics);
        })() : Promise.resolve([]),
      ]);

      const [sites, databases, emailAccounts, domains] = userStats;

      return reply.send({
        success: true,
        data: {
          stats: {
            sites,
            databases,
            emailAccounts,
            domains,
          },
          recentSites,
          recentBackups,
          alerts: systemAlerts,
        },
      });
    } catch (error) {
      fastify.log.error('Failed to get dashboard overview:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get dashboard overview',
      });
    }
  });
}
