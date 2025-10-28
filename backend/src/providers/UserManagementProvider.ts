import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';

const execAsync = promisify(exec);

export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
  lastLoginIP?: string;
  passwordChangedAt: Date;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  backupCodes: string[];
  permissions: Permission[];
  preferences: UserPreferences;
  quota: UserQuota;
  statistics: UserStatistics;
}

export interface UserRole {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  timezone: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
    categories: string[];
  };
  dashboard: {
    widgets: string[];
    layout: string;
  };
  security: {
    sessionTimeout: number; // minutes
    requirePasswordChange: boolean;
    passwordChangeInterval: number; // days
  };
}

export interface UserQuota {
  diskSpace: {
    used: number; // MB
    limit: number; // MB
    unlimited: boolean;
  };
  bandwidth: {
    used: number; // MB
    limit: number; // MB
    unlimited: boolean;
    resetDate: Date;
  };
  domains: {
    used: number;
    limit: number;
    unlimited: boolean;
  };
  databases: {
    used: number;
    limit: number;
    unlimited: boolean;
  };
  emailAccounts: {
    used: number;
    limit: number;
    unlimited: boolean;
  };
  ftpAccounts: {
    used: number;
    limit: number;
    unlimited: boolean;
  };
}

export interface UserStatistics {
  totalLogins: number;
  lastLogin: Date;
  totalSessions: number;
  activeSessions: number;
  totalRequests: number;
  totalErrors: number;
  totalBandwidth: number;
  totalDiskUsage: number;
  averageSessionDuration: number; // minutes
  mostUsedFeatures: string[];
  loginHistory: LoginHistory[];
}

export interface LoginHistory {
  id: string;
  timestamp: Date;
  ip: string;
  userAgent: string;
  success: boolean;
  failureReason?: string;
  location?: string;
}

export interface UserSession {
  id: string;
  userId: string;
  token: string;
  ip: string;
  userAgent: string;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  isActive: boolean;
  metadata?: Record<string, any>;
}

export interface UserGroup {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  users: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSymbols: boolean;
  preventReuse: number; // number of previous passwords to check
  maxAge: number; // days
  minAge: number; // days
  lockoutAttempts: number;
  lockoutDuration: number; // minutes
}

export class UserManagementProvider {
  private users: Map<string, User>;
  private roles: Map<string, UserRole>;
  private permissions: Map<string, Permission>;
  private groups: Map<string, UserGroup>;
  private sessions: Map<string, UserSession>;
  private passwordPolicy: PasswordPolicy;
  private configPath: string;
  private dataPath: string;

  constructor() {
    this.users = new Map();
    this.roles = new Map();
    this.permissions = new Map();
    this.groups = new Map();
    this.sessions = new Map();
    this.passwordPolicy = {
      minLength: 8,
      maxLength: 128,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSymbols: true,
      preventReuse: 5,
      maxAge: 90,
      minAge: 1,
      lockoutAttempts: 5,
      lockoutDuration: 30,
    };
    this.configPath = '/etc/atulya-panel/users';
    this.dataPath = '/var/lib/atulya-panel/users';
    
    this.initialize();
  }

  /**
   * Initialize user management provider
   */
  private async initialize(): Promise<void> {
    try {
      await fs.ensureDir(this.configPath);
      await fs.ensureDir(this.dataPath);
      await this.loadPermissions();
      await this.loadRoles();
      await this.loadUsers();
      await this.loadGroups();
      await this.loadSessions();
      await this.loadPasswordPolicy();
    } catch (error) {
      console.error('Failed to initialize user management provider:', error);
    }
  }

  /**
   * Load permissions
   */
  private async loadPermissions(): Promise<void> {
    try {
      const permissionsFile = path.join(this.configPath, 'permissions.json');
      if (await fs.pathExists(permissionsFile)) {
        const data = await fs.readFile(permissionsFile, 'utf8');
        const permissions = JSON.parse(data);
        
        this.permissions.clear();
        for (const permission of permissions) {
          this.permissions.set(permission.id, permission);
        }
      } else {
        // Create default permissions
        await this.createDefaultPermissions();
      }
    } catch (error) {
      console.error('Failed to load permissions:', error);
    }
  }

  /**
   * Create default permissions
   */
  private async createDefaultPermissions(): Promise<void> {
    const defaultPermissions: Permission[] = [
      // System permissions
      { id: 'system.view', name: 'View System', resource: 'system', action: 'view' },
      { id: 'system.manage', name: 'Manage System', resource: 'system', action: 'manage' },
      
      // User management permissions
      { id: 'users.view', name: 'View Users', resource: 'users', action: 'view' },
      { id: 'users.create', name: 'Create Users', resource: 'users', action: 'create' },
      { id: 'users.update', name: 'Update Users', resource: 'users', action: 'update' },
      { id: 'users.delete', name: 'Delete Users', resource: 'users', action: 'delete' },
      
      // Site management permissions
      { id: 'sites.view', name: 'View Sites', resource: 'sites', action: 'view' },
      { id: 'sites.create', name: 'Create Sites', resource: 'sites', action: 'create' },
      { id: 'sites.update', name: 'Update Sites', resource: 'sites', action: 'update' },
      { id: 'sites.delete', name: 'Delete Sites', resource: 'sites', action: 'delete' },
      
      // Database management permissions
      { id: 'databases.view', name: 'View Databases', resource: 'databases', action: 'view' },
      { id: 'databases.create', name: 'Create Databases', resource: 'databases', action: 'create' },
      { id: 'databases.update', name: 'Update Databases', resource: 'databases', action: 'update' },
      { id: 'databases.delete', name: 'Delete Databases', resource: 'databases', action: 'delete' },
      
      // File management permissions
      { id: 'files.view', name: 'View Files', resource: 'files', action: 'view' },
      { id: 'files.upload', name: 'Upload Files', resource: 'files', action: 'upload' },
      { id: 'files.download', name: 'Download Files', resource: 'files', action: 'download' },
      { id: 'files.delete', name: 'Delete Files', resource: 'files', action: 'delete' },
      
      // Email management permissions
      { id: 'email.view', name: 'View Email', resource: 'email', action: 'view' },
      { id: 'email.create', name: 'Create Email', resource: 'email', action: 'create' },
      { id: 'email.update', name: 'Update Email', resource: 'email', action: 'update' },
      { id: 'email.delete', name: 'Delete Email', resource: 'email', action: 'delete' },
      
      // SSL management permissions
      { id: 'ssl.view', name: 'View SSL', resource: 'ssl', action: 'view' },
      { id: 'ssl.manage', name: 'Manage SSL', resource: 'ssl', action: 'manage' },
      
      // Backup management permissions
      { id: 'backups.view', name: 'View Backups', resource: 'backups', action: 'view' },
      { id: 'backups.create', name: 'Create Backups', resource: 'backups', action: 'create' },
      { id: 'backups.restore', name: 'Restore Backups', resource: 'backups', action: 'restore' },
      { id: 'backups.delete', name: 'Delete Backups', resource: 'backups', action: 'delete' },
      
      // Monitoring permissions
      { id: 'monitoring.view', name: 'View Monitoring', resource: 'monitoring', action: 'view' },
      { id: 'monitoring.manage', name: 'Manage Monitoring', resource: 'monitoring', action: 'manage' },
      
      // Settings permissions
      { id: 'settings.view', name: 'View Settings', resource: 'settings', action: 'view' },
      { id: 'settings.manage', name: 'Manage Settings', resource: 'settings', action: 'manage' },
    ];

    for (const permission of defaultPermissions) {
      this.permissions.set(permission.id, permission);
    }

    await this.savePermissions();
  }

  /**
   * Save permissions
   */
  private async savePermissions(): Promise<void> {
    try {
      const permissionsFile = path.join(this.configPath, 'permissions.json');
      const data = Array.from(this.permissions.values());
      await fs.writeFile(permissionsFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save permissions:', error);
    }
  }

  /**
   * Load roles
   */
  private async loadRoles(): Promise<void> {
    try {
      const rolesFile = path.join(this.configPath, 'roles.json');
      if (await fs.pathExists(rolesFile)) {
        const data = await fs.readFile(rolesFile, 'utf8');
        const roles = JSON.parse(data);
        
        this.roles.clear();
        for (const role of roles) {
          this.roles.set(role.id, role);
        }
      } else {
        // Create default roles
        await this.createDefaultRoles();
      }
    } catch (error) {
      console.error('Failed to load roles:', error);
    }
  }

  /**
   * Create default roles
   */
  private async createDefaultRoles(): Promise<void> {
    const defaultRoles: UserRole[] = [
      {
        id: 'super_admin',
        name: 'Super Administrator',
        description: 'Full system access with all permissions',
        permissions: Array.from(this.permissions.values()),
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'admin',
        name: 'Administrator',
        description: 'Administrative access with most permissions',
        permissions: Array.from(this.permissions.values()).filter(p => 
          !p.id.includes('system.manage') && 
          !p.id.includes('users.delete') &&
          !p.id.includes('settings.manage')
        ),
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'reseller',
        name: 'Reseller',
        description: 'Reseller access for managing client accounts',
        permissions: Array.from(this.permissions.values()).filter(p => 
          p.id.includes('users.') || 
          p.id.includes('sites.') || 
          p.id.includes('databases.') ||
          p.id.includes('files.') ||
          p.id.includes('email.') ||
          p.id.includes('ssl.') ||
          p.id.includes('backups.') ||
          p.id.includes('monitoring.view')
        ),
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'user',
        name: 'User',
        description: 'Standard user access',
        permissions: Array.from(this.permissions.values()).filter(p => 
          p.id.includes('sites.') || 
          p.id.includes('databases.') ||
          p.id.includes('files.') ||
          p.id.includes('email.') ||
          p.id.includes('ssl.view') ||
          p.id.includes('backups.view') ||
          p.id.includes('monitoring.view')
        ),
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    for (const role of defaultRoles) {
      this.roles.set(role.id, role);
    }

    await this.saveRoles();
  }

  /**
   * Save roles
   */
  private async saveRoles(): Promise<void> {
    try {
      const rolesFile = path.join(this.configPath, 'roles.json');
      const data = Array.from(this.roles.values());
      await fs.writeFile(rolesFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save roles:', error);
    }
  }

  /**
   * Load users
   */
  private async loadUsers(): Promise<void> {
    try {
      const usersFile = path.join(this.dataPath, 'users.json');
      if (await fs.pathExists(usersFile)) {
        const data = await fs.readFile(usersFile, 'utf8');
        const users = JSON.parse(data);
        
        this.users.clear();
        for (const user of users) {
          this.users.set(user.id, user);
        }
      } else {
        // Create default admin user
        await this.createDefaultAdminUser();
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  }

  /**
   * Create default admin user
   */
  private async createDefaultAdminUser(): Promise<void> {
    const adminUser: User = {
      id: this.generateId(),
      username: 'admin',
      email: 'admin@atulya-panel.com',
      firstName: 'System',
      lastName: 'Administrator',
      role: this.roles.get('super_admin')!,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      passwordChangedAt: new Date(),
      twoFactorEnabled: false,
      backupCodes: [],
      permissions: Array.from(this.permissions.values()),
      preferences: {
        theme: 'auto',
        language: 'en',
        timezone: 'UTC',
        dateFormat: 'YYYY-MM-DD',
        timeFormat: '24h',
        notifications: {
          email: true,
          push: false,
          sms: false,
          categories: ['system', 'security', 'backup'],
        },
        dashboard: {
          widgets: ['system_status', 'recent_activity', 'resource_usage'],
          layout: 'default',
        },
        security: {
          sessionTimeout: 60,
          requirePasswordChange: false,
          passwordChangeInterval: 90,
        },
      },
      quota: {
        diskSpace: { used: 0, limit: 0, unlimited: true },
        bandwidth: { used: 0, limit: 0, unlimited: true, resetDate: new Date() },
        domains: { used: 0, limit: 0, unlimited: true },
        databases: { used: 0, limit: 0, unlimited: true },
        emailAccounts: { used: 0, limit: 0, unlimited: true },
        ftpAccounts: { used: 0, limit: 0, unlimited: true },
      },
      statistics: {
        totalLogins: 0,
        lastLogin: new Date(),
        totalSessions: 0,
        activeSessions: 0,
        totalRequests: 0,
        totalErrors: 0,
        totalBandwidth: 0,
        totalDiskUsage: 0,
        averageSessionDuration: 0,
        mostUsedFeatures: [],
        loginHistory: [],
      },
    };

    this.users.set(adminUser.id, adminUser);
    await this.saveUsers();
  }

  /**
   * Save users
   */
  private async saveUsers(): Promise<void> {
    try {
      const usersFile = path.join(this.dataPath, 'users.json');
      const data = Array.from(this.users.values());
      await fs.writeFile(usersFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save users:', error);
    }
  }

  /**
   * Load groups
   */
  private async loadGroups(): Promise<void> {
    try {
      const groupsFile = path.join(this.configPath, 'groups.json');
      if (await fs.pathExists(groupsFile)) {
        const data = await fs.readFile(groupsFile, 'utf8');
        const groups = JSON.parse(data);
        
        this.groups.clear();
        for (const group of groups) {
          this.groups.set(group.id, group);
        }
      }
    } catch (error) {
      console.error('Failed to load groups:', error);
    }
  }

  /**
   * Save groups
   */
  private async saveGroups(): Promise<void> {
    try {
      const groupsFile = path.join(this.configPath, 'groups.json');
      const data = Array.from(this.groups.values());
      await fs.writeFile(groupsFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save groups:', error);
    }
  }

  /**
   * Load sessions
   */
  private async loadSessions(): Promise<void> {
    try {
      const sessionsFile = path.join(this.dataPath, 'sessions.json');
      if (await fs.pathExists(sessionsFile)) {
        const data = await fs.readFile(sessionsFile, 'utf8');
        const sessions = JSON.parse(data);
        
        this.sessions.clear();
        for (const session of sessions) {
          this.sessions.set(session.id, session);
        }
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  }

  /**
   * Save sessions
   */
  private async saveSessions(): Promise<void> {
    try {
      const sessionsFile = path.join(this.dataPath, 'sessions.json');
      const data = Array.from(this.sessions.values());
      await fs.writeFile(sessionsFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save sessions:', error);
    }
  }

  /**
   * Load password policy
   */
  private async loadPasswordPolicy(): Promise<void> {
    try {
      const policyFile = path.join(this.configPath, 'password-policy.json');
      if (await fs.pathExists(policyFile)) {
        const data = await fs.readFile(policyFile, 'utf8');
        this.passwordPolicy = { ...this.passwordPolicy, ...JSON.parse(data) };
      }
    } catch (error) {
      console.error('Failed to load password policy:', error);
    }
  }

  /**
   * Save password policy
   */
  private async savePasswordPolicy(): Promise<void> {
    try {
      const policyFile = path.join(this.configPath, 'password-policy.json');
      await fs.writeFile(policyFile, JSON.stringify(this.passwordPolicy, null, 2));
    } catch (error) {
      console.error('Failed to save password policy:', error);
    }
  }

  /**
   * Create user
   */
  async createUser(userData: {
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    roleId: string;
    password: string;
    preferences?: Partial<UserPreferences>;
    quota?: Partial<UserQuota>;
  }): Promise<User> {
    try {
      // Validate username
      if (this.users.has(userData.username)) {
        throw new Error('Username already exists');
      }

      // Validate email
      const existingUser = Array.from(this.users.values()).find(u => u.email === userData.email);
      if (existingUser) {
        throw new Error('Email already exists');
      }

      // Validate role
      const role = this.roles.get(userData.roleId);
      if (!role) {
        throw new Error('Invalid role');
      }

      // Validate password
      this.validatePassword(userData.password);

      // Hash password
      const hashedPassword = await this.hashPassword(userData.password);

      // Create user
      const user: User = {
        id: this.generateId(),
        username: userData.username,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        passwordChangedAt: new Date(),
        twoFactorEnabled: false,
        backupCodes: [],
        permissions: role.permissions,
        preferences: {
          theme: 'auto',
          language: 'en',
          timezone: 'UTC',
          dateFormat: 'YYYY-MM-DD',
          timeFormat: '24h',
          notifications: {
            email: true,
            push: false,
            sms: false,
            categories: ['system', 'security', 'backup'],
          },
          dashboard: {
            widgets: ['system_status', 'recent_activity', 'resource_usage'],
            layout: 'default',
          },
          security: {
            sessionTimeout: 60,
            requirePasswordChange: false,
            passwordChangeInterval: 90,
          },
          ...userData.preferences,
        },
        quota: {
          diskSpace: { used: 0, limit: 0, unlimited: true },
          bandwidth: { used: 0, limit: 0, unlimited: true, resetDate: new Date() },
          domains: { used: 0, limit: 0, unlimited: true },
          databases: { used: 0, limit: 0, unlimited: true },
          emailAccounts: { used: 0, limit: 0, unlimited: true },
          ftpAccounts: { used: 0, limit: 0, unlimited: true },
          ...userData.quota,
        },
        statistics: {
          totalLogins: 0,
          lastLogin: new Date(),
          totalSessions: 0,
          activeSessions: 0,
          totalRequests: 0,
          totalErrors: 0,
          totalBandwidth: 0,
          totalDiskUsage: 0,
          averageSessionDuration: 0,
          mostUsedFeatures: [],
          loginHistory: [],
        },
      };

      this.users.set(user.id, user);
      await this.saveUsers();

      // Store hashed password separately
      await this.storePassword(user.id, hashedPassword);

      return user;
    } catch (error) {
      console.error('Failed to create user:', error);
      throw new Error(`Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update user
   */
  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    try {
      const user = this.users.get(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Update user
      Object.assign(user, updates);
      user.updatedAt = new Date();

      this.users.set(userId, user);
      await this.saveUsers();

      return user;
    } catch (error) {
      console.error('Failed to update user:', error);
      throw new Error(`Failed to update user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete user
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      const user = this.users.get(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check if user is system user
      if (user.role.isSystem) {
        throw new Error('Cannot delete system user');
      }

      // Remove user
      this.users.delete(userId);

      // Remove password
      await this.removePassword(userId);

      // Remove sessions
      const userSessions = Array.from(this.sessions.values()).filter(s => s.userId === userId);
      for (const session of userSessions) {
        this.sessions.delete(session.id);
      }

      await this.saveUsers();
      await this.saveSessions();
    } catch (error) {
      console.error('Failed to delete user:', error);
      throw new Error(`Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user by ID
   */
  getUser(userId: string): User | undefined {
    return this.users.get(userId);
  }

  /**
   * Get user by username
   */
  getUserByUsername(username: string): User | undefined {
    return Array.from(this.users.values()).find(u => u.username === username);
  }

  /**
   * Get user by email
   */
  getUserByEmail(email: string): User | undefined {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  /**
   * Get all users
   */
  getUsers(): User[] {
    return Array.from(this.users.values());
  }

  /**
   * Get users by role
   */
  getUsersByRole(roleId: string): User[] {
    return Array.from(this.users.values()).filter(u => u.role.id === roleId);
  }

  /**
   * Get users by status
   */
  getUsersByStatus(status: User['status']): User[] {
    return Array.from(this.users.values()).filter(u => u.status === status);
  }

  /**
   * Authenticate user
   */
  async authenticateUser(username: string, password: string): Promise<User | null> {
    try {
      const user = this.getUserByUsername(username);
      if (!user || user.status !== 'active') {
        return null;
      }

      const hashedPassword = await this.getPassword(user.id);
      if (!hashedPassword) {
        return null;
      }

      const isValid = await this.verifyPassword(password, hashedPassword);
      if (!isValid) {
        return null;
      }

      // Update login statistics
      user.statistics.totalLogins++;
      user.statistics.lastLogin = new Date();
      user.updatedAt = new Date();

      this.users.set(user.id, user);
      await this.saveUsers();

      return user;
    } catch (error) {
      console.error('Failed to authenticate user:', error);
      return null;
    }
  }

  /**
   * Change password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    try {
      const user = this.users.get(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const hashedPassword = await this.getPassword(userId);
      if (!hashedPassword) {
        throw new Error('Current password not found');
      }

      const isValid = await this.verifyPassword(currentPassword, hashedPassword);
      if (!isValid) {
        throw new Error('Current password is incorrect');
      }

      // Validate new password
      this.validatePassword(newPassword);

      // Hash new password
      const newHashedPassword = await this.hashPassword(newPassword);

      // Update password
      await this.storePassword(userId, newHashedPassword);
      user.passwordChangedAt = new Date();
      user.updatedAt = new Date();

      this.users.set(userId, user);
      await this.saveUsers();
    } catch (error) {
      console.error('Failed to change password:', error);
      throw new Error(`Failed to change password: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Reset password
   */
  async resetPassword(userId: string, newPassword: string): Promise<void> {
    try {
      const user = this.users.get(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Validate new password
      this.validatePassword(newPassword);

      // Hash new password
      const hashedPassword = await this.hashPassword(newPassword);

      // Update password
      await this.storePassword(userId, hashedPassword);
      user.passwordChangedAt = new Date();
      user.updatedAt = new Date();

      this.users.set(userId, user);
      await this.saveUsers();
    } catch (error) {
      console.error('Failed to reset password:', error);
      throw new Error(`Failed to reset password: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate password
   */
  private validatePassword(password: string): void {
    if (password.length < this.passwordPolicy.minLength) {
      throw new Error(`Password must be at least ${this.passwordPolicy.minLength} characters long`);
    }

    if (password.length > this.passwordPolicy.maxLength) {
      throw new Error(`Password must be no more than ${this.passwordPolicy.maxLength} characters long`);
    }

    if (this.passwordPolicy.requireUppercase && !/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }

    if (this.passwordPolicy.requireLowercase && !/[a-z]/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter');
    }

    if (this.passwordPolicy.requireNumbers && !/\d/.test(password)) {
      throw new Error('Password must contain at least one number');
    }

    if (this.passwordPolicy.requireSymbols && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      throw new Error('Password must contain at least one symbol');
    }
  }

  /**
   * Hash password
   */
  private async hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(16);
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512');
    return salt.toString('hex') + ':' + hash.toString('hex');
  }

  /**
   * Verify password
   */
  private async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    const [salt, hash] = hashedPassword.split(':');
    const saltBuffer = Buffer.from(salt, 'hex');
    const hashBuffer = Buffer.from(hash, 'hex');
    const derivedHash = crypto.pbkdf2Sync(password, saltBuffer, 100000, 64, 'sha512');
    return crypto.timingSafeEqual(hashBuffer, derivedHash);
  }

  /**
   * Store password
   */
  private async storePassword(userId: string, hashedPassword: string): Promise<void> {
    const passwordFile = path.join(this.dataPath, 'passwords', `${userId}.txt`);
    await fs.ensureDir(path.dirname(passwordFile));
    await fs.writeFile(passwordFile, hashedPassword);
  }

  /**
   * Get password
   */
  private async getPassword(userId: string): Promise<string | null> {
    try {
      const passwordFile = path.join(this.dataPath, 'passwords', `${userId}.txt`);
      if (await fs.pathExists(passwordFile)) {
        return await fs.readFile(passwordFile, 'utf8');
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Remove password
   */
  private async removePassword(userId: string): Promise<void> {
    try {
      const passwordFile = path.join(this.dataPath, 'passwords', `${userId}.txt`);
      if (await fs.pathExists(passwordFile)) {
        await fs.remove(passwordFile);
      }
    } catch (error) {
      // Ignore errors
    }
  }

  /**
   * Create session
   */
  async createSession(userId: string, ip: string, userAgent: string): Promise<UserSession> {
    try {
      const session: UserSession = {
        id: this.generateId(),
        userId,
        token: this.generateToken(),
        ip,
        userAgent,
        createdAt: new Date(),
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        isActive: true,
      };

      this.sessions.set(session.id, session);
      await this.saveSessions();

      return session;
    } catch (error) {
      console.error('Failed to create session:', error);
      throw new Error(`Failed to create session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get session
   */
  getSession(sessionId: string): UserSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Update session
   */
  async updateSession(sessionId: string, updates: Partial<UserSession>): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      Object.assign(session, updates);
      await this.saveSessions();
    }
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    await this.saveSessions();
  }

  /**
   * Get user sessions
   */
  getUserSessions(userId: string): UserSession[] {
    return Array.from(this.sessions.values()).filter(s => s.userId === userId);
  }

  /**
   * Get active sessions
   */
  getActiveSessions(): UserSession[] {
    return Array.from(this.sessions.values()).filter(s => s.isActive && s.expiresAt > new Date());
  }

  /**
   * Clean expired sessions
   */
  async cleanExpiredSessions(): Promise<void> {
    const now = new Date();
    const expiredSessions = Array.from(this.sessions.values()).filter(s => s.expiresAt <= now);
    
    for (const session of expiredSessions) {
      this.sessions.delete(session.id);
    }

    if (expiredSessions.length > 0) {
      await this.saveSessions();
    }
  }

  /**
   * Get roles
   */
  getRoles(): UserRole[] {
    return Array.from(this.roles.values());
  }

  /**
   * Get role by ID
   */
  getRole(roleId: string): UserRole | undefined {
    return this.roles.get(roleId);
  }

  /**
   * Get permissions
   */
  getPermissions(): Permission[] {
    return Array.from(this.permissions.values());
  }

  /**
   * Get permission by ID
   */
  getPermission(permissionId: string): Permission | undefined {
    return this.permissions.get(permissionId);
  }

  /**
   * Get groups
   */
  getGroups(): UserGroup[] {
    return Array.from(this.groups.values());
  }

  /**
   * Get group by ID
   */
  getGroup(groupId: string): UserGroup | undefined {
    return this.groups.get(groupId);
  }

  /**
   * Get password policy
   */
  getPasswordPolicy(): PasswordPolicy {
    return { ...this.passwordPolicy };
  }

  /**
   * Update password policy
   */
  async updatePasswordPolicy(policy: Partial<PasswordPolicy>): Promise<void> {
    this.passwordPolicy = { ...this.passwordPolicy, ...policy };
    await this.savePasswordPolicy();
  }

  /**
   * Generate token
   */
  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  async setUserQuota(userId: string, quota: { diskMB: number; bandwidthGB: number }) {
    // stub persistence; integrate with DB
  }

  async getUserQuota(userId: string) {
    return { diskMB: 10240, bandwidthGB: 100 }; // default stub
  }
}