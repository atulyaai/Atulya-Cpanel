import fs from 'fs';
import path from 'path';
import type { FastifyInstance } from 'fastify';

export interface PluginModule {
  register?: (fastify: FastifyInstance) => Promise<void> | void;
}

export async function loadPlugins(fastify: FastifyInstance, pluginDir = path.resolve('plugins')) {
  if (!fs.existsSync(pluginDir)) return;
  const entries = fs.readdirSync(pluginDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const indexJs = path.join(pluginDir, entry.name, 'index.js');
    const indexTs = path.join(pluginDir, entry.name, 'index.ts');
    const file = fs.existsSync(indexJs) ? indexJs : (fs.existsSync(indexTs) ? indexTs : undefined);
    if (!file) continue;
    const mod: PluginModule = await import(file as any);
    if (typeof mod.register === 'function') {
      await mod.register(fastify);
    }
  }
}

