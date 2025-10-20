<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Profile</h1>
        <p class="text-gray-600">Manage your account settings</p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Profile Information -->
      <div class="lg:col-span-2">
        <div class="card">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Profile Information</h3>
          <form @submit.prevent="updateProfile" class="space-y-4">
            <div>
              <label class="label">Username</label>
              <input
                v-model="profileForm.username"
                type="text"
                class="input"
                placeholder="Enter username"
              />
            </div>
            <div>
              <label class="label">Email Address</label>
              <input
                v-model="profileForm.email"
                type="email"
                class="input"
                placeholder="Enter email"
              />
            </div>
            <div>
              <label class="label">Role</label>
              <input
                type="text"
                class="input bg-gray-100"
                :value="authStore.user?.role"
                disabled
              />
            </div>
            <button type="submit" class="btn-primary">
              Update Profile
            </button>
          </form>
        </div>

        <!-- Change Password -->
        <div class="card">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Change Password</h3>
          <form @submit.prevent="changePassword" class="space-y-4">
            <div>
              <label class="label">Current Password</label>
              <input
                v-model="passwordForm.currentPassword"
                type="password"
                class="input"
                placeholder="Enter current password"
              />
            </div>
            <div>
              <label class="label">New Password</label>
              <input
                v-model="passwordForm.newPassword"
                type="password"
                class="input"
                placeholder="Enter new password"
              />
            </div>
            <div>
              <label class="label">Confirm New Password</label>
              <input
                v-model="passwordForm.confirmPassword"
                type="password"
                class="input"
                placeholder="Confirm new password"
              />
            </div>
            <button type="submit" class="btn-primary">
              Change Password
            </button>
          </form>
        </div>
      </div>

      <!-- Account Info -->
      <div>
        <div class="card">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Account Information</h3>
          <div class="space-y-4">
            <div>
              <label class="label">Account Status</label>
              <span class="status-online">Active</span>
            </div>
            <div>
              <label class="label">Member Since</label>
              <p class="text-sm text-gray-900">{{ formatDate(authStore.user?.createdAt) }}</p>
            </div>
            <div>
              <label class="label">Last Login</label>
              <p class="text-sm text-gray-900">{{ formatDate(authStore.user?.lastLogin) }}</p>
            </div>
            <div>
              <label class="label">Account ID</label>
              <p class="text-sm text-gray-900 font-mono">{{ authStore.user?.id }}</p>
            </div>
          </div>
        </div>

        <!-- Security Actions -->
        <div class="card">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Security</h3>
          <div class="space-y-3">
            <button class="w-full btn-secondary">
              <i class="pi pi-key mr-2"></i>
              Enable 2FA
            </button>
            <button class="w-full btn-secondary">
              <i class="pi pi-sign-out mr-2"></i>
              Logout All Devices
            </button>
            <button class="w-full btn-danger">
              <i class="pi pi-trash mr-2"></i>
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useToast } from 'primevue/usetoast';
import type { ChangePasswordForm } from '../types';

const authStore = useAuthStore();
const toast = useToast();

const profileForm = reactive({
  username: '',
  email: '',
});

const passwordForm = reactive<ChangePasswordForm>({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
});

function formatDate(dateString?: string): string {
  if (!dateString) return 'Never';
  return new Date(dateString).toLocaleDateString();
}

async function updateProfile() {
  // TODO: Implement profile update
  toast.add({
    severity: 'info',
    summary: 'Info',
    detail: 'Profile update will be implemented in Phase 5',
    life: 3000,
  });
}

async function changePassword() {
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Passwords do not match',
      life: 3000,
    });
    return;
  }

  const result = await authStore.changePassword(
    passwordForm.currentPassword,
    passwordForm.newPassword
  );

  if (result.success) {
    toast.add({
      severity: 'success',
      summary: 'Success',
      detail: result.message || 'Password changed successfully',
      life: 3000,
    });
    
    // Clear form
    Object.assign(passwordForm, {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
  } else {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: result.error || 'Failed to change password',
      life: 3000,
    });
  }
}

onMounted(() => {
  // Initialize form with user data
  if (authStore.user) {
    profileForm.username = authStore.user.username;
    profileForm.email = authStore.user.email;
  }
});
</script>
