import { FastifyInstance } from 'fastify';

export async function cronRoutes(fastify: FastifyInstance) {
  // Placeholder for cron routes - will be implemented in Phase 4
  fastify.get('/', async (request, reply) => {
    return reply.send({
      success: true,
      data: [],
      message: 'Cron routes will be implemented in Phase 4',
    });
  });
}
