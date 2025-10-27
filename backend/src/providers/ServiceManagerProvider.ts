import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';

const execAsync = promisify(exec);

export interface Service {
  name: string;
  displayName: string;
  description: string;
  category: 'web' | 'database' | 'cache' | 'monitoring' | 'security' | 'development' | 'ftp' | 'dns';
  status: 'installed' | 'not_installed' | 'running' | 'stopped' | 'failed' | 'unknown';
  version?: string;
  port?: number;
  configPath?: string;
  logPath?: string;
  dependencies: string[];
  requirements: ServiceRequirements;
  features: string[];
  documentation?: string;
}

export interface ServiceRequirements {
  memory: number; // MB
  disk: number; // MB
  cpu: number; // percentage
  os: string[];
  architecture: string[];
}

export interface ServiceInstallation {
  service: Service;
  status: 'pending' | 'installing' | 'installed' | 'failed';
  progress: number;
  logs: string[];
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface ServiceConfiguration {
  service: string;
  config: Record<string, any>;
  lastModified: Date;
  backupPath?: string;
}

export class ServiceManagerProvider {
  private services: Map<string, Service>;
  private installations: Map<string, ServiceInstallation>;
  private configurations: Map<string, ServiceConfiguration>;
  private configPath: string;

  constructor() {
    this.services = new Map();
    this.installations = new Map();
    this.configurations = new Map();
    this.configPath = '/etc/atulya-panel/services';
    
    this.initialize();
  }

  /**
   * Initialize service manager
   */
  private async initialize(): Promise<void> {
    try {
      await fs.ensureDir(this.configPath);
      await this.loadServices();
      await this.loadConfigurations();
    } catch (error) {
      console.error('Failed to initialize service manager:', error);
    }
  }

  /**
   * Load service definitions
   */
  private async loadServices(): Promise<void> {
    const serviceDefinitions: Service[] = [
      // Web Services
      {
        name: 'nginx',
        displayName: 'Nginx Web Server',
        description: 'High-performance web server and reverse proxy',
        category: 'web',
        status: 'unknown',
        port: 80,
        configPath: '/etc/nginx',
        logPath: '/var/log/nginx',
        dependencies: [],
        requirements: {
          memory: 64,
          disk: 100,
          cpu: 10,
          os: ['ubuntu', 'debian'],
          architecture: ['x86_64', 'arm64'],
        },
        features: ['reverse_proxy', 'load_balancing', 'ssl_termination', 'caching'],
        documentation: 'https://nginx.org/en/docs/',
      },
      {
        name: 'apache2',
        displayName: 'Apache HTTP Server',
        description: 'Popular web server with extensive module support',
        category: 'web',
        status: 'unknown',
        port: 80,
        configPath: '/etc/apache2',
        logPath: '/var/log/apache2',
        dependencies: [],
        requirements: {
          memory: 128,
          disk: 200,
          cpu: 15,
          os: ['ubuntu', 'debian'],
          architecture: ['x86_64', 'arm64'],
        },
        features: ['mod_rewrite', 'mod_ssl', 'mod_php', 'virtual_hosts'],
        documentation: 'https://httpd.apache.org/docs/',
      },
      {
        name: 'php7.4-fpm',
        displayName: 'PHP 7.4 FPM',
        description: 'PHP FastCGI Process Manager for version 7.4',
        category: 'web',
        status: 'unknown',
        configPath: '/etc/php/7.4',
        logPath: '/var/log/php7.4-fpm.log',
        dependencies: ['nginx', 'apache2'],
        requirements: {
          memory: 256,
          disk: 500,
          cpu: 20,
          os: ['ubuntu', 'debian'],
          architecture: ['x86_64', 'arm64'],
        },
        features: ['opcache', 'extensions', 'sessions', 'file_upload'],
        documentation: 'https://www.php.net/manual/en/install.fpm.php',
      },
      {
        name: 'php8.0-fpm',
        displayName: 'PHP 8.0 FPM',
        description: 'PHP FastCGI Process Manager for version 8.0',
        category: 'web',
        status: 'unknown',
        configPath: '/etc/php/8.0',
        logPath: '/var/log/php8.0-fpm.log',
        dependencies: ['nginx', 'apache2'],
        requirements: {
          memory: 256,
          disk: 500,
          cpu: 20,
          os: ['ubuntu', 'debian'],
          architecture: ['x86_64', 'arm64'],
        },
        features: ['opcache', 'extensions', 'sessions', 'file_upload', 'jit'],
        documentation: 'https://www.php.net/manual/en/install.fpm.php',
      },
      {
        name: 'php8.1-fpm',
        displayName: 'PHP 8.1 FPM',
        description: 'PHP FastCGI Process Manager for version 8.1',
        category: 'web',
        status: 'unknown',
        configPath: '/etc/php/8.1',
        logPath: '/var/log/php8.1-fpm.log',
        dependencies: ['nginx', 'apache2'],
        requirements: {
          memory: 256,
          disk: 500,
          cpu: 20,
          os: ['ubuntu', 'debian'],
          architecture: ['x86_64', 'arm64'],
        },
        features: ['opcache', 'extensions', 'sessions', 'file_upload', 'jit', 'enums'],
        documentation: 'https://www.php.net/manual/en/install.fpm.php',
      },
      {
        name: 'php8.2-fpm',
        displayName: 'PHP 8.2 FPM',
        description: 'PHP FastCGI Process Manager for version 8.2',
        category: 'web',
        status: 'unknown',
        configPath: '/etc/php/8.2',
        logPath: '/var/log/php8.2-fpm.log',
        dependencies: ['nginx', 'apache2'],
        requirements: {
          memory: 256,
          disk: 500,
          cpu: 20,
          os: ['ubuntu', 'debian'],
          architecture: ['x86_64', 'arm64'],
        },
        features: ['opcache', 'extensions', 'sessions', 'file_upload', 'jit', 'enums', 'readonly_classes'],
        documentation: 'https://www.php.net/manual/en/install.fpm.php',
      },
      {
        name: 'php8.3-fpm',
        displayName: 'PHP 8.3 FPM',
        description: 'PHP FastCGI Process Manager for version 8.3',
        category: 'web',
        status: 'unknown',
        configPath: '/etc/php/8.3',
        logPath: '/var/log/php8.3-fpm.log',
        dependencies: ['nginx', 'apache2'],
        requirements: {
          memory: 256,
          disk: 500,
          cpu: 20,
          os: ['ubuntu', 'debian'],
          architecture: ['x86_64', 'arm64'],
        },
        features: ['opcache', 'extensions', 'sessions', 'file_upload', 'jit', 'enums', 'readonly_classes', 'typed_properties'],
        documentation: 'https://www.php.net/manual/en/install.fpm.php',
      },

      // Database Services
      {
        name: 'mysql',
        displayName: 'MySQL Database',
        description: 'Popular open-source relational database management system',
        category: 'database',
        status: 'unknown',
        port: 3306,
        configPath: '/etc/mysql',
        logPath: '/var/log/mysql',
        dependencies: [],
        requirements: {
          memory: 512,
          disk: 1000,
          cpu: 30,
          os: ['ubuntu', 'debian'],
          architecture: ['x86_64', 'arm64'],
        },
        features: ['replication', 'clustering', 'partitioning', 'triggers', 'stored_procedures'],
        documentation: 'https://dev.mysql.com/doc/',
      },
      {
        name: 'postgresql',
        displayName: 'PostgreSQL Database',
        description: 'Advanced open-source relational database system',
        category: 'database',
        status: 'unknown',
        port: 5432,
        configPath: '/etc/postgresql',
        logPath: '/var/log/postgresql',
        dependencies: [],
        requirements: {
          memory: 512,
          disk: 1000,
          cpu: 30,
          os: ['ubuntu', 'debian'],
          architecture: ['x86_64', 'arm64'],
        },
        features: ['json_support', 'full_text_search', 'extensions', 'replication', 'partitioning'],
        documentation: 'https://www.postgresql.org/docs/',
      },

      // Cache Services
      {
        name: 'redis',
        displayName: 'Redis Cache',
        description: 'In-memory data structure store and cache',
        category: 'cache',
        status: 'unknown',
        port: 6379,
        configPath: '/etc/redis',
        logPath: '/var/log/redis',
        dependencies: [],
        requirements: {
          memory: 128,
          disk: 100,
          cpu: 10,
          os: ['ubuntu', 'debian'],
          architecture: ['x86_64', 'arm64'],
        },
        features: ['caching', 'pub_sub', 'lua_scripting', 'clustering', 'persistence'],
        documentation: 'https://redis.io/documentation',
      },
      {
        name: 'memcached',
        displayName: 'Memcached',
        description: 'Distributed memory caching system',
        category: 'cache',
        status: 'unknown',
        port: 11211,
        configPath: '/etc/memcached.conf',
        logPath: '/var/log/memcached.log',
        dependencies: [],
        requirements: {
          memory: 128,
          disk: 50,
          cpu: 5,
          os: ['ubuntu', 'debian'],
          architecture: ['x86_64', 'arm64'],
        },
        features: ['caching', 'clustering', 'compression'],
        documentation: 'https://memcached.org/',
      },

      // Monitoring Services
      {
        name: 'prometheus',
        displayName: 'Prometheus',
        description: 'Monitoring system and time series database',
        category: 'monitoring',
        status: 'unknown',
        port: 9090,
        configPath: '/etc/prometheus',
        logPath: '/var/log/prometheus',
        dependencies: [],
        requirements: {
          memory: 256,
          disk: 500,
          cpu: 15,
          os: ['ubuntu', 'debian'],
          architecture: ['x86_64', 'arm64'],
        },
        features: ['metrics_collection', 'alerting', 'querying', 'service_discovery'],
        documentation: 'https://prometheus.io/docs/',
      },
      {
        name: 'grafana',
        displayName: 'Grafana',
        description: 'Analytics and monitoring dashboard',
        category: 'monitoring',
        status: 'unknown',
        port: 3000,
        configPath: '/etc/grafana',
        logPath: '/var/log/grafana',
        dependencies: ['prometheus'],
        requirements: {
          memory: 256,
          disk: 200,
          cpu: 10,
          os: ['ubuntu', 'debian'],
          architecture: ['x86_64', 'arm64'],
        },
        features: ['dashboards', 'alerting', 'plugins', 'user_management'],
        documentation: 'https://grafana.com/docs/',
      },
      {
        name: 'node_exporter',
        displayName: 'Node Exporter',
        description: 'Prometheus exporter for hardware and OS metrics',
        category: 'monitoring',
        status: 'unknown',
        port: 9100,
        configPath: '/etc/node_exporter',
        logPath: '/var/log/node_exporter',
        dependencies: ['prometheus'],
        requirements: {
          memory: 64,
          disk: 50,
          cpu: 5,
          os: ['ubuntu', 'debian'],
          architecture: ['x86_64', 'arm64'],
        },
        features: ['system_metrics', 'hardware_metrics', 'network_metrics'],
        documentation: 'https://github.com/prometheus/node_exporter',
      },

      // Security Services
      {
        name: 'fail2ban',
        displayName: 'Fail2Ban',
        description: 'Intrusion prevention system',
        category: 'security',
        status: 'unknown',
        configPath: '/etc/fail2ban',
        logPath: '/var/log/fail2ban.log',
        dependencies: [],
        requirements: {
          memory: 64,
          disk: 50,
          cpu: 5,
          os: ['ubuntu', 'debian'],
          architecture: ['x86_64', 'arm64'],
        },
        features: ['ip_banning', 'log_monitoring', 'jail_management'],
        documentation: 'https://www.fail2ban.org/wiki/index.php/Main_Page',
      },
      {
        name: 'ufw',
        displayName: 'UFW Firewall',
        description: 'Uncomplicated Firewall for Ubuntu',
        category: 'security',
        status: 'unknown',
        configPath: '/etc/ufw',
        logPath: '/var/log/ufw.log',
        dependencies: [],
        requirements: {
          memory: 32,
          disk: 10,
          cpu: 1,
          os: ['ubuntu', 'debian'],
          architecture: ['x86_64', 'arm64'],
        },
        features: ['port_management', 'rule_management', 'logging'],
        documentation: 'https://help.ubuntu.com/community/UFW',
      },

      // Development Services
      {
        name: 'git',
        displayName: 'Git',
        description: 'Distributed version control system',
        category: 'development',
        status: 'unknown',
        configPath: '/etc/git',
        logPath: '/var/log/git',
        dependencies: [],
        requirements: {
          memory: 32,
          disk: 100,
          cpu: 5,
          os: ['ubuntu', 'debian'],
          architecture: ['x86_64', 'arm64'],
        },
        features: ['version_control', 'branching', 'merging', 'collaboration'],
        documentation: 'https://git-scm.com/doc',
      },
      {
        name: 'docker',
        displayName: 'Docker',
        description: 'Containerization platform',
        category: 'development',
        status: 'unknown',
        port: 2376,
        configPath: '/etc/docker',
        logPath: '/var/log/docker',
        dependencies: [],
        requirements: {
          memory: 1024,
          disk: 2000,
          cpu: 50,
          os: ['ubuntu', 'debian'],
          architecture: ['x86_64', 'arm64'],
        },
        features: ['containerization', 'orchestration', 'networking', 'storage'],
        documentation: 'https://docs.docker.com/',
      },

      // FTP Services
      {
        name: 'vsftpd',
        displayName: 'vsftpd FTP Server',
        description: 'Secure FTP server implementation',
        category: 'ftp',
        status: 'unknown',
        port: 21,
        configPath: '/etc/vsftpd.conf',
        logPath: '/var/log/vsftpd.log',
        dependencies: [],
        requirements: {
          memory: 64,
          disk: 100,
          cpu: 10,
          os: ['ubuntu', 'debian'],
          architecture: ['x86_64', 'arm64'],
        },
        features: ['ftp_server', 'user_management', 'ssl_support', 'logging'],
        documentation: 'https://security.appspot.com/vsftpd.html',
      },

      // DNS Services
      {
        name: 'bind9',
        displayName: 'BIND DNS Server',
        description: 'Berkeley Internet Name Domain server',
        category: 'dns',
        status: 'unknown',
        port: 53,
        configPath: '/etc/bind',
        logPath: '/var/log/bind',
        dependencies: [],
        requirements: {
          memory: 128,
          disk: 200,
          cpu: 15,
          os: ['ubuntu', 'debian'],
          architecture: ['x86_64', 'arm64'],
        },
        features: ['dns_server', 'zone_management', 'recursion', 'caching'],
        documentation: 'https://www.isc.org/bind/',
      },
      {
        name: 'powerdns',
        displayName: 'PowerDNS',
        description: 'High-performance DNS server',
        category: 'dns',
        status: 'unknown',
        port: 53,
        configPath: '/etc/powerdns',
        logPath: '/var/log/powerdns',
        dependencies: [],
        requirements: {
          memory: 256,
          disk: 500,
          cpu: 20,
          os: ['ubuntu', 'debian'],
          architecture: ['x86_64', 'arm64'],
        },
        features: ['dns_server', 'api', 'backend_support', 'caching'],
        documentation: 'https://doc.powerdns.com/',
      },
    ];

    for (const service of serviceDefinitions) {
      this.services.set(service.name, service);
    }

    // Update service statuses
    await this.updateServiceStatuses();
  }

  /**
   * Load service configurations
   */
  private async loadConfigurations(): Promise<void> {
    try {
      const configFile = path.join(this.configPath, 'configurations.json');
      if (await fs.pathExists(configFile)) {
        const data = await fs.readFile(configFile, 'utf8');
        const configurations = JSON.parse(data);
        
        this.configurations.clear();
        for (const config of configurations) {
          this.configurations.set(config.service, config);
        }
      }
    } catch (error) {
      console.error('Failed to load service configurations:', error);
    }
  }

  /**
   * Save service configurations
   */
  private async saveConfigurations(): Promise<void> {
    try {
      const configFile = path.join(this.configPath, 'configurations.json');
      const data = Array.from(this.configurations.values());
      await fs.writeFile(configFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save service configurations:', error);
    }
  }

  /**
   * Update service statuses
   */
  async updateServiceStatuses(): Promise<void> {
    for (const [name, service] of this.services) {
      try {
        const status = await this.getServiceStatus(name);
        service.status = status;
      } catch (error) {
        service.status = 'unknown';
      }
    }
  }

  /**
   * Get service status
   */
  private async getServiceStatus(serviceName: string): Promise<Service['status']> {
    try {
      // Check if service is installed
      const { stdout } = await execAsync(`which ${serviceName}`);
      if (!stdout.trim()) {
        return 'not_installed';
      }

      // Check if service is running
      const { stdout: status } = await execAsync(`systemctl is-active ${serviceName}`);
      if (status.trim() === 'active') {
        return 'running';
      } else if (status.trim() === 'inactive') {
        return 'stopped';
      } else if (status.trim() === 'failed') {
        return 'failed';
      } else {
        return 'installed';
      }
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Install service
   */
  async installService(serviceName: string): Promise<ServiceInstallation> {
    try {
      const service = this.services.get(serviceName);
      if (!service) {
        throw new Error(`Service not found: ${serviceName}`);
      }

      const installation: ServiceInstallation = {
        service,
        status: 'pending',
        progress: 0,
        logs: [],
        startedAt: new Date(),
      };

      this.installations.set(serviceName, installation);

      // Start installation process
      this.performServiceInstallation(serviceName);

      return installation;
    } catch (error) {
      console.error('Failed to install service:', error);
      throw new Error(`Failed to install service: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Perform service installation
   */
  private async performServiceInstallation(serviceName: string): Promise<void> {
    const installation = this.installations.get(serviceName);
    if (!installation) return;

    try {
      installation.status = 'installing';
      installation.progress = 10;
      installation.logs.push('Starting installation...');

      // Get installation commands
      const commands = this.getInstallCommands(serviceName);
      
      for (let i = 0; i < commands.length; i++) {
        const command = commands[i];
        installation.logs.push(`Executing: ${command}`);
        
        try {
          await execAsync(command);
          installation.progress = 10 + ((i + 1) / commands.length) * 80;
        } catch (error) {
          installation.logs.push(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
          throw error;
        }
      }

      // Start service
      installation.logs.push('Starting service...');
      await execAsync(`systemctl enable ${serviceName}`);
      await execAsync(`systemctl start ${serviceName}`);
      
      installation.progress = 100;
      installation.status = 'installed';
      installation.completedAt = new Date();
      installation.logs.push('Installation completed successfully');

      // Update service status
      const service = this.services.get(serviceName);
      if (service) {
        service.status = 'running';
      }

    } catch (error) {
      installation.status = 'failed';
      installation.error = error instanceof Error ? error.message : 'Unknown error';
      installation.completedAt = new Date();
      installation.logs.push(`Installation failed: ${installation.error}`);
    }
  }

  /**
   * Get installation commands for service
   */
  private getInstallCommands(serviceName: string): string[] {
    const commands: Record<string, string[]> = {
      'nginx': [
        'apt-get update',
        'apt-get install -y nginx',
        'systemctl enable nginx',
        'systemctl start nginx',
      ],
      'apache2': [
        'apt-get update',
        'apt-get install -y apache2',
        'systemctl enable apache2',
        'systemctl start apache2',
      ],
      'php7.4-fpm': [
        'apt-get update',
        'apt-get install -y php7.4-fpm php7.4-cli php7.4-common php7.4-mysql php7.4-zip php7.4-gd php7.4-mbstring php7.4-curl php7.4-xml php7.4-bcmath php7.4-json',
        'systemctl enable php7.4-fpm',
        'systemctl start php7.4-fpm',
      ],
      'php8.0-fpm': [
        'apt-get update',
        'apt-get install -y php8.0-fpm php8.0-cli php8.0-common php8.0-mysql php8.0-zip php8.0-gd php8.0-mbstring php8.0-curl php8.0-xml php8.0-bcmath php8.0-json',
        'systemctl enable php8.0-fpm',
        'systemctl start php8.0-fpm',
      ],
      'php8.1-fpm': [
        'apt-get update',
        'apt-get install -y php8.1-fpm php8.1-cli php8.1-common php8.1-mysql php8.1-zip php8.1-gd php8.1-mbstring php8.1-curl php8.1-xml php8.1-bcmath php8.1-json',
        'systemctl enable php8.1-fpm',
        'systemctl start php8.1-fpm',
      ],
      'php8.2-fpm': [
        'apt-get update',
        'apt-get install -y php8.2-fpm php8.2-cli php8.2-common php8.2-mysql php8.2-zip php8.2-gd php8.2-mbstring php8.2-curl php8.2-xml php8.2-bcmath php8.2-json',
        'systemctl enable php8.2-fpm',
        'systemctl start php8.2-fpm',
      ],
      'php8.3-fpm': [
        'apt-get update',
        'apt-get install -y php8.3-fpm php8.3-cli php8.3-common php8.3-mysql php8.3-zip php8.3-gd php8.3-mbstring php8.3-curl php8.3-xml php8.3-bcmath php8.3-json',
        'systemctl enable php8.3-fpm',
        'systemctl start php8.3-fpm',
      ],
      'mysql': [
        'apt-get update',
        'apt-get install -y mysql-server',
        'systemctl enable mysql',
        'systemctl start mysql',
      ],
      'postgresql': [
        'apt-get update',
        'apt-get install -y postgresql postgresql-contrib',
        'systemctl enable postgresql',
        'systemctl start postgresql',
      ],
      'redis': [
        'apt-get update',
        'apt-get install -y redis-server',
        'systemctl enable redis-server',
        'systemctl start redis-server',
      ],
      'memcached': [
        'apt-get update',
        'apt-get install -y memcached',
        'systemctl enable memcached',
        'systemctl start memcached',
      ],
      'prometheus': [
        'apt-get update',
        'apt-get install -y prometheus',
        'systemctl enable prometheus',
        'systemctl start prometheus',
      ],
      'grafana': [
        'apt-get update',
        'apt-get install -y grafana',
        'systemctl enable grafana-server',
        'systemctl start grafana-server',
      ],
      'node_exporter': [
        'apt-get update',
        'apt-get install -y prometheus-node-exporter',
        'systemctl enable prometheus-node-exporter',
        'systemctl start prometheus-node-exporter',
      ],
      'fail2ban': [
        'apt-get update',
        'apt-get install -y fail2ban',
        'systemctl enable fail2ban',
        'systemctl start fail2ban',
      ],
      'ufw': [
        'apt-get update',
        'apt-get install -y ufw',
        'ufw --force enable',
      ],
      'git': [
        'apt-get update',
        'apt-get install -y git',
      ],
      'docker': [
        'apt-get update',
        'apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release',
        'curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg',
        'echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null',
        'apt-get update',
        'apt-get install -y docker-ce docker-ce-cli containerd.io',
        'systemctl enable docker',
        'systemctl start docker',
      ],
      'vsftpd': [
        'apt-get update',
        'apt-get install -y vsftpd',
        'systemctl enable vsftpd',
        'systemctl start vsftpd',
      ],
      'bind9': [
        'apt-get update',
        'apt-get install -y bind9 bind9utils bind9-doc',
        'systemctl enable bind9',
        'systemctl start bind9',
      ],
      'powerdns': [
        'apt-get update',
        'apt-get install -y pdns-server pdns-backend-sqlite3',
        'systemctl enable pdns',
        'systemctl start pdns',
      ],
    };

    return commands[serviceName] || [];
  }

  /**
   * Uninstall service
   */
  async uninstallService(serviceName: string): Promise<void> {
    try {
      const service = this.services.get(serviceName);
      if (!service) {
        throw new Error(`Service not found: ${serviceName}`);
      }

      // Stop service
      await execAsync(`systemctl stop ${serviceName}`);
      await execAsync(`systemctl disable ${serviceName}`);

      // Get uninstall commands
      const commands = this.getUninstallCommands(serviceName);
      
      for (const command of commands) {
        await execAsync(command);
      }

      // Update service status
      service.status = 'not_installed';

    } catch (error) {
      console.error('Failed to uninstall service:', error);
      throw new Error(`Failed to uninstall service: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get uninstall commands for service
   */
  private getUninstallCommands(serviceName: string): string[] {
    const commands: Record<string, string[]> = {
      'nginx': ['apt-get remove -y nginx nginx-common'],
      'apache2': ['apt-get remove -y apache2 apache2-utils'],
      'php7.4-fpm': ['apt-get remove -y php7.4*'],
      'php8.0-fpm': ['apt-get remove -y php8.0*'],
      'php8.1-fpm': ['apt-get remove -y php8.1*'],
      'php8.2-fpm': ['apt-get remove -y php8.2*'],
      'php8.3-fpm': ['apt-get remove -y php8.3*'],
      'mysql': ['apt-get remove -y mysql-server mysql-client'],
      'postgresql': ['apt-get remove -y postgresql postgresql-contrib'],
      'redis': ['apt-get remove -y redis-server'],
      'memcached': ['apt-get remove -y memcached'],
      'prometheus': ['apt-get remove -y prometheus'],
      'grafana': ['apt-get remove -y grafana'],
      'node_exporter': ['apt-get remove -y prometheus-node-exporter'],
      'fail2ban': ['apt-get remove -y fail2ban'],
      'ufw': ['apt-get remove -y ufw'],
      'git': ['apt-get remove -y git'],
      'docker': ['apt-get remove -y docker-ce docker-ce-cli containerd.io'],
      'vsftpd': ['apt-get remove -y vsftpd'],
      'bind9': ['apt-get remove -y bind9 bind9utils bind9-doc'],
      'powerdns': ['apt-get remove -y pdns-server pdns-backend-sqlite3'],
    };

    return commands[serviceName] || [];
  }

  /**
   * Start service
   */
  async startService(serviceName: string): Promise<void> {
    try {
      await execAsync(`systemctl start ${serviceName}`);
      
      const service = this.services.get(serviceName);
      if (service) {
        service.status = 'running';
      }
    } catch (error) {
      console.error('Failed to start service:', error);
      throw new Error(`Failed to start service: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stop service
   */
  async stopService(serviceName: string): Promise<void> {
    try {
      await execAsync(`systemctl stop ${serviceName}`);
      
      const service = this.services.get(serviceName);
      if (service) {
        service.status = 'stopped';
      }
    } catch (error) {
      console.error('Failed to stop service:', error);
      throw new Error(`Failed to stop service: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Restart service
   */
  async restartService(serviceName: string): Promise<void> {
    try {
      await execAsync(`systemctl restart ${serviceName}`);
      
      const service = this.services.get(serviceName);
      if (service) {
        service.status = 'running';
      }
    } catch (error) {
      console.error('Failed to restart service:', error);
      throw new Error(`Failed to restart service: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get service configuration
   */
  getServiceConfiguration(serviceName: string): ServiceConfiguration | undefined {
    return this.configurations.get(serviceName);
  }

  /**
   * Update service configuration
   */
  async updateServiceConfiguration(serviceName: string, config: Record<string, any>): Promise<void> {
    try {
      const service = this.services.get(serviceName);
      if (!service) {
        throw new Error(`Service not found: ${serviceName}`);
      }

      const configuration: ServiceConfiguration = {
        service: serviceName,
        config,
        lastModified: new Date(),
        backupPath: path.join(this.configPath, 'backups', `${serviceName}_${Date.now()}.json`),
      };

      // Create backup of current configuration
      const currentConfig = this.configurations.get(serviceName);
      if (currentConfig) {
        await fs.ensureDir(path.dirname(configuration.backupPath!));
        await fs.writeFile(configuration.backupPath!, JSON.stringify(currentConfig, null, 2));
      }

      this.configurations.set(serviceName, configuration);
      await this.saveConfigurations();
    } catch (error) {
      console.error('Failed to update service configuration:', error);
      throw new Error(`Failed to update service configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all services
   */
  getServices(): Service[] {
    return Array.from(this.services.values());
  }

  /**
   * Get service by name
   */
  getService(name: string): Service | undefined {
    return this.services.get(name);
  }

  /**
   * Get services by category
   */
  getServicesByCategory(category: Service['category']): Service[] {
    return Array.from(this.services.values()).filter(service => service.category === category);
  }

  /**
   * Get installation status
   */
  getInstallationStatus(serviceName: string): ServiceInstallation | undefined {
    return this.installations.get(serviceName);
  }

  /**
   * Get service statistics
   */
  getStatistics(): {
    totalServices: number;
    installedServices: number;
    runningServices: number;
    stoppedServices: number;
    failedServices: number;
    byCategory: Record<string, number>;
  } {
    const services = Array.from(this.services.values());
    const byCategory: Record<string, number> = {};

    for (const service of services) {
      byCategory[service.category] = (byCategory[service.category] || 0) + 1;
    }

    return {
      totalServices: services.length,
      installedServices: services.filter(s => s.status === 'installed' || s.status === 'running' || s.status === 'stopped').length,
      runningServices: services.filter(s => s.status === 'running').length,
      stoppedServices: services.filter(s => s.status === 'stopped').length,
      failedServices: services.filter(s => s.status === 'failed').length,
      byCategory,
    };
  }
}