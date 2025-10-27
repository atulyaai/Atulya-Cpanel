<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">
          Email
        </h1>
        <p class="text-gray-600">
          Manage email accounts and domains
        </p>
      </div>
      <div class="flex items-center space-x-3">
        <button
          class="btn-secondary"
          @click="showCreateDomainModal = true"
        >
          <i class="pi pi-globe mr-2" />
          Add Domain
        </button>
        <button
          class="btn-primary"
          @click="showCreateAccountModal = true"
        >
          <i class="pi pi-plus mr-2" />
          Create Account
        </button>
      </div>
    </div>

    <!-- Statistics Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div class="card">
        <div class="flex items-center">
          <div class="p-3 bg-blue-100 rounded-lg">
            <i class="pi pi-envelope text-blue-600 text-xl" />
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">
              Total Accounts
            </p>
            <p class="text-2xl font-bold text-gray-900">
              {{ stats.totalAccounts }}
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
              {{ stats.activeAccounts }}
            </p>
          </div>
        </div>
      </div>
      
      <div class="card">
        <div class="flex items-center">
          <div class="p-3 bg-purple-100 rounded-lg">
            <i class="pi pi-globe text-purple-600 text-xl" />
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">
              Domains
            </p>
            <p class="text-2xl font-bold text-gray-900">
              {{ stats.domains }}
            </p>
          </div>
        </div>
      </div>
      
      <div class="card">
        <div class="flex items-center">
          <div class="p-3 bg-orange-100 rounded-lg">
            <i class="pi pi-chart-bar text-orange-600 text-xl" />
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">
              Storage Used
            </p>
            <p class="text-2xl font-bold text-gray-900">
              {{ formatBytes(stats.usedQuota) }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Email Accounts Table -->
    <div class="card">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-lg font-semibold text-gray-900">
          Email Accounts
        </h3>
        <div class="flex items-center space-x-4">
          <button
            class="btn-secondary"
            @click="refreshAccounts"
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
          Loading email accounts...
        </p>
      </div>

      <div
        v-else-if="accounts.length === 0"
        class="text-center py-12"
      >
        <i class="pi pi-envelope text-6xl text-gray-300 mb-4" />
        <h3 class="text-lg font-medium text-gray-900 mb-2">
          No email accounts yet
        </h3>
        <p class="text-gray-500 mb-6">
          Create your first email account to get started
        </p>
        <button
          class="btn-primary"
          @click="showCreateAccountModal = true"
        >
          <i class="pi pi-plus mr-2" />
          Create Account
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
                Email Address
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Domain
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quota
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Forward To
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
              v-for="account in accounts"
              :key="account.id"
            >
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <i class="pi pi-envelope text-gray-400 mr-3" />
                  <div>
                    <div class="text-sm font-medium text-gray-900">
                      {{ account.email }}
                    </div>
                    <div class="text-sm text-gray-500">
                      {{ account.id }}
                    </div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">
                  {{ account.email.split('@')[1] }}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">
                  {{ formatBytes(Number(account.quota)) }}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">
                  {{ account.forwardTo || 'None' }}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span :class="account.isActive ? 'status-online' : 'status-offline'">
                  {{ account.isActive ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div class="flex items-center space-x-2">
                  <button
                    class="text-primary-600 hover:text-primary-900"
                    @click="viewAccount(account)"
                  >
                    <i class="pi pi-eye" />
                  </button>
                  <button
                    class="text-gray-600 hover:text-gray-900"
                    @click="editAccount(account)"
                  >
                    <i class="pi pi-pencil" />
                  </button>
                  <button
                    class="text-red-600 hover:text-red-900"
                    @click="deleteAccount(account)"
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

    <!-- Create Email Account Modal -->
    <Dialog
      v-model:visible="showCreateAccountModal"
      modal
      header="Create Email Account"
      :style="{ width: '500px' }"
    >
      <form
        class="space-y-4"
        @submit.prevent="createAccount"
      >
        <div>
          <label class="label">Email Address</label>
          <input
            v-model="accountForm.email"
            type="email"
            class="input"
            placeholder="user@example.com"
            required
          >
        </div>

        <div>
          <label class="label">Password (Optional)</label>
          <input
            v-model="accountForm.password"
            type="password"
            class="input"
            placeholder="Auto-generated if empty"
          >
        </div>

        <div>
          <label class="label">Quota (MB)</label>
          <input
            v-model.number="accountForm.quota"
            type="number"
            class="input"
            placeholder="1000"
            min="100"
            max="10240"
          >
        </div>

        <div>
          <label class="label">Forward To (Optional)</label>
          <input
            v-model="accountForm.forwardTo"
            type="email"
            class="input"
            placeholder="forward@example.com"
          >
        </div>

        <div class="flex items-center">
          <input
            v-model="accountForm.catchAll"
            type="checkbox"
            class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          >
          <label class="ml-2 text-sm text-gray-600">Catch-all account</label>
        </div>

        <div class="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            class="btn-secondary"
            @click="showCreateAccountModal = false"
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
            Create Account
          </button>
        </div>
      </form>
    </Dialog>

    <!-- Create Email Domain Modal -->
    <Dialog
      v-model:visible="showCreateDomainModal"
      modal
      header="Add Email Domain"
      :style="{ width: '400px' }"
    >
      <form
        class="space-y-4"
        @submit.prevent="createDomain"
      >
        <div>
          <label class="label">Domain Name</label>
          <input
            v-model="domainForm.domain"
            type="text"
            class="input"
            placeholder="example.com"
            required
          >
        </div>

        <div class="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            class="btn-secondary"
            @click="showCreateDomainModal = false"
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
            Add Domain
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
import type { EmailAccount } from '../types';

const toast = useToast();

const loading = ref(false);
const accounts = ref<EmailAccount[]>([]);
const domains = ref([]);
const stats = ref({
  totalAccounts: 0,
  activeAccounts: 0,
  totalQuota: 0,
  usedQuota: 0,
  domains: 0,
});

const showCreateAccountModal = ref(false);
const showCreateDomainModal = ref(false);

const accountForm = reactive({
  email: '',
  password: '',
  quota: 1000,
  forwardTo: '',
  catchAll: false,
});

const domainForm = reactive({
  domain: '',
});

async function loadAccounts() {
  loading.value = true;
  try {
    const response = await apiClient.get('/email/accounts');
    if (response.data.success) {
      accounts.value = response.data.data;
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to load email accounts',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
}

async function loadStats() {
  try {
    const response = await apiClient.get('/email/statistics');
    if (response.data.success) {
      stats.value = response.data.data;
    }
  } catch (error) {
    // Error loading email stats
  }
}

async function createAccount() {
  loading.value = true;
  try {
    const response = await apiClient.post('/email/accounts', accountForm);
    if (response.data.success) {
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Email account created successfully',
        life: 3000,
      });
      
      showCreateAccountModal.value = false;
      Object.assign(accountForm, {
        email: '',
        password: '',
        quota: 1000,
        forwardTo: '',
        catchAll: false,
      });
      
      await loadAccounts();
      await loadStats();
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: error.response?.data?.error || 'Failed to create email account',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
}

async function createDomain() {
  loading.value = true;
  try {
    const response = await apiClient.post('/email/domains', domainForm);
    if (response.data.success) {
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Email domain created successfully',
        life: 3000,
      });
      
      showCreateDomainModal.value = false;
      domainForm.domain = '';
      
      await loadStats();
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: error.response?.data?.error || 'Failed to create email domain',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
}

async function deleteAccount(account: EmailAccount) {
  if (!confirm(`Are you sure you want to delete email account "${account.email}"? This action cannot be undone.`)) {
    return;
  }

  try {
    const response = await apiClient.delete(`/email/accounts/${account.id}`);
    if (response.data.success) {
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Email account deleted successfully',
        life: 3000,
      });
      
      await loadAccounts();
      await loadStats();
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: error.response?.data?.error || 'Failed to delete email account',
      life: 3000,
    });
  }
}

function viewAccount(account: EmailAccount) {
  // Account viewer functionality - to be implemented in future release
  toast.add({
    severity: 'info',
    summary: 'Info',
    detail: 'Account viewer will be implemented soon',
    life: 3000,
  });
}

function editAccount(account: EmailAccount) {
  // Account editing functionality - to be implemented in future release
  toast.add({
    severity: 'info',
    summary: 'Info',
    detail: 'Account editing will be implemented soon',
    life: 3000,
  });
}

async function refreshAccounts() {
  await loadAccounts();
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
  loadAccounts();
  loadStats();
});
</script>
