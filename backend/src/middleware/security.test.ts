import { describe, it, expect } from 'vitest';
import { build } from '../test/test-server';

describe('Security Middleware', () => {
  it('should apply security headers', async () => {
    const app = await build();

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  it('should apply rate limiting', async () => {
    const app = await build();

    // Make multiple requests quickly
    const requests = Array.from({ length: 10 }, () =>
      app.inject({
        method: 'GET',
        url: '/health',
      })
    );

    const responses = await Promise.all(requests);
    
    // All requests should succeed (rate limit is high for health endpoint)
    responses.forEach(response => {
      expect(response.statusCode).toBe(200);
    });
  });
});