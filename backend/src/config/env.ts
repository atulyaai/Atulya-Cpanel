import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1),
  
  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  
  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  
  // Server
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // System Configuration
  PROVIDER: z.enum(['LOCAL', 'SYSTEM']).default('LOCAL'),
  SITES_ROOT: z.string().default('/var/www'),
  DRY_RUN: z.coerce.boolean().default(false),
  
  // MySQL Configuration
  MYSQL_HOST: z.string().default('localhost'),
  MYSQL_PORT: z.coerce.number().default(3306),
  MYSQL_ROOT_USER: z.string().default('root'),
  MYSQL_ROOT_PASSWORD: z.string().default(''),
  
  // Email Configuration
  POSTFIX_VIRTUAL_DIR: z.string().default('/etc/postfix/virtual'),
  DOVECOT_CONF_DIR: z.string().default('/etc/dovecot'),
  
  // SSL Configuration
  CERTBOT_EMAIL: z.string().email().default('admin@example.com'),
  SSL_STAGING: z.coerce.boolean().default(false),
  
  // Security
  BCRYPT_ROUNDS: z.coerce.number().default(12),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW: z.coerce.number().default(900000),
  RATE_LIMIT_LOGIN_MAX: z.coerce.number().default(5),
  RATE_LIMIT_LOGIN_WINDOW: z.coerce.number().default(900000),
  PASSWORD_MIN_LENGTH: z.coerce.number().default(8),
  PASSWORD_REQUIRE_UPPERCASE: z.coerce.boolean().default(true),
  PASSWORD_REQUIRE_LOWERCASE: z.coerce.boolean().default(true),
  PASSWORD_REQUIRE_NUMBERS: z.coerce.boolean().default(true),
  PASSWORD_REQUIRE_SYMBOLS: z.coerce.boolean().default(true),

  // Security Headers
  SECURITY_HEADERS_ENABLED: z.coerce.boolean().default(true),
  CSP_ENABLED: z.coerce.boolean().default(true),
  HSTS_ENABLED: z.coerce.boolean().default(true),
  X_FRAME_OPTIONS: z.string().default('DENY'),
  X_CONTENT_TYPE_OPTIONS: z.string().default('nosniff'),
  X_XSS_PROTECTION: z.string().default('1; mode=block'),
  
  // Frontend
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE: z.string().default('/var/log/atulya-panel.log'),
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
