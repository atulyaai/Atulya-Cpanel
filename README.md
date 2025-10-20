# Atulya Panel

A lightweight, modern hosting control panel with a beautiful UI and real backend functionality.

• Repo: [`github.com/atulyaai/Atulya-Cpanel`](https://github.com/atulyaai/Atulya-Cpanel)
• Version: see `VERSION`
• Changelog: see `CHANGELOG.md`
• Roadmap: see `ROADMAP.md`

## Features

- **Modern UI**: Light/dark theme, responsive design, collapsible sidebar
- **Command Palette**: Press `Ctrl+K` for quick navigation
- **Real File Management**: Upload, download, create folders, drag-and-drop
- **Database Management**: Create, edit, delete databases
- **Email Management**: Add mailboxes with size limits
- **Domain Management**: Add primary/subdomain/addon domains
- **User Management**: Invite users with role-based permissions
- **Security**: Malware scanning, firewall rules, security events
- **Backups**: Create and schedule backups with progress tracking
- **Live Dashboard**: Real-time system stats and usage meters

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the server**:
   ```bash
   npm start
   ```

3. **Open your browser**:
   Visit `http://localhost:3000`

## Development

For development with auto-restart:
```bash
npm run dev
```

## API Endpoints

- `GET /api/files` - List files
- `POST /api/files/upload` - Upload files
- `POST /api/files/folder` - Create folder
- `DELETE /api/files/:filename` - Delete file
- `GET /api/databases` - List databases
- `POST /api/databases` - Create database
- `DELETE /api/databases/:name` - Delete database
- `GET /api/emails` - List emails
- `POST /api/emails` - Create email
- `DELETE /api/emails/:address` - Delete email
- `GET /api/domains` - List domains
- `POST /api/domains` - Add domain
- `DELETE /api/domains/:domain` - Delete domain
- `GET /api/users` - List users
- `POST /api/users` - Invite user
- `DELETE /api/users/:user` - Remove user
- `GET /api/backups` - List backups
- `POST /api/backups` - Create backup
- `GET /api/stats` - System stats
- `GET /api/security/events` - Security events
- `POST /api/security/scan` - Start malware scan

## File Structure

```
atulya-panel/
├── index.html          # Main HTML file
├── assets/
│   ├── styles.css      # CSS styles
│   └── app.js          # Frontend JavaScript
├── server.js           # Node.js backend
├── package.json        # Dependencies
└── uploads/           # File upload directory (auto-created)
```

## Customization

- **Theme**: Toggle between light/dark mode
- **Colors**: Edit CSS variables in `assets/styles.css`
- **Features**: Add new sections in `assets/app.js`
- **API**: Extend endpoints in `server.js`

## Requirements

- Node.js 14+
- Modern web browser
- 50MB disk space

## License

MIT License - Free to use and modify.

---

**Atulya Panel** - Lightweight, modern, and powerful hosting control panel.
