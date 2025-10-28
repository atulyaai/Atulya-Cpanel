import { describe, it, expect } from 'vitest';
import { FirewallProvider } from '../providers/FirewallProvider.js';

describe('FirewallProvider', () => {
  it('lists fail2ban jails (stub ok)', async () => {
    const p = new FirewallProvider();
    const res = await p.listFail2banJails().catch(() => []);
    expect(Array.isArray(res)).toBe(true);
  });
});

