const viewRoot = document.getElementById('view-root');
const sidebarNav = document.getElementById('sidebar-nav');
const themeToggle = document.getElementById('theme-toggle');
const sidebarCollapse = document.getElementById('sidebar-collapse');
const cmdkRoot = document.getElementById('cmdk');
const cmdkInput = document.getElementById('cmdk-input');
const cmdkList = document.getElementById('cmdk-list');
const appRoot = document.querySelector('.app');
const toastsRoot = document.getElementById('toasts');

// API base URL
const API_BASE = window.location.origin + '/api';

function setActive(view) {
	[...sidebarNav.querySelectorAll('.nav__item')].forEach(btn => {
		btn.classList.toggle('is-active', btn.dataset.view === view);
	});
}

function render(view) {
	switch (view) {
		case 'files':
			return renderFiles();
		case 'databases':
			return renderDatabases();
		case 'email':
			return renderEmail();
		case 'domains':
			return renderDomains();
		case 'users':
			return renderUsers();
		case 'security':
			return renderSecurity();
		case 'backups':
			return renderBackups();
		case 'cron':
			return renderCron();
		case 'logs':
			return renderLogs();
		case 'settings':
			return renderSettings();
		default:
			return renderDashboard();
	}
}

function mount(html) {
	viewRoot.innerHTML = html;
}

function renderDashboard() {
	mount(`
		<div class="cards">
			<div class="card">
				<div class="kpi"><span class="kpi__dot"></span><div>
					<div class="card__title">CPU</div>
					<div class="card__value" id="kpi-cpu">17%</div>
				</div></div>
				<div class="meter" style="margin-top:10px"><div id="meter-cpu" class="meter__fill" style="width:17%"></div></div>
			</div>
			<div class="card">
				<div class="kpi"><span class="kpi__dot" style="background: var(--success)"></span><div>
					<div class="card__title">Memory</div>
					<div class="card__value" id="kpi-mem">3.1 GB / 8 GB</div>
				</div></div>
				<div class="meter" style="margin-top:10px"><div id="meter-mem" class="meter__fill" style="width:39%"></div></div>
			</div>
			<div class="card">
				<div class="kpi"><span class="kpi__dot" style="background: var(--warning)"></span><div>
					<div class="card__title">Disk</div>
					<div class="card__value" id="kpi-disk">42% used</div>
				</div></div>
				<div class="meter" style="margin-top:10px"><div id="meter-disk" class="meter__fill" style="width:42%"></div></div>
			</div>
			<div class="card">
				<div class="kpi"><span class="kpi__dot" style="background: var(--danger)"></span><div>
					<div class="card__title">Bandwidth</div>
					<div class="card__value" id="kpi-net">12.4 GB</div>
				</div></div>
			</div>
		</div>

		<div class="panel" style="margin-top:16px;">
			<div class="panel__header">
				<div class="panel__title">Recent Activity</div>
				<div>
					<button class="btn btn--ghost" id="act-refresh">Refresh</button>
					<button class="btn" id="act-quick-backup">Quick backup</button>
				</div>
			</div>
			<table class="table">
				<thead>
					<tr><th>Time</th><th>Action</th><th>Status</th></tr>
				</thead>
				<tbody>
					<tr><td>12:31</td><td>Created subdomain demo.atulya</td><td><span class="pill">Success</span></td></tr>
					<tr><td>11:58</td><td>Deployed app build</td><td><span class="pill">Success</span></td></tr>
					<tr><td>11:21</td><td>Backup completed</td><td><span class="pill">Success</span></td></tr>
				</tbody>
			</table>
		</div>
	`);

	// Load real stats from API
	loadStats();
	
	// Buttons
	document.getElementById('act-refresh').addEventListener('click', () => {
		loadStats();
		showToast('Dashboard data refreshed');
	});
	document.getElementById('act-quick-backup').addEventListener('click', async () => {
		try {
			await fetch(`${API_BASE}/backups`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'full' })
			});
			showToast('Backup started');
		} catch (error) {
			showToast('Failed to start backup');
		}
	});

	// Simulated live updates
	let cpu = 17, mem = 39, disk = 42;
	const cpuEl = document.getElementById('kpi-cpu');
	const memEl = document.getElementById('kpi-mem');
	const diskEl = document.getElementById('kpi-disk');
	const cpuMeter = document.getElementById('meter-cpu');
	const memMeter = document.getElementById('meter-mem');
	const diskMeter = document.getElementById('meter-disk');
	const timer = setInterval(() => {
		cpu = clamp(cpu + rand(-3, 3), 4, 92);
		mem = clamp(mem + rand(-2, 2), 10, 85);
		disk = clamp(disk + rand(-1, 1), 25, 90);
		cpuEl.textContent = `${cpu}%`;
		memEl.textContent = `${(mem/100*8).toFixed(1)} GB / 8 GB`;
		diskEl.textContent = `${disk}% used`;
		cpuMeter.style.width = `${cpu}%`;
		memMeter.style.width = `${mem}%`;
		diskMeter.style.width = `${disk}%`;
	}, 2500);

	// Clean up on view change
	viewRoot._cleanup = () => clearInterval(timer);
}

async function loadStats() {
	try {
		const response = await fetch(`${API_BASE}/stats`);
		const stats = await response.json();
		
		const cpuEl = document.getElementById('kpi-cpu');
		const memEl = document.getElementById('kpi-mem');
		const diskEl = document.getElementById('kpi-disk');
		const cpuMeter = document.getElementById('meter-cpu');
		const memMeter = document.getElementById('meter-mem');
		const diskMeter = document.getElementById('meter-disk');
		
		if (cpuEl) cpuEl.textContent = `${stats.cpu}%`;
		if (memEl) memEl.textContent = `${(stats.memory/100*8).toFixed(1)} GB / 8 GB`;
		if (diskEl) diskEl.textContent = `${stats.disk}% used`;
		if (cpuMeter) cpuMeter.style.width = `${stats.cpu}%`;
		if (memMeter) memMeter.style.width = `${stats.memory}%`;
		if (diskMeter) diskMeter.style.width = `${stats.disk}%`;
	} catch (error) {
		console.error('Failed to load stats:', error);
	}
}

function renderFiles() {
	mount(`
		<div class="panel">
			<div class="panel__header">
				<div class="panel__title">File Manager</div>
				<form id="upload-form" style="display:inline-flex; gap:10px; align-items:center">
					<label class="btn">
						<input id="file-input" type="file" multiple style="display:none" />Upload
					</label>
					<button type="button" id="btn-new-folder" class="btn btn--ghost">New folder</button>
				</form>
			</div>
			<table class="table">
				<thead>
					<tr><th>Name</th><th>Size</th><th>Modified</th><th>Actions</th></tr>
				</thead>
				<tbody id="file-list">
					<tr><td colspan="4" style="text-align: center; color: var(--muted);">Loading files...</td></tr>
				</tbody>
			</table>
		</div>
	`);

	loadFiles();

	const fileInput = document.getElementById('file-input');
	const fileList = document.getElementById('file-list');
	const btnNewFolder = document.getElementById('btn-new-folder');

	fileInput.addEventListener('change', async () => {
		const formData = new FormData();
		[...fileInput.files].forEach(file => {
			formData.append('files', file);
		});

		try {
			const response = await fetch(`${API_BASE}/files/upload`, {
				method: 'POST',
				body: formData
			});
			const result = await response.json();
			showToast(result.message);
			loadFiles(); // Reload file list
		} catch (error) {
			showToast('Upload failed');
		}
	});

	btnNewFolder.addEventListener('click', async () => {
		const name = prompt('Folder name');
		if (!name) return;
		
		try {
			const response = await fetch(`${API_BASE}/files/folder`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name })
			});
			const result = await response.json();
			showToast(result.message);
			loadFiles(); // Reload file list
		} catch (error) {
			showToast('Failed to create folder');
		}
	});

	// Drag and drop
	viewRoot.addEventListener('dragover', (e) => { e.preventDefault(); });
	viewRoot.addEventListener('drop', async (e) => {
		e.preventDefault();
		const files = e.dataTransfer.files;
		
		const formData = new FormData();
		[...files].forEach(file => {
			formData.append('files', file);
		});

		try {
			const response = await fetch(`${API_BASE}/files/upload`, {
				method: 'POST',
				body: formData
			});
			const result = await response.json();
			showToast(result.message);
			loadFiles(); // Reload file list
		} catch (error) {
			showToast('Upload failed');
		}
	});
}

async function loadFiles() {
	try {
		const response = await fetch(`${API_BASE}/files`);
		const files = await response.json();
		
		const fileList = document.getElementById('file-list');
		if (files.length === 0) {
			fileList.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--muted);">No files found</td></tr>';
			return;
		}
		
		fileList.innerHTML = files.map(file => `
			<tr>
				<td>${file.name}</td>
				<td>${file.isDirectory ? '—' : formatSize(file.size)}</td>
				<td>${new Date(file.modified).toLocaleDateString()}</td>
				<td>
					<div class="actions">
						${!file.isDirectory ? `<button class="btn btn--sm btn--ghost" onclick="downloadFile('${file.name}')">Download</button>` : ''}
						<button class="btn btn--sm btn--danger" onclick="deleteFile('${file.name}')">Delete</button>
					</div>
				</td>
			</tr>
		`).join('');
	} catch (error) {
		console.error('Failed to load files:', error);
		const fileList = document.getElementById('file-list');
		fileList.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--danger);">Failed to load files</td></tr>';
	}
}

window.downloadFile = async (filename) => {
	try {
		const response = await fetch(`${API_BASE}/files/${filename}`);
		if (response.ok) {
			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			a.click();
			window.URL.revokeObjectURL(url);
			showToast(`Downloaded ${filename}`);
		} else {
			showToast('Download failed');
		}
	} catch (error) {
		showToast('Download failed');
	}
};

window.deleteFile = async (filename) => {
	if (!confirm(`Delete "${filename}"?`)) return;
	
	try {
		const response = await fetch(`${API_BASE}/files/${filename}`, {
			method: 'DELETE'
		});
		const result = await response.json();
		showToast(result.message);
		loadFiles(); // Reload file list
	} catch (error) {
		showToast('Delete failed');
	}
};

function renderDatabases() {
	mount(`
		<div class="panel">
			<div class="panel__header">
				<div class="panel__title">Databases</div>
				<button class="btn" id="btn-create-db">Create database</button>
			</div>
			<table class="table">
				<thead><tr><th>Name</th><th>Users</th><th>Size</th><th>Actions</th></tr></thead>
				<tbody id="db-list">
					<tr><td colspan="4" style="text-align: center; color: var(--muted);">Loading databases...</td></tr>
				</tbody>
			</table>
		</div>
	`);

	loadDatabases();

	document.getElementById('btn-create-db').addEventListener('click', () => {
		showModal('Create Database', `
			<div class="form-group">
				<label class="form-label">Database Name</label>
				<input type="text" class="form-input" id="db-name" placeholder="my_database" />
			</div>
			<div class="form-group">
				<label class="form-label">Username</label>
				<input type="text" class="form-input" id="db-user" placeholder="db_user" />
			</div>
			<div class="form-group">
				<label class="form-label">Password</label>
				<input type="password" class="form-input" id="db-pass" placeholder="••••••••" />
			</div>
		`, async () => {
			const name = document.getElementById('db-name').value;
			const user = document.getElementById('db-user').value;
			if (!name || !user) return false;
			
			try {
				const response = await fetch(`${API_BASE}/databases`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ name, user, password: document.getElementById('db-pass').value })
				});
				const result = await response.json();
				showToast(result.message);
				loadDatabases(); // Reload database list
				return true;
			} catch (error) {
				showToast('Failed to create database');
				return false;
			}
		});
	});
}

async function loadDatabases() {
	try {
		const response = await fetch(`${API_BASE}/databases`);
		const databases = await response.json();
		
		const dbList = document.getElementById('db-list');
		if (databases.length === 0) {
			dbList.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--muted);">No databases found</td></tr>';
			return;
		}
		
		dbList.innerHTML = databases.map(db => `
			<tr>
				<td>${db.name}</td>
				<td>${db.users}</td>
				<td>${db.size}</td>
				<td>
					<div class="actions">
						<button class="btn btn--sm btn--ghost" onclick="editDb('${db.name}')">Edit</button>
						<button class="btn btn--sm btn--danger" onclick="deleteDb('${db.name}')">Delete</button>
					</div>
				</td>
			</tr>
		`).join('');
	} catch (error) {
		console.error('Failed to load databases:', error);
		const dbList = document.getElementById('db-list');
		dbList.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--danger);">Failed to load databases</td></tr>';
	}
}

function renderEmail() {
	mount(`
		<div class="panel">
			<div class="panel__header">
				<div class="panel__title">Email Accounts</div>
				<button class="btn" id="btn-create-email">Add mailbox</button>
			</div>
			<table class="table">
				<thead><tr><th>Address</th><th>Usage</th><th>Status</th><th>Actions</th></tr></thead>
				<tbody id="email-list">
					<tr><td colspan="4" style="text-align: center; color: var(--muted);">Loading emails...</td></tr>
				</tbody>
			</table>
		</div>
	`);

	loadEmails();

	document.getElementById('btn-create-email').addEventListener('click', () => {
		showModal('Create Email Account', `
			<div class="form-group">
				<label class="form-label">Email Address</label>
				<input type="email" class="form-input" id="email-addr" placeholder="user@domain.com" />
			</div>
			<div class="form-group">
				<label class="form-label">Password</label>
				<input type="password" class="form-input" id="email-pass" placeholder="••••••••" />
			</div>
			<div class="form-group">
				<label class="form-label">Mailbox Size (GB)</label>
				<input type="number" class="form-input" id="email-size" value="2" min="1" max="10" />
			</div>
		`, async () => {
			const addr = document.getElementById('email-addr').value;
			const size = document.getElementById('email-size').value;
			if (!addr) return false;
			
			try {
				const response = await fetch(`${API_BASE}/emails`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ address: addr, password: document.getElementById('email-pass').value, size })
				});
				const result = await response.json();
				showToast(result.message);
				loadEmails(); // Reload email list
				return true;
			} catch (error) {
				showToast('Failed to create email');
				return false;
			}
		});
	});
}

function renderDomains() {
	mount(`
		<div class="panel">
			<div class="panel__header">
				<div class="panel__title">Domains</div>
				<div class="actions">
					<button class="btn" id="btn-add-domain">Add domain</button>
					<button class="btn btn--ghost" id="btn-install-wp">Install WordPress</button>
				</div>
			</div>
			<table class="table">
				<thead><tr><th>Domain</th><th>Type</th><th>SSL</th><th>Actions</th></tr></thead>
				<tbody id="domain-list">
					<tr><td colspan="4" style="text-align: center; color: var(--muted);">Loading domains...</td></tr>
				</tbody>
			</table>
		</div>
	`);

	loadDomains();

	document.getElementById('btn-add-domain').addEventListener('click', () => {
		showModal('Add Domain', `
			<div class="form-group">
				<label class="form-label">Domain Name</label>
				<input type="text" class="form-input" id="domain-name" placeholder="example.com" />
			</div>
			<div class="form-group">
				<label class="form-label">Type</label>
				<select class="form-input" id="domain-type">
					<option value="primary">Primary Domain</option>
					<option value="subdomain">Subdomain</option>
					<option value="addon">Addon Domain</option>
				</select>
			</div>
			<div class="form-group">
				<label class="form-label">Document Root</label>
				<input type="text" class="form-input" id="domain-root" placeholder="public_html" />
			</div>
		`, async () => {
			const name = document.getElementById('domain-name').value;
			const type = document.getElementById('domain-type').value;
			if (!name) return false;
			
			try {
				const response = await fetch(`${API_BASE}/domains`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ name, type, root: document.getElementById('domain-root').value })
				});
				const result = await response.json();
				showToast(result.message);
				loadDomains(); // Reload domain list
				return true;
			} catch (error) {
				showToast('Failed to add domain');
				return false;
			}
		});
	});

	document.getElementById('btn-install-wp').addEventListener('click', () => {
		showModal('Install WordPress', `
			<div class="form-group"><label class="form-label">Domain</label><input class="form-input" id="wp-domain" placeholder="example.com" /></div>
			<div class="form-group"><label class="form-label">Document Root</label><input class="form-input" id="wp-root" value="public_html" /></div>
			<div class="form-group"><label class="form-label">DB Name</label><input class="form-input" id="wp-dbname" placeholder="wp_db" /></div>
			<div class="form-group"><label class="form-label">DB User</label><input class="form-input" id="wp-dbuser" placeholder="wp_user" /></div>
			<div class="form-group"><label class="form-label">DB Pass</label><input class="form-input" id="wp-dbpass" type="password" placeholder="••••••" /></div>
			<div class="form-group"><label class="form-label">Site Title</label><input class="form-input" id="wp-title" placeholder="My Site" /></div>
			<div class="form-group"><label class="form-label">Admin Email</label><input class="form-input" id="wp-email" type="email" placeholder="admin@example.com" /></div>
		`, async () => {
			const domain = document.getElementById('wp-domain').value;
			if (!domain) return false;
			try {
				const resp = await fetch(`${API_BASE}/oneclick/wordpress`, {
					method: 'POST', headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						domain,
						documentRoot: document.getElementById('wp-root').value || 'public_html',
						dbName: document.getElementById('wp-dbname').value,
						dbUser: document.getElementById('wp-dbuser').value,
						dbPass: document.getElementById('wp-dbpass').value,
						title: document.getElementById('wp-title').value,
						adminEmail: document.getElementById('wp-email').value
					})
				});
				const result = await resp.json();
				if (!resp.ok) throw new Error(result.error || 'Install failed');
				showToast('WordPress installation initialized');
				return true;
			} catch(e) {
				showToast('Failed to install WordPress');
				return false;
			}
		});
	});
}

function renderUsers() {
	mount(`
		<div class="panel">
			<div class="panel__header">
				<div class="panel__title">Users</div>
				<div class="actions">
					<button class="btn" id="btn-invite-user">Invite</button>
					<button class="btn btn--ghost" id="btn-quotas">Quotas</button>
				</div>
			</div>
			<table class="table">
				<thead><tr><th>User</th><th>Role</th><th>Last active</th><th>Actions</th></tr></thead>
				<tbody id="user-list">
					<tr><td colspan="4" style="text-align: center; color: var(--muted);">Loading users...</td></tr>
				</tbody>
			</table>
		</div>
	`);

	loadUsers();

	document.getElementById('btn-invite-user').addEventListener('click', () => {
		showModal('Invite User', `
			<div class="form-group">
				<label class="form-label">Email Address</label>
				<input type="email" class="form-input" id="user-email" placeholder="user@example.com" />
			</div>
			<div class="form-group">
				<label class="form-label">Role</label>
				<select class="form-input" id="user-role">
					<option value="admin">Administrator</option>
					<option value="editor">Editor</option>
					<option value="viewer">Viewer</option>
				</select>
			</div>
			<div class="form-group">
				<label class="form-label">Permissions</label>
				<div style="display: grid; gap: 8px;">
					<label style="display: flex; align-items: center; gap: 8px;"><input type="checkbox" checked /> File Management</label>
					<label style="display: flex; align-items: center; gap: 8px;"><input type="checkbox" checked /> Database Access</label>
					<label style="display: flex; align-items: center; gap: 8px;"><input type="checkbox" /> User Management</label>
					<label style="display: flex; align-items: center; gap: 8px;"><input type="checkbox" /> System Settings</label>
				</div>
			</div>
		`, async () => {
			const email = document.getElementById('user-email').value;
			const role = document.getElementById('user-role').value;
			if (!email) return false;
			
			try {
				const response = await fetch(`${API_BASE}/users`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email, role })
				});
				const result = await response.json();
				showToast(result.message);
				loadUsers(); // Reload user list
				return true;
			} catch (error) {
				showToast('Failed to invite user');
				return false;
			}
		});
	});

	document.getElementById('btn-quotas').addEventListener('click', async () => {
		try {
			const response = await fetch(`${API_BASE}/quotas`);
			const quotas = await response.json();
			
			const quotaList = quotas.map(q => `
				<div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: var(--elev); border-radius: 8px; margin-bottom: 8px;">
					<div>
						<strong>${q.domain}</strong><br>
						<small>Storage: ${q.size} / ${q.maxStorage}</small>
					</div>
					<button class="btn btn--sm btn--danger" onclick="removeQuota('${q.domain}')">Remove</button>
				</div>
			`).join('');
			
			showModal('Storage Quotas', `
				<div class="form-group">
					<label class="form-label">Add Quota</label>
					<div style="display: grid; grid-template-columns: 1fr auto; gap: 10px;">
						<input type="text" class="form-input" id="quota-domain" placeholder="domain.com" />
						<button class="btn" onclick="addQuota()">Add</button>
					</div>
				</div>
				<div style="margin-top: 16px;">
					<h4>Current Quotas</h4>
					<div id="quota-list">${quotaList}</div>
				</div>
			`, () => true);
		} catch (error) {
			showToast('Failed to load quotas');
		}
	});
}

window.addQuota = async () => {
	const domain = document.getElementById('quota-domain').value;
	if (!domain) return;
	
	try {
		const response = await fetch(`${API_BASE}/quotas`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ domain, maxStorage: '1GB', maxDatabases: 5, maxDomains: 1 })
		});
		const result = await response.json();
		showToast(result.message);
		document.getElementById('quota-domain').value = '';
	} catch (error) {
		showToast('Failed to add quota');
	}
};

window.removeQuota = async (domain) => {
	try {
		const response = await fetch(`${API_BASE}/quotas/${domain}`, {
			method: 'DELETE'
		});
		const result = await response.json();
		showToast(result.message);
	} catch (error) {
		showToast('Failed to remove quota');
	}
};

function renderSecurity() {
	mount(`
		<div class="panel">
			<div class="panel__header">
				<div class="panel__title">Security</div>
				<div>
					<button class="btn" id="btn-scan">Run malware scan</button>
					<button class="btn btn--ghost" id="btn-firewall">Firewall</button>
				</div>
			</div>
			<div class="cards">
				<div class="card"><div class="card__title">SSL Certificates</div><div class="card__value">2 valid</div></div>
				<div class="card"><div class="card__title">Firewall Rules</div><div class="card__value">12</div></div>
				<div class="card"><div class="card__title">Brute-force blocks</div><div class="card__value">5</div></div>
				<div class="card"><div class="card__title">Last scan</div><div class="card__value">Today</div></div>
			</div>
			
			<div style="margin-top: 20px;">
				<h3 style="margin-bottom: 12px;">Recent Security Events</h3>
				<table class="table">
					<thead><tr><th>Time</th><th>Event</th><th>IP</th><th>Action</th></tr></thead>
					<tbody>
						<tr><td>14:23</td><td>Failed login attempt</td><td>192.168.1.100</td><td><span class="pill" style="background: var(--warning)">Blocked</span></td></tr>
						<tr><td>13:45</td><td>Suspicious file detected</td><td>—</td><td><span class="pill" style="background: var(--danger)">Quarantined</span></td></tr>
						<tr><td>12:30</td><td>SSL certificate renewed</td><td>—</td><td><span class="pill" style="background: var(--success)">Success</span></td></tr>
					</tbody>
				</table>
			</div>
		</div>
	`);

	document.getElementById('btn-scan').addEventListener('click', () => {
		showToast('Malware scan started...');
		setTimeout(() => showToast('Scan completed - No threats found'), 3000);
	});

	document.getElementById('btn-firewall').addEventListener('click', () => {
		showModal('Firewall Rules', `
			<div class="form-group">
				<label class="form-label">Add Rule</label>
				<div style="display: grid; grid-template-columns: 1fr auto; gap: 10px;">
					<input type="text" class="form-input" placeholder="IP address or range" />
					<button class="btn">Add</button>
				</div>
			</div>
			<div style="margin-top: 16px;">
				<h4>Current Rules</h4>
				<div style="display: grid; gap: 8px;">
					<div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: var(--elev); border-radius: 8px;">
						<span>192.168.1.0/24</span>
						<button class="btn btn--sm btn--danger">Remove</button>
					</div>
					<div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: var(--elev); border-radius: 8px;">
						<span>10.0.0.0/8</span>
						<button class="btn btn--sm btn--danger">Remove</button>
					</div>
				</div>
			</div>
		`, () => true);
	});
}

function renderBackups() {
	mount(`
		<div class="panel">
			<div class="panel__header">
				<div class="panel__title">Backups</div>
				<div>
					<button class="btn" id="btn-create-backup">Create backup</button>
					<button class="btn btn--ghost" id="btn-schedule">Schedule</button>
				</div>
			</div>
			<table class="table">
				<thead><tr><th>Date</th><th>Size</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead>
				<tbody id="backup-list">
					<tr><td>Today</td><td>1.2 GB</td><td>Full</td><td><span class="pill" style="background: var(--success)">Complete</span></td><td><div class="actions"><button class="btn btn--sm btn--ghost">Download</button><button class="btn btn--sm btn--danger">Delete</button></div></td></tr>
					<tr><td>Yesterday</td><td>400 MB</td><td>Incremental</td><td><span class="pill" style="background: var(--success)">Complete</span></td><td><div class="actions"><button class="btn btn--sm btn--ghost">Download</button><button class="btn btn--sm btn--danger">Delete</button></div></td></tr>
				</tbody>
			</table>
		</div>
	`);

	document.getElementById('btn-create-backup').addEventListener('click', () => {
		showModal('Create Backup', `
			<div class="form-group">
				<label class="form-label">Backup Type</label>
				<select class="form-input" id="backup-type">
					<option value="full">Full Backup</option>
					<option value="incremental">Incremental</option>
					<option value="files">Files Only</option>
					<option value="database">Database Only</option>
				</select>
			</div>
			<div class="form-group">
				<label class="form-label">Include</label>
				<div style="display: grid; gap: 8px;">
					<label style="display: flex; align-items: center; gap: 8px;"><input type="checkbox" checked /> Files</label>
					<label style="display: flex; align-items: center; gap: 8px;"><input type="checkbox" checked /> Databases</label>
					<label style="display: flex; align-items: center; gap: 8px;"><input type="checkbox" checked /> Email</label>
					<label style="display: flex; align-items: center; gap: 8px;"><input type="checkbox" /> Logs</label>
				</div>
			</div>
		`, () => {
			const type = document.getElementById('backup-type').value;
			const backupList = document.getElementById('backup-list');
			const row = document.createElement('tr');
			const now = new Date().toLocaleDateString();
			const size = type === 'full' ? '1.2 GB' : '400 MB';
			row.innerHTML = `<td>${now}</td><td>${size}</td><td>${type.charAt(0).toUpperCase() + type.slice(1)}</td><td><span class="pill" style="background: var(--warning)">In Progress</span></td><td><div class="actions"><button class="btn btn--sm btn--ghost">Download</button><button class="btn btn--sm btn--danger">Delete</button></div></td>`;
			backupList.insertBefore(row, backupList.firstChild);
			showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} backup started`);
			
			// Simulate completion
			setTimeout(() => {
				row.querySelector('.pill').textContent = 'Complete';
				row.querySelector('.pill').style.background = 'var(--success)';
				showToast('Backup completed successfully');
			}, 2000);
			return true;
		});
	});

	document.getElementById('btn-schedule').addEventListener('click', () => {
		showModal('Schedule Backup', `
			<div class="form-group">
				<label class="form-label">Frequency</label>
				<select class="form-input">
					<option value="daily">Daily</option>
					<option value="weekly">Weekly</option>
					<option value="monthly">Monthly</option>
				</select>
			</div>
			<div class="form-group">
				<label class="form-label">Time</label>
				<input type="time" class="form-input" value="02:00" />
			</div>
			<div class="form-group">
				<label class="form-label">Retention</label>
				<input type="number" class="form-input" value="7" min="1" max="30" />
				<small style="color: var(--muted); margin-top: 4px; display: block;">Keep backups for X days</small>
			</div>
		`, () => {
			showToast('Backup schedule created');
			return true;
		});
	});
}

async function loadEmails() {
	try {
		const response = await fetch(`${API_BASE}/emails`);
		const emails = await response.json();
		
		const emailList = document.getElementById('email-list');
		if (emails.length === 0) {
			emailList.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--muted);">No emails found</td></tr>';
			return;
		}
		
		emailList.innerHTML = emails.map(email => `
			<tr>
				<td>${email.address}</td>
				<td>${email.usage}</td>
				<td><span class="pill">${email.status}</span></td>
				<td>
					<div class="actions">
						<button class="btn btn--sm btn--ghost" onclick="editEmail('${email.address}')">Edit</button>
						<button class="btn btn--sm btn--danger" onclick="deleteEmail('${email.address}')">Delete</button>
					</div>
				</td>
			</tr>
		`).join('');
	} catch (error) {
		console.error('Failed to load emails:', error);
		const emailList = document.getElementById('email-list');
		emailList.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--danger);">Failed to load emails</td></tr>';
	}
}

async function loadDomains() {
	try {
		const response = await fetch(`${API_BASE}/domains`);
		const domains = await response.json();
		
		const domainList = document.getElementById('domain-list');
		if (domains.length === 0) {
			domainList.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--muted);">No domains found</td></tr>';
			return;
		}
		
		domainList.innerHTML = domains.map(domain => `
			<tr>
				<td>${domain.domain}</td>
				<td>${domain.type}</td>
				<td><span class="pill">${domain.ssl}</span></td>
				<td>
					<div class="actions">
						<button class="btn btn--sm btn--ghost" onclick="editDomain('${domain.domain}')">Edit</button>
						<button class="btn btn--sm btn--danger" onclick="deleteDomain('${domain.domain}')">Delete</button>
					</div>
				</td>
			</tr>
		`).join('');
	} catch (error) {
		console.error('Failed to load domains:', error);
		const domainList = document.getElementById('domain-list');
		domainList.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--danger);">Failed to load domains</td></tr>';
	}
}

async function loadUsers() {
	try {
		const response = await fetch(`${API_BASE}/users`);
		const users = await response.json();
		
		const userList = document.getElementById('user-list');
		if (users.length === 0) {
			userList.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--muted);">No users found</td></tr>';
			return;
		}
		
		userList.innerHTML = users.map(user => `
			<tr>
				<td>${user.user}</td>
				<td><span class="pill">${user.role}</span></td>
				<td>${user.lastActive}</td>
				<td>
					<div class="actions">
						<button class="btn btn--sm btn--ghost" onclick="editUser('${user.user}')">Edit</button>
						${user.user !== 'admin' ? `<button class="btn btn--sm btn--danger" onclick="deleteUser('${user.user}')">Remove</button>` : ''}
					</div>
				</td>
			</tr>
		`).join('');
	} catch (error) {
		console.error('Failed to load users:', error);
		const userList = document.getElementById('user-list');
		userList.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--danger);">Failed to load users</td></tr>';
	}
}

function renderEmail() {
	mount(`
		<div class="panel">
			<div class="panel__header">
				<div class="panel__title">Email Accounts</div>
				<button class="btn">Add mailbox</button>
			</div>
			<table class="table">
				<thead><tr><th>Address</th><th>Usage</th><th>Status</th></tr></thead>
				<tbody>
					<tr><td>admin@domain.com</td><td>120 MB / 2 GB</td><td><span class="pill">Active</span></td></tr>
				</tbody>
			</table>
		</div>
	`);
}

function renderDomains() {
	mount(`
		<div class="panel">
			<div class="panel__header">
				<div class="panel__title">Domains</div>
				<button class="btn">Add domain</button>
			</div>
			<table class="table">
				<thead><tr><th>Domain</th><th>Type</th><th>SSL</th></tr></thead>
				<tbody>
					<tr><td>domain.com</td><td>Primary</td><td><span class="pill">Auto</span></td></tr>
					<tr><td>demo.domain.com</td><td>Subdomain</td><td><span class="pill">Auto</span></td></tr>
				</tbody>
			</table>
		</div>
	`);
}

function renderUsers() {
	mount(`
		<div class="panel">
			<div class="panel__header">
				<div class="panel__title">Users</div>
				<button class="btn">Invite</button>
			</div>
			<table class="table">
				<thead><tr><th>User</th><th>Role</th><th>Last active</th></tr></thead>
				<tbody>
					<tr><td>admin</td><td>Owner</td><td>2h ago</td></tr>
				</tbody>
			</table>
		</div>
	`);
}

function renderSecurity() {
	mount(`
		<div class="panel">
			<div class="panel__header">
				<div class="panel__title">Security</div>
				<div>
					<button class="btn">Run malware scan</button>
					<button class="btn btn--ghost">Firewall</button>
				</div>
			</div>
			<div class="cards">
				<div class="card"><div class="card__title">SSL Certificates</div><div class="card__value">2 valid</div></div>
				<div class="card"><div class="card__title">Firewall Rules</div><div class="card__value">12</div></div>
				<div class="card"><div class="card__title">Brute-force blocks</div><div class="card__value">5</div></div>
				<div class="card"><div class="card__title">Last scan</div><div class="card__value">Today</div></div>
			</div>
		</div>
	`);
}

function renderBackups() {
	mount(`
		<div class="panel">
			<div class="panel__header">
				<div class="panel__title">Backups</div>
				<div>
					<button class="btn">Create backup</button>
					<button class="btn btn--ghost">Schedule</button>
				</div>
			</div>
			<table class="table">
				<thead><tr><th>Date</th><th>Size</th><th>Type</th></tr></thead>
				<tbody>
					<tr><td>Today</td><td>1.2 GB</td><td>Full</td></tr>
					<tr><td>Yesterday</td><td>400 MB</td><td>Incremental</td></tr>
				</tbody>
			</table>
		</div>
	`);
}

function renderSettings() {
	mount(`
		<div class="panel">
			<div class="panel__header">
				<div class="panel__title">Settings</div>
			</div>
			<div class="cards">
				<div class="card"><div class="card__title">Theme</div><div><button class="btn btn--ghost" id="toggle-theme-btn">Toggle</button></div></div>
				<div class="card"><div class="card__title">Language</div><div class="pill">English</div></div>
				<div class="card"><div class="card__title">Performance</div><div class="pill">Balanced</div></div>
				<div class="card"><div class="card__title">Updates</div><div class="pill">Auto</div></div>
			</div>
		</div>
	`);

	const toggleBtn = document.getElementById('toggle-theme-btn');
	if (toggleBtn) toggleBtn.addEventListener('click', toggleTheme);
}

function toggleTheme() {
	const current = appRoot.getAttribute('data-theme');
	const next = current === 'light' ? 'dark' : 'light';
	appRoot.setAttribute('data-theme', next);
	localStorage.setItem('atulya-theme', next);
	// Update icon
	if (themeToggle) themeToggle.textContent = next === 'light' ? '🌙' : '☀️';
}

// Init theme from storage
const savedTheme = localStorage.getItem('atulya-theme');
if (savedTheme) appRoot.setAttribute('data-theme', savedTheme);

// Navigation
sidebarNav.addEventListener('click', (e) => {
	const btn = e.target.closest('.nav__item');
	if (!btn) return;
	const view = btn.dataset.view;
	setActive(view);
	render(view);
});

// Theme toggle
themeToggle.addEventListener('click', toggleTheme);

// Default view
setActive('dashboard');
render('dashboard');

// Sidebar collapse
function setCollapsed(collapsed) {
	appRoot.classList.toggle('app--collapsed', collapsed);
	localStorage.setItem('atulya-collapsed', collapsed ? '1' : '0');
	if (sidebarCollapse) sidebarCollapse.textContent = collapsed ? '⟩⟩' : '⟨⟨';
}

const savedCollapsed = localStorage.getItem('atulya-collapsed') === '1';
setCollapsed(savedCollapsed);
sidebarCollapse.addEventListener('click', () => setCollapsed(!appRoot.classList.contains('app--collapsed')));

// Command palette
const actions = [
	{ id: 'go-dashboard', label: 'Go to Dashboard', run: () => { setActive('dashboard'); render('dashboard'); } },
	{ id: 'go-files', label: 'Open Files', run: () => { setActive('files'); render('files'); } },
	{ id: 'go-databases', label: 'Open Databases', run: () => { setActive('databases'); render('databases'); } },
	{ id: 'go-email', label: 'Open Email', run: () => { setActive('email'); render('email'); } },
	{ id: 'go-domains', label: 'Open Domains', run: () => { setActive('domains'); render('domains'); } },
	{ id: 'go-users', label: 'Open Users', run: () => { setActive('users'); render('users'); } },
	{ id: 'go-security', label: 'Open Security', run: () => { setActive('security'); render('security'); } },
	{ id: 'go-backups', label: 'Open Backups', run: () => { setActive('backups'); render('backups'); } },
	{ id: 'go-cron', label: 'Open Cron Jobs', run: () => { setActive('cron'); render('cron'); } },
	{ id: 'go-logs', label: 'Open Logs', run: () => { setActive('logs'); render('logs'); } },
	{ id: 'go-settings', label: 'Open Settings', run: () => { setActive('settings'); render('settings'); } },
	{ id: 'toggle-theme', label: 'Toggle Theme', run: toggleTheme },
];

function openCmdk() {
	cmdkRoot.hidden = false;
	cmdkInput.value = '';
	filterCmdk('');
	cmdkInput.focus();
}
function closeCmdk() { cmdkRoot.hidden = true; }
function filterCmdk(q) {
	const query = q.toLowerCase();
	const matches = actions.filter(a => a.label.toLowerCase().includes(query));
	cmdkList.innerHTML = matches.map((a, i) => `<li class="cmdk-item${i===0?' is-active':''}" data-id="${a.id}">${a.label}</li>`).join('');
}

document.addEventListener('keydown', (e) => {
	if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
		e.preventDefault();
		openCmdk();
	}
	if (e.key === 'Escape' && !cmdkRoot.hidden) closeCmdk();
});

cmdkRoot.addEventListener('click', (e) => {
	if (e.target.classList.contains('modal__backdrop')) closeCmdk();
});

cmdkInput.addEventListener('input', (e) => filterCmdk(e.target.value));

cmdkList.addEventListener('click', (e) => {
	const item = e.target.closest('.cmdk-item');
	if (!item) return;
	const id = item.getAttribute('data-id');
	const action = actions.find(a => a.id === id);
	if (action) action.run();
	closeCmdk();
});

// Top search opens command palette
document.getElementById('search').addEventListener('focus', openCmdk);

// Modal system
function showModal(title, body, onConfirm) {
	const modal = document.createElement('div');
	modal.className = 'modal';
	modal.innerHTML = `
		<div class="modal__backdrop"></div>
		<div class="modal__card">
			<div class="modal__header">
				<div class="modal__title">${title}</div>
				<button class="modal__close">&times;</button>
			</div>
			<div class="modal__body">${body}</div>
			<div class="modal__footer">
				<button class="btn btn--ghost" data-action="cancel">Cancel</button>
				<button class="btn" data-action="confirm">Confirm</button>
			</div>
		</div>
	`;
	
	document.body.appendChild(modal);
	
	const closeModal = () => {
		modal.remove();
	};
	
	modal.addEventListener('click', (e) => {
		if (e.target.classList.contains('modal__backdrop') || e.target.classList.contains('modal__close') || e.target.dataset.action === 'cancel') {
			closeModal();
		} else if (e.target.dataset.action === 'confirm') {
			if (onConfirm && onConfirm()) {
				closeModal();
			}
		}
	});
	
	// Focus first input
	const firstInput = modal.querySelector('input, select, textarea');
	if (firstInput) firstInput.focus();
}

// Global action handlers
window.editDb = (name) => showToast(`Edit database "${name}"`);
window.deleteDb = async (name) => {
	if (!confirm(`Delete database "${name}"?`)) return;
	
	try {
		const response = await fetch(`${API_BASE}/databases/${name}`, {
			method: 'DELETE'
		});
		const result = await response.json();
		showToast(result.message);
		loadDatabases(); // Reload database list
	} catch (error) {
		showToast('Failed to delete database');
	}
};

window.editEmail = (addr) => showToast(`Edit email "${addr}"`);
window.deleteEmail = async (addr) => {
	if (!confirm(`Delete email "${addr}"?`)) return;
	
	try {
		const response = await fetch(`${API_BASE}/emails/${addr}`, {
			method: 'DELETE'
		});
		const result = await response.json();
		showToast(result.message);
		loadEmails(); // Reload email list
	} catch (error) {
		showToast('Failed to delete email');
	}
};

window.editDomain = (domain) => showToast(`Edit domain "${domain}"`);
window.deleteDomain = async (domain) => {
	if (!confirm(`Delete domain "${domain}"?`)) return;
	
	try {
		const response = await fetch(`${API_BASE}/domains/${domain}`, {
			method: 'DELETE'
		});
		const result = await response.json();
		showToast(result.message);
		loadDomains(); // Reload domain list
	} catch (error) {
		showToast('Failed to delete domain');
	}
};

window.editUser = (user) => showToast(`Edit user "${user}"`);
window.deleteUser = async (user) => {
	if (!confirm(`Remove user "${user}"?`)) return;
	
	try {
		const response = await fetch(`${API_BASE}/users/${user}`, {
			method: 'DELETE'
		});
		const result = await response.json();
		showToast(result.message);
		loadUsers(); // Reload user list
	} catch (error) {
		showToast('Failed to remove user');
	}
};

// Utilities
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function formatSize(bytes) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024*1024) return `${(bytes/1024).toFixed(1)} KB`;
	if (bytes < 1024*1024*1024) return `${(bytes/1024/1024).toFixed(1)} MB`;
	return `${(bytes/1024/1024/1024).toFixed(1)} GB`;
}
function showToast(text) {
	if (!toastsRoot) return alert(text);
	const el = document.createElement('div');
	el.className = 'toast';
	el.textContent = text;
	toastsRoot.appendChild(el);
	setTimeout(() => {
		el.style.opacity = '0';
		el.style.transform = 'translateY(6px)';
		setTimeout(() => el.remove(), 300);
	}, 2200);
}

function renderBackups() {
	mount(`
		<div class="panel">
			<div class="panel__header">
				<div class="panel__title">Backups</div>
				<div class="actions">
					<button class="btn" id="btn-create-backup">Create backup</button>
					<button class="btn btn--ghost" id="btn-schedule-backup">Schedule</button>
				</div>
			</div>
			<table class="table">
				<thead><tr><th>Name</th><th>Size</th><th>Type</th><th>Created</th><th>Actions</th></tr></thead>
				<tbody id="backup-list">
					<tr><td colspan="5" style="text-align: center; color: var(--muted);">Loading backups...</td></tr>
				</tbody>
			</table>
		</div>
	`);

	loadBackups();

	document.getElementById('btn-create-backup').addEventListener('click', () => {
		showModal('Create Backup', `
			<div class="form-group">
				<label class="form-label">Domain</label>
				<input type="text" class="form-input" id="backup-domain" placeholder="example.com" />
			</div>
			<div class="form-group">
				<label class="form-label">Backup Type</label>
				<select class="form-input" id="backup-type">
					<option value="full">Full Backup</option>
					<option value="incremental">Incremental</option>
					<option value="files">Files Only</option>
					<option value="database">Database Only</option>
				</select>
			</div>
		`, async () => {
			const domain = document.getElementById('backup-domain').value;
			const type = document.getElementById('backup-type').value;
			if (!domain) return false;
			
			try {
				const response = await fetch(`${API_BASE}/backups`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ domain, type })
				});
				const result = await response.json();
				showToast(result.message);
				loadBackups();
				return true;
			} catch (error) {
				showToast('Failed to create backup');
				return false;
			}
		});
	});
}

async function loadBackups() {
	try {
		const response = await fetch(`${API_BASE}/backups`);
		const backups = await response.json();
		
		const backupList = document.getElementById('backup-list');
		if (backups.length === 0) {
			backupList.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--muted);">No backups found</td></tr>';
			return;
		}
		
		backupList.innerHTML = backups.map(backup => `
			<tr>
				<td>${backup.name}</td>
				<td>${formatSize(backup.size)}</td>
				<td><span class="pill">${backup.type}</span></td>
				<td>${new Date(backup.created).toLocaleDateString()}</td>
				<td>
					<div class="actions">
						<button class="btn btn--sm btn--ghost" onclick="downloadBackup('${backup.name}')">Download</button>
						<button class="btn btn--sm btn--ghost" onclick="restoreBackup('${backup.name}')">Restore</button>
						<button class="btn btn--sm btn--danger" onclick="deleteBackup('${backup.name}')">Delete</button>
					</div>
				</td>
			</tr>
		`).join('');
	} catch (error) {
		console.error('Failed to load backups:', error);
		const backupList = document.getElementById('backup-list');
		backupList.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--danger);">Failed to load backups</td></tr>';
	}
}

window.downloadBackup = async (filename) => {
	try {
		window.open(`${API_BASE}/backups/${filename}`);
		showToast(`Downloading ${filename}`);
	} catch (error) {
		showToast('Download failed');
	}
};

window.restoreBackup = async (filename) => {
	const domain = prompt('Enter domain to restore to:');
	if (!domain) return;
	
	try {
		const response = await fetch(`${API_BASE}/backups/${filename}/restore`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ domain })
		});
		const result = await response.json();
		showToast(result.message);
	} catch (error) {
		showToast('Restore failed');
	}
};

window.deleteBackup = async (filename) => {
	if (!confirm(`Delete backup "${filename}"?`)) return;
	
	try {
		const response = await fetch(`${API_BASE}/backups/${filename}`, {
			method: 'DELETE'
		});
		const result = await response.json();
		showToast(result.message);
		loadBackups();
	} catch (error) {
		showToast('Delete failed');
	}
};

function renderCron() {
	mount(`
		<div class="panel">
			<div class="panel__header">
				<div class="panel__title">Cron Jobs</div>
				<button class="btn" id="btn-add-cron">Add Cron Job</button>
			</div>
			<table class="table">
				<thead><tr><th>Domain</th><th>Schedule</th><th>Command</th><th>Status</th><th>Actions</th></tr></thead>
				<tbody id="cron-list">
					<tr><td colspan="5" style="text-align: center; color: var(--muted);">Loading cron jobs...</td></tr>
				</tbody>
			</table>
		</div>
	`);

	loadCronJobs();

	document.getElementById('btn-add-cron').addEventListener('click', () => {
		showModal('Add Cron Job', `
			<div class="form-group">
				<label class="form-label">Domain</label>
				<input type="text" class="form-input" id="cron-domain" placeholder="example.com" />
			</div>
			<div class="form-group">
				<label class="form-label">Schedule (cron format)</label>
				<input type="text" class="form-input" id="cron-schedule" placeholder="0 2 * * *" />
				<small style="color: var(--muted); margin-top: 4px; display: block;">Daily at 2 AM: 0 2 * * *</small>
			</div>
			<div class="form-group">
				<label class="form-label">Command</label>
				<input type="text" class="form-input" id="cron-command" placeholder="/usr/bin/php /var/www/example.com/backup.php" />
			</div>
			<div class="form-group">
				<label class="form-label">Description</label>
				<input type="text" class="form-input" id="cron-description" placeholder="Daily backup script" />
			</div>
		`, async () => {
			const domain = document.getElementById('cron-domain').value;
			const schedule = document.getElementById('cron-schedule').value;
			const command = document.getElementById('cron-command').value;
			const description = document.getElementById('cron-description').value;
			
			if (!domain || !schedule || !command) return false;
			
			try {
				const response = await fetch(`${API_BASE}/cron`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ domain, schedule, command, description })
				});
				const result = await response.json();
				showToast(result.message);
				loadCronJobs();
				return true;
			} catch (error) {
				showToast('Failed to add cron job');
				return false;
			}
		});
	});
}

async function loadCronJobs() {
	try {
		const response = await fetch(`${API_BASE}/cron`);
		const jobs = await response.json();
		
		const cronList = document.getElementById('cron-list');
		if (jobs.length === 0) {
			cronList.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--muted);">No cron jobs found</td></tr>';
			return;
		}
		
		cronList.innerHTML = jobs.map(job => `
			<tr>
				<td>${job.domain}</td>
				<td><code>${job.schedule}</code></td>
				<td>${job.command}</td>
				<td><span class="pill" style="background: ${job.enabled ? 'var(--success)' : 'var(--muted)'}">${job.enabled ? 'Active' : 'Disabled'}</span></td>
				<td>
					<div class="actions">
						<button class="btn btn--sm btn--ghost" onclick="executeCron('${job.id}')">Run</button>
						<button class="btn btn--sm btn--danger" onclick="deleteCron('${job.id}')">Delete</button>
					</div>
				</td>
			</tr>
		`).join('');
	} catch (error) {
		console.error('Failed to load cron jobs:', error);
		const cronList = document.getElementById('cron-list');
		cronList.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--danger);">Failed to load cron jobs</td></tr>';
	}
}

window.executeCron = async (id) => {
	try {
		const response = await fetch(`${API_BASE}/cron/${id}/execute`, {
			method: 'POST'
		});
		const result = await response.json();
		showToast(result.message);
	} catch (error) {
		showToast('Failed to execute cron job');
	}
};

window.deleteCron = async (id) => {
	if (!confirm('Delete this cron job?')) return;
	
	try {
		const response = await fetch(`${API_BASE}/cron/${id}`, {
			method: 'DELETE'
		});
		const result = await response.json();
		showToast(result.message);
		loadCronJobs();
	} catch (error) {
		showToast('Failed to delete cron job');
	}
};

function renderLogs() {
	mount(`
		<div class="panel">
			<div class="panel__header">
				<div class="panel__title">Logs</div>
				<div class="actions">
					<button class="btn btn--ghost" id="btn-refresh-logs">Refresh</button>
					<button class="btn btn--ghost" id="btn-clear-logs">Clear</button>
				</div>
			</div>
			<div style="display: grid; grid-template-columns: 1fr 2fr; gap: 16px;">
				<div>
					<h4>Log Files</h4>
					<div id="log-files" style="max-height: 400px; overflow-y: auto;">
						<div style="text-align: center; color: var(--muted);">Loading...</div>
					</div>
				</div>
				<div>
					<h4>Log Content</h4>
					<pre id="log-content" style="background: var(--elev); padding: 12px; border-radius: 8px; max-height: 400px; overflow-y: auto; font-family: monospace; font-size: 12px; white-space: pre-wrap;"></pre>
				</div>
			</div>
		</div>
	`);

	loadLogFiles();

	document.getElementById('btn-refresh-logs').addEventListener('click', () => {
		loadLogFiles();
	});

	document.getElementById('btn-clear-logs').addEventListener('click', () => {
		const selectedFile = document.querySelector('.log-file.active');
		if (!selectedFile) {
			showToast('Select a log file first');
			return;
		}
		
		if (confirm('Clear this log file?')) {
			clearLogFile(selectedFile.dataset.file);
		}
	});
}

async function loadLogFiles() {
	try {
		const response = await fetch(`${API_BASE}/logs/files`);
		const files = await response.json();
		
		const logFiles = document.getElementById('log-files');
		if (files.length === 0) {
			logFiles.innerHTML = '<div style="text-align: center; color: var(--muted);">No log files found</div>';
			return;
		}
		
		logFiles.innerHTML = files.map(file => `
			<div class="log-file" data-file="${file.path}" style="padding: 8px; margin-bottom: 4px; background: var(--elev); border-radius: 6px; cursor: pointer;">
				<div style="font-weight: 500;">${file.name}</div>
				<div style="font-size: 12px; color: var(--muted);">${formatSize(file.size)} • ${new Date(file.modified).toLocaleDateString()}</div>
			</div>
		`).join('');
		
		// Add click handlers
		document.querySelectorAll('.log-file').forEach(file => {
			file.addEventListener('click', () => {
				document.querySelectorAll('.log-file').forEach(f => f.classList.remove('active'));
				file.classList.add('active');
				loadLogContent(file.dataset.file);
			});
		});
		
		// Load first file by default
		if (files.length > 0) {
			const firstFile = document.querySelector('.log-file');
			firstFile.classList.add('active');
			loadLogContent(firstFile.dataset.file);
		}
	} catch (error) {
		console.error('Failed to load log files:', error);
		const logFiles = document.getElementById('log-files');
		logFiles.innerHTML = '<div style="text-align: center; color: var(--danger);">Failed to load log files</div>';
	}
}

async function loadLogContent(filePath) {
	try {
		const response = await fetch(`${API_BASE}/logs/content?file=${encodeURIComponent(filePath)}&lines=100`);
		const result = await response.json();
		
		const logContent = document.getElementById('log-content');
		logContent.textContent = result.content || 'No content available';
	} catch (error) {
		console.error('Failed to load log content:', error);
		const logContent = document.getElementById('log-content');
		logContent.textContent = 'Failed to load log content';
	}
}

async function clearLogFile(filePath) {
	try {
		const response = await fetch(`${API_BASE}/logs/clear`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ file: filePath })
		});
		const result = await response.json();
		showToast(result.message);
		loadLogContent(filePath);
	} catch (error) {
		showToast('Failed to clear log file');
	}
}


