# 🚀 Atulya Panel - One-Click Installation Guide

## 📋 Overview

Atulya Panel is a modern, open-source alternative to cPanel that provides comprehensive web hosting management with a beautiful, intuitive interface. This guide will help you install Atulya Panel on your Linux server with a single command.

## 🆚 Atulya Panel vs cPanel Comparison

| Feature | Atulya Panel | cPanel |
|---------|--------------|--------|
| **Cost** | Free & Open Source | $200-500/month |
| **License** | MIT License | Proprietary |
| **Modern UI** | ✅ Vue 3 + TypeScript | ❌ Legacy Interface |
| **Real-time Monitoring** | ✅ WebSocket-based | ❌ Polling-based |
| **API** | ✅ RESTful + WebSocket | ✅ RESTful |
| **File Manager** | ✅ Monaco Editor | ✅ Basic Editor |
| **Database Management** | ✅ Multi-DB Support | ✅ MySQL/PostgreSQL |
| **SSL Automation** | ✅ Let's Encrypt | ✅ Let's Encrypt |
| **Email Management** | ✅ Postfix/Dovecot | ✅ cPanel Email |
| **Backup System** | ✅ Automated | ✅ Automated |
| **Security** | ✅ Modern Security | ✅ Enterprise Security |
| **Performance** | ✅ High Performance | ✅ Optimized |
| **Customization** | ✅ Fully Customizable | ❌ Limited |
| **Support** | ✅ Community + Docs | ✅ 24/7 Support |

## 🎯 Key Features

### 🔴 Real-time System Monitoring
- Live CPU, memory, disk, and network usage
- Service status monitoring (Nginx, Apache, MySQL, PostgreSQL, PHP-FPM)
- WebSocket integration with <10ms latency
- Automated alert system

### 📁 Advanced File Manager
- Monaco Editor with syntax highlighting
- File operations (upload, download, create, delete, move, copy)
- ZIP and TAR archive support
- Path validation and security

### 🗄️ Database Management
- Multi-database support (MySQL, MariaDB, PostgreSQL)
- Secure user creation with password generation
- SQL injection prevention
- Query performance monitoring

### 📧 Email Server Integration
- Postfix/Dovecot management
- Virtual mailbox creation
- DKIM support
- Email forwarding configuration

### 🔒 SSL Certificate Automation
- Let's Encrypt integration
- HTTP-01 and DNS-01 challenges
- Wildcard certificate support
- Auto-renewal system

## 🛠️ System Requirements

### Minimum Requirements
- **OS**: Ubuntu 20.04+, Debian 11+, CentOS 8+, RHEL 8+
- **CPU**: 2 cores
- **RAM**: 4GB
- **Storage**: 50GB SSD
- **Network**: 100 Mbps

### Recommended Requirements
- **OS**: Ubuntu 22.04 LTS
- **CPU**: 4+ cores
- **RAM**: 8GB+
- **Storage**: 100GB+ SSD
- **Network**: 1 Gbps

## 🚀 One-Click Installation

### Quick Start

```bash
# Download and run the installer
curl -fsSL https://raw.githubusercontent.com/atulyaai/Atulya-Cpanel/main/install.sh | sudo bash
```

### Manual Installation

```bash
# Clone the repository
git clone https://github.com/atulyaai/Atulya-Cpanel.git
cd Atulya-Cpanel

# Run the installer
sudo ./install.sh
```

## 📦 What Gets Installed

The installer automatically installs and configures:

### System Dependencies
- **Node.js 20 LTS** - Runtime environment
- **PostgreSQL** - Primary database
- **MySQL/MariaDB** - User databases
- **Redis** - Caching and job queues
- **Nginx** - Web server
- **Certbot** - SSL certificate automation
- **Fail2ban** - Security protection
- **UFW/Firewalld** - Firewall configuration

### Services Configuration
- **PostgreSQL** - Database server with user and database creation
- **MySQL** - Database server with root password setup
- **Redis** - Cache server with memory optimization
- **Nginx** - Web server with reverse proxy configuration
- **Systemd** - Service management and auto-start

### Security Features
- **Firewall** - Port 22, 80, 443, 3000 opened
- **Fail2ban** - Brute force protection
- **SSL** - Self-signed certificate (Let's Encrypt ready)
- **Security Headers** - XSS, CSRF, and clickjacking protection
- **Rate Limiting** - API and login protection

## 🔧 Installation Process

The installer performs the following steps:

1. **System Detection** - Identifies OS and package manager
2. **System Update** - Updates all system packages
3. **Node.js Installation** - Installs Node.js 20 LTS
4. **Dependencies** - Installs all required system packages
5. **Database Setup** - Configures PostgreSQL and MySQL
6. **Service User** - Creates dedicated service user
7. **Application Install** - Copies and installs Atulya Panel
8. **Environment Config** - Generates secure configuration
9. **Database Migration** - Sets up database schema
10. **Build Process** - Compiles backend and frontend
11. **Nginx Config** - Configures web server
12. **Service Setup** - Creates systemd service
13. **Firewall Config** - Sets up security rules
14. **Monitoring** - Configures logging and monitoring
15. **Management Scripts** - Creates control commands

## 🌐 Post-Installation

### Access Information
- **Web Panel**: `http://YOUR_SERVER_IP`
- **API**: `http://YOUR_SERVER_IP/api`
- **Health Check**: `http://YOUR_SERVER_IP/api/health`

### Default Credentials
- **Admin Email**: `admin@atulya-panel.com`
- **Admin Password**: `admin123`
- **User Email**: `user@example.com`
- **User Password**: `user123`

### Management Commands
```bash
# Service control
atulya-start      # Start the service
atulya-stop       # Stop the service
atulya-restart    # Restart the service
atulya-status     # Check service status
atulya-logs       # View live logs

# System management
systemctl status atulya-panel
journalctl -u atulya-panel -f
```

## 🔒 Security Configuration

### Change Default Passwords
```bash
# Access the web panel and change passwords immediately
# Or use the API to update passwords
curl -X POST http://YOUR_SERVER_IP/api/v1/auth/change-password \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword": "admin123", "newPassword": "YourSecurePassword123!"}'
```

### SSL Configuration
```bash
# Configure Let's Encrypt SSL
certbot --nginx -d yourdomain.com

# Or use the built-in SSL management in the web panel
```

### Firewall Management
```bash
# Check firewall status
ufw status

# Add additional rules if needed
ufw allow 8080/tcp
```

## 📊 Monitoring and Logs

### Log Locations
- **Application Logs**: `/var/log/atulya-panel/app.log`
- **System Logs**: `journalctl -u atulya-panel`
- **Nginx Logs**: `/var/log/nginx/`
- **Database Logs**: `/var/log/postgresql/`

### Monitoring
- **System Metrics**: Available in the web panel
- **Service Status**: Real-time monitoring
- **Performance**: CPU, memory, disk usage
- **Alerts**: Automated notifications

## 🔧 Troubleshooting

### Common Issues

#### Service Won't Start
```bash
# Check service status
systemctl status atulya-panel

# Check logs
journalctl -u atulya-panel -f

# Restart service
systemctl restart atulya-panel
```

#### Database Connection Issues
```bash
# Check PostgreSQL status
systemctl status postgresql

# Check database connection
sudo -u postgres psql -c "SELECT 1;"

# Check Redis status
systemctl status redis
```

#### Nginx Issues
```bash
# Test Nginx configuration
nginx -t

# Check Nginx status
systemctl status nginx

# Restart Nginx
systemctl restart nginx
```

#### Port Already in Use
```bash
# Check what's using port 3000
lsof -i :3000

# Kill the process
sudo kill -9 PID

# Or change the port in the configuration
```

### Log Analysis
```bash
# View application logs
tail -f /var/log/atulya-panel/app.log

# View system logs
journalctl -u atulya-panel -f

# View Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

## 🚀 Advanced Configuration

### Environment Variables
Edit `/opt/atulya-panel/backend/.env` to customize:

```bash
# Database configuration
DATABASE_URL="postgresql://user:password@localhost:5432/atulya_panel"

# JWT configuration
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"

# Redis configuration
REDIS_URL="redis://localhost:6379"

# System configuration
SITES_ROOT="/var/www"
PROVIDER="SYSTEM"

# Security settings
BCRYPT_ROUNDS=12
RATE_LIMIT_MAX=1000
```

### Nginx Configuration
Edit `/etc/nginx/sites-available/atulya-panel` to customize:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    # Custom configurations
    client_max_body_size 100M;
    
    # SSL configuration
    # listen 443 ssl;
    # ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
}
```

### Database Configuration
```bash
# PostgreSQL configuration
sudo -u postgres psql
CREATE DATABASE custom_db;
CREATE USER custom_user WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE custom_db TO custom_user;

# MySQL configuration
mysql -u root -p
CREATE DATABASE custom_db;
CREATE USER 'custom_user'@'localhost' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON custom_db.* TO 'custom_user'@'localhost';
```

## 🔄 Updates and Maintenance

### Updating Atulya Panel
```bash
# Update to latest version
atulya-update

# Or manually
cd /opt/atulya-panel
git pull origin main
cd backend && npm install && npm run build
cd ../frontend && npm install && npm run build
systemctl restart atulya-panel
```

### Backup and Restore
```bash
# Backup database
pg_dump atulya_panel > backup.sql

# Backup application
tar -czf atulya-panel-backup.tar.gz /opt/atulya-panel

# Restore database
psql atulya_panel < backup.sql
```

### System Maintenance
```bash
# Update system packages
apt update && apt upgrade -y

# Clean up logs
logrotate -f /etc/logrotate.d/atulya-panel

# Monitor disk space
df -h
du -sh /opt/atulya-panel
```

## 📚 Additional Resources

### Documentation
- **API Documentation**: Available in the web panel
- **User Guide**: Built-in help system
- **Developer Guide**: `/workspace/DEVELOPMENT_GUIDE.md`
- **Testing Guide**: `/workspace/TESTING.md`

### Support
- **GitHub Issues**: https://github.com/atulyaai/Atulya-Cpanel/issues
- **Discussions**: https://github.com/atulyaai/Atulya-Cpanel/discussions
- **Documentation**: https://github.com/atulyaai/Atulya-Cpanel/wiki

### Community
- **Discord**: Join our Discord server
- **Reddit**: r/AtulyaPanel
- **Twitter**: @AtulyaPanel

## 🎉 Conclusion

Atulya Panel provides a modern, feature-rich alternative to cPanel with:

- ✅ **Free and Open Source**
- ✅ **Modern Technology Stack**
- ✅ **Real-time Monitoring**
- ✅ **Advanced Security**
- ✅ **Easy Installation**
- ✅ **Comprehensive Management**
- ✅ **Active Community**

The one-click installer makes it easy to get started, while the comprehensive feature set ensures you have everything you need for professional web hosting management.

---

**Made with ❤️ by the Atulya Panel Team**

[![GitHub](https://img.shields.io/badge/GitHub-github.com%2Fatulyaai%2FAtulya--Cpanel-181717?style=for-the-badge)](https://github.com/atulyaai/Atulya-Cpanel)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Stars](https://img.shields.io/github/stars/atulyaai/Atulya-Cpanel?style=for-the-badge)](https://github.com/atulyaai/Atulya-Cpanel/stargazers)

**⭐ Star this repository if you find it helpful!**
