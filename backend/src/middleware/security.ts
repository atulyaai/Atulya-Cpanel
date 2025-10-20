import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../config/env.js';

/**
 * Security headers middleware
 */
export async function securityHeaders(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Security headers
    if (env.SECURITY_HEADERS_ENABLED) {
      // Prevent clickjacking
      reply.header('X-Frame-Options', env.X_FRAME_OPTIONS || 'DENY');
      
      // Prevent MIME type sniffing
      reply.header('X-Content-Type-Options', env.X_CONTENT_TYPE_OPTIONS || 'nosniff');
      
      // XSS protection
      reply.header('X-XSS-Protection', env.X_XSS_PROTECTION || '1; mode=block');
      
      // Referrer policy
      reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
      
      // Permissions policy
      reply.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
      
      // Content Security Policy
      if (env.CSP_ENABLED) {
        const csp = [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https:",
          "font-src 'self'",
          "connect-src 'self'",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'"
        ].join('; ');
        reply.header('Content-Security-Policy', csp);
      }
      
      // HSTS (only for HTTPS)
      if (env.HSTS_ENABLED && request.protocol === 'https') {
        reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      }
    }
  });
}

/**
 * Input validation middleware
 */
export function validateInput(schema: any) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Validate request body, query, and params
      if (request.body && schema.body) {
        schema.body.parse(request.body);
      }
      if (request.query && schema.query) {
        schema.query.parse(request.query);
      }
      if (request.params && schema.params) {
        schema.params.parse(request.params);
      }
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid input data',
        details: error instanceof Error ? error.message : 'Validation failed',
      });
    }
  };
}

/**
 * Rate limiting middleware for different endpoints
 */
export function createRateLimit(options: {
  max: number;
  windowMs: number;
  keyGenerator?: (request: FastifyRequest) => string;
}) {
  const requests = new Map<string, { count: number; resetTime: number }>();
  
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const key = options.keyGenerator 
      ? options.keyGenerator(request)
      : request.ip || 'unknown';
    
    const now = Date.now();
    const windowStart = now - options.windowMs;
    
    // Clean up expired entries
    for (const [k, v] of requests.entries()) {
      if (v.resetTime < windowStart) {
        requests.delete(k);
      }
    }
    
    const current = requests.get(key);
    
    if (!current) {
      requests.set(key, { count: 1, resetTime: now });
    } else if (current.resetTime < windowStart) {
      requests.set(key, { count: 1, resetTime: now });
    } else if (current.count >= options.max) {
      return reply.status(429).send({
        success: false,
        error: 'Too many requests',
        retryAfter: Math.ceil((current.resetTime + options.windowMs - now) / 1000),
      });
    } else {
      current.count++;
    }
  };
}

/**
 * Login rate limiting
 */
export const loginRateLimit = createRateLimit({
  max: env.RATE_LIMIT_LOGIN_MAX || 5,
  windowMs: env.RATE_LIMIT_LOGIN_WINDOW || 900000, // 15 minutes
  keyGenerator: (request) => {
    const ip = request.ip || 'unknown';
    const email = (request.body as any)?.email || '';
    return `${ip}:${email}`;
  },
});

/**
 * General API rate limiting
 */
export const apiRateLimit = createRateLimit({
  max: env.RATE_LIMIT_MAX || 100,
  windowMs: env.RATE_LIMIT_WINDOW || 900000, // 15 minutes
});

/**
 * Password validation
 */
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < (env.PASSWORD_MIN_LENGTH || 8)) {
    errors.push(`Password must be at least ${env.PASSWORD_MIN_LENGTH || 8} characters long`);
  }
  
  if (env.PASSWORD_REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (env.PASSWORD_REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (env.PASSWORD_REQUIRE_NUMBERS && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (env.PASSWORD_REQUIRE_SYMBOLS && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Email validation
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Domain validation
 */
export function validateDomain(domain: string): boolean {
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return domainRegex.test(domain) && domain.length <= 253;
}

/**
 * Database name validation
 */
export function validateDatabaseName(name: string): boolean {
  const dbRegex = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/;
  return dbRegex.test(name) && name.length >= 1 && name.length <= 64;
}

/**
 * Username validation
 */
export function validateUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z][a-zA-Z0-9_]{2,31}$/;
  return usernameRegex.test(username) && username.length >= 3 && username.length <= 32;
}

/**
 * File path validation (prevent directory traversal)
 */
export function validateFilePath(path: string): boolean {
  // Prevent directory traversal attacks
  if (path.includes('..') || path.includes('~') || path.startsWith('/')) {
    return false;
  }
  
  // Only allow alphanumeric, dots, dashes, underscores, and forward slashes
  const pathRegex = /^[a-zA-Z0-9._\-\/]+$/;
  return pathRegex.test(path);
}

/**
 * IP address validation
 */
export function validateIPAddress(ip: string): boolean {
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * Main security middleware that combines all security features
 */
export async function securityMiddleware(fastify: FastifyInstance) {
  // Apply security headers
  await fastify.register(securityHeaders);
  
  // Apply rate limiting
  await fastify.register(async function (fastify) {
    fastify.addHook('preHandler', createRateLimit({
      max: 100, // requests per window
      windowMs: 15 * 60 * 1000, // 15 minutes
      keyGenerator: (request) => request.ip || 'unknown'
    }));
  });
}
