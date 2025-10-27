import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { env } from '../config/env.js';

const execAsync = promisify(exec);

export interface SSLCertificate {
  domain: string;
  status: 'valid' | 'expired' | 'not_found' | 'error';
  expiryDate?: Date;
  issuer?: string;
  certificatePath?: string;
  privateKeyPath?: string;
  chainPath?: string;
  fullChainPath?: string;
}

export interface SSLChallenge {
  type: 'http-01' | 'dns-01';
  token?: string;
  keyAuth?: string;
  recordName?: string;
  recordValue?: string;
}

export interface SSLIssueOptions {
  domain: string;
  email?: string;
  staging?: boolean;
  forceRenewal?: boolean;
  webroot?: string;
  dnsProvider?: string;
  dnsCredentials?: Record<string, string>;
}

export class SSLProvider {
  private certbotPath: string;
  private letsencryptDir: string;
  private staging: boolean;

  constructor() {
    this.certbotPath = '/usr/bin/certbot';
    this.letsencryptDir = '/etc/letsencrypt';
    this.staging = env.SSL_STAGING;
  }

  /**
   * Check if Certbot is installed
   */
  async isCertbotInstalled(): Promise<boolean> {
    try {
      await execAsync(`${this.certbotPath} --version`);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Install Certbot
   */
  async installCertbot(): Promise<void> {
    try {
      // Update package list
      await execAsync('apt-get update');
      
      // Install Certbot and Nginx plugin
      await execAsync('apt-get install -y certbot python3-certbot-nginx python3-certbot-dns-cloudflare');
      
      // Create Let's Encrypt directory
      await fs.ensureDir(this.letsencryptDir);
      
      // Set proper permissions
      await execAsync(`chmod 755 ${this.letsencryptDir}`);
    } catch (error) {
      console.error('Failed to install Certbot:', error);
      throw new Error(`Failed to install Certbot: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Issue SSL certificate for a domain
   */
  async issueCertificate(options: SSLIssueOptions): Promise<SSLCertificate> {
    try {
      const email = options.email || env.CERTBOT_EMAIL;
      const staging = options.staging !== undefined ? options.staging : this.staging;
      
      // Build Certbot command
      const cmd = [
        this.certbotPath,
        'certonly',
        '--nginx',
        '--non-interactive',
        '--agree-tos',
        `--email ${email}`,
        `-d ${options.domain}`,
      ];

      if (staging) {
        cmd.push('--staging');
      }

      if (options.forceRenewal) {
        cmd.push('--force-renewal');
      }

      if (options.webroot) {
        cmd.push(`--webroot -w ${options.webroot}`);
      }

      // Execute Certbot command
      const { stdout, stderr } = await execAsync(cmd.join(' '));
      
      // Check if certificate was issued successfully
      const certificate = await this.getCertificateInfo(options.domain);
      
      if (certificate.status === 'valid') {
        return certificate;
      } else {
        throw new Error(`Failed to issue SSL certificate: ${stderr}`);
      }
    } catch (error) {
      console.error('Failed to issue SSL certificate:', error);
      throw new Error(`Failed to issue SSL certificate: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Issue wildcard certificate using DNS challenge
   */
  async issueWildcardCertificate(options: SSLIssueOptions): Promise<SSLCertificate> {
    try {
      const email = options.email || env.CERTBOT_EMAIL;
      const staging = options.staging !== undefined ? options.staging : this.staging;
      
      if (!options.dnsProvider) {
        throw new Error('DNS provider is required for wildcard certificates');
      }

      // Build Certbot command for DNS challenge
      const cmd = [
        this.certbotPath,
        'certonly',
        '--manual',
        '--preferred-challenges dns',
        '--non-interactive',
        '--agree-tos',
        `--email ${email}`,
        `-d ${options.domain}`,
        `-d *.${options.domain}`,
      ];

      if (staging) {
        cmd.push('--staging');
      }

      // Execute Certbot command
      const { stdout, stderr } = await execAsync(cmd.join(' '));
      
      // Parse DNS challenge information from output
      const challenge = this.parseDNSChallenge(stdout);
      
      return {
        domain: options.domain,
        status: 'valid',
        expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
      };
    } catch (error) {
      console.error('Failed to issue wildcard certificate:', error);
      throw new Error(`Failed to issue wildcard certificate: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Renew SSL certificate
   */
  async renewCertificate(domain?: string): Promise<SSLCertificate[]> {
    try {
      let cmd = `${this.certbotPath} renew --quiet`;
      
      if (domain) {
        cmd += ` --cert-name ${domain}`;
      }

      const { stdout, stderr } = await execAsync(cmd);
      
      // Get list of renewed certificates
      const certificates: SSLCertificate[] = [];
      
      if (domain) {
        const cert = await this.getCertificateInfo(domain);
        certificates.push(cert);
      } else {
        // Get all certificates
        const allCerts = await this.listCertificates();
        certificates.push(...allCerts);
      }
      
      return certificates;
    } catch (error) {
      console.error('Failed to renew certificate:', error);
      throw new Error(`Failed to renew certificate: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Revoke SSL certificate
   */
  async revokeCertificate(domain: string): Promise<void> {
    try {
      const cmd = `${this.certbotPath} revoke --cert-path /etc/letsencrypt/live/${domain}/cert.pem --non-interactive`;
      await execAsync(cmd);
      
      // Remove certificate files
      await fs.remove(path.join(this.letsencryptDir, 'live', domain));
      await fs.remove(path.join(this.letsencryptDir, 'archive', domain));
    } catch (error) {
      console.error('Failed to revoke certificate:', error);
      throw new Error(`Failed to revoke certificate: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get certificate information
   */
  async getCertificateInfo(domain: string): Promise<SSLCertificate> {
    try {
      const certPath = path.join(this.letsencryptDir, 'live', domain, 'cert.pem');
      
      // Check if certificate exists
      if (!await fs.pathExists(certPath)) {
        return {
          domain,
          status: 'not_found',
        };
      }

      // Get certificate details using OpenSSL
      const { stdout } = await execAsync(`openssl x509 -in ${certPath} -text -noout`);
      
      // Parse certificate information
      const expiryMatch = stdout.match(/Not After : (.+)/);
      const issuerMatch = stdout.match(/Issuer: (.+)/);
      
      const expiryDate = expiryMatch ? new Date(expiryMatch[1]) : undefined;
      const issuer = issuerMatch ? issuerMatch[1].trim() : undefined;
      
      // Check if certificate is expired
      const isExpired = expiryDate ? expiryDate < new Date() : false;
      
      return {
        domain,
        status: isExpired ? 'expired' : 'valid',
        expiryDate,
        issuer,
        certificatePath: certPath,
        privateKeyPath: path.join(this.letsencryptDir, 'live', domain, 'privkey.pem'),
        chainPath: path.join(this.letsencryptDir, 'live', domain, 'chain.pem'),
        fullChainPath: path.join(this.letsencryptDir, 'live', domain, 'fullchain.pem'),
      };
    } catch (error) {
      console.error('Failed to get certificate info:', error);
      return {
        domain,
        status: 'error',
      };
    }
  }

  /**
   * List all certificates
   */
  async listCertificates(): Promise<SSLCertificate[]> {
    try {
      const { stdout } = await execAsync(`${this.certbotPath} certificates`);
      
      const certificates: SSLCertificate[] = [];
      const lines = stdout.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.includes('Certificate Name:')) {
          const domainMatch = line.match(/Certificate Name:\s+(.+)/);
          if (domainMatch) {
            const domain = domainMatch[1].trim();
            const cert = await this.getCertificateInfo(domain);
            certificates.push(cert);
          }
        }
      }
      
      return certificates;
    } catch (error) {
      console.error('Failed to list certificates:', error);
      return [];
    }
  }

  /**
   * Check certificate expiry and send alerts
   */
  async checkExpiry(daysThreshold: number = 30): Promise<SSLCertificate[]> {
    const certificates = await this.listCertificates();
    const expiringSoon: SSLCertificate[] = [];
    
    for (const cert of certificates) {
      if (cert.expiryDate) {
        const daysUntilExpiry = Math.ceil((cert.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        
        if (daysUntilExpiry <= daysThreshold) {
          expiringSoon.push(cert);
        }
      }
    }
    
    return expiringSoon;
  }

  /**
   * Setup auto-renewal cron job
   */
  async setupAutoRenewal(): Promise<void> {
    try {
      const cronJob = '0 12 * * * /usr/bin/certbot renew --quiet --deploy-hook "systemctl reload nginx"';
      
      // Check if cron job already exists
      const { stdout } = await execAsync('crontab -l 2>/dev/null || echo ""');
      
      if (!stdout.includes('certbot renew')) {
        // Add cron job
        const newCrontab = stdout + '\n' + cronJob + '\n';
        await execAsync(`echo "${newCrontab}" | crontab -`);
      }
    } catch (error) {
      console.error('Failed to setup auto-renewal:', error);
      throw new Error(`Failed to setup auto-renewal: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Configure Nginx for SSL
   */
  async configureNginxSSL(domain: string): Promise<void> {
    try {
      const nginxConfigPath = `/etc/nginx/sites-available/${domain}`;
      
      // Check if Nginx config exists
      if (!await fs.pathExists(nginxConfigPath)) {
        throw new Error(`Nginx configuration not found for domain: ${domain}`);
      }

      // Read current configuration
      const currentConfig = await fs.readFile(nginxConfigPath, 'utf8');
      
      // Add SSL redirect if not present
      if (!currentConfig.includes('return 301 https://')) {
        const sslRedirect = `server {
    listen 80;
    server_name ${domain};
    return 301 https://$server_name$request_uri;
}

`;
        
        const updatedConfig = sslRedirect + currentConfig;
        await fs.writeFile(nginxConfigPath, updatedConfig);
        
        // Reload Nginx
        await execAsync('systemctl reload nginx');
      }
    } catch (error) {
      console.error('Failed to configure Nginx SSL:', error);
      throw new Error(`Failed to configure Nginx SSL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse DNS challenge information from Certbot output
   */
  private parseDNSChallenge(output: string): SSLChallenge {
    const lines = output.split('\n');
    const challenge: SSLChallenge = { type: 'dns-01' };
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.includes('Please deploy a DNS TXT record')) {
        const recordMatch = line.match(/Please deploy a DNS TXT record under the name\s+(.+?)\s+with the following value:\s+(.+)/);
        if (recordMatch) {
          challenge.recordName = recordMatch[1].trim();
          challenge.recordValue = recordMatch[2].trim();
        }
      }
      
      if (line.includes('_acme-challenge')) {
        challenge.recordName = line.trim();
      }
    }
    
    return challenge;
  }

  /**
   * Test SSL certificate
   */
  async testCertificate(domain: string): Promise<{
    valid: boolean;
    error?: string;
    expiryDate?: Date;
    issuer?: string;
  }> {
    try {
      const { stdout } = await execAsync(`openssl s_client -connect ${domain}:443 -servername ${domain} < /dev/null 2>/dev/null | openssl x509 -noout -dates -issuer`);
      
      const expiryMatch = stdout.match(/notAfter=(.+)/);
      const issuerMatch = stdout.match(/issuer=(.+)/);
      
      const expiryDate = expiryMatch ? new Date(expiryMatch[1]) : undefined;
      const issuer = issuerMatch ? issuerMatch[1].trim() : undefined;
      
      return {
        valid: true,
        expiryDate,
        issuer,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get SSL statistics
   */
  async getSSLStatistics(): Promise<{
    totalCertificates: number;
    validCertificates: number;
    expiredCertificates: number;
    expiringSoon: number;
  }> {
    const certificates = await this.listCertificates();
    
    let validCertificates = 0;
    let expiredCertificates = 0;
    let expiringSoon = 0;
    
    for (const cert of certificates) {
      if (cert.status === 'valid') {
        validCertificates++;
        
        if (cert.expiryDate) {
          const daysUntilExpiry = Math.ceil((cert.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          if (daysUntilExpiry <= 30) {
            expiringSoon++;
          }
        }
      } else if (cert.status === 'expired') {
        expiredCertificates++;
      }
    }
    
    return {
      totalCertificates: certificates.length,
      validCertificates,
      expiredCertificates,
      expiringSoon,
    };
  }
}
