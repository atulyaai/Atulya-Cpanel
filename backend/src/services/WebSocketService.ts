import { Server as SocketIOServer } from 'socket.io';
import { FastifyInstance } from 'fastify';
import { MonitoringProvider, SystemMetrics, SiteMetrics, DatabaseMetrics, EmailMetrics } from '../providers/MonitoringProvider.js';
import { prisma } from '../server.js';

export interface WebSocketEvents {
  // Client to Server events
  'join-monitoring': (data: { room: string }) => void;
  'leave-monitoring': (data: { room: string }) => void;
  'subscribe-system': () => void;
  'subscribe-sites': () => void;
  'subscribe-databases': () => void;
  'subscribe-email': () => void;
  'subscribe-alerts': () => void;

  // Server to Client events
  'system-metrics': (data: SystemMetrics) => void;
  'site-metrics': (data: SiteMetrics[]) => void;
  'database-metrics': (data: DatabaseMetrics[]) => void;
  'email-metrics': (data: EmailMetrics) => void;
  'system-alerts': (data: Array<{
    type: 'warning' | 'critical';
    message: string;
    timestamp: Date;
  }>) => void;
  'error': (data: { message: string; code?: string }) => void;
}

export class WebSocketService {
  private io: SocketIOServer | null = null;
  private monitoringProvider: MonitoringProvider;
  private updateInterval: NodeJS.Timeout | null = null;
  private connectedClients = new Set<string>();
  private subscriptions = new Map<string, Set<string>>(); // clientId -> Set<subscription>

  constructor() {
    this.monitoringProvider = new MonitoringProvider();
    this.subscriptions.set('system', new Set());
    this.subscriptions.set('sites', new Set());
    this.subscriptions.set('databases', new Set());
    this.subscriptions.set('email', new Set());
    this.subscriptions.set('alerts', new Set());
  }

  /**
   * Initialize WebSocket service with Fastify
   */
  async initialize(fastify: FastifyInstance): Promise<void> {
    try {
      // Create Socket.IO server
      this.io = new SocketIOServer(fastify.server, {
        cors: {
          origin: process.env.FRONTEND_URL || "http://localhost:5173",
          methods: ["GET", "POST"],
          credentials: true
        },
        transports: ['websocket', 'polling']
      });

      // Handle connections
      this.io.on('connection', (socket) => {
        this.handleConnection(socket);
      });

      // Start monitoring updates
      this.startMonitoringUpdates();

      fastify.log.info('WebSocket service initialized');
    } catch (error) {
      fastify.log.error('Failed to initialize WebSocket service:', error);
      throw error;
    }
  }

  /**
   * Handle new client connection
   */
  private handleConnection(socket: any): void {
    const clientId = socket.id;
    this.connectedClients.add(clientId);

    console.log(`Client connected: ${clientId}`);

    // Handle client events
    socket.on('subscribe-system', () => this.subscribeToSystem(clientId, socket));
    socket.on('subscribe-sites', () => this.subscribeToSites(clientId, socket));
    socket.on('subscribe-databases', () => this.subscribeToDatabases(clientId, socket));
    socket.on('subscribe-email', () => this.subscribeToEmail(clientId, socket));
    socket.on('subscribe-alerts', () => this.subscribeToAlerts(clientId, socket));

    socket.on('unsubscribe-system', () => this.unsubscribeFromSystem(clientId));
    socket.on('unsubscribe-sites', () => this.unsubscribeFromSites(clientId));
    socket.on('unsubscribe-databases', () => this.unsubscribeFromDatabases(clientId));
    socket.on('unsubscribe-email', () => this.unsubscribeFromEmail(clientId));
    socket.on('unsubscribe-alerts', () => this.unsubscribeFromAlerts(clientId));

    // Handle disconnection
    socket.on('disconnect', () => {
      this.handleDisconnection(clientId);
    });

    // Send initial data if subscribed
    this.sendInitialData(socket);
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(clientId: string): void {
    this.connectedClients.delete(clientId);
    
    // Remove from all subscriptions
    for (const subscription of this.subscriptions.values()) {
      subscription.delete(clientId);
    }

    console.log(`Client disconnected: ${clientId}`);
  }

  /**
   * Subscribe to system metrics
   */
  private subscribeToSystem(clientId: string, socket: any): void {
    this.subscriptions.get('system')?.add(clientId);
    console.log(`Client ${clientId} subscribed to system metrics`);
    
    // Send current system metrics immediately
    this.sendSystemMetrics(socket);
  }

  /**
   * Subscribe to site metrics
   */
  private subscribeToSites(clientId: string, socket: any): void {
    this.subscriptions.get('sites')?.add(clientId);
    console.log(`Client ${clientId} subscribed to site metrics`);
    
    // Send current site metrics immediately
    this.sendSiteMetrics(socket);
  }

  /**
   * Subscribe to database metrics
   */
  private subscribeToDatabases(clientId: string, socket: any): void {
    this.subscriptions.get('databases')?.add(clientId);
    console.log(`Client ${clientId} subscribed to database metrics`);
    
    // Send current database metrics immediately
    this.sendDatabaseMetrics(socket);
  }

  /**
   * Subscribe to email metrics
   */
  private subscribeToEmail(clientId: string, socket: any): void {
    this.subscriptions.get('email')?.add(clientId);
    console.log(`Client ${clientId} subscribed to email metrics`);
    
    // Send current email metrics immediately
    this.sendEmailMetrics(socket);
  }

  /**
   * Subscribe to alerts
   */
  private subscribeToAlerts(clientId: string, socket: any): void {
    this.subscriptions.get('alerts')?.add(clientId);
    console.log(`Client ${clientId} subscribed to alerts`);
    
    // Send current alerts immediately
    this.sendAlerts(socket);
  }

  /**
   * Unsubscribe from system metrics
   */
  private unsubscribeFromSystem(clientId: string): void {
    this.subscriptions.get('system')?.delete(clientId);
    console.log(`Client ${clientId} unsubscribed from system metrics`);
  }

  /**
   * Unsubscribe from site metrics
   */
  private unsubscribeFromSites(clientId: string): void {
    this.subscriptions.get('sites')?.delete(clientId);
    console.log(`Client ${clientId} unsubscribed from site metrics`);
  }

  /**
   * Unsubscribe from database metrics
   */
  private unsubscribeFromDatabases(clientId: string): void {
    this.subscriptions.get('databases')?.delete(clientId);
    console.log(`Client ${clientId} unsubscribed from database metrics`);
  }

  /**
   * Unsubscribe from email metrics
   */
  private unsubscribeFromEmail(clientId: string): void {
    this.subscriptions.get('email')?.delete(clientId);
    console.log(`Client ${clientId} unsubscribed from email metrics`);
  }

  /**
   * Unsubscribe from alerts
   */
  private unsubscribeFromAlerts(clientId: string): void {
    this.subscriptions.get('alerts')?.delete(clientId);
    console.log(`Client ${clientId} unsubscribed from alerts`);
  }

  /**
   * Send initial data to newly connected client
   */
  private async sendInitialData(socket: any): Promise<void> {
    try {
      // Send welcome message
      socket.emit('connected', {
        message: 'Connected to Atulya Panel monitoring',
        timestamp: new Date()
      });
    } catch (error) {
      socket.emit('error', {
        message: 'Failed to send initial data',
        code: 'INIT_ERROR'
      });
    }
  }

  /**
   * Start monitoring updates
   */
  private startMonitoringUpdates(): void {
    // Update metrics every 5 seconds
    this.updateInterval = setInterval(async () => {
      await this.updateAllMetrics();
    }, 5000);

    console.log('Started monitoring updates');
  }

  /**
   * Update all metrics and broadcast to subscribed clients
   */
  private async updateAllMetrics(): Promise<void> {
    try {
      // Get system metrics
      const systemMetrics = await this.monitoringProvider.getSystemMetrics();
      this.broadcastSystemMetrics(systemMetrics);

      // Get site metrics
      const sites = await prisma.site.findMany({
        select: { id: true, domain: true }
      });
      const siteMetrics = await this.monitoringProvider.getSiteMetrics(sites);
      this.broadcastSiteMetrics(siteMetrics);

      // Get database metrics
      const databaseMetrics = await this.monitoringProvider.getDatabaseMetrics();
      this.broadcastDatabaseMetrics(databaseMetrics);

      // Get email metrics
      const emailMetrics = await this.monitoringProvider.getEmailMetrics();
      this.broadcastEmailMetrics(emailMetrics);

      // Get and broadcast alerts
      const alerts = this.monitoringProvider.getSystemAlerts(systemMetrics);
      this.broadcastAlerts(alerts);

    } catch (error) {
      console.error('Failed to update metrics:', error);
      this.broadcastError('Failed to update monitoring data');
    }
  }

  /**
   * Broadcast system metrics to subscribed clients
   */
  private broadcastSystemMetrics(metrics: SystemMetrics): void {
    const subscribedClients = this.subscriptions.get('system');
    if (!subscribedClients || subscribedClients.size === 0) return;

    subscribedClients.forEach(clientId => {
      const socket = this.io?.sockets.sockets.get(clientId);
      if (socket) {
        socket.emit('system-metrics', metrics);
      }
    });
  }

  /**
   * Broadcast site metrics to subscribed clients
   */
  private broadcastSiteMetrics(metrics: SiteMetrics[]): void {
    const subscribedClients = this.subscriptions.get('sites');
    if (!subscribedClients || subscribedClients.size === 0) return;

    subscribedClients.forEach(clientId => {
      const socket = this.io?.sockets.sockets.get(clientId);
      if (socket) {
        socket.emit('site-metrics', metrics);
      }
    });
  }

  /**
   * Broadcast database metrics to subscribed clients
   */
  private broadcastDatabaseMetrics(metrics: DatabaseMetrics[]): void {
    const subscribedClients = this.subscriptions.get('databases');
    if (!subscribedClients || subscribedClients.size === 0) return;

    subscribedClients.forEach(clientId => {
      const socket = this.io?.sockets.sockets.get(clientId);
      if (socket) {
        socket.emit('database-metrics', metrics);
      }
    });
  }

  /**
   * Broadcast email metrics to subscribed clients
   */
  private broadcastEmailMetrics(metrics: EmailMetrics): void {
    const subscribedClients = this.subscriptions.get('email');
    if (!subscribedClients || subscribedClients.size === 0) return;

    subscribedClients.forEach(clientId => {
      const socket = this.io?.sockets.sockets.get(clientId);
      if (socket) {
        socket.emit('email-metrics', metrics);
      }
    });
  }

  /**
   * Broadcast alerts to subscribed clients
   */
  private broadcastAlerts(alerts: Array<{
    type: 'warning' | 'critical';
    message: string;
    timestamp: Date;
  }>): void {
    const subscribedClients = this.subscriptions.get('alerts');
    if (!subscribedClients || subscribedClients.size === 0) return;

    subscribedClients.forEach(clientId => {
      const socket = this.io?.sockets.sockets.get(clientId);
      if (socket) {
        socket.emit('system-alerts', alerts);
      }
    });
  }

  /**
   * Broadcast error to all clients
   */
  private broadcastError(message: string): void {
    this.connectedClients.forEach(clientId => {
      const socket = this.io?.sockets.sockets.get(clientId);
      if (socket) {
        socket.emit('error', { message });
      }
    });
  }

  /**
   * Send system metrics to specific client
   */
  private async sendSystemMetrics(socket: any): Promise<void> {
    try {
      const metrics = await this.monitoringProvider.getSystemMetrics();
      socket.emit('system-metrics', metrics);
    } catch (error) {
      socket.emit('error', {
        message: 'Failed to get system metrics'
      });
    }
  }

  /**
   * Send site metrics to specific client
   */
  private async sendSiteMetrics(socket: any): Promise<void> {
    try {
      const sites = await prisma.site.findMany({
        select: { id: true, domain: true }
      });
      const metrics = await this.monitoringProvider.getSiteMetrics(sites);
      socket.emit('site-metrics', metrics);
    } catch (error) {
      socket.emit('error', {
        message: 'Failed to get site metrics'
      });
    }
  }

  /**
   * Send database metrics to specific client
   */
  private async sendDatabaseMetrics(socket: any): Promise<void> {
    try {
      const metrics = await this.monitoringProvider.getDatabaseMetrics();
      socket.emit('database-metrics', metrics);
    } catch (error) {
      socket.emit('error', {
        message: 'Failed to get database metrics'
      });
    }
  }

  /**
   * Send email metrics to specific client
   */
  private async sendEmailMetrics(socket: any): Promise<void> {
    try {
      const metrics = await this.monitoringProvider.getEmailMetrics();
      socket.emit('email-metrics', metrics);
    } catch (error) {
      socket.emit('error', {
        message: 'Failed to get email metrics'
      });
    }
  }

  /**
   * Send alerts to specific client
   */
  private async sendAlerts(socket: any): Promise<void> {
    try {
      const systemMetrics = await this.monitoringProvider.getSystemMetrics();
      const alerts = this.monitoringProvider.getSystemAlerts(systemMetrics);
      socket.emit('system-alerts', alerts);
    } catch (error) {
      socket.emit('error', {
        message: 'Failed to get alerts'
      });
    }
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): {
    totalConnections: number;
    subscriptions: {
      system: number;
      sites: number;
      databases: number;
      email: number;
      alerts: number;
    };
  } {
    return {
      totalConnections: this.connectedClients.size,
      subscriptions: {
        system: this.subscriptions.get('system')?.size || 0,
        sites: this.subscriptions.get('sites')?.size || 0,
        databases: this.subscriptions.get('databases')?.size || 0,
        email: this.subscriptions.get('email')?.size || 0,
        alerts: this.subscriptions.get('alerts')?.size || 0,
      }
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    if (this.io) {
      this.io.close();
      this.io = null;
    }

    this.connectedClients.clear();
    this.subscriptions.clear();
  }
}
