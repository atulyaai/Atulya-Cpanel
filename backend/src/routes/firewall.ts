import { FastifyInstance } from 'fastify';
import { FirewallProvider } from '../providers/FirewallProvider.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';

export async function firewallRoutes(fastify: FastifyInstance) {
  const provider = new FirewallProvider();

  fastify.get('/modsecurity', { preHandler: [requireAuth, requireAdmin] }, async () => {
    return { success: true, data: await provider.listModSecurityRules() };
  });

  fastify.get('/fail2ban/jails', { preHandler: [requireAuth, requireAdmin] }, async () => {
    return { success: true, data: await provider.listFail2banJails() };
  });
}

