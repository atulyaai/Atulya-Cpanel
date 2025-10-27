<template>
  <div class="space-y-6">
    <!-- Notification Container -->
    <div class="fixed top-4 right-4 z-50 space-y-2">
      <div 
        v-for="notification in notifications" 
        :key="notification.id"
        class="max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden"
        :class="{
          'border-l-4 border-green-400': notification.type === 'success',
          'border-l-4 border-red-400': notification.type === 'error',
          'border-l-4 border-yellow-400': notification.type === 'warning',
          'border-l-4 border-blue-400': notification.type === 'info'
        }"
      >
        <div class="p-4">
          <div class="flex items-start">
            <div class="flex-shrink-0">
              <i 
                :class="{
                  'pi pi-check-circle text-green-400': notification.type === 'success',
                  'pi pi-times-circle text-red-400': notification.type === 'error',
                  'pi pi-exclamation-triangle text-yellow-400': notification.type === 'warning',
                  'pi pi-info-circle text-blue-400': notification.type === 'info'
                }"
                class="h-6 w-6"
              />
            </div>
            <div class="ml-3 w-0 flex-1 pt-0.5">
              <p class="text-sm font-medium text-gray-900">
                {{ notification.title }}
              </p>
              <p class="mt-1 text-sm text-gray-500">
                {{ notification.message }}
              </p>
            </div>
            <div class="ml-4 flex-shrink-0 flex">
              <button 
                class="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                @click="removeNotification(notification.id)"
              >
                <i class="pi pi-times h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Page header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">
          Dashboard
        </h1>
        <p class="text-gray-600">
          Welcome back, {{ authStore.user?.username }}!
        </p>
      </div>
      <div class="flex items-center space-x-4">
        <button class="btn-primary">
          <i class="pi pi-plus mr-2" />
          Create Site
        </button>
      </div>
    </div>

    <!-- Interactive Quick Actions -->
    <div class="card">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900">
          Quick Actions
        </h3>
        <span class="text-sm text-gray-500">One-click operations</span>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button 
          class="flex flex-col items-center p-4 rounded-lg border-2 border-dashed border-gray-300 hover:border-primary-500 hover:bg-primary-50 transition-all duration-200 group"
          @click="createSite"
        >
          <i class="pi pi-plus text-2xl text-gray-400 group-hover:text-primary-600 mb-2" />
          <span class="text-sm font-medium text-gray-600 group-hover:text-primary-700">Create Site</span>
        </button>
        <button 
          class="flex flex-col items-center p-4 rounded-lg border-2 border-dashed border-gray-300 hover:border-green-500 hover:bg-green-50 transition-all duration-200 group"
          @click="createDatabase"
        >
          <i class="pi pi-database text-2xl text-gray-400 group-hover:text-green-600 mb-2" />
          <span class="text-sm font-medium text-gray-600 group-hover:text-green-700">Create Database</span>
        </button>
        <button 
          class="flex flex-col items-center p-4 rounded-lg border-2 border-dashed border-gray-300 hover:border-purple-500 hover:bg-purple-50 transition-all duration-200 group"
          @click="createEmail"
        >
          <i class="pi pi-envelope text-2xl text-gray-400 group-hover:text-purple-600 mb-2" />
          <span class="text-sm font-medium text-gray-600 group-hover:text-purple-700">Create Email</span>
        </button>
        <button 
          class="flex flex-col items-center p-4 rounded-lg border-2 border-dashed border-gray-300 hover:border-orange-500 hover:bg-orange-50 transition-all duration-200 group"
          @click="generateSSL"
        >
          <i class="pi pi-shield text-2xl text-gray-400 group-hover:text-orange-600 mb-2" />
          <span class="text-sm font-medium text-gray-600 group-hover:text-orange-700">Generate SSL</span>
        </button>
      </div>
    </div>
    <div class="card">
      <div class="flex items-center">
        <div class="p-3 bg-blue-100 rounded-lg">
          <i class="pi pi-globe text-blue-600 text-xl" />
        </div>
        <div class="ml-4">
          <p class="text-sm font-medium text-gray-600">
            Active Sites
          </p>
          <p class="text-2xl font-bold text-gray-900">
            {{ stats.sites }}
          </p>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="flex items-center">
        <div class="p-3 bg-green-100 rounded-lg">
          <i class="pi pi-database text-green-600 text-xl" />
        </div>
        <div class="ml-4">
          <p class="text-sm font-medium text-gray-600">
            Databases
          </p>
          <p class="text-2xl font-bold text-gray-900">
            {{ stats.databases }}
          </p>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="flex items-center">
        <div class="p-3 bg-purple-100 rounded-lg">
          <i class="pi pi-envelope text-purple-600 text-xl" />
        </div>
        <div class="ml-4">
          <p class="text-sm font-medium text-gray-600">
            Email Accounts
          </p>
          <p class="text-2xl font-bold text-gray-900">
            {{ stats.emails }}
          </p>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="flex items-center">
        <div class="p-3 bg-orange-100 rounded-lg">
          <i class="pi pi-cloud-download text-orange-600 text-xl" />
        </div>
        <div class="ml-4">
          <p class="text-sm font-medium text-gray-600">
            Backups
          </p>
          <p class="text-2xl font-bold text-gray-900">
            {{ stats.backups }}
          </p>
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
          />
          <span class="text-sm font-medium text-gray-700">
            Real-time Monitoring: {{ connectionStatus }}
          </span>
        </div>
        <div
          v-if="connectionError"
          class="text-sm text-red-600"
        >
          {{ connectionError }}
        </div>
      </div>
      <div class="flex items-center space-x-2">
        <button 
          :disabled="isConnecting || isConnected" 
          class="btn-secondary btn-sm"
          @click="connect"
        >
          <i class="pi pi-refresh mr-1" />
          Connect
        </button>
        <button 
          :disabled="!isConnected" 
          class="btn-secondary btn-sm"
          @click="disconnect"
        >
          <i class="pi pi-times mr-1" />
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
        <h3 class="text-lg font-semibold text-gray-900">
          CPU Usage
        </h3>
        <span class="text-sm text-gray-500">
          {{ systemMetrics?.cpu?.usage || 0 }}%
        </span>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-2">
        <div
          class="bg-blue-600 h-2 rounded-full transition-all duration-300"
          :style="{ width: `${systemMetrics?.cpu?.usage || 0}%` }"
        />
      </div>
      <p class="text-sm text-gray-600 mt-2">
        {{ systemMetrics?.cpu?.cores || 0 }} cores • 
        {{ systemMetrics?.cpu?.model || 'Unknown' }} • 
        Load: {{ systemMetrics?.load?.avg1m?.toFixed(2) || '0.00' }}
      </p>
      <div
        v-if="systemMetrics?.cpu?.temperature"
        class="text-sm text-gray-500 mt-1"
      >
        Temperature: {{ systemMetrics.cpu.temperature }}°C
      </div>
    </div>

    <!-- Memory Usage -->
    <div class="card">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900">
          Memory Usage
        </h3>
        <span class="text-sm text-gray-500">
          {{ systemMetrics?.memory?.percentage || 0 }}%
        </span>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-2">
        <div
          class="bg-green-600 h-2 rounded-full transition-all duration-300"
          :style="{ width: `${systemMetrics?.memory?.percentage || 0}%` }"
        />
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
        <h3 class="text-lg font-semibold text-gray-900">
          Disk Usage
        </h3>
        <span class="text-sm text-gray-500">
          {{ systemMetrics?.disk?.percentage || 0 }}%
        </span>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-2">
        <div
          class="bg-purple-600 h-2 rounded-full transition-all duration-300"
          :style="{ width: `${systemMetrics?.disk?.percentage || 0}%` }"
        />
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
        <h3 class="text-lg font-semibold text-gray-900">
          System Information
        </h3>
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
      <h3 class="text-lg font-semibold text-gray-900">
        Services Status
      </h3>
      <button
        class="btn-secondary btn-sm"
        @click="refreshServices"
      >
        <i class="pi pi-refresh mr-1" />
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
          />
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
  <div
    v-if="alerts.length > 0"
    class="card"
  >
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-900">
        System Alerts
      </h3>
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
        />
        <div class="flex-1">
          <p class="text-sm font-medium text-gray-900">
            {{ alert.message }}
          </p>
          <p class="text-xs text-gray-500">
            {{ formatTime(alert.timestamp) }}
          </p>
        </div>
      </div>
    </div>
  </div>

  <!-- Network -->
  <div class="card">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-900">
        Network Interfaces
      </h3>
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
      <h3 class="text-lg font-semibold text-gray-900">
        Recent Activity
      </h3>
      <button class="text-sm text-primary-600 hover:text-primary-700">
        View all
      </button>
    </div>
    <div class="space-y-4">
      <div
        v-for="activity in recentActivity"
        :key="activity.id"
        class="flex items-center space-x-4"
      >
        <div class="p-2 bg-gray-100 rounded-lg">
          <i
            :class="activity.icon"
            class="text-gray-600"
          />
        </div>
        <div class="flex-1">
          <p class="text-sm font-medium text-gray-900">
            {{ activity.description }}
          </p>
          <p class="text-xs text-gray-500">
            {{ formatTime(activity.timestamp) }}
          </p>
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
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useWebSocket } from '../composables/useWebSocket';
import { useNotifications } from '../composables/useNotifications';

const authStore = useAuthStore();

// Notification system
const { notifications, success, error, warning, info, removeNotification } = useNotifications();

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
  // Service refresh functionality will be implemented
}

// Interactive quick action functions
async function createSite() {
  try {
    // Show loading state
    // Real API call to create site
    const response = await fetch('/api/v1/sites', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({
        domain: `site-${Date.now()}.example.com`,
        documentRoot: `/var/www/site-${Date.now()}`,
        phpVersion: '8.1',
        sslEnabled: false
      })
    });
    
    if (response.ok) {
      success('Site Created', 'New website has been created successfully!');
      await loadDashboardData();
    } else {
      throw new Error('Failed to create site');
    }
  } catch (error) {
    error('Site Creation Failed', 'Failed to create new website. Please try again.');
  }
}

async function createDatabase() {
  try {
    // Real API call to create database
    const response = await fetch('/api/v1/databases', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({
        name: `db_${Date.now()}`,
        user: `user_${Date.now()}`,
        password: 'secure_password_123'
      })
    });
    
    if (response.ok) {
      success('Database Created', 'New database has been created successfully!');
      await loadDashboardData();
    } else {
      throw new Error('Failed to create database');
    }
  } catch (error) {
    error('Database Creation Failed', 'Failed to create new database. Please try again.');
  }
}

async function createEmail() {
  try {
    // Real API call to create email
    const response = await fetch('/api/v1/email/accounts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({
        email: `user${Date.now()}@example.com`,
        password: 'secure_password_123',
        domain: 'example.com'
      })
    });
    
    if (response.ok) {
      success('Email Account Created', 'New email account has been created successfully!');
      await loadDashboardData();
    } else {
      throw new Error('Failed to create email account');
    }
  } catch (error) {
    error('Email Creation Failed', 'Failed to create new email account. Please try again.');
  }
}

async function generateSSL() {
  try {
    // Real API call to generate SSL
    const response = await fetch('/api/v1/ssl/certificates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({
        domain: `site-${Date.now()}.example.com`,
        challengeType: 'http-01',
        autoRenew: true
      })
    });
    
    if (response.ok) {
      success('SSL Certificate Generated', 'SSL certificate has been generated successfully!');
      await loadDashboardData();
    } else {
      throw new Error('Failed to generate SSL certificate');
    }
  } catch (error) {
    error('SSL Generation Failed', 'Failed to generate SSL certificate. Please try again.');
  }
}

async function loadDashboardData() {
  try {
    // Load dashboard statistics with proper authentication
    const headers = {
      'Authorization': `Bearer ${authStore.token}`
    };
    
    const [sitesResponse, databasesResponse, emailsResponse] = await Promise.all([
      fetch('/api/v1/sites', { headers }),
      fetch('/api/v1/databases', { headers }),
      fetch('/api/v1/email/accounts', { headers })
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
    // Error loading dashboard data
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
