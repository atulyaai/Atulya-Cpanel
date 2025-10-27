import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ServiceManagerProvider } from '../providers/ServiceManagerProvider.js';

const serviceManager = new ServiceManagerProvider();

export async function serviceRoutes(fastify: FastifyInstance) {
  // Get all available services
  fastify.get('/services', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const services = await serviceManager.getAvailableServices();
      return {
        success: true,
        data: services,
        count: services.length
      };
    } catch (error) {
      fastify.log.error('Failed to get services:', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to get services',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get services by category
  fastify.get('/services/category/:category', async (request: FastifyRequest<{ Params: { category: string } }>, reply: FastifyReply) => {
    try {
      const { category } = request.params;
      const services = serviceManager.getServicesByCategory(category);
      return {
        success: true,
        data: services,
        count: services.length
      };
    } catch (error) {
      fastify.log.error('Failed to get services by category:', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to get services by category',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get specific service
  fastify.get('/services/:name', async (request: FastifyRequest<{ Params: { name: string } }>, reply: FastifyReply) => {
    try {
      const { name } = request.params;
      const service = serviceManager.getService(name);
      
      if (!service) {
        return reply.status(404).send({
          success: false,
          message: 'Service not found'
        });
      }

      // Get additional health information
      const health = await serviceManager.getServiceHealth(name);
      
      return {
        success: true,
        data: {
          ...service,
          health
        }
      };
    } catch (error) {
      fastify.log.error('Failed to get service:', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to get service',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Install a service
  fastify.post('/services/:name/install', async (request: FastifyRequest<{ Params: { name: string } }>, reply: FastifyReply) => {
    try {
      const { name } = request.params;
      const result = await serviceManager.installService(name);
      
      if (result.success) {
        return {
          success: true,
          message: result.message,
          data: result.service,
          logs: result.logs
        };
      } else {
        return reply.status(400).send({
          success: false,
          message: result.message,
          error: result.error,
          logs: result.logs
        });
      }
    } catch (error) {
      fastify.log.error('Failed to install service:', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to install service',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Uninstall a service
  fastify.post('/services/:name/uninstall', async (request: FastifyRequest<{ Params: { name: string } }>, reply: FastifyReply) => {
    try {
      const { name } = request.params;
      const result = await serviceManager.uninstallService(name);
      
      if (result.success) {
        return {
          success: true,
          message: result.message,
          data: result.service,
          logs: result.logs
        };
      } else {
        return reply.status(400).send({
          success: false,
          message: result.message,
          error: result.error,
          logs: result.logs
        });
      }
    } catch (error) {
      fastify.log.error('Failed to uninstall service:', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to uninstall service',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Start a service
  fastify.post('/services/:name/start', async (request: FastifyRequest<{ Params: { name: string } }>, reply: FastifyReply) => {
    try {
      const { name } = request.params;
      const success = await serviceManager.startService(name);
      
      if (success) {
        return {
          success: true,
          message: `Service ${name} started successfully`
        };
      } else {
        return reply.status(400).send({
          success: false,
          message: `Failed to start service ${name}`
        });
      }
    } catch (error) {
      fastify.log.error('Failed to start service:', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to start service',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Stop a service
  fastify.post('/services/:name/stop', async (request: FastifyRequest<{ Params: { name: string } }>, reply: FastifyReply) => {
    try {
      const { name } = request.params;
      const success = await serviceManager.stopService(name);
      
      if (success) {
        return {
          success: true,
          message: `Service ${name} stopped successfully`
        };
      } else {
        return reply.status(400).send({
          success: false,
          message: `Failed to stop service ${name}`
        });
      }
    } catch (error) {
      fastify.log.error('Failed to stop service:', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to stop service',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Restart a service
  fastify.post('/services/:name/restart', async (request: FastifyRequest<{ Params: { name: string } }>, reply: FastifyReply) => {
    try {
      const { name } = request.params;
      const success = await serviceManager.restartService(name);
      
      if (success) {
        return {
          success: true,
          message: `Service ${name} restarted successfully`
        };
      } else {
        return reply.status(400).send({
          success: false,
          message: `Failed to restart service ${name}`
        });
      }
    } catch (error) {
      fastify.log.error('Failed to restart service:', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to restart service',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Enable a service
  fastify.post('/services/:name/enable', async (request: FastifyRequest<{ Params: { name: string } }>, reply: FastifyReply) => {
    try {
      const { name } = request.params;
      const success = await serviceManager.enableService(name);
      
      if (success) {
        return {
          success: true,
          message: `Service ${name} enabled successfully`
        };
      } else {
        return reply.status(400).send({
          success: false,
          message: `Failed to enable service ${name}`
        });
      }
    } catch (error) {
      fastify.log.error('Failed to enable service:', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to enable service',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Disable a service
  fastify.post('/services/:name/disable', async (request: FastifyRequest<{ Params: { name: string } }>, reply: FastifyReply) => {
    try {
      const { name } = request.params;
      const success = await serviceManager.disableService(name);
      
      if (success) {
        return {
          success: true,
          message: `Service ${name} disabled successfully`
        };
      } else {
        return reply.status(400).send({
          success: false,
          message: `Failed to disable service ${name}`
        });
      }
    } catch (error) {
      fastify.log.error('Failed to disable service:', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to disable service',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get service logs
  fastify.get('/services/:name/logs', async (request: FastifyRequest<{ Params: { name: string }; Querystring: { lines?: string } }>, reply: FastifyReply) => {
    try {
      const { name } = request.params;
      const { lines = '100' } = request.query;
      const logs = await serviceManager.getServiceLogs(name, parseInt(lines));
      
      return {
        success: true,
        data: logs
      };
    } catch (error) {
      fastify.log.error('Failed to get service logs:', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to get service logs',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get service configuration
  fastify.get('/services/:name/config', async (request: FastifyRequest<{ Params: { name: string } }>, reply: FastifyReply) => {
    try {
      const { name } = request.params;
      const config = await serviceManager.getServiceConfig(name);
      
      if (!config) {
        return reply.status(404).send({
          success: false,
          message: 'Service configuration not found'
        });
      }
      
      return {
        success: true,
        data: config
      };
    } catch (error) {
      fastify.log.error('Failed to get service config:', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to get service configuration',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Update service configuration
  fastify.put('/services/:name/config', async (request: FastifyRequest<{ Params: { name: string }; Body: { config: string } }>, reply: FastifyReply) => {
    try {
      const { name } = request.params;
      const { config } = request.body;
      
      const success = await serviceManager.updateServiceConfig(name, config);
      
      if (success) {
        return {
          success: true,
          message: `Service ${name} configuration updated successfully`
        };
      } else {
        return reply.status(400).send({
          success: false,
          message: `Failed to update service ${name} configuration`
        });
      }
    } catch (error) {
      fastify.log.error('Failed to update service config:', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to update service configuration',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get service health status
  fastify.get('/services/:name/health', async (request: FastifyRequest<{ Params: { name: string } }>, reply: FastifyReply) => {
    try {
      const { name } = request.params;
      const health = await serviceManager.getServiceHealth(name);
      
      return {
        success: true,
        data: health
      };
    } catch (error) {
      fastify.log.error('Failed to get service health:', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to get service health',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get installation logs for a service
  fastify.get('/services/:name/installation-logs', async (request: FastifyRequest<{ Params: { name: string } }>, reply: FastifyReply) => {
    try {
      const { name } = request.params;
      const logs = serviceManager.getInstallationLogs(name);
      
      return {
        success: true,
        data: logs
      };
    } catch (error) {
      fastify.log.error('Failed to get installation logs:', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to get installation logs',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
