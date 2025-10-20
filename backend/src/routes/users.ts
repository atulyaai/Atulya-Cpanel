import { FastifyInstance } from 'fastify';

export async function userRoutes(fastify: FastifyInstance) {
  // Placeholder for user routes - will be implemented in Phase 5
  fastify.get('/', async (request, reply) => {
    return reply.send({
      success: true,
      data: [],
      message: 'User routes will be implemented in Phase 5',
    });
  });
}
