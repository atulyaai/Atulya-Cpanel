import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export type RuntimeType = 'node' | 'python';

export class RuntimeProvider {
  async listVersions(type: RuntimeType): Promise<string[]> {
    // Stubbed versions; integrate nvm/pyenv later
    if (type === 'node') return ['18', '20'];
    return ['3.10', '3.11'];
  }

  async setSiteRuntime(siteId: string, type: RuntimeType, version: string): Promise<void> {
    // Persist selection in DB in future; placeholder
  }
}

