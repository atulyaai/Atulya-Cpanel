import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export type AppType = 'wordpress' | 'joomla' | 'prestashop' | 'ghost' | 'drupal';

export interface InstallOptions {
  domain: string;
  documentRoot: string;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  adminEmail?: string;
}

export class AppInstallerProvider {
  async install(app: AppType, options: InstallOptions): Promise<{ success: boolean; message: string }> {
    // Minimal stub — hook real installers later
    switch (app) {
      case 'wordpress':
        await this.installWordPress(options);
        break;
      default:
        // Other apps to be implemented
        break;
    }
    return { success: true, message: `${app} installed for ${options.domain}` };
  }

  private async installWordPress(options: InstallOptions) {
    // Placeholder: download latest WP and unpack to documentRoot
    await execAsync(`mkdir -p ${options.documentRoot} && curl -L https://wordpress.org/latest.tar.gz | tar -xz -C ${options.documentRoot} --strip-components=1`);
  }
}

