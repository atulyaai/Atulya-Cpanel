import { FastifyInstance } from 'fastify';
import { runDiagnostics } from '../diagnostics/index.js';

export async function diagnosticsRoutes(fastify: FastifyInstance) {
  fastify.get('/', async () => ({ success: true, data: await runDiagnostics() }));
}

