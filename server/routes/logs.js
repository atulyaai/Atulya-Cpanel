'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const { exec } = require('child_process');
const { promisify } = require('util');
const router = express.Router();

const execAsync = promisify(exec);

// Provider selection
const providerType = process.env.PROVIDER || 'LOCAL';

// Get log files
router.get('/files', async (req, res) => {
	try {
		const { domain } = req.query || {};
		
		let logFiles = [];
		
		if (providerType === 'SYSTEM') {
			// Real log files
			const logPaths = [
				'/var/log/nginx/access.log',
				'/var/log/nginx/error.log',
				'/var/log/php8.1-fpm.log',
				'/var/log/syslog'
			];
			
			for (const logPath of logPaths) {
				try {
					const stats = await fs.stat(logPath);
					logFiles.push({
						name: path.basename(logPath),
						path: logPath,
						size: stats.size,
						modified: stats.mtime,
						type: 'system'
					});
				} catch (e) {
					// Log file doesn't exist
				}
			}
			
			// Domain-specific logs
			if (domain) {
				const domainLogPath = `/var/log/nginx/${domain}.log`;
				try {
					const stats = await fs.stat(domainLogPath);
					logFiles.push({
						name: `${domain}.log`,
						path: domainLogPath,
						size: stats.size,
						modified: stats.mtime,
						type: 'domain'
					});
				} catch (e) {
					// Domain log doesn't exist
				}
			}
		} else {
			// Mock log files
			logFiles = [
				{ name: 'access.log', path: '/var/log/nginx/access.log', size: 1024, modified: new Date(), type: 'system' },
				{ name: 'error.log', path: '/var/log/nginx/error.log', size: 512, modified: new Date(), type: 'system' },
				{ name: 'php-fpm.log', path: '/var/log/php8.1-fpm.log', size: 256, modified: new Date(), type: 'system' }
			];
		}
		
		res.json(logFiles);
	} catch (error) {
		res.status(500).json({ error: 'Failed to list log files', details: String(error) });
	}
});

// Read log content
router.get('/content', async (req, res) => {
	try {
		const { file, lines = 100 } = req.query || {};
		if (!file) return res.status(400).json({ error: 'file parameter is required' });
		
		let content = '';
		
		if (providerType === 'SYSTEM') {
			// Real log reading with tail
			const { stdout } = await execAsync(`tail -n ${lines} "${file}"`);
			content = stdout;
		} else {
			// Mock log content
			content = `[${new Date().toISOString()}] Mock log entry for ${path.basename(file)}\n`.repeat(10);
		}
		
		res.json({ content, file, lines: parseInt(lines) });
	} catch (error) {
		res.status(500).json({ error: 'Failed to read log file', details: String(error) });
	}
});

// Follow log (WebSocket would be better, but using polling for simplicity)
router.get('/follow', async (req, res) => {
	try {
		const { file, since } = req.query || {};
		if (!file) return res.status(400).json({ error: 'file parameter is required' });
		
		let content = '';
		
		if (providerType === 'SYSTEM') {
			// Real log following
			const sinceParam = since ? `--since="${since}"` : '';
			const { stdout } = await execAsync(`tail -f ${sinceParam} "${file}" | head -50`);
			content = stdout;
		} else {
			// Mock new log entries
			content = `[${new Date().toISOString()}] New mock log entry\n`;
		}
		
		res.json({ content, file, timestamp: new Date().toISOString() });
	} catch (error) {
		res.status(500).json({ error: 'Failed to follow log file', details: String(error) });
	}
});

// Clear log file
router.post('/clear', async (req, res) => {
	try {
		const { file } = req.body || {};
		if (!file) return res.status(400).json({ error: 'file parameter is required' });
		
		if (providerType === 'SYSTEM') {
			// Real log clearing
			await execAsync(`echo "" > "${file}"`);
		} else {
			// Mock log clearing
			console.log(`[MOCK] Would clear log: ${file}`);
		}
		
		res.json({ message: 'Log file cleared', file });
	} catch (error) {
		res.status(500).json({ error: 'Failed to clear log file', details: String(error) });
	}
});

module.exports = router;
