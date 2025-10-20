'use strict';

const express = require('express');
const path = require('path');
const { LocalProvider } = require('../providers/LocalProvider');
const { SystemProvider } = require('../providers/SystemProvider');
const router = express.Router();

// Provider selection based on env
const providerType = process.env.PROVIDER || 'LOCAL';
const provider = providerType === 'SYSTEM' 
	? new SystemProvider({ 
		rootDir: process.env.SITES_ROOT || '/var/www',
		dryRun: process.env.DRY_RUN === 'true'
	})
	: new LocalProvider({ rootDir: path.join(process.cwd(), 'sites') });

router.post('/issue', async (req, res) => {
	try {
		const { domain } = req.body || {};
		if (!domain) return res.status(400).json({ error: 'domain is required' });
		const result = await provider.issueSSL({ domain });
		return res.json({ 
			message: `SSL issued (${providerType})`, 
			...result,
			provider: providerType
		});
	} catch (e) {
		return res.status(500).json({ error: 'Failed to issue SSL', details: String(e) });
	}
});

router.get('/status', async (req, res) => {
	try {
		const { domain } = req.query || {};
		if (!domain) return res.status(400).json({ error: 'domain is required' });
		const status = await provider.getSSLStatus({ domain });
		return res.json({ ...status, provider: providerType });
	} catch (e) {
		return res.status(500).json({ error: 'Failed to get SSL status', details: String(e) });
	}
});

module.exports = router;


