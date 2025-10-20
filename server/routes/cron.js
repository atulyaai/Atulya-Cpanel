'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const { exec } = require('child_process');
const { promisify } = require('util');
const router = express.Router();

const execAsync = promisify(exec);

// Cron storage
const cronFile = path.join(process.cwd(), 'cron-jobs.json');
let cronJobs = {};

// Load existing cron jobs
(async () => {
	try {
		if (await fs.pathExists(cronFile)) {
			cronJobs = await fs.readJson(cronFile);
		}
	} catch (e) {
		console.warn('Failed to load cron jobs:', e.message);
	}
})();

// Save cron jobs
async function saveCronJobs() {
	await fs.writeJson(cronFile, cronJobs, { spaces: 2 });
}

// Provider selection
const providerType = process.env.PROVIDER || 'LOCAL';

// List cron jobs
router.get('/', async (req, res) => {
	try {
		const { domain } = req.query || {};
		let jobs = Object.values(cronJobs);
		
		if (domain) {
			jobs = jobs.filter(job => job.domain === domain);
		}
		
		res.json(jobs);
	} catch (error) {
		res.status(500).json({ error: 'Failed to list cron jobs', details: String(error) });
	}
});

// Add cron job
router.post('/', async (req, res) => {
	try {
		const { domain, schedule, command, description } = req.body || {};
		if (!domain || !schedule || !command) {
			return res.status(400).json({ error: 'domain, schedule, and command are required' });
		}
		
		const jobId = Date.now().toString();
		const job = {
			id: jobId,
			domain,
			schedule,
			command,
			description: description || '',
			created: new Date().toISOString(),
			enabled: true
		};
		
		cronJobs[jobId] = job;
		await saveCronJobs();
		
		if (providerType === 'SYSTEM') {
			// Add to system crontab (mock for now)
			console.log(`[CRON] Would add: ${schedule} ${command}`);
		}
		
		res.json({ message: 'Cron job added', job });
	} catch (error) {
		res.status(500).json({ error: 'Failed to add cron job', details: String(error) });
	}
});

// Update cron job
router.put('/:id', async (req, res) => {
	try {
		const { id } = req.params;
		const { schedule, command, description, enabled } = req.body || {};
		
		if (!cronJobs[id]) {
			return res.status(404).json({ error: 'Cron job not found' });
		}
		
		const job = cronJobs[id];
		if (schedule !== undefined) job.schedule = schedule;
		if (command !== undefined) job.command = command;
		if (description !== undefined) job.description = description;
		if (enabled !== undefined) job.enabled = enabled;
		
		await saveCronJobs();
		res.json({ message: 'Cron job updated', job });
	} catch (error) {
		res.status(500).json({ error: 'Failed to update cron job', details: String(error) });
	}
});

// Delete cron job
router.delete('/:id', async (req, res) => {
	try {
		const { id } = req.params;
		
		if (!cronJobs[id]) {
			return res.status(404).json({ error: 'Cron job not found' });
		}
		
		delete cronJobs[id];
		await saveCronJobs();
		
		res.json({ message: 'Cron job deleted', id });
	} catch (error) {
		res.status(500).json({ error: 'Failed to delete cron job', details: String(error) });
	}
});

// Execute cron job manually
router.post('/:id/execute', async (req, res) => {
	try {
		const { id } = req.params;
		const job = cronJobs[id];
		
		if (!job) {
			return res.status(404).json({ error: 'Cron job not found' });
		}
		
		if (providerType === 'SYSTEM') {
			const { stdout, stderr } = await execAsync(job.command);
			res.json({ message: 'Cron job executed', output: stdout, error: stderr });
		} else {
			res.json({ message: 'Cron job executed (mock)', command: job.command });
		}
	} catch (error) {
		res.status(500).json({ error: 'Failed to execute cron job', details: String(error) });
	}
});

module.exports = router;
