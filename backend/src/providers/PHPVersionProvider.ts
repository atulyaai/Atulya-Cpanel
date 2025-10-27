import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';

const execAsync = promisify(exec);

export interface PHPVersion {
  version: string;
  installed: boolean;
  active: boolean;
  fpmStatus: 'running' | 'stopped' | 'failed';
  configPath: string;
  fpmConfigPath: string;
  logPath: string;
  extensions: PHPExtension[];
  settings: PHPSettings;
}

export interface PHPExtension {
  name: string;
  installed: boolean;
  version?: string;
  enabled: boolean;
  configPath?: string;
}

export interface PHPSettings {
  maxExecutionTime: number;
  memoryLimit: string;
  uploadMaxFilesize: string;
  postMaxSize: string;
  maxInputVars: number;
  dateTimezone: string;
  displayErrors: boolean;
  logErrors: boolean;
  errorReporting: string;
  opcache: {
    enabled: boolean;
    memoryConsumption: number;
    maxAcceleratedFiles: number;
    validateTimestamps: boolean;
  };
}

export interface PHPVersionSwitch {
  domain: string;
  currentVersion: string;
  availableVersions: string[];
  lastSwitched: Date;
}

export class PHPVersionProvider {
  private versions: Map<string, PHPVersion>;
  private availableVersions = ['7.4', '8.0', '8.1', '8.2', '8.3'];
  private configBasePath = '/etc/php';
  private fpmBasePath = '/etc/php';

  constructor() {
    this.versions = new Map();
  }

  /**
   * Initialize PHP versions
   */
  async initialize(): Promise<void> {
    for (const version of this.availableVersions) {
      await this.loadPHPVersion(version);
    }
  }

  /**
   * Load PHP version information
   */
  private async loadPHPVersion(version: string): Promise<void> {
    try {
      const installed = await this.isVersionInstalled(version);
      const active = await this.isVersionActive(version);
      const fpmStatus = await this.getFPMStatus(version);
      const extensions = await this.getExtensions(version);
      const settings = await this.getSettings(version);

      const phpVersion: PHPVersion = {
        version,
        installed,
        active,
        fpmStatus,
        configPath: `/etc/php/${version}/apache2/php.ini`,
        fpmConfigPath: `/etc/php/${version}/fpm/pool.d/www.conf`,
        logPath: `/var/log/php${version}-fpm.log`,
        extensions,
        settings,
      };

      this.versions.set(version, phpVersion);
    } catch (error) {
      console.error(`Failed to load PHP ${version}:`, error);
    }
  }

  /**
   * Check if PHP version is installed
   */
  private async isVersionInstalled(version: string): Promise<boolean> {
    try {
      await execAsync(`php${version} -v`);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if PHP version is active
   */
  private async isVersionActive(version: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync('php -v');
      return stdout.includes(version);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get FPM status
   */
  private async getFPMStatus(version: string): Promise<PHPVersion['fpmStatus']> {
    try {
      const { stdout } = await execAsync(`systemctl is-active php${version}-fpm`);
      return stdout.trim() === 'active' ? 'running' : 'stopped';
    } catch (error) {
      return 'failed';
    }
  }

  /**
   * Get PHP extensions
   */
  private async getExtensions(version: string): Promise<PHPExtension[]> {
    try {
      const { stdout } = await execAsync(`php${version} -m`);
      const installedModules = stdout.split('\n').filter(module => module.trim());
      
      const extensions: PHPExtension[] = [];
      const commonExtensions = [
        'bcmath', 'bz2', 'calendar', 'ctype', 'curl', 'dba', 'dom', 'enchant',
        'exif', 'fileinfo', 'filter', 'ftp', 'gd', 'gettext', 'gmp', 'hash',
        'iconv', 'imap', 'intl', 'json', 'ldap', 'libxml', 'mbstring', 'mysqli',
        'oci8', 'odbc', 'openssl', 'pcntl', 'pcre', 'pdo', 'pdo_mysql', 'pdo_pgsql',
        'pdo_sqlite', 'pgsql', 'phar', 'posix', 'pspell', 'readline', 'recode',
        'reflection', 'session', 'shmop', 'simplexml', 'snmp', 'soap', 'sockets',
        'sodium', 'sqlite3', 'standard', 'sysvmsg', 'sysvsem', 'sysvshm', 'tidy',
        'tokenizer', 'wddx', 'xml', 'xmlreader', 'xmlrpc', 'xmlwriter', 'xsl',
        'zip', 'zlib', 'opcache', 'xdebug', 'imagick', 'redis', 'memcached'
      ];

      for (const ext of commonExtensions) {
        const installed = installedModules.includes(ext);
        const enabled = installed;
        
        extensions.push({
          name: ext,
          installed,
          enabled,
          version: installed ? await this.getExtensionVersion(version, ext) : undefined,
        });
      }

      return extensions;
    } catch (error) {
      return [];
    }
  }

  /**
   * Get extension version
   */
  private async getExtensionVersion(version: string, extension: string): Promise<string | undefined> {
    try {
      const { stdout } = await execAsync(`php${version} -r "echo phpversion('${extension}');"`);
      return stdout.trim() || undefined;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Get PHP settings
   */
  private async getSettings(version: string): Promise<PHPSettings> {
    try {
      const { stdout } = await execAsync(`php${version} -i`);
      const lines = stdout.split('\n');
      
      const settings: PHPSettings = {
        maxExecutionTime: 30,
        memoryLimit: '128M',
        uploadMaxFilesize: '2M',
        postMaxSize: '8M',
        maxInputVars: 1000,
        dateTimezone: 'UTC',
        displayErrors: false,
        logErrors: true,
        errorReporting: 'E_ALL',
        opcache: {
          enabled: false,
          memoryConsumption: 128,
          maxAcceleratedFiles: 2000,
          validateTimestamps: true,
        },
      };

      for (const line of lines) {
        const [key, value] = line.split(' => ').map(s => s.trim());
        
        switch (key) {
          case 'max_execution_time':
            settings.maxExecutionTime = parseInt(value) || 30;
            break;
          case 'memory_limit':
            settings.memoryLimit = value || '128M';
            break;
          case 'upload_max_filesize':
            settings.uploadMaxFilesize = value || '2M';
            break;
          case 'post_max_size':
            settings.postMaxSize = value || '8M';
            break;
          case 'max_input_vars':
            settings.maxInputVars = parseInt(value) || 1000;
            break;
          case 'date.timezone':
            settings.dateTimezone = value || 'UTC';
            break;
          case 'display_errors':
            settings.displayErrors = value === 'On';
            break;
          case 'log_errors':
            settings.logErrors = value === 'On';
            break;
          case 'error_reporting':
            settings.errorReporting = value || 'E_ALL';
            break;
          case 'opcache.enable':
            settings.opcache.enabled = value === '1';
            break;
          case 'opcache.memory_consumption':
            settings.opcache.memoryConsumption = parseInt(value) || 128;
            break;
          case 'opcache.max_accelerated_files':
            settings.opcache.maxAcceleratedFiles = parseInt(value) || 2000;
            break;
          case 'opcache.validate_timestamps':
            settings.opcache.validateTimestamps = value === '1';
            break;
        }
      }

      return settings;
    } catch (error) {
      return {
        maxExecutionTime: 30,
        memoryLimit: '128M',
        uploadMaxFilesize: '2M',
        postMaxSize: '8M',
        maxInputVars: 1000,
        dateTimezone: 'UTC',
        displayErrors: false,
        logErrors: true,
        errorReporting: 'E_ALL',
        opcache: {
          enabled: false,
          memoryConsumption: 128,
          maxAcceleratedFiles: 2000,
          validateTimestamps: true,
        },
      };
    }
  }

  /**
   * Get all PHP versions
   */
  getVersions(): PHPVersion[] {
    return Array.from(this.versions.values());
  }

  /**
   * Get specific PHP version
   */
  getVersion(version: string): PHPVersion | undefined {
    return this.versions.get(version);
  }

  /**
   * Install PHP version
   */
  async installVersion(version: string): Promise<void> {
    try {
      await execAsync(`apt-get update`);
      await execAsync(`apt-get install -y php${version} php${version}-fpm php${version}-cli php${version}-common php${version}-mysql php${version}-zip php${version}-gd php${version}-mbstring php${version}-curl php${version}-xml php${version}-bcmath php${version}-json`);
      
      // Start and enable FPM service
      await execAsync(`systemctl enable php${version}-fpm`);
      await execAsync(`systemctl start php${version}-fpm`);
      
      // Reload versions
      await this.loadPHPVersion(version);
    } catch (error) {
      console.error(`Failed to install PHP ${version}:`, error);
      throw new Error(`Failed to install PHP ${version}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Uninstall PHP version
   */
  async uninstallVersion(version: string): Promise<void> {
    try {
      // Stop and disable FPM service
      await execAsync(`systemctl stop php${version}-fpm`);
      await execAsync(`systemctl disable php${version}-fpm`);
      
      // Uninstall packages
      await execAsync(`apt-get remove -y php${version}*`);
      
      // Remove from versions
      this.versions.delete(version);
    } catch (error) {
      console.error(`Failed to uninstall PHP ${version}:`, error);
      throw new Error(`Failed to uninstall PHP ${version}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Switch default PHP version
   */
  async switchDefaultVersion(version: string): Promise<void> {
    try {
      const phpVersion = this.versions.get(version);
      if (!phpVersion || !phpVersion.installed) {
        throw new Error(`PHP ${version} is not installed`);
      }

      // Update alternatives
      await execAsync(`update-alternatives --install /usr/bin/php php /usr/bin/php${version} ${version}`);
      await execAsync(`update-alternatives --set php /usr/bin/php${version}`);
      
      // Update versions
      for (const [v, info] of this.versions) {
        info.active = v === version;
      }
    } catch (error) {
      console.error(`Failed to switch to PHP ${version}:`, error);
      throw new Error(`Failed to switch to PHP ${version}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Switch PHP version for domain
   */
  async switchDomainVersion(domain: string, version: string): Promise<void> {
    try {
      const phpVersion = this.versions.get(version);
      if (!phpVersion || !phpVersion.installed) {
        throw new Error(`PHP ${version} is not installed`);
      }

      // Update Nginx configuration
      await this.updateNginxConfig(domain, version);
      
      // Update Apache configuration
      await this.updateApacheConfig(domain, version);
      
      // Reload web servers
      await this.reloadWebServers();
    } catch (error) {
      console.error(`Failed to switch domain ${domain} to PHP ${version}:`, error);
      throw new Error(`Failed to switch domain ${domain} to PHP ${version}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update Nginx configuration
   */
  private async updateNginxConfig(domain: string, version: string): Promise<void> {
    try {
      const configPath = `/etc/nginx/sites-available/${domain}`;
      if (await fs.pathExists(configPath)) {
        let content = await fs.readFile(configPath, 'utf8');
        
        // Update PHP-FPM socket path
        content = content.replace(
          /fastcgi_pass unix:\/run\/php\/php\d+\.\d+-fpm\.sock/g,
          `fastcgi_pass unix:/run/php/php${version}-fpm.sock`
        );
        
        await fs.writeFile(configPath, content);
      }
    } catch (error) {
      console.warn(`Failed to update Nginx config for ${domain}:`, error);
    }
  }

  /**
   * Update Apache configuration
   */
  private async updateApacheConfig(domain: string, version: string): Promise<void> {
    try {
      const configPath = `/etc/apache2/sites-available/${domain}.conf`;
      if (await fs.pathExists(configPath)) {
        let content = await fs.readFile(configPath, 'utf8');
        
        // Update PHP-FPM socket path
        content = content.replace(
          /SetHandler "proxy:unix:\/run\/php\/php\d+\.\d+-fpm\.sock/g,
          `SetHandler "proxy:unix:/run/php/php${version}-fpm.sock`
        );
        
        await fs.writeFile(configPath, content);
      }
    } catch (error) {
      console.warn(`Failed to update Apache config for ${domain}:`, error);
    }
  }

  /**
   * Reload web servers
   */
  private async reloadWebServers(): Promise<void> {
    try {
      await execAsync('systemctl reload nginx');
    } catch (error) {
      console.warn('Failed to reload Nginx:', error);
    }

    try {
      await execAsync('systemctl reload apache2');
    } catch (error) {
      console.warn('Failed to reload Apache:', error);
    }
  }

  /**
   * Update PHP settings
   */
  async updateSettings(version: string, settings: Partial<PHPSettings>): Promise<void> {
    try {
      const phpVersion = this.versions.get(version);
      if (!phpVersion || !phpVersion.installed) {
        throw new Error(`PHP ${version} is not installed`);
      }

      // Update php.ini
      await this.updatePHPIni(version, settings);
      
      // Update FPM pool configuration
      await this.updateFPMPool(version, settings);
      
      // Restart FPM service
      await execAsync(`systemctl restart php${version}-fpm`);
      
      // Reload version
      await this.loadPHPVersion(version);
    } catch (error) {
      console.error(`Failed to update PHP ${version} settings:`, error);
      throw new Error(`Failed to update PHP ${version} settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update php.ini file
   */
  private async updatePHPIni(version: string, settings: Partial<PHPSettings>): Promise<void> {
    try {
      const configPath = `/etc/php/${version}/apache2/php.ini`;
      if (await fs.pathExists(configPath)) {
        let content = await fs.readFile(configPath, 'utf8');
        
        // Update settings
        if (settings.maxExecutionTime !== undefined) {
          content = content.replace(/max_execution_time = \d+/, `max_execution_time = ${settings.maxExecutionTime}`);
        }
        if (settings.memoryLimit) {
          content = content.replace(/memory_limit = .+/, `memory_limit = ${settings.memoryLimit}`);
        }
        if (settings.uploadMaxFilesize) {
          content = content.replace(/upload_max_filesize = .+/, `upload_max_filesize = ${settings.uploadMaxFilesize}`);
        }
        if (settings.postMaxSize) {
          content = content.replace(/post_max_size = .+/, `post_max_size = ${settings.postMaxSize}`);
        }
        if (settings.maxInputVars !== undefined) {
          content = content.replace(/max_input_vars = \d+/, `max_input_vars = ${settings.maxInputVars}`);
        }
        if (settings.dateTimezone) {
          content = content.replace(/date\.timezone = .+/, `date.timezone = ${settings.dateTimezone}`);
        }
        if (settings.displayErrors !== undefined) {
          content = content.replace(/display_errors = .+/, `display_errors = ${settings.displayErrors ? 'On' : 'Off'}`);
        }
        if (settings.logErrors !== undefined) {
          content = content.replace(/log_errors = .+/, `log_errors = ${settings.logErrors ? 'On' : 'Off'}`);
        }
        if (settings.errorReporting) {
          content = content.replace(/error_reporting = .+/, `error_reporting = ${settings.errorReporting}`);
        }
        
        // Update opcache settings
        if (settings.opcache) {
          if (settings.opcache.enabled !== undefined) {
            content = content.replace(/opcache\.enable = \d+/, `opcache.enable = ${settings.opcache.enabled ? 1 : 0}`);
          }
          if (settings.opcache.memoryConsumption !== undefined) {
            content = content.replace(/opcache\.memory_consumption = \d+/, `opcache.memory_consumption = ${settings.opcache.memoryConsumption}`);
          }
          if (settings.opcache.maxAcceleratedFiles !== undefined) {
            content = content.replace(/opcache\.max_accelerated_files = \d+/, `opcache.max_accelerated_files = ${settings.opcache.maxAcceleratedFiles}`);
          }
          if (settings.opcache.validateTimestamps !== undefined) {
            content = content.replace(/opcache\.validate_timestamps = \d+/, `opcache.validate_timestamps = ${settings.opcache.validateTimestamps ? 1 : 0}`);
          }
        }
        
        await fs.writeFile(configPath, content);
      }
    } catch (error) {
      console.error(`Failed to update php.ini for PHP ${version}:`, error);
    }
  }

  /**
   * Update FPM pool configuration
   */
  private async updateFPMPool(version: string, settings: Partial<PHPSettings>): Promise<void> {
    try {
      const configPath = `/etc/php/${version}/fpm/pool.d/www.conf`;
      if (await fs.pathExists(configPath)) {
        let content = await fs.readFile(configPath, 'utf8');
        
        // Update pool settings
        if (settings.memoryLimit) {
          content = content.replace(/php_admin_value\[memory_limit\] = .+/, `php_admin_value[memory_limit] = ${settings.memoryLimit}`);
        }
        if (settings.maxExecutionTime !== undefined) {
          content = content.replace(/php_admin_value\[max_execution_time\] = \d+/, `php_admin_value[max_execution_time] = ${settings.maxExecutionTime}`);
        }
        
        await fs.writeFile(configPath, content);
      }
    } catch (error) {
      console.error(`Failed to update FPM pool for PHP ${version}:`, error);
    }
  }

  /**
   * Get PHP version statistics
   */
  getStatistics(): {
    totalVersions: number;
    installedVersions: number;
    activeVersions: number;
    runningFPM: number;
  } {
    const versions = Array.from(this.versions.values());
    
    return {
      totalVersions: versions.length,
      installedVersions: versions.filter(v => v.installed).length,
      activeVersions: versions.filter(v => v.active).length,
      runningFPM: versions.filter(v => v.fpmStatus === 'running').length,
    };
  }
}