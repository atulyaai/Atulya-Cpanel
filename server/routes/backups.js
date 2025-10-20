'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const { exec } = require('child_process');
const { promisify } = require('util');
const router = express.Router();

const execAsync = promisify(exec);

// Backup storage
const backupDir = path.join(process.cwd(), 'backups');
fs.ensureDirSync(backupDir);

// Provider selection
const { LocalProvider } = require('../providers/LocalProvider');
const { SystemProvider } = require('../providers/SystemProvider');

const providerType = process.env.PROVIDER || 'LOCAL';
const provider = providerType === 'SYSTEM' 
	? new SystemProvider({ 
		rootDir: process.env.SITES_ROOT || '/var/www',
		dryRun: process.env.DRY_RUN === 'true'
	})
	: new LocalProvider({ rootDir: path.join(process.cwd(), 'sites') });

// List backups
router.get('/', async (req, res) => {
	try {
		const files = await fs.readdir(backupDir);
		const backups = await Promise.all(files.map(async (file) => {
			const filePath = path.join(backupDir, file);
			const stats = await fs.stat(filePath);
			return {
				name: file,
				size: stats.size,
				created: stats.birthtime,
				type: file.includes('full') ? 'Full' : 'Incremental'
			};
		}));
		
		backups.sort((a, b) => new Date(b.created) - new Date(a.created));
		res.json(backups);
	} catch (error) {
		res.status(500).json({ error: 'Failed to list backups', details: String(error) });
	}
});

// Create backup
router.post('/', async (req, res) => {
	try {
		const { domain, type = 'full' } = req.body || {};
		if (!domain) return res.status(400).json({ error: 'domain is required' });
		
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const backupName = `${domain}-${type}-${timestamp}.tar.gz`;
		const backupPath = path.join(backupDir, backupName);
		
		if (providerType === 'SYSTEM') {
			// Real backup: tar site + mysqldump
			const sitePath = path.join(provider.rootDir, domain);
			await execAsync(`tar -czf "${backupPath}" -C "${path.dirname(sitePath)}" "${path.basename(sitePath)}"`);
			
			// Add database backup if exists
			const dbBackup = backupPath.replace('.tar.gz', '-db.sql');
			await execAsync(`mysqldump --all-databases > "${dbBackup}"`);
		} else {
			// Mock backup
			await fs.writeFile(backupPath, `Mock backup for ${domain} (${type})`);
		}
		
		res.json({ 
			message: `Backup created (${providerType})`, 
			name: backupName,
			size: (await fs.stat(backupPath)).size,
			provider: providerType
		});
	} catch (error) {
		res.status(500).json({ error: 'Failed to create backup', details: String(error) });
	}
});

// Download backup
router.get('/:filename', async (req, res) => {
	try {
		const { filename } = req.params;
		const filePath = path.join(backupDir, filename);
		
		if (!(await fs.pathExists(filePath))) {
			return res.status(404).json({ error: 'Backup not found' });
		}
		
		res.download(filePath);
	} catch (error) {
		res.status(500).json({ error: 'Failed to download backup', details: String(error) });
	}
});

// Restore backup
router.post('/:filename/restore', async (req, res) => {
	try {
		const { filename } = req.params;
		const { domain } = req.body || {};
		const filePath = path.join(backupDir, filename);
		
		if (!domain) return res.status(400).json({ error: 'domain is required' });
		if (!(await fs.pathExists(filePath))) {
			return res.status(404).json({ error: 'Backup not found' });
		}
		
		if (providerType === 'SYSTEM') {
			// Real restore
			const sitePath = path.join(provider.rootDir, domain);
			await fs.ensureDir(sitePath);
			await execAsync(`tar -xzf "${filePath}" -C "${path.dirname(sitePath)}"`);
		} else {
			// Mock restore
			await fs.ensureDir(path.join(provider.rootDir, domain));
		}
		
		res.json({ message: `Backup restored (${providerType})`, domain, filename });
	} catch (error) {
		res.status(500).json({ error: 'Failed to restore backup', details: String(error) });
	}
});

// Delete backup
router.delete('/:filename', async (req, res) => {
	try {
		const { filename } = req.params;
		const filePath = path.join(backupDir, filename);
		
		await fs.remove(filePath);
		res.json({ message: 'Backup deleted', filename });
	} catch (error) {
		res.status(500).json({ error: 'Failed to delete backup', details: String(error) });
	}
});

module.exports = router;
