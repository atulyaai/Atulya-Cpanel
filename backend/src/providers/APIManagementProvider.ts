import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';

const execAsync = promisify(exec);

export interface APIKey {
  id: string;
  name: string;
  description: string;
  key: string;
  secret: string;
  permissions: APIPermission[];
  rateLimit: RateLimit;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
  lastUsed?: Date;
  expiresAt?: Date;
  usage: APIUsage;
  metadata?: Record<string, any>;
}

export interface APIPermission {
  id: string;
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export interface RateLimit {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  burstLimit: number;
  windowSize: number; // seconds
}

export interface APIUsage {
  totalRequests: number;
  requestsToday: number;
  requestsThisHour: number;
  requestsThisMinute: number;
  lastRequest?: Date;
  errors: number;
  successRate: number;
  averageResponseTime: number; // ms
  bandwidth: number; // bytes
}

export interface APIEndpoint {
  id: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  description: string;
  parameters: APIParameter[];
  responses: APIResponse[];
  authentication: 'none' | 'api_key' | 'oauth2' | 'bearer';
  rateLimit?: RateLimit;
  deprecated: boolean;
  version: string;
  tags: string[];
  examples: APIExample[];
}

export interface APIParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  description: string;
  defaultValue?: any;
  validation?: Record<string, any>;
}

export interface APIResponse {
  statusCode: number;
  description: string;
  schema: Record<string, any>;
  examples: Record<string, any>[];
}

export interface APIExample {
  name: string;
  description: string;
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: any;
  };
  response: {
    statusCode: number;
    headers: Record<string, string>;
    body: any;
  };
}

export interface APILog {
  id: string;
  apiKeyId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number; // ms
  ip: string;
  userAgent: string;
  timestamp: Date;
  request: {
    headers: Record<string, string>;
    body?: any;
    query: Record<string, any>;
  };
  response: {
    headers: Record<string, string>;
    body?: any;
  };
  error?: string;
}

export interface APIAnalytics {
  totalRequests: number;
  requestsByEndpoint: Record<string, number>;
  requestsByMethod: Record<string, number>;
  requestsByStatus: Record<string, number>;
  requestsByHour: Record<string, number>;
  requestsByDay: Record<string, number>;
  averageResponseTime: number;
  errorRate: number;
  topIPs: Array<{ ip: string; count: number }>;
  topUserAgents: Array<{ userAgent: string; count: number }>;
  bandwidth: number;
  peakRequests: number;
  peakTime: Date;
}

export interface APIDocumentation {
  title: string;
  version: string;
  description: string;
  baseUrl: string;
  endpoints: APIEndpoint[];
  authentication: {
    apiKey: {
      type: 'header' | 'query';
      name: string;
    };
    oauth2: {
      authorizationUrl: string;
      tokenUrl: string;
      scopes: string[];
    };
  };
  rateLimiting: {
    global: RateLimit;
    perEndpoint: Record<string, RateLimit>;
  };
  examples: APIExample[];
  changelog: Array<{
    version: string;
    date: Date;
    changes: string[];
  }>;
}

export class APIManagementProvider {
  private apiKeys: Map<string, APIKey>;
  private endpoints: Map<string, APIEndpoint>;
  private logs: Map<string, APILog>;
  private documentation: APIDocumentation | null = null;
  private configPath: string;
  private logPath: string;

  constructor() {
    this.apiKeys = new Map();
    this.endpoints = new Map();
    this.logs = new Map();
    this.configPath = '/etc/atulya-panel/api';
    this.logPath = '/var/log/atulya-panel/api';
    
    this.initialize();
  }

  /**
   * Initialize API management provider
   */
  private async initialize(): Promise<void> {
    try {
      await fs.ensureDir(this.configPath);
      await fs.ensureDir(this.logPath);
      await this.loadAPIKeys();
      await this.loadEndpoints();
      await this.loadDocumentation();
      await this.loadLogs();
    } catch (error) {
      console.error('Failed to initialize API management provider:', error);
    }
  }

  /**
   * Load API keys
   */
  private async loadAPIKeys(): Promise<void> {
    try {
      const keysFile = path.join(this.configPath, 'keys.json');
      if (await fs.pathExists(keysFile)) {
        const data = await fs.readFile(keysFile, 'utf8');
        const keys = JSON.parse(data);
        
        this.apiKeys.clear();
        for (const key of keys) {
          this.apiKeys.set(key.id, key);
        }
      }
    } catch (error) {
      console.error('Failed to load API keys:', error);
    }
  }

  /**
   * Save API keys
   */
  private async saveAPIKeys(): Promise<void> {
    try {
      const keysFile = path.join(this.configPath, 'keys.json');
      const data = Array.from(this.apiKeys.values());
      await fs.writeFile(keysFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save API keys:', error);
    }
  }

  /**
   * Load endpoints
   */
  private async loadEndpoints(): Promise<void> {
    try {
      const endpointsFile = path.join(this.configPath, 'endpoints.json');
      if (await fs.pathExists(endpointsFile)) {
        const data = await fs.readFile(endpointsFile, 'utf8');
        const endpoints = JSON.parse(data);
        
        this.endpoints.clear();
        for (const endpoint of endpoints) {
          this.endpoints.set(endpoint.id, endpoint);
        }
      } else {
        // Create default endpoints
        await this.createDefaultEndpoints();
      }
    } catch (error) {
      console.error('Failed to load endpoints:', error);
    }
  }

  /**
   * Create default endpoints
   */
  private async createDefaultEndpoints(): Promise<void> {
    const defaultEndpoints: APIEndpoint[] = [
      {
        id: 'get_system_status',
        path: '/api/v1/system/status',
        method: 'GET',
        description: 'Get system status and health information',
        parameters: [],
        responses: [
          {
            statusCode: 200,
            description: 'System status retrieved successfully',
            schema: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                uptime: { type: 'number' },
                services: { type: 'array' },
                resources: { type: 'object' },
              },
            },
            examples: [
              {
                status: 'healthy',
                uptime: 86400,
                services: ['nginx', 'mysql', 'redis'],
                resources: { cpu: 45, memory: 60, disk: 30 },
              },
            ],
          },
        ],
        authentication: 'api_key',
        tags: ['system', 'monitoring'],
        examples: [
          {
            name: 'Get System Status',
            description: 'Retrieve current system status',
            request: {
              method: 'GET',
              url: '/api/v1/system/status',
              headers: { 'X-API-Key': 'your-api-key' },
            },
            response: {
              statusCode: 200,
              headers: { 'Content-Type': 'application/json' },
              body: { status: 'healthy', uptime: 86400 },
            },
          },
        ],
        deprecated: false,
        version: '1.0.0',
      },
      {
        id: 'get_users',
        path: '/api/v1/users',
        method: 'GET',
        description: 'Get list of users',
        parameters: [
          {
            name: 'page',
            type: 'number',
            required: false,
            description: 'Page number for pagination',
            defaultValue: 1,
          },
          {
            name: 'limit',
            type: 'number',
            required: false,
            description: 'Number of users per page',
            defaultValue: 10,
          },
          {
            name: 'status',
            type: 'string',
            required: false,
            description: 'Filter by user status',
          },
        ],
        responses: [
          {
            statusCode: 200,
            description: 'Users retrieved successfully',
            schema: {
              type: 'object',
              properties: {
                users: { type: 'array' },
                total: { type: 'number' },
                page: { type: 'number' },
                limit: { type: 'number' },
              },
            },
            examples: [
              {
                users: [{ id: '1', username: 'admin', email: 'admin@example.com' }],
                total: 1,
                page: 1,
                limit: 10,
              },
            ],
          },
        ],
        authentication: 'api_key',
        tags: ['users', 'management'],
        examples: [
          {
            name: 'Get Users',
            description: 'Retrieve list of users',
            request: {
              method: 'GET',
              url: '/api/v1/users?page=1&limit=10',
              headers: { 'X-API-Key': 'your-api-key' },
            },
            response: {
              statusCode: 200,
              headers: { 'Content-Type': 'application/json' },
              body: { users: [], total: 0, page: 1, limit: 10 },
            },
          },
        ],
        deprecated: false,
        version: '1.0.0',
      },
      {
        id: 'create_user',
        path: '/api/v1/users',
        method: 'POST',
        description: 'Create a new user',
        parameters: [
          {
            name: 'username',
            type: 'string',
            required: true,
            description: 'Username for the new user',
          },
          {
            name: 'email',
            type: 'string',
            required: true,
            description: 'Email address for the new user',
          },
          {
            name: 'password',
            type: 'string',
            required: true,
            description: 'Password for the new user',
          },
          {
            name: 'role',
            type: 'string',
            required: true,
            description: 'Role for the new user',
          },
        ],
        responses: [
          {
            statusCode: 201,
            description: 'User created successfully',
            schema: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                username: { type: 'string' },
                email: { type: 'string' },
                role: { type: 'string' },
                createdAt: { type: 'string' },
              },
            },
            examples: [
              {
                id: '1',
                username: 'newuser',
                email: 'newuser@example.com',
                role: 'user',
                createdAt: '2024-01-01T00:00:00Z',
              },
            ],
          },
          {
            statusCode: 400,
            description: 'Invalid input data',
            schema: {
              type: 'object',
              properties: {
                error: { type: 'string' },
                details: { type: 'array' },
              },
            },
            examples: [
              {
                error: 'Validation failed',
                details: ['Username is required', 'Email is invalid'],
              },
            ],
          },
        ],
        authentication: 'api_key',
        tags: ['users', 'management'],
        examples: [
          {
            name: 'Create User',
            description: 'Create a new user account',
            request: {
              method: 'POST',
              url: '/api/v1/users',
              headers: { 'X-API-Key': 'your-api-key', 'Content-Type': 'application/json' },
              body: {
                username: 'newuser',
                email: 'newuser@example.com',
                password: 'securepassword',
                role: 'user',
              },
            },
            response: {
              statusCode: 201,
              headers: { 'Content-Type': 'application/json' },
              body: { id: '1', username: 'newuser', email: 'newuser@example.com' },
            },
          },
        ],
        deprecated: false,
        version: '1.0.0',
      },
    ];

    for (const endpoint of defaultEndpoints) {
      this.endpoints.set(endpoint.id, endpoint);
    }

    await this.saveEndpoints();
  }

  /**
   * Save endpoints
   */
  private async saveEndpoints(): Promise<void> {
    try {
      const endpointsFile = path.join(this.configPath, 'endpoints.json');
      const data = Array.from(this.endpoints.values());
      await fs.writeFile(endpointsFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save endpoints:', error);
    }
  }

  /**
   * Load documentation
   */
  private async loadDocumentation(): Promise<void> {
    try {
      const docFile = path.join(this.configPath, 'documentation.json');
      if (await fs.pathExists(docFile)) {
        const data = await fs.readFile(docFile, 'utf8');
        this.documentation = JSON.parse(data);
      } else {
        // Create default documentation
        await this.createDefaultDocumentation();
      }
    } catch (error) {
      console.error('Failed to load documentation:', error);
    }
  }

  /**
   * Create default documentation
   */
  private async createDefaultDocumentation(): Promise<void> {
    this.documentation = {
      title: 'Atulya Panel API',
      version: '1.0.0',
      description: 'RESTful API for managing Atulya Panel resources',
      baseUrl: 'https://api.atulya-panel.com',
      endpoints: Array.from(this.endpoints.values()),
      authentication: {
        apiKey: {
          type: 'header',
          name: 'X-API-Key',
        },
        oauth2: {
          authorizationUrl: '/oauth/authorize',
          tokenUrl: '/oauth/token',
          scopes: ['read', 'write', 'admin'],
        },
      },
      rateLimiting: {
        global: {
          requestsPerMinute: 1000,
          requestsPerHour: 10000,
          requestsPerDay: 100000,
          burstLimit: 100,
          windowSize: 60,
        },
        perEndpoint: {},
      },
      examples: [],
      changelog: [
        {
          version: '1.0.0',
          date: new Date(),
          changes: ['Initial API release', 'Basic CRUD operations', 'Authentication support'],
        },
      ],
    };

    await this.saveDocumentation();
  }

  /**
   * Save documentation
   */
  private async saveDocumentation(): Promise<void> {
    try {
      const docFile = path.join(this.configPath, 'documentation.json');
      if (this.documentation) {
        await fs.writeFile(docFile, JSON.stringify(this.documentation, null, 2));
      }
    } catch (error) {
      console.error('Failed to save documentation:', error);
    }
  }

  /**
   * Load logs
   */
  private async loadLogs(): Promise<void> {
    try {
      const logsFile = path.join(this.logPath, 'logs.json');
      if (await fs.pathExists(logsFile)) {
        const data = await fs.readFile(logsFile, 'utf8');
        const logs = JSON.parse(data);
        
        this.logs.clear();
        for (const log of logs) {
          this.logs.set(log.id, log);
        }
      }
    } catch (error) {
      console.error('Failed to load logs:', error);
    }
  }

  /**
   * Save logs
   */
  private async saveLogs(): Promise<void> {
    try {
      const logsFile = path.join(this.logPath, 'logs.json');
      const data = Array.from(this.logs.values());
      await fs.writeFile(logsFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save logs:', error);
    }
  }

  /**
   * Create API key
   */
  async createAPIKey(keyData: {
    name: string;
    description: string;
    permissions: APIPermission[];
    rateLimit?: Partial<RateLimit>;
    expiresAt?: Date;
  }): Promise<APIKey> {
    try {
      const apiKey: APIKey = {
        id: this.generateId(),
        name: keyData.name,
        description: keyData.description,
        key: this.generateAPIKey(),
        secret: this.generateAPISecret(),
        permissions: keyData.permissions,
        rateLimit: {
          requestsPerMinute: 100,
          requestsPerHour: 1000,
          requestsPerDay: 10000,
          burstLimit: 10,
          windowSize: 60,
          ...keyData.rateLimit,
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: {
          totalRequests: 0,
          requestsToday: 0,
          requestsThisHour: 0,
          requestsThisMinute: 0,
          errors: 0,
          successRate: 100,
          averageResponseTime: 0,
          bandwidth: 0,
        },
      };

      this.apiKeys.set(apiKey.id, apiKey);
      await this.saveAPIKeys();

      return apiKey;
    } catch (error) {
      console.error('Failed to create API key:', error);
      throw new Error(`Failed to create API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update API key
   */
  async updateAPIKey(keyId: string, updates: Partial<APIKey>): Promise<APIKey> {
    try {
      const apiKey = this.apiKeys.get(keyId);
      if (!apiKey) {
        throw new Error('API key not found');
      }

      Object.assign(apiKey, updates);
      apiKey.updatedAt = new Date();

      this.apiKeys.set(keyId, apiKey);
      await this.saveAPIKeys();

      return apiKey;
    } catch (error) {
      console.error('Failed to update API key:', error);
      throw new Error(`Failed to update API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete API key
   */
  async deleteAPIKey(keyId: string): Promise<void> {
    try {
      const apiKey = this.apiKeys.get(keyId);
      if (!apiKey) {
        throw new Error('API key not found');
      }

      this.apiKeys.delete(keyId);
      await this.saveAPIKeys();
    } catch (error) {
      console.error('Failed to delete API key:', error);
      throw new Error(`Failed to delete API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get API key by ID
   */
  getAPIKey(keyId: string): APIKey | undefined {
    return this.apiKeys.get(keyId);
  }

  /**
   * Get API key by key
   */
  getAPIKeyByKey(key: string): APIKey | undefined {
    return Array.from(this.apiKeys.values()).find(k => k.key === key);
  }

  /**
   * Get all API keys
   */
  getAPIKeys(): APIKey[] {
    return Array.from(this.apiKeys.values());
  }

  /**
   * Validate API key
   */
  async validateAPIKey(key: string, secret: string): Promise<APIKey | null> {
    try {
      const apiKey = this.getAPIKeyByKey(key);
      if (!apiKey || apiKey.secret !== secret || apiKey.status !== 'active') {
        return null;
      }

      // Check expiration
      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
        return null;
      }

      // Update last used
      apiKey.lastUsed = new Date();
      apiKey.updatedAt = new Date();

      this.apiKeys.set(apiKey.id, apiKey);
      await this.saveAPIKeys();

      return apiKey;
    } catch (error) {
      console.error('Failed to validate API key:', error);
      return null;
    }
  }

  /**
   * Check rate limit
   */
  async checkRateLimit(keyId: string): Promise<{ allowed: boolean; remaining: number; resetTime: Date }> {
    try {
      const apiKey = this.apiKeys.get(keyId);
      if (!apiKey) {
        return { allowed: false, remaining: 0, resetTime: new Date() };
      }

      const now = new Date();
      const windowStart = new Date(now.getTime() - apiKey.rateLimit.windowSize * 1000);
      
      // Get recent requests
      const recentRequests = Array.from(this.logs.values())
        .filter(log => 
          log.apiKeyId === keyId && 
          log.timestamp >= windowStart
        );

      const remaining = Math.max(0, apiKey.rateLimit.requestsPerMinute - recentRequests.length);
      const allowed = remaining > 0;

      return {
        allowed,
        remaining,
        resetTime: new Date(now.getTime() + apiKey.rateLimit.windowSize * 1000),
      };
    } catch (error) {
      console.error('Failed to check rate limit:', error);
      return { allowed: false, remaining: 0, resetTime: new Date() };
    }
  }

  /**
   * Log API request
   */
  async logRequest(logData: {
    apiKeyId: string;
    endpoint: string;
    method: string;
    statusCode: number;
    responseTime: number;
    ip: string;
    userAgent: string;
    request: {
      headers: Record<string, string>;
      body?: any;
      query: Record<string, any>;
    };
    response: {
      headers: Record<string, string>;
      body?: any;
    };
    error?: string;
  }): Promise<void> {
    try {
      const log: APILog = {
        id: this.generateId(),
        apiKeyId: logData.apiKeyId,
        endpoint: logData.endpoint,
        method: logData.method,
        statusCode: logData.statusCode,
        responseTime: logData.responseTime,
        ip: logData.ip,
        userAgent: logData.userAgent,
        timestamp: new Date(),
        request: logData.request,
        response: logData.response,
        error: logData.error,
      };

      this.logs.set(log.id, log);

      // Update API key usage
      const apiKey = this.apiKeys.get(logData.apiKeyId);
      if (apiKey) {
        apiKey.usage.totalRequests++;
        apiKey.usage.requestsToday++;
        apiKey.usage.requestsThisHour++;
        apiKey.usage.requestsThisMinute++;
        apiKey.usage.lastRequest = new Date();

        if (logData.statusCode >= 400) {
          apiKey.usage.errors++;
        }

        apiKey.usage.successRate = ((apiKey.usage.totalRequests - apiKey.usage.errors) / apiKey.usage.totalRequests) * 100;
        apiKey.usage.averageResponseTime = (apiKey.usage.averageResponseTime + logData.responseTime) / 2;

        this.apiKeys.set(apiKey.id, apiKey);
      }

      await this.saveLogs();
      await this.saveAPIKeys();
    } catch (error) {
      console.error('Failed to log API request:', error);
    }
  }

  /**
   * Get API logs
   */
  getAPILogs(filters: {
    apiKeyId?: string;
    endpoint?: string;
    method?: string;
    statusCode?: number;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}): APILog[] {
    let logs = Array.from(this.logs.values());

    if (filters.apiKeyId) {
      logs = logs.filter(log => log.apiKeyId === filters.apiKeyId);
    }

    if (filters.endpoint) {
      logs = logs.filter(log => log.endpoint.includes(filters.endpoint!));
    }

    if (filters.method) {
      logs = logs.filter(log => log.method === filters.method);
    }

    if (filters.statusCode) {
      logs = logs.filter(log => log.statusCode === filters.statusCode);
    }

    if (filters.startDate) {
      logs = logs.filter(log => log.timestamp >= filters.startDate!);
    }

    if (filters.endDate) {
      logs = logs.filter(log => log.timestamp <= filters.endDate!);
    }

    // Sort by timestamp (newest first)
    logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    if (filters.offset) {
      logs = logs.slice(filters.offset);
    }

    if (filters.limit) {
      logs = logs.slice(0, filters.limit);
    }

    return logs;
  }

  /**
   * Get API analytics
   */
  getAPIAnalytics(startDate?: Date, endDate?: Date): APIAnalytics {
    const now = new Date();
    const start = startDate || new Date(now.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
    const end = endDate || now;

    const logs = Array.from(this.logs.values()).filter(log => 
      log.timestamp >= start && log.timestamp <= end
    );

    const requestsByEndpoint: Record<string, number> = {};
    const requestsByMethod: Record<string, number> = {};
    const requestsByStatus: Record<string, number> = {};
    const requestsByHour: Record<string, number> = {};
    const requestsByDay: Record<string, number> = {};
    const ipCounts: Record<string, number> = {};
    const userAgentCounts: Record<string, number> = {};

    let totalResponseTime = 0;
    let errorCount = 0;
    let totalBandwidth = 0;
    let peakRequests = 0;
    let peakTime = new Date();

    for (const log of logs) {
      // Count by endpoint
      requestsByEndpoint[log.endpoint] = (requestsByEndpoint[log.endpoint] || 0) + 1;
      
      // Count by method
      requestsByMethod[log.method] = (requestsByMethod[log.method] || 0) + 1;
      
      // Count by status
      const statusGroup = Math.floor(log.statusCode / 100) * 100;
      requestsByStatus[statusGroup.toString()] = (requestsByStatus[statusGroup.toString()] || 0) + 1;
      
      // Count by hour
      const hour = log.timestamp.getHours().toString().padStart(2, '0');
      requestsByHour[hour] = (requestsByHour[hour] || 0) + 1;
      
      // Count by day
      const day = log.timestamp.toISOString().split('T')[0];
      requestsByDay[day] = (requestsByDay[day] || 0) + 1;
      
      // Count IPs
      ipCounts[log.ip] = (ipCounts[log.ip] || 0) + 1;
      
      // Count user agents
      userAgentCounts[log.userAgent] = (userAgentCounts[log.userAgent] || 0) + 1;
      
      // Response time
      totalResponseTime += log.responseTime;
      
      // Errors
      if (log.statusCode >= 400) {
        errorCount++;
      }
      
      // Bandwidth (estimated)
      totalBandwidth += JSON.stringify(log.request).length + JSON.stringify(log.response).length;
      
      // Peak requests
      const hourRequests = requestsByHour[hour] || 0;
      if (hourRequests > peakRequests) {
        peakRequests = hourRequests;
        peakTime = log.timestamp;
      }
    }

    const totalRequests = logs.length;
    const averageResponseTime = totalRequests > 0 ? totalResponseTime / totalRequests : 0;
    const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;

    // Top IPs
    const topIPs = Object.entries(ipCounts)
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Top user agents
    const topUserAgents = Object.entries(userAgentCounts)
      .map(([userAgent, count]) => ({ userAgent, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalRequests,
      requestsByEndpoint,
      requestsByMethod,
      requestsByStatus,
      requestsByHour,
      requestsByDay,
      averageResponseTime,
      errorRate,
      topIPs,
      topUserAgents,
      bandwidth: totalBandwidth,
      peakRequests,
      peakTime,
    };
  }

  /**
   * Get endpoints
   */
  getEndpoints(): APIEndpoint[] {
    return Array.from(this.endpoints.values());
  }

  /**
   * Get endpoint by ID
   */
  getEndpoint(endpointId: string): APIEndpoint | undefined {
    return this.endpoints.get(endpointId);
  }

  /**
   * Get documentation
   */
  getDocumentation(): APIDocumentation | null {
    return this.documentation;
  }

  /**
   * Update documentation
   */
  async updateDocumentation(updates: Partial<APIDocumentation>): Promise<void> {
    if (this.documentation) {
      Object.assign(this.documentation, updates);
      await this.saveDocumentation();
    }
  }

  /**
   * Generate API key
   */
  private generateAPIKey(): string {
    return 'ak_' + crypto.randomBytes(16).toString('hex');
  }

  /**
   * Generate API secret
   */
  private generateAPISecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}