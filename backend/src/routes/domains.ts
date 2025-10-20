import { FastifyInstance } from 'fastify';

export async function domainRoutes(fastify: FastifyInstance) {
  // Placeholder for domain routes - will be implemented in Phase 2
  fastify.get('/', async (request, reply) => {
    return reply.send({
      success: true,
      data: [],
      message: 'Domain routes will be implemented in Phase 2',
    });
  });
}
