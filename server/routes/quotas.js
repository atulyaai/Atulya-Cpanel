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

// Track quotas in memory (in production, use a database)
let quotas = {};

router.get('/quotas', async (req, res) => {
	try {
		const quotaList = [];
		for (const domain in quotas) {
			const quota = quotas[domain];
			if (providerType === 'SYSTEM' && provider.getQuota) {
				const systemQuota = await provider.getQuota({ domain });
				quota.size = systemQuota.size;
			}
			quotaList.push({ domain, ...quota });
		}
		return res.json(quotaList);
	} catch (e) {
		return res.status(500).json({ error: 'Failed to get quotas', details: String(e) });
	}
});

router.post('/quotas', async (req, res) => {
	try {
		const { domain, maxStorage = '1GB', maxDatabases = 5, maxDomains = 1 } = req.body || {};
		if (!domain) return res.status(400).json({ error: 'domain is required' });
		
		quotas[domain] = { maxStorage, maxDatabases, maxDomains, size: '0' };
		
		return res.json({ message: 'Quota set', domain, quota: quotas[domain] });
	} catch (e) {
		return res.status(500).json({ error: 'Failed to set quota', details: String(e) });
	}
});

router.delete('/quotas/:domain', async (req, res) => {
	try {
		const { domain } = req.params;
		delete quotas[domain];
		return res.json({ message: 'Quota removed', domain });
	} catch (e) {
		return res.status(500).json({ error: 'Failed to remove quota', details: String(e) });
	}
});

module.exports = router;
