<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Domains</h1>
        <p class="text-gray-600">Manage domain names and DNS settings</p>
      </div>
      <button class="btn-primary">
        <i class="pi pi-plus mr-2"></i>
        Add Domain
      </button>
    </div>

    <div class="card">
      <div class="text-center py-12">
        <i class="pi pi-link text-6xl text-gray-300 mb-4"></i>
        <h3 class="text-lg font-medium text-gray-900 mb-2">No domains yet</h3>
        <p class="text-gray-500 mb-6">Add your first domain to get started</p>
        <button class="btn-primary">
          <i class="pi pi-plus mr-2"></i>
          Add Domain
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Domain management will be implemented in Phase 2
</script>
