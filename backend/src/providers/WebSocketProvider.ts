import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { URL } from 'url';
import crypto from 'crypto';

export interface WebSocketConnection {
  id: string;
  ws: WebSocket;
  userId?: string;
  role?: string;
  token?: string;
  ip: string;
  userAgent: string;
  connectedAt: Date;
  lastActivity: Date;
  subscriptions: Set<string>;
  isAlive: boolean;
  metadata?: Record<string, any>;
}

export interface WebSocketMessage {
  id: string;
  type: 'subscribe' | 'unsubscribe' | 'publish' | 'request' | 'response' | 'ping' | 'pong' | 'error' | 'notification' | 'log' | 'metrics' | 'backup' | 'system' | 'get_channels' | 'get_subscriptions' | 'get_history';
  channel?: string;
  data?: any;
  timestamp: Date;
  from?: string;
  to?: string;
  filters?: Record<string, any>;
  requestId?: string;
  responseTo?: string;
}

export interface WebSocketSubscription {
  id: string;
  connectionId: string;
  channel: string;
  filters?: Record<string, any>;
  createdAt: Date;
  lastMessage?: Date;
  messageCount: number;
}

export interface WebSocketChannel {
  name: string;
  description: string;
  type: 'system' | 'notifications' | 'logs' | 'metrics' | 'backups' | 'custom';
  permissions: string[];
  rateLimit: {
    messagesPerMinute: number;
    messagesPerHour: number;
  };
  maxSubscribers: number;
  retention: number; // days
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebSocketEvent {
  id: string;
  type: 'connection' | 'disconnection' | 'subscription' | 'unsubscription' | 'message' | 'error' | 'rate_limit' | 'permission_denied';
  connectionId: string;
  channel?: string;
  message?: string;
  data?: any;
  timestamp: Date;
  ip?: string;
  userAgent?: string;
}

export class WebSocketProvider {
  private wss: WebSocketServer | null = null;
  private connections: Map<string, WebSocketConnection>;
  private subscriptions: Map<string, WebSocketSubscription>;
  private channels: Map<string, WebSocketChannel>;
  private events: WebSocketEvent[];
  private messageHistory: Map<string, WebSocketMessage[]>;
  private isRunning: boolean = false;
  private port: number;
  private maxConnections: number;
  private maxMessageHistory: number;
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(port: number = 8080, maxConnections: number = 1000) {
    this.connections = new Map();
    this.subscriptions = new Map();
    this.channels = new Map();
    this.events = [];
    this.messageHistory = new Map();
    this.port = port;
    this.maxConnections = maxConnections;
    this.maxMessageHistory = 1000;
    
    this.initialize();
  }

  /**
   * Initialize WebSocket provider
   */
  private async initialize(): Promise<void> {
    try {
      await this.createDefaultChannels();
    } catch (error) {
      console.error('Failed to initialize WebSocket provider:', error);
    }
  }

  /**
   * Create default channels
   */
  private async createDefaultChannels(): Promise<void> {
    const defaultChannels: WebSocketChannel[] = [
      {
        name: 'system',
        description: 'System notifications and status updates',
        type: 'system',
        permissions: ['admin', 'user'],
        rateLimit: {
          messagesPerMinute: 60,
          messagesPerHour: 1000,
        },
        maxSubscribers: 100,
        retention: 7,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'notifications',
        description: 'User notifications and alerts',
        type: 'notifications',
        permissions: ['admin', 'user'],
        rateLimit: {
          messagesPerMinute: 30,
          messagesPerHour: 500,
        },
        maxSubscribers: 200,
        retention: 30,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'logs',
        description: 'Real-time log streaming',
        type: 'logs',
        permissions: ['admin'],
        rateLimit: {
          messagesPerMinute: 120,
          messagesPerHour: 2000,
        },
        maxSubscribers: 50,
        retention: 1,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'metrics',
        description: 'System metrics and performance data',
        type: 'metrics',
        permissions: ['admin', 'user'],
        rateLimit: {
          messagesPerMinute: 60,
          messagesPerHour: 1000,
        },
        maxSubscribers: 100,
        retention: 3,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'backups',
        description: 'Backup status and progress updates',
        type: 'backups',
        permissions: ['admin', 'user'],
        rateLimit: {
          messagesPerMinute: 20,
          messagesPerHour: 200,
        },
        maxSubscribers: 50,
        retention: 7,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    for (const channel of defaultChannels) {
      this.channels.set(channel.name, channel);
    }
  }

  /**
   * Start WebSocket server
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    try {
      this.wss = new WebSocketServer({ port: this.port });
      
      this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
        this.handleConnection(ws, request);
      });

      this.wss.on('error', (error: Error) => {
        console.error('WebSocket server error:', error);
      });

      // Start ping interval
      this.pingInterval = setInterval(() => {
        this.pingConnections();
      }, 30000); // 30 seconds

      this.isRunning = true;
      console.log(`WebSocket server started on port ${this.port}`);
    } catch (error) {
      console.error('Failed to start WebSocket server:', error);
      throw error;
    }
  }

  /**
   * Stop WebSocket server
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }

      // Close all connections
      for (const connection of this.connections.values()) {
        connection.ws.close(1000, 'Server shutting down');
      }

      if (this.wss) {
        this.wss.close();
        this.wss = null;
      }

      this.isRunning = false;
      console.log('WebSocket server stopped');
    } catch (error) {
      console.error('Failed to stop WebSocket server:', error);
      throw error;
    }
  }

  /**
   * Handle new connection
   */
  private handleConnection(ws: WebSocket, request: IncomingMessage): void {
    const connectionId = this.generateId();
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const token = url.searchParams.get('token');
    const userId = url.searchParams.get('userId');
    const role = url.searchParams.get('role');
    
    const ip = request.socket.remoteAddress || 'unknown';
    const userAgent = request.headers['user-agent'] || 'unknown';

    // Check connection limit
    if (this.connections.size >= this.maxConnections) {
      ws.close(1008, 'Server at capacity');
      return;
    }

    // Authenticate connection
    const auth = this.authenticateConnection(token, userId, role);
    if (!auth.authenticated) {
      ws.close(1008, 'Authentication failed');
      return;
    }

    const connection: WebSocketConnection = {
      id: connectionId,
      ws,
      userId: auth.userId,
      role: auth.role,
      token: auth.token,
      ip,
      userAgent,
      connectedAt: new Date(),
      lastActivity: new Date(),
      subscriptions: new Set(),
      isAlive: true,
    };

    this.connections.set(connectionId, connection);
    this.logEvent({
      type: 'connection',
      connectionId,
      ip,
      userAgent,
    });

    // Set up message handler
    ws.on('message', (data: Buffer) => {
      this.handleMessage(connectionId, data);
    });

    // Set up close handler
    ws.on('close', (code: number, reason: string) => {
      this.handleDisconnection(connectionId, code, reason);
    });

    // Set up error handler
    ws.on('error', (error: Error) => {
      this.handleError(connectionId, error);
    });

    // Set up pong handler
    ws.on('pong', () => {
      const connection = this.connections.get(connectionId);
      if (connection) {
        connection.isAlive = true;
        connection.lastActivity = new Date();
      }
    });

    // Send welcome message
    this.sendMessage(connectionId, {
      type: 'notification',
      data: {
        message: 'Connected to Atulya Panel WebSocket',
        timestamp: new Date(),
      },
    });
  }

  /**
   * Authenticate connection
   */
  private authenticateConnection(token: string | null, userId: string | null, role: string | null): {
    authenticated: boolean;
    userId?: string;
    role?: string;
    token?: string;
  } {
    // This would integrate with your authentication system
    // For now, allow connections with basic validation
    if (!token && !userId) {
      return { authenticated: false };
    }

    return {
      authenticated: true,
      userId: userId || undefined,
      role: role || 'user',
      token: token || undefined,
    };
  }

  /**
   * Handle incoming message
   */
  private handleMessage(connectionId: string, data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());
      
      if (!this.validateMessage(message)) {
        this.sendError(connectionId, 'Invalid message format');
        return;
      }

      const connection = this.connections.get(connectionId);
      if (!connection) {
        return;
      }

      connection.lastActivity = new Date();

      // Handle different message types
      switch (message.type) {
        case 'subscribe':
          this.handleSubscription(connectionId, message);
          break;
        case 'unsubscribe':
          this.handleUnsubscription(connectionId, message);
          break;
        case 'publish':
          this.handlePublish(connectionId, message);
          break;
        case 'request':
          this.handleRequest(connectionId, message);
          break;
        case 'ping':
          this.handlePing(connectionId, message);
          break;
        case 'get_channels':
          this.handleGetChannels(connectionId, message);
          break;
        case 'get_subscriptions':
          this.handleGetSubscriptions(connectionId, message);
          break;
        case 'get_history':
          this.handleGetHistory(connectionId, message);
          break;
        default:
          this.sendError(connectionId, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      this.sendError(connectionId, 'Failed to parse message');
    }
  }

  /**
   * Validate message format
   */
  private validateMessage(message: any): message is WebSocketMessage {
    return (
      message &&
      typeof message === 'object' &&
      typeof message.type === 'string' &&
      message.timestamp
    );
  }

  /**
   * Handle subscription
   */
  private handleSubscription(connectionId: string, message: WebSocketMessage): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    const channelName = message.channel;
    if (!channelName) {
      this.sendError(connectionId, 'Channel name required for subscription');
      return;
    }

    const channel = this.channels.get(channelName);
    if (!channel) {
      this.sendError(connectionId, `Channel not found: ${channelName}`);
      return;
    }

    if (!channel.isActive) {
      this.sendError(connectionId, `Channel is inactive: ${channelName}`);
      return;
    }

    // Check permissions
    if (!this.hasPermission(connection, channel.permissions)) {
      this.sendError(connectionId, `Permission denied for channel: ${channelName}`);
      return;
    }

    // Check rate limit
    if (!this.checkRateLimit(connectionId, channel)) {
      this.sendError(connectionId, 'Rate limit exceeded');
      return;
    }

    // Check max subscribers
    const subscriberCount = Array.from(this.subscriptions.values())
      .filter(sub => sub.channel === channelName).length;
    
    if (subscriberCount >= channel.maxSubscribers) {
      this.sendError(connectionId, `Channel at capacity: ${channelName}`);
      return;
    }

    // Create subscription
    const subscription: WebSocketSubscription = {
      id: this.generateId(),
      connectionId,
      channel: channelName,
      filters: message.filters,
      createdAt: new Date(),
      messageCount: 0,
    };

    this.subscriptions.set(subscription.id, subscription);
    connection.subscriptions.add(channelName);

    this.logEvent({
      type: 'subscription',
      connectionId,
      channel: channelName,
    });

    this.sendMessage(connectionId, {
      type: 'response',
      responseTo: message.id,
      data: {
        subscribed: true,
        channel: channelName,
        subscriptionId: subscription.id,
      },
    });
  }

  /**
   * Handle unsubscription
   */
  private handleUnsubscription(connectionId: string, message: WebSocketMessage): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    const channelName = message.channel;
    if (!channelName) {
      this.sendError(connectionId, 'Channel name required for unsubscription');
      return;
    }

    // Remove subscription
    const subscription = Array.from(this.subscriptions.values())
      .find(sub => sub.connectionId === connectionId && sub.channel === channelName);
    
    if (subscription) {
      this.subscriptions.delete(subscription.id);
      connection.subscriptions.delete(channelName);

      this.logEvent({
        type: 'unsubscription',
        connectionId,
        channel: channelName,
      });
    }

    this.sendMessage(connectionId, {
      type: 'response',
      responseTo: message.id,
      data: {
        unsubscribed: true,
        channel: channelName,
      },
    });
  }

  /**
   * Handle publish
   */
  private handlePublish(connectionId: string, message: WebSocketMessage): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    const channelName = message.channel;
    if (!channelName) {
      this.sendError(connectionId, 'Channel name required for publish');
      return;
    }

    const channel = this.channels.get(channelName);
    if (!channel) {
      this.sendError(connectionId, `Channel not found: ${channelName}`);
      return;
    }

    // Check permissions
    if (!this.hasPermission(connection, channel.permissions)) {
      this.sendError(connectionId, `Permission denied for channel: ${channelName}`);
      return;
    }

    // Check rate limit
    if (!this.checkRateLimit(connectionId, channel)) {
      this.sendError(connectionId, 'Rate limit exceeded');
      return;
    }

    // Broadcast to channel subscribers
    this.broadcastToChannel(channelName, {
      type: 'message',
      channel: channelName,
      data: message.data,
      from: connectionId,
      timestamp: new Date(),
    });

    this.sendMessage(connectionId, {
      type: 'response',
      responseTo: message.id,
      data: {
        published: true,
        channel: channelName,
      },
    });
  }

  /**
   * Handle request
   */
  private handleRequest(connectionId: string, message: WebSocketMessage): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    // Handle different request types
    switch (message.data?.type) {
      case 'get_channels':
        this.handleGetChannels(connectionId, message);
        break;
      case 'get_subscriptions':
        this.handleGetSubscriptions(connectionId, message);
        break;
      case 'get_history':
        this.handleGetHistory(connectionId, message);
        break;
      default:
        this.sendError(connectionId, `Unknown request type: ${message.data?.type}`);
    }
  }

  /**
   * Handle ping
   */
  private handlePing(connectionId: string, message: WebSocketMessage): void {
    this.sendMessage(connectionId, {
      type: 'pong',
      responseTo: message.id,
      timestamp: new Date(),
    });
  }

  /**
   * Handle get channels
   */
  private handleGetChannels(connectionId: string, message: WebSocketMessage): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    const channels = Array.from(this.channels.values())
      .filter(channel => this.hasPermission(connection, channel.permissions))
      .map(channel => ({
        name: channel.name,
        description: channel.description,
        type: channel.type,
        isActive: channel.isActive,
        subscriberCount: Array.from(this.subscriptions.values())
          .filter(sub => sub.channel === channel.name).length,
      }));

    this.sendMessage(connectionId, {
      type: 'response',
      responseTo: message.id,
      data: { channels },
    });
  }

  /**
   * Handle get subscriptions
   */
  private handleGetSubscriptions(connectionId: string, message: WebSocketMessage): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    const subscriptions = Array.from(this.subscriptions.values())
      .filter(sub => sub.connectionId === connectionId)
      .map(sub => ({
        id: sub.id,
        channel: sub.channel,
        createdAt: sub.createdAt,
        lastMessage: sub.lastMessage,
        messageCount: sub.messageCount,
      }));

    this.sendMessage(connectionId, {
      type: 'response',
      responseTo: message.id,
      data: { subscriptions },
    });
  }

  /**
   * Handle get history
   */
  private handleGetHistory(connectionId: string, message: WebSocketMessage): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    const channelName = message.data?.channel;
    if (!channelName) {
      this.sendError(connectionId, 'Channel name required for history');
      return;
    }

    const channel = this.channels.get(channelName);
    if (!channel) {
      this.sendError(connectionId, `Channel not found: ${channelName}`);
      return;
    }

    // Check permissions
    if (!this.hasPermission(connection, channel.permissions)) {
      this.sendError(connectionId, `Permission denied for channel: ${channelName}`);
      return;
    }

    const history = this.messageHistory.get(channelName) || [];
    const limit = message.data?.limit || 50;
    const filteredHistory = history.slice(-limit);

    this.sendMessage(connectionId, {
      type: 'response',
      responseTo: message.id,
      data: { history: filteredHistory },
    });
  }

  /**
   * Handle disconnection
   */
  private handleDisconnection(connectionId: string, code: number, reason: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    // Remove all subscriptions
    for (const subscription of this.subscriptions.values()) {
      if (subscription.connectionId === connectionId) {
        this.subscriptions.delete(subscription.id);
      }
    }

    this.connections.delete(connectionId);

    this.logEvent({
      type: 'disconnection',
      connectionId,
      message: `Disconnected: ${reason}`,
      data: { code, reason },
    });
  }

  /**
   * Handle error
   */
  private handleError(connectionId: string, error: Error): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    this.logEvent({
      type: 'error',
      connectionId,
      message: error.message,
      data: { error: error.stack },
    });

    // Close connection on error
    connection.ws.close(1011, 'Internal error');
  }

  /**
   * Send message to connection
   */
  private sendMessage(connectionId: string, message: Partial<WebSocketMessage>): void {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const fullMessage: WebSocketMessage = {
      id: this.generateId(),
      type: 'notification',
      timestamp: new Date(),
      ...message,
    };

    try {
      connection.ws.send(JSON.stringify(fullMessage));
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }

  /**
   * Send error message
   */
  private sendError(connectionId: string, error: string): void {
    this.sendMessage(connectionId, {
      type: 'error',
      data: { error },
    });
  }

  /**
   * Broadcast message to channel
   */
  broadcastToChannel(channelName: string, message: Partial<WebSocketMessage>): void {
    const channel = this.channels.get(channelName);
    if (!channel) {
      return;
    }

    const fullMessage: WebSocketMessage = {
      id: this.generateId(),
      type: 'message',
      channel: channelName,
      timestamp: new Date(),
      ...message,
    };

    // Store in history
    this.storeMessageHistory(channelName, fullMessage);

    // Send to subscribers
    const subscribers = Array.from(this.subscriptions.values())
      .filter(sub => sub.channel === channelName);

    for (const subscription of subscribers) {
      const connection = this.connections.get(subscription.connectionId);
      if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
        continue;
      }

      // Apply filters
      if (subscription.filters && !this.matchesFilters(fullMessage, subscription.filters)) {
        continue;
      }

      // Check rate limit
      if (!this.checkRateLimit(subscription.connectionId, channel)) {
        continue;
      }

      try {
        connection.ws.send(JSON.stringify(fullMessage));
        subscription.messageCount++;
        subscription.lastMessage = new Date();
      } catch (error) {
        console.error('Failed to broadcast message:', error);
      }
    }
  }

  /**
   * Store message in history
   */
  private storeMessageHistory(channelName: string, message: WebSocketMessage): void {
    if (!this.messageHistory.has(channelName)) {
      this.messageHistory.set(channelName, []);
    }

    const history = this.messageHistory.get(channelName)!;
    history.push(message);

    // Limit history size
    if (history.length > this.maxMessageHistory) {
      history.splice(0, history.length - this.maxMessageHistory);
    }
  }

  /**
   * Check if message matches filters
   */
  private matchesFilters(message: WebSocketMessage, filters: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(filters)) {
      if (message.data && typeof message.data === 'object') {
        if (message.data[key] !== value) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Check rate limit
   */
  private checkRateLimit(connectionId: string, channel: WebSocketChannel): boolean {
    // This would implement rate limiting logic
    // For now, always allow
    return true;
  }

  /**
   * Check permissions
   */
  private hasPermission(connection: WebSocketConnection, requiredPermissions: string[]): boolean {
    if (!connection.role) {
      return false;
    }

    return requiredPermissions.includes(connection.role);
  }

  /**
   * Ping connections
   */
  private pingConnections(): void {
    for (const connection of this.connections.values()) {
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.isAlive = false;
        connection.ws.ping();
      }
    }
  }

  /**
   * Send system notification
   */
  sendSystemNotification(message: string, data?: any): void {
    this.broadcastToChannel('system', {
      type: 'system',
      data: {
        message,
        data,
        timestamp: new Date(),
      },
    });
  }

  /**
   * Send log message
   */
  sendLogMessage(level: string, message: string, data?: any): void {
    this.broadcastToChannel('logs', {
      type: 'log',
      data: {
        level,
        message,
        data,
        timestamp: new Date(),
      },
    });
  }

  /**
   * Send metrics
   */
  sendMetrics(metrics: any): void {
    this.broadcastToChannel('metrics', {
      type: 'metrics',
      data: {
        metrics,
        timestamp: new Date(),
      },
    });
  }

  /**
   * Send backup status
   */
  sendBackupStatus(status: string, progress?: number, data?: any): void {
    this.broadcastToChannel('backups', {
      type: 'backup',
      data: {
        status,
        progress,
        data,
        timestamp: new Date(),
      },
    });
  }

  /**
   * Log event
   */
  private logEvent(event: Omit<WebSocketEvent, 'id' | 'timestamp'>): void {
    const fullEvent: WebSocketEvent = {
      id: this.generateId(),
      timestamp: new Date(),
      ...event,
    };

    this.events.push(fullEvent);

    // Limit events array size
    if (this.events.length > 10000) {
      this.events.splice(0, this.events.length - 10000);
    }
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    connections: number;
    subscriptions: number;
    channels: number;
    events: number;
    uptime: number;
  } {
    return {
      connections: this.connections.size,
      subscriptions: this.subscriptions.size,
      channels: this.channels.size,
      events: this.events.length,
      uptime: this.isRunning ? Date.now() - (this.events[0]?.timestamp.getTime() || Date.now()) : 0,
    };
  }

  /**
   * Get events
   */
  getEvents(limit: number = 100): WebSocketEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return crypto.randomBytes(16).toString('hex');
  }
}