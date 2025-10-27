<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">
          Settings
        </h1>
        <p class="text-gray-600">
          Configure panel settings and preferences
        </p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- General Settings -->
      <div class="card">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">
          General Settings
        </h3>
        <div class="space-y-4">
          <div>
            <label class="label">Panel Name</label>
            <input
              type="text"
              class="input"
              value="Atulya Panel"
            >
          </div>
          <div>
            <label class="label">Default Language</label>
            <select class="input">
              <option>English</option>
              <option>Spanish</option>
              <option>French</option>
            </select>
          </div>
          <div>
            <label class="label">Timezone</label>
            <select class="input">
              <option>UTC</option>
              <option>America/New_York</option>
              <option>Europe/London</option>
              <option>Asia/Tokyo</option>
            </select>
          </div>
          <button class="btn-primary">
            Save Settings
          </button>
        </div>
      </div>

      <!-- System Settings -->
      <div class="card">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">
          System Settings
        </h3>
        <div class="space-y-4">
          <div>
            <label class="label">Default PHP Version</label>
            <select class="input">
              <option>PHP 8.2</option>
              <option>PHP 8.1</option>
              <option>PHP 8.0</option>
              <option>PHP 7.4</option>
            </select>
          </div>
          <div>
            <label class="label">Max Upload Size</label>
            <input
              type="text"
              class="input"
              value="100M"
            >
          </div>
          <div>
            <label class="label">Backup Retention (days)</label>
            <input
              type="number"
              class="input"
              value="30"
            >
          </div>
          <button class="btn-primary">
            Save Settings
          </button>
        </div>
      </div>
    </div>

    <!-- Security Settings -->
    <div class="card">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">
        Security Settings
      </h3>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h4 class="font-medium text-gray-900">
                Two-Factor Authentication
              </h4>
              <p class="text-sm text-gray-500">
                Add an extra layer of security
              </p>
            </div>
            <button class="btn-secondary">
              Enable
            </button>
          </div>
          <div class="flex items-center justify-between">
            <div>
              <h4 class="font-medium text-gray-900">
                Session Timeout
              </h4>
              <p class="text-sm text-gray-500">
                Automatically log out after inactivity
              </p>
            </div>
            <input
              type="number"
              class="input w-20"
              value="30"
            >
          </div>
        </div>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h4 class="font-medium text-gray-900">
                IP Whitelist
              </h4>
              <p class="text-sm text-gray-500">
                Restrict access to specific IPs
              </p>
            </div>
            <button class="btn-secondary">
              Configure
            </button>
          </div>
          <div class="flex items-center justify-between">
            <div>
              <h4 class="font-medium text-gray-900">
                Login Attempts
              </h4>
              <p class="text-sm text-gray-500">
                Max failed login attempts
              </p>
            </div>
            <input
              type="number"
              class="input w-20"
              value="5"
            >
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Settings management
</script>
