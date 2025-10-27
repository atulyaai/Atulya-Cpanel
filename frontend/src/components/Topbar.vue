<template>
  <header class="bg-white border-b border-gray-200 px-6 py-4">
    <div class="flex items-center justify-between">
      <!-- Left side -->
      <div class="flex items-center space-x-4">
        <button
          class="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 lg:hidden"
          @click="toggleSidebar"
        >
          <i class="pi pi-bars text-lg" />
        </button>
        
        <div class="hidden lg:block">
          <h2 class="text-xl font-semibold text-gray-900">
            {{ pageTitle }}
          </h2>
          <p class="text-sm text-gray-500">
            {{ pageSubtitle }}
          </p>
        </div>
      </div>

      <!-- Right side -->
      <div class="flex items-center space-x-4">
        <!-- Search -->
        <div class="relative hidden md:block">
          <input
            type="text"
            placeholder="Search..."
            class="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
          <i class="pi pi-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
        </div>

        <!-- Notifications -->
        <button
          class="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          @click="showNotifications = !showNotifications"
        >
          <i class="pi pi-bell text-lg" />
          <span
            v-if="notificationCount > 0"
            class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center"
          >
            {{ notificationCount }}
          </span>
        </button>

        <!-- User menu -->
        <div class="relative">
          <button
            class="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100"
            @click="showUserMenu = !showUserMenu"
          >
            <div class="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
              <i class="pi pi-user text-white text-sm" />
            </div>
            <div class="hidden md:block text-left">
              <p class="text-sm font-medium text-gray-900">
                {{ authStore.user?.username }}
              </p>
              <p class="text-xs text-gray-500">
                {{ authStore.user?.role }}
              </p>
            </div>
            <i class="pi pi-chevron-down text-gray-500" />
          </button>

          <!-- User dropdown -->
          <div
            v-if="showUserMenu"
            class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
          >
            <router-link
              to="/profile"
              class="flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <i class="pi pi-user text-gray-500" />
              <span>Profile</span>
            </router-link>
            
            <button
              class="flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
              @click="handleLogout"
            >
              <i class="pi pi-sign-out text-gray-500" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Notifications dropdown -->
    <div
      v-if="showNotifications"
      class="absolute right-4 top-16 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50"
    >
      <div class="p-4 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-900">
          Notifications
        </h3>
      </div>
      <div class="max-h-64 overflow-y-auto">
        <div class="p-4 text-center text-gray-500">
          No notifications
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useToast } from 'primevue/usetoast';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const toast = useToast();

const showUserMenu = ref(false);
const showNotifications = ref(false);
const notificationCount = ref(0);

const pageTitle = computed(() => {
  const routeName = route.name as string;
  return routeName || 'Dashboard';
});

const pageSubtitle = computed(() => {
  const routeName = route.name as string;
  const subtitles: Record<string, string> = {
    Dashboard: 'Overview and system status',
    Sites: 'Manage your websites',
    Databases: 'Database management',
    Email: 'Email account management',
    Domains: 'Domain configuration',
    Files: 'File manager',
    SSL: 'SSL certificate management',
    Backups: 'Backup and restore',
    Cron: 'Scheduled tasks',
    Users: 'User management',
    Settings: 'Panel configuration',
    Profile: 'User profile settings',
  };
  return subtitles[routeName] || '';
});

function toggleSidebar() {
  // Toggle sidebar on mobile
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    sidebar.classList.toggle('open');
  }
}

async function handleLogout() {
  showUserMenu.value = false;
  
  try {
    await authStore.logout();
    toast.add({
      severity: 'success',
      summary: 'Success',
      detail: 'Logged out successfully',
      life: 3000,
    });
    router.push('/');
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to logout',
      life: 3000,
    });
  }
}

// Close dropdowns when clicking outside
function handleClickOutside(event: Event) {
  const target = event.target as HTMLElement;
  if (!target.closest('.relative')) {
    showUserMenu.value = false;
    showNotifications.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
/* Component-specific styles */
</style>
