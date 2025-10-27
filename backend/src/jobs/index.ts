import cron from 'node-cron';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { SystemProvider } from '../providers/SystemProvider.js';
import { MonitoringProvider } from '../providers/MonitoringProvider.js';
import { DatabaseProvider } from '../providers/DatabaseProvider.js';
import { EmailProvider } from '../providers/EmailProvider.js';
import { prisma } from '../server.js';

const execAsync = promisify(exec);

export interface JobConfig {
  name: string;
  schedule: string;
  enabled: boolean;
  description: string;
  category: 'maintenance' | 'monitoring' | 'backup' | 'security' | 'cleanup';
  priority: 'low' | 'medium' | 'high' | 'critical';
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface JobResult {
  success: boolean;
  message: string;
  duration: number;
  timestamp: Date;
  error?: string;
}

export class JobManager {
  private jobs: Map<string, cron.ScheduledTask> = new Map();
  private systemProvider: SystemProvider;
  private monitoringProvider: MonitoringProvider;
  private databaseProvider: DatabaseProvider;
  private emailProvider: EmailProvider;
  private jobHistory: Map<string, JobResult[]> = new Map();

  constructor() {
    this.systemProvider = new SystemProvider();
    this.monitoringProvider = new MonitoringProvider();
    this.databaseProvider = new DatabaseProvider();
    this.emailProvider = new EmailProvider();
  }

  /**
   * Initialize and start all background jobs
   */
  async setupJobs(): Promise<void> {
    // System maintenance jobs
    await this.registerJob({
      name: 'system-cleanup',
      schedule: '0 2 * * *', // Daily at 2 AM
      enabled: true,
      description: 'Clean temporary files, logs, and optimize system',
      category: 'maintenance',
      priority: 'medium'
    }, this.systemCleanup.bind(this));

    await this.registerJob({
      name: 'log-rotation',
      schedule: '0 1 * * 0', // Weekly on Sunday at 1 AM
      enabled: true,
      description: 'Rotate and compress log files',
      category: 'maintenance',
      priority: 'medium'
    }, this.logRotation.bind(this));

    await this.registerJob({
      name: 'system-updates',
      schedule: '0 3 * * 0', // Weekly on Sunday at 3 AM
      enabled: true,
      description: 'Check and apply system updates',
      category: 'maintenance',
      priority: 'high'
    }, this.systemUpdates.bind(this));

    // Monitoring jobs
    await this.registerJob({
      name: 'health-check',
      schedule: '*/5 * * * *', // Every 5 minutes
      enabled: true,
      description: 'Check system health and services',
      category: 'monitoring',
      priority: 'critical'
    }, this.healthCheck.bind(this));

    await this.registerJob({
      name: 'resource-monitoring',
      schedule: '*/1 * * * *', // Every minute
      enabled: true,
      description: 'Monitor CPU, memory, disk usage',
      category: 'monitoring',
      priority: 'high'
    }, this.resourceMonitoring.bind(this));

    await this.registerJob({
      name: 'service-monitoring',
      schedule: '*/2 * * * *', // Every 2 minutes
      enabled: true,
      description: 'Monitor web server and database services',
      category: 'monitoring',
      priority: 'high'
    }, this.serviceMonitoring.bind(this));

    // Backup jobs
    await this.registerJob({
      name: 'database-backup',
      schedule: '0 4 * * *', // Daily at 4 AM
      enabled: true,
      description: 'Backup all databases',
      category: 'backup',
      priority: 'high'
    }, this.databaseBackup.bind(this));

    await this.registerJob({
      name: 'file-backup',
      schedule: '0 5 * * *', // Daily at 5 AM
      enabled: true,
      description: 'Backup important files and configurations',
      category: 'backup',
      priority: 'medium'
    }, this.fileBackup.bind(this));

    // Security jobs
    await this.registerJob({
      name: 'security-scan',
      schedule: '0 6 * * *', // Daily at 6 AM
      enabled: true,
      description: 'Scan for security vulnerabilities',
      category: 'security',
      priority: 'high'
    }, this.securityScan.bind(this));

    await this.registerJob({
      name: 'ssl-renewal',
      schedule: '0 7 * * *', // Daily at 7 AM
      enabled: true,
      description: 'Check and renew SSL certificates',
      category: 'security',
      priority: 'high'
    }, this.sslRenewal.bind(this));

    // Cleanup jobs
    await this.registerJob({
      name: 'temp-cleanup',
      schedule: '0 */6 * * *', // Every 6 hours
      enabled: true,
      description: 'Clean temporary files and caches',
      category: 'cleanup',
      priority: 'low'
    }, this.tempCleanup.bind(this));

    await this.registerJob({
      name: 'old-backup-cleanup',
      schedule: '0 8 * * 0', // Weekly on Sunday at 8 AM
      enabled: true,
      description: 'Remove old backup files',
      category: 'cleanup',
      priority: 'low'
    }, this.oldBackupCleanup.bind(this));

    }

  /**
   * Register a new job
   */
  async registerJob(config: JobConfig, handler: () => Promise<void>): Promise<void> {
    if (!config.enabled) {
      return;
    }

    const task = cron.schedule(config.schedule, async () => {
      const startTime = Date.now();
      try {
        await handler();
        const duration = Date.now() - startTime;
        const result: JobResult = {
          success: true,
          message: `Job ${config.name} completed successfully`,
          duration,
          timestamp: new Date()
        };
        
        this.addJobHistory(config.name, result);
        } catch (error) {
        const duration = Date.now() - startTime;
        const result: JobResult = {
          success: false,
          message: `Job ${config.name} failed`,
          duration,
          timestamp: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        
        this.addJobHistory(config.name, result);
        console.error(`❌ Job ${config.name} failed:`, error);
        
        // Send alert for critical job failures
        if (config.priority === 'critical') {
          await this.sendJobFailureAlert(config.name, error);
        }
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    this.jobs.set(config.name, task);
    task.start();
  }

  /**
   * System cleanup job
   */
  private async systemCleanup(): Promise<void> {
    // Clean temporary files
    await execAsync('find /tmp -type f -atime +7 -delete');
    await execAsync('find /var/tmp -type f -atime +7 -delete');
    
    // Clean package cache
    await execAsync('apt-get clean');
    await execAsync('apt-get autoremove -y');
    
    // Clean old logs
    await execAsync('find /var/log -name "*.log" -type f -mtime +30 -delete');
    await execAsync('find /var/log -name "*.gz" -type f -mtime +90 -delete');
    
    // Clean old backups
    await execAsync('find /var/backups -type f -mtime +30 -delete');
    
    // Optimize database
    try {
      await this.databaseProvider.optimizeDatabases();
    } catch (error) {
      }
    
    }

  /**
   * Log rotation job
   */
  private async logRotation(): Promise<void> {
    // Rotate application logs
    await execAsync('logrotate -f /etc/logrotate.conf');
    
    // Compress old logs
    await execAsync('find /var/log -name "*.log" -type f -mtime +1 -exec gzip {} \\;');
    
    }

  /**
   * System updates job
   */
  private async systemUpdates(): Promise<void> {
    try {
      // Update package lists
      await execAsync('apt-get update');
      
      // Check for updates
      const { stdout } = await execAsync('apt list --upgradable 2>/dev/null | wc -l');
      const updateCount = parseInt(stdout.trim());
      
      if (updateCount > 0) {
        // Apply security updates only (safer for production)
        await execAsync('apt-get upgrade -y --only-upgrade');
        
        // Clean up
        await execAsync('apt-get autoremove -y');
        await execAsync('apt-get autoclean');
        
        } else {
        }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Health check job
   */
  private async healthCheck(): Promise<void> {
    const healthStatus: {
      timestamp: Date;
      services: Record<string, any>;
      resources: Record<string, any>;
      alerts: string[];
    } = {
      timestamp: new Date(),
      services: {},
      resources: {},
      alerts: []
    };

    // Check web services
    try {
      const nginxStatus = await this.systemProvider.getServiceStatus();
      healthStatus.services['nginx'] = nginxStatus.nginx;
      healthStatus.services['apache'] = nginxStatus.apache;
    } catch (error) {
      healthStatus.alerts.push('Failed to check web services');
    }

    // Check database
    try {
      const dbStatus = await this.databaseProvider.getStatus();
      healthStatus.services['database'] = dbStatus;
    } catch (error) {
      healthStatus.alerts.push('Database connection failed');
    }

    // Check disk space
    try {
      const { stdout } = await execAsync('df -h / | tail -1 | awk \'{print $5}\' | sed \'s/%//\'');
      const diskUsage = parseInt(stdout.trim());
      healthStatus.resources['disk'] = { usage: diskUsage, unit: '%' };
      
      if (diskUsage > 90) {
        healthStatus.alerts.push(`Disk usage critical: ${diskUsage}%`);
      }
    } catch (error) {
      healthStatus.alerts.push('Failed to check disk usage');
    }

    // Check memory
    try {
      const { stdout } = await execAsync('free | grep Mem | awk \'{printf "%.1f", $3/$2 * 100.0}\'');
      const memoryUsage = parseFloat(stdout.trim());
      healthStatus.resources['memory'] = { usage: memoryUsage, unit: '%' };
      
      if (memoryUsage > 90) {
        healthStatus.alerts.push(`Memory usage critical: ${memoryUsage}%`);
      }
    } catch (error) {
      healthStatus.alerts.push('Failed to check memory usage');
    }

    // Store health status
    await this.storeHealthStatus(healthStatus);
    
    // Send alerts if any
    if (healthStatus.alerts.length > 0) {
      await this.sendHealthAlert(healthStatus);
    }
  }

  /**
   * Resource monitoring job
   */
  private async resourceMonitoring(): Promise<void> {
    const metrics = await this.monitoringProvider.getSystemMetrics();
    await this.storeMetrics(metrics);
  }

  /**
   * Service monitoring job
   */
  private async serviceMonitoring(): Promise<void> {
    const services = ['nginx', 'apache2', 'mysql', 'php8.2-fpm'];
    
    for (const service of services) {
      try {
        const { stdout } = await execAsync(`systemctl is-active ${service}`);
        const isActive = stdout.trim() === 'active';
        
        if (!isActive) {
          await execAsync(`systemctl restart ${service}`);
        }
      } catch (error) {
        
      }
    }
  }

  /**
   * Database backup job
   */
  private async databaseBackup(): Promise<void> {
    await this.databaseProvider.createBackup();
    }

  /**
   * File backup job
   */
  private async fileBackup(): Promise<void> {
    const backupDir = '/var/backups/atulya-panel';
    await fs.ensureDir(backupDir);
    
    const timestamp = new Date().toISOString().split('T')[0];
    const backupPath = path.join(backupDir, `backup-${timestamp}.tar.gz`);
    
    // Backup important directories
    await execAsync(`tar -czf ${backupPath} /etc/nginx /etc/apache2 /var/www /etc/ssl`);
    
    }

  /**
   * Security scan job
   */
  private async securityScan(): Promise<void> {
    // Check for failed login attempts
    const { stdout } = await execAsync('grep "Failed password" /var/log/auth.log | wc -l');
    const failedLogins = parseInt(stdout.trim());
    
    if (failedLogins > 100) {
      }
    
    // Check for suspicious processes
    const { stdout: processes } = await execAsync('ps aux | grep -E "(nc|netcat|nmap|masscan)" | grep -v grep | wc -l');
    const suspiciousProcesses = parseInt(processes.trim());
    
    if (suspiciousProcesses > 0) {
      }
    
    }

  /**
   * SSL renewal job
   */
  private async sslRenewal(): Promise<void> {
    try {
      // Check Let's Encrypt certificates
      await execAsync('certbot renew --dry-run');
      } catch (error) {
      }
  }

  /**
   * Temporary cleanup job
   */
  private async tempCleanup(): Promise<void> {
    // Clean application temp files
    await execAsync('find /tmp -type f -atime +1 -delete');
    await execAsync('find /var/tmp -type f -atime +1 -delete');
    
    // Clean browser caches
    await execAsync('find /home -name ".cache" -type d -exec rm -rf {} + 2>/dev/null || true');
    
    }

  /**
   * Old backup cleanup job
   */
  private async oldBackupCleanup(): Promise<void> {
    // Remove backups older than 30 days
    await execAsync('find /var/backups -type f -mtime +30 -delete');
    
    }

  /**
   * Add job result to history
   */
  private addJobHistory(jobName: string, result: JobResult): void {
    if (!this.jobHistory.has(jobName)) {
      this.jobHistory.set(jobName, []);
    }
    
    const history = this.jobHistory.get(jobName)!;
    history.push(result);
    
    // Keep only last 100 results
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
  }

  /**
   * Store health status in database
   */
  private async storeHealthStatus(healthStatus: any): Promise<void> {
    try {
      await prisma.healthStatus.create({
        data: {
          timestamp: healthStatus.timestamp,
          services: healthStatus.services,
          resources: healthStatus.resources,
          alerts: healthStatus.alerts
        }
      });
    } catch (error) {
      
    }
  }

  /**
   * Store metrics in database
   */
  private async storeMetrics(metrics: any): Promise<void> {
    try {
      await prisma.systemMetrics.create({
        data: {
          timestamp: new Date(),
          cpu: metrics.cpu,
          memory: metrics.memory,
          disk: metrics.disk,
          network: metrics.network
        }
      });
    } catch (error) {
      
    }
  }

  /**
   * Send job failure alert
   */
  private async sendJobFailureAlert(jobName: string, error: any): Promise<void> {
    try {
      await this.emailProvider.sendEmail({
        to: 'admin@localhost',
        subject: `Job Failure Alert: ${jobName}`,
        text: `Job ${jobName} failed with error: ${error.message || error}`,
        html: `<h2>Job Failure Alert</h2><p>Job: ${jobName}</p><p>Error: ${error.message || error}</p><p>Time: ${new Date().toISOString()}</p>`
      });
    } catch (error) {
      
    }
  }

  /**
   * Send health alert
   */
  private async sendHealthAlert(healthStatus: any): Promise<void> {
    try {
      const alertText = healthStatus.alerts.join('\n');
      await this.emailProvider.sendEmail({
        to: 'admin@localhost',
        subject: 'System Health Alert',
        text: `System health issues detected:\n\n${alertText}`,
        html: `<h2>System Health Alert</h2><p>Issues detected:</p><ul>${healthStatus.alerts.map((alert: string) => `<li>${alert}</li>`).join('')}</ul>`
      });
    } catch (error) {
      
    }
  }

  /**
   * Get job status
   */
  getJobStatus(): { [key: string]: { running: boolean; lastRun?: Date | undefined; nextRun?: Date | undefined } } {
    const status: { [key: string]: { running: boolean; lastRun?: Date | undefined; nextRun?: Date | undefined } } = {};
    
    for (const [name] of this.jobs) {
      status[name] = {
        running: false, // cron.ScheduledTask doesn't have a running property
        lastRun: this.getLastRunTime(name),
        nextRun: this.getNextRunTime(name)
      };
    }
    
    return status;
  }

  /**
   * Get last run time for a job
   */
  private getLastRunTime(jobName: string): Date | undefined {
    const history = this.jobHistory.get(jobName);
    if (history && history.length > 0) {
      const lastJob = history[history.length - 1];
      return lastJob?.timestamp;
    }
    return undefined;
  }

  /**
   * Get next run time for a job
   */
  private getNextRunTime(_jobName: string): Date | undefined {
    // This would require parsing cron expressions, simplified for now
    return undefined;
  }

  /**
   * Stop all jobs
   */
  stopAllJobs(): void {
    for (const [name, task] of this.jobs) {
      task.stop();
      }
  }

  /**
   * Restart a specific job
   */
  restartJob(jobName: string): boolean {
    const task = this.jobs.get(jobName);
    if (task) {
      task.stop();
      task.start();
      return true;
    }
    return false;
  }
}

// Export the setup function
export async function setupJobs(): Promise<void> {
  const jobManager = new JobManager();
  await jobManager.setupJobs();
  
  // Store job manager instance for later use
  (global as any).jobManager = jobManager;
  
  }
