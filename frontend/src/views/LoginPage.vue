<template>
  <div class="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <div class="flex justify-center">
        <div class="w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center">
          <i class="pi pi-cube text-white text-xl"></i>
        </div>
      </div>
      <h2 class="mt-6 text-center text-3xl font-bold text-gray-900">
        Atulya Panel
      </h2>
      <p class="mt-2 text-center text-sm text-gray-600">
        Modern hosting control panel
      </p>
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
      <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
        <!-- Login Form -->
        <div v-if="!showRegister">
          <form @submit.prevent="handleLogin" class="space-y-6">
            <div>
              <label for="email" class="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div class="mt-1">
                <input
                  id="email"
                  v-model="loginForm.email"
                  name="email"
                  type="email"
                  autocomplete="email"
                  required
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div>
              <label for="password" class="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div class="mt-1">
                <input
                  id="password"
                  v-model="loginForm.password"
                  name="password"
                  type="password"
                  autocomplete="current-password"
                  required
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            <div class="flex items-center justify-between">
              <div class="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label for="remember-me" class="ml-2 block text-sm text-gray-900">
                  Remember me
                </label>
              </div>

              <div class="text-sm">
                <a href="#" class="font-medium text-primary-600 hover:text-primary-500">
                  Forgot your password?
                </a>
              </div>
            </div>

            <div>
              <button
                type="submit"
                :disabled="authStore.isLoading"
                class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i v-if="authStore.isLoading" class="pi pi-spin pi-spinner mr-2"></i>
                Sign in
              </button>
            </div>
          </form>

          <div class="mt-6">
            <div class="relative">
              <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-gray-300" />
              </div>
              <div class="relative flex justify-center text-sm">
                <span class="px-2 bg-white text-gray-500">Don't have an account?</span>
              </div>
            </div>

            <div class="mt-6">
              <button
                @click="showRegister = true"
                class="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Create account
              </button>
            </div>
          </div>
        </div>

        <!-- Register Form -->
        <div v-else>
          <form @submit.prevent="handleRegister" class="space-y-6">
            <div>
              <label for="reg-email" class="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div class="mt-1">
                <input
                  id="reg-email"
                  v-model="registerForm.email"
                  name="email"
                  type="email"
                  autocomplete="email"
                  required
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div>
              <label for="reg-username" class="block text-sm font-medium text-gray-700">
                Username
              </label>
              <div class="mt-1">
                <input
                  id="reg-username"
                  v-model="registerForm.username"
                  name="username"
                  type="text"
                  autocomplete="username"
                  required
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Choose a username"
                />
              </div>
            </div>

            <div>
              <label for="reg-password" class="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div class="mt-1">
                <input
                  id="reg-password"
                  v-model="registerForm.password"
                  name="password"
                  type="password"
                  autocomplete="new-password"
                  required
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Create a password"
                />
              </div>
            </div>

            <div>
              <label for="reg-confirm-password" class="block text-sm font-medium text-gray-700">
                Confirm password
              </label>
              <div class="mt-1">
                <input
                  id="reg-confirm-password"
                  v-model="registerForm.confirmPassword"
                  name="confirm-password"
                  type="password"
                  autocomplete="new-password"
                  required
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Confirm your password"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                :disabled="authStore.isLoading"
                class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i v-if="authStore.isLoading" class="pi pi-spin pi-spinner mr-2"></i>
                Create account
              </button>
            </div>
          </form>

          <div class="mt-6">
            <div class="relative">
              <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-gray-300" />
              </div>
              <div class="relative flex justify-center text-sm">
                <span class="px-2 bg-white text-gray-500">Already have an account?</span>
              </div>
            </div>

            <div class="mt-6">
              <button
                @click="showRegister = false"
                class="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Sign in
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Demo credentials -->
    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 class="text-sm font-medium text-blue-800 mb-2">Demo Credentials</h3>
        <div class="text-xs text-blue-700 space-y-1">
          <p><strong>Admin:</strong> admin@atulyapanel.com / admin123</p>
          <p><strong>User:</strong> user@example.com / user123</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useToast } from 'primevue/usetoast';
import type { LoginForm, RegisterForm } from '../types';

const router = useRouter();
const authStore = useAuthStore();
const toast = useToast();

const showRegister = ref(false);

const loginForm = reactive<LoginForm>({
  email: '',
  password: '',
});

const registerForm = reactive<RegisterForm>({
  email: '',
  username: '',
  password: '',
  confirmPassword: '',
});

async function handleLogin() {
  if (!loginForm.email || !loginForm.password) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Please fill in all fields',
      life: 3000,
    });
    return;
  }

  const result = await authStore.login(loginForm.email, loginForm.password);
  
  if (result.success) {
    toast.add({
      severity: 'success',
      summary: 'Success',
      detail: 'Logged in successfully',
      life: 3000,
    });
    router.push('/dashboard');
  } else {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: result.error || 'Login failed',
      life: 3000,
    });
  }
}

async function handleRegister() {
  if (!registerForm.email || !registerForm.username || !registerForm.password || !registerForm.confirmPassword) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Please fill in all fields',
      life: 3000,
    });
    return;
  }

  if (registerForm.password !== registerForm.confirmPassword) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Passwords do not match',
      life: 3000,
    });
    return;
  }

  if (registerForm.password.length < 8) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Password must be at least 8 characters long',
      life: 3000,
    });
    return;
  }

  const result = await authStore.register(
    registerForm.email,
    registerForm.username,
    registerForm.password
  );
  
  if (result.success) {
    toast.add({
      severity: 'success',
      summary: 'Success',
      detail: result.message || 'Account created successfully',
      life: 3000,
    });
    showRegister.value = false;
    // Clear form
    Object.assign(registerForm, {
      email: '',
      username: '',
      password: '',
      confirmPassword: '',
    });
  } else {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: result.error || 'Registration failed',
      life: 3000,
    });
  }
}
</script>

<style scoped>
/* Component-specific styles */
</style>
