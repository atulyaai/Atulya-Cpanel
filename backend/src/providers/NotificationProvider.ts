import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';

const execAsync = promisify(exec);

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'system';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'system' | 'security' | 'backup' | 'monitoring' | 'maintenance' | 'user';
  userId?: string;
  groupId?: string;
  read: boolean;
  acknowledged: boolean;
  createdAt: Date;
  expiresAt?: Date;
  actions?: NotificationAction[];
  metadata?: Record<string, any>;
  channels: NotificationChannel[];
}

export interface NotificationAction {
  id: string;
  label: string;
  type: 'button' | 'link' | 'dismiss';
  action: string;
  style?: 'primary' | 'secondary' | 'danger' | 'success';
  url?: string;
  data?: Record<string, any>;
}

export interface NotificationChannel {
  type: 'email' | 'sms' | 'push' | 'webhook' | 'slack' | 'discord' | 'telegram';
  enabled: boolean;
  config: Record<string, any>;
  sent: boolean;
  sentAt?: Date;
  error?: string;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  description: string;
  category: Notification['category'];
  type: Notification['type'];
  priority: Notification['priority'];
  title: string;
  message: string;
  channels: NotificationChannel[];
  actions?: NotificationAction[];
  variables: string[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationSettings {
  userId: string;
  email: {
    enabled: boolean;
    address: string;
    categories: string[];
    frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
  };
  sms: {
    enabled: boolean;
    number: string;
    categories: string[];
  };
  push: {
    enabled: boolean;
    token: string;
    categories: string[];
  };
  webhook: {
    enabled: boolean;
    url: string;
    categories: string[];
  };
  slack: {
    enabled: boolean;
    webhook: string;
    channel: string;
    categories: string[];
  };
  discord: {
    enabled: boolean;
    webhook: string;
    categories: string[];
  };
  telegram: {
    enabled: boolean;
    botToken: string;
    chatId: string;
    categories: string[];
  };
}

export class NotificationProvider {
  private notifications: Map<string, Notification>;
  private templates: Map<string, NotificationTemplate>;
  private settings: Map<string, NotificationSettings>;
  private configPath: string;
  private logPath: string;

  constructor() {
    this.notifications = new Map();
    this.templates = new Map();
    this.settings = new Map();
    this.configPath = '/etc/atulya-panel/notifications';
    this.logPath = '/var/log/atulya-panel/notifications';
    
    this.initialize();
  }

  /**
   * Initialize notification provider
   */
  private async initialize(): Promise<void> {
    try {
      await fs.ensureDir(this.configPath);
      await fs.ensureDir(this.logPath);
      await this.loadTemplates();
      await this.loadSettings();
      await this.loadNotifications();
    } catch (error) {
      console.error('Failed to initialize notification provider:', error);
    }
  }

  /**
   * Load notification templates
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
      } else {
        // Create default templates
        await this.createDefaultTemplates();
      }
    } catch (error) {
      console.error('Failed to load notification templates:', error);
    }
  }

  /**
   * Create default templates
   */
  private async createDefaultTemplates(): Promise<void> {
    const defaultTemplates: NotificationTemplate[] = [
      {
        id: 'system_startup',
        name: 'System Startup',
        description: 'Notification when system starts up',
        category: 'system',
        type: 'info',
        priority: 'medium',
        title: 'System Started',
        message: 'The Atulya Panel system has started successfully.',
        channels: [
          { type: 'email', enabled: true, config: {}, sent: false },
          { type: 'webhook', enabled: true, config: {}, sent: false },
        ],
        variables: ['system_name', 'startup_time'],
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'backup_completed',
        name: 'Backup Completed',
        description: 'Notification when backup is completed',
        category: 'backup',
        type: 'success',
        priority: 'medium',
        title: 'Backup Completed',
        message: 'Backup {{backup_name}} has been completed successfully. Size: {{backup_size}}',
        channels: [
          { type: 'email', enabled: true, config: {}, sent: false },
          { type: 'webhook', enabled: true, config: {}, sent: false },
        ],
        actions: [
          { id: 'view_backup', label: 'View Backup', type: 'link', action: 'view_backup', url: '/backups/{{backup_id}}' },
        ],
        variables: ['backup_name', 'backup_size', 'backup_id'],
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'backup_failed',
        name: 'Backup Failed',
        description: 'Notification when backup fails',
        category: 'backup',
        type: 'error',
        priority: 'high',
        title: 'Backup Failed',
        message: 'Backup {{backup_name}} has failed. Error: {{error_message}}',
        channels: [
          { type: 'email', enabled: true, config: {}, sent: false },
          { type: 'webhook', enabled: true, config: {}, sent: false },
          { type: 'slack', enabled: true, config: {}, sent: false },
        ],
        actions: [
          { id: 'retry_backup', label: 'Retry Backup', type: 'button', action: 'retry_backup', style: 'primary' },
          { id: 'view_logs', label: 'View Logs', type: 'link', action: 'view_logs', url: '/logs/backup/{{backup_id}}' },
        ],
        variables: ['backup_name', 'error_message', 'backup_id'],
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'security_alert',
        name: 'Security Alert',
        description: 'Notification for security alerts',
        category: 'security',
        type: 'error',
        priority: 'critical',
        title: 'Security Alert',
        message: '{{alert_type}}: {{alert_message}}',
        channels: [
          { type: 'email', enabled: true, config: {}, sent: false },
          { type: 'sms', enabled: true, config: {}, sent: false },
          { type: 'webhook', enabled: true, config: {}, sent: false },
          { type: 'slack', enabled: true, config: {}, sent: false },
        ],
        actions: [
          { id: 'view_alert', label: 'View Alert', type: 'link', action: 'view_alert', url: '/security/alerts/{{alert_id}}' },
          { id: 'acknowledge', label: 'Acknowledge', type: 'button', action: 'acknowledge_alert', style: 'primary' },
        ],
        variables: ['alert_type', 'alert_message', 'alert_id'],
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'disk_space_low',
        name: 'Disk Space Low',
        description: 'Notification when disk space is low',
        category: 'monitoring',
        type: 'warning',
        priority: 'high',
        title: 'Disk Space Low',
        message: 'Disk space is running low. Used: {{disk_usage}}% of {{disk_total}}',
        channels: [
          { type: 'email', enabled: true, config: {}, sent: false },
          { type: 'webhook', enabled: true, config: {}, sent: false },
        ],
        actions: [
          { id: 'view_disk', label: 'View Disk Usage', type: 'link', action: 'view_disk', url: '/monitoring/disk' },
          { id: 'cleanup', label: 'Start Cleanup', type: 'button', action: 'start_cleanup', style: 'primary' },
        ],
        variables: ['disk_usage', 'disk_total'],
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'service_down',
        name: 'Service Down',
        description: 'Notification when a service goes down',
        category: 'monitoring',
        type: 'error',
        priority: 'high',
        title: 'Service Down',
        message: 'Service {{service_name}} is down. Status: {{service_status}}',
        channels: [
          { type: 'email', enabled: true, config: {}, sent: false },
          { type: 'webhook', enabled: true, config: {}, sent: false },
          { type: 'slack', enabled: true, config: {}, sent: false },
        ],
        actions: [
          { id: 'restart_service', label: 'Restart Service', type: 'button', action: 'restart_service', style: 'primary' },
          { id: 'view_service', label: 'View Service', type: 'link', action: 'view_service', url: '/services/{{service_name}}' },
        ],
        variables: ['service_name', 'service_status'],
        enabled: true,
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
   * Save notification templates
   */
  private async saveTemplates(): Promise<void> {
    try {
      const templatesFile = path.join(this.configPath, 'templates.json');
      const data = Array.from(this.templates.values());
      await fs.writeFile(templatesFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save notification templates:', error);
    }
  }

  /**
   * Load notification settings
   */
  private async loadSettings(): Promise<void> {
    try {
      const settingsFile = path.join(this.configPath, 'settings.json');
      if (await fs.pathExists(settingsFile)) {
        const data = await fs.readFile(settingsFile, 'utf8');
        const settings = JSON.parse(data);
        
        this.settings.clear();
        for (const setting of settings) {
          this.settings.set(setting.userId, setting);
        }
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }
  }

  /**
   * Save notification settings
   */
  private async saveSettings(): Promise<void> {
    try {
      const settingsFile = path.join(this.configPath, 'settings.json');
      const data = Array.from(this.settings.values());
      await fs.writeFile(settingsFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save notification settings:', error);
    }
  }

  /**
   * Load notifications
   */
  private async loadNotifications(): Promise<void> {
    try {
      const notificationsFile = path.join(this.configPath, 'notifications.json');
      if (await fs.pathExists(notificationsFile)) {
        const data = await fs.readFile(notificationsFile, 'utf8');
        const notifications = JSON.parse(data);
        
        this.notifications.clear();
        for (const notification of notifications) {
          this.notifications.set(notification.id, notification);
        }
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  }

  /**
   * Save notifications
   */
  private async saveNotifications(): Promise<void> {
    try {
      const notificationsFile = path.join(this.configPath, 'notifications.json');
      const data = Array.from(this.notifications.values());
      await fs.writeFile(notificationsFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save notifications:', error);
    }
  }

  /**
   * Create notification from template
   */
  async createNotificationFromTemplate(
    templateId: string,
    variables: Record<string, any>,
    userId?: string,
    groupId?: string
  ): Promise<Notification> {
    try {
      const template = this.templates.get(templateId);
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      if (!template.enabled) {
        throw new Error(`Template is disabled: ${templateId}`);
      }

      // Replace variables in title and message
      let title = template.title;
      let message = template.message;

      for (const [key, value] of Object.entries(variables)) {
        const placeholder = `{{${key}}}`;
        title = title.replace(new RegExp(placeholder, 'g'), String(value));
        message = message.replace(new RegExp(placeholder, 'g'), String(value));
      }

      // Create notification
      const notification: Notification = {
        id: this.generateId(),
        title,
        message,
        type: template.type,
        priority: template.priority,
        category: template.category,
        userId,
        groupId,
        read: false,
        acknowledged: false,
        createdAt: new Date(),
        channels: template.channels.map(channel => ({ ...channel, sent: false })),
        actions: template.actions,
        metadata: { templateId, variables },
      };

      this.notifications.set(notification.id, notification);
      await this.saveNotifications();

      // Send notification
      await this.sendNotification(notification);

      return notification;
    } catch (error) {
      console.error('Failed to create notification from template:', error);
      throw new Error(`Failed to create notification from template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create custom notification
   */
  async createNotification(notificationData: {
    title: string;
    message: string;
    type: Notification['type'];
    priority: Notification['priority'];
    category: Notification['category'];
    userId?: string;
    groupId?: string;
    channels?: NotificationChannel[];
    actions?: NotificationAction[];
    metadata?: Record<string, any>;
    expiresAt?: Date;
  }): Promise<Notification> {
    try {
      const notification: Notification = {
        id: this.generateId(),
        title: notificationData.title,
        message: notificationData.message,
        type: notificationData.type,
        priority: notificationData.priority,
        category: notificationData.category,
        userId: notificationData.userId,
        groupId: notificationData.groupId,
        read: false,
        acknowledged: false,
        createdAt: new Date(),
        channels: notificationData.channels || [],
        actions: notificationData.actions,
        metadata: notificationData.metadata,
        expiresAt: notificationData.expiresAt,
      };

      this.notifications.set(notification.id, notification);
      await this.saveNotifications();

      // Send notification
      await this.sendNotification(notification);

      return notification;
    } catch (error) {
      console.error('Failed to create notification:', error);
      throw new Error(`Failed to create notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send notification
   */
  private async sendNotification(notification: Notification): Promise<void> {
    try {
      for (const channel of notification.channels) {
        if (!channel.enabled) continue;

        try {
          switch (channel.type) {
            case 'email':
              await this.sendEmail(notification, channel);
              break;
            case 'sms':
              await this.sendSMS(notification, channel);
              break;
            case 'push':
              await this.sendPush(notification, channel);
              break;
            case 'webhook':
              await this.sendWebhook(notification, channel);
              break;
            case 'slack':
              await this.sendSlack(notification, channel);
              break;
            case 'discord':
              await this.sendDiscord(notification, channel);
              break;
            case 'telegram':
              await this.sendTelegram(notification, channel);
              break;
          }

          channel.sent = true;
          channel.sentAt = new Date();
        } catch (error) {
          channel.error = error instanceof Error ? error.message : 'Unknown error';
          console.error(`Failed to send notification via ${channel.type}:`, error);
        }
      }

      await this.saveNotifications();
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }

  /**
   * Send email notification
   */
  private async sendEmail(notification: Notification, channel: NotificationChannel): Promise<void> {
    const { config } = channel;
    const { smtpHost, smtpPort, smtpUser, smtpPass, fromEmail, toEmail } = config;

    if (!smtpHost || !toEmail) {
      throw new Error('Email configuration incomplete');
    }

    const subject = `[${notification.priority.toUpperCase()}] ${notification.title}`;
    const body = `
${notification.message}

Category: ${notification.category}
Priority: ${notification.priority}
Time: ${notification.createdAt.toISOString()}

${notification.actions ? 'Actions:' : ''}
${notification.actions?.map(action => `- ${action.label}: ${action.action}`).join('\n') || ''}
    `;

    // Use mail command to send email
    await execAsync(`echo "${body}" | mail -s "${subject}" -a "From: ${fromEmail || 'noreply@atulya-panel.com'}" ${toEmail}`);
  }

  /**
   * Send SMS notification
   */
  private async sendSMS(notification: Notification, channel: NotificationChannel): Promise<void> {
    const { config } = channel;
    const { apiKey, apiSecret, fromNumber, toNumber } = config;

    if (!apiKey || !toNumber) {
      throw new Error('SMS configuration incomplete');
    }

    // Use curl to send SMS via Twilio or similar service
    const message = `[${notification.priority.toUpperCase()}] ${notification.title}: ${notification.message}`;
    const url = `https://api.twilio.com/2010-04-01/Accounts/${apiKey}/Messages.json`;
    
    await execAsync(`curl -X POST "${url}" \
      --data-urlencode "From=${fromNumber}" \
      --data-urlencode "To=${toNumber}" \
      --data-urlencode "Body=${message}" \
      -u "${apiKey}:${apiSecret}"`);
  }

  /**
   * Send push notification
   */
  private async sendPush(notification: Notification, channel: NotificationChannel): Promise<void> {
    const { config } = channel;
    const { serverKey, token } = config;

    if (!serverKey || !token) {
      throw new Error('Push notification configuration incomplete');
    }

    // Use curl to send push notification via FCM
    const payload = {
      to: token,
      notification: {
        title: notification.title,
        body: notification.message,
        icon: '/icons/notification.png',
      },
      data: {
        category: notification.category,
        priority: notification.priority,
        notificationId: notification.id,
      },
    };

    await execAsync(`curl -X POST "https://fcm.googleapis.com/fcm/send" \
      -H "Authorization: key=${serverKey}" \
      -H "Content-Type: application/json" \
      -d '${JSON.stringify(payload)}'`);
  }

  /**
   * Send webhook notification
   */
  private async sendWebhook(notification: Notification, channel: NotificationChannel): Promise<void> {
    const { config } = channel;
    const { url, headers = {} } = config;

    if (!url) {
      throw new Error('Webhook URL not provided');
    }

    const payload = {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      priority: notification.priority,
      category: notification.category,
      timestamp: notification.createdAt.toISOString(),
      actions: notification.actions,
      metadata: notification.metadata,
    };

    const headerString = Object.entries(headers)
      .map(([key, value]) => `-H "${key}: ${value}"`)
      .join(' ');

    await execAsync(`curl -X POST "${url}" ${headerString} \
      -H "Content-Type: application/json" \
      -d '${JSON.stringify(payload)}'`);
  }

  /**
   * Send Slack notification
   */
  private async sendSlack(notification: Notification, channel: NotificationChannel): Promise<void> {
    const { config } = channel;
    const { webhook, channel: slackChannel } = config;

    if (!webhook) {
      throw new Error('Slack webhook URL not provided');
    }

    const color = this.getPriorityColor(notification.priority);
    const payload = {
      channel: slackChannel || '#general',
      username: 'Atulya Panel',
      icon_emoji: ':bell:',
      attachments: [
        {
          color,
          title: notification.title,
          text: notification.message,
          fields: [
            { title: 'Category', value: notification.category, short: true },
            { title: 'Priority', value: notification.priority, short: true },
            { title: 'Time', value: notification.createdAt.toISOString(), short: false },
          ],
          footer: 'Atulya Panel',
          ts: Math.floor(notification.createdAt.getTime() / 1000),
        },
      ],
    };

    await execAsync(`curl -X POST "${webhook}" \
      -H "Content-Type: application/json" \
      -d '${JSON.stringify(payload)}'`);
  }

  /**
   * Send Discord notification
   */
  private async sendDiscord(notification: Notification, channel: NotificationChannel): Promise<void> {
    const { config } = channel;
    const { webhook } = config;

    if (!webhook) {
      throw new Error('Discord webhook URL not provided');
    }

    const color = this.getPriorityColor(notification.priority);
    const payload = {
      embeds: [
        {
          title: notification.title,
          description: notification.message,
          color: parseInt(color.replace('#', ''), 16),
          fields: [
            { name: 'Category', value: notification.category, inline: true },
            { name: 'Priority', value: notification.priority, inline: true },
            { name: 'Time', value: notification.createdAt.toISOString(), inline: false },
          ],
          footer: { text: 'Atulya Panel' },
          timestamp: notification.createdAt.toISOString(),
        },
      ],
    };

    await execAsync(`curl -X POST "${webhook}" \
      -H "Content-Type: application/json" \
      -d '${JSON.stringify(payload)}'`);
  }

  /**
   * Send Telegram notification
   */
  private async sendTelegram(notification: Notification, channel: NotificationChannel): Promise<void> {
    const { config } = channel;
    const { botToken, chatId } = config;

    if (!botToken || !chatId) {
      throw new Error('Telegram configuration incomplete');
    }

    const message = `*${notification.title}*\n\n${notification.message}\n\n` +
      `Category: ${notification.category}\n` +
      `Priority: ${notification.priority}\n` +
      `Time: ${notification.createdAt.toISOString()}`;

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    await execAsync(`curl -X POST "${url}" \
      -H "Content-Type: application/json" \
      -d '{"chat_id": "${chatId}", "text": "${message}", "parse_mode": "Markdown"}'`);
  }

  /**
   * Get priority color
   */
  private getPriorityColor(priority: Notification['priority']): string {
    const colors = {
      low: '#28a745',
      medium: '#ffc107',
      high: '#fd7e14',
      critical: '#dc3545',
    };
    return colors[priority] || '#6c757d';
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    const notification = this.notifications.get(notificationId);
    if (notification) {
      notification.read = true;
      await this.saveNotifications();
    }
  }

  /**
   * Acknowledge notification
   */
  async acknowledge(notificationId: string): Promise<void> {
    const notification = this.notifications.get(notificationId);
    if (notification) {
      notification.acknowledged = true;
      await this.saveNotifications();
    }
  }

  /**
   * Get notifications for user
   */
  getNotificationsForUser(userId: string, limit: number = 50): Notification[] {
    return Array.from(this.notifications.values())
      .filter(notification => notification.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get unread notifications count
   */
  getUnreadCount(userId: string): number {
    return Array.from(this.notifications.values())
      .filter(notification => notification.userId === userId && !notification.read)
      .length;
  }

  /**
   * Get notification templates
   */
  getTemplates(): NotificationTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get template by ID
   */
  getTemplate(id: string): NotificationTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Update notification settings
   */
  async updateSettings(userId: string, settings: Partial<NotificationSettings>): Promise<void> {
    const currentSettings = this.settings.get(userId) || {
      userId,
      email: { enabled: false, address: '', categories: [], frequency: 'immediate' },
      sms: { enabled: false, number: '', categories: [] },
      push: { enabled: false, token: '', categories: [] },
      webhook: { enabled: false, url: '', categories: [] },
      slack: { enabled: false, webhook: '', channel: '', categories: [] },
      discord: { enabled: false, webhook: '', categories: [] },
      telegram: { enabled: false, botToken: '', chatId: '', categories: [] },
    };

    const updatedSettings = { ...currentSettings, ...settings };
    this.settings.set(userId, updatedSettings);
    await this.saveSettings();
  }

  /**
   * Get notification statistics
   */
  getStatistics(): {
    totalNotifications: number;
    unreadNotifications: number;
    byType: Record<string, number>;
    byCategory: Record<string, number>;
    byPriority: Record<string, number>;
  } {
    const notifications = Array.from(this.notifications.values());
    const byType: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const byPriority: Record<string, number> = {};

    for (const notification of notifications) {
      byType[notification.type] = (byType[notification.type] || 0) + 1;
      byCategory[notification.category] = (byCategory[notification.category] || 0) + 1;
      byPriority[notification.priority] = (byPriority[notification.priority] || 0) + 1;
    }

    return {
      totalNotifications: notifications.length,
      unreadNotifications: notifications.filter(n => !n.read).length,
      byType,
      byCategory,
      byPriority,
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}