import { FastifyInstance } from 'fastify';

export async function siteRoutes(fastify: FastifyInstance) {
  // Placeholder for site routes - will be implemented in Phase 2
  fastify.get('/', async (request, reply) => {
    return reply.send({
      success: true,
      data: [],
      message: 'Site routes will be implemented in Phase 2',
    });
  });
}
