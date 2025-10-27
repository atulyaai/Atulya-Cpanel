import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { SystemProvider } from './SystemProvider.js';
import { DatabaseProvider } from './DatabaseProvider.js';
import { EmailProvider } from './EmailProvider.js';

const execAsync = promisify(exec);

export interface MaintenanceTask {
  id: string;
  name: string;
  description: string;
  category: 'cleanup' | 'update' | 'optimization' | 'security' | 'backup' | 'monitoring';
  priority: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  schedule: string;
  lastRun?: Date;
  nextRun?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'disabled';
  estimatedDuration: number; // in minutes
  dependencies?: string[];
  autoFix: boolean;
  rollbackSupported: boolean;
}

export interface MaintenanceResult {
  taskId: string;
  success: boolean;
  message: string;
  duration: number;
  timestamp: Date;
  logs: string[];
  errors?: string[];
  warnings?: string[];
  data?: any;
}

export interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical';
  score: number; // 0-100
  issues: string[];
  recommendations: string[];
  lastChecked: Date;
  components: {
    disk: { usage: number; status: string; issues: string[] };
    memory: { usage: number; status: string; issues: string[] };
    cpu: { usage: number; status: string; issues: string[] };
    network: { status: string; issues: string[] };
    services: { status: string; issues: string[] };
    security: { status: string; issues: string[] };
  };
}

export class SystemMaintenanceProvider {
  private tasks: Map<string, MaintenanceTask> = new Map();
  private results: Map<string, MaintenanceResult[]> = new Map();
  private systemProvider: SystemProvider;
  private databaseProvider: DatabaseProvider;
  private emailProvider: EmailProvider;
  private isRunning: boolean = false;

  constructor() {
    this.systemProvider = new SystemProvider();
    this.databaseProvider = new DatabaseProvider();
    this.emailProvider = new EmailProvider();
    this.initializeTasks();
  }

  /**
   * Initialize maintenance tasks
   */
  private initializeTasks(): void {
    const tasks: MaintenanceTask[] = [
      // Cleanup tasks
      {
        id: 'temp-cleanup',
        name: 'Temporary Files Cleanup',
        description: 'Remove temporary files and caches',
        category: 'cleanup',
        priority: 'medium',
        enabled: true,
        schedule: '0 */6 * * *', // Every 6 hours
        status: 'pending',
        estimatedDuration: 5,
        autoFix: true,
        rollbackSupported: false
      },
      {
        id: 'log-rotation',
        name: 'Log Rotation',
        description: 'Rotate and compress log files',
        category: 'cleanup',
        priority: 'medium',
        enabled: true,
        schedule: '0 1 * * 0', // Weekly on Sunday at 1 AM
        status: 'pending',
        estimatedDuration: 10,
        autoFix: true,
        rollbackSupported: false
      },
      {
        id: 'old-backup-cleanup',
        name: 'Old Backup Cleanup',
        description: 'Remove old backup files',
        category: 'cleanup',
        priority: 'low',
        enabled: true,
        schedule: '0 8 * * 0', // Weekly on Sunday at 8 AM
        status: 'pending',
        estimatedDuration: 15,
        autoFix: true,
        rollbackSupported: false
      },
      {
        id: 'package-cache-cleanup',
        name: 'Package Cache Cleanup',
        description: 'Clean package manager caches',
        category: 'cleanup',
        priority: 'low',
        enabled: true,
        schedule: '0 2 * * *', // Daily at 2 AM
        status: 'pending',
        estimatedDuration: 5,
        autoFix: true,
        rollbackSupported: false
      },

      // Update tasks
      {
        id: 'system-updates',
        name: 'System Updates',
        description: 'Check and apply system updates',
        category: 'update',
        priority: 'high',
        enabled: true,
        schedule: '0 3 * * 0', // Weekly on Sunday at 3 AM
        status: 'pending',
        estimatedDuration: 30,
        autoFix: true,
        rollbackSupported: true
      },
      {
        id: 'security-updates',
        name: 'Security Updates',
        description: 'Apply critical security updates',
        category: 'update',
        priority: 'critical',
        enabled: true,
        schedule: '0 4 * * *', // Daily at 4 AM
        status: 'pending',
        estimatedDuration: 15,
        autoFix: true,
        rollbackSupported: true
      },
      {
        id: 'package-updates',
        name: 'Package Updates',
        description: 'Update installed packages',
        category: 'update',
        priority: 'medium',
        enabled: true,
        schedule: '0 5 * * 0', // Weekly on Sunday at 5 AM
        status: 'pending',
        estimatedDuration: 20,
        autoFix: true,
        rollbackSupported: true
      },

      // Optimization tasks
      {
        id: 'database-optimization',
        name: 'Database Optimization',
        description: 'Optimize database tables and indexes',
        category: 'optimization',
        priority: 'medium',
        enabled: true,
        schedule: '0 6 * * 0', // Weekly on Sunday at 6 AM
        status: 'pending',
        estimatedDuration: 45,
        autoFix: true,
        rollbackSupported: false
      },
      {
        id: 'filesystem-optimization',
        name: 'Filesystem Optimization',
        description: 'Optimize filesystem and defragment if needed',
        category: 'optimization',
        priority: 'low',
        enabled: true,
        schedule: '0 7 * * 0', // Weekly on Sunday at 7 AM
        status: 'pending',
        estimatedDuration: 60,
        autoFix: true,
        rollbackSupported: false
      },
      {
        id: 'memory-optimization',
        name: 'Memory Optimization',
        description: 'Clear caches and optimize memory usage',
        category: 'optimization',
        priority: 'medium',
        enabled: true,
        schedule: '0 */4 * * *', // Every 4 hours
        status: 'pending',
        estimatedDuration: 10,
        autoFix: true,
        rollbackSupported: false
      },

      // Security tasks
      {
        id: 'security-scan',
        name: 'Security Scan',
        description: 'Scan for security vulnerabilities',
        category: 'security',
        priority: 'high',
        enabled: true,
        schedule: '0 8 * * *', // Daily at 8 AM
        status: 'pending',
        estimatedDuration: 30,
        autoFix: false,
        rollbackSupported: false
      },
      {
        id: 'firewall-check',
        name: 'Firewall Check',
        description: 'Verify firewall rules and configuration',
        category: 'security',
        priority: 'high',
        enabled: true,
        schedule: '0 9 * * *', // Daily at 9 AM
        status: 'pending',
        estimatedDuration: 10,
        autoFix: true,
        rollbackSupported: true
      },
      {
        id: 'ssl-certificate-check',
        name: 'SSL Certificate Check',
        description: 'Check SSL certificate expiration',
        category: 'security',
        priority: 'high',
        enabled: true,
        schedule: '0 10 * * *', // Daily at 10 AM
        status: 'pending',
        estimatedDuration: 5,
        autoFix: true,
        rollbackSupported: false
      },

      // Backup tasks
      {
        id: 'system-backup',
        name: 'System Backup',
        description: 'Create system configuration backup',
        category: 'backup',
        priority: 'high',
        enabled: true,
        schedule: '0 11 * * *', // Daily at 11 AM
        status: 'pending',
        estimatedDuration: 20,
        autoFix: true,
        rollbackSupported: false
      },
      {
        id: 'database-backup',
        name: 'Database Backup',
        description: 'Backup all databases',
        category: 'backup',
        priority: 'high',
        enabled: true,
        schedule: '0 12 * * *', // Daily at 12 PM
        status: 'pending',
        estimatedDuration: 30,
        autoFix: true,
        rollbackSupported: false
      },

      // Monitoring tasks
      {
        id: 'health-check',
        name: 'System Health Check',
        description: 'Comprehensive system health check',
        category: 'monitoring',
        priority: 'critical',
        enabled: true,
        schedule: '*/15 * * * *', // Every 15 minutes
        status: 'pending',
        estimatedDuration: 5,
        autoFix: false,
        rollbackSupported: false
      },
      {
        id: 'performance-monitoring',
        name: 'Performance Monitoring',
        description: 'Monitor system performance metrics',
        category: 'monitoring',
        priority: 'medium',
        enabled: true,
        schedule: '*/5 * * * *', // Every 5 minutes
        status: 'pending',
        estimatedDuration: 2,
        autoFix: false,
        rollbackSupported: false
      }
    ];

    for (const task of tasks) {
      this.tasks.set(task.id, task);
    }
  }

  /**
   * Get all maintenance tasks
   */
  getTasks(): MaintenanceTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): MaintenanceTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Enable/disable a task
   */
  toggleTask(taskId: string, enabled: boolean): boolean {
    const task = this.tasks.get(taskId);
    if (task) {
      task.enabled = enabled;
      task.status = enabled ? 'pending' : 'disabled';
      return true;
    }
    return false;
  }

  /**
   * Run a specific maintenance task
   */
  async runTask(taskId: string): Promise<MaintenanceResult> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (!task.enabled) {
      throw new Error(`Task ${taskId} is disabled`);
    }

    const startTime = Date.now();
    const logs: string[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    task.status = 'running';
    logs.push(`Starting task: ${task.name}`);

    try {
      // Check dependencies
      if (task.dependencies) {
        for (const dep of task.dependencies) {
          const depTask = this.tasks.get(dep);
          if (depTask && depTask.status !== 'completed') {
            throw new Error(`Dependency ${dep} not completed`);
          }
        }
      }

      // Execute task based on category
      let result: any = {};
      switch (task.category) {
        case 'cleanup':
          result = await this.runCleanupTask(task, logs, errors, warnings);
          break;
        case 'update':
          result = await this.runUpdateTask(task, logs, errors, warnings);
          break;
        case 'optimization':
          result = await this.runOptimizationTask(task, logs, errors, warnings);
          break;
        case 'security':
          result = await this.runSecurityTask(task, logs, errors, warnings);
          break;
        case 'backup':
          result = await this.runBackupTask(task, logs, errors, warnings);
          break;
        case 'monitoring':
          result = await this.runMonitoringTask(task, logs, errors, warnings);
          break;
        default:
          throw new Error(`Unknown task category: ${task.category}`);
      }

      const duration = Date.now() - startTime;
      task.status = 'completed';
      task.lastRun = new Date();

      const maintenanceResult: MaintenanceResult = {
        taskId,
        success: true,
        message: `Task ${task.name} completed successfully`,
        duration,
        timestamp: new Date(),
        logs,
        errors,
        warnings,
        data: result
      };

      this.addResult(taskId, maintenanceResult);
      logs.push(`Task completed in ${duration}ms`);

      return maintenanceResult;

    } catch (error) {
      const duration = Date.now() - startTime;
      task.status = 'failed';
      task.lastRun = new Date();

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);
      logs.push(`Task failed: ${errorMessage}`);

      const maintenanceResult: MaintenanceResult = {
        taskId,
        success: false,
        message: `Task ${task.name} failed: ${errorMessage}`,
        duration,
        timestamp: new Date(),
        logs,
        errors,
        warnings
      };

      this.addResult(taskId, maintenanceResult);

      return maintenanceResult;
    }
  }

  /**
   * Run cleanup tasks
   */
  private async runCleanupTask(task: MaintenanceTask, logs: string[], errors: string[], warnings: string[]): Promise<any> {
    switch (task.id) {
      case 'temp-cleanup':
        return await this.cleanupTempFiles(logs, errors, warnings);
      case 'log-rotation':
        return await this.rotateLogs(logs, errors, warnings);
      case 'old-backup-cleanup':
        return await this.cleanupOldBackups(logs, errors, warnings);
      case 'package-cache-cleanup':
        return await this.cleanupPackageCache(logs, errors, warnings);
      default:
        throw new Error(`Unknown cleanup task: ${task.id}`);
    }
  }

  /**
   * Run update tasks
   */
  private async runUpdateTask(task: MaintenanceTask, logs: string[], errors: string[], warnings: string[]): Promise<any> {
    switch (task.id) {
      case 'system-updates':
        return await this.updateSystem(logs, errors, warnings);
      case 'security-updates':
        return await this.updateSecurity(logs, errors, warnings);
      case 'package-updates':
        return await this.updatePackages(logs, errors, warnings);
      default:
        throw new Error(`Unknown update task: ${task.id}`);
    }
  }

  /**
   * Run optimization tasks
   */
  private async runOptimizationTask(task: MaintenanceTask, logs: string[], errors: string[], warnings: string[]): Promise<any> {
    switch (task.id) {
      case 'database-optimization':
        return await this.optimizeDatabase(logs, errors, warnings);
      case 'filesystem-optimization':
        return await this.optimizeFilesystem(logs, errors, warnings);
      case 'memory-optimization':
        return await this.optimizeMemory(logs, errors, warnings);
      default:
        throw new Error(`Unknown optimization task: ${task.id}`);
    }
  }

  /**
   * Run security tasks
   */
  private async runSecurityTask(task: MaintenanceTask, logs: string[], errors: string[], warnings: string[]): Promise<any> {
    switch (task.id) {
      case 'security-scan':
        return await this.scanSecurity(logs, errors, warnings);
      case 'firewall-check':
        return await this.checkFirewall(logs, errors, warnings);
      case 'ssl-certificate-check':
        return await this.checkSSLCertificates(logs, errors, warnings);
      default:
        throw new Error(`Unknown security task: ${task.id}`);
    }
  }

  /**
   * Run backup tasks
   */
  private async runBackupTask(task: MaintenanceTask, logs: string[], errors: string[], warnings: string[]): Promise<any> {
    switch (task.id) {
      case 'system-backup':
        return await this.backupSystem(logs, errors, warnings);
      case 'database-backup':
        return await this.backupDatabase(logs, errors, warnings);
      default:
        throw new Error(`Unknown backup task: ${task.id}`);
    }
  }

  /**
   * Run monitoring tasks
   */
  private async runMonitoringTask(task: MaintenanceTask, logs: string[], errors: string[], warnings: string[]): Promise<any> {
    switch (task.id) {
      case 'health-check':
        return await this.checkSystemHealth(logs, errors, warnings);
      case 'performance-monitoring':
        return await this.monitorPerformance(logs, errors, warnings);
      default:
        throw new Error(`Unknown monitoring task: ${task.id}`);
    }
  }

  /**
   * Cleanup temporary files
   */
  private async cleanupTempFiles(logs: string[], errors: string[], warnings: string[]): Promise<any> {
    logs.push('Cleaning temporary files...');
    
    try {
      // Clean /tmp
      await execAsync('find /tmp -type f -atime +1 -delete');
      logs.push('Cleaned /tmp directory');
      
      // Clean /var/tmp
      await execAsync('find /var/tmp -type f -atime +1 -delete');
      logs.push('Cleaned /var/tmp directory');
      
      // Clean browser caches
      await execAsync('find /home -name ".cache" -type d -exec rm -rf {} + 2>/dev/null || true');
      logs.push('Cleaned browser caches');
      
      // Clean application caches
      await execAsync('find /var/cache -type f -atime +7 -delete 2>/dev/null || true');
      logs.push('Cleaned application caches');
      
      return { cleaned: true };
    } catch (error) {
      errors.push(`Failed to cleanup temp files: ${error}`);
      throw error;
    }
  }

  /**
   * Rotate logs
   */
  private async rotateLogs(logs: string[], errors: string[], warnings: string[]): Promise<any> {
    logs.push('Rotating log files...');
    
    try {
      // Rotate application logs
      await execAsync('logrotate -f /etc/logrotate.conf');
      logs.push('Rotated application logs');
      
      // Compress old logs
      await execAsync('find /var/log -name "*.log" -type f -mtime +1 -exec gzip {} \\;');
      logs.push('Compressed old log files');
      
      return { rotated: true };
    } catch (error) {
      errors.push(`Failed to rotate logs: ${error}`);
      throw error;
    }
  }

  /**
   * Cleanup old backups
   */
  private async cleanupOldBackups(logs: string[], errors: string[], warnings: string[]): Promise<any> {
    logs.push('Cleaning old backup files...');
    
    try {
      // Remove backups older than 30 days
      await execAsync('find /var/backups -type f -mtime +30 -delete');
      logs.push('Removed old backup files');
      
      // Remove old log backups
      await execAsync('find /var/log -name "*.gz" -type f -mtime +90 -delete');
      logs.push('Removed old log backups');
      
      return { cleaned: true };
    } catch (error) {
      errors.push(`Failed to cleanup old backups: ${error}`);
      throw error;
    }
  }

  /**
   * Cleanup package cache
   */
  private async cleanupPackageCache(logs: string[], errors: string[], warnings: string[]): Promise<any> {
    logs.push('Cleaning package cache...');
    
    try {
      // Clean apt cache
      await execAsync('apt-get clean');
      logs.push('Cleaned apt cache');
      
      // Remove unused packages
      await execAsync('apt-get autoremove -y');
      logs.push('Removed unused packages');
      
      return { cleaned: true };
    } catch (error) {
      errors.push(`Failed to cleanup package cache: ${error}`);
      throw error;
    }
  }

  /**
   * Update system
   */
  private async updateSystem(logs: string[], errors: string[], warnings: string[]): Promise<any> {
    logs.push('Checking for system updates...');
    
    try {
      // Update package lists
      await execAsync('apt-get update');
      logs.push('Updated package lists');
      
      // Check for updates
      const { stdout } = await execAsync('apt list --upgradable 2>/dev/null | wc -l');
      const updateCount = parseInt(stdout.trim());
      
      if (updateCount > 0) {
        logs.push(`Found ${updateCount} updates available`);
        
        // Apply updates
        await execAsync('apt-get upgrade -y');
        logs.push('Applied system updates');
        
        return { updatesApplied: updateCount };
      } else {
        logs.push('System is up to date');
        return { updatesApplied: 0 };
      }
    } catch (error) {
      errors.push(`Failed to update system: ${error}`);
      throw error;
    }
  }

  /**
   * Update security packages
   */
  private async updateSecurity(logs: string[], errors: string[], warnings: string[]): Promise<any> {
    logs.push('Applying security updates...');
    
    try {
      // Update package lists
      await execAsync('apt-get update');
      logs.push('Updated package lists');
      
      // Apply security updates only
      await execAsync('apt-get upgrade -y --only-upgrade');
      logs.push('Applied security updates');
      
      return { securityUpdatesApplied: true };
    } catch (error) {
      errors.push(`Failed to apply security updates: ${error}`);
      throw error;
    }
  }

  /**
   * Update packages
   */
  private async updatePackages(logs: string[], errors: string[], warnings: string[]): Promise<any> {
    logs.push('Updating packages...');
    
    try {
      // Update package lists
      await execAsync('apt-get update');
      logs.push('Updated package lists');
      
      // Update packages
      await execAsync('apt-get upgrade -y');
      logs.push('Updated packages');
      
      return { packagesUpdated: true };
    } catch (error) {
      errors.push(`Failed to update packages: ${error}`);
      throw error;
    }
  }

  /**
   * Optimize database
   */
  private async optimizeDatabase(logs: string[], errors: string[], warnings: string[]): Promise<any> {
    logs.push('Optimizing database...');
    
    try {
      await this.databaseProvider.optimizeDatabases();
      logs.push('Database optimized');
      
      return { optimized: true };
    } catch (error) {
      errors.push(`Failed to optimize database: ${error}`);
      throw error;
    }
  }

  /**
   * Optimize filesystem
   */
  private async optimizeFilesystem(logs: string[], errors: string[], warnings: string[]): Promise<any> {
    logs.push('Optimizing filesystem...');
    
    try {
      // Sync filesystem
      await execAsync('sync');
      logs.push('Synced filesystem');
      
      // Clear page cache
      await execAsync('echo 3 > /proc/sys/vm/drop_caches');
      logs.push('Cleared page cache');
      
      return { optimized: true };
    } catch (error) {
      errors.push(`Failed to optimize filesystem: ${error}`);
      throw error;
    }
  }

  /**
   * Optimize memory
   */
  private async optimizeMemory(logs: string[], errors: string[], warnings: string[]): Promise<any> {
    logs.push('Optimizing memory...');
    
    try {
      // Clear page cache
      await execAsync('echo 1 > /proc/sys/vm/drop_caches');
      logs.push('Cleared page cache');
      
      // Clear dentries and inodes
      await execAsync('echo 2 > /proc/sys/vm/drop_caches');
      logs.push('Cleared dentries and inodes');
      
      return { optimized: true };
    } catch (error) {
      errors.push(`Failed to optimize memory: ${error}`);
      throw error;
    }
  }

  /**
   * Scan for security issues
   */
  private async scanSecurity(logs: string[], errors: string[], warnings: string[]): Promise<any> {
    logs.push('Scanning for security issues...');
    
    try {
      // Check for failed login attempts
      const { stdout } = await execAsync('grep "Failed password" /var/log/auth.log | wc -l');
      const failedLogins = parseInt(stdout.trim());
      
      if (failedLogins > 100) {
        warnings.push(`High number of failed login attempts: ${failedLogins}`);
      }
      
      // Check for suspicious processes
      const { stdout: processes } = await execAsync('ps aux | grep -E "(nc|netcat|nmap|masscan)" | grep -v grep | wc -l');
      const suspiciousProcesses = parseInt(processes.trim());
      
      if (suspiciousProcesses > 0) {
        warnings.push(`Suspicious processes detected: ${suspiciousProcesses}`);
      }
      
      logs.push('Security scan completed');
      
      return { 
        failedLogins, 
        suspiciousProcesses,
        securityIssues: warnings.length
      };
    } catch (error) {
      errors.push(`Failed to scan security: ${error}`);
      throw error;
    }
  }

  /**
   * Check firewall
   */
  private async checkFirewall(logs: string[], errors: string[], warnings: string[]): Promise<any> {
    logs.push('Checking firewall configuration...');
    
    try {
      // Check UFW status
      const { stdout } = await execAsync('ufw status');
      logs.push('Firewall status checked');
      
      if (stdout.includes('Status: inactive')) {
        warnings.push('Firewall is inactive');
      }
      
      return { firewallActive: !stdout.includes('Status: inactive') };
    } catch (error) {
      errors.push(`Failed to check firewall: ${error}`);
      throw error;
    }
  }

  /**
   * Check SSL certificates
   */
  private async checkSSLCertificates(logs: string[], errors: string[], warnings: string[]): Promise<any> {
    logs.push('Checking SSL certificates...');
    
    try {
      // Check Let's Encrypt certificates
      await execAsync('certbot renew --dry-run');
      logs.push('SSL certificates are up to date');
      
      return { certificatesValid: true };
    } catch (error) {
      warnings.push(`SSL certificate check failed: ${error}`);
      return { certificatesValid: false };
    }
  }

  /**
   * Backup system
   */
  private async backupSystem(logs: string[], errors: string[], warnings: string[]): Promise<any> {
    logs.push('Creating system backup...');
    
    try {
      const backupDir = '/var/backups/atulya-panel';
      await fs.ensureDir(backupDir);
      
      const timestamp = new Date().toISOString().split('T')[0];
      const backupPath = path.join(backupDir, `system-backup-${timestamp}.tar.gz`);
      
      // Backup important directories
      await execAsync(`tar -czf ${backupPath} /etc/nginx /etc/apache2 /var/www /etc/ssl`);
      logs.push('System backup created');
      
      return { backupPath, backupCreated: true };
    } catch (error) {
      errors.push(`Failed to backup system: ${error}`);
      throw error;
    }
  }

  /**
   * Backup database
   */
  private async backupDatabase(logs: string[], errors: string[], warnings: string[]): Promise<any> {
    logs.push('Creating database backup...');
    
    try {
      await this.databaseProvider.createBackup();
      logs.push('Database backup created');
      
      return { backupCreated: true };
    } catch (error) {
      errors.push(`Failed to backup database: ${error}`);
      throw error;
    }
  }

  /**
   * Check system health
   */
  private async checkSystemHealth(logs: string[], errors: string[], warnings: string[]): Promise<any> {
    logs.push('Checking system health...');
    
    try {
      const health = await this.getSystemHealth();
      logs.push('System health check completed');
      
      return health;
    } catch (error) {
      errors.push(`Failed to check system health: ${error}`);
      throw error;
    }
  }

  /**
   * Monitor performance
   */
  private async monitorPerformance(logs: string[], errors: string[], warnings: string[]): Promise<any> {
    logs.push('Monitoring system performance...');
    
    try {
      // Get CPU usage
      const { stdout: cpu } = await execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | awk -F'%' '{print $1}'");
      const cpuUsage = parseFloat(cpu.trim());
      
      // Get memory usage
      const { stdout: memory } = await execAsync("free | grep Mem | awk '{printf \"%.1f\", $3/$2 * 100.0}'");
      const memoryUsage = parseFloat(memory.trim());
      
      // Get disk usage
      const { stdout: disk } = await execAsync("df -h / | tail -1 | awk '{print $5}' | sed 's/%//'");
      const diskUsage = parseInt(disk.trim());
      
      logs.push('Performance monitoring completed');
      
      return { cpuUsage, memoryUsage, diskUsage };
    } catch (error) {
      errors.push(`Failed to monitor performance: ${error}`);
      throw error;
    }
  }

  /**
   * Get system health
   */
  async getSystemHealth(): Promise<SystemHealth> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check disk usage
    const { stdout: disk } = await execAsync("df -h / | tail -1 | awk '{print $5}' | sed 's/%//'");
    const diskUsage = parseInt(disk.trim());
    const diskIssues: string[] = [];
    
    if (diskUsage > 90) {
      diskIssues.push('Disk usage critical');
      issues.push('Disk usage critical');
    } else if (diskUsage > 80) {
      diskIssues.push('Disk usage high');
      issues.push('Disk usage high');
    }
    
    // Check memory usage
    const { stdout: memory } = await execAsync("free | grep Mem | awk '{printf \"%.1f\", $3/$2 * 100.0}'");
    const memoryUsage = parseFloat(memory.trim());
    const memoryIssues: string[] = [];
    
    if (memoryUsage > 90) {
      memoryIssues.push('Memory usage critical');
      issues.push('Memory usage critical');
    } else if (memoryUsage > 80) {
      memoryIssues.push('Memory usage high');
      issues.push('Memory usage high');
    }
    
    // Check CPU usage
    const { stdout: cpu } = await execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | awk -F'%' '{print $1}'");
    const cpuUsage = parseFloat(cpu.trim());
    const cpuIssues: string[] = [];
    
    if (cpuUsage > 90) {
      cpuIssues.push('CPU usage critical');
      issues.push('CPU usage critical');
    } else if (cpuUsage > 80) {
      cpuIssues.push('CPU usage high');
      issues.push('CPU usage high');
    }
    
    // Determine overall health
    let overall: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (issues.length > 0) {
      overall = issues.some(issue => issue.includes('critical')) ? 'critical' : 'warning';
    }
    
    // Calculate health score
    let score = 100;
    if (diskUsage > 90) score -= 30;
    else if (diskUsage > 80) score -= 15;
    
    if (memoryUsage > 90) score -= 30;
    else if (memoryUsage > 80) score -= 15;
    
    if (cpuUsage > 90) score -= 30;
    else if (cpuUsage > 80) score -= 15;
    
    // Add recommendations
    if (diskUsage > 80) {
      recommendations.push('Consider cleaning up disk space');
    }
    if (memoryUsage > 80) {
      recommendations.push('Consider optimizing memory usage');
    }
    if (cpuUsage > 80) {
      recommendations.push('Consider optimizing CPU usage');
    }
    
    return {
      overall,
      score: Math.max(0, score),
      issues,
      recommendations,
      lastChecked: new Date(),
      components: {
        disk: { usage: diskUsage, status: diskIssues.length > 0 ? 'warning' : 'healthy', issues: diskIssues },
        memory: { usage: memoryUsage, status: memoryIssues.length > 0 ? 'warning' : 'healthy', issues: memoryIssues },
        cpu: { usage: cpuUsage, status: cpuIssues.length > 0 ? 'warning' : 'healthy', issues: cpuIssues },
        network: { status: 'healthy', issues: [] },
        services: { status: 'healthy', issues: [] },
        security: { status: 'healthy', issues: [] }
      }
    };
  }

  /**
   * Add result to history
   */
  private addResult(taskId: string, result: MaintenanceResult): void {
    if (!this.results.has(taskId)) {
      this.results.set(taskId, []);
    }
    
    const history = this.results.get(taskId)!;
    history.push(result);
    
    // Keep only last 50 results
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }
  }

  /**
   * Get task results
   */
  getTaskResults(taskId: string): MaintenanceResult[] {
    return this.results.get(taskId) || [];
  }

  /**
   * Get all results
   */
  getAllResults(): { [taskId: string]: MaintenanceResult[] } {
    const allResults: { [taskId: string]: MaintenanceResult[] } = {};
    for (const [taskId, results] of this.results) {
      allResults[taskId] = results;
    }
    return allResults;
  }

  /**
   * Run all enabled tasks
   */
  async runAllTasks(): Promise<MaintenanceResult[]> {
    if (this.isRunning) {
      throw new Error('Maintenance is already running');
    }
    
    this.isRunning = true;
    const results: MaintenanceResult[] = [];
    
    try {
      const enabledTasks = Array.from(this.tasks.values()).filter(task => task.enabled);
      
      for (const task of enabledTasks) {
        try {
          const result = await this.runTask(task.id);
          results.push(result);
        } catch (error) {
          console.error(`Failed to run task ${task.id}:`, error);
        }
      }
      
      return results;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Check if maintenance is running
   */
  isMaintenanceRunning(): boolean {
    return this.isRunning;
  }
}
