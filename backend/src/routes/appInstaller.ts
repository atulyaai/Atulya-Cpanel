import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AppInstallerProvider } from '../providers/AppInstallerProvider.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';

const installSchema = z.object({
  app: z.enum(['wordpress', 'joomla', 'prestashop', 'ghost', 'drupal']),
  domain: z.string().min(1),
  documentRoot: z.string().min(1),
  dbName: z.string().min(1),
  dbUser: z.string().min(1),
  dbPassword: z.string().min(1),
  adminEmail: z.string().email().optional(),
});

export async function appInstallerRoutes(fastify: FastifyInstance) {
  const provider = new AppInstallerProvider();

  fastify.post('/install', { preHandler: [requireAuth, requireAdmin] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = installSchema.parse((request as any).body);
    const result = await provider.install(body.app, body);
    return reply.send({ success: true, data: result });
  });
}

