import { FastifyInstance } from 'fastify';

export async function metricsRoutes(fastify: FastifyInstance) {
  // Placeholder for metrics routes - will be implemented in Phase 3
  fastify.get('/', async (request, reply) => {
    return reply.send({
      success: true,
      data: [],
      message: 'Metrics routes will be implemented in Phase 3',
    });
  });
}
