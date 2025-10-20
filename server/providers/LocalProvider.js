'use strict';

const path = require('path');
const fs = require('fs-extra');

class LocalProvider {
	constructor(options = {}) {
		this.rootDir = options.rootDir || path.join(process.cwd(), 'sites');
		fs.ensureDirSync(this.rootDir);
	}

	async createSite({ domain, documentRoot }) {
		const sitePath = path.join(this.rootDir, domain, documentRoot || 'public_html');
		await fs.ensureDir(sitePath);
		return { sitePath };
	}

	async createDatabase({ name, user, password }) {
		// Local mock: store a JSON entry; real provider would call mysqladmin etc.
		const dbFile = path.join(this.rootDir, '_local_dbs.json');
		const data = (await fs.pathExists(dbFile)) ? await fs.readJson(dbFile) : {};
		data[name] = { user, password };
		await fs.writeJson(dbFile, data, { spaces: 2 });
		return { name, user };
	}

	async installWordPress({ domain, sitePath }) {
		// Local mock: write a placeholder index.php emulating WP installed
		const indexFile = path.join(sitePath, 'index.php');
		if (!(await fs.pathExists(indexFile))) {
			await fs.outputFile(indexFile, "<?php echo 'WordPress (mock) installed for "+domain+"'; ?>\n");
		}
		return { installed: true, sitePath };
	}

	async issueSSL({ domain }) {
		// Local mock: write a marker file
		const certFile = path.join(this.rootDir, domain, '_ssl_issued.txt');
		await fs.outputFile(certFile, `SSL issued (mock) for ${domain} at ${new Date().toISOString()}\n`);
		return { issued: true };
	}

	async getSSLStatus({ domain }) {
		const certFile = path.join(this.rootDir, domain, '_ssl_issued.txt');
		const exists = await fs.pathExists(certFile);
		return { domain, status: exists ? 'Issued (mock)' : 'Not issued' };
	}
}

module.exports = { LocalProvider };


