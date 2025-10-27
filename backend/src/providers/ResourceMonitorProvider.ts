import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';

const execAsync = promisify(exec);

export interface SystemResource {
  cpu: {
    usage: number;
    cores: number;
    loadAverage: number[];
    temperature?: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    available: number;
    swapTotal: number;
    swapUsed: number;
    swapFree: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usage: number;
    inodes: {
      total: number;
      used: number;
      free: number;
    };
  };
  network: {
    interfaces: NetworkInterface[];
    connections: number;
    bandwidth: {
      incoming: number;
      outgoing: number;
    };
  };
  processes: {
    total: number;
    running: number;
    sleeping: number;
    zombie: number;
    topProcesses: ProcessInfo[];
  };
}

export interface NetworkInterface {
  name: string;
  status: 'up' | 'down';
  ipv4: string[];
  ipv6: string[];
  mac: string;
  speed: number;
  mtu: number;
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
  rxErrors: number;
  txErrors: number;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  user: string;
  cpu: number;
  memory: number;
  status: string;
  startTime: Date;
  command: string;
}

export interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'failed' | 'unknown';
  uptime: string;
  memory: number;
  cpu: number;
  pid?: number;
  lastRestart?: Date;
}

export interface ResourceAlert {
  id: string;
  type: 'cpu' | 'memory' | 'disk' | 'network' | 'service';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  threshold: number;
  currentValue: number;
  timestamp: Date;
  acknowledged: boolean;
}

export class ResourceMonitorProvider {
  private alerts: Map<string, ResourceAlert>;
  private thresholds: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };

  constructor() {
    this.alerts = new Map();
    this.thresholds = {
      cpu: 80,
      memory: 85,
      disk: 90,
      network: 1000, // MB/s
    };
  }

  /**
   * Get system resources
   */
  async getSystemResources(): Promise<SystemResource> {
    try {
      const [cpu, memory, disk, network, processes] = await Promise.all([
        this.getCPUInfo(),
        this.getMemoryInfo(),
        this.getDiskInfo(),
        this.getNetworkInfo(),
        this.getProcessInfo(),
      ]);

      return {
        cpu,
        memory,
        disk,
        network,
        processes,
      };
    } catch (error) {
      console.error('Failed to get system resources:', error);
      throw new Error(`Failed to get system resources: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get CPU information
   */
  private async getCPUInfo(): Promise<SystemResource['cpu']> {
    try {
      // Get CPU usage
      const { stdout: cpuUsage } = await execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | awk -F'%' '{print $1}'");
      const usage = parseFloat(cpuUsage.trim()) || 0;

      // Get CPU cores
      const { stdout: cores } = await execAsync('nproc');
      const coreCount = parseInt(cores.trim()) || 1;

      // Get load average
      const { stdout: loadAvg } = await execAsync('uptime | awk -F\'load average:\' \'{print $2}\' | awk \'{print $1, $2, $3}\'');
      const loadAverage = loadAvg.trim().split(/\s+/).map(parseFloat);

      // Get CPU temperature (if available)
      let temperature: number | undefined;
      try {
        const { stdout: temp } = await execAsync('cat /sys/class/thermal/thermal_zone*/temp 2>/dev/null | head -1');
        temperature = parseInt(temp.trim()) / 1000; // Convert to Celsius
      } catch (error) {
        // Temperature sensor not available
      }

      return {
        usage,
        cores: coreCount,
        loadAverage,
        temperature,
      };
    } catch (error) {
      return {
        usage: 0,
        cores: 1,
        loadAverage: [0, 0, 0],
      };
    }
  }

  /**
   * Get memory information
   */
  private async getMemoryInfo(): Promise<SystemResource['memory']> {
    try {
      const { stdout } = await execAsync('free -b');
      const lines = stdout.split('\n');
      
      const memLine = lines[1].split(/\s+/);
      const swapLine = lines[2].split(/\s+/);

      return {
        total: parseInt(memLine[1]),
        used: parseInt(memLine[2]),
        free: parseInt(memLine[3]),
        available: parseInt(memLine[6]),
        swapTotal: parseInt(swapLine[1]),
        swapUsed: parseInt(swapLine[2]),
        swapFree: parseInt(swapLine[3]),
      };
    } catch (error) {
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
   * Get disk information
   */
  private async getDiskInfo(): Promise<SystemResource['disk']> {
    try {
      const { stdout } = await execAsync('df -B1 /');
      const lines = stdout.split('\n');
      const diskLine = lines[1].split(/\s+/);

      const total = parseInt(diskLine[1]);
      const used = parseInt(diskLine[2]);
      const free = parseInt(diskLine[3]);
      const usage = (used / total) * 100;

      // Get inode information
      const { stdout: inodeOutput } = await execAsync('df -i /');
      const inodeLines = inodeOutput.split('\n');
      const inodeLine = inodeLines[1].split(/\s+/);

      return {
        total,
        used,
        free,
        usage,
        inodes: {
          total: parseInt(inodeLine[1]),
          used: parseInt(inodeLine[2]),
          free: parseInt(inodeLine[3]),
        },
      };
    } catch (error) {
      return {
        total: 0,
        used: 0,
        free: 0,
        usage: 0,
        inodes: {
          total: 0,
          used: 0,
          free: 0,
        },
      };
    }
  }

  /**
   * Get network information
   */
  private async getNetworkInfo(): Promise<SystemResource['network']> {
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
      return {
        interfaces: [],
        connections: 0,
        bandwidth: {
          incoming: 0,
          outgoing: 0,
        },
      };
    }
  }

  /**
   * Get network interfaces
   */
  private async getNetworkInterfaces(): Promise<NetworkInterface[]> {
    try {
      const { stdout } = await execAsync('ip -j addr show');
      const data = JSON.parse(stdout);
      
      const interfaces: NetworkInterface[] = [];
      
      for (const iface of data) {
        const ipv4 = iface.addr_info?.filter((addr: any) => addr.family === 'inet').map((addr: any) => addr.local) || [];
        const ipv6 = iface.addr_info?.filter((addr: any) => addr.family === 'inet6').map((addr: any) => addr.local) || [];
        
        interfaces.push({
          name: iface.ifname,
          status: iface.operstate === 'UP' ? 'up' : 'down',
          ipv4,
          ipv6,
          mac: iface.address || '',
          speed: 0, // Would need additional commands to get speed
          mtu: iface.mtu || 1500,
          rxBytes: 0, // Would need to read from /proc/net/dev
          txBytes: 0,
          rxPackets: 0,
          txPackets: 0,
          rxErrors: 0,
          txErrors: 0,
        });
      }
      
      return interfaces;
    } catch (error) {
      return [];
    }
  }

  /**
   * Get network connections count
   */
  private async getNetworkConnections(): Promise<number> {
    try {
      const { stdout } = await execAsync('netstat -an | grep ESTABLISHED | wc -l');
      return parseInt(stdout.trim()) || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get network bandwidth
   */
  private async getNetworkBandwidth(): Promise<SystemResource['network']['bandwidth']> {
    try {
      // This is a simplified implementation
      // In production, you'd want to track bandwidth over time
      return {
        incoming: 0,
        outgoing: 0,
      };
    } catch (error) {
      return {
        incoming: 0,
        outgoing: 0,
      };
    }
  }

  /**
   * Get process information
   */
  private async getProcessInfo(): Promise<SystemResource['processes']> {
    try {
      const { stdout } = await execAsync('ps aux --sort=-%cpu | head -11');
      const lines = stdout.split('\n').slice(1); // Skip header
      
      const processes: ProcessInfo[] = [];
      let total = 0;
      let running = 0;
      let sleeping = 0;
      let zombie = 0;

      for (const line of lines) {
        if (!line.trim()) continue;
        
        const parts = line.trim().split(/\s+/);
        if (parts.length < 11) continue;

        const process: ProcessInfo = {
          pid: parseInt(parts[1]),
          name: parts[10],
          user: parts[0],
          cpu: parseFloat(parts[2]),
          memory: parseFloat(parts[3]),
          status: parts[7],
          startTime: new Date(), // Would need to parse start time
          command: parts.slice(10).join(' '),
        };

        processes.push(process);

        // Count process states
        total++;
        if (process.status === 'R') running++;
        else if (process.status === 'S') sleeping++;
        else if (process.status === 'Z') zombie++;
      }

      return {
        total,
        running,
        sleeping,
        zombie,
        topProcesses: processes.slice(0, 10),
      };
    } catch (error) {
      return {
        total: 0,
        running: 0,
        sleeping: 0,
        zombie: 0,
        topProcesses: [],
      };
    }
  }

  /**
   * Get service status
   */
  async getServiceStatus(serviceName: string): Promise<ServiceStatus> {
    try {
      const { stdout: status } = await execAsync(`systemctl is-active ${serviceName}`);
      const isActive = status.trim() === 'active';

      let uptime = '0';
      let memory = 0;
      let cpu = 0;
      let pid: number | undefined;

      if (isActive) {
        const { stdout: statusOutput } = await execAsync(`systemctl status ${serviceName} --no-pager`);
        const uptimeMatch = statusOutput.match(/Active: active \\(running\\) since (.+?);/);
        uptime = uptimeMatch ? uptimeMatch[1] : 'Unknown';

        // Get PID and resource usage
        try {
          const { stdout: pidOutput } = await execAsync(`systemctl show ${serviceName} --property=MainPID --value`);
          pid = parseInt(pidOutput.trim());
          
          if (pid) {
            const { stdout: psOutput } = await execAsync(`ps -p ${pid} -o %cpu,%mem --no-headers`);
            const [cpuStr, memStr] = psOutput.trim().split(/\s+/);
            cpu = parseFloat(cpuStr);
            memory = parseFloat(memStr);
          }
        } catch (error) {
          // Service might not have a PID or might be inactive
        }
      }

      return {
        name: serviceName,
        status: isActive ? 'running' : 'stopped',
        uptime,
        memory,
        cpu,
        pid,
      };
    } catch (error) {
      return {
        name: serviceName,
        status: 'unknown',
        uptime: '0',
        memory: 0,
        cpu: 0,
      };
    }
  }

  /**
   * Get all services status
   */
  async getAllServicesStatus(): Promise<ServiceStatus[]> {
    const services = [
      'nginx',
      'apache2',
      'mysql',
      'postgresql',
      'redis-server',
      'memcached',
      'php7.4-fpm',
      'php8.0-fpm',
      'php8.1-fpm',
      'php8.2-fpm',
      'php8.3-fpm',
      'vsftpd',
      'ssh',
      'cron',
    ];

    const statuses: ServiceStatus[] = [];
    
    for (const service of services) {
      try {
        const status = await this.getServiceStatus(service);
        statuses.push(status);
      } catch (error) {
        statuses.push({
          name: service,
          status: 'unknown',
          uptime: '0',
          memory: 0,
          cpu: 0,
        });
      }
    }

    return statuses;
  }

  /**
   * Check for resource alerts
   */
  async checkResourceAlerts(): Promise<ResourceAlert[]> {
    const alerts: ResourceAlert[] = [];
    
    try {
      const resources = await this.getSystemResources();
      
      // Check CPU usage
      if (resources.cpu.usage > this.thresholds.cpu) {
        alerts.push({
          id: 'cpu_high',
          type: 'cpu',
          severity: resources.cpu.usage > 95 ? 'critical' : 'high',
          message: `CPU usage is ${resources.cpu.usage.toFixed(1)}% (threshold: ${this.thresholds.cpu}%)`,
          threshold: this.thresholds.cpu,
          currentValue: resources.cpu.usage,
          timestamp: new Date(),
          acknowledged: false,
        });
      }

      // Check memory usage
      const memoryUsage = (resources.memory.used / resources.memory.total) * 100;
      if (memoryUsage > this.thresholds.memory) {
        alerts.push({
          id: 'memory_high',
          type: 'memory',
          severity: memoryUsage > 95 ? 'critical' : 'high',
          message: `Memory usage is ${memoryUsage.toFixed(1)}% (threshold: ${this.thresholds.memory}%)`,
          threshold: this.thresholds.memory,
          currentValue: memoryUsage,
          timestamp: new Date(),
          acknowledged: false,
        });
      }

      // Check disk usage
      if (resources.disk.usage > this.thresholds.disk) {
        alerts.push({
          id: 'disk_high',
          type: 'disk',
          severity: resources.disk.usage > 95 ? 'critical' : 'high',
          message: `Disk usage is ${resources.disk.usage.toFixed(1)}% (threshold: ${this.thresholds.disk}%)`,
          threshold: this.thresholds.disk,
          currentValue: resources.disk.usage,
          timestamp: new Date(),
          acknowledged: false,
        });
      }

      // Check for failed services
      const services = await this.getAllServicesStatus();
      for (const service of services) {
        if (service.status === 'failed' || service.status === 'stopped') {
          alerts.push({
            id: `service_${service.name}`,
            type: 'service',
            severity: 'high',
            message: `Service ${service.name} is ${service.status}`,
            threshold: 0,
            currentValue: 0,
            timestamp: new Date(),
            acknowledged: false,
          });
        }
      }

    } catch (error) {
      console.error('Failed to check resource alerts:', error);
    }

    return alerts;
  }

  /**
   * Set resource thresholds
   */
  setThresholds(thresholds: Partial<typeof this.thresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Get resource thresholds
   */
  getThresholds(): typeof this.thresholds {
    return { ...this.thresholds };
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
    }
  }

  /**
   * Get all alerts
   */
  getAlerts(): ResourceAlert[] {
    return Array.from(this.alerts.values());
  }

  /**
   * Clear acknowledged alerts
   */
  clearAcknowledgedAlerts(): void {
    for (const [id, alert] of this.alerts) {
      if (alert.acknowledged) {
        this.alerts.delete(id);
      }
    }
  }
}