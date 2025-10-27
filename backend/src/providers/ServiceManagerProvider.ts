import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';

const execAsync = promisify(exec);

export interface ServiceConfig {
  name: string;
  displayName: string;
  description: string;
  category: 'web' | 'database' | 'cache' | 'monitoring' | 'security' | 'development';
  status: 'installed' | 'not_installed' | 'running' | 'stopped' | 'error';
  version?: string;
  port?: number;
  dependencies?: string[];
  configPath?: string;
  logPath?: string;
  restartCommand?: string;
  stopCommand?: string;
  startCommand?: string;
}

export interface ServiceInstallationResult {
  success: boolean;
  message: string;
  service: ServiceConfig;
  logs: string[];
  error?: string;
}

export class ServiceManagerProvider {
  private services: Map<string, ServiceConfig> = new Map();
  private installationLogs: Map<string, string[]> = new Map();

  constructor() {
    this.initializeServices();
  }

  /**
   * Initialize known services configuration
   */
  private initializeServices(): void {
    const knownServices: ServiceConfig[] = [
      // Web Services
      {
        name: 'nginx',
        displayName: 'Nginx Web Server',
        description: 'High-performance web server and reverse proxy',
        category: 'web',
        status: 'not_installed',
        port: 80,
        dependencies: [],
        configPath: '/etc/nginx/nginx.conf',
        logPath: '/var/log/nginx',
        restartCommand: 'systemctl restart nginx',
        stopCommand: 'systemctl stop nginx',
        startCommand: 'systemctl start nginx'
      },
      {
        name: 'apache2',
        displayName: 'Apache Web Server',
        description: 'Popular web server with extensive module support',
        category: 'web',
        status: 'not_installed',
        port: 80,
        dependencies: [],
        configPath: '/etc/apache2/apache2.conf',
        logPath: '/var/log/apache2',
        restartCommand: 'systemctl restart apache2',
        stopCommand: 'systemctl stop apache2',
        startCommand: 'systemctl start apache2'
      },
      {
        name: 'php8.2-fpm',
        displayName: 'PHP 8.2 FPM',
        description: 'PHP FastCGI Process Manager for PHP 8.2',
        category: 'web',
        status: 'not_installed',
        dependencies: ['nginx', 'apache2'],
        configPath: '/etc/php/8.2/fpm/php-fpm.conf',
        logPath: '/var/log/php8.2-fpm.log',
        restartCommand: 'systemctl restart php8.2-fpm',
        stopCommand: 'systemctl stop php8.2-fpm',
        startCommand: 'systemctl start php8.2-fpm'
      },
      {
        name: 'php8.1-fpm',
        displayName: 'PHP 8.1 FPM',
        description: 'PHP FastCGI Process Manager for PHP 8.1',
        category: 'web',
        status: 'not_installed',
        dependencies: ['nginx', 'apache2'],
        configPath: '/etc/php/8.1/fpm/php-fpm.conf',
        logPath: '/var/log/php8.1-fpm.log',
        restartCommand: 'systemctl restart php8.1-fpm',
        stopCommand: 'systemctl stop php8.1-fpm',
        startCommand: 'systemctl start php8.1-fpm'
      },
      {
        name: 'php8.0-fpm',
        displayName: 'PHP 8.0 FPM',
        description: 'PHP FastCGI Process Manager for PHP 8.0',
        category: 'web',
        status: 'not_installed',
        dependencies: ['nginx', 'apache2'],
        configPath: '/etc/php/8.0/fpm/php-fpm.conf',
        logPath: '/var/log/php8.0-fpm.log',
        restartCommand: 'systemctl restart php8.0-fpm',
        stopCommand: 'systemctl stop php8.0-fpm',
        startCommand: 'systemctl start php8.0-fpm'
      },

      // Database Services
      {
        name: 'mysql',
        displayName: 'MySQL Database',
        description: 'Popular open-source relational database',
        category: 'database',
        status: 'not_installed',
        port: 3306,
        dependencies: [],
        configPath: '/etc/mysql/mysql.conf.d/mysqld.cnf',
        logPath: '/var/log/mysql',
        restartCommand: 'systemctl restart mysql',
        stopCommand: 'systemctl stop mysql',
        startCommand: 'systemctl start mysql'
      },
      {
        name: 'postgresql',
        displayName: 'PostgreSQL Database',
        description: 'Advanced open-source relational database',
        category: 'database',
        status: 'not_installed',
        port: 5432,
        dependencies: [],
        configPath: '/etc/postgresql/*/main/postgresql.conf',
        logPath: '/var/log/postgresql',
        restartCommand: 'systemctl restart postgresql',
        stopCommand: 'systemctl stop postgresql',
        startCommand: 'systemctl start postgresql'
      },
      {
        name: 'redis',
        displayName: 'Redis Cache',
        description: 'In-memory data structure store',
        category: 'cache',
        status: 'not_installed',
        port: 6379,
        dependencies: [],
        configPath: '/etc/redis/redis.conf',
        logPath: '/var/log/redis',
        restartCommand: 'systemctl restart redis',
        stopCommand: 'systemctl stop redis',
        startCommand: 'systemctl start redis'
      },
      {
        name: 'memcached',
        displayName: 'Memcached',
        description: 'Distributed memory caching system',
        category: 'cache',
        status: 'not_installed',
        port: 11211,
        dependencies: [],
        configPath: '/etc/memcached.conf',
        logPath: '/var/log/memcached.log',
        restartCommand: 'systemctl restart memcached',
        stopCommand: 'systemctl stop memcached',
        startCommand: 'systemctl start memcached'
      },

      // Monitoring Services
      {
        name: 'prometheus',
        displayName: 'Prometheus',
        description: 'Monitoring system and time series database',
        category: 'monitoring',
        status: 'not_installed',
        port: 9090,
        dependencies: [],
        configPath: '/etc/prometheus/prometheus.yml',
        logPath: '/var/log/prometheus',
        restartCommand: 'systemctl restart prometheus',
        stopCommand: 'systemctl stop prometheus',
        startCommand: 'systemctl start prometheus'
      },
      {
        name: 'grafana',
        displayName: 'Grafana',
        description: 'Analytics and monitoring platform',
        category: 'monitoring',
        status: 'not_installed',
        port: 3000,
        dependencies: ['prometheus'],
        configPath: '/etc/grafana/grafana.ini',
        logPath: '/var/log/grafana',
        restartCommand: 'systemctl restart grafana-server',
        stopCommand: 'systemctl stop grafana-server',
        startCommand: 'systemctl start grafana-server'
      },
      {
        name: 'node-exporter',
        displayName: 'Node Exporter',
        description: 'Prometheus exporter for hardware metrics',
        category: 'monitoring',
        status: 'not_installed',
        port: 9100,
        dependencies: ['prometheus'],
        configPath: '/etc/node_exporter/config.yml',
        logPath: '/var/log/node_exporter',
        restartCommand: 'systemctl restart node_exporter',
        stopCommand: 'systemctl stop node_exporter',
        startCommand: 'systemctl start node_exporter'
      },

      // Security Services
      {
        name: 'fail2ban',
        displayName: 'Fail2Ban',
        description: 'Intrusion prevention software',
        category: 'security',
        status: 'not_installed',
        dependencies: [],
        configPath: '/etc/fail2ban/jail.local',
        logPath: '/var/log/fail2ban.log',
        restartCommand: 'systemctl restart fail2ban',
        stopCommand: 'systemctl stop fail2ban',
        startCommand: 'systemctl start fail2ban'
      },
      {
        name: 'ufw',
        displayName: 'UFW Firewall',
        description: 'Uncomplicated Firewall for Ubuntu',
        category: 'security',
        status: 'not_installed',
        dependencies: [],
        configPath: '/etc/ufw/ufw.conf',
        logPath: '/var/log/ufw.log',
        restartCommand: 'ufw reload',
        stopCommand: 'ufw disable',
        startCommand: 'ufw enable'
      },

      // Development Services
      {
        name: 'git',
        displayName: 'Git',
        description: 'Distributed version control system',
        category: 'development',
        status: 'not_installed',
        dependencies: [],
        configPath: '/etc/gitconfig',
        logPath: '/var/log/git',
        restartCommand: 'systemctl restart git',
        stopCommand: 'systemctl stop git',
        startCommand: 'systemctl start git'
      },
      {
        name: 'docker',
        displayName: 'Docker',
        description: 'Containerization platform',
        category: 'development',
        status: 'not_installed',
        port: 2375,
        dependencies: [],
        configPath: '/etc/docker/daemon.json',
        logPath: '/var/log/docker',
        restartCommand: 'systemctl restart docker',
        stopCommand: 'systemctl stop docker',
        startCommand: 'systemctl start docker'
      }
    ];

    for (const service of knownServices) {
      this.services.set(service.name, service);
    }
  }

  /**
   * Get all available services
   */
  async getAvailableServices(): Promise<ServiceConfig[]> {
    const services = Array.from(this.services.values());
    
    // Check actual status of each service
    for (const service of services) {
      service.status = await this.getServiceStatus(service.name);
      service.version = await this.getServiceVersion(service.name);
    }
    
    return services;
  }

  /**
   * Get service by name
   */
  getService(name: string): ServiceConfig | undefined {
    return this.services.get(name);
  }

  /**
   * Install a service
   */
  async installService(serviceName: string): Promise<ServiceInstallationResult> {
    const service = this.services.get(serviceName);
    if (!service) {
      return {
        success: false,
        message: `Service ${serviceName} not found`,
        service: service as any,
        logs: [],
        error: 'Service not found'
      };
    }

    const logs: string[] = [];
    logs.push(`Starting installation of ${service.displayName}...`);

    try {
      // Check if already installed
      const currentStatus = await this.getServiceStatus(serviceName);
      if (currentStatus === 'installed' || currentStatus === 'running') {
        return {
          success: true,
          message: `${service.displayName} is already installed`,
          service: { ...service, status: currentStatus },
          logs: [...logs, 'Service already installed']
        };
      }

      // Install dependencies first
      if (service.dependencies && service.dependencies.length > 0) {
        logs.push(`Installing dependencies: ${service.dependencies.join(', ')}`);
        for (const dep of service.dependencies) {
          const depResult = await this.installService(dep);
          if (!depResult.success) {
            throw new Error(`Failed to install dependency ${dep}: ${depResult.error}`);
          }
          logs.push(`Dependency ${dep} installed successfully`);
        }
      }

      // Install the service based on its type
      await this.performServiceInstallation(service, logs);

      // Enable and start the service
      await this.enableService(serviceName);
      await this.startService(serviceName);

      // Update service status
      service.status = await this.getServiceStatus(serviceName);
      service.version = await this.getServiceVersion(serviceName);

      logs.push(`${service.displayName} installed and started successfully`);

      return {
        success: true,
        message: `${service.displayName} installed successfully`,
        service,
        logs
      };

    } catch (error) {
      logs.push(`Installation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        success: false,
        message: `Failed to install ${service.displayName}`,
        service,
        logs,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Perform the actual service installation
   */
  private async performServiceInstallation(service: ServiceConfig, logs: string[]): Promise<void> {
    const installCommands = this.getInstallCommands(service);
    
    for (const command of installCommands) {
      logs.push(`Executing: ${command}`);
      try {
        const { stdout, stderr } = await execAsync(command);
        if (stdout) logs.push(`Output: ${stdout}`);
        if (stderr) logs.push(`Warning: ${stderr}`);
      } catch (error) {
        logs.push(`Error executing command: ${error}`);
        throw error;
      }
    }
  }

  /**
   * Get installation commands for a service
   */
  private getInstallCommands(service: ServiceConfig): string[] {
    const commands: string[] = [];

    switch (service.name) {
      case 'nginx':
        commands.push('apt-get update');
        commands.push('apt-get install -y nginx');
        break;

      case 'apache2':
        commands.push('apt-get update');
        commands.push('apt-get install -y apache2');
        break;

      case 'php8.2-fpm':
        commands.push('apt-get update');
        commands.push('apt-get install -y software-properties-common');
        commands.push('add-apt-repository -y ppa:ondrej/php');
        commands.push('apt-get update');
        commands.push('apt-get install -y php8.2-fpm php8.2-cli php8.2-common php8.2-mysql php8.2-zip php8.2-gd php8.2-mbstring php8.2-curl php8.2-xml php8.2-bcmath');
        break;

      case 'php8.1-fpm':
        commands.push('apt-get update');
        commands.push('apt-get install -y software-properties-common');
        commands.push('add-apt-repository -y ppa:ondrej/php');
        commands.push('apt-get update');
        commands.push('apt-get install -y php8.1-fpm php8.1-cli php8.1-common php8.1-mysql php8.1-zip php8.1-gd php8.1-mbstring php8.1-curl php8.1-xml php8.1-bcmath');
        break;

      case 'php8.0-fpm':
        commands.push('apt-get update');
        commands.push('apt-get install -y software-properties-common');
        commands.push('add-apt-repository -y ppa:ondrej/php');
        commands.push('apt-get update');
        commands.push('apt-get install -y php8.0-fpm php8.0-cli php8.0-common php8.0-mysql php8.0-zip php8.0-gd php8.0-mbstring php8.0-curl php8.0-xml php8.0-bcmath');
        break;

      case 'mysql':
        commands.push('apt-get update');
        commands.push('DEBIAN_FRONTEND=noninteractive apt-get install -y mysql-server');
        commands.push('mysql_secure_installation -y');
        break;

      case 'postgresql':
        commands.push('apt-get update');
        commands.push('apt-get install -y postgresql postgresql-contrib');
        break;

      case 'redis':
        commands.push('apt-get update');
        commands.push('apt-get install -y redis-server');
        break;

      case 'memcached':
        commands.push('apt-get update');
        commands.push('apt-get install -y memcached');
        break;

      case 'prometheus':
        commands.push('apt-get update');
        commands.push('apt-get install -y prometheus');
        break;

      case 'grafana':
        commands.push('apt-get update');
        commands.push('apt-get install -y apt-transport-https software-properties-common wget');
        commands.push('wget -q -O - https://packages.grafana.com/gpg.key | apt-key add -');
        commands.push('echo "deb https://packages.grafana.com/oss/deb stable main" | tee -a /etc/apt/sources.list.d/grafana.list');
        commands.push('apt-get update');
        commands.push('apt-get install -y grafana');
        break;

      case 'node-exporter':
        commands.push('apt-get update');
        commands.push('apt-get install -y prometheus-node-exporter');
        break;

      case 'fail2ban':
        commands.push('apt-get update');
        commands.push('apt-get install -y fail2ban');
        break;

      case 'ufw':
        commands.push('apt-get update');
        commands.push('apt-get install -y ufw');
        break;

      case 'git':
        commands.push('apt-get update');
        commands.push('apt-get install -y git');
        break;

      case 'docker':
        commands.push('apt-get update');
        commands.push('apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release');
        commands.push('curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg');
        commands.push('echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null');
        commands.push('apt-get update');
        commands.push('apt-get install -y docker-ce docker-ce-cli containerd.io');
        commands.push('usermod -aG docker $USER');
        break;

      default:
        throw new Error(`Installation not implemented for service: ${service.name}`);
    }

    return commands;
  }

  /**
   * Uninstall a service
   */
  async uninstallService(serviceName: string): Promise<ServiceInstallationResult> {
    const service = this.services.get(serviceName);
    if (!service) {
      return {
        success: false,
        message: `Service ${serviceName} not found`,
        service: service as any,
        logs: [],
        error: 'Service not found'
      };
    }

    const logs: string[] = [];
    logs.push(`Starting uninstallation of ${service.displayName}...`);

    try {
      // Stop the service first
      await this.stopService(serviceName);
      logs.push('Service stopped');

      // Uninstall the service
      const uninstallCommands = this.getUninstallCommands(service);
      
      for (const command of uninstallCommands) {
        logs.push(`Executing: ${command}`);
        try {
          const { stdout, stderr } = await execAsync(command);
          if (stdout) logs.push(`Output: ${stdout}`);
          if (stderr) logs.push(`Warning: ${stderr}`);
        } catch (error) {
          logs.push(`Error executing command: ${error}`);
          // Continue with uninstallation even if some commands fail
        }
      }

      // Update service status
      service.status = 'not_installed';
      service.version = undefined;

      logs.push(`${service.displayName} uninstalled successfully`);

      return {
        success: true,
        message: `${service.displayName} uninstalled successfully`,
        service,
        logs
      };

    } catch (error) {
      logs.push(`Uninstallation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        success: false,
        message: `Failed to uninstall ${service.displayName}`,
        service,
        logs,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get uninstallation commands for a service
   */
  private getUninstallCommands(service: ServiceConfig): string[] {
    const commands: string[] = [];

    switch (service.name) {
      case 'nginx':
        commands.push('systemctl stop nginx');
        commands.push('systemctl disable nginx');
        commands.push('apt-get remove -y nginx nginx-common');
        commands.push('apt-get purge -y nginx nginx-common');
        break;

      case 'apache2':
        commands.push('systemctl stop apache2');
        commands.push('systemctl disable apache2');
        commands.push('apt-get remove -y apache2 apache2-utils');
        commands.push('apt-get purge -y apache2 apache2-utils');
        break;

      case 'php8.2-fpm':
        commands.push('systemctl stop php8.2-fpm');
        commands.push('systemctl disable php8.2-fpm');
        commands.push('apt-get remove -y php8.2-fpm php8.2-cli php8.2-common php8.2-mysql php8.2-zip php8.2-gd php8.2-mbstring php8.2-curl php8.2-xml php8.2-bcmath');
        commands.push('apt-get purge -y php8.2-fpm php8.2-cli php8.2-common php8.2-mysql php8.2-zip php8.2-gd php8.2-mbstring php8.2-curl php8.2-xml php8.2-bcmath');
        break;

      case 'mysql':
        commands.push('systemctl stop mysql');
        commands.push('systemctl disable mysql');
        commands.push('apt-get remove -y mysql-server mysql-client mysql-common');
        commands.push('apt-get purge -y mysql-server mysql-client mysql-common');
        commands.push('rm -rf /var/lib/mysql');
        commands.push('rm -rf /var/log/mysql');
        commands.push('rm -rf /etc/mysql');
        break;

      case 'postgresql':
        commands.push('systemctl stop postgresql');
        commands.push('systemctl disable postgresql');
        commands.push('apt-get remove -y postgresql postgresql-contrib');
        commands.push('apt-get purge -y postgresql postgresql-contrib');
        break;

      case 'redis':
        commands.push('systemctl stop redis');
        commands.push('systemctl disable redis');
        commands.push('apt-get remove -y redis-server');
        commands.push('apt-get purge -y redis-server');
        break;

      case 'memcached':
        commands.push('systemctl stop memcached');
        commands.push('systemctl disable memcached');
        commands.push('apt-get remove -y memcached');
        commands.push('apt-get purge -y memcached');
        break;

      case 'docker':
        commands.push('systemctl stop docker');
        commands.push('systemctl disable docker');
        commands.push('apt-get remove -y docker-ce docker-ce-cli containerd.io');
        commands.push('apt-get purge -y docker-ce docker-ce-cli containerd.io');
        commands.push('rm -rf /var/lib/docker');
        commands.push('rm -rf /etc/docker');
        break;

      default:
        commands.push(`apt-get remove -y ${service.name}`);
        commands.push(`apt-get purge -y ${service.name}`);
    }

    return commands;
  }

  /**
   * Start a service
   */
  async startService(serviceName: string): Promise<boolean> {
    try {
      const service = this.services.get(serviceName);
      if (!service) return false;

      if (service.startCommand) {
        await execAsync(service.startCommand);
      } else {
        await execAsync(`systemctl start ${serviceName}`);
      }

      return true;
    } catch (error) {
      console.error(`Failed to start service ${serviceName}:`, error);
      return false;
    }
  }

  /**
   * Stop a service
   */
  async stopService(serviceName: string): Promise<boolean> {
    try {
      const service = this.services.get(serviceName);
      if (!service) return false;

      if (service.stopCommand) {
        await execAsync(service.stopCommand);
      } else {
        await execAsync(`systemctl stop ${serviceName}`);
      }

      return true;
    } catch (error) {
      console.error(`Failed to stop service ${serviceName}:`, error);
      return false;
    }
  }

  /**
   * Restart a service
   */
  async restartService(serviceName: string): Promise<boolean> {
    try {
      const service = this.services.get(serviceName);
      if (!service) return false;

      if (service.restartCommand) {
        await execAsync(service.restartCommand);
      } else {
        await execAsync(`systemctl restart ${serviceName}`);
      }

      return true;
    } catch (error) {
      console.error(`Failed to restart service ${serviceName}:`, error);
      return false;
    }
  }

  /**
   * Enable a service
   */
  async enableService(serviceName: string): Promise<boolean> {
    try {
      await execAsync(`systemctl enable ${serviceName}`);
      return true;
    } catch (error) {
      console.error(`Failed to enable service ${serviceName}:`, error);
      return false;
    }
  }

  /**
   * Disable a service
   */
  async disableService(serviceName: string): Promise<boolean> {
    try {
      await execAsync(`systemctl disable ${serviceName}`);
      return true;
    } catch (error) {
      console.error(`Failed to disable service ${serviceName}:`, error);
      return false;
    }
  }

  /**
   * Get service status
   */
  async getServiceStatus(serviceName: string): Promise<'installed' | 'not_installed' | 'running' | 'stopped' | 'error'> {
    try {
      // Check if service is installed
      const { stdout: isInstalled } = await execAsync(`systemctl list-unit-files | grep -q ${serviceName} && echo "installed" || echo "not_installed"`);
      
      if (isInstalled.trim() === 'not_installed') {
        return 'not_installed';
      }

      // Check if service is running
      const { stdout: isActive } = await execAsync(`systemctl is-active ${serviceName}`);
      
      if (isActive.trim() === 'active') {
        return 'running';
      } else if (isActive.trim() === 'inactive') {
        return 'stopped';
      } else {
        return 'error';
      }
    } catch (error) {
      return 'not_installed';
    }
  }

  /**
   * Get service version
   */
  async getServiceVersion(serviceName: string): Promise<string | undefined> {
    try {
      const { stdout } = await execAsync(`${serviceName} --version 2>/dev/null || ${serviceName} -v 2>/dev/null || echo "unknown"`);
      return stdout.trim();
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Get service logs
   */
  async getServiceLogs(serviceName: string, lines: number = 100): Promise<string[]> {
    try {
      const { stdout } = await execAsync(`journalctl -u ${serviceName} -n ${lines} --no-pager`);
      return stdout.split('\n').filter(line => line.trim());
    } catch (error) {
      return [`Failed to get logs for ${serviceName}: ${error}`];
    }
  }

  /**
   * Get service configuration
   */
  async getServiceConfig(serviceName: string): Promise<string | undefined> {
    const service = this.services.get(serviceName);
    if (!service || !service.configPath) return undefined;

    try {
      const { stdout } = await execAsync(`cat ${service.configPath}`);
      return stdout;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Update service configuration
   */
  async updateServiceConfig(serviceName: string, config: string): Promise<boolean> {
    const service = this.services.get(serviceName);
    if (!service || !service.configPath) return false;

    try {
      await fs.writeFile(service.configPath, config);
      return true;
    } catch (error) {
      console.error(`Failed to update config for ${serviceName}:`, error);
      return false;
    }
  }

  /**
   * Get installation logs for a service
   */
  getInstallationLogs(serviceName: string): string[] {
    return this.installationLogs.get(serviceName) || [];
  }

  /**
   * Get all services by category
   */
  getServicesByCategory(category: string): ServiceConfig[] {
    return Array.from(this.services.values()).filter(service => service.category === category);
  }

  /**
   * Check if service is running
   */
  async isServiceRunning(serviceName: string): Promise<boolean> {
    const status = await this.getServiceStatus(serviceName);
    return status === 'running';
  }

  /**
   * Get service health status
   */
  async getServiceHealth(serviceName: string): Promise<{
    status: string;
    uptime?: string;
    memory?: string;
    cpu?: string;
    port?: number;
  }> {
    const service = this.services.get(serviceName);
    if (!service) {
      return { status: 'not_found' };
    }

    const status = await this.getServiceStatus(serviceName);
    const health: any = { status };

    if (status === 'running') {
      try {
        // Get uptime
        const { stdout: uptime } = await execAsync(`systemctl show ${serviceName} --property=ActiveEnterTimestamp --value`);
        health.uptime = uptime.trim();

        // Get memory usage
        const { stdout: memory } = await execAsync(`systemctl show ${serviceName} --property=MemoryCurrent --value`);
        health.memory = memory.trim();

        // Get port if available
        if (service.port) {
          health.port = service.port;
        }
      } catch (error) {
        // Ignore errors for optional health metrics
      }
    }

    return health;
  }
}
