'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const router = express.Router();

// Provider selection (LOCAL only for now)
const { LocalProvider } = require('../providers/LocalProvider');
const provider = new LocalProvider({ rootDir: path.join(process.cwd(), 'sites') });

router.post('/wordpress', async (req, res) => {
	try {
		const { domain, documentRoot = 'public_html', dbName, dbUser, dbPass, adminEmail, title } = req.body || {};
		if (!domain) return res.status(400).json({ error: 'domain is required' });

		const { sitePath } = await provider.createSite({ domain, documentRoot });
		if (dbName && dbUser) {
			await provider.createDatabase({ name: dbName, user: dbUser, password: dbPass || '' });
		}
		await provider.installWordPress({ domain, sitePath, adminEmail, title });

		return res.json({ message: 'WordPress (mock) installation completed', domain, sitePath });
	} catch (e) {
		return res.status(500).json({ error: 'Failed to install WordPress', details: String(e) });
	}
});

module.exports = router;


