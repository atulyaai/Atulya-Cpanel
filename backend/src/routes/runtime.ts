import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { RuntimeProvider } from '../providers/RuntimeProvider.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';

export async function runtimeRoutes(fastify: FastifyInstance) {
  const provider = new RuntimeProvider();

  fastify.get('/versions/:type', { preHandler: [requireAuth, requireAdmin] }, async (req: FastifyRequest) => {
    const type = (req.params as any).type as 'node' | 'python';
    return { success: true, data: await provider.listVersions(type) };
  });

  const setSchema = z.object({ siteId: z.string().min(1), type: z.enum(['node', 'python']), version: z.string().min(1) });
  fastify.post('/set', { preHandler: [requireAuth, requireAdmin] }, async (req: FastifyRequest) => {
    const body = setSchema.parse((req as any).body);
    await provider.setSiteRuntime(body.siteId, body.type, body.version);
    return { success: true };
  });
}

