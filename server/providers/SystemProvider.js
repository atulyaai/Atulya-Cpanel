'use strict';

const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs-extra');

const execAsync = promisify(exec);

class SystemProvider {
	constructor(options = {}) {
		this.rootDir = options.rootDir || '/var/www';
		this.nginxDir = options.nginxDir || '/etc/nginx/sites-available';
		this.phpDir = options.phpDir || '/etc/php/8.1/fpm/pool.d';
		this.dryRun = options.dryRun || false;
	}

	async _exec(command, options = {}) {
		if (this.dryRun) {
			console.log(`[DRY RUN] ${command}`);
			return { stdout: 'dry-run', stderr: '' };
		}
		return execAsync(command, options);
	}

	async createSite({ domain, documentRoot }) {
		const sitePath = path.join(this.rootDir, domain, documentRoot || 'public_html');
		await fs.ensureDir(sitePath);
		
		// Create nginx vhost
		const vhostConfig = `server {
    listen 80;
    server_name ${domain};
    root ${sitePath};
    index index.php index.html;

    location ~ \\.php$ {
        fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
        fastcgi_index index.php;
        include fastcgi_params;
    }
}`;
		
		const vhostFile = path.join(this.nginxDir, domain);
		await fs.writeFile(vhostFile, vhostConfig);
		
		// Enable site and reload nginx
		await this._exec(`ln -sf ${vhostFile} /etc/nginx/sites-enabled/`);
		await this._exec('systemctl reload nginx');
		
		return { sitePath, vhostFile };
	}

	async createDatabase({ name, user, password }) {
		// Create MySQL database and user
		const dbCommands = [
			`CREATE DATABASE IF NOT EXISTS ${name};`,
			`CREATE USER IF NOT EXISTS '${user}'@'localhost' IDENTIFIED BY '${password}';`,
			`GRANT ALL PRIVILEGES ON ${name}.* TO '${user}'@'localhost';`,
			'FLUSH PRIVILEGES;'
		];
		
		for (const cmd of dbCommands) {
			await this._exec(`mysql -e "${cmd}"`);
		}
		
		return { name, user };
	}

	async installWordPress({ domain, sitePath, adminEmail, title }) {
		// Download WordPress
		const wpUrl = 'https://wordpress.org/latest.tar.gz';
		const tempDir = '/tmp/wp-install';
		
		await this._exec(`rm -rf ${tempDir} && mkdir -p ${tempDir}`);
		await this._exec(`wget -q ${wpUrl} -O ${tempDir}/wordpress.tar.gz`);
		await this._exec(`cd ${tempDir} && tar -xzf wordpress.tar.gz`);
		await this._exec(`cp -r ${tempDir}/wordpress/* ${sitePath}/`);
		
		// Set permissions
		await this._exec(`chown -R www-data:www-data ${sitePath}`);
		await this._exec(`chmod -R 755 ${sitePath}`);
		
		return { installed: true, sitePath };
	}

	async issueSSL({ domain }) {
		// Use certbot to issue SSL certificate
		const { stdout } = await this._exec(`certbot --nginx -d ${domain} --non-interactive --agree-tos --email admin@${domain}`);
		return { issued: true, output: stdout };
	}

	async getSSLStatus({ domain }) {
		try {
			const { stdout } = await this._exec(`certbot certificates -d ${domain}`);
			const hasCert = stdout.includes(domain) && stdout.includes('VALID');
			return { domain, status: hasCert ? 'Valid' : 'Not issued' };
		} catch (e) {
			return { domain, status: 'Not issued' };
		}
	}

	async getQuota({ domain }) {
		try {
			const sitePath = path.join(this.rootDir, domain);
			const { stdout } = await this._exec(`du -sh ${sitePath} 2>/dev/null || echo "0"`);
			const size = stdout.split('\t')[0];
			return { domain, size };
		} catch (e) {
			return { domain, size: '0' };
		}
	}
}

module.exports = { SystemProvider };
