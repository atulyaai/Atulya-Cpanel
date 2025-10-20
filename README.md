# Atulya Panel v2.1 - Production-Ready cPanel Alternative

A modern, lightweight hosting control panel built with TypeScript, Vue 3, and Fastify. **Phase 2 Complete!** Now with real system integrations for production use.

## 🚀 Features

### ✅ Implemented (Phase 1 & 2 Complete)
- **Modern Backend**: TypeScript + Fastify + Prisma ORM
- **Authentication**: JWT-based auth with RBAC (Admin, Reseller, User roles)
- **Database Persistence**: PostgreSQL with Prisma
- **Modern Frontend**: Vue 3 + TypeScript + PrimeVue + TailwindCSS
- **Responsive UI**: Professional dashboard with real-time metrics
- **API-First Design**: RESTful APIs with comprehensive error handling
- **Real Database Management**: MySQL/MariaDB database creation and management
- **Web Server Management**: Nginx/Apache virtual host management with PHP-FPM
- **SSL Automation**: Let's Encrypt with auto-renewal and wildcard support
- **Email Server Integration**: Postfix + Dovecot email account management

### 🔄 In Development (Phase 3-6)
- **Advanced File Manager**: Monaco editor, drag-and-drop
- **Real System Monitoring**: WebSocket-based real-time metrics
- **DNS Management**: PowerDNS integration
- **FTP Management**: Pure-FTPd integration
- **Backup System**: Incremental backups with restore
- **Application Installers**: WordPress, Laravel, etc.
- **Security Features**: 2FA, fail2ban, malware scanning
- **Multi-User System**: Reseller accounts with quotas

## 🏗️ Architecture

### Backend Stack
- **Runtime**: Node.js 20 LTS
- **Framework**: Fastify (2-3x faster than Express)
- **Language**: TypeScript with strict mode
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with refresh tokens
- **Queue System**: Bull with Redis
- **Real-time**: Socket.IO
- **Validation**: Zod schemas

### Frontend Stack
- **Framework**: Vue 3 with Composition API
- **Language**: TypeScript
- **Build Tool**: Vite
- **UI Library**: PrimeVue + TailwindCSS
- **State Management**: Pinia
- **Routing**: Vue Router
- **Charts**: Apache ECharts
- **Code Editor**: Monaco Editor

### System Services
- **Web Server**: Nginx (reverse proxy) + Apache (backend)
- **PHP**: Multiple versions (7.4, 8.0, 8.1, 8.2, 8.3)
- **Database**: MariaDB/MySQL + PostgreSQL
- **Email**: Postfix + Dovecot
- **DNS**: PowerDNS
- **SSL**: Certbot (Let's Encrypt)
- **FTP**: Pure-FTPd
- **Security**: fail2ban, ClamAV
- **Caching**: Redis

## 📦 Installation

### Prerequisites
- Node.js 20 LTS
- PostgreSQL 15+
- Redis 7+
- Git

### Quick Start

1. **Clone the repository**:
   ```bash
   git clone https://github.com/atulyaai/Atulya-Cpanel.git
   cd Atulya-Cpanel
   ```

2. **Backend Setup**:
   ```bash
   cd backend
   npm install
   cp env.example .env
   # Edit .env with your database credentials
   npx prisma migrate dev
   npx prisma db seed
   npm run dev
   ```

3. **Frontend Setup**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. **Access the panel**:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000
   - API Docs: http://localhost:3000/docs

### Demo Credentials
- **Admin**: admin@atulyapanel.com / admin123
- **User**: user@example.com / user123

## 🛠️ Development

### Project Structure
```
atulya-panel/
├── backend/                 # TypeScript backend
│   ├── src/
│   │   ├── server.ts       # Main server file
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── providers/      # System integrations
│   │   ├── middleware/     # Auth, validation, etc.
│   │   └── utils/          # Helper functions
│   ├── prisma/             # Database schema & migrations
│   └── package.json
├── frontend/               # Vue 3 frontend
│   ├── src/
│   │   ├── main.ts         # App entry point
│   │   ├── views/          # Page components
│   │   ├── components/     # Reusable components
│   │   ├── stores/         # Pinia stores
│   │   ├── router/         # Vue Router
│   │   └── api/            # API client
│   └── package.json
└── README.md
```

### Available Scripts

**Backend**:
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database with sample data

**Frontend**:
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 🔧 Configuration

### Environment Variables

**Backend (.env)**:
```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/atulya_panel"

# JWT
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="7d"

# Server
PORT=3000
NODE_ENV="development"

# System
PROVIDER="LOCAL"  # LOCAL or SYSTEM
SITES_ROOT="/var/www"
```

**Frontend (.env)**:
```env
VITE_API_BASE_URL="http://localhost:3000/api/v1"
VITE_APP_TITLE="Atulya Panel"
```

## 📊 API Documentation

### Authentication Endpoints
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - User logout
- `GET /api/v1/auth/me` - Get current user

### Core Endpoints
- `GET /api/v1/sites` - List sites
- `POST /api/v1/sites` - Create site
- `GET /api/v1/databases` - List databases
- `POST /api/v1/databases` - Create database
- `GET /api/v1/metrics` - System metrics
- `GET /api/health` - Health check

## 🔒 Security Features

- **JWT Authentication**: Secure token-based auth
- **Role-Based Access Control**: Admin, Reseller, User roles
- **Rate Limiting**: API rate limiting protection
- **Input Validation**: Zod schema validation
- **Audit Logging**: Complete action logging
- **Password Hashing**: bcrypt with configurable rounds
- **CORS Protection**: Configured for frontend domains

## 🚀 Deployment

### Production Setup

1. **Install Dependencies**:
   ```bash
   # Install Node.js, PostgreSQL, Redis
   sudo apt update
   sudo apt install nodejs postgresql redis-server
   ```

2. **Database Setup**:
   ```bash
   sudo -u postgres createdb atulya_panel
   cd backend && npx prisma migrate deploy
   ```

3. **Build Applications**:
   ```bash
   # Backend
   cd backend && npm run build
   
   # Frontend
   cd frontend && npm run build
   ```

4. **Start Services**:
   ```bash
   # Backend
   cd backend && npm start
   
   # Frontend (serve with nginx/apache)
   # Point to frontend/dist directory
   ```

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines
- Use TypeScript for all new code
- Follow ESLint and Prettier configurations
- Write tests for new features
- Update documentation for API changes
- Follow conventional commit messages

## 📋 Roadmap

### Phase 2: Core System Integrations (Week 3-4)
- [ ] Real MySQL/MariaDB database management
- [ ] Nginx/Apache virtual host management
- [ ] Let's Encrypt SSL automation
- [ ] Postfix/Dovecot email integration

### Phase 3: Advanced Features (Week 5-6)
- [ ] Real system monitoring with WebSocket
- [ ] Advanced file manager with Monaco editor
- [ ] DNS management with PowerDNS
- [ ] FTP/SFTP account management

### Phase 4: Enterprise Features (Week 7-8)
- [ ] Real backup/restore system
- [ ] One-click application installers
- [ ] Cron job manager
- [ ] Resource quotas and limits

### Phase 5: Security & Monitoring (Week 9-10)
- [ ] Security features (2FA, fail2ban, malware scanning)
- [ ] Monitoring and alerting system
- [ ] Multi-user and reseller system
- [ ] Comprehensive audit logs

### Phase 6: Deployment & Distribution (Week 11-12)
- [ ] Universal installation scripts
- [ ] Safe update system
- [ ] Comprehensive documentation
- [ ] Performance optimization

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Fastify](https://www.fastify.io/) - Fast and low overhead web framework
- [Vue.js](https://vuejs.org/) - Progressive JavaScript framework
- [PrimeVue](https://primevue.org/) - Rich UI component library
- [Prisma](https://www.prisma.io/) - Next-generation ORM
- [TailwindCSS](https://tailwindcss.com/) - Utility-first CSS framework

## 📞 Support

- **Documentation**: [docs.atulyapanel.com](https://docs.atulyapanel.com)
- **Issues**: [GitHub Issues](https://github.com/atulyaai/Atulya-Cpanel/issues)
- **Discussions**: [GitHub Discussions](https://github.com/atulyaai/Atulya-Cpanel/discussions)
- **Email**: support@atulyapanel.com

---

**Atulya Panel** - Modern, fast, and secure hosting control panel. Built for the future of web hosting.