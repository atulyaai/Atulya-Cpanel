import mysql from 'mysql2/promise';
import { randomBytes } from 'crypto';
import { env } from '../config/env.js';

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
}

export interface DatabaseInfo {
  name: string;
  username: string;
  password: string;
  size: number;
  tables: number;
  users: number;
}

export interface CreateDatabaseOptions {
  name: string;
  username?: string;
  password?: string;
  charset?: string;
  collation?: string;
}

export interface DatabaseUser {
  username: string;
  password: string;
  privileges: string[];
}

export class DatabaseProvider {
  private config: DatabaseConfig;
  private connection: mysql.Connection | null = null;

  constructor(config?: Partial<DatabaseConfig>) {
    this.config = {
      host: config?.host || env.MYSQL_HOST,
      port: config?.port || env.MYSQL_PORT,
      user: config?.user || env.MYSQL_ROOT_USER,
      password: config?.password || env.MYSQL_ROOT_PASSWORD,
    };
  }

  /**
   * Get database connection
   */
  private async getConnection(): Promise<mysql.Connection> {
    if (!this.connection) {
      this.connection = await mysql.createConnection({
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password,
        charset: 'utf8mb4',
      });
    }
    return this.connection;
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }
  }

  /**
   * Test database connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const connection = await this.getConnection();
      await connection.ping();
      return true;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }

  /**
   * Validate database name to prevent SQL injection
   */
  private isValidDatabaseName(name: string): boolean {
    // Only allow alphanumeric characters and underscores
    // Must start with a letter and be 1-64 characters long
    const regex = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/;
    return regex.test(name) && name.length >= 1 && name.length <= 64;
  }

  /**
   * Generate secure random password
   */
  private generatePassword(length: number = 16): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    const randomValues = randomBytes(length);
    
    for (let i = 0; i < length; i++) {
      password += charset[randomValues[i] % charset.length];
    }
    
    return password;
  }

  /**
   * Create a new database
   */
  async createDatabase(options: CreateDatabaseOptions): Promise<DatabaseInfo> {
    const connection = await this.getConnection();
    
    const dbName = options.name;
    const username = options.username || `user_${dbName.replace(/[^a-zA-Z0-9_]/g, '_')}`;
    const password = options.password || this.generatePassword();
    const charset = options.charset || 'utf8mb4';
    const collation = options.collation || 'utf8mb4_unicode_ci';

    try {
      // Validate database name to prevent SQL injection
      if (!this.isValidDatabaseName(dbName)) {
        throw new Error('Invalid database name');
      }

      // Create database with parameterized query
      await connection.execute(
        `CREATE DATABASE IF NOT EXISTS ?? CHARACTER SET ? COLLATE ?`,
        [dbName, charset, collation]
      );

      // Create user
      await connection.execute(
        `CREATE USER IF NOT EXISTS ?@'localhost' IDENTIFIED BY ?`,
        [username, password]
      );

      // Grant privileges with parameterized query
      await connection.execute(
        `GRANT ALL PRIVILEGES ON ??.* TO ?@'localhost'`,
        [dbName, username]
      );

      // Flush privileges
      await connection.execute('FLUSH PRIVILEGES');

      // Get database size
      const size = await this.getDatabaseSize(dbName);
      const tables = await this.getTableCount(dbName);

      return {
        name: dbName,
        username,
        password,
        size,
        tables: 0, // New database has no tables
        users: 1,
      };
    } catch (error) {
      console.error('Failed to create database:', error);
      throw new Error(`Failed to create database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a database
   */
  async deleteDatabase(name: string, username?: string): Promise<void> {
    const connection = await this.getConnection();

    try {
      // Validate database name to prevent SQL injection
      if (!this.isValidDatabaseName(name)) {
        throw new Error('Invalid database name');
      }

      // Drop database with parameterized query
      await connection.execute(`DROP DATABASE IF EXISTS ??`, [name]);

      // Drop user if provided
      if (username) {
        await connection.execute(`DROP USER IF EXISTS ?@'localhost'`, [username]);
        await connection.execute('FLUSH PRIVILEGES');
      }
    } catch (error) {
      console.error('Failed to delete database:', error);
      throw new Error(`Failed to delete database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List all databases
   */
  async listDatabases(): Promise<string[]> {
    const connection = await this.getConnection();

    try {
      const [rows] = await connection.execute(
        "SHOW DATABASES WHERE `Database` NOT IN ('information_schema', 'performance_schema', 'mysql', 'sys')"
      );

      return (rows as any[]).map(row => row.Database);
    } catch (error) {
      console.error('Failed to list databases:', error);
      throw new Error(`Failed to list databases: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get database information
   */
  async getDatabaseInfo(name: string): Promise<DatabaseInfo | null> {
    const connection = await this.getConnection();

    try {
      // Check if database exists
      const [dbRows] = await connection.execute(
        "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
        [name]
      );

      if ((dbRows as any[]).length === 0) {
        return null;
      }

      // Get database size
      const size = await this.getDatabaseSize(name);
      
      // Get table count
      const tables = await this.getTableCount(name);

      // Get users with access to this database
      const [userRows] = await connection.execute(
        `SELECT COUNT(DISTINCT GRANTEE) as user_count 
         FROM information_schema.USER_PRIVILEGES 
         WHERE PRIVILEGE_TYPE = 'SELECT' 
         AND TABLE_SCHEMA = ?`,
        [name]
      );

      const users = (userRows as any[])[0]?.user_count || 0;

      return {
        name,
        username: '', // We don't store the actual username in the database
        password: '', // We don't store passwords in the database
        size,
        tables,
        users,
      };
    } catch (error) {
      console.error('Failed to get database info:', error);
      throw new Error(`Failed to get database info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get database size in bytes
   */
  private async getDatabaseSize(name: string): Promise<number> {
    const connection = await this.getConnection();

    try {
      const [rows] = await connection.execute(
        `SELECT 
           ROUND(SUM(data_length + index_length), 0) AS size 
         FROM information_schema.tables 
         WHERE table_schema = ?`,
        [name]
      );

      return (rows as any[])[0]?.size || 0;
    } catch (error) {
      console.error('Failed to get database size:', error);
      return 0;
    }
  }

  /**
   * Get table count in database
   */
  private async getTableCount(name: string): Promise<number> {
    const connection = await this.getConnection();

    try {
      const [rows] = await connection.execute(
        `SELECT COUNT(*) as count 
         FROM information_schema.tables 
         WHERE table_schema = ?`,
        [name]
      );

      return (rows as any[])[0]?.count || 0;
    } catch (error) {
      console.error('Failed to get table count:', error);
      return 0;
    }
  }

  /**
   * Create database user
   */
  async createUser(username: string, password: string, database?: string): Promise<void> {
    const connection = await this.getConnection();

    try {
      // Create user
      await connection.execute(
        `CREATE USER IF NOT EXISTS ?@'localhost' IDENTIFIED BY ?`,
        [username, password]
      );

      // Grant privileges if database specified
      if (database) {
        await connection.execute(
          `GRANT ALL PRIVILEGES ON \`${database}\`.* TO ?@'localhost'`,
          [username]
        );
      }

      // Flush privileges
      await connection.execute('FLUSH PRIVILEGES');
    } catch (error) {
      console.error('Failed to create user:', error);
      throw new Error(`Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete database user
   */
  async deleteUser(username: string): Promise<void> {
    const connection = await this.getConnection();

    try {
      await connection.execute(`DROP USER IF EXISTS ?@'localhost'`, [username]);
      await connection.execute('FLUSH PRIVILEGES');
    } catch (error) {
      console.error('Failed to delete user:', error);
      throw new Error(`Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List database users
   */
  async listUsers(): Promise<string[]> {
    const connection = await this.getConnection();

    try {
      const [rows] = await connection.execute(
        `SELECT DISTINCT USER as username 
         FROM mysql.user 
         WHERE USER NOT IN ('root', 'mysql.session', 'mysql.sys', 'mysql.infoschema')`
      );

      return (rows as any[]).map(row => row.username);
    } catch (error) {
      console.error('Failed to list users:', error);
      throw new Error(`Failed to list users: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute SQL query
   */
  async executeQuery(database: string, query: string): Promise<any> {
    const connection = await this.getConnection();

    try {
      // Use the specified database
      await connection.execute(`USE \`${database}\``);
      
      // Execute query
      const [rows] = await connection.execute(query);
      return rows;
    } catch (error) {
      console.error('Failed to execute query:', error);
      throw new Error(`Failed to execute query: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Backup database
   */
  async backupDatabase(name: string, outputPath: string): Promise<void> {
    const { spawn } = await import('child_process');
    const { promisify } = await import('util');

    return new Promise((resolve, reject) => {
      const mysqldump = spawn('mysqldump', [
        '--host', this.config.host,
        '--port', this.config.port.toString(),
        '--user', this.config.user,
        `--password=${this.config.password}`,
        '--single-transaction',
        '--routines',
        '--triggers',
        '--lock-tables=false',
        name
      ]);

      const fs = require('fs');
      const writeStream = fs.createWriteStream(outputPath);

      mysqldump.stdout.pipe(writeStream);

      mysqldump.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`mysqldump exited with code ${code}`));
        }
      });

      mysqldump.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Restore database
   */
  async restoreDatabase(name: string, backupPath: string): Promise<void> {
    const { spawn } = await import('child_process');

    return new Promise((resolve, reject) => {
      const mysql = spawn('mysql', [
        '--host', this.config.host,
        '--port', this.config.port.toString(),
        '--user', this.config.user,
        `--password=${this.config.password}`,
        name
      ]);

      const fs = require('fs');
      const readStream = fs.createReadStream(backupPath);

      readStream.pipe(mysql.stdin);

      mysql.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`mysql restore exited with code ${code}`));
        }
      });

      mysql.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Get database statistics
   */
  async getStatistics(): Promise<{
    totalDatabases: number;
    totalSize: number;
    totalTables: number;
  }> {
    const connection = await this.getConnection();

    try {
      const [rows] = await connection.execute(
        `SELECT 
           COUNT(DISTINCT table_schema) as total_databases,
           ROUND(SUM(data_length + index_length), 0) as total_size,
           COUNT(*) as total_tables
         FROM information_schema.tables 
         WHERE table_schema NOT IN ('information_schema', 'performance_schema', 'mysql', 'sys')`
      );

      const result = (rows as any[])[0];
      return {
        totalDatabases: result?.total_databases || 0,
        totalSize: result?.total_size || 0,
        totalTables: result?.total_tables || 0,
      };
    } catch (error) {
      console.error('Failed to get statistics:', error);
      return {
        totalDatabases: 0,
        totalSize: 0,
        totalTables: 0,
      };
    }
  }
}
