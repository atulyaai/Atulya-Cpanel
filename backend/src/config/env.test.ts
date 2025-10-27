import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Environment Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  it('should load default values when environment variables are not set', () => {
    // Set minimal required environment variables
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_SECRET = 'test-secret-key-that-is-long-enough';

    // Clear module cache to reload env.ts
    delete require.cache[require.resolve('./env.js')];

    const { env } = require('./env.js');

    expect(env.PORT).toBe(3000);
    expect(env.HOST).toBe('0.0.0.0');
    expect(env.NODE_ENV).toBe('development');
    expect(env.PROVIDER).toBe('LOCAL');
    expect(env.SITES_ROOT).toBe('/var/www');
    expect(env.DRY_RUN).toBe(false);
    expect(env.MYSQL_HOST).toBe('localhost');
    expect(env.MYSQL_PORT).toBe(3306);
    expect(env.MYSQL_ROOT_USER).toBe('root');
    expect(env.MYSQL_ROOT_PASSWORD).toBe('');
    expect(env.POSTFIX_VIRTUAL_DIR).toBe('/etc/postfix/virtual');
    expect(env.DOVECOT_CONF_DIR).toBe('/etc/dovecot');
    expect(env.CERTBOT_EMAIL).toBe('admin@example.com');
    expect(env.SSL_STAGING).toBe(false);
    expect(env.BCRYPT_ROUNDS).toBe(12);
    expect(env.RATE_LIMIT_MAX).toBe(100);
    expect(env.RATE_LIMIT_WINDOW).toBe(900000);
    expect(env.RATE_LIMIT_LOGIN_MAX).toBe(5);
    expect(env.RATE_LIMIT_LOGIN_WINDOW).toBe(900000);
    expect(env.PASSWORD_MIN_LENGTH).toBe(8);
    expect(env.PASSWORD_REQUIRE_UPPERCASE).toBe(true);
    expect(env.PASSWORD_REQUIRE_LOWERCASE).toBe(true);
    expect(env.PASSWORD_REQUIRE_NUMBERS).toBe(true);
    expect(env.PASSWORD_REQUIRE_SYMBOLS).toBe(true);
    expect(env.SECURITY_HEADERS_ENABLED).toBe(true);
    expect(env.CSP_ENABLED).toBe(true);
    expect(env.HSTS_ENABLED).toBe(true);
    expect(env.X_FRAME_OPTIONS).toBe('DENY');
    expect(env.X_CONTENT_TYPE_OPTIONS).toBe('nosniff');
    expect(env.X_XSS_PROTECTION).toBe('1; mode=block');
    expect(env.FRONTEND_URL).toBe('http://localhost:5173');
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.LOG_FILE).toBe('/var/log/atulya-panel.log');
  });

  it('should validate required environment variables', () => {
    // Clear required environment variables
    delete process.env.DATABASE_URL;
    delete process.env.JWT_SECRET;

    // Clear module cache
    delete require.cache[require.resolve('./env.js')];

    expect(() => {
      require('./env.js');
    }).toThrow();
  });

  it('should validate JWT secret length', () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_SECRET = 'short'; // Too short

    delete require.cache[require.resolve('./env.js')];

    expect(() => {
      require('./env.js');
    }).toThrow();
  });

  it('should validate email format for CERTBOT_EMAIL', () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_SECRET = 'test-secret-key-that-is-long-enough';
    process.env.CERTBOT_EMAIL = 'invalid-email';

    delete require.cache[require.resolve('./env.js')];

    expect(() => {
      require('./env.js');
    }).toThrow();
  });

  it('should validate NODE_ENV enum', () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_SECRET = 'test-secret-key-that-is-long-enough';
    process.env.NODE_ENV = 'invalid';

    delete require.cache[require.resolve('./env.js')];

    expect(() => {
      require('./env.js');
    }).toThrow();
  });

  it('should validate PROVIDER enum', () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_SECRET = 'test-secret-key-that-is-long-enough';
    process.env.PROVIDER = 'INVALID';

    delete require.cache[require.resolve('./env.js')];

    expect(() => {
      require('./env.js');
    }).toThrow();
  });

  it('should coerce boolean values correctly', () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_SECRET = 'test-secret-key-that-is-long-enough';
    process.env.DRY_RUN = 'true';
    process.env.SSL_STAGING = 'false';
    process.env.PASSWORD_REQUIRE_UPPERCASE = '0';
    process.env.SECURITY_HEADERS_ENABLED = '1';

    delete require.cache[require.resolve('./env.js')];

    const { env } = require('./env.js');

    expect(env.DRY_RUN).toBe(true);
    expect(env.SSL_STAGING).toBe(false);
    expect(env.PASSWORD_REQUIRE_UPPERCASE).toBe(false);
    expect(env.SECURITY_HEADERS_ENABLED).toBe(true);
  });

  it('should coerce number values correctly', () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_SECRET = 'test-secret-key-that-is-long-enough';
    process.env.PORT = '8080';
    process.env.MYSQL_PORT = '3307';
    process.env.BCRYPT_ROUNDS = '14';

    delete require.cache[require.resolve('./env.js')];

    const { env } = require('./env.js');

    expect(env.PORT).toBe(8080);
    expect(env.MYSQL_PORT).toBe(3307);
    expect(env.BCRYPT_ROUNDS).toBe(14);
  });
});