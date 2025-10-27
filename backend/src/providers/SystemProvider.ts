import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs-extra';
import { env } from '../config/env.js';
import { PHPProvider } from './PHPProvider.js';

const execAsync = promisify(exec);

export interface SiteConfig {
  domain: string;
  documentRoot: string;
  phpVersion: string;
  sslEnabled: boolean;
  sslCert?: string;
  sslKey?: string;
  aliases?: string[];
  redirects?: Array<{ from: string; to: string; type: 'permanent' | 'temporary' }>;
  customConfig?: string;
}

export interface VirtualHost {
  domain: string;
  configPath: string;
  enabled: boolean;
  sslEnabled: boolean;
  phpVersion: string;
  documentRoot: string;
}

export class SystemProvider {
  private rootDir: string;
  private nginxDir: string;
  private nginxEnabledDir: string;
  private apacheDir: string;
  private apacheEnabledDir: string;
  private dryRun: boolean;
  private phpProvider: PHPProvider;

  constructor(options: any = {}) {
    this.rootDir = options.rootDir || env.SITES_ROOT;
    this.nginxDir = options.nginxDir || '/etc/nginx/sites-available';
    this.nginxEnabledDir = options.nginxEnabledDir || '/etc/nginx/sites-enabled';
    this.apacheDir = options.apacheDir || '/etc/apache2/sites-available';
    this.apacheEnabledDir = options.apacheEnabledDir || '/etc/apache2/sites-enabled';
    this.dryRun = options.dryRun || env.DRY_RUN === 'true';
    this.phpProvider = new PHPProvider();
  }

  async _exec(command: string, options: any = {}) {
    if (this.dryRun) {
      return { stdout: 'dry-run', stderr: '' };
    }
    return execAsync(command, options);
  }

  /**
   * Create a new site with Nginx and Apache configuration
   */
  async createSite(config: SiteConfig): Promise<{
    sitePath: string;
    nginxConfig: string;
    apacheConfig: string;
    phpPool: string;
  }> {
    const sitePath = path.join(this.rootDir, config.domain, config.documentRoot || 'public_html');
    
    // Create site directory
    await fs.ensureDir(sitePath);
    
    // Create default index.html
    const indexContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to ${config.domain}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; text-align: center; }
        .info { background: #e8f4fd; padding: 20px; border-radius: 4px; margin: 20px 0; }
        .status { color: #28a745; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎉 Site Created Successfully!</h1>
        <div class="info">
            <p><strong>Domain:</strong> ${config.domain}</p>
            <p><strong>Document Root:</strong> ${sitePath}</p>
            <p><strong>PHP Version:</strong> ${config.phpVersion}</p>
            <p><strong>SSL:</strong> <span class="status">${config.sslEnabled ? 'Enabled' : 'Disabled'}</span></p>
        </div>
        <p>Your site is now ready! Upload your files to the document root directory.</p>
    </div>
</body>
</html>`;
    
    await fs.writeFile(path.join(sitePath, 'index.html'), indexContent);
    
    // Create PHP-FPM pool
    const phpPool = await this.phpProvider.createPool(config.domain, config.phpVersion);
    
    // Create Nginx configuration
    const nginxConfig = await this.createNginxConfig(config, sitePath, phpPool.listen);
    
    // Create Apache configuration
    const apacheConfig = await this.createApacheConfig(config, sitePath);
    
    // Enable site configurations
    await this.enableSite(config.domain, 'nginx');
    await this.enableSite(config.domain, 'apache');
    
    // Reload services
    await this.reloadNginx();
    await this.reloadApache();
    
    return {
      sitePath,
      nginxConfig,
      apacheConfig,
      phpPool: phpPool.name,
    };
  }

  /**
   * Create Nginx virtual host configuration
   */
  private async createNginxConfig(config: SiteConfig, sitePath: string, phpSocket: string): Promise<string> {
    const configContent = `# Nginx configuration for ${config.domain}
server {
    listen 80;
    server_name ${config.domain}${config.aliases ? ' ' + config.aliases.join(' ') : ''};
    root ${sitePath};
    index index.php index.html index.htm;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Main location block
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    # PHP processing
    location ~ \\.php$ {
        fastcgi_pass unix:${phpSocket};
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_hide_header X-Powered-By;
    }

    # Deny access to hidden files
    location ~ /\\. {
        deny all;
    }

    # Deny access to sensitive files
    location ~* \\.(env|log|sql|conf|bak)$ {
        deny all;
    }

    # Static files caching
    location ~* \\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # Custom configuration
    ${config.customConfig || ''}
}

${config.sslEnabled ? `
# SSL configuration for ${config.domain}
server {
    listen 443 ssl http2;
    server_name ${config.domain}${config.aliases ? ' ' + config.aliases.join(' ') : ''};
    root ${sitePath};
    index index.php index.html index.htm;

    # SSL configuration
    ssl_certificate ${config.sslCert || '/etc/letsencrypt/live/' + config.domain + '/fullchain.pem'};
    ssl_certificate_key ${config.sslKey || '/etc/letsencrypt/live/' + config.domain + '/privkey.pem'};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Main location block
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    # PHP processing
    location ~ \\.php$ {
        fastcgi_pass unix:${phpSocket};
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_hide_header X-Powered-By;
    }

    # Deny access to hidden files
    location ~ /\\. {
        deny all;
    }

    # Deny access to sensitive files
    location ~* \\.(env|log|sql|conf|bak)$ {
        deny all;
    }

    # Static files caching
    location ~* \\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # Custom configuration
    ${config.customConfig || ''}
}
` : ''}`;

    const configPath = path.join(this.nginxDir, config.domain);
    await fs.writeFile(configPath, configContent);
    
    return configContent;
  }

  /**
   * Create Apache virtual host configuration
   */
  private async createApacheConfig(config: SiteConfig, sitePath: string): Promise<string> {
    const configContent = `<VirtualHost *:8080>
    ServerName ${config.domain}
    ${config.aliases ? config.aliases.map(alias => `ServerAlias ${alias}`).join('\n    ') : ''}
    DocumentRoot ${sitePath}
    
    <Directory ${sitePath}>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
        
        # Security
        <Files ~ "\\.(env|log|sql|conf|bak)$">
            Require all denied
        </Files>
        
        <Files ~ "^\\.ht">
            Require all denied
        </Files>
    </Directory>
    
    # PHP configuration
    <FilesMatch \\.php$>
        SetHandler "proxy:unix:${this.phpProvider.getSocketPath(config.phpVersion)}|fcgi://localhost"
    </FilesMatch>
    
    # Logging
    ErrorLog \${APACHE_LOG_DIR}/${config.domain}_error.log
    CustomLog \${APACHE_LOG_DIR}/${config.domain}_access.log combined
    
    # Security headers
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set X-Content-Type-Options "nosniff"
    Header always set Referrer-Policy "no-referrer-when-downgrade"
    
    ${config.customConfig || ''}
</VirtualHost>

${config.sslEnabled ? `
<VirtualHost *:8443>
    ServerName ${config.domain}
    ${config.aliases ? config.aliases.map(alias => `ServerAlias ${alias}`).join('\n    ') : ''}
    DocumentRoot ${sitePath}
    
    SSLEngine on
    SSLCertificateFile ${config.sslCert || '/etc/letsencrypt/live/' + config.domain + '/cert.pem'}
    SSLCertificateKeyFile ${config.sslKey || '/etc/letsencrypt/live/' + config.domain + '/privkey.pem'}
    SSLCertificateChainFile ${config.sslCert || '/etc/letsencrypt/live/' + config.domain + '/chain.pem'}
    
    <Directory ${sitePath}>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
        
        # Security
        <Files ~ "\\.(env|log|sql|conf|bak)$">
            Require all denied
        </Files>
        
        <Files ~ "^\\.ht">
            Require all denied
        </Files>
    </Directory>
    
    # PHP configuration
    <FilesMatch \\.php$>
        SetHandler "proxy:unix:${this.phpProvider.getSocketPath(config.phpVersion)}|fcgi://localhost"
    </FilesMatch>
    
    # Logging
    ErrorLog \${APACHE_LOG_DIR}/${config.domain}_ssl_error.log
    CustomLog \${APACHE_LOG_DIR}/${config.domain}_ssl_access.log combined
    
    # Security headers
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set X-Content-Type-Options "nosniff"
    Header always set Referrer-Policy "no-referrer-when-downgrade"
    
    ${config.customConfig || ''}
</VirtualHost>
` : ''}`;

    const configPath = path.join(this.apacheDir, config.domain + '.conf');
    await fs.writeFile(configPath, configContent);
    
    return configContent;
  }

  /**
   * Enable site configuration
   */
  async enableSite(domain: string, service: 'nginx' | 'apache'): Promise<void> {
    if (service === 'nginx') {
      const source = path.join(this.nginxDir, domain);
      const target = path.join(this.nginxEnabledDir, domain);
      await this._exec(`ln -sf ${source} ${target}`);
    } else if (service === 'apache') {
      await this._exec(`a2ensite ${domain}`);
    }
  }

  /**
   * Disable site configuration
   */
  async disableSite(domain: string, service: 'nginx' | 'apache'): Promise<void> {
    if (service === 'nginx') {
      await this._exec(`rm -f ${path.join(this.nginxEnabledDir, domain)}`);
    } else if (service === 'apache') {
      await this._exec(`a2dissite ${domain}`);
    }
  }

  /**
   * Delete site
   */
  async deleteSite(domain: string): Promise<void> {
    // Disable configurations
    await this.disableSite(domain, 'nginx');
    await this.disableSite(domain, 'apache');
    
    // Remove configuration files
    await fs.remove(path.join(this.nginxDir, domain));
    await fs.remove(path.join(this.apacheDir, domain + '.conf'));
    
    // Remove site directory
    const sitePath = path.join(this.rootDir, domain);
    await fs.remove(sitePath);
    
    // Delete PHP-FPM pool
    const phpVersions = this.phpProvider.getAvailableVersions();
    for (const version of phpVersions) {
      try {
        await this.phpProvider.deletePool(`${domain}_pool`, version);
      } catch (error) {
        // Pool might not exist, ignore error
      }
    }
    
    // Reload services
    await this.reloadNginx();
    await this.reloadApache();
  }

  /**
   * List all sites
   */
  async listSites(): Promise<VirtualHost[]> {
    const sites: VirtualHost[] = [];
    
    // Get Nginx sites
    try {
      const nginxFiles = await fs.readdir(this.nginxDir);
      for (const file of nginxFiles) {
        if (file !== 'default') {
          const configPath = path.join(this.nginxDir, file);
          const enabledPath = path.join(this.nginxEnabledDir, file);
          const enabled = await fs.pathExists(enabledPath);
          
          // Parse configuration to get details
          const config = await this.parseNginxConfig(configPath);
          
          sites.push({
            domain: file,
            configPath,
            enabled,
            sslEnabled: config.sslEnabled,
            phpVersion: config.phpVersion,
            documentRoot: config.documentRoot,
          });
        }
      }
    } catch (error) {
      
    }
    
    return sites;
  }

  /**
   * Parse Nginx configuration
   */
  private async parseNginxConfig(configPath: string): Promise<{
    sslEnabled: boolean;
    phpVersion: string;
    documentRoot: string;
  }> {
    try {
      const content = await fs.readFile(configPath, 'utf8');
      const sslEnabled = content.includes('listen 443');
      
      const phpVersionMatch = content.match(/php(\d+\.\d+)-fpm\.sock/);
      const phpVersion = phpVersionMatch ? phpVersionMatch[1] : '8.2';
      
      const rootMatch = content.match(/root\s+([^;]+);/);
      const documentRoot = rootMatch ? rootMatch[1].trim() : '/var/www/html';
      
      return {
        sslEnabled,
        phpVersion,
        documentRoot,
      };
    } catch (error) {
      return {
        sslEnabled: false,
        phpVersion: '8.2',
        documentRoot: '/var/www/html',
      };
    }
  }

  /**
   * Reload Nginx
   */
  async reloadNginx(): Promise<void> {
    await this._exec('systemctl reload nginx');
  }

  /**
   * Reload Apache
   */
  async reloadApache(): Promise<void> {
    await this._exec('systemctl reload apache2');
  }

  /**
   * Test Nginx configuration
   */
  async testNginxConfig(): Promise<boolean> {
    try {
      await this._exec('nginx -t');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Test Apache configuration
   */
  async testApacheConfig(): Promise<boolean> {
    try {
      await this._exec('apache2ctl configtest');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get service status
   */
  async getServiceStatus(): Promise<{
    nginx: { active: boolean; running: boolean };
    apache: { active: boolean; running: boolean };
  }> {
    const nginxStatus = await this.getIndividualServiceStatus('nginx');
    const apacheStatus = await this.getIndividualServiceStatus('apache2');
    
    return {
      nginx: nginxStatus,
      apache: apacheStatus,
    };
  }

  /**
   * Get individual service status
   */
  private async getIndividualServiceStatus(service: string): Promise<{ active: boolean; running: boolean }> {
    try {
      const { stdout } = await this._exec(`systemctl is-active ${service}`);
      const isActive = stdout.trim() === 'active';
      
      const { stdout: statusOutput } = await this._exec(`systemctl status ${service} --no-pager`);
      const isRunning = statusOutput.includes('Active: active (running)');
      
      return { active: isActive, running: isRunning };
    } catch (error) {
      return { active: false, running: false };
    }
  }

  /**
   * Get site quota/usage
   */
  async getSiteQuota(domain: string): Promise<{ size: string; files: number; directories: number }> {
    try {
      const sitePath = path.join(this.rootDir, domain);
      const { stdout } = await this._exec(`du -sh ${sitePath} 2>/dev/null || echo "0"`);
      const size = stdout.split('\t')[0];
      
      const { stdout: fileCount } = await this._exec(`find ${sitePath} -type f | wc -l`);
      const { stdout: dirCount } = await this._exec(`find ${sitePath} -type d | wc -l`);
      
      return {
        size,
        files: parseInt(fileCount.trim()) || 0,
        directories: parseInt(dirCount.trim()) || 0,
      };
    } catch (error) {
      return {
        size: '0',
        files: 0,
        directories: 0,
      };
    }
  }

  /**
   * Install WordPress
   */
  async installWordPress(config: {
    domain: string;
    sitePath: string;
    adminEmail: string;
    title: string;
    databaseName: string;
    databaseUser: string;
    databasePassword: string;
  }): Promise<{ installed: boolean; sitePath: string }> {
    const wpUrl = 'https://wordpress.org/latest.tar.gz';
    const tempDir = '/tmp/wp-install';
    
    try {
      // Download and extract WordPress
      await this._exec(`rm -rf ${tempDir} && mkdir -p ${tempDir}`);
      await this._exec(`wget -q ${wpUrl} -O ${tempDir}/wordpress.tar.gz`);
      await this._exec(`cd ${tempDir} && tar -xzf wordpress.tar.gz`);
      await this._exec(`cp -r ${tempDir}/wordpress/* ${config.sitePath}/`);
      
      // Create wp-config.php
      const wpConfig = `<?php
define('DB_NAME', '${config.databaseName}');
define('DB_USER', '${config.databaseUser}');
define('DB_PASSWORD', '${config.databasePassword}');
define('DB_HOST', 'localhost');
define('DB_CHARSET', 'utf8mb4');
define('DB_COLLATE', '');

// Security keys
define('AUTH_KEY', '${this.generateRandomString(64)}');
define('SECURE_AUTH_KEY', '${this.generateRandomString(64)}');
define('LOGGED_IN_KEY', '${this.generateRandomString(64)}');
define('NONCE_KEY', '${this.generateRandomString(64)}');
define('AUTH_SALT', '${this.generateRandomString(64)}');
define('SECURE_AUTH_SALT', '${this.generateRandomString(64)}');
define('LOGGED_IN_SALT', '${this.generateRandomString(64)}');
define('NONCE_SALT', '${this.generateRandomString(64)}');

$table_prefix = 'wp_';

define('WP_DEBUG', false);

if ( ! defined( 'ABSPATH' ) ) {
    define( 'ABSPATH', __DIR__ . '/' );
}

require_once ABSPATH . 'wp-settings.php';`;
      
      await fs.writeFile(path.join(config.sitePath, 'wp-config.php'), wpConfig);
      
      // Set permissions
      await this._exec(`chown -R www-data:www-data ${config.sitePath}`);
      await this._exec(`chmod -R 755 ${config.sitePath}`);
      await this._exec(`chmod 644 ${path.join(config.sitePath, 'wp-config.php')}`);
      
      return { installed: true, sitePath: config.sitePath };
    } catch (error) {
      console.error('Failed to install WordPress:', error);
      throw new Error(`Failed to install WordPress: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate random string
   */
  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Cleanup any temporary files or connections
  }
}
