import { User, Site, Database, EmailAccount, Domain, Backup, CronJob, AuditLog, UserRole, DomainType, BackupType, BackupStatus } from '@prisma/client';

// Extended types with relations
export interface UserWithRelations extends User {
  sites: Site[];
  databases: Database[];
  emailAccounts: EmailAccount[];
  cronJobs: CronJob[];
  backups: Backup[];
  auditLogs: AuditLog[];
}

export interface SiteWithRelations extends Site {
  user: User;
  databases: Database[];
  emailAccounts: EmailAccount[];
  cronJobs: CronJob[];
  backups: Backup[];
  domains: Domain[];
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

// Authentication types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}

export interface AuthResponse {
  user: Omit<User, 'password'>;
  accessToken: string;
  refreshToken: string;
}

// Site management types
export interface CreateSiteRequest {
  domain: string;
  documentRoot?: string;
  phpVersion?: string;
}

export interface UpdateSiteRequest {
  documentRoot?: string;
  phpVersion?: string;
  sslEnabled?: boolean;
}

// Database types
export interface CreateDatabaseRequest {
  name: string;
  username?: string;
  password?: string;
}

export interface DatabaseStats {
  name: string;
  size: number;
  tables: number;
  users: number;
}

// Email types
export interface CreateEmailRequest {
  address: string;
  password: string;
  quota?: number;
}

// Domain types
export interface CreateDomainRequest {
  name: string;
  type: DomainType;
}

// Backup types
export interface CreateBackupRequest {
  type: BackupType;
  siteId: string;
}

export interface BackupProgress {
  id: string;
  progress: number;
  status: BackupStatus;
  message?: string;
}

// Cron job types
export interface CreateCronJobRequest {
  schedule: string;
  command: string;
  siteId: string;
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

// File management types
export interface FileInfo {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  permissions: string;
  modified: Date;
  owner: string;
  group: string;
}

export interface UploadProgress {
  filename: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
}

// SSL types
export interface SSLStatus {
  domain: string;
  status: 'valid' | 'expired' | 'not_issued';
  expiresAt?: Date;
  issuer?: string;
}

export interface IssueSSLRequest {
  domain: string;
  email?: string;
  forceRenew?: boolean;
}

// Audit log types
export interface AuditLogEntry {
  id: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  user: {
    id: string;
    email: string;
    username: string;
  };
}

// Export Prisma types
export type {
  User,
  Site,
  Database,
  EmailAccount,
  Domain,
  Backup,
  CronJob,
  AuditLog,
  UserRole,
  DomainType,
  BackupType,
  BackupStatus,
};
