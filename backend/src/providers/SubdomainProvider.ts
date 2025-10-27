import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';

const execAsync = promisify(exec);

export interface Subdomain {
  id: string;
  name: string;
  domain: string;
  fullDomain: string;
  documentRoot: string;
  phpVersion: string;
  sslEnabled: boolean;
  sslCertificate?: string;
  sslKey?: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'inactive' | 'suspended';
}

export interface SubdomainConfig {
  nginxConfigPath: string;
  apacheConfigPath: string;
  documentRootBase: string;
  defaultPhpVersion: string;
  sslEnabled: boolean;
  sslCertPath: string;
  sslKeyPath: string;
}

export class SubdomainProvider {
  private config: SubdomainConfig;
  private subdomains: Map<string, Subdomain>;

  constructor(config: SubdomainConfig) {
    this.config = config;
    this.subdomains = new Map();
  }

  /**
   * Create subdomain
   */
  async createSubdomain(data: {
    name: string;
    domain: string;
    documentRoot?: string;
    phpVersion?: string;
    sslEnabled?: boolean;
  }): Promise<Subdomain> {
    try {
      const fullDomain = `${data.name}.${data.domain}`;
      const documentRoot = data.documentRoot || path.join(this.config.documentRootBase, fullDomain);
      const phpVersion = data.phpVersion || this.config.defaultPhpVersion;

      // Create document root directory
      await fs.ensureDir(documentRoot);
      await execAsync(`chown www-data:www-data ${documentRoot}`);
      await execAsync(`chmod 755 ${documentRoot}`);

      // Create subdomain object
      const subdomain: Subdomain = {
        id: this.generateId(),
        name: data.name,
        domain: data.domain,
        fullDomain,
        documentRoot,
        phpVersion,
        sslEnabled: data.sslEnabled || false,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'active',
      };

      // Generate Nginx configuration
      await this.generateNginxConfig(subdomain);

      // Generate Apache configuration
      await this.generateApacheConfig(subdomain);

      // Reload web servers
      await this.reloadWebServers();

      // Store subdomain
      this.subdomains.set(subdomain.id, subdomain);
      await this.saveSubdomains();

      return subdomain;
    } catch (error) {
      console.error('Failed to create subdomain:', error);
      throw new Error(`Failed to create subdomain: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update subdomain
   */
  async updateSubdomain(id: string, updates: Partial<Subdomain>): Promise<Subdomain> {
    try {
      const subdomain = this.subdomains.get(id);
      if (!subdomain) {
        throw new Error(`Subdomain not found: ${id}`);
      }

      // Update subdomain
      const updatedSubdomain = {
        ...subdomain,
        ...updates,
        updatedAt: new Date(),
      };

      // Update document root if changed
      if (updates.documentRoot && updates.documentRoot !== subdomain.documentRoot) {
        await fs.ensureDir(updates.documentRoot);
        await execAsync(`chown www-data:www-data ${updates.documentRoot}`);
        await execAsync(`chmod 755 ${updates.documentRoot}`);
      }

      // Regenerate configurations if needed
      if (updates.phpVersion || updates.sslEnabled !== undefined) {
        await this.generateNginxConfig(updatedSubdomain);
        await this.generateApacheConfig(updatedSubdomain);
        await this.reloadWebServers();
      }

      // Store updated subdomain
      this.subdomains.set(id, updatedSubdomain);
      await this.saveSubdomains();

      return updatedSubdomain;
    } catch (error) {
      console.error('Failed to update subdomain:', error);
      throw new Error(`Failed to update subdomain: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete subdomain
   */
  async deleteSubdomain(id: string): Promise<void> {
    try {
      const subdomain = this.subdomains.get(id);
      if (!subdomain) {
        throw new Error(`Subdomain not found: ${id}`);
      }

      // Remove Nginx configuration
      await this.removeNginxConfig(subdomain);

      // Remove Apache configuration
      await this.removeApacheConfig(subdomain);

      // Remove document root (optional - ask user first)
      // await fs.remove(subdomain.documentRoot);

      // Reload web servers
      await this.reloadWebServers();

      // Remove from storage
      this.subdomains.delete(id);
      await this.saveSubdomains();
    } catch (error) {
      console.error('Failed to delete subdomain:', error);
      throw new Error(`Failed to delete subdomain: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get subdomain by ID
   */
  getSubdomain(id: string): Subdomain | undefined {
    return this.subdomains.get(id);
  }

  /**
   * Get subdomain by full domain
   */
  getSubdomainByDomain(fullDomain: string): Subdomain | undefined {
    for (const subdomain of this.subdomains.values()) {
      if (subdomain.fullDomain === fullDomain) {
        return subdomain;
      }
    }
    return undefined;
  }

  /**
   * List all subdomains
   */
  listSubdomains(): Subdomain[] {
    return Array.from(this.subdomains.values());
  }

  /**
   * List subdomains for a domain
   */
  listSubdomainsForDomain(domain: string): Subdomain[] {
    return Array.from(this.subdomains.values()).filter(sub => sub.domain === domain);
  }

  /**
   * Enable SSL for subdomain
   */
  async enableSSL(id: string, certificate: string, key: string): Promise<void> {
    try {
      const subdomain = this.subdomains.get(id);
      if (!subdomain) {
        throw new Error(`Subdomain not found: ${id}`);
      }

      // Update subdomain
      subdomain.sslEnabled = true;
      subdomain.sslCertificate = certificate;
      subdomain.sslKey = key;
      subdomain.updatedAt = new Date();

      // Regenerate configurations
      await this.generateNginxConfig(subdomain);
      await this.generateApacheConfig(subdomain);
      await this.reloadWebServers();

      // Save changes
      this.subdomains.set(id, subdomain);
      await this.saveSubdomains();
    } catch (error) {
      console.error('Failed to enable SSL:', error);
      throw new Error(`Failed to enable SSL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Disable SSL for subdomain
   */
  async disableSSL(id: string): Promise<void> {
    try {
      const subdomain = this.subdomains.get(id);
      if (!subdomain) {
        throw new Error(`Subdomain not found: ${id}`);
      }

      // Update subdomain
      subdomain.sslEnabled = false;
      subdomain.sslCertificate = undefined;
      subdomain.sslKey = undefined;
      subdomain.updatedAt = new Date();

      // Regenerate configurations
      await this.generateNginxConfig(subdomain);
      await this.generateApacheConfig(subdomain);
      await this.reloadWebServers();

      // Save changes
      this.subdomains.set(id, subdomain);
      await this.saveSubdomains();
    } catch (error) {
      console.error('Failed to disable SSL:', error);
      throw new Error(`Failed to disable SSL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate Nginx configuration
   */
  private async generateNginxConfig(subdomain: Subdomain): Promise<void> {
    const configPath = path.join(this.config.nginxConfigPath, `${subdomain.fullDomain}.conf`);
    
    let config = `server {
    listen 80;
    server_name ${subdomain.fullDomain};
    root ${subdomain.documentRoot};
    index index.php index.html index.htm;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # PHP-FPM configuration
    location ~ \\.php$ {
        fastcgi_pass unix:/run/php/php${subdomain.phpVersion}-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }

    # Static files
    location ~* \\.(css|js|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Deny access to hidden files
    location ~ /\\. {
        deny all;
    }
`;

    if (subdomain.sslEnabled) {
      config += `
    # SSL configuration
    listen 443 ssl http2;
    ssl_certificate ${subdomain.sslCertificate || this.config.sslCertPath};
    ssl_certificate_key ${subdomain.sslKey || this.config.sslKeyPath};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
`;
    }

    config += `}
`;

    await fs.writeFile(configPath, config);
  }

  /**
   * Generate Apache configuration
   */
  private async generateApacheConfig(subdomain: Subdomain): Promise<void> {
    const configPath = path.join(this.config.apacheConfigPath, `${subdomain.fullDomain}.conf`);
    
    let config = `<VirtualHost *:80>
    ServerName ${subdomain.fullDomain}
    DocumentRoot ${subdomain.documentRoot}
    DirectoryIndex index.php index.html index.htm

    <Directory ${subdomain.documentRoot}>
        AllowOverride All
        Require all granted
    </Directory>

    # PHP-FPM configuration
    <FilesMatch \\.php$>
        SetHandler "proxy:unix:/run/php/php${subdomain.phpVersion}-fpm.sock|fcgi://localhost"
    </FilesMatch>

    # Security headers
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set X-Content-Type-Options "nosniff"
    Header always set Referrer-Policy "no-referrer-when-downgrade"
    Header always set Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'"
</VirtualHost>
`;

    if (subdomain.sslEnabled) {
      config += `
<VirtualHost *:443>
    ServerName ${subdomain.fullDomain}
    DocumentRoot ${subdomain.documentRoot}
    DirectoryIndex index.php index.html index.htm

    <Directory ${subdomain.documentRoot}>
        AllowOverride All
        Require all granted
    </Directory>

    # PHP-FPM configuration
    <FilesMatch \\.php$>
        SetHandler "proxy:unix:/run/php/php${subdomain.phpVersion}-fpm.sock|fcgi://localhost"
    </FilesMatch>

    # SSL configuration
    SSLEngine on
    SSLCertificateFile ${subdomain.sslCertificate || this.config.sslCertPath}
    SSLCertificateKeyFile ${subdomain.sslKey || this.config.sslKeyPath}
    SSLProtocol all -SSLv3 -TLSv1 -TLSv1.1
    SSLCipherSuite ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256

    # Security headers
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set X-Content-Type-Options "nosniff"
    Header always set Referrer-Policy "no-referrer-when-downgrade"
    Header always set Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'"
</VirtualHost>
`;
    }

    await fs.writeFile(configPath, config);
  }

  /**
   * Remove Nginx configuration
   */
  private async removeNginxConfig(subdomain: Subdomain): Promise<void> {
    const configPath = path.join(this.config.nginxConfigPath, `${subdomain.fullDomain}.conf`);
    if (await fs.pathExists(configPath)) {
      await fs.remove(configPath);
    }
  }

  /**
   * Remove Apache configuration
   */
  private async removeApacheConfig(subdomain: Subdomain): Promise<void> {
    const configPath = path.join(this.config.apacheConfigPath, `${subdomain.fullDomain}.conf`);
    if (await fs.pathExists(configPath)) {
      await fs.remove(configPath);
    }
  }

  /**
   * Reload web servers
   */
  private async reloadWebServers(): Promise<void> {
    try {
      // Reload Nginx
      await execAsync('systemctl reload nginx');
    } catch (error) {
      console.warn('Failed to reload Nginx:', error);
    }

    try {
      // Reload Apache
      await execAsync('systemctl reload apache2');
    } catch (error) {
      console.warn('Failed to reload Apache:', error);
    }
  }

  /**
   * Save subdomains to file
   */
  private async saveSubdomains(): Promise<void> {
    const data = Array.from(this.subdomains.values());
    await fs.writeFile('/var/lib/atulya-panel/subdomains.json', JSON.stringify(data, null, 2));
  }

  /**
   * Load subdomains from file
   */
  async loadSubdomains(): Promise<void> {
    try {
      const data = await fs.readFile('/var/lib/atulya-panel/subdomains.json', 'utf8');
      const subdomains = JSON.parse(data);
      
      this.subdomains.clear();
      for (const subdomain of subdomains) {
        this.subdomains.set(subdomain.id, subdomain);
      }
    } catch (error) {
      // File doesn't exist or is invalid, start with empty map
      this.subdomains.clear();
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  /**
   * Get subdomain statistics
   */
  getStatistics(): {
    total: number;
    active: number;
    inactive: number;
    suspended: number;
    sslEnabled: number;
  } {
    const subdomains = Array.from(this.subdomains.values());
    
    return {
      total: subdomains.length,
      active: subdomains.filter(s => s.status === 'active').length,
      inactive: subdomains.filter(s => s.status === 'inactive').length,
      suspended: subdomains.filter(s => s.status === 'suspended').length,
      sslEnabled: subdomains.filter(s => s.sslEnabled).length,
    };
  }
}