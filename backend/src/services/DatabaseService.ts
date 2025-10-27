import { prisma } from '../server.js';
import { DatabaseProvider } from '../providers/DatabaseProvider.js';
import { env } from '../config/env.js';
import type { CreateDatabaseOptions, DatabaseInfo } from '../providers/DatabaseProvider.js';
import type { User } from '@prisma/client';

export interface CreateDatabaseRequest {
  name: string;
  username?: string;
  password?: string;
  siteId?: string;
}

export interface DatabaseWithSite {
  id: string;
  name: string;
  username: string;
  password: string;
  size: bigint;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  siteId: string;
  site?: {
    id: string;
    domain: string;
  };
}

export class DatabaseService {
  private provider: DatabaseProvider;

  constructor() {
    this.provider = new DatabaseProvider();
  }

  /**
   * Test database provider connection
   */
  async testConnection(): Promise<boolean> {
    try {
      return await this.provider.testConnection();
    } catch (error) {
      console.error('Database provider connection test failed:', error);
      return false;
    }
  }

  /**
   * Create a new database
   */
  async createDatabase(user: User, request: CreateDatabaseRequest): Promise<DatabaseWithSite> {
    try {
      // Validate database name
      if (!this.isValidDatabaseName(request.name)) {
        throw new Error('Invalid database name. Only alphanumeric characters and underscores are allowed.');
      }

      // Check if database already exists in our system
      const existingDb = await prisma.database.findFirst({
        where: {
          OR: [
            { name: request.name },
            { username: request.username }
          ]
        }
      });

      if (existingDb) {
        throw new Error('Database or username already exists');
      }

      // Create database via provider
      const dbInfo = await this.provider.createDatabase({
        name: request.name,
        username: request.username,
        password: request.password,
      });

      // Save to our database
      const database = await prisma.database.create({
        data: {
          name: dbInfo.name,
          username: dbInfo.username,
          password: dbInfo.password,
          size: BigInt(dbInfo.size),
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

      return database as DatabaseWithSite;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all databases for a user
   */
  async getDatabases(user: User): Promise<DatabaseWithSite[]> {
    try {
      const databases = await prisma.database.findMany({
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

      return databases as DatabaseWithSite[];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get database by ID
   */
  async getDatabase(user: User, id: string): Promise<DatabaseWithSite | null> {
    try {
      const database = await prisma.database.findFirst({
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

      return database as DatabaseWithSite | null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update database
   */
  async updateDatabase(user: User, id: string, updates: Partial<{
    isActive: boolean;
  }>): Promise<DatabaseWithSite> {
    try {
      const database = await prisma.database.updateMany({
        where: {
          id,
          userId: user.id,
        },
        data: updates,
      });

      if (database.count === 0) {
        throw new Error('Database not found or access denied');
      }

      return await this.getDatabase(user, id) as DatabaseWithSite;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete database
   */
  async deleteDatabase(user: User, id: string): Promise<void> {
    try {
      const database = await prisma.database.findFirst({
        where: {
          id,
          userId: user.id,
        }
      });

      if (!database) {
        throw new Error('Database not found or access denied');
      }

      // Delete from MySQL
      await this.provider.deleteDatabase(database.name, database.username);

      // Delete from our database
      await prisma.database.delete({
        where: {
          id: database.id,
        }
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get database information from MySQL
   */
  async getDatabaseInfo(user: User, id: string): Promise<DatabaseInfo | null> {
    try {
      const database = await prisma.database.findFirst({
        where: {
          id,
          userId: user.id,
        }
      });

      if (!database) {
        throw new Error('Database not found or access denied');
      }

      const info = await this.provider.getDatabaseInfo(database.name);
      
      if (info) {
        // Update size in our database
        await prisma.database.update({
          where: { id: database.id },
          data: { size: BigInt(info.size) }
        });
      }

      return info;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Execute SQL query on database
   */
  async executeQuery(user: User, id: string, query: string): Promise<any> {
    try {
      const database = await prisma.database.findFirst({
        where: {
          id,
          userId: user.id,
        }
      });

      if (!database) {
        throw new Error('Database not found or access denied');
      }

      // Validate query (basic security check)
      if (!this.isSafeQuery(query)) {
        throw new Error('Query contains potentially dangerous operations');
      }

      const result = await this.provider.executeQuery(database.name, query);
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Backup database
   */
  async backupDatabase(user: User, id: string, outputPath: string): Promise<void> {
    try {
      const database = await prisma.database.findFirst({
        where: {
          id,
          userId: user.id,
        }
      });

      if (!database) {
        throw new Error('Database not found or access denied');
      }

      await this.provider.backupDatabase(database.name, outputPath);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Restore database
   */
  async restoreDatabase(user: User, id: string, backupPath: string): Promise<void> {
    try {
      const database = await prisma.database.findFirst({
        where: {
          id,
          userId: user.id,
        }
      });

      if (!database) {
        throw new Error('Database not found or access denied');
      }

      await this.provider.restoreDatabase(database.name, backupPath);

      // Update database info after restore
      const info = await this.provider.getDatabaseInfo(database.name);
      if (info) {
        await prisma.database.update({
          where: { id: database.id },
          data: { size: BigInt(info.size) }
        });
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  async getStatistics(user: User): Promise<{
    totalDatabases: number;
    totalSize: number;
    activeDatabases: number;
  }> {
    try {
      const stats = await prisma.database.aggregate({
        where: {
          userId: user.id,
        },
        _count: {
          id: true,
        },
        _sum: {
          size: true,
        },
      });

      const activeStats = await prisma.database.count({
        where: {
          userId: user.id,
          isActive: true,
        }
      });

      return {
        totalDatabases: stats._count.id || 0,
        totalSize: Number(stats._sum.size || 0),
        activeDatabases: activeStats,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all databases (admin only)
   */
  async getAllDatabases(): Promise<DatabaseWithSite[]> {
    try {
      const databases = await prisma.database.findMany({
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

      return databases as DatabaseWithSite[];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Validate database name
   */
  private isValidDatabaseName(name: string): boolean {
    // MySQL database name rules
    const regex = /^[a-zA-Z][a-zA-Z0-9_]*$/;
    return regex.test(name) && name.length <= 64;
  }

  /**
   * Check if query is safe to execute
   */
  private isSafeQuery(query: string): boolean {
    const dangerousKeywords = [
      'DROP DATABASE',
      'DROP USER',
      'CREATE USER',
      'GRANT',
      'REVOKE',
      'FLUSH',
      'SHUTDOWN',
      'RESTART',
      'SET PASSWORD',
      'ALTER USER',
    ];

    const upperQuery = query.toUpperCase();
    return !dangerousKeywords.some(keyword => upperQuery.includes(keyword));
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    await this.provider.close();
  }
}
