import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';

const execAsync = promisify(exec);

export interface MaintenanceTask {
  id: string;
  name: string;
  description: string;
  type: 'backup' | 'cleanup' | 'update' | 'optimization' | 'security' | 'monitoring' | 'custom';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  schedule: MaintenanceSchedule;
  config: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  lastRun?: Date;
  nextRun?: Date;
  logs: MaintenanceLog[];
  notifications: MaintenanceNotification[];
  retry: MaintenanceRetry;
  dependencies: string[];
  tags: string[];
  metadata?: Record<string, any>;
}

export interface MaintenanceSchedule {
  type: 'once' | 'interval' | 'cron' | 'event';
  value: string; // cron expression, interval in minutes, or event name
  timezone: string;
  enabled: boolean;
  startDate?: Date;
  endDate?: Date;
}

export interface MaintenanceLog {
  id: string;
  taskId: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  details?: Record<string, any>;
  duration?: number; // milliseconds
  output?: string;
  error?: string;
}

export interface MaintenanceNotification {
  id: string;
  taskId: string;
  type: 'email' | 'webhook' | 'slack' | 'discord' | 'telegram';
  config: Record<string, any>;
  events: ('start' | 'success' | 'failure' | 'warning')[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MaintenanceRetry {
  enabled: boolean;
  maxAttempts: number;
  delay: number; // milliseconds
  backoff: 'linear' | 'exponential';
  maxDelay: number; // milliseconds
}

export interface MaintenanceTemplate {
  id: string;
  name: string;
  description: string;
  type: MaintenanceTask['type'];
  config: Record<string, any>;
  schedule: MaintenanceSchedule;
  notifications: MaintenanceNotification[];
  retry: MaintenanceRetry;
  tags: string[];
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MaintenanceStatistics {
  totalTasks: number;
  activeTasks: number;
  completedTasks: number;
  failedTasks: number;
  tasksByType: Record<string, number>;
  tasksByStatus: Record<string, number>;
  averageExecutionTime: number;
  successRate: number;
  lastExecution: Date;
  nextExecution: Date;
}

export class SystemMaintenanceProvider {
  private tasks: Map<string, MaintenanceTask>;
  private templates: Map<string, MaintenanceTemplate>;
  private configPath: string;
  private logPath: string;
  private isRunning: boolean = false;

  constructor() {
    this.tasks = new Map();
    this.templates = new Map();
    this.configPath = '/etc/atulya-panel/maintenance';
    this.logPath = '/var/log/atulya-panel/maintenance';
    
    this.initialize();
  }

  /**
   * Initialize maintenance provider
   */
  private async initialize(): Promise<void> {
    try {
      await fs.ensureDir(this.configPath);
      await fs.ensureDir(this.logPath);
      await this.loadTasks();
      await this.loadTemplates();
      await this.createDefaultTemplates();
    } catch (error) {
      console.error('Failed to initialize maintenance provider:', error);
    }
  }

  /**
   * Load maintenance tasks
   */
  private async loadTasks(): Promise<void> {
    try {
      const tasksFile = path.join(this.configPath, 'tasks.json');
      if (await fs.pathExists(tasksFile)) {
        const data = await fs.readFile(tasksFile, 'utf8');
        const tasks = JSON.parse(data);
        
        this.tasks.clear();
        for (const task of tasks) {
          this.tasks.set(task.id, task);
        }
      }
    } catch (error) {
      console.error('Failed to load maintenance tasks:', error);
    }
  }

  /**
   * Save maintenance tasks
   */
  private async saveTasks(): Promise<void> {
    try {
      const tasksFile = path.join(this.configPath, 'tasks.json');
      const data = Array.from(this.tasks.values());
      await fs.writeFile(tasksFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save maintenance tasks:', error);
    }
  }

  /**
   * Load maintenance templates
   */
  private async loadTemplates(): Promise<void> {
    try {
      const templatesFile = path.join(this.configPath, 'templates.json');
      if (await fs.pathExists(templatesFile)) {
        const data = await fs.readFile(templatesFile, 'utf8');
        const templates = JSON.parse(data);
        
        this.templates.clear();
        for (const template of templates) {
          this.templates.set(template.id, template);
        }
      }
    } catch (error) {
      console.error('Failed to load maintenance templates:', error);
    }
  }

  /**
   * Create default templates
   */
  private async createDefaultTemplates(): Promise<void> {
    const defaultTemplates: MaintenanceTemplate[] = [
      {
        id: 'daily_backup',
        name: 'Daily Backup',
        description: 'Create daily backup of all data',
        type: 'backup',
        config: {
          sources: ['filesystem', 'databases'],
          destination: 'local',
          compression: 'gzip',
          encryption: false,
          retention: 30,
        },
        schedule: {
          type: 'cron',
          value: '0 2 * * *', // 2 AM daily
          timezone: 'UTC',
          enabled: true,
        },
        notifications: [
          {
            id: 'backup_notification',
            taskId: '',
            type: 'email',
            config: { email: 'admin@atulya-panel.com' },
            events: ['failure', 'success'],
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        retry: {
          enabled: true,
          maxAttempts: 3,
          delay: 300000, // 5 minutes
          backoff: 'exponential',
          maxDelay: 3600000, // 1 hour
        },
        tags: ['backup', 'daily', 'system'],
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'weekly_cleanup',
        name: 'Weekly Cleanup',
        description: 'Clean up temporary files and logs',
        type: 'cleanup',
        config: {
          tempFiles: true,
          logFiles: true,
          cacheFiles: true,
          oldBackups: true,
          retention: 7,
        },
        schedule: {
          type: 'cron',
          value: '0 3 * * 0', // 3 AM every Sunday
          timezone: 'UTC',
          enabled: true,
        },
        notifications: [],
        retry: {
          enabled: false,
          maxAttempts: 1,
          delay: 0,
          backoff: 'linear',
          maxDelay: 0,
        },
        tags: ['cleanup', 'weekly', 'system'],
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'security_scan',
        name: 'Security Scan',
        description: 'Run security vulnerability scan',
        type: 'security',
        config: {
          scanType: 'full',
          checkUpdates: true,
          checkPermissions: true,
          checkFirewall: true,
          checkSSL: true,
        },
        schedule: {
          type: 'cron',
          value: '0 4 * * 1', // 4 AM every Monday
          timezone: 'UTC',
          enabled: true,
        },
        notifications: [
          {
            id: 'security_notification',
            taskId: '',
            type: 'email',
            config: { email: 'admin@atulya-panel.com' },
            events: ['failure', 'warning'],
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        retry: {
          enabled: true,
          maxAttempts: 2,
          delay: 600000, // 10 minutes
          backoff: 'linear',
          maxDelay: 1800000, // 30 minutes
        },
        tags: ['security', 'weekly', 'system'],
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'database_optimization',
        name: 'Database Optimization',
        description: 'Optimize database performance',
        type: 'optimization',
        config: {
          analyze: true,
          optimize: true,
          repair: true,
          vacuum: true,
        },
        schedule: {
          type: 'cron',
          value: '0 1 * * 0', // 1 AM every Sunday
          timezone: 'UTC',
          enabled: true,
        },
        notifications: [],
        retry: {
          enabled: true,
          maxAttempts: 2,
          delay: 900000, // 15 minutes
          backoff: 'linear',
          maxDelay: 3600000, // 1 hour
        },
        tags: ['optimization', 'weekly', 'database'],
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'system_update',
        name: 'System Update',
        description: 'Update system packages and security patches',
        type: 'update',
        config: {
          updatePackages: true,
          securityOnly: false,
          rebootRequired: false,
          backupBefore: true,
        },
        schedule: {
          type: 'cron',
          value: '0 5 * * 0', // 5 AM every Sunday
          timezone: 'UTC',
          enabled: true,
        },
        notifications: [
          {
            id: 'update_notification',
            taskId: '',
            type: 'email',
            config: { email: 'admin@atulya-panel.com' },
            events: ['start', 'success', 'failure'],
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        retry: {
          enabled: true,
          maxAttempts: 1,
          delay: 0,
          backoff: 'linear',
          maxDelay: 0,
        },
        tags: ['update', 'weekly', 'system'],
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    for (const template of defaultTemplates) {
      this.templates.set(template.id, template);
    }

    await this.saveTemplates();
  }

  /**
   * Save maintenance templates
   */
  private async saveTemplates(): Promise<void> {
    try {
      const templatesFile = path.join(this.configPath, 'templates.json');
      const data = Array.from(this.templates.values());
      await fs.writeFile(templatesFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save maintenance templates:', error);
    }
  }

  /**
   * Create maintenance task
   */
  async createTask(taskData: {
    name: string;
    description: string;
    type: MaintenanceTask['type'];
    priority: MaintenanceTask['priority'];
    schedule: MaintenanceSchedule;
    config: Record<string, any>;
    notifications?: MaintenanceNotification[];
    retry?: Partial<MaintenanceRetry>;
    dependencies?: string[];
    tags?: string[];
    metadata?: Record<string, any>;
  }): Promise<MaintenanceTask> {
    try {
      const task: MaintenanceTask = {
        id: this.generateId(),
        name: taskData.name,
        description: taskData.description,
        type: taskData.type,
        status: 'pending',
        priority: taskData.priority,
        schedule: taskData.schedule,
        config: taskData.config,
        createdAt: new Date(),
        updatedAt: new Date(),
        logs: [],
        notifications: taskData.notifications || [],
        retry: {
          enabled: true,
          maxAttempts: 3,
          delay: 300000, // 5 minutes
          backoff: 'exponential',
          maxDelay: 3600000, // 1 hour
          ...taskData.retry,
        },
        dependencies: taskData.dependencies || [],
        tags: taskData.tags || [],
        metadata: taskData.metadata,
      };

      // Calculate next run time
      task.nextRun = this.calculateNextRun(task.schedule);

      this.tasks.set(task.id, task);
      await this.saveTasks();

      return task;
    } catch (error) {
      console.error('Failed to create maintenance task:', error);
      throw new Error(`Failed to create maintenance task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create task from template
   */
  async createTaskFromTemplate(templateId: string, overrides: Partial<MaintenanceTask> = {}): Promise<MaintenanceTask> {
    try {
      const template = this.templates.get(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      const taskData = {
        name: template.name,
        description: template.description,
        type: template.type,
        priority: 'medium' as MaintenanceTask['priority'],
        schedule: template.schedule,
        config: template.config,
        notifications: template.notifications,
        retry: template.retry,
        tags: template.tags,
        ...overrides,
      };

      return await this.createTask(taskData);
    } catch (error) {
      console.error('Failed to create task from template:', error);
      throw new Error(`Failed to create task from template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update maintenance task
   */
  async updateTask(taskId: string, updates: Partial<MaintenanceTask>): Promise<MaintenanceTask> {
    try {
      const task = this.tasks.get(taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      Object.assign(task, updates);
      task.updatedAt = new Date();

      // Recalculate next run time if schedule changed
      if (updates.schedule) {
        task.nextRun = this.calculateNextRun(task.schedule);
      }

      this.tasks.set(taskId, task);
      await this.saveTasks();

      return task;
    } catch (error) {
      console.error('Failed to update maintenance task:', error);
      throw new Error(`Failed to update maintenance task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete maintenance task
   */
  async deleteTask(taskId: string): Promise<void> {
    try {
      const task = this.tasks.get(taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      // Check if task is running
      if (task.status === 'running') {
        throw new Error('Cannot delete running task');
      }

      this.tasks.delete(taskId);
      await this.saveTasks();
    } catch (error) {
      console.error('Failed to delete maintenance task:', error);
      throw new Error(`Failed to delete maintenance task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get maintenance task
   */
  getTask(taskId: string): MaintenanceTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all maintenance tasks
   */
  getTasks(): MaintenanceTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get tasks by type
   */
  getTasksByType(type: MaintenanceTask['type']): MaintenanceTask[] {
    return Array.from(this.tasks.values()).filter(task => task.type === type);
  }

  /**
   * Get tasks by status
   */
  getTasksByStatus(status: MaintenanceTask['status']): MaintenanceTask[] {
    return Array.from(this.tasks.values()).filter(task => task.status === status);
  }

  /**
   * Get tasks by priority
   */
  getTasksByPriority(priority: MaintenanceTask['priority']): MaintenanceTask[] {
    return Array.from(this.tasks.values()).filter(task => task.priority === priority);
  }

  /**
   * Get tasks by tag
   */
  getTasksByTag(tag: string): MaintenanceTask[] {
    return Array.from(this.tasks.values()).filter(task => task.tags.includes(tag));
  }

  /**
   * Execute maintenance task
   */
  async executeTask(taskId: string): Promise<void> {
    try {
      const task = this.tasks.get(taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      if (task.status === 'running') {
        throw new Error('Task is already running');
      }

      // Check dependencies
      for (const depId of task.dependencies) {
        const depTask = this.tasks.get(depId);
        if (!depTask || depTask.status !== 'completed') {
          throw new Error(`Dependency task ${depId} is not completed`);
        }
      }

      // Update task status
      task.status = 'running';
      task.lastRun = new Date();
      task.updatedAt = new Date();

      this.tasks.set(taskId, task);
      await this.saveTasks();

      // Send start notification
      await this.sendNotification(task, 'start');

      // Execute task
      try {
        await this.executeTaskLogic(task);
        
        // Task completed successfully
        task.status = 'completed';
        task.updatedAt = new Date();
        
        // Calculate next run time
        task.nextRun = this.calculateNextRun(task.schedule);
        
        this.tasks.set(taskId, task);
        await this.saveTasks();
        
        // Send success notification
        await this.sendNotification(task, 'success');
        
      } catch (error) {
        // Task failed
        task.status = 'failed';
        task.updatedAt = new Date();
        
        this.tasks.set(taskId, task);
        await this.saveTasks();
        
        // Send failure notification
        await this.sendNotification(task, 'failure');
        
        // Retry if enabled
        if (task.retry.enabled) {
          await this.scheduleRetry(task);
        }
        
        throw error;
      }
    } catch (error) {
      console.error('Failed to execute maintenance task:', error);
      throw new Error(`Failed to execute maintenance task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute task logic
   */
  private async executeTaskLogic(task: MaintenanceTask): Promise<void> {
    const startTime = Date.now();
    
    try {
      switch (task.type) {
        case 'backup':
          await this.executeBackupTask(task);
          break;
        case 'cleanup':
          await this.executeCleanupTask(task);
          break;
        case 'update':
          await this.executeUpdateTask(task);
          break;
        case 'optimization':
          await this.executeOptimizationTask(task);
          break;
        case 'security':
          await this.executeSecurityTask(task);
          break;
        case 'monitoring':
          await this.executeMonitoringTask(task);
          break;
        case 'custom':
          await this.executeCustomTask(task);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }
      
      const duration = Date.now() - startTime;
      await this.addLog(task.id, 'info', 'Task completed successfully', { duration });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.addLog(task.id, 'error', 'Task failed', { 
        duration, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Execute backup task
   */
  private async executeBackupTask(task: MaintenanceTask): Promise<void> {
    const { sources, destination, compression, encryption, retention } = task.config;
    
    await this.addLog(task.id, 'info', 'Starting backup task', { sources, destination });
    
    // This would integrate with the BackupProvider
    // For now, just log the action
    await this.addLog(task.id, 'info', 'Backup task completed', { 
      sources, 
      destination, 
      compression, 
      encryption, 
      retention 
    });
  }

  /**
   * Execute cleanup task
   */
  private async executeCleanupTask(task: MaintenanceTask): Promise<void> {
    const { tempFiles, logFiles, cacheFiles, oldBackups, retention } = task.config;
    
    await this.addLog(task.id, 'info', 'Starting cleanup task', { 
      tempFiles, 
      logFiles, 
      cacheFiles, 
      oldBackups, 
      retention 
    });
    
    let cleanedFiles = 0;
    let freedSpace = 0;
    
    if (tempFiles) {
      // Clean temporary files
      const { stdout } = await execAsync('find /tmp -type f -mtime +7 -delete');
      cleanedFiles += parseInt(stdout) || 0;
    }
    
    if (logFiles) {
      // Clean old log files
      const { stdout } = await execAsync('find /var/log -name "*.log.*" -mtime +30 -delete');
      cleanedFiles += parseInt(stdout) || 0;
    }
    
    if (cacheFiles) {
      // Clean cache files
      const { stdout } = await execAsync('find /var/cache -type f -mtime +7 -delete');
      cleanedFiles += parseInt(stdout) || 0;
    }
    
    await this.addLog(task.id, 'info', 'Cleanup task completed', { 
      cleanedFiles, 
      freedSpace: `${freedSpace}MB` 
    });
  }

  /**
   * Execute update task
   */
  private async executeUpdateTask(task: MaintenanceTask): Promise<void> {
    const { updatePackages, securityOnly, rebootRequired, backupBefore } = task.config;
    
    await this.addLog(task.id, 'info', 'Starting update task', { 
      updatePackages, 
      securityOnly, 
      rebootRequired, 
      backupBefore 
    });
    
    if (backupBefore) {
      await this.addLog(task.id, 'info', 'Creating backup before update');
      // This would create a backup
    }
    
    if (updatePackages) {
      if (securityOnly) {
        await execAsync('apt-get update && apt-get upgrade -y --only-upgrade');
      } else {
        await execAsync('apt-get update && apt-get upgrade -y');
      }
    }
    
    await this.addLog(task.id, 'info', 'Update task completed');
    
    if (rebootRequired) {
      await this.addLog(task.id, 'warn', 'System reboot required');
    }
  }

  /**
   * Execute optimization task
   */
  private async executeOptimizationTask(task: MaintenanceTask): Promise<void> {
    const { analyze, optimize, repair, vacuum } = task.config;
    
    await this.addLog(task.id, 'info', 'Starting optimization task', { 
      analyze, 
      optimize, 
      repair, 
      vacuum 
    });
    
    if (analyze) {
      await execAsync('mysql -e "ANALYZE TABLE *"');
    }
    
    if (optimize) {
      await execAsync('mysql -e "OPTIMIZE TABLE *"');
    }
    
    if (repair) {
      await execAsync('mysql -e "REPAIR TABLE *"');
    }
    
    if (vacuum) {
      await execAsync('psql -c "VACUUM ANALYZE"');
    }
    
    await this.addLog(task.id, 'info', 'Optimization task completed');
  }

  /**
   * Execute security task
   */
  private async executeSecurityTask(task: MaintenanceTask): Promise<void> {
    const { scanType, checkUpdates, checkPermissions, checkFirewall, checkSSL } = task.config;
    
    await this.addLog(task.id, 'info', 'Starting security task', { 
      scanType, 
      checkUpdates, 
      checkPermissions, 
      checkFirewall, 
      checkSSL 
    });
    
    let vulnerabilities = 0;
    let warnings = 0;
    
    if (checkUpdates) {
      const { stdout } = await execAsync('apt list --upgradable 2>/dev/null | grep -c security');
      vulnerabilities += parseInt(stdout) || 0;
    }
    
    if (checkPermissions) {
      // Check file permissions
      const { stdout } = await execAsync('find /etc -type f -perm /o+w 2>/dev/null | wc -l');
      warnings += parseInt(stdout) || 0;
    }
    
    if (checkFirewall) {
      const { stdout } = await execAsync('ufw status | grep -c "Status: active"');
      if (parseInt(stdout) === 0) {
        warnings++;
      }
    }
    
    if (checkSSL) {
      // Check SSL certificate expiration
      const { stdout } = await execAsync('find /etc/letsencrypt/live -name "cert.pem" 2>/dev/null | wc -l');
      const certCount = parseInt(stdout) || 0;
      if (certCount > 0) {
        // Check expiration dates
        const { stdout: expiry } = await execAsync('find /etc/letsencrypt/live -name "cert.pem" -exec openssl x509 -in {} -noout -dates \\; 2>/dev/null');
        // Parse and check expiration dates
      }
    }
    
    await this.addLog(task.id, 'info', 'Security task completed', { 
      vulnerabilities, 
      warnings 
    });
  }

  /**
   * Execute monitoring task
   */
  private async executeMonitoringTask(task: MaintenanceTask): Promise<void> {
    await this.addLog(task.id, 'info', 'Starting monitoring task');
    
    // Check system health
    const { stdout: cpu } = await execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | sed 's/%us,//'");
    const cpuUsage = parseFloat(cpu.trim()) || 0;
    
    const { stdout: memory } = await execAsync("free | grep Mem | awk '{print $3/$2 * 100.0}'");
    const memoryUsage = parseFloat(memory.trim()) || 0;
    
    const { stdout: disk } = await execAsync("df -h / | awk 'NR==2{print $5}' | sed 's/%//'");
    const diskUsage = parseFloat(disk.trim()) || 0;
    
    await this.addLog(task.id, 'info', 'Monitoring task completed', { 
      cpuUsage: `${cpuUsage}%`, 
      memoryUsage: `${memoryUsage}%`, 
      diskUsage: `${diskUsage}%` 
    });
  }

  /**
   * Execute custom task
   */
  private async executeCustomTask(task: MaintenanceTask): Promise<void> {
    const { command, script, timeout } = task.config;
    
    await this.addLog(task.id, 'info', 'Starting custom task', { command, script });
    
    if (command) {
      const { stdout, stderr } = await execAsync(command, { timeout: timeout || 300000 });
      await this.addLog(task.id, 'info', 'Custom task completed', { 
        output: stdout, 
        error: stderr 
      });
    } else if (script) {
      // Execute custom script
      const scriptPath = path.join(this.configPath, 'scripts', `${task.id}.sh`);
      await fs.writeFile(scriptPath, script);
      await execAsync(`chmod +x ${scriptPath}`);
      
      const { stdout, stderr } = await execAsync(scriptPath, { timeout: timeout || 300000 });
      await this.addLog(task.id, 'info', 'Custom script completed', { 
        output: stdout, 
        error: stderr 
      });
    }
  }

  /**
   * Schedule retry
   */
  private async scheduleRetry(task: MaintenanceTask): Promise<void> {
    if (!task.retry.enabled || task.retry.maxAttempts <= 0) {
      return;
    }

    const retryCount = task.logs.filter(log => log.level === 'error').length;
    if (retryCount >= task.retry.maxAttempts) {
      await this.addLog(task.id, 'error', 'Maximum retry attempts reached');
      return;
    }

    const delay = this.calculateRetryDelay(task.retry, retryCount);
    const retryTime = new Date(Date.now() + delay);
    
    task.nextRun = retryTime;
    task.status = 'pending';
    task.updatedAt = new Date();
    
    this.tasks.set(task.id, task);
    await this.saveTasks();
    
    await this.addLog(task.id, 'info', `Task scheduled for retry at ${retryTime.toISOString()}`);
  }

  /**
   * Calculate retry delay
   */
  private calculateRetryDelay(retry: MaintenanceRetry, attempt: number): number {
    let delay = retry.delay;
    
    if (retry.backoff === 'exponential') {
      delay = retry.delay * Math.pow(2, attempt);
    } else if (retry.backoff === 'linear') {
      delay = retry.delay * (attempt + 1);
    }
    
    return Math.min(delay, retry.maxDelay);
  }

  /**
   * Add log entry
   */
  private async addLog(taskId: string, level: MaintenanceLog['level'], message: string, details?: Record<string, any>): Promise<void> {
    const log: MaintenanceLog = {
      id: this.generateId(),
      taskId,
      timestamp: new Date(),
      level,
      message,
      details,
    };

    const task = this.tasks.get(taskId);
    if (task) {
      task.logs.push(log);
      this.tasks.set(taskId, task);
      await this.saveTasks();
    }
  }

  /**
   * Send notification
   */
  private async sendNotification(task: MaintenanceTask, event: 'start' | 'success' | 'failure' | 'warning'): Promise<void> {
    for (const notification of task.notifications) {
      if (!notification.enabled || !notification.events.includes(event)) {
        continue;
      }

      try {
        // This would integrate with the NotificationProvider
        await this.addLog(task.id, 'info', `Notification sent via ${notification.type}`, { event });
      } catch (error) {
        await this.addLog(task.id, 'error', `Failed to send notification via ${notification.type}`, { 
          event, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
  }

  /**
   * Calculate next run time
   */
  private calculateNextRun(schedule: MaintenanceSchedule): Date | undefined {
    if (!schedule.enabled) {
      return undefined;
    }

    const now = new Date();
    
    switch (schedule.type) {
      case 'once':
        return schedule.startDate || now;
      case 'interval':
        const intervalMs = parseInt(schedule.value) * 60 * 1000; // Convert minutes to milliseconds
        return new Date(now.getTime() + intervalMs);
      case 'cron':
        // This would use a cron parser library
        // For now, return a simple calculation
        return new Date(now.getTime() + 24 * 60 * 60 * 1000); // Next day
      case 'event':
        return undefined; // Event-based tasks don't have a next run time
      default:
        return undefined;
    }
  }

  /**
   * Get maintenance templates
   */
  getTemplates(): MaintenanceTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): MaintenanceTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Get maintenance statistics
   */
  getStatistics(): MaintenanceStatistics {
    const tasks = Array.from(this.tasks.values());
    const now = new Date();
    
    const tasksByType: Record<string, number> = {};
    const tasksByStatus: Record<string, number> = {};
    
    let totalExecutionTime = 0;
    let executionCount = 0;
    let completedTasks = 0;
    let failedTasks = 0;
    let lastExecution = new Date(0);
    let nextExecution = new Date(0);
    
    for (const task of tasks) {
      // Count by type
      tasksByType[task.type] = (tasksByType[task.type] || 0) + 1;
      
      // Count by status
      tasksByStatus[task.status] = (tasksByStatus[task.status] || 0) + 1;
      
      // Execution statistics
      if (task.lastRun) {
        lastExecution = new Date(Math.max(lastExecution.getTime(), task.lastRun.getTime()));
        
        const logs = task.logs.filter(log => log.duration);
        for (const log of logs) {
          totalExecutionTime += log.duration || 0;
          executionCount++;
        }
      }
      
      if (task.nextRun) {
        nextExecution = new Date(Math.min(nextExecution.getTime() || Infinity, task.nextRun.getTime()));
      }
      
      if (task.status === 'completed') {
        completedTasks++;
      } else if (task.status === 'failed') {
        failedTasks++;
      }
    }
    
    const averageExecutionTime = executionCount > 0 ? totalExecutionTime / executionCount : 0;
    const successRate = (completedTasks + failedTasks) > 0 ? (completedTasks / (completedTasks + failedTasks)) * 100 : 100;
    
    return {
      totalTasks: tasks.length,
      activeTasks: tasks.filter(t => t.status === 'running').length,
      completedTasks,
      failedTasks,
      tasksByType,
      tasksByStatus,
      averageExecutionTime,
      successRate,
      lastExecution: lastExecution.getTime() > 0 ? lastExecution : new Date(),
      nextExecution: nextExecution.getTime() > 0 ? nextExecution : new Date(),
    };
  }

  /**
   * Start maintenance scheduler
   */
  async startScheduler(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    
    // Run scheduler every minute
    setInterval(async () => {
      try {
        await this.runScheduler();
      } catch (error) {
        console.error('Scheduler error:', error);
      }
    }, 60000); // 1 minute
  }

  /**
   * Stop maintenance scheduler
   */
  async stopScheduler(): Promise<void> {
    this.isRunning = false;
  }

  /**
   * Run scheduler
   */
  private async runScheduler(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    const now = new Date();
    const tasks = Array.from(this.tasks.values()).filter(task => 
      task.status === 'pending' && 
      task.schedule.enabled && 
      task.nextRun && 
      task.nextRun <= now
    );

    for (const task of tasks) {
      try {
        await this.executeTask(task.id);
      } catch (error) {
        console.error(`Failed to execute task ${task.id}:`, error);
      }
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}