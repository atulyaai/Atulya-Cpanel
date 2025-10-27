<template>
  <div class="sidebar">
    <!-- Application header with logo and version -->
    <div class="p-6 border-b border-gray-700">
      <div class="flex items-center space-x-3">
        <div class="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
          <i class="pi pi-cube text-white text-sm" />
        </div>
        <div>
          <h1 class="text-lg font-semibold text-white">
            Atulya Panel
          </h1>
          <p class="text-xs text-gray-400">
            v2.1.0
          </p>
        </div>
      </div>
    </div>

    <!-- Navigation menu -->
    <nav class="p-4">
      <ul class="space-y-2">
        <li
          v-for="item in menuItems"
          :key="item.route"
        >
          <router-link
            :to="item.route"
            class="flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
            :class="{ 'bg-primary-600 text-white': $route.name === item.route }"
          >
            <i
              :class="item.icon"
              class="text-sm"
            />
            <span>{{ item.label }}</span>
            <!-- Badge for notifications or status indicators -->
            <span
              v-if="item.badge"
              class="ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full"
            >
              {{ item.badge }}
            </span>
          </router-link>
        </li>
      </ul>
    </nav>

    <!-- User profile section at bottom -->
    <div class="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-700">
      <div class="flex items-center space-x-3">
        <div class="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
          <i class="pi pi-user text-white text-sm" />
        </div>
        <div class="flex-1">
          <p class="text-sm text-white">
            {{ authStore.user?.username }}
          </p>
          <p class="text-xs text-gray-400">
            {{ authStore.user?.role }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '../stores/auth';
import type { MenuItem } from '../types';

// Access authentication store for user data and permissions
const authStore = useAuthStore();

/**
 * Computed property that generates navigation menu items based on user role
 * Admin users get additional menu items for user management
 */
const menuItems = computed<MenuItem[]>(() => {
  const items: MenuItem[] = [
    {
      label: 'Dashboard',
      icon: 'pi pi-home',
      route: 'Dashboard',
    },
    {
      label: 'Sites',
      icon: 'pi pi-globe',
      route: 'Sites',
    },
    {
      label: 'Databases',
      icon: 'pi pi-database',
      route: 'Databases',
    },
    {
      label: 'Email',
      icon: 'pi pi-envelope',
      route: 'Email',
    },
    {
      label: 'Domains',
      icon: 'pi pi-link',
      route: 'Domains',
    },
    {
      label: 'File Manager',
      icon: 'pi pi-folder',
      route: 'Files',
    },
    {
      label: 'SSL Certificates',
      icon: 'pi pi-shield',
      route: 'SSL',
    },
    {
      label: 'Backups',
      icon: 'pi pi-cloud-download',
      route: 'Backups',
    },
    {
      label: 'Cron Jobs',
      icon: 'pi pi-clock',
      route: 'Cron',
    },
    {
      label: 'Settings',
      icon: 'pi pi-cog',
      route: 'Settings',
    },
  ];

  // Add admin-only menu items before Settings
  if (authStore.isAdmin) {
    items.splice(-1, 0, {
      label: 'Users',
      icon: 'pi pi-users',
      route: 'Users',
      requiresAdmin: true,
    });
  }

  return items;
});
</script>

<style scoped>
/* Sidebar container with dark theme and fixed positioning */
.sidebar {
  @apply bg-gray-900 text-white w-64 min-h-screen fixed left-0 top-0 z-40;
}

/* Active route highlighting for current page */
.router-link-active {
  @apply bg-primary-600 text-white;
}
</style>
