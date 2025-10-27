import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { env } from '../config/env.js';

const execAsync = promisify(exec);

export interface FTPUser {
  username: string;
  password: string;
  homeDirectory: string;
  shell: string;
  uid: number;
  gid: number;
  isActive: boolean;
  maxConnections: number;
  uploadBandwidth: number;
  downloadBandwidth: number;
  allowedIPs: string[];
  deniedIPs: string[];
}

export interface FTPConfig {
  port: number;
  passivePorts: string;
  maxClients: number;
  maxClientsPerIP: number;
  anonymousEnable: boolean;
  anonymousPassword: string;
  localEnable: boolean;
  writeEnable: boolean;
  chrootLocalUser: boolean;
  allowWriteableChroot: boolean;
  sslEnable: boolean;
  sslCertPath: string;
  sslKeyPath: string;
}

export class FTPProvider {
  private configPath: string;
  private userConfigPath: string;
  private logPath: string;

  constructor() {
    this.configPath = '/etc/vsftpd.conf';
    this.userConfigPath = '/etc/vsftpd.userlist';
    this.logPath = '/var/log/vsftpd.log';
  }

  /**
   * Check if vsftpd is installed
   */
  async isInstalled(): Promise<boolean> {
    try {
      await execAsync('which vsftpd');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Install vsftpd
   */
  async install(): Promise<void> {
    try {
      await execAsync('apt-get update');
      await execAsync('apt-get install -y vsftpd');
      
      // Create backup of original config
      await execAsync(`cp ${this.configPath} ${this.configPath}.backup`);
      
      // Set up basic configuration
      await this.setupBasicConfig();
      
      // Start and enable service
      await execAsync('systemctl enable vsftpd');
      await execAsync('systemctl start vsftpd');
    } catch (error) {
      console.error('Failed to install vsftpd:', error);
      throw new Error(`Failed to install vsftpd: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Setup basic vsftpd configuration
   */
  private async setupBasicConfig(): Promise<void> {
    const config = `# Atulya Panel FTP Configuration
listen=YES
listen_ipv6=NO
anonymous_enable=NO
local_enable=YES
write_enable=YES
local_umask=022
dirmessage_enable=YES
use_localtime=YES
xferlog_enable=YES
connect_from_port_20=YES
chroot_local_user=YES
secure_chroot_dir=/var/run/vsftpd/empty
pam_service_name=vsftpd
rsa_cert_file=/etc/ssl/certs/ssl-cert-snakeoil.pem
rsa_private_key_file=/etc/ssl/private/ssl-cert-snakeoil.key
ssl_enable=NO
userlist_enable=YES
userlist_file=${this.userConfigPath}
userlist_deny=NO
allow_writeable_chroot=YES
pasv_enable=YES
pasv_min_port=40000
pasv_max_port=40100
max_clients=50
max_per_ip=5
`;

    await fs.writeFile(this.configPath, config);
    await fs.writeFile(this.userConfigPath, '');
  }

  /**
   * Create FTP user
   */
  async createUser(userData: Partial<FTPUser>): Promise<FTPUser> {
    try {
      const username = userData.username || this.generateUsername();
      const password = userData.password || this.generatePassword();
      const homeDirectory = userData.homeDirectory || `/home/ftp/${username}`;
      
      // Create system user
      await execAsync(`useradd -m -d ${homeDirectory} -s /bin/bash ${username}`);
      
      // Set password
      await execAsync(`echo "${username}:${password}" | chpasswd`);
      
      // Create home directory
      await fs.ensureDir(homeDirectory);
      await execAsync(`chown ${username}:${username} ${homeDirectory}`);
      await execAsync(`chmod 755 ${homeDirectory}`);
      
      // Add to vsftpd userlist
      await this.addToUserList(username);
      
      // Create FTP user object
      const ftpUser: FTPUser = {
        username,
        password,
        homeDirectory,
        shell: '/bin/bash',
        uid: await this.getUserId(username),
        gid: await this.getGroupId(username),
        isActive: true,
        maxConnections: userData.maxConnections || 5,
        uploadBandwidth: userData.uploadBandwidth || 0,
        downloadBandwidth: userData.downloadBandwidth || 0,
        allowedIPs: userData.allowedIPs || [],
        deniedIPs: userData.deniedIPs || [],
      };
      
      return ftpUser;
    } catch (error) {
      console.error('Failed to create FTP user:', error);
      throw new Error(`Failed to create FTP user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete FTP user
   */
  async deleteUser(username: string): Promise<void> {
    try {
      // Remove from vsftpd userlist
      await this.removeFromUserList(username);
      
      // Delete system user and home directory
      await execAsync(`userdel -r ${username}`);
    } catch (error) {
      console.error('Failed to delete FTP user:', error);
      throw new Error(`Failed to delete FTP user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List all FTP users
   */
  async listUsers(): Promise<FTPUser[]> {
    try {
      const { stdout } = await execAsync('cat /etc/passwd | grep -E "/home/ftp/" | cut -d: -f1');
      const usernames = stdout.trim().split('\n').filter(name => name);
      
      const users: FTPUser[] = [];
      for (const username of usernames) {
        const user = await this.getUserInfo(username);
        if (user) {
          users.push(user);
        }
      }
      
      return users;
    } catch (error) {
      console.error('Failed to list FTP users:', error);
      return [];
    }
  }

  /**
   * Get user information
   */
  async getUserInfo(username: string): Promise<FTPUser | null> {
    try {
      const { stdout } = await execAsync(`id ${username}`);
      const uidMatch = stdout.match(/uid=(\d+)/);
      const gidMatch = stdout.match(/gid=(\d+)/);
      
      if (!uidMatch || !gidMatch) return null;
      
      const { stdout: homeDir } = await execAsync(`getent passwd ${username} | cut -d: -f6`);
      
      return {
        username,
        password: '***', // Don't return actual password
        homeDirectory: homeDir.trim(),
        shell: '/bin/bash',
        uid: parseInt(uidMatch[1]),
        gid: parseInt(gidMatch[1]),
        isActive: await this.isUserActive(username),
        maxConnections: 5,
        uploadBandwidth: 0,
        downloadBandwidth: 0,
        allowedIPs: [],
        deniedIPs: [],
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Update user password
   */
  async updatePassword(username: string, newPassword: string): Promise<void> {
    try {
      await execAsync(`echo "${username}:${newPassword}" | chpasswd`);
    } catch (error) {
      console.error('Failed to update password:', error);
      throw new Error(`Failed to update password: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update user home directory
   */
  async updateHomeDirectory(username: string, newHomeDir: string): Promise<void> {
    try {
      // Create new directory
      await fs.ensureDir(newHomeDir);
      
      // Move files
      const { stdout: currentHome } = await execAsync(`getent passwd ${username} | cut -d: -f6`);
      if (currentHome.trim() !== newHomeDir) {
        await execAsync(`usermod -d ${newHomeDir} ${username}`);
        await execAsync(`mv ${currentHome.trim()}/* ${newHomeDir}/ 2>/dev/null || true`);
        await execAsync(`chown -R ${username}:${username} ${newHomeDir}`);
      }
    } catch (error) {
      console.error('Failed to update home directory:', error);
      throw new Error(`Failed to update home directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get FTP service status
   */
  async getStatus(): Promise<{
    running: boolean;
    active: boolean;
    uptime: string;
    connections: number;
  }> {
    try {
      const { stdout: isActive } = await execAsync('systemctl is-active vsftpd');
      const isRunning = isActive.trim() === 'active';
      
      let uptime = '0';
      let connections = 0;
      
      if (isRunning) {
        const { stdout: statusOutput } = await execAsync('systemctl status vsftpd --no-pager');
        const uptimeMatch = statusOutput.match(/Active: active \\(running\\) since (.+?);/);
        uptime = uptimeMatch ? uptimeMatch[1] : 'Unknown';
        
        // Count active connections
        const { stdout: connectionsOutput } = await execAsync('netstat -an | grep :21 | grep ESTABLISHED | wc -l');
        connections = parseInt(connectionsOutput.trim()) || 0;
      }
      
      return {
        running: isRunning,
        active: isRunning,
        uptime,
        connections,
      };
    } catch (error) {
      return {
        running: false,
        active: false,
        uptime: '0',
        connections: 0,
      };
    }
  }

  /**
   * Get FTP logs
   */
  async getLogs(lines: number = 100): Promise<string[]> {
    try {
      const { stdout } = await execAsync(`tail -n ${lines} ${this.logPath}`);
      return stdout.split('\n').filter(line => line.trim());
    } catch (error) {
      return [`Failed to get FTP logs: ${error}`];
    }
  }

  /**
   * Restart FTP service
   */
  async restart(): Promise<void> {
    try {
      await execAsync('systemctl restart vsftpd');
    } catch (error) {
      console.error('Failed to restart vsftpd:', error);
      throw new Error(`Failed to restart vsftpd: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add user to vsftpd userlist
   */
  private async addToUserList(username: string): Promise<void> {
    try {
      const { stdout } = await execAsync(`cat ${this.userConfigPath}`);
      const users = stdout.trim().split('\n').filter(user => user);
      
      if (!users.includes(username)) {
        users.push(username);
        await fs.writeFile(this.userConfigPath, users.join('\n') + '\n');
      }
    } catch (error) {
      // File might not exist, create it
      await fs.writeFile(this.userConfigPath, username + '\n');
    }
  }

  /**
   * Remove user from vsftpd userlist
   */
  private async removeFromUserList(username: string): Promise<void> {
    try {
      const { stdout } = await execAsync(`cat ${this.userConfigPath}`);
      const users = stdout.trim().split('\n').filter(user => user && user !== username);
      await fs.writeFile(this.userConfigPath, users.join('\n') + '\n');
    } catch (error) {
      // File might not exist, ignore
    }
  }

  /**
   * Check if user is active
   */
  private async isUserActive(username: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`cat ${this.userConfigPath}`);
      return stdout.includes(username);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get user ID
   */
  private async getUserId(username: string): Promise<number> {
    try {
      const { stdout } = await execAsync(`id -u ${username}`);
      return parseInt(stdout.trim());
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get group ID
   */
  private async getGroupId(username: string): Promise<number> {
    try {
      const { stdout } = await execAsync(`id -g ${username}`);
      return parseInt(stdout.trim());
    } catch (error) {
      return 0;
    }
  }

  /**
   * Generate username
   */
  private generateUsername(): string {
    return 'ftp_' + Math.random().toString(36).substring(2, 8);
  }

  /**
   * Generate password
   */
  private generatePassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}