<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">
          Databases
        </h1>
        <p class="text-gray-600">
          Manage MySQL/MariaDB databases
        </p>
      </div>
      <button
        class="btn-primary"
        @click="showCreateModal = true"
      >
        <i class="pi pi-plus mr-2" />
        Create Database
      </button>
    </div>

    <!-- Statistics Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="card">
        <div class="flex items-center">
          <div class="p-3 bg-blue-100 rounded-lg">
            <i class="pi pi-database text-blue-600 text-xl" />
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">
              Total Databases
            </p>
            <p class="text-2xl font-bold text-gray-900">
              {{ stats.totalDatabases }}
            </p>
          </div>
        </div>
      </div>
      
      <div class="card">
        <div class="flex items-center">
          <div class="p-3 bg-green-100 rounded-lg">
            <i class="pi pi-check-circle text-green-600 text-xl" />
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">
              Active
            </p>
            <p class="text-2xl font-bold text-gray-900">
              {{ stats.activeDatabases }}
            </p>
          </div>
        </div>
      </div>
      
      <div class="card">
        <div class="flex items-center">
          <div class="p-3 bg-purple-100 rounded-lg">
            <i class="pi pi-chart-bar text-purple-600 text-xl" />
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">
              Total Size
            </p>
            <p class="text-2xl font-bold text-gray-900">
              {{ formatBytes(stats.totalSize) }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Databases Table -->
    <div class="card">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-lg font-semibold text-gray-900">
          Your Databases
        </h3>
        <div class="flex items-center space-x-4">
          <button
            class="btn-secondary"
            @click="refreshDatabases"
          >
            <i class="pi pi-refresh mr-2" />
            Refresh
          </button>
        </div>
      </div>

      <div
        v-if="loading"
        class="text-center py-8"
      >
        <i class="pi pi-spin pi-spinner text-2xl text-gray-400" />
        <p class="text-gray-500 mt-2">
          Loading databases...
        </p>
      </div>

      <div
        v-else-if="databases.length === 0"
        class="text-center py-12"
      >
        <i class="pi pi-database text-6xl text-gray-300 mb-4" />
        <h3 class="text-lg font-medium text-gray-900 mb-2">
          No databases yet
        </h3>
        <p class="text-gray-500 mb-6">
          Create your first database to get started
        </p>
        <button
          class="btn-primary"
          @click="showCreateModal = true"
        >
          <i class="pi pi-plus mr-2" />
          Create Database
        </button>
      </div>

      <div
        v-else
        class="overflow-x-auto"
      >
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
            <tr
              v-for="database in databases"
              :key="database.id"
            >
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <i class="pi pi-database text-gray-400 mr-3" />
                  <div>
                    <div class="text-sm font-medium text-gray-900">
                      {{ database.name }}
                    </div>
                    <div class="text-sm text-gray-500">
                      {{ database.id }}
                    </div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">
                  {{ database.username }}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">
                  {{ formatBytes(Number(database.size)) }}
                </div>
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
                  <button
                    class="text-primary-600 hover:text-primary-900"
                    @click="viewDatabase(database)"
                  >
                    <i class="pi pi-eye" />
                  </button>
                  <button
                    class="text-gray-600 hover:text-gray-900"
                    @click="editDatabase(database)"
                  >
                    <i class="pi pi-pencil" />
                  </button>
                  <button
                    class="text-red-600 hover:text-red-900"
                    @click="deleteDatabase(database)"
                  >
                    <i class="pi pi-trash" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create Database Modal -->
    <Dialog
      v-model:visible="showCreateModal"
      modal
      header="Create Database"
      :style="{ width: '500px' }"
    >
      <form
        class="space-y-4"
        @submit.prevent="createDatabase"
      >
        <div>
          <label class="label">Database Name</label>
          <input
            v-model="createForm.name"
            type="text"
            class="input"
            placeholder="Enter database name"
            required
          >
          <p class="text-xs text-gray-500 mt-1">
            Only alphanumeric characters and underscores allowed
          </p>
        </div>

        <div>
          <label class="label">Username (Optional)</label>
          <input
            v-model="createForm.username"
            type="text"
            class="input"
            placeholder="Auto-generated if empty"
          >
        </div>

        <div>
          <label class="label">Password (Optional)</label>
          <input
            v-model="createForm.password"
            type="password"
            class="input"
            placeholder="Auto-generated if empty"
          >
        </div>

        <div class="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            class="btn-secondary"
            @click="showCreateModal = false"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="loading"
            class="btn-primary"
          >
            <i
              v-if="loading"
              class="pi pi-spin pi-spinner mr-2"
            />
            Create Database
          </button>
        </div>
      </form>
    </Dialog>

    <!-- View Database Modal -->
    <Dialog
      v-model:visible="showViewModal"
      modal
      header="Database Viewer"
      :style="{ width: '800px' }"
    >
      <div
        v-if="selectedDatabase"
        class="space-y-6"
      >
        <!-- Database Info -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <h4 class="font-semibold text-gray-900 mb-2">
              Database Information
            </h4>
            <div class="space-y-2 text-sm">
              <div><span class="font-medium">Name:</span> {{ selectedDatabase.name }}</div>
              <div><span class="font-medium">Username:</span> {{ selectedDatabase.username || 'N/A' }}</div>
              <div><span class="font-medium">Size:</span> {{ formatBytes(Number(selectedDatabase.size)) }}</div>
              <div>
                <span class="font-medium">Status:</span> 
                <span :class="selectedDatabase.isActive ? 'text-green-600' : 'text-red-600'">
                  {{ selectedDatabase.isActive ? 'Active' : 'Inactive' }}
                </span>
              </div>
            </div>
          </div>
          <div v-if="databaseInfo">
            <h4 class="font-semibold text-gray-900 mb-2">
              Additional Info
            </h4>
            <div class="space-y-2 text-sm">
              <div><span class="font-medium">Tables:</span> {{ databaseInfo.tableCount || 0 }}</div>
              <div><span class="font-medium">Created:</span> {{ formatDate(databaseInfo.createdAt) }}</div>
            </div>
          </div>
        </div>

        <!-- Tables List -->
        <div v-if="databaseTables.length > 0">
          <h4 class="font-semibold text-gray-900 mb-2">
            Tables
          </h4>
          <div class="grid grid-cols-3 gap-2">
            <div
              v-for="table in databaseTables"
              :key="table"
              class="p-2 bg-gray-100 rounded text-sm"
            >
              {{ Object.values(table)[0] }}
            </div>
          </div>
        </div>

        <!-- Query Interface -->
        <div>
          <h4 class="font-semibold text-gray-900 mb-2">
            SQL Query
          </h4>
          <div class="space-y-3">
            <textarea
              v-model="queryText"
              class="w-full p-3 border border-gray-300 rounded-md font-mono text-sm"
              rows="4"
              placeholder="Enter SQL query here..."
            />
            <button
              class="btn-primary"
              @click="executeQuery"
            >
              <i class="pi pi-play mr-2" />
              Execute Query
            </button>
          </div>
        </div>

        <!-- Query Results -->
        <div
          v-if="queryResult"
          class="mt-4"
        >
          <h4 class="font-semibold text-gray-900 mb-2">
            Query Results
          </h4>
          <div class="bg-gray-50 p-4 rounded-md overflow-x-auto">
            <pre class="text-sm">{{ JSON.stringify(queryResult, null, 2) }}</pre>
          </div>
        </div>
      </div>
    </Dialog>

    <!-- Edit Database Modal -->
    <Dialog
      v-model:visible="showEditModal"
      modal
      header="Edit Database"
      :style="{ width: '500px' }"
    >
      <form
        class="space-y-4"
        @submit.prevent="updateDatabase"
      >
        <div>
          <label class="label">Database Name</label>
          <input
            v-model="editForm.name"
            type="text"
            class="input"
            placeholder="Enter database name"
            required
          >
        </div>

        <div>
          <label class="label">Username</label>
          <input
            v-model="editForm.username"
            type="text"
            class="input"
            placeholder="Enter username"
          >
        </div>

        <div>
          <label class="label">New Password (Leave empty to keep current)</label>
          <input
            v-model="editForm.password"
            type="password"
            class="input"
            placeholder="Enter new password"
          >
        </div>

        <div class="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            class="btn-secondary"
            @click="showEditModal = false"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="loading"
            class="btn-primary"
          >
            <i
              v-if="loading"
              class="pi pi-spin pi-spinner mr-2"
            />
            Update Database
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
const showViewModal = ref(false);
const showEditModal = ref(false);
const selectedDatabase = ref<Database | null>(null);
const createForm = reactive({
  name: '',
  username: '',
  password: '',
});
const editForm = reactive({
  name: '',
  username: '',
  password: '',
});
const databaseInfo = ref<any>(null);
const databaseTables = ref<any[]>([]);
const queryResult = ref<any>(null);
const queryText = ref('');

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
    // Error loading database stats
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

async function viewDatabase(database: Database) {
  selectedDatabase.value = database;
  showViewModal.value = true;
  
  try {
    // Load database info
    const infoResponse = await apiClient.get(`/databases/${database.id}/info`);
    if (infoResponse.data.success) {
      databaseInfo.value = infoResponse.data.data;
    }
    
    // Load database tables (using a simple query)
    const tablesResponse = await apiClient.post(`/databases/${database.id}/query`, {
      query: 'SHOW TABLES'
    });
    if (tablesResponse.data.success) {
      databaseTables.value = tablesResponse.data.data;
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to load database information',
      life: 3000,
    });
  }
}

function editDatabase(database: Database) {
  selectedDatabase.value = database;
  Object.assign(editForm, {
    name: database.name,
    username: database.username || '',
    password: '',
  });
  showEditModal.value = true;
}

async function updateDatabase() {
  if (!selectedDatabase.value) return;
  
  loading.value = true;
  try {
    const updateData: any = {
      name: editForm.name,
      username: editForm.username,
    };
    
    // Only include password if it's provided
    if (editForm.password) {
      updateData.password = editForm.password;
    }
    
    const response = await apiClient.put(`/databases/${selectedDatabase.value.id}`, updateData);
    if (response.data.success) {
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Database updated successfully',
        life: 3000,
      });
      
      showEditModal.value = false;
      Object.assign(editForm, {
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
      detail: error.response?.data?.error || 'Failed to update database',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
}

async function executeQuery() {
  if (!selectedDatabase.value || !queryText.value.trim()) return;
  
  try {
    const response = await apiClient.post(`/databases/${selectedDatabase.value.id}/query`, {
      query: queryText.value
    });
    if (response.data.success) {
      queryResult.value = response.data.data;
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Query executed successfully',
        life: 3000,
      });
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: error.response?.data?.error || 'Failed to execute query',
      life: 3000,
    });
  }
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

function formatDate(dateString: string): string {
  if (!dateString) return 'Never';
  return new Date(dateString).toLocaleDateString();
}

onMounted(() => {
  loadDatabases();
  loadStats();
});
</script>
