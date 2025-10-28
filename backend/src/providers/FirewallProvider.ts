import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface FirewallRule {
  name: string;
  enabled: boolean;
  path?: string;
}

export class FirewallProvider {
  async listModSecurityRules(): Promise<FirewallRule[]> {
    return [];
  }

  async enableModSecurityRule(name: string): Promise<void> {
    // stub
  }

  async listFail2banJails(): Promise<string[]> {
    const { stdout } = await execAsync('fail2ban-client status | cat');
    return stdout.split('\n').filter(Boolean);
  }
}

