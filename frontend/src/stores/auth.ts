import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { apiClient } from '../api/client';
import type { User } from '../types';

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null);
  const accessToken = ref<string | null>(localStorage.getItem('accessToken'));
  const refreshToken = ref<string | null>(localStorage.getItem('refreshToken'));
  const isLoading = ref(false);

  // Getters
  const isAuthenticated = computed(() => !!user.value && !!accessToken.value);
  const isAdmin = computed(() => user.value?.role === 'ADMIN');
  const isReseller = computed(() => user.value?.role === 'RESELLER');
  const token = computed(() => accessToken.value);

  // Actions
  async function login(email: string, password: string) {
    isLoading.value = true;
    
    try {
      const response = await apiClient.post('/auth/login', {
        email,
        password,
      });

      if (response.data.success) {
        const { user: userData, accessToken: token, refreshToken: refresh } = response.data.data;
        
        user.value = userData;
        accessToken.value = token;
        refreshToken.value = refresh;
        
        // Store tokens
        localStorage.setItem('accessToken', token);
        localStorage.setItem('refreshToken', refresh);
        
        // Set default authorization header
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        return { success: true };
      } else {
        return { success: false, error: response.data.error };
      }
    } catch (error: any) {
      return { 
        success: false, 
        error: error.response?.data?.error || 'Login failed' 
      };
    } finally {
      isLoading.value = false;
    }
  }

  async function register(email: string, username: string, password: string) {
    isLoading.value = true;
    
    try {
      const response = await apiClient.post('/auth/register', {
        email,
        username,
        password,
      });

      if (response.data.success) {
        return { success: true, message: response.data.data.message };
      } else {
        return { success: false, error: response.data.error };
      }
    } catch (error: any) {
      return { 
        success: false, 
        error: error.response?.data?.error || 'Registration failed' 
      };
    } finally {
      isLoading.value = false;
    }
  }

  async function logout() {
    isLoading.value = true;
    
    try {
      if (refreshToken.value) {
        await apiClient.post('/auth/logout', {
          refreshToken: refreshToken.value,
        });
      }
    } catch (error) {
      // Logout error handled silently
    } finally {
      // Clear state regardless of API call result
      user.value = null;
      accessToken.value = null;
      refreshToken.value = null;
      
      // Clear localStorage
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      
      // Clear authorization header
      delete apiClient.defaults.headers.common['Authorization'];
      
      isLoading.value = false;
    }
  }

  async function checkAuth() {
    if (!accessToken.value) {
      return false;
    }

    isLoading.value = true;
    
    try {
      // Set authorization header
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken.value}`;
      
      const response = await apiClient.get('/auth/me');
      
      if (response.data.success) {
        user.value = response.data.data.user;
        return true;
      } else {
        // Token is invalid, try to refresh
        return await refreshAccessToken();
      }
    } catch (error: any) {
      // Try to refresh token
      return await refreshAccessToken();
    } finally {
      isLoading.value = false;
    }
  }

  async function refreshAccessToken() {
    if (!refreshToken.value) {
      await logout();
      return false;
    }

    try {
      const response = await apiClient.post('/auth/refresh', {
        refreshToken: refreshToken.value,
      });

      if (response.data.success) {
        const { user: userData, accessToken: token } = response.data.data;
        
        user.value = userData;
        accessToken.value = token;
        
        // Store new token
        localStorage.setItem('accessToken', token);
        
        // Set authorization header
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        return true;
      } else {
        await logout();
        return false;
      }
    } catch (error) {
      await logout();
      return false;
    }
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    isLoading.value = true;
    
    try {
      const response = await apiClient.put('/auth/change-password', {
        currentPassword,
        newPassword,
      });

      if (response.data.success) {
        return { success: true, message: response.data.message };
      } else {
        return { success: false, error: response.data.error };
      }
    } catch (error: any) {
      console.error('Change password error:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Failed to change password' 
      };
    } finally {
      isLoading.value = false;
    }
  }

  async function logoutAll() {
    isLoading.value = true;
    
    try {
      await apiClient.post('/auth/logout-all');
      await logout();
      return { success: true };
    } catch (error: any) {
      await logout(); // Logout locally anyway
      return { success: false, error: error.response?.data?.error || 'Logout failed' };
    }
  }

  return {
    // State
    user,
    accessToken,
    refreshToken,
    isLoading,
    
    // Getters
    isAuthenticated,
    isAdmin,
    isReseller,
    token,
    
    // Actions
    login,
    register,
    logout,
    checkAuth,
    changePassword,
    logoutAll,
  };
});
