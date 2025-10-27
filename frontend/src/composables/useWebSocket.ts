import { ref, onUnmounted, computed } from 'vue';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth';

export interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    model: string;
    speed: number;
    temperature?: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
    cached: number;
    buffers: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    percentage: number;
    readSpeed: number;
    writeSpeed: number;
  };
  network: {
    interfaces: Array<{
      name: string;
      bytesReceived: number;
      bytesSent: number;
      packetsReceived: number;
      packetsSent: number;
    }>;
  };
  load: {
    avg1m: number;
    avg5m: number;
    avg15m: number;
  };
  uptime: number;
  processes: {
    total: number;
    running: number;
    sleeping: number;
    zombie: number;
  };
  services: {
    nginx: boolean;
    apache: boolean;
    mysql: boolean;
    postfix: boolean;
    dovecot: boolean;
    redis: boolean;
  };
}

export interface SiteMetrics {
  id: string;
  domain: string;
  status: 'online' | 'offline' | 'error';
  responseTime: number;
  lastChecked: Date;
  sslStatus: 'valid' | 'expired' | 'invalid' | 'none';
  sslExpiry?: Date;
  traffic: {
    bytesIn: number;
    bytesOut: number;
    requests: number;
  };
}

export interface DatabaseMetrics {
  name: string;
  size: number;
  tables: number;
  connections: number;
  queries: number;
  slowQueries: number;
}

export interface EmailMetrics {
  totalAccounts: number;
  activeAccounts: number;
  totalQuota: number;
  usedQuota: number;
  messagesToday: number;
  queueSize: number;
}

export interface SystemAlert {
  type: 'warning' | 'critical';
  message: string;
  timestamp: Date;
}

export function useWebSocket() {
  const authStore = useAuthStore();
  
  // Connection state
  const isConnected = ref(false);
  const isConnecting = ref(false);
  const connectionError = ref<string | null>(null);
  
  // Socket instance
  let socket: Socket | null = null;
  
  // Metrics data
  const systemMetrics = ref<SystemMetrics | null>(null);
  const siteMetrics = ref<SiteMetrics[]>([]);
  const databaseMetrics = ref<DatabaseMetrics[]>([]);
  const emailMetrics = ref<EmailMetrics | null>(null);
  const alerts = ref<SystemAlert[]>([]);
  
  // Subscription state
  const subscriptions = ref({
    system: false,
    sites: false,
    databases: false,
    email: false,
    alerts: false
  });

  // Computed properties
  const connectionStatus = computed(() => {
    if (isConnecting.value) return 'connecting';
    if (isConnected.value) return 'connected';
    if (connectionError.value) return 'error';
    return 'disconnected';
  });

  const hasActiveSubscriptions = computed(() => {
    return Object.values(subscriptions.value).some(Boolean);
  });

  /**
   * Connect to WebSocket server
   */
  function connect() {
    if (socket?.connected || isConnecting.value) {
      return;
    }

    isConnecting.value = true;
    connectionError.value = null;

    const token = authStore.token;
    if (!token) {
      connectionError.value = 'No authentication token available';
      isConnecting.value = false;
      return;
    }

    // Create socket connection
    socket = io(import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000', {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    // Connection events
    socket.on('connect', () => {
      isConnected.value = true;
      isConnecting.value = false;
      connectionError.value = null;
      
      // Restore subscriptions
      if (subscriptions.value.system) subscribeToSystem();
      if (subscriptions.value.sites) subscribeToSites();
      if (subscriptions.value.databases) subscribeToDatabases();
      if (subscriptions.value.email) subscribeToEmail();
      if (subscriptions.value.alerts) subscribeToAlerts();
    });

    socket.on('disconnect', (reason) => {
      isConnected.value = false;
      isConnecting.value = false;
      
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, don't reconnect
        connectionError.value = 'Server disconnected';
      }
    });

    socket.on('connect_error', (error) => {
      isConnecting.value = false;
      connectionError.value = error.message;
    });

    socket.on('error', (error) => {
      connectionError.value = error.message;
    });

    // Data events
    socket.on('system-metrics', (data: SystemMetrics) => {
      systemMetrics.value = data;
    });

    socket.on('site-metrics', (data: SiteMetrics[]) => {
      siteMetrics.value = data;
    });

    socket.on('database-metrics', (data: DatabaseMetrics[]) => {
      databaseMetrics.value = data;
    });

    socket.on('email-metrics', (data: EmailMetrics) => {
      emailMetrics.value = data;
    });

    socket.on('system-alerts', (data: SystemAlert[]) => {
      alerts.value = data;
    });

    socket.on('connected', (data) => {
      // WebSocket connected successfully
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  function disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    
    isConnected.value = false;
    isConnecting.value = false;
    connectionError.value = null;
    
    // Clear subscriptions
    subscriptions.value = {
      system: false,
      sites: false,
      databases: false,
      email: false,
      alerts: false
    };
  }

  /**
   * Subscribe to system metrics
   */
  function subscribeToSystem() {
    if (socket?.connected) {
      socket.emit('subscribe-system');
      subscriptions.value.system = true;
    }
  }

  /**
   * Subscribe to site metrics
   */
  function subscribeToSites() {
    if (socket?.connected) {
      socket.emit('subscribe-sites');
      subscriptions.value.sites = true;
    }
  }

  /**
   * Subscribe to database metrics
   */
  function subscribeToDatabases() {
    if (socket?.connected) {
      socket.emit('subscribe-databases');
      subscriptions.value.databases = true;
    }
  }

  /**
   * Subscribe to email metrics
   */
  function subscribeToEmail() {
    if (socket?.connected) {
      socket.emit('subscribe-email');
      subscriptions.value.email = true;
    }
  }

  /**
   * Subscribe to alerts
   */
  function subscribeToAlerts() {
    if (socket?.connected) {
      socket.emit('subscribe-alerts');
      subscriptions.value.alerts = true;
    }
  }

  /**
   * Unsubscribe from system metrics
   */
  function unsubscribeFromSystem() {
    if (socket?.connected) {
      socket.emit('unsubscribe-system');
    }
    subscriptions.value.system = false;
  }

  /**
   * Unsubscribe from site metrics
   */
  function unsubscribeFromSites() {
    if (socket?.connected) {
      socket.emit('unsubscribe-sites');
    }
    subscriptions.value.sites = false;
  }

  /**
   * Unsubscribe from database metrics
   */
  function unsubscribeFromDatabases() {
    if (socket?.connected) {
      socket.emit('unsubscribe-databases');
    }
    subscriptions.value.databases = false;
  }

  /**
   * Unsubscribe from email metrics
   */
  function unsubscribeFromEmail() {
    if (socket?.connected) {
      socket.emit('unsubscribe-email');
    }
    subscriptions.value.email = false;
  }

  /**
   * Unsubscribe from alerts
   */
  function unsubscribeFromAlerts() {
    if (socket?.connected) {
      socket.emit('unsubscribe-alerts');
    }
    subscriptions.value.alerts = false;
  }

  /**
   * Reconnect with new token
   */
  function reconnect() {
    disconnect();
    connect();
  }

  /**
   * Get formatted uptime
   */
  function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  /**
   * Get formatted bytes
   */
  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get service status color
   */
  function getServiceStatusColor(isRunning: boolean): string {
    return isRunning ? 'text-green-600' : 'text-red-600';
  }

  /**
   * Get alert severity color
   */
  function getAlertColor(type: 'warning' | 'critical'): string {
    return type === 'critical' ? 'text-red-600' : 'text-yellow-600';
  }

  // Cleanup on unmount
  onUnmounted(() => {
    disconnect();
  });

  return {
    // Connection state
    isConnected,
    isConnecting,
    connectionError,
    connectionStatus,
    hasActiveSubscriptions,
    
    // Data
    systemMetrics,
    siteMetrics,
    databaseMetrics,
    emailMetrics,
    alerts,
    
    // Subscriptions
    subscriptions,
    
    // Methods
    connect,
    disconnect,
    reconnect,
    subscribeToSystem,
    subscribeToSites,
    subscribeToDatabases,
    subscribeToEmail,
    subscribeToAlerts,
    unsubscribeFromSystem,
    unsubscribeFromSites,
    unsubscribeFromDatabases,
    unsubscribeFromEmail,
    unsubscribeFromAlerts,
    
    // Utilities
    formatUptime,
    formatBytes,
    getServiceStatusColor,
    getAlertColor
  };
}
