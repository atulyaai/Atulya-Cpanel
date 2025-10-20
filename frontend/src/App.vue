<template>
  <div id="app" class="min-h-screen bg-gray-50">
    <!-- Loading overlay -->
    <div v-if="isLoading" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 flex items-center space-x-4">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span class="text-gray-700">Loading...</span>
      </div>
    </div>

    <!-- Main app -->
    <div v-else>
      <!-- Login page -->
      <LoginPage v-if="!isAuthenticated" />
      
      <!-- Main layout -->
      <div v-else class="flex">
        <!-- Sidebar -->
        <Sidebar />
        
        <!-- Main content -->
        <div class="flex-1 flex flex-col min-h-screen">
          <!-- Top bar -->
          <Topbar />
          
          <!-- Page content -->
          <main class="flex-1 p-6">
            <router-view />
          </main>
        </div>
      </div>
    </div>

    <!-- Toast notifications -->
    <Toast />
    
    <!-- Confirmation dialogs -->
    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useAuthStore } from './stores/auth';
import { useRouter } from 'vue-router';
import Sidebar from './components/Sidebar.vue';
import Topbar from './components/Topbar.vue';
import LoginPage from './views/LoginPage.vue';
import Toast from 'primevue/toast';
import ConfirmDialog from 'primevue/confirmdialog';

const authStore = useAuthStore();
const router = useRouter();

const isLoading = computed(() => authStore.isLoading);
const isAuthenticated = computed(() => authStore.isAuthenticated);

onMounted(async () => {
  // Check if user is already authenticated
  await authStore.checkAuth();
});
</script>

<style scoped>
/* Component-specific styles */
</style>
