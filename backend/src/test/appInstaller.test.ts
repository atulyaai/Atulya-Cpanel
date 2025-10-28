import { describe, it, expect } from 'vitest';
import { AppInstallerProvider } from '../providers/AppInstallerProvider.js';

describe('AppInstallerProvider', () => {
  it('exposes install method', async () => {
    const p = new AppInstallerProvider();
    expect(typeof p.install).toBe('function');
  });
});

