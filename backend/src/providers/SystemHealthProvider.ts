import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';

const execAsync = promisify(exec);

export interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical' | 'unknown';
  score: number; // 0-100
  timestamp: Date;
  services: ServiceHealth[];
  resources: ResourceHealth;
  security: SecurityHealth;
  performance: PerformanceHealth;
  alerts: HealthAlert[];
  recommendations: HealthRecommendation[];
}

export interface ServiceHealth {
  name: string;
  status: 'running' | 'stopped' | 'failed' | 'unknown';
  uptime: number; // seconds
  lastCheck: Date;
  issues: string[];
  dependencies: string[];
  restartCount: number;
  memoryUsage: number; // MB
  cpuUsage: number; // percentage
}

export interface ResourceHealth {
  cpu: {
    usage: number; // percentage
    loadAverage: number[];
    cores: number;
    temperature?: number; // Celsius
    frequency?: number; // MHz
  };
  memory: {
    total: number; // MB
    used: number; // MB
    free: number; // MB
    available: number; // MB
    swapTotal: number; // MB
    swapUsed: number; // MB
    swapFree: number; // MB
  };
  disk: {
    total: number; // MB
    used: number; // MB
    free: number; // MB
    usage: number; // percentage
    inodes: {
      total: number;
      used: number;
      free: number;
      usage: number; // percentage
    };
  }[];
  network: {
    interfaces: NetworkInterfaceHealth[];
    connections: number;
    bandwidth: {
      rx: number; // bytes/s
      tx: number; // bytes/s
    };
  };
}

export interface NetworkInterfaceHealth {
  name: string;
  status: 'up' | 'down' | 'unknown';
  ip: string;
  mac: string;
  speed: number; // Mbps
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
  errors: number;
  drops: number;
}

export interface SecurityHealth {
  score: number; // 0-100
  firewall: {
    enabled: boolean;
    rules: number;
    blockedConnections: number;
  };
  fail2ban: {
    enabled: boolean;
    activeJails: number;
    bannedIPs: number;
  };
  ssl: {
    certificates: number;
    expired: number;
    expiringSoon: number; // within 30 days
  };
  updates: {
    available: number;
    security: number;
    lastUpdate: Date;
  };
  vulnerabilities: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface PerformanceHealth {
  score: number; // 0-100
  responseTime: number; // ms
  throughput: number; // requests/s
  errorRate: number; // percentage
  cacheHitRate: number; // percentage
  database: {
    connections: number;
    maxConnections: number;
    queryTime: number; // ms
    slowQueries: number;
  };
  webServer: {
    activeConnections: number;
    requestsPerSecond: number;
    bytesPerSecond: number;
  };
}

export interface HealthAlert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  category: 'service' | 'resource' | 'security' | 'performance';
  title: string;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  resolved: boolean;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
}

export interface HealthRecommendation {
  id: string;
  category: 'performance' | 'security' | 'reliability' | 'maintenance';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed';
  createdAt: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
}

export class SystemHealthProvider {
  private health: SystemHealth | null = null;
  private alerts: Map<string, HealthAlert>;
  private recommendations: Map<string, HealthRecommendation>;
  private configPath: string;
  private thresholds: {
    cpu: { warning: number; critical: number };
    memory: { warning: number; critical: number };
    disk: { warning: number; critical: number };
    responseTime: { warning: number; critical: number };
    errorRate: { warning: number; critical: number };
  };

  constructor() {
    this.alerts = new Map();
    this.recommendations = new Map();
    this.configPath = '/etc/atulya-panel/health';
    this.thresholds = {
      cpu: { warning: 70, critical: 90 },
      memory: { warning: 80, critical: 95 },
      disk: { warning: 80, critical: 95 },
      responseTime: { warning: 1000, critical: 5000 },
      errorRate: { warning: 5, critical: 10 },
    };
    
    this.initialize();
  }

  /**
   * Initialize system health provider
   */
  private async initialize(): Promise<void> {
    try {
      await fs.ensureDir(this.configPath);
      await this.loadAlerts();
      await this.loadRecommendations();
      await this.loadThresholds();
    } catch (error) {
      console.error('Failed to initialize system health provider:', error);
    }
  }

  /**
   * Load health alerts
   */
  private async loadAlerts(): Promise<void> {
    try {
      const alertsFile = path.join(this.configPath, 'alerts.json');
      if (await fs.pathExists(alertsFile)) {
        const data = await fs.readFile(alertsFile, 'utf8');
        const alerts = JSON.parse(data);
        
        this.alerts.clear();
        for (const alert of alerts) {
          this.alerts.set(alert.id, alert);
        }
      }
    } catch (error) {
      console.error('Failed to load health alerts:', error);
    }
  }

  /**
   * Save health alerts
   */
  private async saveAlerts(): Promise<void> {
    try {
      const alertsFile = path.join(this.configPath, 'alerts.json');
      const data = Array.from(this.alerts.values());
      await fs.writeFile(alertsFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save health alerts:', error);
    }
  }

  /**
   * Load health recommendations
   */
  private async loadRecommendations(): Promise<void> {
    try {
      const recommendationsFile = path.join(this.configPath, 'recommendations.json');
      if (await fs.pathExists(recommendationsFile)) {
        const data = await fs.readFile(recommendationsFile, 'utf8');
        const recommendations = JSON.parse(data);
        
        this.recommendations.clear();
        for (const recommendation of recommendations) {
          this.recommendations.set(recommendation.id, recommendation);
        }
      } else {
        // Create default recommendations
        await this.createDefaultRecommendations();
      }
    } catch (error) {
      console.error('Failed to load health recommendations:', error);
    }
  }

  /**
   * Create default recommendations
   */
  private async createDefaultRecommendations(): Promise<void> {
    const defaultRecommendations: HealthRecommendation[] = [
      {
        id: 'enable_firewall',
        category: 'security',
        priority: 'high',
        title: 'Enable Firewall',
        description: 'Enable UFW firewall to protect against unauthorized access',
        impact: 'High security improvement',
        effort: 'low',
        status: 'pending',
        createdAt: new Date(),
      },
      {
        id: 'enable_fail2ban',
        category: 'security',
        priority: 'high',
        title: 'Enable Fail2Ban',
        description: 'Enable Fail2Ban to protect against brute force attacks',
        impact: 'High security improvement',
        effort: 'low',
        status: 'pending',
        createdAt: new Date(),
      },
      {
        id: 'setup_ssl',
        category: 'security',
        priority: 'medium',
        title: 'Setup SSL Certificates',
        description: 'Configure SSL certificates for all domains',
        impact: 'Medium security improvement',
        effort: 'medium',
        status: 'pending',
        createdAt: new Date(),
      },
      {
        id: 'enable_backups',
        category: 'reliability',
        priority: 'high',
        title: 'Enable Automated Backups',
        description: 'Set up automated backup system for data protection',
        impact: 'High reliability improvement',
        effort: 'medium',
        status: 'pending',
        createdAt: new Date(),
      },
      {
        id: 'monitor_resources',
        category: 'performance',
        priority: 'medium',
        title: 'Setup Resource Monitoring',
        description: 'Configure comprehensive resource monitoring and alerting',
        impact: 'Medium performance improvement',
        effort: 'medium',
        status: 'pending',
        createdAt: new Date(),
      },
    ];

    for (const recommendation of defaultRecommendations) {
      this.recommendations.set(recommendation.id, recommendation);
    }

    await this.saveRecommendations();
  }

  /**
   * Save health recommendations
   */
  private async saveRecommendations(): Promise<void> {
    try {
      const recommendationsFile = path.join(this.configPath, 'recommendations.json');
      const data = Array.from(this.recommendations.values());
      await fs.writeFile(recommendationsFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save health recommendations:', error);
    }
  }

  /**
   * Load thresholds
   */
  private async loadThresholds(): Promise<void> {
    try {
      const thresholdsFile = path.join(this.configPath, 'thresholds.json');
      if (await fs.pathExists(thresholdsFile)) {
        const data = await fs.readFile(thresholdsFile, 'utf8');
        this.thresholds = { ...this.thresholds, ...JSON.parse(data) };
      }
    } catch (error) {
      console.error('Failed to load thresholds:', error);
    }
  }

  /**
   * Save thresholds
   */
  private async saveThresholds(): Promise<void> {
    try {
      const thresholdsFile = path.join(this.configPath, 'thresholds.json');
      await fs.writeFile(thresholdsFile, JSON.stringify(this.thresholds, null, 2));
    } catch (error) {
      console.error('Failed to save thresholds:', error);
    }
  }

  /**
   * Get system health
   */
  async getSystemHealth(): Promise<SystemHealth> {
    try {
      const services = await this.getServicesHealth();
      const resources = await this.getResourcesHealth();
      const security = await this.getSecurityHealth();
      const performance = await this.getPerformanceHealth();
      const alerts = Array.from(this.alerts.values());
      const recommendations = Array.from(this.recommendations.values());

      // Calculate overall health score
      const score = this.calculateOverallScore(services, resources, security, performance);
      const overall = this.getOverallStatus(score);

      this.health = {
        overall,
        score,
        timestamp: new Date(),
        services,
        resources,
        security,
        performance,
        alerts,
        recommendations,
      };

      return this.health;
    } catch (error) {
      console.error('Failed to get system health:', error);
      throw new Error(`Failed to get system health: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get services health
   */
  private async getServicesHealth(): Promise<ServiceHealth[]> {
    try {
      const services = [
        'nginx', 'apache2', 'mysql', 'postgresql', 'redis', 'memcached',
        'php7.4-fpm', 'php8.0-fpm', 'php8.1-fpm', 'php8.2-fpm', 'php8.3-fpm',
        'prometheus', 'grafana', 'node_exporter', 'fail2ban', 'ufw',
        'vsftpd', 'bind9', 'powerdns', 'ssh', 'cron'
      ];

      const servicesHealth: ServiceHealth[] = [];

      for (const service of services) {
        try {
          const status = await this.getServiceStatus(service);
          const uptime = await this.getServiceUptime(service);
          const memoryUsage = await this.getServiceMemoryUsage(service);
          const cpuUsage = await this.getServiceCpuUsage(service);
          const restartCount = await this.getServiceRestartCount(service);

          servicesHealth.push({
            name: service,
            status: status.status,
            uptime,
            lastCheck: new Date(),
            issues: status.issues,
            dependencies: status.dependencies,
            restartCount,
            memoryUsage,
            cpuUsage,
          });
        } catch (error) {
          servicesHealth.push({
            name: service,
            status: 'unknown',
            uptime: 0,
            lastCheck: new Date(),
            issues: ['Failed to check service status'],
            dependencies: [],
            restartCount: 0,
            memoryUsage: 0,
            cpuUsage: 0,
          });
        }
      }

      return servicesHealth;
    } catch (error) {
      console.error('Failed to get services health:', error);
      return [];
    }
  }

  /**
   * Get service status
   */
  private async getServiceStatus(service: string): Promise<{
    status: ServiceHealth['status'];
    issues: string[];
    dependencies: string[];
  }> {
    try {
      const { stdout } = await execAsync(`systemctl is-active ${service}`);
      const status = stdout.trim() as ServiceHealth['status'];
      
      const issues: string[] = [];
      const dependencies: string[] = [];

      if (status !== 'running') {
        issues.push(`Service is ${status}`);
      }

      // Check for failed dependencies
      try {
        const { stdout: deps } = await execAsync(`systemctl list-dependencies ${service} --failed`);
        if (deps.includes('failed')) {
          issues.push('Failed dependencies detected');
        }
      } catch (error) {
        // Ignore dependency check errors
      }

      return { status, issues, dependencies };
    } catch (error) {
      return {
        status: 'unknown',
        issues: ['Failed to check service status'],
        dependencies: [],
      };
    }
  }

  /**
   * Get service uptime
   */
  private async getServiceUptime(service: string): Promise<number> {
    try {
      const { stdout } = await execAsync(`systemctl show ${service} --property=ActiveEnterTimestamp --value`);
      const startTime = new Date(stdout.trim());
      return Math.floor((Date.now() - startTime.getTime()) / 1000);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get service memory usage
   */
  private async getServiceMemoryUsage(service: string): Promise<number> {
    try {
      const { stdout } = await execAsync(`systemctl show ${service} --property=MemoryCurrent --value`);
      const memoryBytes = parseInt(stdout.trim());
      return Math.round(memoryBytes / 1024 / 1024); // Convert to MB
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get service CPU usage
   */
  private async getServiceCpuUsage(service: string): Promise<number> {
    try {
      const { stdout } = await execAsync(`ps -o %cpu -p $(systemctl show ${service} --property=MainPID --value) --no-headers`);
      return parseFloat(stdout.trim()) || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get service restart count
   */
  private async getServiceRestartCount(service: string): Promise<number> {
    try {
      const { stdout } = await execAsync(`systemctl show ${service} --property=NRestarts --value`);
      return parseInt(stdout.trim()) || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get resources health
   */
  private async getResourcesHealth(): Promise<ResourceHealth> {
    try {
      const cpu = await this.getCpuHealth();
      const memory = await this.getMemoryHealth();
      const disk = await this.getDiskHealth();
      const network = await this.getNetworkHealth();

      return { cpu, memory, disk, network };
    } catch (error) {
      console.error('Failed to get resources health:', error);
      throw error;
    }
  }

  /**
   * Get CPU health
   */
  private async getCpuHealth(): Promise<ResourceHealth['cpu']> {
    try {
      // CPU usage
      const { stdout: usage } = await execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | sed 's/%us,//'");
      const cpuUsage = parseFloat(usage.trim()) || 0;

      // Load average
      const { stdout: load } = await execAsync("uptime | awk -F'load average:' '{print $2}' | awk '{print $1,$2,$3}'");
      const loadAverage = load.trim().split(' ').map(parseFloat);

      // CPU cores
      const { stdout: cores } = await execAsync("nproc");
      const cpuCores = parseInt(cores.trim()) || 1;

      // CPU temperature (if available)
      let temperature: number | undefined;
      try {
        const { stdout: temp } = await execAsync("cat /sys/class/thermal/thermal_zone*/temp 2>/dev/null | head -1");
        temperature = parseInt(temp.trim()) / 1000; // Convert to Celsius
      } catch (error) {
        // Temperature not available
      }

      // CPU frequency (if available)
      let frequency: number | undefined;
      try {
        const { stdout: freq } = await execAsync("cat /proc/cpuinfo | grep 'cpu MHz' | head -1 | awk '{print $4}'");
        frequency = parseFloat(freq.trim());
      } catch (error) {
        // Frequency not available
      }

      return {
        usage: cpuUsage,
        loadAverage,
        cores: cpuCores,
        temperature,
        frequency,
      };
    } catch (error) {
      console.error('Failed to get CPU health:', error);
      return {
        usage: 0,
        loadAverage: [0, 0, 0],
        cores: 1,
      };
    }
  }

  /**
   * Get memory health
   */
  private async getMemoryHealth(): Promise<ResourceHealth['memory']> {
    try {
      const { stdout } = await execAsync("free -m");
      const lines = stdout.split('\n');
      const memLine = lines[1].split(/\s+/);
      const swapLine = lines[2].split(/\s+/);

      return {
        total: parseInt(memLine[1]) || 0,
        used: parseInt(memLine[2]) || 0,
        free: parseInt(memLine[3]) || 0,
        available: parseInt(memLine[6]) || 0,
        swapTotal: parseInt(swapLine[1]) || 0,
        swapUsed: parseInt(swapLine[2]) || 0,
        swapFree: parseInt(swapLine[3]) || 0,
      };
    } catch (error) {
      console.error('Failed to get memory health:', error);
      return {
        total: 0,
        used: 0,
        free: 0,
        available: 0,
        swapTotal: 0,
        swapUsed: 0,
        swapFree: 0,
      };
    }
  }

  /**
   * Get disk health
   */
  private async getDiskHealth(): Promise<ResourceHealth['disk']> {
    try {
      const { stdout } = await execAsync("df -m");
      const lines = stdout.split('\n').slice(1); // Skip header
      
      const disks = lines
        .filter(line => line.trim())
        .map(line => {
          const parts = line.split(/\s+/);
          const total = parseInt(parts[1]) || 0;
          const used = parseInt(parts[2]) || 0;
          const free = parseInt(parts[3]) || 0;
          const usage = total > 0 ? (used / total) * 100 : 0;

          return {
            total,
            used,
            free,
            usage,
            inodes: {
              total: 0,
              used: 0,
              free: 0,
              usage: 0,
            },
          };
        });

      // Get inode usage for each disk
      for (const disk of disks) {
        try {
          const { stdout: inodes } = await execAsync(`df -i ${disk.total > 0 ? '/dev/sda1' : ''} 2>/dev/null`);
          const inodeLine = inodes.split('\n')[1];
          if (inodeLine) {
            const parts = inodeLine.split(/\s+/);
            disk.inodes = {
              total: parseInt(parts[1]) || 0,
              used: parseInt(parts[2]) || 0,
              free: parseInt(parts[3]) || 0,
              usage: parseInt(parts[4]) || 0,
            };
          }
        } catch (error) {
          // Inode info not available
        }
      }

      return disks;
    } catch (error) {
      console.error('Failed to get disk health:', error);
      return [];
    }
  }

  /**
   * Get network health
   */
  private async getNetworkHealth(): Promise<ResourceHealth['network']> {
    try {
      const interfaces = await this.getNetworkInterfaces();
      const connections = await this.getNetworkConnections();
      const bandwidth = await this.getNetworkBandwidth();

      return {
        interfaces,
        connections,
        bandwidth,
      };
    } catch (error) {
      console.error('Failed to get network health:', error);
      return {
        interfaces: [],
        connections: 0,
        bandwidth: { rx: 0, tx: 0 },
      };
    }
  }

  /**
   * Get network interfaces
   */
  private async getNetworkInterfaces(): Promise<NetworkInterfaceHealth[]> {
    try {
      const { stdout } = await execAsync("ip -s link show");
      const interfaces: NetworkInterfaceHealth[] = [];
      
      // Parse network interface information
      // This is a simplified implementation
      const lines = stdout.split('\n');
      let currentInterface: Partial<NetworkInterfaceHealth> = {};
      
      for (const line of lines) {
        if (line.includes(':')) {
          if (currentInterface.name) {
            interfaces.push(currentInterface as NetworkInterfaceHealth);
          }
          currentInterface = {
            name: line.split(':')[1].trim(),
            status: 'up',
            ip: '',
            mac: '',
            speed: 0,
            rxBytes: 0,
            txBytes: 0,
            rxPackets: 0,
            txPackets: 0,
            errors: 0,
            drops: 0,
          };
        }
      }
      
      if (currentInterface.name) {
        interfaces.push(currentInterface as NetworkInterfaceHealth);
      }

      return interfaces;
    } catch (error) {
      console.error('Failed to get network interfaces:', error);
      return [];
    }
  }

  /**
   * Get network connections
   */
  private async getNetworkConnections(): Promise<number> {
    try {
      const { stdout } = await execAsync("netstat -an | grep -c ESTABLISHED");
      return parseInt(stdout.trim()) || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get network bandwidth
   */
  private async getNetworkBandwidth(): Promise<{ rx: number; tx: number }> {
    try {
      const { stdout } = await execAsync("cat /proc/net/dev");
      const lines = stdout.split('\n').slice(2); // Skip header lines
      
      let totalRx = 0;
      let totalTx = 0;
      
      for (const line of lines) {
        if (line.trim()) {
          const parts = line.split(':');
          if (parts.length > 1) {
            const stats = parts[1].trim().split(/\s+/);
            totalRx += parseInt(stats[0]) || 0;
            totalTx += parseInt(stats[8]) || 0;
          }
        }
      }
      
      return { rx: totalRx, tx: totalTx };
    } catch (error) {
      return { rx: 0, tx: 0 };
    }
  }

  /**
   * Get security health
   */
  private async getSecurityHealth(): Promise<SecurityHealth> {
    try {
      const firewall = await this.getFirewallHealth();
      const fail2ban = await this.getFail2banHealth();
      const ssl = await this.getSSLHealth();
      const updates = await this.getUpdatesHealth();
      const vulnerabilities = await this.getVulnerabilitiesHealth();

      const score = this.calculateSecurityScore(firewall, fail2ban, ssl, updates, vulnerabilities);

      return {
        score,
        firewall,
        fail2ban,
        ssl,
        updates,
        vulnerabilities,
      };
    } catch (error) {
      console.error('Failed to get security health:', error);
      return {
        score: 0,
        firewall: { enabled: false, rules: 0, blockedConnections: 0 },
        fail2ban: { enabled: false, activeJails: 0, bannedIPs: 0 },
        ssl: { certificates: 0, expired: 0, expiringSoon: 0 },
        updates: { available: 0, security: 0, lastUpdate: new Date() },
        vulnerabilities: { critical: 0, high: 0, medium: 0, low: 0 },
      };
    }
  }

  /**
   * Get firewall health
   */
  private async getFirewallHealth(): Promise<SecurityHealth['firewall']> {
    try {
      const { stdout } = await execAsync("ufw status | grep -c '^\\['");
      const rules = parseInt(stdout.trim()) || 0;
      
      const { stdout: status } = await execAsync("ufw status | head -1");
      const enabled = status.includes('active');
      
      const { stdout: blocked } = await execAsync("ufw status | grep -c 'DENY'");
      const blockedConnections = parseInt(blocked.trim()) || 0;

      return { enabled, rules, blockedConnections };
    } catch (error) {
      return { enabled: false, rules: 0, blockedConnections: 0 };
    }
  }

  /**
   * Get Fail2Ban health
   */
  private async getFail2banHealth(): Promise<SecurityHealth['fail2ban']> {
    try {
      const { stdout: status } = await execAsync("systemctl is-active fail2ban");
      const enabled = status.trim() === 'active';
      
      const { stdout: jails } = await execAsync("fail2ban-client status | grep -c 'Jail list:'");
      const activeJails = parseInt(jails.trim()) || 0;
      
      const { stdout: banned } = await execAsync("fail2ban-client status | grep -c 'Banned IP list:'");
      const bannedIPs = parseInt(banned.trim()) || 0;

      return { enabled, activeJails, bannedIPs };
    } catch (error) {
      return { enabled: false, activeJails: 0, bannedIPs: 0 };
    }
  }

  /**
   * Get SSL health
   */
  private async getSSLHealth(): Promise<SecurityHealth['ssl']> {
    try {
      const { stdout } = await execAsync("find /etc/letsencrypt/live -name '*.pem' 2>/dev/null | wc -l");
      const certificates = parseInt(stdout.trim()) || 0;
      
      let expired = 0;
      let expiringSoon = 0;
      
      try {
        const { stdout: certs } = await execAsync("find /etc/letsencrypt/live -name 'cert.pem' 2>/dev/null");
        const certFiles = certs.trim().split('\n').filter(f => f);
        
        for (const certFile of certFiles) {
          try {
            const { stdout: expiry } = await execAsync(`openssl x509 -in ${certFile} -noout -dates | grep notAfter | cut -d= -f2`);
            const expiryDate = new Date(expiry.trim());
            const now = new Date();
            const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysUntilExpiry < 0) {
              expired++;
            } else if (daysUntilExpiry <= 30) {
              expiringSoon++;
            }
          } catch (error) {
            // Skip invalid certificates
          }
        }
      } catch (error) {
        // No certificates found
      }

      return { certificates, expired, expiringSoon };
    } catch (error) {
      return { certificates: 0, expired: 0, expiringSoon: 0 };
    }
  }

  /**
   * Get updates health
   */
  private async getUpdatesHealth(): Promise<SecurityHealth['updates']> {
    try {
      const { stdout } = await execAsync("apt list --upgradable 2>/dev/null | wc -l");
      const available = parseInt(stdout.trim()) || 0;
      
      const { stdout: security } = await execAsync("apt list --upgradable 2>/dev/null | grep -c security");
      const securityUpdates = parseInt(security.trim()) || 0;
      
      const { stdout: lastUpdate } = await execAsync("stat -c %Y /var/lib/apt/periodic/update-success-stamp 2>/dev/null || echo 0");
      const lastUpdateTime = new Date(parseInt(lastUpdate.trim()) * 1000);

      return { available, security: securityUpdates, lastUpdate: lastUpdateTime };
    } catch (error) {
      return { available: 0, security: 0, lastUpdate: new Date() };
    }
  }

  /**
   * Get vulnerabilities health
   */
  private async getVulnerabilitiesHealth(): Promise<SecurityHealth['vulnerabilities']> {
    try {
      // This would typically use a vulnerability scanner
      // For now, return placeholder values
      return {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      };
    } catch (error) {
      return { critical: 0, high: 0, medium: 0, low: 0 };
    }
  }

  /**
   * Get performance health
   */
  private async getPerformanceHealth(): Promise<PerformanceHealth> {
    try {
      const responseTime = await this.getResponseTime();
      const throughput = await this.getThroughput();
      const errorRate = await this.getErrorRate();
      const cacheHitRate = await this.getCacheHitRate();
      const database = await this.getDatabaseHealth();
      const webServer = await this.getWebServerHealth();

      const score = this.calculatePerformanceScore(responseTime, throughput, errorRate, cacheHitRate);

      return {
        score,
        responseTime,
        throughput,
        errorRate,
        cacheHitRate,
        database,
        webServer,
      };
    } catch (error) {
      console.error('Failed to get performance health:', error);
      return {
        score: 0,
        responseTime: 0,
        throughput: 0,
        errorRate: 0,
        cacheHitRate: 0,
        database: { connections: 0, maxConnections: 0, queryTime: 0, slowQueries: 0 },
        webServer: { activeConnections: 0, requestsPerSecond: 0, bytesPerSecond: 0 },
      };
    }
  }

  /**
   * Get response time
   */
  private async getResponseTime(): Promise<number> {
    try {
      const { stdout } = await execAsync("curl -o /dev/null -s -w '%{time_total}' http://localhost");
      return parseFloat(stdout.trim()) * 1000; // Convert to milliseconds
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get throughput
   */
  private async getThroughput(): Promise<number> {
    try {
      // This would typically be calculated from access logs
      // For now, return a placeholder value
      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get error rate
   */
  private async getErrorRate(): Promise<number> {
    try {
      // This would typically be calculated from access logs
      // For now, return a placeholder value
      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get cache hit rate
   */
  private async getCacheHitRate(): Promise<number> {
    try {
      // This would typically be calculated from cache logs
      // For now, return a placeholder value
      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get database health
   */
  private async getDatabaseHealth(): Promise<PerformanceHealth['database']> {
    try {
      // This would typically connect to the database
      // For now, return placeholder values
      return {
        connections: 0,
        maxConnections: 0,
        queryTime: 0,
        slowQueries: 0,
      };
    } catch (error) {
      return { connections: 0, maxConnections: 0, queryTime: 0, slowQueries: 0 };
    }
  }

  /**
   * Get web server health
   */
  private async getWebServerHealth(): Promise<PerformanceHealth['webServer']> {
    try {
      // This would typically be calculated from web server logs
      // For now, return placeholder values
      return {
        activeConnections: 0,
        requestsPerSecond: 0,
        bytesPerSecond: 0,
      };
    } catch (error) {
      return { activeConnections: 0, requestsPerSecond: 0, bytesPerSecond: 0 };
    }
  }

  /**
   * Calculate overall health score
   */
  private calculateOverallScore(
    services: ServiceHealth[],
    resources: ResourceHealth,
    security: SecurityHealth,
    performance: PerformanceHealth
  ): number {
    const serviceScore = this.calculateServiceScore(services);
    const resourceScore = this.calculateResourceScore(resources);
    const securityScore = security.score;
    const performanceScore = performance.score;

    return Math.round((serviceScore + resourceScore + securityScore + performanceScore) / 4);
  }

  /**
   * Calculate service score
   */
  private calculateServiceScore(services: ServiceHealth[]): number {
    if (services.length === 0) return 0;
    
    const runningServices = services.filter(s => s.status === 'running').length;
    return Math.round((runningServices / services.length) * 100);
  }

  /**
   * Calculate resource score
   */
  private calculateResourceScore(resources: ResourceHealth): number {
    const cpuScore = Math.max(0, 100 - resources.cpu.usage);
    const memoryScore = Math.max(0, 100 - (resources.memory.used / resources.memory.total) * 100);
    const diskScore = Math.max(0, 100 - (resources.disk[0]?.usage || 0));
    
    return Math.round((cpuScore + memoryScore + diskScore) / 3);
  }

  /**
   * Calculate security score
   */
  private calculateSecurityScore(
    firewall: SecurityHealth['firewall'],
    fail2ban: SecurityHealth['fail2ban'],
    ssl: SecurityHealth['ssl'],
    updates: SecurityHealth['updates'],
    vulnerabilities: SecurityHealth['vulnerabilities']
  ): number {
    let score = 0;
    
    if (firewall.enabled) score += 20;
    if (fail2ban.enabled) score += 20;
    if (ssl.certificates > 0) score += 20;
    if (updates.security === 0) score += 20;
    if (vulnerabilities.critical === 0) score += 20;
    
    return score;
  }

  /**
   * Calculate performance score
   */
  private calculatePerformanceScore(
    responseTime: number,
    throughput: number,
    errorRate: number,
    cacheHitRate: number
  ): number {
    let score = 100;
    
    if (responseTime > this.thresholds.responseTime.warning) score -= 20;
    if (errorRate > this.thresholds.errorRate.warning) score -= 20;
    if (cacheHitRate < 50) score -= 10;
    
    return Math.max(0, score);
  }

  /**
   * Get overall status
   */
  private getOverallStatus(score: number): SystemHealth['overall'] {
    if (score >= 80) return 'healthy';
    if (score >= 60) return 'warning';
    if (score >= 0) return 'critical';
    return 'unknown';
  }

  /**
   * Create health alert
   */
  async createAlert(alert: Omit<HealthAlert, 'id' | 'timestamp' | 'acknowledged' | 'resolved'>): Promise<HealthAlert> {
    const newAlert: HealthAlert = {
      ...alert,
      id: this.generateId(),
      timestamp: new Date(),
      acknowledged: false,
      resolved: false,
    };

    this.alerts.set(newAlert.id, newAlert);
    await this.saveAlerts();

    return newAlert;
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      await this.saveAlerts();
    }
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      await this.saveAlerts();
    }
  }

  /**
   * Get health alerts
   */
  getAlerts(): HealthAlert[] {
    return Array.from(this.alerts.values());
  }

  /**
   * Get health recommendations
   */
  getRecommendations(): HealthRecommendation[] {
    return Array.from(this.recommendations.values());
  }

  /**
   * Update recommendation status
   */
  async updateRecommendationStatus(id: string, status: HealthRecommendation['status']): Promise<void> {
    const recommendation = this.recommendations.get(id);
    if (recommendation) {
      recommendation.status = status;
      if (status === 'completed') {
        recommendation.completedAt = new Date();
      }
      await this.saveRecommendations();
    }
  }

  /**
   * Update thresholds
   */
  async updateThresholds(thresholds: Partial<typeof this.thresholds>): Promise<void> {
    this.thresholds = { ...this.thresholds, ...thresholds };
    await this.saveThresholds();
  }

  /**
   * Get thresholds
   */
  getThresholds(): typeof this.thresholds {
    return { ...this.thresholds };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}