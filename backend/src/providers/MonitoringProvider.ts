import * as si from 'systeminformation';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    model: string;
    speed: number;
    temperature?: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
    cached: number;
    buffers: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    percentage: number;
    readSpeed: number;
    writeSpeed: number;
  };
  network: {
    interfaces: Array<{
      name: string;
      bytesReceived: number;
      bytesSent: number;
      packetsReceived: number;
      packetsSent: number;
    }>;
  };
  load: {
    avg1m: number;
    avg5m: number;
    avg15m: number;
  };
  uptime: number;
  processes: {
    total: number;
    running: number;
    sleeping: number;
    zombie: number;
  };
  services: {
    nginx: boolean;
    apache: boolean;
    mysql: boolean;
    postfix: boolean;
    dovecot: boolean;
    redis: boolean;
  };
}

export interface SiteMetrics {
  id: string;
  domain: string;
  status: 'online' | 'offline' | 'error';
  responseTime: number;
  lastChecked: Date;
  sslStatus: 'valid' | 'expired' | 'invalid' | 'none';
  sslExpiry?: Date;
  traffic: {
    bytesIn: number;
    bytesOut: number;
    requests: number;
  };
}

export interface DatabaseMetrics {
  name: string;
  size: number;
  tables: number;
  connections: number;
  queries: number;
  slowQueries: number;
}

export interface EmailMetrics {
  totalAccounts: number;
  activeAccounts: number;
  totalQuota: number;
  usedQuota: number;
  messagesToday: number;
  queueSize: number;
}

export class MonitoringProvider {
  private metricsCache: SystemMetrics | null = null;
  private lastUpdate = 0;
  private cacheTimeout = 5000; // 5 seconds

  /**
   * Get comprehensive system metrics
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    const now = Date.now();
    
    // Return cached metrics if still valid
    if (this.metricsCache && (now - this.lastUpdate) < this.cacheTimeout) {
      return this.metricsCache;
    }

    try {
      // Get all metrics in parallel for better performance
      const [
        cpu,
        memory,
        disk,
        network,
        currentLoad,
        uptime,
        processes,
        services
      ] = await Promise.all([
        this.getCpuMetrics(),
        this.getMemoryMetrics(),
        this.getDiskMetrics(),
        this.getNetworkMetrics(),
        this.getLoadMetrics(),
        this.getUptime(),
        this.getProcessMetrics(),
        this.getServiceStatus()
      ]);

      this.metricsCache = {
        cpu,
        memory,
        disk,
        network,
        load: currentLoad,
        uptime,
        processes,
        services
      };

      this.lastUpdate = now;
      return this.metricsCache;
    } catch (error) {
      console.error('Failed to get system metrics:', error);
      throw new Error(`Failed to get system metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get CPU metrics
   */
  private async getCpuMetrics(): Promise<SystemMetrics['cpu']> {
    try {
      const [cpuInfo, cpuUsage, cpuTemperature] = await Promise.all([
        si.cpu(),
        si.currentLoad(),
        si.cpuTemperature().catch(() => ({ main: null }))
      ]);

      return {
        usage: Math.round(cpuUsage.currentLoad || 0),
        cores: cpuInfo.cores || 1,
        model: cpuInfo.model || 'Unknown',
        speed: cpuInfo.speed || 0,
        temperature: cpuTemperature.main || undefined
      };
    } catch (error) {
      console.error('Failed to get CPU metrics:', error);
      return {
        usage: 0,
        cores: 1,
        model: 'Unknown',
        speed: 0
      };
    }
  }

  /**
   * Get memory metrics
   */
  private async getMemoryMetrics(): Promise<SystemMetrics['memory']> {
    try {
      const mem = await si.mem();
      const percentage = mem.total > 0 ? Math.round((mem.used / mem.total) * 100) : 0;

      return {
        total: mem.total,
        used: mem.used,
        free: mem.free,
        percentage,
        cached: mem.cached || 0,
        buffers: mem.buffers || 0
      };
    } catch (error) {
      console.error('Failed to get memory metrics:', error);
      return {
        total: 0,
        used: 0,
        free: 0,
        percentage: 0,
        cached: 0,
        buffers: 0
      };
    }
  }

  /**
   * Get disk metrics
   */
  private async getDiskMetrics(): Promise<SystemMetrics['disk']> {
    try {
      const [diskLayout, diskIO] = await Promise.all([
        si.diskLayout(),
        si.disksIO().catch(() => ({ rIO_sec: 0, wIO_sec: 0 }))
      ]);

      // Get root filesystem stats
      const fsSize = await si.fsSize();
      const rootFs = fsSize.find(fs => fs.mount === '/') || fsSize[0];

      return {
        total: rootFs?.size || 0,
        used: rootFs?.used || 0,
        free: rootFs?.available || 0,
        percentage: rootFs?.use || 0,
        readSpeed: diskIO.rIO_sec || 0,
        writeSpeed: diskIO.wIO_sec || 0
      };
    } catch (error) {
      console.error('Failed to get disk metrics:', error);
      return {
        total: 0,
        used: 0,
        free: 0,
        percentage: 0,
        readSpeed: 0,
        writeSpeed: 0
      };
    }
  }

  /**
   * Get network metrics
   */
  private async getNetworkMetrics(): Promise<SystemMetrics['network']> {
    try {
      const networkStats = await si.networkStats();
      
      return {
        interfaces: networkStats.map(iface => ({
          name: iface.iface,
          bytesReceived: iface.rx_bytes || 0,
          bytesSent: iface.tx_bytes || 0,
          packetsReceived: iface.rx_packets || 0,
          packetsSent: iface.tx_packets || 0
        }))
      };
    } catch (error) {
      console.error('Failed to get network metrics:', error);
      return {
        interfaces: []
      };
    }
  }

  /**
   * Get system load metrics
   */
  private async getLoadMetrics(): Promise<SystemMetrics['load']> {
    try {
      const load = await si.currentLoad();
      return {
        avg1m: load.avgLoad || 0,
        avg5m: load.avgLoad || 0,
        avg15m: load.avgLoad || 0
      };
    } catch (error) {
      console.error('Failed to get load metrics:', error);
      return {
        avg1m: 0,
        avg5m: 0,
        avg15m: 0
      };
    }
  }

  /**
   * Get system uptime
   */
  private async getUptime(): Promise<number> {
    try {
      const uptime = await si.time();
      return uptime.uptime || 0;
    } catch (error) {
      console.error('Failed to get uptime:', error);
      return 0;
    }
  }

  /**
   * Get process metrics
   */
  private async getProcessMetrics(): Promise<SystemMetrics['processes']> {
    try {
      const processes = await si.processes();
      return {
        total: processes.all || 0,
        running: processes.running || 0,
        sleeping: processes.sleeping || 0,
        zombie: processes.zombie || 0
      };
    } catch (error) {
      console.error('Failed to get process metrics:', error);
      return {
        total: 0,
        running: 0,
        sleeping: 0,
        zombie: 0
      };
    }
  }

  /**
   * Get service status
   */
  private async getServiceStatus(): Promise<SystemMetrics['services']> {
    const services = {
      nginx: false,
      apache: false,
      mysql: false,
      postfix: false,
      dovecot: false,
      redis: false
    };

    try {
      // Check service status in parallel
      const serviceChecks = await Promise.allSettled([
        this.checkService('nginx'),
        this.checkService('apache2'),
        this.checkService('mysql'),
        this.checkService('postfix'),
        this.checkService('dovecot'),
        this.checkService('redis-server')
      ]);

      services.nginx = serviceChecks[0].status === 'fulfilled';
      services.apache = serviceChecks[1].status === 'fulfilled';
      services.mysql = serviceChecks[2].status === 'fulfilled';
      services.postfix = serviceChecks[3].status === 'fulfilled';
      services.dovecot = serviceChecks[4].status === 'fulfilled';
      services.redis = serviceChecks[5].status === 'fulfilled';

      return services;
    } catch (error) {
      console.error('Failed to get service status:', error);
      return services;
    }
  }

  /**
   * Check if a service is running
   */
  private async checkService(serviceName: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`systemctl is-active ${serviceName}`);
      return stdout.trim() === 'active';
    } catch (error) {
      return false;
    }
  }

  /**
   * Get site metrics
   */
  async getSiteMetrics(sites: Array<{ id: string; domain: string }>): Promise<SiteMetrics[]> {
    const metrics: SiteMetrics[] = [];

    for (const site of sites) {
      try {
        const startTime = Date.now();
        
        // Check if site is responding
        const response = await fetch(`http://${site.domain}`, {
          method: 'HEAD',
          timeout: 5000
        }).catch(() => null);

        const responseTime = Date.now() - startTime;
        const status = response ? 'online' : 'offline';

        // Check SSL status
        const sslStatus = await this.checkSSLStatus(site.domain);

        metrics.push({
          id: site.id,
          domain: site.domain,
          status,
          responseTime,
          lastChecked: new Date(),
          sslStatus: sslStatus.status,
          sslExpiry: sslStatus.expiry,
          traffic: {
            bytesIn: 0, // Would need to implement traffic monitoring
            bytesOut: 0,
            requests: 0
          }
        });
      } catch (error) {
        metrics.push({
          id: site.id,
          domain: site.domain,
          status: 'error',
          responseTime: 0,
          lastChecked: new Date(),
          sslStatus: 'none',
          traffic: {
            bytesIn: 0,
            bytesOut: 0,
            requests: 0
          }
        });
      }
    }

    return metrics;
  }

  /**
   * Check SSL certificate status
   */
  private async checkSSLStatus(domain: string): Promise<{ status: 'valid' | 'expired' | 'invalid' | 'none'; expiry?: Date }> {
    try {
      const { stdout } = await execAsync(`echo | openssl s_client -servername ${domain} -connect ${domain}:443 2>/dev/null | openssl x509 -noout -dates 2>/dev/null`);
      
      if (stdout.includes('notAfter=')) {
        const expiryMatch = stdout.match(/notAfter=(.+)/);
        if (expiryMatch) {
          const expiryDate = new Date(expiryMatch[1]);
          const now = new Date();
          
          if (expiryDate > now) {
            return { status: 'valid', expiry: expiryDate };
          } else {
            return { status: 'expired', expiry: expiryDate };
          }
        }
      }
      
      return { status: 'none' };
    } catch (error) {
      return { status: 'none' };
    }
  }

  /**
   * Get database metrics
   */
  async getDatabaseMetrics(): Promise<DatabaseMetrics[]> {
    try {
      const { stdout } = await execAsync('mysql -u root -e "SHOW DATABASES;" 2>/dev/null | grep -v "Database\\|information_schema\\|performance_schema\\|mysql\\|sys"');
      const databases = stdout.trim().split('\n').filter(db => db.trim());

      const metrics: DatabaseMetrics[] = [];

      for (const dbName of databases) {
        try {
          const [sizeResult, tablesResult, connectionsResult] = await Promise.all([
            execAsync(`mysql -u root -e "SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'DB Size in MB' FROM information_schema.tables WHERE table_schema='${dbName}';" 2>/dev/null`),
            execAsync(`mysql -u root -e "SELECT COUNT(*) AS table_count FROM information_schema.tables WHERE table_schema='${dbName}';" 2>/dev/null`),
            execAsync(`mysql -u root -e "SELECT COUNT(*) AS connections FROM information_schema.processlist WHERE db='${dbName}';" 2>/dev/null`)
          ]);

          const size = parseFloat(sizeResult.stdout.match(/(\d+\.?\d*)/)?.[1] || '0') * 1024 * 1024; // Convert to bytes
          const tables = parseInt(tablesResult.stdout.match(/(\d+)/)?.[1] || '0');
          const connections = parseInt(connectionsResult.stdout.match(/(\d+)/)?.[1] || '0');

          metrics.push({
            name: dbName,
            size,
            tables,
            connections,
            queries: 0, // Would need to implement query monitoring
            slowQueries: 0
          });
        } catch (error) {
          // Skip databases that can't be accessed
        }
      }

      return metrics;
    } catch (error) {
      console.error('Failed to get database metrics:', error);
      return [];
    }
  }

  /**
   * Get email metrics
   */
  async getEmailMetrics(): Promise<EmailMetrics> {
    try {
      const [accountsResult, queueResult] = await Promise.all([
        execAsync('wc -l /etc/postfix/virtual/mailboxes 2>/dev/null || echo "0"'),
        execAsync('mailq | grep -c "^[A-F0-9]" 2>/dev/null || echo "0"')
      ]);

      const totalAccounts = parseInt(accountsResult.stdout.match(/(\d+)/)?.[1] || '0');
      const queueSize = parseInt(queueResult.stdout.match(/(\d+)/)?.[1] || '0');

      return {
        totalAccounts,
        activeAccounts: totalAccounts, // Assume all are active for now
        totalQuota: totalAccounts * 1024 * 1024 * 1024, // 1GB per account
        usedQuota: 0, // Would need to implement quota monitoring
        messagesToday: 0, // Would need to implement mail log monitoring
        queueSize
      };
    } catch (error) {
      console.error('Failed to get email metrics:', error);
      return {
        totalAccounts: 0,
        activeAccounts: 0,
        totalQuota: 0,
        usedQuota: 0,
        messagesToday: 0,
        queueSize: 0
      };
    }
  }

  /**
   * Get system alerts based on thresholds
   */
  getSystemAlerts(metrics: SystemMetrics): Array<{
    type: 'warning' | 'critical';
    message: string;
    timestamp: Date;
  }> {
    const alerts: Array<{
      type: 'warning' | 'critical';
      message: string;
      timestamp: Date;
    }> = [];

    // CPU alerts
    if (metrics.cpu.usage > 90) {
      alerts.push({
        type: 'critical',
        message: `CPU usage is critically high: ${metrics.cpu.usage}%`,
        timestamp: new Date()
      });
    } else if (metrics.cpu.usage > 80) {
      alerts.push({
        type: 'warning',
        message: `CPU usage is high: ${metrics.cpu.usage}%`,
        timestamp: new Date()
      });
    }

    // Memory alerts
    if (metrics.memory.percentage > 95) {
      alerts.push({
        type: 'critical',
        message: `Memory usage is critically high: ${metrics.memory.percentage}%`,
        timestamp: new Date()
      });
    } else if (metrics.memory.percentage > 85) {
      alerts.push({
        type: 'warning',
        message: `Memory usage is high: ${metrics.memory.percentage}%`,
        timestamp: new Date()
      });
    }

    // Disk alerts
    if (metrics.disk.percentage > 95) {
      alerts.push({
        type: 'critical',
        message: `Disk usage is critically high: ${metrics.disk.percentage}%`,
        timestamp: new Date()
      });
    } else if (metrics.disk.percentage > 85) {
      alerts.push({
        type: 'warning',
        message: `Disk usage is high: ${metrics.disk.percentage}%`,
        timestamp: new Date()
      });
    }

    // Load alerts
    if (metrics.load.avg1m > 10) {
      alerts.push({
        type: 'critical',
        message: `System load is critically high: ${metrics.load.avg1m}`,
        timestamp: new Date()
      });
    } else if (metrics.load.avg1m > 5) {
      alerts.push({
        type: 'warning',
        message: `System load is high: ${metrics.load.avg1m}`,
        timestamp: new Date()
      });
    }

    // Service alerts
    const criticalServices = ['nginx', 'mysql', 'redis'];
    for (const service of criticalServices) {
      if (!metrics.services[service as keyof typeof metrics.services]) {
        alerts.push({
          type: 'critical',
          message: `Critical service ${service} is not running`,
          timestamp: new Date()
        });
      }
    }

    return alerts;
  }
}
