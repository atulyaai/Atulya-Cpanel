import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from './auth';
import { apiClient } from '../api/client';

// Mock the API client
vi.mock('../api/client', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    defaults: {
      headers: {
        common: {},
      },
    },
  },
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('Auth Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const authStore = useAuthStore();
      
      expect(authStore.user).toBeNull();
      expect(authStore.accessToken).toBeNull();
      expect(authStore.refreshToken).toBeNull();
      expect(authStore.isLoading).toBe(false);
      expect(authStore.isAuthenticated).toBe(false);
      expect(authStore.isAdmin).toBe(false);
      expect(authStore.isReseller).toBe(false);
    });
  });

  describe('Login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            user: {
              id: '1',
              email: 'test@example.com',
              username: 'testuser',
              role: 'USER',
            },
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
          },
        },
      };

      (apiClient.post as any).mockResolvedValue(mockResponse);

      const authStore = useAuthStore();
      const result = await authStore.login('test@example.com', 'password');

      expect(result.success).toBe(true);
      expect(authStore.user).toEqual(mockResponse.data.data.user);
      expect(authStore.accessToken).toBe('access-token');
      expect(authStore.refreshToken).toBe('refresh-token');
      expect(authStore.isAuthenticated).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('accessToken', 'access-token');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('refreshToken', 'refresh-token');
    });

    it('should handle login failure', async () => {
      const mockResponse = {
        data: {
          success: false,
          error: 'Invalid credentials',
        },
      };

      (apiClient.post as any).mockResolvedValue(mockResponse);

      const authStore = useAuthStore();
      const result = await authStore.login('test@example.com', 'wrong-password');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
      expect(authStore.user).toBeNull();
      expect(authStore.isAuthenticated).toBe(false);
    });

    it('should handle login API error', async () => {
      const mockError = {
        response: {
          data: {
            error: 'Network error',
          },
        },
      };

      (apiClient.post as any).mockRejectedValue(mockError);

      const authStore = useAuthStore();
      const result = await authStore.login('test@example.com', 'password');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('Register', () => {
    it('should register successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            message: 'User created successfully',
          },
        },
      };

      (apiClient.post as any).mockResolvedValue(mockResponse);

      const authStore = useAuthStore();
      const result = await authStore.register('test@example.com', 'testuser', 'password');

      expect(result.success).toBe(true);
      expect(result.message).toBe('User created successfully');
    });

    it('should handle registration failure', async () => {
      const mockResponse = {
        data: {
          success: false,
          error: 'User already exists',
        },
      };

      (apiClient.post as any).mockResolvedValue(mockResponse);

      const authStore = useAuthStore();
      const result = await authStore.register('test@example.com', 'testuser', 'password');

      expect(result.success).toBe(false);
      expect(result.error).toBe('User already exists');
    });
  });

  describe('Logout', () => {
    it('should logout successfully', async () => {
      const authStore = useAuthStore();
      
      // Set initial state
      authStore.user = { id: '1', email: 'test@example.com', username: 'testuser', role: 'USER' } as any;
      authStore.accessToken = 'access-token';
      authStore.refreshToken = 'refresh-token';

      (apiClient.post as any).mockResolvedValue({});

      await authStore.logout();

      expect(authStore.user).toBeNull();
      expect(authStore.accessToken).toBeNull();
      expect(authStore.refreshToken).toBeNull();
      expect(authStore.isAuthenticated).toBe(false);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('accessToken');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('refreshToken');
    });
  });

  describe('Check Auth', () => {
    it('should return false when no access token', async () => {
      const authStore = useAuthStore();
      const result = await authStore.checkAuth();
      
      expect(result).toBe(false);
    });

    it('should authenticate with valid token', async () => {
      localStorageMock.getItem.mockReturnValue('access-token');
      
      const mockResponse = {
        data: {
          success: true,
          data: {
            user: {
              id: '1',
              email: 'test@example.com',
              username: 'testuser',
              role: 'USER',
            },
          },
        },
      };

      (apiClient.get as any).mockResolvedValue(mockResponse);

      const authStore = useAuthStore();
      const result = await authStore.checkAuth();

      expect(result).toBe(true);
      expect(authStore.user).toEqual(mockResponse.data.data.user);
      expect(authStore.isAuthenticated).toBe(true);
    });

    it('should refresh token when access token is invalid', async () => {
      localStorageMock.getItem.mockReturnValue('access-token');
      
      const mockRefreshResponse = {
        data: {
          success: true,
          data: {
            user: {
              id: '1',
              email: 'test@example.com',
              username: 'testuser',
              role: 'USER',
            },
            accessToken: 'new-access-token',
          },
        },
      };

      (apiClient.get as any).mockRejectedValue(new Error('Unauthorized'));
      (apiClient.post as any).mockResolvedValue(mockRefreshResponse);

      const authStore = useAuthStore();
      authStore.refreshToken = 'refresh-token';
      
      const result = await authStore.checkAuth();

      expect(result).toBe(true);
      expect(authStore.accessToken).toBe('new-access-token');
    });
  });

  describe('Role Checks', () => {
    it('should correctly identify admin role', () => {
      const authStore = useAuthStore();
      authStore.user = { id: '1', email: 'admin@example.com', username: 'admin', role: 'ADMIN' } as any;
      
      expect(authStore.isAdmin).toBe(true);
      expect(authStore.isReseller).toBe(false);
    });

    it('should correctly identify reseller role', () => {
      const authStore = useAuthStore();
      authStore.user = { id: '1', email: 'reseller@example.com', username: 'reseller', role: 'RESELLER' } as any;
      
      expect(authStore.isAdmin).toBe(false);
      expect(authStore.isReseller).toBe(true);
    });

    it('should correctly identify user role', () => {
      const authStore = useAuthStore();
      authStore.user = { id: '1', email: 'user@example.com', username: 'user', role: 'USER' } as any;
      
      expect(authStore.isAdmin).toBe(false);
      expect(authStore.isReseller).toBe(false);
    });
  });
});