import { FastifyInstance } from 'fastify';

export async function backupRoutes(fastify: FastifyInstance) {
  // Placeholder for backup routes - will be implemented in Phase 4
  fastify.get('/', async (request, reply) => {
    return reply.send({
      success: true,
      data: [],
      message: 'Backup routes will be implemented in Phase 4',
    });
  });
}
