'use strict';

const express = require('express');
const path = require('path');
const { LocalProvider } = require('../providers/LocalProvider');
const router = express.Router();

const provider = new LocalProvider({ rootDir: path.join(process.cwd(), 'sites') });

router.post('/update', async (req, res) => {
	// Mock: respond success. Real impl would run WP‑CLI.
	return res.json({ message: 'WordPress updated (mock)' });
});

router.get('/vulnerabilities', async (req, res) => {
	// Mock: no vulnerabilities. Real impl would parse WP‑CLI/outdated.
	return res.json({ status: 'ok', findings: [] });
});

module.exports = router;


