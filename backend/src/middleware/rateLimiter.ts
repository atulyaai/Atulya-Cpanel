import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../config/env.js';
import fp from 'fastify-plugin';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

async function rateLimiterPlugin(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip rate limiting for health checks
    if (request.url === '/health') {
      return;
    }

    const clientId = request.ip || 'unknown';
    const now = Date.now();
    const windowMs = env.RATE_LIMIT_WINDOW;
    const maxRequests = env.RATE_LIMIT_MAX;

    // Clean up expired entries
    Object.keys(store).forEach(key => {
      if (store[key].resetTime < now) {
        delete store[key];
      }
    });

    // Get or create client record
    if (!store[clientId]) {
      store[clientId] = {
        count: 0,
        resetTime: now + windowMs,
      };
    }

    const client = store[clientId];

    // Check if window has expired
    if (client.resetTime < now) {
      client.count = 1; // Start with 1 for current request
      client.resetTime = now + windowMs;
    }

    // Increment request count
    client.count++;

    // Check if limit exceeded
    if (client.count > maxRequests) {
      const resetTime = Math.ceil((client.resetTime - now) / 1000);
      
      reply.header('Retry-After', resetTime.toString());
      reply.status(429).send({
        success: false,
        error: 'Rate limit exceeded',
        retryAfter: resetTime,
      });
      return;
    }

    // Add rate limit headers
    reply.header('X-RateLimit-Limit', maxRequests.toString());
    reply.header('X-RateLimit-Remaining', Math.max(0, maxRequests - client.count).toString());
    reply.header('X-RateLimit-Reset', Math.ceil(client.resetTime / 1000).toString());
  });
}

export const rateLimiter = fp(rateLimiterPlugin, {
  name: 'rateLimiter',
});
