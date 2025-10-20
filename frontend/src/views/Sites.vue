<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Sites</h1>
        <p class="text-gray-600">Manage your websites and applications</p>
      </div>
      <button class="btn-primary">
        <i class="pi pi-plus mr-2"></i>
        Add Site
      </button>
    </div>

    <div class="card">
      <div class="text-center py-12">
        <i class="pi pi-globe text-6xl text-gray-300 mb-4"></i>
        <h3 class="text-lg font-medium text-gray-900 mb-2">No sites yet</h3>
        <p class="text-gray-500 mb-6">Create your first website to get started</p>
        <button class="btn-primary">
          <i class="pi pi-plus mr-2"></i>
          Create Site
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Sites management will be implemented in Phase 2
</script>
