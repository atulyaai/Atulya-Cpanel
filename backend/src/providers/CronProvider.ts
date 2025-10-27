import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';

const execAsync = promisify(exec);

export interface CronJob {
  id: string;
  name: string;
  description?: string;
  command: string;
  schedule: string;
  user: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastRun?: Date;
  nextRun?: Date;
  status: 'active' | 'inactive' | 'failed' | 'paused';
  environment: Record<string, string>;
  workingDirectory: string;
  output: CronOutput;
  notifications: CronNotification;
  retry: CronRetry;
  timeout: number;
  logs: CronLog[];
}

export interface CronOutput {
  enabled: boolean;
  file?: string;
  email?: string;
  webhook?: string;
  maxSize: number;
  maxLines: number;
}

export interface CronNotification {
  onSuccess: boolean;
  onFailure: boolean;
  onStart: boolean;
  email: string[];
  webhook?: string;
  slack?: string;
}

export interface CronRetry {
  enabled: boolean;
  maxAttempts: number;
  delay: number;
  backoff: 'linear' | 'exponential';
}

export interface CronLog {
  timestamp: Date;
  level: 'info' | 'warning' | 'error';
  message: string;
  details?: any;
  duration?: number;
  exitCode?: number;
}

export interface CronTemplate {
  id: string;
  name: string;
  description: string;
  command: string;
  schedule: string;
  category: string;
  tags: string[];
}

export class CronProvider {
  private jobs: Map<string, CronJob>;
  private templates: Map<string, CronTemplate>;
  private cronPath: string;
  private logPath: string;

  constructor() {
    this.jobs = new Map();
    this.templates = new Map();
    this.cronPath = '/var/spool/cron/crontabs';
    this.logPath = '/var/log/atulya-panel/cron';
    
    this.initialize();
  }

  /**
   * Initialize cron provider
   */
  private async initialize(): Promise<void> {
    try {
      await fs.ensureDir(this.logPath);
      await this.loadTemplates();
      await this.loadJobs();
    } catch (error) {
      console.error('Failed to initialize cron provider:', error);
    }
  }

  /**
   * Load cron templates
   */
  private async loadTemplates(): Promise<void> {
    const templates: CronTemplate[] = [
      {
        id: 'backup_daily',
        name: 'Daily Backup',
        description: 'Create daily backup of important files',
        command: 'tar -czf /var/backups/daily-$(date +%Y%m%d).tar.gz /var/www /etc/nginx /etc/apache2',
        schedule: '0 2 * * *',
        category: 'backup',
        tags: ['backup', 'daily', 'maintenance'],
      },
      {
        id: 'log_rotation',
        name: 'Log Rotation',
        description: 'Rotate and compress log files',
        command: 'logrotate /etc/logrotate.d/atulya-panel',
        schedule: '0 0 * * *',
        category: 'maintenance',
        tags: ['logs', 'rotation', 'maintenance'],
      },
      {
        id: 'ssl_renewal',
        name: 'SSL Certificate Renewal',
        description: 'Check and renew SSL certificates',
        command: 'certbot renew --quiet --post-hook "systemctl reload nginx"',
        schedule: '0 3 * * 0',
        category: 'security',
        tags: ['ssl', 'security', 'certificates'],
      },
      {
        id: 'database_optimization',
        name: 'Database Optimization',
        description: 'Optimize database tables',
        command: 'mysql -e "OPTIMIZE TABLE information_schema.tables"',
        schedule: '0 4 * * 0',
        category: 'database',
        tags: ['database', 'optimization', 'maintenance'],
      },
      {
        id: 'disk_cleanup',
        name: 'Disk Cleanup',
        description: 'Clean up temporary files and old backups',
        command: 'find /tmp -type f -atime +7 -delete && find /var/backups -name "*.tar.gz" -mtime +30 -delete',
        schedule: '0 1 * * *',
        category: 'maintenance',
        tags: ['cleanup', 'disk', 'maintenance'],
      },
      {
        id: 'security_update',
        name: 'Security Updates',
        description: 'Check for security updates',
        command: 'apt-get update && apt-get upgrade -y --only-upgrade',
        schedule: '0 5 * * 0',
        category: 'security',
        tags: ['security', 'updates', 'maintenance'],
      },
      {
        id: 'monitoring_check',
        name: 'System Monitoring',
        description: 'Check system health and send alerts',
        command: '/usr/local/bin/atulya-panel-monitor.sh',
        schedule: '*/5 * * * *',
        category: 'monitoring',
        tags: ['monitoring', 'health', 'alerts'],
      },
    ];

    for (const template of templates) {
      this.templates.set(template.id, template);
    }
  }

  /**
   * Load cron jobs
   */
  private async loadJobs(): Promise<void> {
    try {
      const jobsFile = path.join(this.logPath, 'jobs.json');
      if (await fs.pathExists(jobsFile)) {
        const data = await fs.readFile(jobsFile, 'utf8');
        const jobs = JSON.parse(data);
        
        this.jobs.clear();
        for (const job of jobs) {
          this.jobs.set(job.id, job);
        }
      }
    } catch (error) {
      console.error('Failed to load cron jobs:', error);
    }
  }

  /**
   * Save cron jobs
   */
  private async saveJobs(): Promise<void> {
    try {
      const jobsFile = path.join(this.logPath, 'jobs.json');
      const data = Array.from(this.jobs.values());
      await fs.writeFile(jobsFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save cron jobs:', error);
    }
  }

  /**
   * Create cron job
   */
  async createJob(jobData: {
    name: string;
    description?: string;
    command: string;
    schedule: string;
    user: string;
    enabled?: boolean;
    environment?: Record<string, string>;
    workingDirectory?: string;
    output?: Partial<CronOutput>;
    notifications?: Partial<CronNotification>;
    retry?: Partial<CronRetry>;
    timeout?: number;
  }): Promise<CronJob> {
    try {
      const job: CronJob = {
        id: this.generateId(),
        name: jobData.name,
        description: jobData.description,
        command: jobData.command,
        schedule: jobData.schedule,
        user: jobData.user,
        enabled: jobData.enabled ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'active',
        environment: jobData.environment || {},
        workingDirectory: jobData.workingDirectory || '/',
        output: {
          enabled: jobData.output?.enabled ?? false,
          file: jobData.output?.file,
          email: jobData.output?.email,
          webhook: jobData.output?.webhook,
          maxSize: jobData.output?.maxSize || 10485760, // 10MB
          maxLines: jobData.output?.maxLines || 1000,
        },
        notifications: {
          onSuccess: jobData.notifications?.onSuccess ?? false,
          onFailure: jobData.notifications?.onFailure ?? true,
          onStart: jobData.notifications?.onStart ?? false,
          email: jobData.notifications?.email || [],
          webhook: jobData.notifications?.webhook,
          slack: jobData.notifications?.slack,
        },
        retry: {
          enabled: jobData.retry?.enabled ?? false,
          maxAttempts: jobData.retry?.maxAttempts || 3,
          delay: jobData.retry?.delay || 300, // 5 minutes
          backoff: jobData.retry?.backoff || 'linear',
        },
        timeout: jobData.timeout || 3600, // 1 hour
        logs: [],
      };

      this.jobs.set(job.id, job);
      await this.saveJobs();
      await this.updateCrontab(job);

      return job;
    } catch (error) {
      console.error('Failed to create cron job:', error);
      throw new Error(`Failed to create cron job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update cron job
   */
  async updateJob(id: string, updates: Partial<CronJob>): Promise<CronJob> {
    try {
      const job = this.jobs.get(id);
      if (!job) {
        throw new Error(`Cron job not found: ${id}`);
      }

      // Update job
      const updatedJob = {
        ...job,
        ...updates,
        updatedAt: new Date(),
      };

      this.jobs.set(id, updatedJob);
      await this.saveJobs();
      await this.updateCrontab(updatedJob);

      return updatedJob;
    } catch (error) {
      console.error('Failed to update cron job:', error);
      throw new Error(`Failed to update cron job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete cron job
   */
  async deleteJob(id: string): Promise<void> {
    try {
      const job = this.jobs.get(id);
      if (!job) {
        throw new Error(`Cron job not found: ${id}`);
      }

      // Remove from crontab
      await this.removeFromCrontab(job);

      // Remove from storage
      this.jobs.delete(id);
      await this.saveJobs();
    } catch (error) {
      console.error('Failed to delete cron job:', error);
      throw new Error(`Failed to delete cron job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Enable/disable cron job
   */
  async toggleJob(id: string, enabled: boolean): Promise<void> {
    try {
      const job = this.jobs.get(id);
      if (!job) {
        throw new Error(`Cron job not found: ${id}`);
      }

      job.enabled = enabled;
      job.status = enabled ? 'active' : 'inactive';
      job.updatedAt = new Date();

      await this.saveJobs();
      await this.updateCrontab(job);
    } catch (error) {
      console.error('Failed to toggle cron job:', error);
      throw new Error(`Failed to toggle cron job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute cron job manually
   */
  async executeJob(id: string): Promise<void> {
    try {
      const job = this.jobs.get(id);
      if (!job) {
        throw new Error(`Cron job not found: ${id}`);
      }

      job.status = 'active';
      job.lastRun = new Date();
      job.logs.push({
        timestamp: new Date(),
        level: 'info',
        message: 'Job execution started',
      });

      const startTime = Date.now();
      let exitCode = 0;

      try {
        // Set environment variables
        const env = { ...process.env, ...job.environment };
        
        // Execute command
        const { stdout, stderr } = await execAsync(job.command, {
          cwd: job.workingDirectory,
          env,
          timeout: job.timeout * 1000,
        });

        // Log output
        if (stdout) {
          job.logs.push({
            timestamp: new Date(),
            level: 'info',
            message: 'Job output',
            details: stdout,
          });
        }

        if (stderr) {
          job.logs.push({
            timestamp: new Date(),
            level: 'warning',
            message: 'Job stderr',
            details: stderr,
          });
        }

        // Send notifications
        if (job.notifications.onSuccess) {
          await this.sendNotification(job, 'success', stdout);
        }

      } catch (error) {
        exitCode = 1;
        job.status = 'failed';
        
        job.logs.push({
          timestamp: new Date(),
          level: 'error',
          message: `Job execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: error,
          exitCode,
        });

        // Send failure notification
        if (job.notifications.onFailure) {
          await this.sendNotification(job, 'failure', error instanceof Error ? error.message : 'Unknown error');
        }

        // Retry if enabled
        if (job.retry.enabled) {
          await this.scheduleRetry(job);
        }
      }

      const duration = Date.now() - startTime;
      job.logs.push({
        timestamp: new Date(),
        level: 'info',
        message: 'Job execution completed',
        duration,
        exitCode,
      });

      // Keep only recent logs
      if (job.logs.length > 100) {
        job.logs = job.logs.slice(-100);
      }

      await this.saveJobs();
    } catch (error) {
      console.error('Failed to execute cron job:', error);
      throw new Error(`Failed to execute cron job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Schedule retry
   */
  private async scheduleRetry(job: CronJob): Promise<void> {
    if (!job.retry.enabled) return;

    const retryCount = job.logs.filter(log => log.message.includes('retry attempt')).length;
    if (retryCount >= job.retry.maxAttempts) {
      job.logs.push({
        timestamp: new Date(),
        level: 'error',
        message: 'Maximum retry attempts reached',
      });
      return;
    }

    const delay = job.retry.backoff === 'exponential' 
      ? job.retry.delay * Math.pow(2, retryCount)
      : job.retry.delay;

    job.logs.push({
      timestamp: new Date(),
      level: 'info',
      message: `Scheduling retry in ${delay} seconds (attempt ${retryCount + 1}/${job.retry.maxAttempts})`,
    });

    // Schedule retry
    setTimeout(() => {
      this.executeJob(job.id);
    }, delay * 1000);
  }

  /**
   * Send notification
   */
  private async sendNotification(job: CronJob, type: 'success' | 'failure', message: string): Promise<void> {
    try {
      const subject = `Cron Job ${type === 'success' ? 'Completed' : 'Failed'}: ${job.name}`;
      const body = `
Job: ${job.name}
Status: ${type === 'success' ? 'Success' : 'Failed'}
Time: ${new Date().toISOString()}
Message: ${message}
      `;

      // Send email notification
      if (job.notifications.email.length > 0) {
        for (const email of job.notifications.email) {
          await execAsync(`echo "${body}" | mail -s "${subject}" ${email}`);
        }
      }

      // Send webhook notification
      if (job.notifications.webhook) {
        const payload = {
          job: job.name,
          status: type,
          message,
          timestamp: new Date().toISOString(),
        };
        
        await execAsync(`curl -X POST -H "Content-Type: application/json" -d '${JSON.stringify(payload)}' ${job.notifications.webhook}`);
      }

      // Send Slack notification
      if (job.notifications.slack) {
        const slackMessage = `*${subject}*\n\`\`\`${body}\`\`\``;
        await execAsync(`curl -X POST -H "Content-Type: application/json" -d '{"text":"${slackMessage}"}' ${job.notifications.slack}`);
      }

    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }

  /**
   * Update crontab
   */
  private async updateCrontab(job: CronJob): Promise<void> {
    try {
      const crontabFile = path.join(this.cronPath, job.user);
      let crontabContent = '';

      // Read existing crontab
      if (await fs.pathExists(crontabFile)) {
        crontabContent = await fs.readFile(crontabFile, 'utf8');
      }

      // Remove existing job entry
      const lines = crontabContent.split('\n');
      const filteredLines = lines.filter(line => !line.includes(`# Atulya Panel Job: ${job.id}`));

      // Add new job entry if enabled
      if (job.enabled) {
        const jobLine = `${job.schedule} # Atulya Panel Job: ${job.id} ${job.command}`;
        filteredLines.push(jobLine);
      }

      // Write updated crontab
      await fs.writeFile(crontabFile, filteredLines.join('\n') + '\n');
      
      // Set proper permissions
      await execAsync(`chown ${job.user}:${job.user} ${crontabFile}`);
      await execAsync(`chmod 600 ${crontabFile}`);

      // Reload crontab
      await execAsync(`crontab -u ${job.user} ${crontabFile}`);

    } catch (error) {
      console.error('Failed to update crontab:', error);
    }
  }

  /**
   * Remove from crontab
   */
  private async removeFromCrontab(job: CronJob): Promise<void> {
    try {
      const crontabFile = path.join(this.cronPath, job.user);
      
      if (await fs.pathExists(crontabFile)) {
        const crontabContent = await fs.readFile(crontabFile, 'utf8');
        const lines = crontabContent.split('\n');
        const filteredLines = lines.filter(line => !line.includes(`# Atulya Panel Job: ${job.id}`));
        
        await fs.writeFile(crontabFile, filteredLines.join('\n') + '\n');
        await execAsync(`crontab -u ${job.user} ${crontabFile}`);
      }
    } catch (error) {
      console.error('Failed to remove from crontab:', error);
    }
  }

  /**
   * Get all cron jobs
   */
  getJobs(): CronJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get cron job by ID
   */
  getJob(id: string): CronJob | undefined {
    return this.jobs.get(id);
  }

  /**
   * Get cron templates
   */
  getTemplates(): CronTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get cron template by ID
   */
  getTemplate(id: string): CronTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Create job from template
   */
  async createJobFromTemplate(templateId: string, user: string, customizations?: Partial<CronJob>): Promise<CronJob> {
    try {
      const template = this.templates.get(templateId);
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      const jobData = {
        name: template.name,
        description: template.description,
        command: template.command,
        schedule: template.schedule,
        user,
        ...customizations,
      };

      return await this.createJob(jobData);
    } catch (error) {
      console.error('Failed to create job from template:', error);
      throw new Error(`Failed to create job from template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get cron job logs
   */
  getJobLogs(id: string, limit: number = 50): CronLog[] {
    const job = this.jobs.get(id);
    if (!job) return [];

    return job.logs.slice(-limit);
  }

  /**
   * Clear job logs
   */
  async clearJobLogs(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) return;

    job.logs = [];
    await this.saveJobs();
  }

  /**
   * Get cron statistics
   */
  getStatistics(): {
    totalJobs: number;
    activeJobs: number;
    inactiveJobs: number;
    failedJobs: number;
    totalExecutions: number;
    successRate: number;
  } {
    const jobs = Array.from(this.jobs.values());
    const totalExecutions = jobs.reduce((sum, job) => sum + job.logs.length, 0);
    const successfulExecutions = jobs.reduce((sum, job) => 
      sum + job.logs.filter(log => log.level === 'info' && log.message.includes('completed')).length, 0
    );

    return {
      totalJobs: jobs.length,
      activeJobs: jobs.filter(job => job.status === 'active').length,
      inactiveJobs: jobs.filter(job => job.status === 'inactive').length,
      failedJobs: jobs.filter(job => job.status === 'failed').length,
      totalExecutions,
      successRate: totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0,
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}