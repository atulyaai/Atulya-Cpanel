import { FastifyInstance } from 'fastify';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function runDiagnostics() {
  const results: Record<string, any> = {};
  try { await execAsync('node -v'); results.node = true; } catch { results.node = false; }
  try { await execAsync('psql --version'); results.postgres = true; } catch { results.postgres = false; }
  try { await execAsync('redis-server --version'); results.redis = true; } catch { results.redis = false; }
  return results;
}

export async function diagnosticsRoutes(fastify: FastifyInstance) {
  fastify.get('/diagnostics', async () => {
    return { success: true, data: await runDiagnostics() };
  });
}

