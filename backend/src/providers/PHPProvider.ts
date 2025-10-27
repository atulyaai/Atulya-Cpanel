import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { env } from '../config/env.js';

const execAsync = promisify(exec);

export interface PHPVersion {
  version: string;
  path: string;
  socket: string;
  isActive: boolean;
}

export interface PHPPool {
  name: string;
  version: string;
  user: string;
  group: string;
  listen: string;
  pm: string;
  pmMaxChildren: number;
  pmStartServers: number;
  pmMinSpareServers: number;
  pmMaxSpareServers: number;
  pmMaxRequests: number;
  phpAdminValue: Record<string, string>;
  phpValue: Record<string, string>;
}

export class PHPProvider {
  private availableVersions: string[] = ['7.4', '8.0', '8.1', '8.2', '8.3'];
  private defaultVersion: string = '8.2';

  constructor() {
    // Detect available PHP versions on the system
    this.detectAvailableVersions();
  }

  /**
   * Detect available PHP versions on the system
   */
  private async detectAvailableVersions(): Promise<void> {
    try {
      const { stdout } = await execAsync('php -v');
      const versionMatch = stdout.match(/PHP (\d+\.\d+)/);
      if (versionMatch) {
        const detectedVersion = versionMatch[1];
        if (this.availableVersions.includes(detectedVersion)) {
          this.defaultVersion = detectedVersion;
        }
      }
    } catch (error) {
      }
  }

  /**
   * Get available PHP versions
   */
  getAvailableVersions(): string[] {
    return [...this.availableVersions];
  }

  /**
   * Get default PHP version
   */
  getDefaultVersion(): string {
    return this.defaultVersion;
  }

  /**
   * Check if PHP version is installed
   */
  async isVersionInstalled(version: string): Promise<boolean> {
    try {
      await execAsync(`php${version} -v`);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get PHP-FPM socket path for version
   */
  getSocketPath(version: string): string {
    return `/var/run/php/php${version}-fpm.sock`;
  }

  /**
   * Get PHP-FPM pool configuration path
   */
  getPoolConfigPath(version: string): string {
    return `/etc/php/${version}/fpm/pool.d`;
  }

  /**
   * Create PHP-FPM pool for a site
   */
  async createPool(siteName: string, version: string, options: Partial<PHPPool> = {}): Promise<PHPPool> {
    const poolName = `${siteName}_pool`;
    const poolConfig: PHPPool = {
      name: poolName,
      version,
      user: 'www-data',
      group: 'www-data',
      listen: `/var/run/php/php${version}-fpm-${poolName}.sock`,
      pm: 'dynamic',
      pmMaxChildren: 10,
      pmStartServers: 2,
      pmMinSpareServers: 1,
      pmMaxSpareServers: 3,
      pmMaxRequests: 500,
      phpAdminValue: {
        'php.ini.disable_functions': 'exec,passthru,shell_exec,system,proc_open,popen,curl_exec,curl_multi_exec,parse_ini_file,show_source',
        'php.ini.expose_php': 'Off',
        'php.ini.allow_url_fopen': 'On',
        'php.ini.memory_limit': '256M',
        'php.ini.max_execution_time': '300',
        'php.ini.max_input_time': '300',
        'php.ini.upload_max_filesize': '100M',
        'php.ini.post_max_size': '100M',
        'php.ini.max_file_uploads': '20',
      },
      phpValue: {
        'date.timezone': 'UTC',
      },
      ...options,
    };

    const configContent = this.generatePoolConfig(poolConfig);
    const configPath = path.join(this.getPoolConfigPath(version), `${poolName}.conf`);

    try {
      await fs.writeFile(configPath, configContent);
      await this.reloadPHPFPM(version);
      
      return poolConfig;
    } catch (error) {
      console.error('Failed to create PHP-FPM pool:', error);
      throw new Error(`Failed to create PHP-FPM pool: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete PHP-FPM pool
   */
  async deletePool(poolName: string, version: string): Promise<void> {
    const configPath = path.join(this.getPoolConfigPath(version), `${poolName}.conf`);

    try {
      await fs.remove(configPath);
      await this.reloadPHPFPM(version);
    } catch (error) {
      console.error('Failed to delete PHP-FPM pool:', error);
      throw new Error(`Failed to delete PHP-FPM pool: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get PHP-FPM pool configuration
   */
  async getPoolConfig(poolName: string, version: string): Promise<PHPPool | null> {
    const configPath = path.join(this.getPoolConfigPath(version), `${poolName}.conf`);

    try {
      const exists = await fs.pathExists(configPath);
      if (!exists) {
        return null;
      }

      const content = await fs.readFile(configPath, 'utf8');
      return this.parsePoolConfig(content);
    } catch (error) {
      console.error('Failed to read PHP-FPM pool config:', error);
      return null;
    }
  }

  /**
   * List all PHP-FPM pools for a version
   */
  async listPools(version: string): Promise<string[]> {
    const poolDir = this.getPoolConfigPath(version);

    try {
      const exists = await fs.pathExists(poolDir);
      if (!exists) {
        return [];
      }

      const files = await fs.readdir(poolDir);
      return files
        .filter(file => file.endsWith('.conf') && file !== 'www.conf')
        .map(file => path.basename(file, '.conf'));
    } catch (error) {
      console.error('Failed to list PHP-FPM pools:', error);
      return [];
    }
  }

  /**
   * Reload PHP-FPM service
   */
  async reloadPHPFPM(version: string): Promise<void> {
    try {
      await execAsync(`systemctl reload php${version}-fpm`);
    } catch (error) {
      console.error(`Failed to reload PHP-FPM ${version}:`, error);
      throw new Error(`Failed to reload PHP-FPM: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get PHP-FPM status
   */
  async getPHPFPMStatus(version: string): Promise<{
    active: boolean;
    running: boolean;
    uptime: string;
    processes: number;
  }> {
    try {
      const { stdout } = await execAsync(`systemctl is-active php${version}-fpm`);
      const isActive = stdout.trim() === 'active';

      if (!isActive) {
        return {
          active: false,
          running: false,
          uptime: '0',
          processes: 0,
        };
      }

      // Get detailed status
      const { stdout: statusOutput } = await execAsync(`systemctl status php${version}-fpm --no-pager`);
      const uptimeMatch = statusOutput.match(/Active: active \(running\) since (.+?);/);
      const uptime = uptimeMatch ? uptimeMatch[1] : 'Unknown';

      // Count processes
      const { stdout: processOutput } = await execAsync(`ps aux | grep "php-fpm.*master" | grep -v grep | wc -l`);
      const processes = parseInt(processOutput.trim()) || 0;

      return {
        active: true,
        running: true,
        uptime,
        processes,
      };
    } catch (error) {
      console.error(`Failed to get PHP-FPM status for ${version}:`, error);
      return {
        active: false,
        running: false,
        uptime: '0',
        processes: 0,
      };
    }
  }

  /**
   * Generate PHP-FPM pool configuration
   */
  private generatePoolConfig(pool: PHPPool): string {
    const config = `[${pool.name}]
user = ${pool.user}
group = ${pool.group}

listen = ${pool.listen}
listen.owner = ${pool.user}
listen.group = ${pool.group}
listen.mode = 0660

pm = ${pool.pm}
pm.max_children = ${pool.pmMaxChildren}
pm.start_servers = ${pool.pmStartServers}
pm.min_spare_servers = ${pool.pmMinSpareServers}
pm.max_spare_servers = ${pool.pmMaxSpareServers}
pm.max_requests = ${pool.pmMaxRequests}

pm.status_path = /status
ping.path = /ping

; Security settings
security.limit_extensions = .php

; Logging
access.log = /var/log/php${pool.version}-fpm/${pool.name}.access.log
access.format = "%R - %u %t \"%m %r\" %s"
php_admin_value[log_errors] = On
php_admin_value[error_log] = /var/log/php${pool.version}-fpm/${pool.name}.error.log

; PHP settings
`;

    // Add php_admin_value settings
    for (const [key, value] of Object.entries(pool.phpAdminValue)) {
      config += `php_admin_value[${key}] = ${value}\n`;
    }

    // Add php_value settings
    for (const [key, value] of Object.entries(pool.phpValue)) {
      config += `php_value[${key}] = ${value}\n`;
    }

    return config;
  }

  /**
   * Parse PHP-FPM pool configuration
   */
  private parsePoolConfig(content: string): PHPPool {
    const lines = content.split('\n');
    const pool: Partial<PHPPool> = {
      phpAdminValue: {},
      phpValue: {},
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        pool.name = trimmed.slice(1, -1);
      } else if (trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').trim();

        switch (key.trim()) {
          case 'user':
            pool.user = value;
            break;
          case 'group':
            pool.group = value;
            break;
          case 'listen':
            pool.listen = value;
            break;
          case 'pm':
            pool.pm = value;
            break;
          case 'pm.max_children':
            pool.pmMaxChildren = parseInt(value);
            break;
          case 'pm.start_servers':
            pool.pmStartServers = parseInt(value);
            break;
          case 'pm.min_spare_servers':
            pool.pmMinSpareServers = parseInt(value);
            break;
          case 'pm.max_spare_servers':
            pool.pmMaxSpareServers = parseInt(value);
            break;
          case 'pm.max_requests':
            pool.pmMaxRequests = parseInt(value);
            break;
          default:
            if (key.trim().startsWith('php_admin_value[')) {
              const settingKey = key.trim().slice(16, -1);
              pool.phpAdminValue![settingKey] = value;
            } else if (key.trim().startsWith('php_value[')) {
              const settingKey = key.trim().slice(10, -1);
              pool.phpValue![settingKey] = value;
            }
            break;
        }
      }
    }

    return pool as PHPPool;
  }

  /**
   * Install PHP version (if not installed)
   */
  async installVersion(version: string): Promise<void> {
    try {
      // Check if already installed
      if (await this.isVersionInstalled(version)) {
        return;
      }

      // Install PHP and PHP-FPM
      await execAsync(`apt-get update && apt-get install -y php${version} php${version}-fpm php${version}-mysql php${version}-curl php${version}-gd php${version}-mbstring php${version}-xml php${version}-zip`);
      
      // Start and enable service
      await execAsync(`systemctl enable php${version}-fpm`);
      await execAsync(`systemctl start php${version}-fpm`);
    } catch (error) {
      console.error(`Failed to install PHP ${version}:`, error);
      throw new Error(`Failed to install PHP ${version}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get PHP information for a version
   */
  async getPHPInfo(version: string): Promise<{
    version: string;
    extensions: string[];
    configuration: Record<string, string>;
  }> {
    try {
      const { stdout } = await execAsync(`php${version} -v`);
      const versionMatch = stdout.match(/PHP (\d+\.\d+\.\d+)/);
      const phpVersion = versionMatch ? versionMatch[1] : 'Unknown';

      const { stdout: extensionsOutput } = await execAsync(`php${version} -m`);
      const extensions = extensionsOutput.split('\n').filter(line => line.trim());

      const { stdout: configOutput } = await execAsync(`php${version} -i`);
      const configuration: Record<string, string> = {};
      
      // Parse configuration (simplified)
      const configLines = configOutput.split('\n');
      for (const line of configLines) {
        if (line.includes('=>')) {
          const [key, value] = line.split('=>');
          configuration[key.trim()] = value.trim();
        }
      }

      return {
        version: phpVersion,
        extensions,
        configuration,
      };
    } catch (error) {
      console.error(`Failed to get PHP info for ${version}:`, error);
      throw new Error(`Failed to get PHP info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
