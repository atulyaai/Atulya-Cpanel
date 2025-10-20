'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const router = express.Router();

// Provider selection based on env
const { LocalProvider } = require('../providers/LocalProvider');
const { SystemProvider } = require('../providers/SystemProvider');

const providerType = process.env.PROVIDER || 'LOCAL';
const provider = providerType === 'SYSTEM' 
	? new SystemProvider({ 
		rootDir: process.env.SITES_ROOT || '/var/www',
		dryRun: process.env.DRY_RUN === 'true'
	})
	: new LocalProvider({ rootDir: path.join(process.cwd(), 'sites') });

router.post('/wordpress', async (req, res) => {
	try {
		const { domain, documentRoot = 'public_html', dbName, dbUser, dbPass, adminEmail, title } = req.body || {};
		if (!domain) return res.status(400).json({ error: 'domain is required' });

		const { sitePath } = await provider.createSite({ domain, documentRoot });
		if (dbName && dbUser) {
			await provider.createDatabase({ name: dbName, user: dbUser, password: dbPass || '' });
		}
		await provider.installWordPress({ domain, sitePath, adminEmail, title });

		return res.json({ 
			message: `WordPress installation completed (${providerType})`, 
			domain, 
			sitePath,
			provider: providerType
		});
	} catch (e) {
		return res.status(500).json({ error: 'Failed to install WordPress', details: String(e) });
	}
});

module.exports = router;


