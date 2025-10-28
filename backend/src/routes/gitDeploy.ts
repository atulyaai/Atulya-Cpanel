import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { GitDeployProvider } from '../providers/GitDeployProvider.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';

const deploySchema = z.object({
  repoUrl: z.string().url(),
  branch: z.string().optional(),
  targetDir: z.string().min(1),
  postDeploy: z.string().optional(),
});

export async function gitDeployRoutes(fastify: FastifyInstance) {
  const provider = new GitDeployProvider();
  fastify.post('/deploy', { preHandler: [requireAuth, requireAdmin] }, async (req: FastifyRequest) => {
    const body = deploySchema.parse((req as any).body);
    await provider.deploy(body);
    return { success: true };
  });
}

