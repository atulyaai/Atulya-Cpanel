// User types
export interface User {
  id: string;
  email: string;
  username: string;
  role: 'ADMIN' | 'RESELLER' | 'USER';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
}

// Site types
export interface Site {
  id: string;
  domain: string;
  documentRoot: string;
  phpVersion: string;
  sslEnabled: boolean;
  sslCert?: string;
  sslKey?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

// Database types
export interface Database {
  id: string;
  name: string;
  username: string;
  password: string;
  size: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  userId: string;
  siteId: string;
}

// Email types
export interface EmailAccount {
  id: string;
  email: string;
  password: string;
  quota: number;
  used: number;
  forwardTo?: string;
  catchAll: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  userId: string;
  siteId?: string;
}

// Domain types
export interface Domain {
  id: string;
  name: string;
  type: 'PRIMARY' | 'SUBDOMAIN' | 'ADDON';
  sslStatus: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  siteId: string;
}

// Backup types
export interface Backup {
  id: string;
  type: 'FULL' | 'INCREMENTAL' | 'DATABASE';
  size: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  location?: string;
  createdAt: string;
  completedAt?: string;
  userId: string;
  siteId: string;
}

// Cron job types
export interface CronJob {
  id: string;
  schedule: string;
  command: string;
  isActive: boolean;
  lastRun?: string;
  nextRun?: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  siteId: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// File types
export interface FileInfo {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  permissions: string;
  modified: string;
  owner: string;
  group: string;
}

// System metrics types
export interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  network: {
    interfaces: Array<{
      name: string;
      bytesReceived: number;
      bytesSent: number;
    }>;
  };
}

// Form types
export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
}

export interface ChangePasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface CreateSiteForm {
  domain: string;
  documentRoot?: string;
  phpVersion?: string;
}

export interface CreateDatabaseForm {
  name: string;
  username?: string;
  password?: string;
}

export interface CreateEmailForm {
  address: string;
  password: string;
  quota?: number;
}

export interface CreateDomainForm {
  name: string;
  type: 'PRIMARY' | 'SUBDOMAIN' | 'ADDON';
}

// Menu types
export interface MenuItem {
  label: string;
  icon: string;
  route: string;
  requiresAdmin?: boolean;
  badge?: number;
}
