import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { randomBytes } from 'crypto';
import { env } from '../config/env.js';

const execAsync = promisify(exec);

export interface EmailAccount {
  email: string;
  password: string;
  quota: number;
  domain: string;
  isActive: boolean;
  forwardTo?: string;
  catchAll?: boolean;
}

export interface EmailDomain {
  domain: string;
  isActive: boolean;
  mxRecords: string[];
  spfRecord: string;
  dkimKey?: string;
  dkimSelector: string;
}

export interface EmailQuota {
  email: string;
  used: number;
  quota: number;
  percentage: number;
}

export interface EmailStats {
  totalAccounts: number;
  activeAccounts: number;
  totalQuota: number;
  usedQuota: number;
  domains: number;
}

export class EmailProvider {
  private postfixDir: string;
  private dovecotDir: string;
  private virtualDir: string;
  private mailDir: string;

  constructor() {
    this.postfixDir = '/etc/postfix';
    this.dovecotDir = '/etc/dovecot';
    this.virtualDir = env.POSTFIX_VIRTUAL_DIR;
    this.mailDir = '/var/mail/virtual';
  }

  /**
   * Install Postfix and Dovecot
   */
  async installEmailServer(): Promise<void> {
    try {
      // Update package list
      await execAsync('apt-get update');
      
      // Install Postfix and Dovecot
      await execAsync('apt-get install -y postfix dovecot-core dovecot-imapd dovecot-pop3d dovecot-lmtpd');
      
      // Create directories
      await fs.ensureDir(this.virtualDir);
      await fs.ensureDir(this.mailDir);
      
      // Set permissions
      await execAsync(`chown -R vmail:vmail ${this.mailDir}`);
      await execAsync(`chmod -R 755 ${this.mailDir}`);
      
      // Configure services
      await this.configurePostfix();
      await this.configureDovecot();
      
      // Start and enable services
      await execAsync('systemctl enable postfix dovecot');
      await execAsync('systemctl restart postfix dovecot');
    } catch (error) {
      console.error('Failed to install email server:', error);
      throw new Error(`Failed to install email server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Configure Postfix
   */
  private async configurePostfix(): Promise<void> {
    const mainCf = `# Postfix configuration for Atulya Panel
myhostname = mail.${process.env.HOSTNAME || 'localhost'}
mydomain = ${process.env.HOSTNAME || 'localhost'}
myorigin = $mydomain
inet_interfaces = all
inet_protocols = ipv4
mydestination = $myhostname, localhost.$mydomain, localhost
relayhost =
mynetworks = 127.0.0.0/8
mailbox_size_limit = 0
recipient_delimiter = +
home_mailbox = Maildir/

# Virtual domains
virtual_mailbox_domains = hash:${this.virtualDir}/domains
virtual_mailbox_maps = hash:${this.virtualDir}/mailboxes
virtual_alias_maps = hash:${this.virtualDir}/aliases
virtual_mailbox_base = ${this.mailDir}
virtual_minimum_uid = 1000
virtual_uid_maps = static:1000
virtual_gid_maps = static:1000

# Security
smtpd_banner = $myhostname ESMTP
disable_vrfy_command = yes
smtpd_helo_required = yes
smtpd_helo_restrictions = permit_mynetworks,reject_invalid_helo_hostname,permit
smtpd_sender_restrictions = permit_mynetworks,reject_unknown_sender_domain,reject_non_fqdn_sender,permit
smtpd_recipient_restrictions = permit_mynetworks,reject_unknown_recipient_domain,reject_non_fqdn_recipient,permit

# TLS
smtpd_use_tls = yes
smtpd_tls_cert_file = /etc/ssl/certs/ssl-cert-snakeoil.pem
smtpd_tls_key_file = /etc/ssl/private/ssl-cert-snakeoil.key
smtpd_tls_security_level = may
smtp_tls_security_level = may

# Limits
message_size_limit = 104857600
mailbox_size_limit = 1073741824
`;

    await fs.writeFile(path.join(this.postfixDir, 'main.cf'), mainCf);

    // Create virtual domains file
    await fs.writeFile(path.join(this.virtualDir, 'domains'), '');
    await fs.writeFile(path.join(this.virtualDir, 'mailboxes'), '');
    await fs.writeFile(path.join(this.virtualDir, 'aliases'), '');

    // Update Postfix hash tables
    await execAsync(`postmap ${this.virtualDir}/domains`);
    await execAsync(`postmap ${this.virtualDir}/mailboxes`);
    await execAsync(`postmap ${this.virtualDir}/aliases`);
  }

  /**
   * Configure Dovecot
   */
  private async configureDovecot(): Promise<void> {
    const dovecotConf = `# Dovecot configuration for Atulya Panel
protocols = imap pop3 lmtp
listen = *, ::

# Mail location
mail_location = maildir:${this.mailDir}/%d/%n:INDEX=${this.mailDir}/%d/%n/indexes

# Authentication
auth_mechanisms = plain login
passdb {
  driver = passwd-file
  args = username_format=%n %u:${this.virtualDir}/passwd
}
userdb {
  driver = static
  args = uid=vmail gid=vmail home=${this.mailDir}/%d/%n
}

# SSL
ssl = yes
ssl_cert = passthrough
ssl_key = passthrough
ssl_protocols = !SSLv2 !SSLv3

# Logging
log_path = /var/log/dovecot.log
info_log_path = /var/log/dovecot-info.log
`;

    await fs.writeFile(path.join(this.dovecotDir, 'conf.d', '10-mail.conf'), dovecotConf);

    // Create password file
    await fs.writeFile(path.join(this.virtualDir, 'passwd'), '');
  }

  /**
   * Create email domain
   */
  async createDomain(domain: string): Promise<EmailDomain> {
    try {
      // Add domain to virtual domains
      const domainsPath = path.join(this.virtualDir, 'domains');
      await fs.appendFile(domainsPath, `${domain} OK\n`);

      // Create mail directory for domain
      const domainMailDir = path.join(this.mailDir, domain);
      await fs.ensureDir(domainMailDir);
      await execAsync(`chown -R vmail:vmail ${domainMailDir}`);

      // Generate DKIM key
      const dkimKey = await this.generateDKIMKey(domain);

      // Update Postfix hash tables
      await execAsync(`postmap ${domainsPath}`);

      // Reload Postfix
      await execAsync('systemctl reload postfix');

      return {
        domain,
        isActive: true,
        mxRecords: [`10 mail.${domain}`],
        spfRecord: `v=spf1 mx ~all`,
        dkimKey,
        dkimSelector: 'default',
      };
    } catch (error) {
      console.error('Failed to create email domain:', error);
      throw new Error(`Failed to create email domain: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete email domain
   */
  async deleteDomain(domain: string): Promise<void> {
    try {
      // Remove domain from virtual domains
      const domainsPath = path.join(this.virtualDir, 'domains');
      const content = await fs.readFile(domainsPath, 'utf8');
      const updatedContent = content.replace(new RegExp(`^${domain} OK\\n`, 'gm'), '');
      await fs.writeFile(domainsPath, updatedContent);

      // Remove mailboxes for this domain
      const mailboxesPath = path.join(this.virtualDir, 'mailboxes');
      const mailboxesContent = await fs.readFile(mailboxesPath, 'utf8');
      const updatedMailboxes = mailboxesContent.replace(new RegExp(`^.*@${domain}.*\\n`, 'gm'), '');
      await fs.writeFile(mailboxesPath, updatedMailboxes);

      // Remove aliases for this domain
      const aliasesPath = path.join(this.virtualDir, 'aliases');
      const aliasesContent = await fs.readFile(aliasesPath, 'utf8');
      const updatedAliases = aliasesContent.replace(new RegExp(`^.*@${domain}.*\\n`, 'gm'), '');
      await fs.writeFile(aliasesPath, updatedAliases);

      // Remove domain mail directory
      const domainMailDir = path.join(this.mailDir, domain);
      await fs.remove(domainMailDir);

      // Update Postfix hash tables
      await execAsync(`postmap ${domainsPath}`);
      await execAsync(`postmap ${mailboxesPath}`);
      await execAsync(`postmap ${aliasesPath}`);

      // Reload Postfix
      await execAsync('systemctl reload postfix');
    } catch (error) {
      console.error('Failed to delete email domain:', error);
      throw new Error(`Failed to delete email domain: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create email account
   */
  async createAccount(account: EmailAccount): Promise<EmailAccount> {
    try {
      // Add mailbox to virtual mailboxes
      const mailboxesPath = path.join(this.virtualDir, 'mailboxes');
      await fs.appendFile(mailboxesPath, `${account.email} ${account.email}\n`);

      // Add password to Dovecot password file
      const passwdPath = path.join(this.virtualDir, 'passwd');
      const hashedPassword = await this.hashPassword(account.password);
      await fs.appendFile(passwdPath, `${account.email}:{PLAIN}${hashedPassword}:1000:1000::${this.mailDir}/${account.domain}/${account.email.split('@')[0]}::\n`);

      // Create mail directory
      const mailDir = path.join(this.mailDir, account.domain, account.email.split('@')[0]);
      await fs.ensureDir(mailDir);
      await execAsync(`chown -R vmail:vmail ${mailDir}`);

      // Update Postfix hash tables
      await execAsync(`postmap ${mailboxesPath}`);

      // Reload services
      await execAsync('systemctl reload postfix dovecot');

      return account;
    } catch (error) {
      console.error('Failed to create email account:', error);
      throw new Error(`Failed to create email account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete email account
   */
  async deleteAccount(email: string): Promise<void> {
    try {
      // Remove mailbox from virtual mailboxes
      const mailboxesPath = path.join(this.virtualDir, 'mailboxes');
      const content = await fs.readFile(mailboxesPath, 'utf8');
      const updatedContent = content.replace(new RegExp(`^${email}.*\\n`, 'gm'), '');
      await fs.writeFile(mailboxesPath, updatedContent);

      // Remove password from Dovecot password file
      const passwdPath = path.join(this.virtualDir, 'passwd');
      const passwdContent = await fs.readFile(passwdPath, 'utf8');
      const updatedPasswd = passwdContent.replace(new RegExp(`^${email}.*\\n`, 'gm'), '');
      await fs.writeFile(passwdPath, updatedPasswd);

      // Remove mail directory
      const domain = email.split('@')[1];
      const user = email.split('@')[0];
      const mailDir = path.join(this.mailDir, domain, user);
      await fs.remove(mailDir);

      // Update Postfix hash tables
      await execAsync(`postmap ${mailboxesPath}`);

      // Reload services
      await execAsync('systemctl reload postfix dovecot');
    } catch (error) {
      console.error('Failed to delete email account:', error);
      throw new Error(`Failed to delete email account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update email account
   */
  async updateAccount(email: string, updates: Partial<EmailAccount>): Promise<EmailAccount> {
    try {
      // Read current account data
      const passwdPath = path.join(this.virtualDir, 'passwd');
      const content = await fs.readFile(passwdPath, 'utf8');
      const lines = content.split('\n');
      
      let updated = false;
      const updatedLines = lines.map(line => {
        if (line.startsWith(email)) {
          updated = true;
          if (updates.password) {
            const hashedPassword = this.hashPassword(updates.password);
            return `${email}:{PLAIN}${hashedPassword}:1000:1000::${this.mailDir}/${updates.domain || email.split('@')[1]}/${email.split('@')[0]}::`;
          }
        }
        return line;
      });

      if (updated) {
        await fs.writeFile(passwdPath, updatedLines.join('\n'));
        await execAsync('systemctl reload dovecot');
      }

      // Return updated account (in real implementation, you'd read from database)
      return {
        email,
        password: updates.password || '',
        quota: updates.quota || 1000,
        domain: updates.domain || email.split('@')[1],
        isActive: updates.isActive !== undefined ? updates.isActive : true,
        forwardTo: updates.forwardTo,
        catchAll: updates.catchAll,
      };
    } catch (error) {
      console.error('Failed to update email account:', error);
      throw new Error(`Failed to update email account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List email accounts
   */
  async listAccounts(domain?: string): Promise<EmailAccount[]> {
    try {
      const mailboxesPath = path.join(this.virtualDir, 'mailboxes');
      const content = await fs.readFile(mailboxesPath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      const accounts: EmailAccount[] = [];
      for (const line of lines) {
        const [email] = line.split(' ');
        if (email && (!domain || email.endsWith(`@${domain}`))) {
          accounts.push({
            email,
            password: '', // Don't return passwords
            quota: 1000, // Default quota
            domain: email.split('@')[1],
            isActive: true,
          });
        }
      }
      
      return accounts;
    } catch (error) {
      console.error('Failed to list email accounts:', error);
      return [];
    }
  }

  /**
   * Get email quota usage
   */
  async getQuotaUsage(email: string): Promise<EmailQuota> {
    try {
      const domain = email.split('@')[1];
      const user = email.split('@')[0];
      const mailDir = path.join(this.mailDir, domain, user);
      
      if (!await fs.pathExists(mailDir)) {
        return {
          email,
          used: 0,
          quota: 1000,
          percentage: 0,
        };
      }

      // Get directory size
      const { stdout } = await execAsync(`du -sb ${mailDir} 2>/dev/null || echo "0"`);
      const used = parseInt(stdout.split('\t')[0]) || 0;
      const quota = 1000 * 1024 * 1024; // 1GB default quota
      const percentage = (used / quota) * 100;

      return {
        email,
        used,
        quota,
        percentage,
      };
    } catch (error) {
      console.error('Failed to get quota usage:', error);
      return {
        email,
        used: 0,
        quota: 1000,
        percentage: 0,
      };
    }
  }

  /**
   * Generate DKIM key
   */
  private async generateDKIMKey(domain: string): Promise<string> {
    try {
      const keyDir = path.join(this.mailDir, 'dkim', domain);
      await fs.ensureDir(keyDir);
      
      const privateKeyPath = path.join(keyDir, 'private.key');
      const publicKeyPath = path.join(keyDir, 'public.key');
      
      // Generate private key
      await execAsync(`openssl genrsa -out ${privateKeyPath} 2048`);
      
      // Generate public key
      await execAsync(`openssl rsa -in ${privateKeyPath} -pubout -out ${publicKeyPath}`);
      
      // Set permissions
      await execAsync(`chown -R vmail:vmail ${keyDir}`);
      await execAsync(`chmod 600 ${privateKeyPath}`);
      await execAsync(`chmod 644 ${publicKeyPath}`);
      
      // Read public key
      const publicKey = await fs.readFile(publicKeyPath, 'utf8');
      return publicKey.replace(/-----BEGIN PUBLIC KEY-----\n/, '').replace(/\n-----END PUBLIC KEY-----/, '').replace(/\n/g, '');
    } catch (error) {
      console.error('Failed to generate DKIM key:', error);
      return '';
    }
  }

  /**
   * Hash password for Dovecot
   */
  private async hashPassword(password: string): Promise<string> {
    // For simplicity, using plain text. In production, use proper hashing
    return password;
  }

  /**
   * Test email server configuration
   */
  async testConfiguration(): Promise<boolean> {
    try {
      // Test Postfix configuration
      await execAsync('postfix check');
      
      // Test Dovecot configuration
      await execAsync('dovecot -n');
      
      return true;
    } catch (error) {
      console.error('Email server configuration test failed:', error);
      return false;
    }
  }

  /**
   * Get email server status
   */
  async getServerStatus(): Promise<{
    postfix: { active: boolean; running: boolean };
    dovecot: { active: boolean; running: boolean };
  }> {
    const postfixStatus = await this.getServiceStatus('postfix');
    const dovecotStatus = await this.getServiceStatus('dovecot');
    
    return {
      postfix: postfixStatus,
      dovecot: dovecotStatus,
    };
  }

  /**
   * Get individual service status
   */
  private async getServiceStatus(service: string): Promise<{ active: boolean; running: boolean }> {
    try {
      const { stdout } = await execAsync(`systemctl is-active ${service}`);
      const isActive = stdout.trim() === 'active';
      
      const { stdout: statusOutput } = await execAsync(`systemctl status ${service} --no-pager`);
      const isRunning = statusOutput.includes('Active: active (running)');
      
      return { active: isActive, running: isRunning };
    } catch (error) {
      return { active: false, running: false };
    }
  }

  /**
   * Get email statistics
   */
  async getStatistics(): Promise<EmailStats> {
    try {
      const accounts = await this.listAccounts();
      const domains = new Set(accounts.map(account => account.domain));
      
      let totalUsedQuota = 0;
      for (const account of accounts) {
        const quota = await this.getQuotaUsage(account.email);
        totalUsedQuota += quota.used;
      }
      
      return {
        totalAccounts: accounts.length,
        activeAccounts: accounts.filter(account => account.isActive).length,
        totalQuota: accounts.length * 1000 * 1024 * 1024, // 1GB per account
        usedQuota: totalUsedQuota,
        domains: domains.size,
      };
    } catch (error) {
      console.error('Failed to get email statistics:', error);
      return {
        totalAccounts: 0,
        activeAccounts: 0,
        totalQuota: 0,
        usedQuota: 0,
        domains: 0,
      };
    }
  }
}
