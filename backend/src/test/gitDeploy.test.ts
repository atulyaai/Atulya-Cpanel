import { describe, it, expect } from 'vitest';
import { GitDeployProvider } from '../providers/GitDeployProvider.js';

describe('GitDeployProvider', () => {
  it('has deploy method', async () => {
    const p = new GitDeployProvider();
    expect(typeof p.deploy).toBe('function');
  });
});

