const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Create uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
fs.ensureDirSync(uploadsDir);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// API Routes

// File Management
app.get('/api/files', async (req, res) => {
  try {
    const files = await fs.readdir(uploadsDir);
    const fileList = await Promise.all(files.map(async (file) => {
      const filePath = path.join(uploadsDir, file);
      const stats = await fs.stat(filePath);
      return {
        name: file,
        size: stats.size,
        modified: stats.mtime,
        isDirectory: stats.isDirectory()
      };
    }));
    res.json(fileList);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read files' });
  }
});

app.post('/api/files/upload', upload.array('files'), (req, res) => {
  const uploadedFiles = req.files.map(file => ({
    name: file.originalname,
    size: file.size,
    path: file.path
  }));
  res.json({ message: 'Files uploaded successfully', files: uploadedFiles });
});

app.post('/api/files/folder', async (req, res) => {
  try {
    const { name } = req.body;
    const folderPath = path.join(uploadsDir, name);
    await fs.ensureDir(folderPath);
    res.json({ message: `Folder "${name}" created successfully` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

app.delete('/api/files/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(uploadsDir, filename);
    await fs.remove(filePath);
    res.json({ message: `File "${filename}" deleted successfully` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Database Management
let databases = [
  { name: 'atulya_app', users: 1, size: '12 MB' }
];

app.get('/api/databases', (req, res) => {
  res.json(databases);
});

app.post('/api/databases', (req, res) => {
  const { name, user, password } = req.body;
  if (!name || !user) {
    return res.status(400).json({ error: 'Name and user are required' });
  }
  
  const newDb = { name, users: 1, size: '0 MB' };
  databases.push(newDb);
  res.json({ message: `Database "${name}" created successfully`, database: newDb });
});

app.delete('/api/databases/:name', (req, res) => {
  const name = req.params.name;
  const index = databases.findIndex(db => db.name === name);
  if (index === -1) {
    return res.status(404).json({ error: 'Database not found' });
  }
  
  databases.splice(index, 1);
  res.json({ message: `Database "${name}" deleted successfully` });
});

// Email Management
let emails = [
  { address: 'admin@domain.com', usage: '120 MB / 2 GB', status: 'Active' }
];

app.get('/api/emails', (req, res) => {
  res.json(emails);
});

app.post('/api/emails', (req, res) => {
  const { address, password, size } = req.body;
  if (!address) {
    return res.status(400).json({ error: 'Email address is required' });
  }
  
  const newEmail = { address, usage: `0 MB / ${size} GB`, status: 'Active' };
  emails.push(newEmail);
  res.json({ message: `Email "${address}" created successfully`, email: newEmail });
});

app.delete('/api/emails/:address', (req, res) => {
  const address = req.params.address;
  const index = emails.findIndex(email => email.address === address);
  if (index === -1) {
    return res.status(404).json({ error: 'Email not found' });
  }
  
  emails.splice(index, 1);
  res.json({ message: `Email "${address}" deleted successfully` });
});

// Domain Management
let domains = [
  { domain: 'domain.com', type: 'Primary', ssl: 'Auto' },
  { domain: 'demo.domain.com', type: 'Subdomain', ssl: 'Auto' }
];

app.get('/api/domains', (req, res) => {
  res.json(domains);
});

app.post('/api/domains', (req, res) => {
  const { name, type, root } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Domain name is required' });
  }
  
  const typeLabel = type === 'primary' ? 'Primary' : type === 'subdomain' ? 'Subdomain' : 'Addon';
  const newDomain = { domain: name, type: typeLabel, ssl: 'Auto' };
  domains.push(newDomain);
  res.json({ message: `Domain "${name}" added successfully`, domain: newDomain });
});

app.delete('/api/domains/:domain', (req, res) => {
  const domain = req.params.domain;
  const index = domains.findIndex(d => d.domain === domain);
  if (index === -1) {
    return res.status(404).json({ error: 'Domain not found' });
  }
  
  domains.splice(index, 1);
  res.json({ message: `Domain "${domain}" deleted successfully` });
});

// User Management
let users = [
  { user: 'admin', role: 'Owner', lastActive: '2h ago' }
];

app.get('/api/users', (req, res) => {
  res.json(users);
});

app.post('/api/users', (req, res) => {
  const { email, role } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  
  const roleLabel = role === 'admin' ? 'Administrator' : role === 'editor' ? 'Editor' : 'Viewer';
  const newUser = { user: email, role: roleLabel, lastActive: 'Never' };
  users.push(newUser);
  res.json({ message: `Invitation sent to "${email}"`, user: newUser });
});

app.delete('/api/users/:user', (req, res) => {
  const user = req.params.user;
  const index = users.findIndex(u => u.user === user);
  if (index === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  users.splice(index, 1);
  res.json({ message: `User "${user}" removed successfully` });
});

// Backup Management
let backups = [
  { date: 'Today', size: '1.2 GB', type: 'Full', status: 'Complete' },
  { date: 'Yesterday', size: '400 MB', type: 'Incremental', status: 'Complete' }
];

app.get('/api/backups', (req, res) => {
  res.json(backups);
});

app.post('/api/backups', (req, res) => {
  const { type } = req.body;
  const now = new Date().toLocaleDateString();
  const size = type === 'full' ? '1.2 GB' : '400 MB';
  const newBackup = { 
    date: now, 
    size, 
    type: type.charAt(0).toUpperCase() + type.slice(1), 
    status: 'In Progress' 
  };
  
  backups.unshift(newBackup);
  res.json({ message: `${newBackup.type} backup started`, backup: newBackup });
});

// System Stats
app.get('/api/stats', (req, res) => {
  const stats = {
    cpu: Math.floor(Math.random() * 30) + 10,
    memory: Math.floor(Math.random() * 20) + 30,
    disk: Math.floor(Math.random() * 15) + 35,
    bandwidth: (Math.random() * 5 + 10).toFixed(1) + ' GB'
  };
  res.json(stats);
});

// Security Events
let securityEvents = [
  { time: '14:23', event: 'Failed login attempt', ip: '192.168.1.100', action: 'Blocked' },
  { time: '13:45', event: 'Suspicious file detected', ip: '—', action: 'Quarantined' },
  { time: '12:30', event: 'SSL certificate renewed', ip: '—', action: 'Success' }
];

app.get('/api/security/events', (req, res) => {
  res.json(securityEvents);
});

app.post('/api/security/scan', (req, res) => {
  res.json({ message: 'Malware scan started' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Atulya Panel server running on http://localhost:${PORT}`);
  console.log(`📁 Upload directory: ${uploadsDir}`);
});
