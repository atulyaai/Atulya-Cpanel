import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface GitDeployOptions {
  repoUrl: string;
  branch?: string;
  targetDir: string;
  postDeploy?: string;
}

export class GitDeployProvider {
  async deploy(options: GitDeployOptions): Promise<void> {
    const branch = options.branch || 'main';
    await execAsync(`mkdir -p ${options.targetDir}`);
    try {
      await execAsync(`git -C ${options.targetDir} rev-parse --is-inside-work-tree`);
      await execAsync(`git -C ${options.targetDir} fetch --all --prune && git -C ${options.targetDir} checkout ${branch} && git -C ${options.targetDir} pull --rebase`);
    } catch {
      await execAsync(`git clone --branch ${branch} ${options.repoUrl} ${options.targetDir}`);
    }
    if (options.postDeploy) {
      await execAsync(options.postDeploy, { cwd: options.targetDir });
    }
  }
}

