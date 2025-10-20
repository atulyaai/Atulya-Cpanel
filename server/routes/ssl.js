'use strict';

const express = require('express');
const path = require('path');
const { LocalProvider } = require('../providers/LocalProvider');
const router = express.Router();

const provider = new LocalProvider({ rootDir: path.join(process.cwd(), 'sites') });

router.post('/issue', async (req, res) => {
	try {
		const { domain } = req.body || {};
		if (!domain) return res.status(400).json({ error: 'domain is required' });
		const result = await provider.issueSSL({ domain });
		return res.json({ message: 'SSL issued (mock)', ...result });
	} catch (e) {
		return res.status(500).json({ error: 'Failed to issue SSL', details: String(e) });
	}
});

router.get('/status', async (req, res) => {
	try {
		const { domain } = req.query || {};
		if (!domain) return res.status(400).json({ error: 'domain is required' });
		const status = await provider.getSSLStatus({ domain });
		return res.json(status);
	} catch (e) {
		return res.status(500).json({ error: 'Failed to get SSL status', details: String(e) });
	}
});

module.exports = router;


