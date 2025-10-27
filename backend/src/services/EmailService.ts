import { prisma } from '../server.js';
import { EmailProvider } from '../providers/EmailProvider.js';
import type { EmailAccount, EmailDomain, EmailQuota, EmailStats } from '../providers/EmailProvider.js';
import type { User } from '@prisma/client';

export interface CreateEmailAccountRequest {
  email: string;
  password?: string;
  quota?: number;
  forwardTo?: string;
  catchAll?: boolean;
  siteId?: string;
}

export interface CreateEmailDomainRequest {
  domain: string;
  siteId?: string;
}

export interface EmailAccountWithSite {
  id: string;
  email: string;
  password: string;
  quota: bigint;
  isActive: boolean;
  forwardTo?: string;
  catchAll: boolean;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  siteId?: string;
  site?: {
    id: string;
    domain: string;
  };
}

export class EmailService {
  private provider: EmailProvider;

  constructor() {
    this.provider = new EmailProvider();
  }

  /**
   * Test email server connection
   */
  async testConnection(): Promise<boolean> {
    try {
      return await this.provider.testConfiguration();
    } catch (error) {
      return false;
    }
  }

  /**
   * Install email server
   */
  async installEmailServer(): Promise<void> {
    try {
      await this.provider.installEmailServer();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create email domain
   */
  async createDomain(user: User, request: CreateEmailDomainRequest): Promise<EmailDomain> {
    try {
      // Create domain via provider
      const domainInfo = await this.provider.createDomain(request.domain);
      
      // Save to our database
      await prisma.domain.create({
        data: {
          name: request.domain,
          type: 'PRIMARY',
          sslStatus: 'not_issued',
          siteId: request.siteId || null,
        }
      });

      return domainInfo;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete email domain
   */
  async deleteDomain(user: User, domain: string): Promise<void> {
    try {
      // Delete from email server
      await this.provider.deleteDomain(domain);
      
      // Delete from our database
      await prisma.domain.deleteMany({
        where: {
          name: domain,
          userId: user.id,
          type: 'EMAIL',
        }
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * List email domains
   */
  async listDomains(user: User): Promise<EmailDomain[]> {
    try {
      const domains = await prisma.domain.findMany({
        where: {
          userId: user.id,
          type: 'EMAIL',
        }
      });

      return domains.map(domain => ({
        domain: domain.name,
        isActive: true,
        mxRecords: [`10 mail.${domain.name}`],
        spfRecord: `v=spf1 mx ~all`,
        dkimSelector: 'default',
      }));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create email account
   */
  async createAccount(user: User, request: CreateEmailAccountRequest): Promise<EmailAccountWithSite> {
    try {
      // Validate email format
      if (!this.isValidEmail(request.email)) {
        throw new Error('Invalid email address format');
      }

      // Check if account already exists
      const existingAccount = await prisma.emailAccount.findFirst({
        where: {
          email: request.email,
        }
      });

      if (existingAccount) {
        throw new Error('Email account already exists');
      }

      // Generate password if not provided
      const password = request.password || this.generatePassword();

      // Create account via provider
      const accountInfo = await this.provider.createAccount({
        email: request.email,
        password,
        quota: request.quota || 1000,
        domain: request.email.split('@')[1],
        isActive: true,
        forwardTo: request.forwardTo,
        catchAll: request.catchAll || false,
      });

      // Save to our database
      const emailAccount = await prisma.emailAccount.create({
        data: {
          email: request.email,
          password,
          quota: BigInt(request.quota || 1000),
          isActive: true,
          forwardTo: request.forwardTo,
          catchAll: request.catchAll || false,
          userId: user.id,
          siteId: request.siteId || null,
        },
        include: {
          site: {
            select: {
              id: true,
              domain: true,
            }
          }
        }
      });

      return emailAccount as EmailAccountWithSite;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all email accounts for a user
   */
  async getAccounts(user: User): Promise<EmailAccountWithSite[]> {
    try {
      const accounts = await prisma.emailAccount.findMany({
        where: {
          userId: user.id,
        },
        include: {
          site: {
            select: {
              id: true,
              domain: true,
            }
          }
        },
        orderBy: {
          createdAt: 'desc',
        }
      });

      return accounts as EmailAccountWithSite[];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get email account by ID
   */
  async getAccount(user: User, id: string): Promise<EmailAccountWithSite | null> {
    try {
      const account = await prisma.emailAccount.findFirst({
        where: {
          id,
          userId: user.id,
        },
        include: {
          site: {
            select: {
              id: true,
              domain: true,
            }
          }
        }
      });

      return account as EmailAccountWithSite | null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update email account
   */
  async updateAccount(user: User, id: string, updates: Partial<{
    password: string;
    quota: number;
    isActive: boolean;
    forwardTo: string;
    catchAll: boolean;
  }>): Promise<EmailAccountWithSite> {
    try {
      const account = await prisma.emailAccount.findFirst({
        where: {
          id,
          userId: user.id,
        }
      });

      if (!account) {
        throw new Error('Email account not found or access denied');
      }

      // Update via provider
      if (updates.password || updates.quota || updates.forwardTo || updates.catchAll) {
        await this.provider.updateAccount(account.email, {
          password: updates.password,
          quota: updates.quota,
          forwardTo: updates.forwardTo,
          catchAll: updates.catchAll,
        });
      }

      // Update in our database
      const updatedAccount = await prisma.emailAccount.updateMany({
        where: {
          id,
          userId: user.id,
        },
        data: {
          password: updates.password || account.password,
          quota: updates.quota ? BigInt(updates.quota) : account.quota,
          isActive: updates.isActive !== undefined ? updates.isActive : account.isActive,
          forwardTo: updates.forwardTo,
          catchAll: updates.catchAll !== undefined ? updates.catchAll : account.catchAll,
        }
      });

      if (updatedAccount.count === 0) {
        throw new Error('Email account not found or access denied');
      }

      return await this.getAccount(user, id) as EmailAccountWithSite;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete email account
   */
  async deleteAccount(user: User, id: string): Promise<void> {
    try {
      const account = await prisma.emailAccount.findFirst({
        where: {
          id,
          userId: user.id,
        }
      });

      if (!account) {
        throw new Error('Email account not found or access denied');
      }

      // Delete from email server
      await this.provider.deleteAccount(account.email);

      // Delete from our database
      await prisma.emailAccount.delete({
        where: {
          id: account.id,
        }
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get email quota usage
   */
  async getQuotaUsage(user: User, id: string): Promise<EmailQuota> {
    try {
      const account = await prisma.emailAccount.findFirst({
        where: {
          id,
          userId: user.id,
        }
      });

      if (!account) {
        throw new Error('Email account not found or access denied');
      }

      const quota = await this.provider.getQuotaUsage(account.email);
      return quota;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get email server status
   */
  async getServerStatus(): Promise<{
    postfix: { active: boolean; running: boolean };
    dovecot: { active: boolean; running: boolean };
  }> {
    try {
      return await this.provider.getServerStatus();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get email statistics
   */
  async getStatistics(user: User): Promise<{
    totalAccounts: number;
    activeAccounts: number;
    totalQuota: number;
    usedQuota: number;
    domains: number;
  }> {
    try {
      const stats = await prisma.emailAccount.aggregate({
        where: {
          userId: user.id,
        },
        _count: {
          id: true,
        },
        _sum: {
          quota: true,
        },
      });

      const activeStats = await prisma.emailAccount.count({
        where: {
          userId: user.id,
          isActive: true,
        }
      });

      const domainStats = await prisma.domain.count({
        where: {
          userId: user.id,
          type: 'EMAIL',
        }
      });

      // Get actual used quota from email server
      const accounts = await this.getAccounts(user);
      let usedQuota = 0;
      for (const account of accounts) {
        try {
          const quota = await this.provider.getQuotaUsage(account.email);
          usedQuota += quota.used;
        } catch (error) {
          // Ignore errors for individual accounts
        }
      }

      return {
        totalAccounts: stats._count.id || 0,
        activeAccounts: activeStats,
        totalQuota: Number(stats._sum.quota || 0),
        usedQuota,
        domains: domainStats,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all email accounts (admin only)
   */
  async getAllAccounts(): Promise<EmailAccountWithSite[]> {
    try {
      const accounts = await prisma.emailAccount.findMany({
        include: {
          site: {
            select: {
              id: true,
              domain: true,
            }
          },
          user: {
            select: {
              id: true,
              username: true,
              email: true,
            }
          }
        },
        orderBy: {
          createdAt: 'desc',
        }
      });

      return accounts as EmailAccountWithSite[];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Validate email address format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Generate secure random password
   */
  private generatePassword(length: number = 16): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);
    
    for (let i = 0; i < length; i++) {
      password += charset[randomValues[i] % charset.length];
    }
    
    return password;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Cleanup any temporary files or connections
  }
}
