<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Databases</h1>
        <p class="text-gray-600">Manage MySQL/MariaDB databases</p>
      </div>
      <button @click="showCreateModal = true" class="btn-primary">
        <i class="pi pi-plus mr-2"></i>
        Create Database
      </button>
    </div>

    <!-- Statistics Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="card">
        <div class="flex items-center">
          <div class="p-3 bg-blue-100 rounded-lg">
            <i class="pi pi-database text-blue-600 text-xl"></i>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Total Databases</p>
            <p class="text-2xl font-bold text-gray-900">{{ stats.totalDatabases }}</p>
          </div>
        </div>
      </div>
      
      <div class="card">
        <div class="flex items-center">
          <div class="p-3 bg-green-100 rounded-lg">
            <i class="pi pi-check-circle text-green-600 text-xl"></i>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Active</p>
            <p class="text-2xl font-bold text-gray-900">{{ stats.activeDatabases }}</p>
          </div>
        </div>
      </div>
      
      <div class="card">
        <div class="flex items-center">
          <div class="p-3 bg-purple-100 rounded-lg">
            <i class="pi pi-chart-bar text-purple-600 text-xl"></i>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Total Size</p>
            <p class="text-2xl font-bold text-gray-900">{{ formatBytes(stats.totalSize) }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Databases Table -->
    <div class="card">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-lg font-semibold text-gray-900">Your Databases</h3>
        <div class="flex items-center space-x-4">
          <button @click="refreshDatabases" class="btn-secondary">
            <i class="pi pi-refresh mr-2"></i>
            Refresh
          </button>
        </div>
      </div>

      <div v-if="loading" class="text-center py-8">
        <i class="pi pi-spin pi-spinner text-2xl text-gray-400"></i>
        <p class="text-gray-500 mt-2">Loading databases...</p>
      </div>

      <div v-else-if="databases.length === 0" class="text-center py-12">
        <i class="pi pi-database text-6xl text-gray-300 mb-4"></i>
        <h3 class="text-lg font-medium text-gray-900 mb-2">No databases yet</h3>
        <p class="text-gray-500 mb-6">Create your first database to get started</p>
        <button @click="showCreateModal = true" class="btn-primary">
          <i class="pi pi-plus mr-2"></i>
          Create Database
        </button>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Database
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Username
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Size
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Site
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="database in databases" :key="database.id">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <i class="pi pi-database text-gray-400 mr-3"></i>
                  <div>
                    <div class="text-sm font-medium text-gray-900">{{ database.name }}</div>
                    <div class="text-sm text-gray-500">{{ database.id }}</div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">{{ database.username }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">{{ formatBytes(Number(database.size)) }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">
                  {{ database.site?.domain || 'No site' }}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span :class="database.isActive ? 'status-online' : 'status-offline'">
                  {{ database.isActive ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div class="flex items-center space-x-2">
                  <button @click="viewDatabase(database)" class="text-primary-600 hover:text-primary-900">
                    <i class="pi pi-eye"></i>
                  </button>
                  <button @click="editDatabase(database)" class="text-gray-600 hover:text-gray-900">
                    <i class="pi pi-pencil"></i>
                  </button>
                  <button @click="deleteDatabase(database)" class="text-red-600 hover:text-red-900">
                    <i class="pi pi-trash"></i>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create Database Modal -->
    <Dialog v-model:visible="showCreateModal" modal header="Create Database" :style="{ width: '500px' }">
      <form @submit.prevent="createDatabase" class="space-y-4">
        <div>
          <label class="label">Database Name</label>
          <input
            v-model="createForm.name"
            type="text"
            class="input"
            placeholder="Enter database name"
            required
          />
          <p class="text-xs text-gray-500 mt-1">Only alphanumeric characters and underscores allowed</p>
        </div>

        <div>
          <label class="label">Username (Optional)</label>
          <input
            v-model="createForm.username"
            type="text"
            class="input"
            placeholder="Auto-generated if empty"
          />
        </div>

        <div>
          <label class="label">Password (Optional)</label>
          <input
            v-model="createForm.password"
            type="password"
            class="input"
            placeholder="Auto-generated if empty"
          />
        </div>

        <div class="flex justify-end space-x-3 pt-4">
          <button type="button" @click="showCreateModal = false" class="btn-secondary">
            Cancel
          </button>
          <button type="submit" :disabled="loading" class="btn-primary">
            <i v-if="loading" class="pi pi-spin pi-spinner mr-2"></i>
            Create Database
          </button>
        </div>
      </form>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import { useToast } from 'primevue/usetoast';
import { apiClient } from '../api/client';
import type { Database } from '../types';

const toast = useToast();

const loading = ref(false);
const databases = ref<Database[]>([]);
const stats = ref({
  totalDatabases: 0,
  activeDatabases: 0,
  totalSize: 0,
});

const showCreateModal = ref(false);
const createForm = reactive({
  name: '',
  username: '',
  password: '',
});

async function loadDatabases() {
  loading.value = true;
  try {
    const response = await apiClient.get('/databases');
    if (response.data.success) {
      databases.value = response.data.data;
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to load databases',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
}

async function loadStats() {
  try {
    const response = await apiClient.get('/databases/stats/overview');
    if (response.data.success) {
      stats.value = response.data.data;
    }
  } catch (error) {
    console.error('Failed to load stats:', error);
  }
}

async function createDatabase() {
  loading.value = true;
  try {
    const response = await apiClient.post('/databases', createForm);
    if (response.data.success) {
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Database created successfully',
        life: 3000,
      });
      
      showCreateModal.value = false;
      Object.assign(createForm, {
        name: '',
        username: '',
        password: '',
      });
      
      await loadDatabases();
      await loadStats();
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: error.response?.data?.error || 'Failed to create database',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
}

async function deleteDatabase(database: Database) {
  if (!confirm(`Are you sure you want to delete database "${database.name}"? This action cannot be undone.`)) {
    return;
  }

  try {
    const response = await apiClient.delete(`/databases/${database.id}`);
    if (response.data.success) {
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Database deleted successfully',
        life: 3000,
      });
      
      await loadDatabases();
      await loadStats();
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: error.response?.data?.error || 'Failed to delete database',
      life: 3000,
    });
  }
}

function viewDatabase(database: Database) {
  // TODO: Implement database viewer
  toast.add({
    severity: 'info',
    summary: 'Info',
    detail: 'Database viewer will be implemented soon',
    life: 3000,
  });
}

function editDatabase(database: Database) {
  // TODO: Implement database editing
  toast.add({
    severity: 'info',
    summary: 'Info',
    detail: 'Database editing will be implemented soon',
    life: 3000,
  });
}

async function refreshDatabases() {
  await loadDatabases();
  await loadStats();
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

onMounted(() => {
  loadDatabases();
  loadStats();
});
</script>
