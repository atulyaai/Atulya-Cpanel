import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/atulya_panel_test';

// Mock console methods to reduce noise in tests
const originalConsole = { ...console };
beforeAll(() => {
  console.warn = () => {};
  console.error = () => {};
});

// Restore console after tests
afterAll(() => {
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
});