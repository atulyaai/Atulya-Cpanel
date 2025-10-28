import { describe, it, expect } from 'vitest';
import { RuntimeProvider } from '../providers/RuntimeProvider.js';

describe('RuntimeProvider', () => {
  it('lists versions', async () => {
    const p = new RuntimeProvider();
    const versions = await p.listVersions('node');
    expect(Array.isArray(versions)).toBe(true);
  });
});

