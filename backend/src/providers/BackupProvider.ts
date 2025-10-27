import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { createHash } from 'crypto';

const execAsync = promisify(exec);

export interface Backup {
  id: string;
  name: string;
  type: 'full' | 'incremental' | 'differential';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  size: number;
  compressedSize: number;
  createdAt: Date;
  completedAt?: Date;
  duration?: number;
  source: BackupSource;
  destination: BackupDestination;
  retention: BackupRetention;
  encryption: BackupEncryption;
  compression: BackupCompression;
  schedule?: BackupSchedule;
  logs: BackupLog[];
}

export interface BackupSource {
  type: 'filesystem' | 'database' | 'application' | 'system';
  path: string;
  includes: string[];
  excludes: string[];
  database?: {
    type: 'mysql' | 'postgresql' | 'sqlite';
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  };
}

export interface BackupDestination {
  type: 'local' | 's3' | 'ftp' | 'sftp' | 'azure' | 'gcp';
  path: string;
  credentials?: Record<string, any>;
  region?: string;
  bucket?: string;
}

export interface BackupRetention {
  days: number;
  weeks: number;
  months: number;
  years: number;
  maxBackups: number;
}

export interface BackupEncryption {
  enabled: boolean;
  algorithm: 'aes-256-cbc' | 'aes-256-gcm' | 'chacha20-poly1305';
  key?: string;
  keyFile?: string;
}

export interface BackupCompression {
  enabled: boolean;
  algorithm: 'gzip' | 'bzip2' | 'xz' | 'lz4';
  level: number;
}

export interface BackupSchedule {
  enabled: boolean;
  cron: string;
  timezone: string;
  lastRun?: Date;
  nextRun?: Date;
}

export interface BackupLog {
  timestamp: Date;
  level: 'info' | 'warning' | 'error';
  message: string;
  details?: any;
}

export interface BackupRestore {
  id: string;
  backupId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  destination: string;
  createdAt: Date;
  completedAt?: Date;
  logs: BackupLog[];
}

export class BackupProvider {
  private backups: Map<string, Backup>;
  private restores: Map<string, BackupRestore>;
  private backupPath: string;
  private tempPath: string;

  constructor() {
    this.backups = new Map();
    this.restores = new Map();
    this.backupPath = '/var/backups/atulya-panel';
    this.tempPath = '/tmp/atulya-panel-backups';
    
    this.initialize();
  }

  /**
   * Initialize backup provider
   */
  private async initialize(): Promise<void> {
    try {
      await fs.ensureDir(this.backupPath);
      await fs.ensureDir(this.tempPath);
      await this.loadBackups();
    } catch (error) {
      console.error('Failed to initialize backup provider:', error);
    }
  }

  /**
   * Load backups from storage
   */
  private async loadBackups(): Promise<void> {
    try {
      const backupFile = path.join(this.backupPath, 'backups.json');
      if (await fs.pathExists(backupFile)) {
        const data = await fs.readFile(backupFile, 'utf8');
        const backups = JSON.parse(data);
        
        this.backups.clear();
        for (const backup of backups) {
          this.backups.set(backup.id, backup);
        }
      }
    } catch (error) {
      console.error('Failed to load backups:', error);
    }
  }

  /**
   * Save backups to storage
   */
  private async saveBackups(): Promise<void> {
    try {
      const backupFile = path.join(this.backupPath, 'backups.json');
      const data = Array.from(this.backups.values());
      await fs.writeFile(backupFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save backups:', error);
    }
  }

  /**
   * Create backup
   */
  async createBackup(backupData: {
    name: string;
    type: Backup['type'];
    source: BackupSource;
    destination: BackupDestination;
    retention: BackupRetention;
    encryption: BackupEncryption;
    compression: BackupCompression;
    schedule?: BackupSchedule;
  }): Promise<Backup> {
    try {
      const backup: Backup = {
        id: this.generateId(),
        name: backupData.name,
        type: backupData.type,
        status: 'pending',
        size: 0,
        compressedSize: 0,
        createdAt: new Date(),
        source: backupData.source,
        destination: backupData.destination,
        retention: backupData.retention,
        encryption: backupData.encryption,
        compression: backupData.compression,
        schedule: backupData.schedule,
        logs: [],
      };

      this.backups.set(backup.id, backup);
      await this.saveBackups();

      // Start backup process
      this.startBackup(backup.id);

      return backup;
    } catch (error) {
      console.error('Failed to create backup:', error);
      throw new Error(`Failed to create backup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Start backup process
   */
  private async startBackup(backupId: string): Promise<void> {
    const backup = this.backups.get(backupId);
    if (!backup) return;

    try {
      backup.status = 'running';
      backup.logs.push({
        timestamp: new Date(),
        level: 'info',
        message: 'Backup started',
      });

      const startTime = Date.now();
      const tempBackupPath = path.join(this.tempPath, backup.id);

      // Create temporary directory
      await fs.ensureDir(tempBackupPath);

      // Perform backup based on source type
      switch (backup.source.type) {
        case 'filesystem':
          await this.backupFilesystem(backup, tempBackupPath);
          break;
        case 'database':
          await this.backupDatabase(backup, tempBackupPath);
          break;
        case 'application':
          await this.backupApplication(backup, tempBackupPath);
          break;
        case 'system':
          await this.backupSystem(backup, tempBackupPath);
          break;
      }

      // Compress backup
      if (backup.compression.enabled) {
        await this.compressBackup(backup, tempBackupPath);
      }

      // Encrypt backup
      if (backup.encryption.enabled) {
        await this.encryptBackup(backup, tempBackupPath);
      }

      // Move to destination
      await this.moveToDestination(backup, tempBackupPath);

      // Update backup status
      backup.status = 'completed';
      backup.completedAt = new Date();
      backup.duration = Date.now() - startTime;
      backup.logs.push({
        timestamp: new Date(),
        level: 'info',
        message: 'Backup completed successfully',
      });

      // Clean up temporary files
      await fs.remove(tempBackupPath);

    } catch (error) {
      backup.status = 'failed';
      backup.logs.push({
        timestamp: new Date(),
        level: 'error',
        message: `Backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error,
      });
    } finally {
      await this.saveBackups();
    }
  }

  /**
   * Backup filesystem
   */
  private async backupFilesystem(backup: Backup, tempPath: string): Promise<void> {
    const { source } = backup;
    
    // Create rsync command
    let rsyncCmd = 'rsync -av --delete';
    
    // Add excludes
    for (const exclude of source.excludes) {
      rsyncCmd += ` --exclude="${exclude}"`;
    }
    
    // Add source and destination
    rsyncCmd += ` "${source.path}/" "${tempPath}/"`;
    
    await execAsync(rsyncCmd);
    
    // Calculate size
    const { stdout } = await execAsync(`du -sb "${tempPath}" | cut -f1`);
    backup.size = parseInt(stdout.trim());
  }

  /**
   * Backup database
   */
  private async backupDatabase(backup: Backup, tempPath: string): Promise<void> {
    const { source } = backup;
    
    if (!source.database) {
      throw new Error('Database configuration not provided');
    }

    const { database } = source;
    const backupFile = path.join(tempPath, `${database.database}.sql`);

    switch (database.type) {
      case 'mysql':
        await execAsync(`mysqldump -h ${database.host} -P ${database.port} -u ${database.username} -p${database.password} ${database.database} > "${backupFile}"`);
        break;
      case 'postgresql':
        await execAsync(`PGPASSWORD=${database.password} pg_dump -h ${database.host} -p ${database.port} -U ${database.username} ${database.database} > "${backupFile}"`);
        break;
      case 'sqlite':
        await execAsync(`sqlite3 "${database.database}" ".backup '${backupFile}'"`);
        break;
    }

    // Calculate size
    const { stdout } = await execAsync(`du -sb "${backupFile}" | cut -f1`);
    backup.size = parseInt(stdout.trim());
  }

  /**
   * Backup application
   */
  private async backupApplication(backup: Backup, tempPath: string): Promise<void> {
    const { source } = backup;
    
    // Backup application files
    await this.backupFilesystem(backup, tempPath);
    
    // Backup application database if configured
    if (source.database) {
      const dbBackupPath = path.join(tempPath, 'database');
      await fs.ensureDir(dbBackupPath);
      
      const dbBackup = { ...backup, source: { ...source, path: dbBackupPath } };
      await this.backupDatabase(dbBackup, dbBackupPath);
    }
  }

  /**
   * Backup system
   */
  private async backupSystem(backup: Backup, tempPath: string): Promise<void> {
    const { source } = backup;
    
    // Backup system files
    await this.backupFilesystem(backup, tempPath);
    
    // Backup system configuration
    const configPath = path.join(tempPath, 'config');
    await fs.ensureDir(configPath);
    
    // Copy important system files
    const systemFiles = [
      '/etc/nginx',
      '/etc/apache2',
      '/etc/php',
      '/etc/mysql',
      '/etc/postgresql',
      '/etc/redis',
      '/etc/memcached',
      '/etc/ssl',
      '/etc/letsencrypt',
      '/var/www',
      '/home',
    ];

    for (const file of systemFiles) {
      if (await fs.pathExists(file)) {
        const destPath = path.join(configPath, path.basename(file));
        await execAsync(`cp -r "${file}" "${destPath}"`);
      }
    }
  }

  /**
   * Compress backup
   */
  private async compressBackup(backup: Backup, tempPath: string): Promise<void> {
    const { compression } = backup;
    const archivePath = path.join(this.tempPath, `${backup.id}.tar.${compression.algorithm}`);
    
    let compressCmd = 'tar';
    
    switch (compression.algorithm) {
      case 'gzip':
        compressCmd += ` -czf`;
        break;
      case 'bzip2':
        compressCmd += ` -cjf`;
        break;
      case 'xz':
        compressCmd += ` -cJf`;
        break;
      case 'lz4':
        compressCmd += ` -c --lz4`;
        break;
    }
    
    compressCmd += ` "${archivePath}" -C "${tempPath}" .`;
    
    await execAsync(compressCmd);
    
    // Calculate compressed size
    const { stdout } = await execAsync(`du -sb "${archivePath}" | cut -f1`);
    backup.compressedSize = parseInt(stdout.trim());
    
    // Remove original files
    await fs.remove(tempPath);
    
    // Move compressed file back
    await execAsync(`mv "${archivePath}" "${tempPath}"`);
  }

  /**
   * Encrypt backup
   */
  private async encryptBackup(backup: Backup, tempPath: string): Promise<void> {
    const { encryption } = backup;
    
    if (!encryption.key && !encryption.keyFile) {
      throw new Error('Encryption key or key file not provided');
    }

    const key = encryption.key || await fs.readFile(encryption.keyFile!, 'utf8');
    const keyHash = createHash('sha256').update(key).digest('hex');
    
    // Use OpenSSL for encryption
    const encryptedPath = `${tempPath}.enc`;
    const encryptCmd = `openssl enc -${encryption.algorithm} -in "${tempPath}" -out "${encryptedPath}" -k "${keyHash}"`;
    
    await execAsync(encryptCmd);
    
    // Replace original with encrypted
    await fs.remove(tempPath);
    await execAsync(`mv "${encryptedPath}" "${tempPath}"`);
  }

  /**
   * Move backup to destination
   */
  private async moveToDestination(backup: Backup, tempPath: string): Promise<void> {
    const { destination } = backup;
    
    switch (destination.type) {
      case 'local':
        await this.moveToLocal(backup, tempPath);
        break;
      case 's3':
        await this.moveToS3(backup, tempPath);
        break;
      case 'ftp':
        await this.moveToFTP(backup, tempPath);
        break;
      case 'sftp':
        await this.moveToSFTP(backup, tempPath);
        break;
      default:
        throw new Error(`Unsupported destination type: ${destination.type}`);
    }
  }

  /**
   * Move to local destination
   */
  private async moveToLocal(backup: Backup, tempPath: string): Promise<void> {
    const { destination } = backup;
    const destPath = path.join(destination.path, `${backup.id}.tar.gz`);
    
    await fs.ensureDir(destination.path);
    await execAsync(`mv "${tempPath}" "${destPath}"`);
  }

  /**
   * Move to S3 destination
   */
  private async moveToS3(backup: Backup, tempPath: string): Promise<void> {
    const { destination } = backup;
    
    if (!destination.credentials) {
      throw new Error('S3 credentials not provided');
    }

    const { accessKeyId, secretAccessKey, region, bucket } = destination.credentials;
    const s3Path = `s3://${bucket}/${backup.id}.tar.gz`;
    
    // Set AWS credentials
    process.env.AWS_ACCESS_KEY_ID = accessKeyId;
    process.env.AWS_SECRET_ACCESS_KEY = secretAccessKey;
    process.env.AWS_DEFAULT_REGION = region || 'us-east-1';
    
    await execAsync(`aws s3 cp "${tempPath}" "${s3Path}"`);
  }

  /**
   * Move to FTP destination
   */
  private async moveToFTP(backup: Backup, tempPath: string): Promise<void> {
    const { destination } = backup;
    
    if (!destination.credentials) {
      throw new Error('FTP credentials not provided');
    }

    const { host, port, username, password } = destination.credentials;
    const ftpPath = `ftp://${username}:${password}@${host}:${port}${destination.path}/${backup.id}.tar.gz`;
    
    await execAsync(`curl -T "${tempPath}" "${ftpPath}"`);
  }

  /**
   * Move to SFTP destination
   */
  private async moveToSFTP(backup: Backup, tempPath: string): Promise<void> {
    const { destination } = backup;
    
    if (!destination.credentials) {
      throw new Error('SFTP credentials not provided');
    }

    const { host, port, username, password } = destination.credentials;
    const sftpPath = `${username}@${host}:${destination.path}/${backup.id}.tar.gz`;
    
    await execAsync(`scp -P ${port} "${tempPath}" "${sftpPath}"`);
  }

  /**
   * Restore backup
   */
  async restoreBackup(backupId: string, destination: string): Promise<BackupRestore> {
    try {
      const backup = this.backups.get(backupId);
      if (!backup) {
        throw new Error(`Backup not found: ${backupId}`);
      }

      const restore: BackupRestore = {
        id: this.generateId(),
        backupId,
        status: 'pending',
        destination,
        createdAt: new Date(),
        logs: [],
      };

      this.restores.set(restore.id, restore);

      // Start restore process
      this.startRestore(restore.id);

      return restore;
    } catch (error) {
      console.error('Failed to restore backup:', error);
      throw new Error(`Failed to restore backup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Start restore process
   */
  private async startRestore(restoreId: string): Promise<void> {
    const restore = this.restores.get(restoreId);
    if (!restore) return;

    try {
      restore.status = 'running';
      restore.logs.push({
        timestamp: new Date(),
        level: 'info',
        message: 'Restore started',
      });

      const backup = this.backups.get(restore.backupId);
      if (!backup) {
        throw new Error('Backup not found');
      }

      // Download backup from destination
      const tempPath = path.join(this.tempPath, restore.id);
      await fs.ensureDir(tempPath);
      
      await this.downloadFromDestination(backup, tempPath);

      // Decrypt backup if needed
      if (backup.encryption.enabled) {
        await this.decryptBackup(backup, tempPath);
      }

      // Decompress backup if needed
      if (backup.compression.enabled) {
        await this.decompressBackup(backup, tempPath);
      }

      // Restore files
      await this.restoreFiles(backup, tempPath, restore.destination);

      restore.status = 'completed';
      restore.completedAt = new Date();
      restore.logs.push({
        timestamp: new Date(),
        level: 'info',
        message: 'Restore completed successfully',
      });

      // Clean up
      await fs.remove(tempPath);

    } catch (error) {
      restore.status = 'failed';
      restore.logs.push({
        timestamp: new Date(),
        level: 'error',
        message: `Restore failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error,
      });
    }
  }

  /**
   * Download from destination
   */
  private async downloadFromDestination(backup: Backup, tempPath: string): Promise<void> {
    const { destination } = backup;
    
    switch (destination.type) {
      case 'local':
        await execAsync(`cp "${destination.path}/${backup.id}.tar.gz" "${tempPath}/"`);
        break;
      case 's3':
        // Implement S3 download
        break;
      case 'ftp':
        // Implement FTP download
        break;
      case 'sftp':
        // Implement SFTP download
        break;
      default:
        throw new Error(`Unsupported destination type: ${destination.type}`);
    }
  }

  /**
   * Decrypt backup
   */
  private async decryptBackup(backup: Backup, tempPath: string): Promise<void> {
    const { encryption } = backup;
    
    if (!encryption.key && !encryption.keyFile) {
      throw new Error('Encryption key or key file not provided');
    }

    const key = encryption.key || await fs.readFile(encryption.keyFile!, 'utf8');
    const keyHash = createHash('sha256').update(key).digest('hex');
    
    const decryptedPath = `${tempPath}.dec`;
    const decryptCmd = `openssl enc -${encryption.algorithm} -d -in "${tempPath}" -out "${decryptedPath}" -k "${keyHash}"`;
    
    await execAsync(decryptCmd);
    
    // Replace encrypted with decrypted
    await fs.remove(tempPath);
    await execAsync(`mv "${decryptedPath}" "${tempPath}"`);
  }

  /**
   * Decompress backup
   */
  private async decompressBackup(backup: Backup, tempPath: string): Promise<void> {
    const { compression } = backup;
    const extractPath = path.join(this.tempPath, `${backup.id}_extracted`);
    
    await fs.ensureDir(extractPath);
    
    let decompressCmd = 'tar';
    
    switch (compression.algorithm) {
      case 'gzip':
        decompressCmd += ` -xzf`;
        break;
      case 'bzip2':
        decompressCmd += ` -xjf`;
        break;
      case 'xz':
        decompressCmd += ` -xJf`;
        break;
      case 'lz4':
        decompressCmd += ` -x --lz4`;
        break;
    }
    
    decompressCmd += ` "${tempPath}" -C "${extractPath}"`;
    
    await execAsync(decompressCmd);
    
    // Replace compressed with extracted
    await fs.remove(tempPath);
    await execAsync(`mv "${extractPath}" "${tempPath}"`);
  }

  /**
   * Restore files
   */
  private async restoreFiles(backup: Backup, tempPath: string, destination: string): Promise<void> {
    const { source } = backup;
    
    // Create destination directory
    await fs.ensureDir(destination);
    
    // Restore files
    await execAsync(`rsync -av "${tempPath}/" "${destination}/"`);
  }

  /**
   * Get all backups
   */
  getBackups(): Backup[] {
    return Array.from(this.backups.values());
  }

  /**
   * Get backup by ID
   */
  getBackup(id: string): Backup | undefined {
    return this.backups.get(id);
  }

  /**
   * Delete backup
   */
  async deleteBackup(id: string): Promise<void> {
    try {
      const backup = this.backups.get(id);
      if (!backup) {
        throw new Error(`Backup not found: ${id}`);
      }

      // Remove from destination
      await this.removeFromDestination(backup);

      // Remove from storage
      this.backups.delete(id);
      await this.saveBackups();
    } catch (error) {
      console.error('Failed to delete backup:', error);
      throw new Error(`Failed to delete backup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Remove from destination
   */
  private async removeFromDestination(backup: Backup): Promise<void> {
    const { destination } = backup;
    
    switch (destination.type) {
      case 'local':
        const localPath = path.join(destination.path, `${backup.id}.tar.gz`);
        if (await fs.pathExists(localPath)) {
          await fs.remove(localPath);
        }
        break;
      case 's3':
        // Implement S3 deletion
        break;
      case 'ftp':
        // Implement FTP deletion
        break;
      case 'sftp':
        // Implement SFTP deletion
        break;
    }
  }

  /**
   * Clean up old backups
   */
  async cleanupOldBackups(): Promise<void> {
    try {
      const now = new Date();
      const backupsToDelete: string[] = [];

      for (const [id, backup] of this.backups) {
        const age = now.getTime() - backup.createdAt.getTime();
        const ageInDays = age / (1000 * 60 * 60 * 24);

        // Check retention policy
        if (ageInDays > backup.retention.days) {
          backupsToDelete.push(id);
        }
      }

      // Delete old backups
      for (const id of backupsToDelete) {
        await this.deleteBackup(id);
      }

      console.log(`Cleaned up ${backupsToDelete.length} old backups`);
    } catch (error) {
      console.error('Failed to cleanup old backups:', error);
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  /**
   * Get backup statistics
   */
  getStatistics(): {
    totalBackups: number;
    completedBackups: number;
    failedBackups: number;
    totalSize: number;
    compressedSize: number;
  } {
    const backups = Array.from(this.backups.values());
    
    return {
      totalBackups: backups.length,
      completedBackups: backups.filter(b => b.status === 'completed').length,
      failedBackups: backups.filter(b => b.status === 'failed').length,
      totalSize: backups.reduce((sum, b) => sum + b.size, 0),
      compressedSize: backups.reduce((sum, b) => sum + b.compressedSize, 0),
    };
  }
}