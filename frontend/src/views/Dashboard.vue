<template>
  <div class="space-y-6">
    <!-- Page header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p class="text-gray-600">Welcome back, {{ authStore.user?.username }}!</p>
      </div>
      <div class="flex items-center space-x-4">
        <button class="btn-primary">
          <i class="pi pi-plus mr-2"></i>
          Create Site
        </button>
      </div>
    </div>

    <!-- Stats cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div class="card">
        <div class="flex items-center">
          <div class="p-3 bg-blue-100 rounded-lg">
            <i class="pi pi-globe text-blue-600 text-xl"></i>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Active Sites</p>
            <p class="text-2xl font-bold text-gray-900">{{ stats.sites }}</p>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="flex items-center">
          <div class="p-3 bg-green-100 rounded-lg">
            <i class="pi pi-database text-green-600 text-xl"></i>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Databases</p>
            <p class="text-2xl font-bold text-gray-900">{{ stats.databases }}</p>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="flex items-center">
          <div class="p-3 bg-purple-100 rounded-lg">
            <i class="pi pi-envelope text-purple-600 text-xl"></i>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Email Accounts</p>
            <p class="text-2xl font-bold text-gray-900">{{ stats.emails }}</p>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="flex items-center">
          <div class="p-3 bg-orange-100 rounded-lg">
            <i class="pi pi-cloud-download text-orange-600 text-xl"></i>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Backups</p>
            <p class="text-2xl font-bold text-gray-900">{{ stats.backups }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Connection Status -->
    <div class="card">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <div class="flex items-center space-x-2">
            <div 
              class="w-3 h-3 rounded-full"
              :class="{
                'bg-green-500': connectionStatus === 'connected',
                'bg-yellow-500': connectionStatus === 'connecting',
                'bg-red-500': connectionStatus === 'error' || connectionStatus === 'disconnected'
              }"
            ></div>
            <span class="text-sm font-medium text-gray-700">
              Real-time Monitoring: {{ connectionStatus }}
            </span>
          </div>
          <div v-if="connectionError" class="text-sm text-red-600">
            {{ connectionError }}
          </div>
        </div>
        <div class="flex items-center space-x-2">
          <button 
            @click="connect" 
            :disabled="isConnecting || isConnected"
            class="btn-secondary btn-sm"
          >
            <i class="pi pi-refresh mr-1"></i>
            Connect
          </button>
          <button 
            @click="disconnect" 
            :disabled="!isConnected"
            class="btn-secondary btn-sm"
          >
            <i class="pi pi-times mr-1"></i>
            Disconnect
          </button>
        </div>
      </div>
    </div>

    <!-- System metrics -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- CPU Usage -->
      <div class="card">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900">CPU Usage</h3>
          <span class="text-sm text-gray-500">
            {{ systemMetrics?.cpu?.usage || 0 }}%
          </span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2">
          <div
            class="bg-blue-600 h-2 rounded-full transition-all duration-300"
            :style="{ width: `${systemMetrics?.cpu?.usage || 0}%` }"
          ></div>
        </div>
        <p class="text-sm text-gray-600 mt-2">
          {{ systemMetrics?.cpu?.cores || 0 }} cores • 
          {{ systemMetrics?.cpu?.model || 'Unknown' }} • 
          Load: {{ systemMetrics?.load?.avg1m?.toFixed(2) || '0.00' }}
        </p>
        <div v-if="systemMetrics?.cpu?.temperature" class="text-sm text-gray-500 mt-1">
          Temperature: {{ systemMetrics.cpu.temperature }}°C
        </div>
      </div>

      <!-- Memory Usage -->
      <div class="card">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900">Memory Usage</h3>
          <span class="text-sm text-gray-500">
            {{ systemMetrics?.memory?.percentage || 0 }}%
          </span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2">
          <div
            class="bg-green-600 h-2 rounded-full transition-all duration-300"
            :style="{ width: `${systemMetrics?.memory?.percentage || 0}%` }"
          ></div>
        </div>
        <p class="text-sm text-gray-600 mt-2">
          {{ formatBytes(systemMetrics?.memory?.used || 0) }} / {{ formatBytes(systemMetrics?.memory?.total || 0) }}
        </p>
        <div class="text-sm text-gray-500 mt-1">
          Cached: {{ formatBytes(systemMetrics?.memory?.cached || 0) }} • 
          Buffers: {{ formatBytes(systemMetrics?.memory?.buffers || 0) }}
        </div>
      </div>

      <!-- Disk Usage -->
      <div class="card">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900">Disk Usage</h3>
          <span class="text-sm text-gray-500">
            {{ systemMetrics?.disk?.percentage || 0 }}%
          </span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2">
          <div
            class="bg-purple-600 h-2 rounded-full transition-all duration-300"
            :style="{ width: `${systemMetrics?.disk?.percentage || 0}%` }"
          ></div>
        </div>
        <p class="text-sm text-gray-600 mt-2">
          {{ formatBytes(systemMetrics?.disk?.used || 0) }} / {{ formatBytes(systemMetrics?.disk?.total || 0) }}
        </p>
        <div class="text-sm text-gray-500 mt-1">
          Read: {{ formatBytes(systemMetrics?.disk?.readSpeed || 0) }}/s • 
          Write: {{ formatBytes(systemMetrics?.disk?.writeSpeed || 0) }}/s
        </div>
      </div>

      <!-- System Info -->
      <div class="card">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900">System Information</h3>
        </div>
        <div class="space-y-2">
          <div class="flex justify-between text-sm">
            <span class="text-gray-600">Uptime:</span>
            <span class="text-gray-900">{{ formatUptime(systemMetrics?.uptime || 0) }}</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-gray-600">Processes:</span>
            <span class="text-gray-900">{{ systemMetrics?.processes?.total || 0 }}</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-gray-600">Running:</span>
            <span class="text-gray-900">{{ systemMetrics?.processes?.running || 0 }}</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-gray-600">Load Average:</span>
            <span class="text-gray-900">
              {{ systemMetrics?.load?.avg1m?.toFixed(2) || '0.00' }} / 
              {{ systemMetrics?.load?.avg5m?.toFixed(2) || '0.00' }} / 
              {{ systemMetrics?.load?.avg15m?.toFixed(2) || '0.00' }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Services Status -->
    <div class="card">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900">Services Status</h3>
        <button @click="refreshServices" class="btn-secondary btn-sm">
          <i class="pi pi-refresh mr-1"></i>
          Refresh
        </button>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div 
          v-for="(status, service) in systemMetrics?.services || {}" 
          :key="service"
          class="flex flex-col items-center p-3 rounded-lg border"
          :class="status ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'"
        >
          <div class="flex items-center space-x-2 mb-2">
            <div 
              class="w-2 h-2 rounded-full"
              :class="status ? 'bg-green-500' : 'bg-red-500'"
            ></div>
            <span class="text-sm font-medium capitalize">{{ service }}</span>
          </div>
          <span 
            class="text-xs px-2 py-1 rounded-full"
            :class="status ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
          >
            {{ status ? 'Running' : 'Stopped' }}
          </span>
        </div>
      </div>
    </div>

    <!-- System Alerts -->
    <div v-if="alerts.length > 0" class="card">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900">System Alerts</h3>
        <span class="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
          {{ alerts.length }} alerts
        </span>
      </div>
      <div class="space-y-3">
        <div 
          v-for="alert in alerts" 
          :key="alert.timestamp.getTime()"
          class="flex items-start space-x-3 p-3 rounded-lg border-l-4"
          :class="{
            'bg-yellow-50 border-yellow-400': alert.type === 'warning',
            'bg-red-50 border-red-400': alert.type === 'critical'
          }"
        >
          <i 
            :class="{
              'pi pi-exclamation-triangle text-yellow-600': alert.type === 'warning',
              'pi pi-times-circle text-red-600': alert.type === 'critical'
            }"
          ></i>
          <div class="flex-1">
            <p class="text-sm font-medium text-gray-900">{{ alert.message }}</p>
            <p class="text-xs text-gray-500">{{ formatTime(alert.timestamp) }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Network -->
    <div class="card">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900">Network Interfaces</h3>
      </div>
      <div class="space-y-3">
        <div 
          v-for="iface in systemMetrics?.network?.interfaces || []" 
          :key="iface.name"
          class="p-3 rounded-lg bg-gray-50"
        >
          <div class="flex items-center justify-between mb-2">
            <span class="font-medium text-gray-900">{{ iface.name }}</span>
          </div>
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-gray-600">Received:</span>
              <span class="ml-2 text-gray-900">{{ formatBytes(iface.bytesReceived) }}</span>
            </div>
            <div>
              <span class="text-gray-600">Sent:</span>
              <span class="ml-2 text-gray-900">{{ formatBytes(iface.bytesSent) }}</span>
            </div>
            <div>
              <span class="text-gray-600">Packets RX:</span>
              <span class="ml-2 text-gray-900">{{ iface.packetsReceived.toLocaleString() }}</span>
            </div>
            <div>
              <span class="text-gray-600">Packets TX:</span>
              <span class="ml-2 text-gray-900">{{ iface.packetsSent.toLocaleString() }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent activity -->
    <div class="card">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900">Recent Activity</h3>
        <button class="text-sm text-primary-600 hover:text-primary-700">
          View all
        </button>
      </div>
      <div class="space-y-4">
        <div v-for="activity in recentActivity" :key="activity.id" class="flex items-center space-x-4">
          <div class="p-2 bg-gray-100 rounded-lg">
            <i :class="activity.icon" class="text-gray-600"></i>
          </div>
          <div class="flex-1">
            <p class="text-sm font-medium text-gray-900">{{ activity.description }}</p>
            <p class="text-xs text-gray-500">{{ formatTime(activity.timestamp) }}</p>
          </div>
          <span
            class="px-2 py-1 text-xs rounded-full"
            :class="{
              'bg-green-100 text-green-800': activity.status === 'success',
              'bg-yellow-100 text-yellow-800': activity.status === 'warning',
              'bg-red-100 text-red-800': activity.status === 'error',
            }"
          >
            {{ activity.status }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useWebSocket } from '../composables/useWebSocket';

const authStore = useAuthStore();

// WebSocket composable
const {
  isConnected,
  isConnecting,
  connectionError,
  connectionStatus,
  systemMetrics,
  alerts,
  connect,
  disconnect,
  subscribeToSystem,
  subscribeToAlerts,
  formatBytes,
  formatUptime
} = useWebSocket();

const stats = ref({
  sites: 0,
  databases: 0,
  emails: 0,
  backups: 0,
});

const recentActivity = ref([
  {
    id: 1,
    description: 'Site "example.com" created successfully',
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    status: 'success',
    icon: 'pi pi-plus',
  },
  {
    id: 2,
    description: 'Database backup completed',
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
    status: 'success',
    icon: 'pi pi-cloud-download',
  },
  {
    id: 3,
    description: 'SSL certificate renewed for example.com',
    timestamp: new Date(Date.now() - 30 * 60 * 1000),
    status: 'success',
    icon: 'pi pi-shield',
  },
  {
    id: 4,
    description: 'High memory usage detected',
    timestamp: new Date(Date.now() - 45 * 60 * 1000),
    status: 'warning',
    icon: 'pi pi-exclamation-triangle',
  },
]);

function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minutes ago`;
  if (hours < 24) return `${hours} hours ago`;
  return `${days} days ago`;
}

async function refreshServices() {
  // This would trigger a refresh of service status
  console.log('Refreshing services...');
}

async function loadDashboardData() {
  try {
    // Load dashboard statistics
    const [sitesResponse, databasesResponse, emailsResponse] = await Promise.all([
      fetch('/api/v1/sites'),
      fetch('/api/v1/databases'),
      fetch('/api/v1/email/accounts')
    ]);

    if (sitesResponse.ok) {
      const sitesData = await sitesResponse.json();
      stats.value.sites = sitesData.data?.length || 0;
    }

    if (databasesResponse.ok) {
      const databasesData = await databasesResponse.json();
      stats.value.databases = databasesData.data?.length || 0;
    }

    if (emailsResponse.ok) {
      const emailsData = await emailsResponse.json();
      stats.value.emails = emailsData.data?.length || 0;
    }
  } catch (error) {
    console.error('Failed to load dashboard data:', error);
  }
}

onMounted(async () => {
  await loadDashboardData();
  
  // Connect to WebSocket and subscribe to system metrics and alerts
  connect();
  subscribeToSystem();
  subscribeToAlerts();
});

onUnmounted(() => {
  disconnect();
});
</script>

<style scoped>
/* Component-specific styles */
</style>
