import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';

const execAsync = promisify(exec);

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  source: string;
  message: string;
  context?: Record<string, any>;
  stack?: string;
  tags?: string[];
  userId?: string;
  sessionId?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: number;
  memoryUsage?: number;
  cpuUsage?: number;
}

export interface LogFilter {
  sources?: string[];
  levels?: string[];
  startDate?: Date;
  endDate?: Date;
  search?: string;
  tags?: string[];
  userId?: string;
  sessionId?: string;
  requestId?: string;
  ip?: string;
  method?: string;
  statusCode?: number;
  minResponseTime?: number;
  maxResponseTime?: number;
  minMemoryUsage?: number;
  maxMemoryUsage?: number;
  minCpuUsage?: number;
  maxCpuUsage?: number;
}

export interface LogSource {
  id: string;
  name: string;
  description: string;
  type: 'file' | 'database' | 'api' | 'stream';
  path?: string;
  url?: string;
  format: 'json' | 'text' | 'syslog' | 'apache' | 'nginx' | 'mysql' | 'php' | 'custom';
  enabled: boolean;
  realTime: boolean;
  maxLines: number;
  retention: number; // days
  parser?: string; // custom parser function
  filters?: string[]; // pre-applied filters
}

export interface LogStatistics {
  totalEntries: number;
  byLevel: Record<string, number>;
  bySource: Record<string, number>;
  byHour: Record<string, number>;
  byDay: Record<string, number>;
  topErrors: Array<{ message: string; count: number }>;
  topSources: Array<{ source: string; count: number }>;
  averageResponseTime: number;
  errorRate: number;
  peakMemoryUsage: number;
  peakCpuUsage: number;
}

export interface LogExport {
  id: string;
  name: string;
  format: 'json' | 'csv' | 'txt' | 'xlsx';
  filters: LogFilter;
  sources: string[];
  startDate: Date;
  endDate: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  filePath?: string;
  fileSize?: number;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

export class LogViewerProvider {
  private sources: Map<string, LogSource>;
  private entries: Map<string, LogEntry>;
  private exports: Map<string, LogExport>;
  private configPath: string;
  private logPath: string;
  private exportPath: string;

  constructor() {
    this.sources = new Map();
    this.entries = new Map();
    this.exports = new Map();
    this.configPath = '/etc/atulya-panel/logs';
    this.logPath = '/var/log/atulya-panel';
    this.exportPath = '/var/log/atulya-panel/exports';
    
    this.initialize();
  }

  /**
   * Initialize log viewer provider
   */
  private async initialize(): Promise<void> {
    try {
      await fs.ensureDir(this.configPath);
      await fs.ensureDir(this.logPath);
      await fs.ensureDir(this.exportPath);
      await this.loadSources();
      await this.loadExports();
    } catch (error) {
      console.error('Failed to initialize log viewer provider:', error);
    }
  }

  /**
   * Load log sources
   */
  private async loadSources(): Promise<void> {
    try {
      const sourcesFile = path.join(this.configPath, 'sources.json');
      if (await fs.pathExists(sourcesFile)) {
        const data = await fs.readFile(sourcesFile, 'utf8');
        const sources = JSON.parse(data);
        
        this.sources.clear();
        for (const source of sources) {
          this.sources.set(source.id, source);
        }
      } else {
        // Create default sources
        await this.createDefaultSources();
      }
    } catch (error) {
      console.error('Failed to load log sources:', error);
    }
  }

  /**
   * Create default log sources
   */
  private async createDefaultSources(): Promise<void> {
    const defaultSources: LogSource[] = [
      {
        id: 'system',
        name: 'System Logs',
        description: 'System-level logs from journald',
        type: 'stream',
        format: 'syslog',
        enabled: true,
        realTime: true,
        maxLines: 10000,
        retention: 30,
      },
      {
        id: 'nginx_access',
        name: 'Nginx Access Logs',
        description: 'Nginx access logs',
        type: 'file',
        path: '/var/log/nginx/access.log',
        format: 'nginx',
        enabled: true,
        realTime: true,
        maxLines: 50000,
        retention: 7,
      },
      {
        id: 'nginx_error',
        name: 'Nginx Error Logs',
        description: 'Nginx error logs',
        type: 'file',
        path: '/var/log/nginx/error.log',
        format: 'nginx',
        enabled: true,
        realTime: true,
        maxLines: 10000,
        retention: 30,
      },
      {
        id: 'apache_access',
        name: 'Apache Access Logs',
        description: 'Apache access logs',
        type: 'file',
        path: '/var/log/apache2/access.log',
        format: 'apache',
        enabled: true,
        realTime: true,
        maxLines: 50000,
        retention: 7,
      },
      {
        id: 'apache_error',
        name: 'Apache Error Logs',
        description: 'Apache error logs',
        type: 'file',
        path: '/var/log/apache2/error.log',
        format: 'apache',
        enabled: true,
        realTime: true,
        maxLines: 10000,
        retention: 30,
      },
      {
        id: 'php_error',
        name: 'PHP Error Logs',
        description: 'PHP error logs',
        type: 'file',
        path: '/var/log/php/error.log',
        format: 'php',
        enabled: true,
        realTime: true,
        maxLines: 10000,
        retention: 30,
      },
      {
        id: 'mysql_error',
        name: 'MySQL Error Logs',
        description: 'MySQL error logs',
        type: 'file',
        path: '/var/log/mysql/error.log',
        format: 'mysql',
        enabled: true,
        realTime: true,
        maxLines: 10000,
        retention: 30,
      },
      {
        id: 'postgresql',
        name: 'PostgreSQL Logs',
        description: 'PostgreSQL logs',
        type: 'file',
        path: '/var/log/postgresql/postgresql.log',
        format: 'text',
        enabled: true,
        realTime: true,
        maxLines: 10000,
        retention: 30,
      },
      {
        id: 'redis',
        name: 'Redis Logs',
        description: 'Redis logs',
        type: 'file',
        path: '/var/log/redis/redis-server.log',
        format: 'text',
        enabled: true,
        realTime: true,
        maxLines: 10000,
        retention: 7,
      },
      {
        id: 'atulya_panel',
        name: 'Atulya Panel Logs',
        description: 'Atulya Panel application logs',
        type: 'file',
        path: '/var/log/atulya-panel/application.log',
        format: 'json',
        enabled: true,
        realTime: true,
        maxLines: 50000,
        retention: 30,
      },
      {
        id: 'backup',
        name: 'Backup Logs',
        description: 'Backup operation logs',
        type: 'file',
        path: '/var/log/atulya-panel/backup.log',
        format: 'json',
        enabled: true,
        realTime: true,
        maxLines: 10000,
        retention: 90,
      },
      {
        id: 'security',
        name: 'Security Logs',
        description: 'Security-related logs',
        type: 'file',
        path: '/var/log/atulya-panel/security.log',
        format: 'json',
        enabled: true,
        realTime: true,
        maxLines: 10000,
        retention: 365,
      },
    ];

    for (const source of defaultSources) {
      this.sources.set(source.id, source);
    }

    await this.saveSources();
  }

  /**
   * Save log sources
   */
  private async saveSources(): Promise<void> {
    try {
      const sourcesFile = path.join(this.configPath, 'sources.json');
      const data = Array.from(this.sources.values());
      await fs.writeFile(sourcesFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save log sources:', error);
    }
  }

  /**
   * Load log exports
   */
  private async loadExports(): Promise<void> {
    try {
      const exportsFile = path.join(this.configPath, 'exports.json');
      if (await fs.pathExists(exportsFile)) {
        const data = await fs.readFile(exportsFile, 'utf8');
        const exports = JSON.parse(data);
        
        this.exports.clear();
        for (const exportData of exports) {
          this.exports.set(exportData.id, exportData);
        }
      }
    } catch (error) {
      console.error('Failed to load log exports:', error);
    }
  }

  /**
   * Save log exports
   */
  private async saveExports(): Promise<void> {
    try {
      const exportsFile = path.join(this.configPath, 'exports.json');
      const data = Array.from(this.exports.values());
      await fs.writeFile(exportsFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save log exports:', error);
    }
  }

  /**
   * Get log entries
   */
  async getLogEntries(
    sourceIds: string[],
    filter: LogFilter = {},
    limit: number = 1000,
    offset: number = 0
  ): Promise<{ entries: LogEntry[]; total: number }> {
    try {
      const entries: LogEntry[] = [];
      let total = 0;

      for (const sourceId of sourceIds) {
        const source = this.sources.get(sourceId);
        if (!source || !source.enabled) continue;

        const sourceEntries = await this.getEntriesFromSource(source, filter);
        entries.push(...sourceEntries);
        total += sourceEntries.length;
      }

      // Sort by timestamp (newest first)
      entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Apply pagination
      const paginatedEntries = entries.slice(offset, offset + limit);

      return { entries: paginatedEntries, total };
    } catch (error) {
      console.error('Failed to get log entries:', error);
      throw new Error(`Failed to get log entries: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get entries from specific source
   */
  private async getEntriesFromSource(source: LogSource, filter: LogFilter): Promise<LogEntry[]> {
    try {
      let entries: LogEntry[] = [];

      if (source.type === 'file' && source.path) {
        entries = await this.getEntriesFromFile(source, filter);
      } else if (source.type === 'stream') {
        entries = await this.getEntriesFromStream(source, filter);
      } else if (source.type === 'database') {
        entries = await this.getEntriesFromDatabase(source, filter);
      } else if (source.type === 'api' && source.url) {
        entries = await this.getEntriesFromAPI(source, filter);
      }

      // Apply filters
      return this.applyFilters(entries, filter);
    } catch (error) {
      console.error(`Failed to get entries from source ${source.id}:`, error);
      return [];
    }
  }

  /**
   * Get entries from file
   */
  private async getEntriesFromFile(source: LogSource, filter: LogFilter): Promise<LogEntry[]> {
    try {
      if (!await fs.pathExists(source.path!)) {
        return [];
      }

      const content = await fs.readFile(source.path!, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      const entries: LogEntry[] = [];
      for (const line of lines) {
        try {
          const entry = this.parseLogLine(line, source.format);
          if (entry) {
            entries.push(entry);
          }
        } catch (error) {
          // Skip malformed lines
          continue;
        }
      }

      return entries;
    } catch (error) {
      console.error(`Failed to read file ${source.path}:`, error);
      return [];
    }
  }

  /**
   * Get entries from stream
   */
  private async getEntriesFromStream(source: LogSource, filter: LogFilter): Promise<LogEntry[]> {
    try {
      let command = '';
      
      if (source.id === 'system') {
        command = 'journalctl --no-pager --since "1 hour ago" --until "now"';
      } else {
        command = `tail -n ${source.maxLines} ${source.path || '/var/log/syslog'}`;
      }

      const { stdout } = await execAsync(command);
      const lines = stdout.split('\n').filter(line => line.trim());
      
      const entries: LogEntry[] = [];
      for (const line of lines) {
        try {
          const entry = this.parseLogLine(line, source.format);
          if (entry) {
            entries.push(entry);
          }
        } catch (error) {
          // Skip malformed lines
          continue;
        }
      }

      return entries;
    } catch (error) {
      console.error(`Failed to get entries from stream ${source.id}:`, error);
      return [];
    }
  }

  /**
   * Get entries from database
   */
  private async getEntriesFromDatabase(source: LogSource, filter: LogFilter): Promise<LogEntry[]> {
    // This would be implemented based on the database type
    // For now, return empty array
    return [];
  }

  /**
   * Get entries from API
   */
  private async getEntriesFromAPI(source: LogSource, filter: LogFilter): Promise<LogEntry[]> {
    try {
      const response = await fetch(source.url!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filter),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.entries || [];
    } catch (error) {
      console.error(`Failed to get entries from API ${source.url}:`, error);
      return [];
    }
  }

  /**
   * Parse log line
   */
  private parseLogLine(line: string, format: string): LogEntry | null {
    try {
      const entry: LogEntry = {
        id: this.generateId(),
        timestamp: new Date(),
        level: 'info',
        source: '',
        message: line,
      };

      switch (format) {
        case 'json':
          return this.parseJSONLog(line, entry);
        case 'syslog':
          return this.parseSyslogLog(line, entry);
        case 'nginx':
          return this.parseNginxLog(line, entry);
        case 'apache':
          return this.parseApacheLog(line, entry);
        case 'mysql':
          return this.parseMySQLLog(line, entry);
        case 'php':
          return this.parsePHPLog(line, entry);
        default:
          return this.parseTextLog(line, entry);
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * Parse JSON log
   */
  private parseJSONLog(line: string, entry: LogEntry): LogEntry | null {
    try {
      const data = JSON.parse(line);
      return {
        ...entry,
        timestamp: new Date(data.timestamp || data.time || Date.now()),
        level: data.level || 'info',
        source: data.source || data.service || 'unknown',
        message: data.message || data.msg || line,
        context: data.context || data.meta,
        stack: data.stack,
        tags: data.tags,
        userId: data.userId,
        sessionId: data.sessionId,
        requestId: data.requestId,
        ip: data.ip,
        userAgent: data.userAgent,
        method: data.method,
        url: data.url,
        statusCode: data.statusCode,
        responseTime: data.responseTime,
        memoryUsage: data.memoryUsage,
        cpuUsage: data.cpuUsage,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Parse syslog
   */
  private parseSyslogLog(line: string, entry: LogEntry): LogEntry | null {
    // Syslog format: <priority>timestamp hostname service: message
    const syslogRegex = /^<(\d+)>(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+(\S+):\s*(.*)$/;
    const match = line.match(syslogRegex);
    
    if (!match) return null;

    const [, priority, timestamp, hostname, service, message] = match;
    const level = this.getSyslogLevel(parseInt(priority));
    
    return {
      ...entry,
      timestamp: new Date(timestamp),
      level,
      source: service,
      message,
    };
  }

  /**
   * Parse Nginx log
   */
  private parseNginxLog(line: string, entry: LogEntry): LogEntry | null {
    // Nginx access log format
    const nginxRegex = /^(\S+)\s+(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+"([^"]+)"\s+(\d+)\s+(\d+)\s+"([^"]*)"\s+"([^"]*)"\s+"([^"]*)"$/;
    const match = line.match(nginxRegex);
    
    if (!match) return null;

    const [, ip, , , timestamp, request, status, size, referer, userAgent, forwarded] = match;
    const [method, url] = request.split(' ');
    
    return {
      ...entry,
      timestamp: new Date(timestamp),
      level: parseInt(status) >= 400 ? 'error' : 'info',
      source: 'nginx',
      message: `${method} ${url} ${status}`,
      ip,
      method,
      url,
      statusCode: parseInt(status),
      context: { size, referer, userAgent, forwarded },
    };
  }

  /**
   * Parse Apache log
   */
  private parseApacheLog(line: string, entry: LogEntry): LogEntry | null {
    // Apache access log format
    const apacheRegex = /^(\S+)\s+(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+"([^"]+)"\s+(\d+)\s+(\d+)\s+"([^"]*)"\s+"([^"]*)"$/;
    const match = line.match(apacheRegex);
    
    if (!match) return null;

    const [, ip, , , timestamp, request, status, size, referer, userAgent] = match;
    const [method, url] = request.split(' ');
    
    return {
      ...entry,
      timestamp: new Date(timestamp),
      level: parseInt(status) >= 400 ? 'error' : 'info',
      source: 'apache',
      message: `${method} ${url} ${status}`,
      ip,
      method,
      url,
      statusCode: parseInt(status),
      context: { size, referer, userAgent },
    };
  }

  /**
   * Parse MySQL log
   */
  private parseMySQLLog(line: string, entry: LogEntry): LogEntry | null {
    // MySQL error log format
    const mysqlRegex = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+(\d+)\s+\[(\w+)\]\s+(.*)$/;
    const match = line.match(mysqlRegex);
    
    if (!match) return null;

    const [, timestamp, threadId, level, message] = match;
    
    return {
      ...entry,
      timestamp: new Date(timestamp),
      level: level.toLowerCase() as LogEntry['level'],
      source: 'mysql',
      message,
      context: { threadId },
    };
  }

  /**
   * Parse PHP log
   */
  private parsePHPLog(line: string, entry: LogEntry): LogEntry | null {
    // PHP error log format
    const phpRegex = /^\[([^\]]+)\]\s+(\w+):\s+(.*)$/;
    const match = line.match(phpRegex);
    
    if (!match) return null;

    const [, timestamp, level, message] = match;
    
    return {
      ...entry,
      timestamp: new Date(timestamp),
      level: level.toLowerCase() as LogEntry['level'],
      source: 'php',
      message,
    };
  }

  /**
   * Parse text log
   */
  private parseTextLog(line: string, entry: LogEntry): LogEntry | null {
    // Simple text log parsing
    const textRegex = /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(\w+)\s+(.*)$/;
    const match = line.match(textRegex);
    
    if (!match) return null;

    const [, timestamp, level, message] = match;
    
    return {
      ...entry,
      timestamp: new Date(timestamp),
      level: level.toLowerCase() as LogEntry['level'],
      source: 'text',
      message,
    };
  }

  /**
   * Get syslog level from priority
   */
  private getSyslogLevel(priority: number): LogEntry['level'] {
    const level = priority & 0x07;
    const levels = ['debug', 'info', 'info', 'warn', 'error', 'error', 'error', 'fatal'];
    return levels[level] as LogEntry['level'];
  }

  /**
   * Apply filters to entries
   */
  private applyFilters(entries: LogEntry[], filter: LogFilter): LogEntry[] {
    return entries.filter(entry => {
      if (filter.sources && !filter.sources.includes(entry.source)) return false;
      if (filter.levels && !filter.levels.includes(entry.level)) return false;
      if (filter.startDate && entry.timestamp < filter.startDate) return false;
      if (filter.endDate && entry.timestamp > filter.endDate) return false;
      if (filter.search && !entry.message.toLowerCase().includes(filter.search.toLowerCase())) return false;
      if (filter.tags && (!entry.tags || !entry.tags.some(tag => filter.tags!.includes(tag)))) return false;
      if (filter.userId && entry.userId !== filter.userId) return false;
      if (filter.sessionId && entry.sessionId !== filter.sessionId) return false;
      if (filter.requestId && entry.requestId !== filter.requestId) return false;
      if (filter.ip && entry.ip !== filter.ip) return false;
      if (filter.method && entry.method !== filter.method) return false;
      if (filter.statusCode && entry.statusCode !== filter.statusCode) return false;
      if (filter.minResponseTime && (!entry.responseTime || entry.responseTime < filter.minResponseTime)) return false;
      if (filter.maxResponseTime && (!entry.responseTime || entry.responseTime > filter.maxResponseTime)) return false;
      if (filter.minMemoryUsage && (!entry.memoryUsage || entry.memoryUsage < filter.minMemoryUsage)) return false;
      if (filter.maxMemoryUsage && (!entry.memoryUsage || entry.memoryUsage > filter.maxMemoryUsage)) return false;
      if (filter.minCpuUsage && (!entry.cpuUsage || entry.cpuUsage < filter.minCpuUsage)) return false;
      if (filter.maxCpuUsage && (!entry.cpuUsage || entry.cpuUsage > filter.maxCpuUsage)) return false;
      
      return true;
    });
  }

  /**
   * Get log sources
   */
  getSources(): LogSource[] {
    return Array.from(this.sources.values());
  }

  /**
   * Get source by ID
   */
  getSource(id: string): LogSource | undefined {
    return this.sources.get(id);
  }

  /**
   * Update source
   */
  async updateSource(id: string, updates: Partial<LogSource>): Promise<void> {
    const source = this.sources.get(id);
    if (source) {
      Object.assign(source, updates);
      await this.saveSources();
    }
  }

  /**
   * Get log statistics
   */
  async getStatistics(
    sourceIds: string[],
    startDate?: Date,
    endDate?: Date
  ): Promise<LogStatistics> {
    try {
      const filter: LogFilter = { startDate, endDate };
      const { entries } = await this.getLogEntries(sourceIds, filter, 100000);

      const byLevel: Record<string, number> = {};
      const bySource: Record<string, number> = {};
      const byHour: Record<string, number> = {};
      const byDay: Record<string, number> = {};
      const errorCounts: Record<string, number> = {};
      const sourceCounts: Record<string, number> = {};

      let totalResponseTime = 0;
      let responseTimeCount = 0;
      let peakMemoryUsage = 0;
      let peakCpuUsage = 0;

      for (const entry of entries) {
        // Count by level
        byLevel[entry.level] = (byLevel[entry.level] || 0) + 1;
        
        // Count by source
        bySource[entry.source] = (bySource[entry.source] || 0) + 1;
        
        // Count by hour
        const hour = entry.timestamp.getHours().toString().padStart(2, '0');
        byHour[hour] = (byHour[hour] || 0) + 1;
        
        // Count by day
        const day = entry.timestamp.toISOString().split('T')[0];
        byDay[day] = (byDay[day] || 0) + 1;
        
        // Count errors
        if (entry.level === 'error' || entry.level === 'fatal') {
          errorCounts[entry.message] = (errorCounts[entry.message] || 0) + 1;
        }
        
        // Count by source
        sourceCounts[entry.source] = (sourceCounts[entry.source] || 0) + 1;
        
        // Response time
        if (entry.responseTime) {
          totalResponseTime += entry.responseTime;
          responseTimeCount++;
        }
        
        // Peak usage
        if (entry.memoryUsage && entry.memoryUsage > peakMemoryUsage) {
          peakMemoryUsage = entry.memoryUsage;
        }
        if (entry.cpuUsage && entry.cpuUsage > peakCpuUsage) {
          peakCpuUsage = entry.cpuUsage;
        }
      }

      // Top errors
      const topErrors = Object.entries(errorCounts)
        .map(([message, count]) => ({ message, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Top sources
      const topSources = Object.entries(sourceCounts)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const totalEntries = entries.length;
      const errorRate = totalEntries > 0 ? (byLevel.error || 0 + byLevel.fatal || 0) / totalEntries : 0;
      const averageResponseTime = responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0;

      return {
        totalEntries,
        byLevel,
        bySource,
        byHour,
        byDay,
        topErrors,
        topSources,
        averageResponseTime,
        errorRate,
        peakMemoryUsage,
        peakCpuUsage,
      };
    } catch (error) {
      console.error('Failed to get log statistics:', error);
      throw new Error(`Failed to get log statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Export logs
   */
  async exportLogs(
    name: string,
    format: LogExport['format'],
    sourceIds: string[],
    filters: LogFilter,
    startDate: Date,
    endDate: Date
  ): Promise<LogExport> {
    try {
      const exportData: LogExport = {
        id: this.generateId(),
        name,
        format,
        filters,
        sources: sourceIds,
        startDate,
        endDate,
        status: 'pending',
        progress: 0,
        createdAt: new Date(),
      };

      this.exports.set(exportData.id, exportData);
      await this.saveExports();

      // Start export process
      this.processExport(exportData);

      return exportData;
    } catch (error) {
      console.error('Failed to export logs:', error);
      throw new Error(`Failed to export logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process export
   */
  private async processExport(exportData: LogExport): Promise<void> {
    try {
      exportData.status = 'processing';
      exportData.progress = 10;
      await this.saveExports();

      // Get log entries
      const { entries } = await this.getLogEntries(
        exportData.sources,
        exportData.filters,
        1000000 // Large limit for export
      );

      exportData.progress = 50;
      await this.saveExports();

      // Generate file
      const fileName = `${exportData.name}_${Date.now()}.${exportData.format}`;
      const filePath = path.join(this.exportPath, fileName);

      let content = '';
      switch (exportData.format) {
        case 'json':
          content = JSON.stringify(entries, null, 2);
          break;
        case 'csv':
          content = this.convertToCSV(entries);
          break;
        case 'txt':
          content = this.convertToText(entries);
          break;
        case 'xlsx':
          // For xlsx, we'd need a library like xlsx
          content = this.convertToCSV(entries);
          break;
      }

      await fs.writeFile(filePath, content);
      
      exportData.filePath = filePath;
      exportData.fileSize = (await fs.stat(filePath)).size;
      exportData.status = 'completed';
      exportData.progress = 100;
      exportData.completedAt = new Date();
      
      await this.saveExports();
    } catch (error) {
      exportData.status = 'failed';
      exportData.error = error instanceof Error ? error.message : 'Unknown error';
      await this.saveExports();
    }
  }

  /**
   * Convert entries to CSV
   */
  private convertToCSV(entries: LogEntry[]): string {
    if (entries.length === 0) return '';
    
    const headers = [
      'timestamp', 'level', 'source', 'message', 'ip', 'method', 'url',
      'statusCode', 'responseTime', 'memoryUsage', 'cpuUsage'
    ];
    
    const rows = entries.map(entry => [
      entry.timestamp.toISOString(),
      entry.level,
      entry.source,
      entry.message.replace(/"/g, '""'),
      entry.ip || '',
      entry.method || '',
      entry.url || '',
      entry.statusCode || '',
      entry.responseTime || '',
      entry.memoryUsage || '',
      entry.cpuUsage || '',
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
    
    return csvContent;
  }

  /**
   * Convert entries to text
   */
  private convertToText(entries: LogEntry[]): string {
    return entries
      .map(entry => `${entry.timestamp.toISOString()} [${entry.level.toUpperCase()}] ${entry.source}: ${entry.message}`)
      .join('\n');
  }

  /**
   * Get export by ID
   */
  getExport(id: string): LogExport | undefined {
    return this.exports.get(id);
  }

  /**
   * Get all exports
   */
  getExports(): LogExport[] {
    return Array.from(this.exports.values());
  }

  /**
   * Delete export
   */
  async deleteExport(id: string): Promise<void> {
    const exportData = this.exports.get(id);
    if (exportData) {
      if (exportData.filePath && await fs.pathExists(exportData.filePath)) {
        await fs.remove(exportData.filePath);
      }
      this.exports.delete(id);
      await this.saveExports();
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}