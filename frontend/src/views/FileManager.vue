<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">File Manager</h1>
        <p class="text-gray-600">Manage your files and directories</p>
      </div>
      <div class="flex items-center space-x-3">
        <button @click="showUploadModal = true" class="btn-secondary">
          <i class="pi pi-upload mr-2"></i>
          Upload
        </button>
        <button @click="createNewFolder" class="btn-primary">
          <i class="pi pi-plus mr-2"></i>
          New Folder
        </button>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="card">
      <div class="flex items-center justify-between p-4">
        <div class="flex items-center space-x-4">
          <!-- Breadcrumb -->
          <nav class="flex items-center space-x-2">
            <button @click="navigateToPath('/')" class="text-gray-500 hover:text-gray-700">
              <i class="pi pi-home"></i>
            </button>
            <span class="text-gray-400">/</span>
            <span 
              v-for="(segment, index) in pathSegments" 
              :key="index"
              class="flex items-center space-x-2"
            >
              <button 
                @click="navigateToPath(getPathUpTo(index))"
                class="text-gray-500 hover:text-gray-700"
              >
                {{ segment }}
              </button>
              <span v-if="index < pathSegments.length - 1" class="text-gray-400">/</span>
            </span>
          </nav>
        </div>
        
        <div class="flex items-center space-x-4">
          <!-- View mode toggle -->
          <div class="flex items-center space-x-2">
            <button 
              @click="viewMode = 'grid'"
              :class="viewMode === 'grid' ? 'text-primary-600' : 'text-gray-400'"
              class="p-2 hover:bg-gray-100 rounded"
            >
              <i class="pi pi-th-large"></i>
            </button>
            <button 
              @click="viewMode = 'list'"
              :class="viewMode === 'list' ? 'text-primary-600' : 'text-gray-400'"
              class="p-2 hover:bg-gray-100 rounded"
            >
              <i class="pi pi-list"></i>
            </button>
          </div>
          
          <!-- Show hidden files toggle -->
          <div class="flex items-center space-x-2">
            <input 
              v-model="showHidden" 
              type="checkbox" 
              id="showHidden"
              class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label for="showHidden" class="text-sm text-gray-600">Show hidden</label>
          </div>
          
          <!-- Refresh button -->
          <button @click="refreshDirectory" class="btn-secondary btn-sm">
            <i class="pi pi-refresh mr-1"></i>
            Refresh
          </button>
        </div>
      </div>
    </div>

    <!-- File browser -->
    <div class="card">
      <div v-if="loading" class="p-8 text-center">
        <i class="pi pi-spin pi-spinner text-2xl text-gray-400"></i>
        <p class="text-gray-500 mt-2">Loading directory...</p>
      </div>

      <div v-else-if="error" class="p-8 text-center">
        <i class="pi pi-exclamation-triangle text-2xl text-red-400 mb-2"></i>
        <p class="text-red-600">{{ error }}</p>
        <button @click="refreshDirectory" class="btn-secondary mt-4">
          Try Again
        </button>
      </div>

      <div v-else-if="directoryInfo" class="p-4">
        <!-- Directory stats -->
        <div class="mb-4 text-sm text-gray-600">
          {{ directoryInfo.totalFiles }} files, {{ directoryInfo.totalDirectories }} folders
          <span v-if="directoryInfo.totalSize > 0">
            • {{ formatFileSize(directoryInfo.totalSize) }}
          </span>
        </div>

        <!-- Grid view -->
        <div v-if="viewMode === 'grid'" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div 
            v-for="file in directoryInfo.files" 
            :key="file.path"
            @click="handleFileClick(file)"
            @dblclick="handleFileDoubleClick(file)"
            class="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
            :class="{ 'bg-blue-50 border-blue-200': selectedFiles.includes(file.path) }"
          >
            <div class="text-center">
              <div class="text-3xl mb-2">
                <i :class="getFileIcon(file)" class="text-gray-600"></i>
              </div>
              <div class="text-sm font-medium text-gray-900 truncate" :title="file.name">
                {{ file.name }}
              </div>
              <div class="text-xs text-gray-500 mt-1">
                {{ file.type === 'directory' ? 'Folder' : formatFileSize(file.size) }}
              </div>
              <div class="text-xs text-gray-400 mt-1">
                {{ formatDate(file.modified) }}
              </div>
            </div>
          </div>
        </div>

        <!-- List view -->
        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input 
                    type="checkbox" 
                    :checked="selectedFiles.length === directoryInfo.files.length"
                    @change="toggleSelectAll"
                    class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Size
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Modified
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Permissions
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr 
                v-for="file in directoryInfo.files" 
                :key="file.path"
                class="hover:bg-gray-50"
                :class="{ 'bg-blue-50': selectedFiles.includes(file.path) }"
              >
                <td class="px-6 py-4 whitespace-nowrap">
                  <input 
                    type="checkbox" 
                    :checked="selectedFiles.includes(file.path)"
                    @change="toggleFileSelection(file.path)"
                    class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <i :class="getFileIcon(file)" class="text-gray-400 mr-3"></i>
                    <div>
                      <div class="text-sm font-medium text-gray-900">{{ file.name }}</div>
                      <div class="text-sm text-gray-500">{{ file.owner }}:{{ file.group }}</div>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {{ file.type === 'directory' ? '-' : formatFileSize(file.size) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {{ formatDate(file.modified) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {{ file.permissions }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div class="flex items-center space-x-2">
                    <button 
                      @click="handleFileClick(file)"
                      class="text-primary-600 hover:text-primary-900"
                      title="View/Edit"
                    >
                      <i class="pi pi-eye"></i>
                    </button>
                    <button 
                      @click="renameFile(file)"
                      class="text-gray-600 hover:text-gray-900"
                      title="Rename"
                    >
                      <i class="pi pi-pencil"></i>
                    </button>
                    <button 
                      @click="deleteFile(file)"
                      class="text-red-600 hover:text-red-900"
                      title="Delete"
                    >
                      <i class="pi pi-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- File Editor Modal -->
    <Dialog v-model:visible="showEditorModal" modal header="File Editor" :style="{ width: '90vw', height: '80vh' }">
      <div v-if="editorFile" class="h-full flex flex-col">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-lg font-semibold">{{ editorFile.name }}</h3>
            <p class="text-sm text-gray-500">{{ editorFile.path }}</p>
          </div>
          <div class="flex items-center space-x-2">
            <span class="text-sm text-gray-500">{{ editorFile.type }}</span>
            <button @click="saveFile" :disabled="!hasChanges" class="btn-primary btn-sm">
              <i class="pi pi-save mr-1"></i>
              Save
            </button>
          </div>
        </div>
        
        <div class="flex-1 border rounded-lg overflow-hidden">
          <MonacoEditor
            v-model="editorContent"
            :language="getFileLanguage(editorFile.name)"
            :options="editorOptions"
            @change="onEditorChange"
            class="h-full"
          />
        </div>
      </div>
    </Dialog>

    <!-- Upload Modal -->
    <Dialog v-model:visible="showUploadModal" modal header="Upload Files" :style="{ width: '500px' }">
      <div class="space-y-4">
        <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <i class="pi pi-cloud-upload text-4xl text-gray-400 mb-4"></i>
          <p class="text-gray-600 mb-4">Drag and drop files here or click to browse</p>
          <input 
            ref="fileInput"
            type="file" 
            multiple 
            @change="handleFileUpload"
            class="hidden"
          />
          <button @click="$refs.fileInput.click()" class="btn-primary">
            Choose Files
          </button>
        </div>
        
        <div v-if="uploadFiles.length > 0" class="space-y-2">
          <h4 class="font-medium text-gray-900">Files to upload:</h4>
          <div class="space-y-1">
            <div 
              v-for="file in uploadFiles" 
              :key="file.name"
              class="flex items-center justify-between p-2 bg-gray-50 rounded"
            >
              <span class="text-sm text-gray-700">{{ file.name }}</span>
              <span class="text-sm text-gray-500">{{ formatFileSize(file.size) }}</span>
            </div>
          </div>
        </div>
        
        <div class="flex justify-end space-x-3 pt-4">
          <button @click="showUploadModal = false" class="btn-secondary">
            Cancel
          </button>
          <button @click="uploadFilesToServer" :disabled="uploadFiles.length === 0" class="btn-primary">
            <i class="pi pi-upload mr-2"></i>
            Upload {{ uploadFiles.length }} files
          </button>
        </div>
      </div>
    </Dialog>

    <!-- Create Folder Modal -->
    <Dialog v-model:visible="showCreateFolderModal" modal header="Create New Folder" :style="{ width: '400px' }">
      <div class="space-y-4">
        <div>
          <label class="label">Folder Name</label>
          <input
            v-model="newFolderName"
            type="text"
            class="input"
            placeholder="Enter folder name"
            @keyup.enter="createFolder"
          />
        </div>
        
        <div class="flex justify-end space-x-3 pt-4">
          <button @click="showCreateFolderModal = false" class="btn-secondary">
            Cancel
          </button>
          <button @click="createFolder" :disabled="!newFolderName.trim()" class="btn-primary">
            Create Folder
          </button>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import MonacoEditor from '@guolao/vue-monaco-editor';
import { apiClient } from '../api/client';

const toast = useToast();

// State
const loading = ref(false);
const error = ref<string | null>(null);
const currentPath = ref('/var/www');
const directoryInfo = ref<any>(null);
const viewMode = ref<'grid' | 'list'>('grid');
const showHidden = ref(false);
const selectedFiles = ref<string[]>([]);

// Editor state
const showEditorModal = ref(false);
const editorFile = ref<any>(null);
const editorContent = ref('');
const hasChanges = ref(false);

// Upload state
const showUploadModal = ref(false);
const uploadFiles = ref<File[]>([]);

// Create folder state
const showCreateFolderModal = ref(false);
const newFolderName = ref('');

// Computed
const pathSegments = computed(() => {
  return currentPath.value.split('/').filter(segment => segment.length > 0);
});

const editorOptions = {
  theme: 'vs-dark',
  fontSize: 14,
  minimap: { enabled: true },
  scrollBeyondLastLine: false,
  wordWrap: 'on' as const,
  automaticLayout: true,
};

// Methods
async function loadDirectory(path: string) {
  loading.value = true;
  error.value = null;
  
  try {
    const response = await apiClient.get('/files/list', {
      params: {
        path,
        showHidden: showHidden.value
      }
    });
    
    if (response.data.success) {
      directoryInfo.value = response.data.data;
      currentPath.value = path;
    } else {
      error.value = response.data.error || 'Failed to load directory';
    }
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Failed to load directory';
  } finally {
    loading.value = false;
  }
}

function refreshDirectory() {
  loadDirectory(currentPath.value);
}

function navigateToPath(path: string) {
  loadDirectory(path);
}

function getPathUpTo(index: number): string {
  const segments = pathSegments.value.slice(0, index + 1);
  return '/' + segments.join('/');
}

function handleFileClick(file: any) {
  if (file.type === 'directory') {
    loadDirectory(file.path);
  } else {
    openFileEditor(file);
  }
}

function handleFileDoubleClick(file: any) {
  if (file.type === 'directory') {
    loadDirectory(file.path);
  }
}

async function openFileEditor(file: any) {
  try {
    const response = await apiClient.get('/files/read', {
      params: { path: file.path }
    });
    
    if (response.data.success) {
      editorFile.value = file;
      editorContent.value = response.data.data.content;
      hasChanges.value = false;
      showEditorModal.value = true;
    } else {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: response.data.error || 'Failed to open file',
        life: 3000,
      });
    }
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.response?.data?.error || 'Failed to open file',
      life: 3000,
    });
  }
}

async function saveFile() {
  if (!editorFile.value) return;
  
  try {
    const response = await apiClient.post('/files/write', {
      path: editorFile.value.path,
      content: editorContent.value
    });
    
    if (response.data.success) {
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: 'File saved successfully',
        life: 3000,
      });
      hasChanges.value = false;
      refreshDirectory();
    } else {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: response.data.error || 'Failed to save file',
        life: 3000,
      });
    }
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.response?.data?.error || 'Failed to save file',
      life: 3000,
    });
  }
}

function onEditorChange() {
  hasChanges.value = true;
}

function getFileIcon(file: any): string {
  if (file.type === 'directory') {
    return 'pi pi-folder';
  }
  
  const ext = file.name.split('.').pop()?.toLowerCase();
  const iconMap: { [key: string]: string } = {
    'txt': 'pi pi-file',
    'html': 'pi pi-file-edit',
    'css': 'pi pi-palette',
    'js': 'pi pi-code',
    'json': 'pi pi-file-edit',
    'php': 'pi pi-code',
    'py': 'pi pi-code',
    'md': 'pi pi-file-edit',
    'log': 'pi pi-file',
  };
  
  return iconMap[ext || ''] || 'pi pi-file';
}

function getFileLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const languageMap: { [key: string]: string } = {
    'html': 'html',
    'css': 'css',
    'js': 'javascript',
    'json': 'json',
    'php': 'php',
    'py': 'python',
    'md': 'markdown',
    'sql': 'sql',
    'xml': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml',
  };
  
  return languageMap[ext || ''] || 'plaintext';
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString() + ' ' + new Date(date).toLocaleTimeString();
}

function toggleFileSelection(filePath: string) {
  const index = selectedFiles.value.indexOf(filePath);
  if (index > -1) {
    selectedFiles.value.splice(index, 1);
  } else {
    selectedFiles.value.push(filePath);
  }
}

function toggleSelectAll() {
  if (selectedFiles.value.length === directoryInfo.value.files.length) {
    selectedFiles.value = [];
  } else {
    selectedFiles.value = directoryInfo.value.files.map((file: any) => file.path);
  }
}

function createNewFolder() {
  showCreateFolderModal.value = true;
  newFolderName.value = '';
}

async function createFolder() {
  if (!newFolderName.value.trim()) return;
  
  try {
    const response = await apiClient.post('/files/mkdir', {
      path: `${currentPath.value}/${newFolderName.value.trim()}`
    });
    
    if (response.data.success) {
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Folder created successfully',
        life: 3000,
      });
      showCreateFolderModal.value = false;
      refreshDirectory();
    } else {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: response.data.error || 'Failed to create folder',
        life: 3000,
      });
    }
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.response?.data?.error || 'Failed to create folder',
      life: 3000,
    });
  }
}

async function renameFile(file: any) {
  const newName = prompt(`Enter new name for "${file.name}":`, file.name);
  if (!newName || newName === file.name) return;
  
  try {
    const response = await apiClient.put('/files/rename', {
      oldPath: file.path,
      newPath: file.path.replace(file.name, newName)
    });
    
    if (response.data.success) {
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: 'File renamed successfully',
        life: 3000,
      });
      await loadDirectory(currentPath.value);
    }
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.response?.data?.error || 'Failed to rename file',
      life: 3000,
    });
  }
}

async function deleteFile(file: any) {
  if (!confirm(`Are you sure you want to delete "${file.name}"?`)) {
    return;
  }
  
  try {
    const response = await apiClient.delete('/files/delete', {
      data: { path: file.path }
    });
    
    if (response.data.success) {
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: 'File deleted successfully',
        life: 3000,
      });
      await loadDirectory(currentPath.value);
    }
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.response?.data?.error || 'Failed to delete file',
      life: 3000,
    });
  }
}

function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files) {
    uploadFiles.value = Array.from(target.files);
  }
}

async function uploadFilesToServer() {
  if (uploadFiles.value.length === 0) return;
  
  loading.value = true;
  try {
    const formData = new FormData();
    uploadFiles.value.forEach(file => {
      formData.append('files', file);
    });
    formData.append('path', currentPath.value);
    
    const response = await apiClient.post('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    if (response.data.success) {
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: `${uploadFiles.value.length} file(s) uploaded successfully`,
        life: 3000,
      });
      
      showUploadModal.value = false;
      uploadFiles.value = [];
      await loadDirectory(currentPath.value);
    }
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.response?.data?.error || 'Failed to upload files',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
}

// Watchers
watch(showHidden, () => {
  refreshDirectory();
});

// Lifecycle
onMounted(() => {
  loadDirectory(currentPath.value);
});
</script>