#!/bin/bash

# Atulya Panel - One-Click Linux Installer
# Production-ready cPanel alternative installer

set -e

# Version and configuration
ATULYA_VERSION="2.1.0"
INSTALL_DIR="/opt/atulya-panel"
SERVICE_USER="atulya"
SERVICE_GROUP="atulya"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Function to print colored output
print_header() {
    echo -e "${PURPLE}================================${NC}"
    echo -e "${PURPLE}  🚀 Atulya Panel Installer    ${NC}"
    echo -e "${PURPLE}  Version: $ATULYA_VERSION        ${NC}"
    echo -e "${PURPLE}================================${NC}"
    echo ""
}

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Detect OS and distribution
detect_os() {
    print_step "Detecting operating system..."
    
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$NAME
        VER=$VERSION_ID
    else
        OS=$(uname -s)
        VER=$(uname -r)
    fi
    
    print_success "Detected OS: $OS $VER"
    
    # Set package manager
    case $OS in
        "Ubuntu"|"Debian GNU/Linux")
            PKG_MANAGER="apt"
            UPDATE_CMD="apt update"
            INSTALL_CMD="apt install -y"
            ;;
        "CentOS Linux"|"Red Hat Enterprise Linux"|"Rocky Linux"|"AlmaLinux")
            PKG_MANAGER="yum"
            UPDATE_CMD="yum update -y"
            INSTALL_CMD="yum install -y"
            ;;
        "Fedora")
            PKG_MANAGER="dnf"
            UPDATE_CMD="dnf update -y"
            INSTALL_CMD="dnf install -y"
            ;;
        *)
            print_error "Unsupported operating system: $OS"
            exit 1
            ;;
    esac
}

# Update system packages
update_system() {
    print_step "Updating system packages..."
    $UPDATE_CMD
    print_success "System packages updated"
}

# Install Node.js 20 LTS
install_nodejs() {
    print_step "Installing Node.js 20 LTS..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -ge 20 ]; then
            print_success "Node.js $(node --version) is already installed"
            return
        fi
    fi
    
    # Install Node.js 20 LTS
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    $INSTALL_CMD nodejs
    
    print_success "Node.js $(node --version) installed successfully"
}

# Install system dependencies
install_dependencies() {
    print_step "Installing system dependencies..."
    
    case $PKG_MANAGER in
        "apt")
            $INSTALL_CMD curl wget git build-essential software-properties-common \
                nginx postgresql postgresql-contrib redis-server \
                mysql-server mysql-client \
                certbot python3-certbot-nginx \
                fail2ban ufw \
                htop iotop nethogs \
                zip unzip tar gzip \
                vim nano \
                cron logrotate \
                supervisor
            ;;
        "yum"|"dnf")
            $INSTALL_CMD curl wget git gcc gcc-c++ make \
                nginx postgresql-server postgresql-contrib \
                mysql-server mysql \
                certbot python3-certbot-nginx \
                fail2ban firewalld \
                htop iotop \
                zip unzip tar gzip \
                vim nano \
                cronie logrotate \
                supervisor
            ;;
    esac
    
    print_success "System dependencies installed"
}

# Configure PostgreSQL
setup_postgresql() {
    print_step "Setting up PostgreSQL..."
    
    case $PKG_MANAGER in
        "apt")
            systemctl start postgresql
            systemctl enable postgresql
            ;;
        "yum"|"dnf")
            postgresql-setup --initdb
            systemctl start postgresql
            systemctl enable postgresql
            ;;
    esac
    
    # Create database and user
    sudo -u postgres psql -c "CREATE DATABASE atulya_panel;" 2>/dev/null || true
    sudo -u postgres psql -c "CREATE USER atulya WITH PASSWORD 'atulya_secure_password_2024';" 2>/dev/null || true
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE atulya_panel TO atulya;" 2>/dev/null || true
    sudo -u postgres psql -c "ALTER USER atulya CREATEDB;" 2>/dev/null || true
    
    print_success "PostgreSQL configured"
}

# Configure MySQL
setup_mysql() {
    print_step "Setting up MySQL..."
    
    systemctl start mysqld
    systemctl enable mysqld
    
    # Set root password
    mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED BY 'AtulyaRoot2024!';" 2>/dev/null || \
    mysql -u root -p"AtulyaRoot2024!" -e "SELECT 1;" 2>/dev/null || \
    mysql_secure_installation --use-default
    
    print_success "MySQL configured"
}

# Configure Redis
setup_redis() {
    print_step "Setting up Redis..."
    
    systemctl start redis
    systemctl enable redis
    
    print_success "Redis configured"
}

# Create service user
create_service_user() {
    print_step "Creating service user..."
    
    if ! id "$SERVICE_USER" &>/dev/null; then
        useradd -r -s /bin/bash -d "$INSTALL_DIR" -m "$SERVICE_USER"
        usermod -aG www-data "$SERVICE_USER" 2>/dev/null || true
        usermod -aG postgres "$SERVICE_USER" 2>/dev/null || true
    fi
    
    print_success "Service user created"
}

# Install Atulya Panel
install_atulya_panel() {
    print_step "Installing Atulya Panel..."
    
    # Create installation directory
    mkdir -p "$INSTALL_DIR"
    chown "$SERVICE_USER:$SERVICE_GROUP" "$INSTALL_DIR"
    
    # Copy application files
    cp -r /workspace/* "$INSTALL_DIR/"
    chown -R "$SERVICE_USER:$SERVICE_GROUP" "$INSTALL_DIR"
    
    # Install dependencies
    cd "$INSTALL_DIR"
    sudo -u "$SERVICE_USER" npm install
    
    # Install backend dependencies
    cd "$INSTALL_DIR/backend"
    sudo -u "$SERVICE_USER" npm install
    
    # Install frontend dependencies
    cd "$INSTALL_DIR/frontend"
    sudo -u "$SERVICE_USER" npm install
    
    print_success "Atulya Panel installed"
}

# Configure environment
configure_environment() {
    print_step "Configuring environment..."
    
    # Generate secure passwords
    JWT_SECRET=$(openssl rand -base64 64)
    DB_PASSWORD="atulya_secure_password_2024"
    MYSQL_ROOT_PASSWORD="AtulyaRoot2024!"
    
    # Create production .env file
    cat > "$INSTALL_DIR/backend/.env" << EOL
# Database
DATABASE_URL="postgresql://atulya:$DB_PASSWORD@localhost:5432/atulya_panel"

# JWT
JWT_SECRET="$JWT_SECRET"
JWT_EXPIRES_IN="7d"
JWT_REFRESH_EXPIRES_IN="30d"

# Redis
REDIS_URL="redis://localhost:6379"

# Server
PORT=3000
HOST="0.0.0.0"
NODE_ENV="production"

# System Configuration
PROVIDER="SYSTEM"
SITES_ROOT="/var/www"
DRY_RUN="false"

# MySQL Configuration
MYSQL_HOST="localhost"
MYSQL_PORT=3306
MYSQL_ROOT_USER="root"
MYSQL_ROOT_PASSWORD="$MYSQL_ROOT_PASSWORD"

# Email Configuration
POSTFIX_VIRTUAL_DIR="/etc/postfix/virtual"
DOVECOT_CONF_DIR="/etc/dovecot"

# SSL Configuration
CERTBOT_EMAIL="admin@$(hostname)"
SSL_STAGING="false"

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_MAX=1000
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_LOGIN_MAX=5
RATE_LIMIT_LOGIN_WINDOW=900000
PASSWORD_MIN_LENGTH=8
PASSWORD_REQUIRE_UPPERCASE=true
PASSWORD_REQUIRE_LOWERCASE=true
PASSWORD_REQUIRE_NUMBERS=true
PASSWORD_REQUIRE_SYMBOLS=true

# Security Headers
SECURITY_HEADERS_ENABLED=true
CSP_ENABLED=true
HSTS_ENABLED=true
X_FRAME_OPTIONS="DENY"
X_CONTENT_TYPE_OPTIONS="nosniff"
X_XSS_PROTECTION="1; mode=block"

# Frontend
FRONTEND_URL="http://$(hostname -I | awk '{print $1}'):80"

# Logging
LOG_LEVEL="info"
LOG_FILE="/var/log/atulya-panel/app.log"
EOL
    
    chown "$SERVICE_USER:$SERVICE_GROUP" "$INSTALL_DIR/backend/.env"
    chmod 600 "$INSTALL_DIR/backend/.env"
    
    print_success "Environment configured"
}

# Setup database
setup_database() {
    print_step "Setting up database..."
    
    cd "$INSTALL_DIR/backend"
    
    # Generate Prisma client
    sudo -u "$SERVICE_USER" npx prisma generate
    
    # Run migrations
    sudo -u "$SERVICE_USER" npx prisma migrate deploy
    
    # Seed database
    sudo -u "$SERVICE_USER" npx prisma db seed
    
    print_success "Database setup completed"
}

# Build application
build_application() {
    print_step "Building application..."
    
    # Build backend
    cd "$INSTALL_DIR/backend"
    sudo -u "$SERVICE_USER" npm run build
    
    # Build frontend
    cd "$INSTALL_DIR/frontend"
    sudo -u "$SERVICE_USER" npm run build
    
    print_success "Application built"
}

# Configure Nginx
configure_nginx() {
    print_step "Configuring Nginx..."
    
    # Create Nginx configuration
    cat > /etc/nginx/sites-available/atulya-panel << EOL
server {
    listen 80;
    server_name _;
    
    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Frontend
    location / {
        root $INSTALL_DIR/frontend/dist;
        try_files \$uri \$uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # File upload size
    client_max_body_size 100M;
}
EOL
    
    # Enable site
    ln -sf /etc/nginx/sites-available/atulya-panel /etc/nginx/sites-enabled/
    
    # Remove default site
    rm -f /etc/nginx/sites-enabled/default
    
    # Test configuration
    nginx -t
    
    # Restart Nginx
    systemctl restart nginx
    systemctl enable nginx
    
    print_success "Nginx configured"
}

# Create systemd service
create_systemd_service() {
    print_step "Creating systemd service..."
    
    cat > /etc/systemd/system/atulya-panel.service << EOL
[Unit]
Description=Atulya Panel - cPanel Alternative
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_GROUP
WorkingDirectory=$INSTALL_DIR/backend
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=$INSTALL_DIR/backend/.env

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$INSTALL_DIR /var/log/atulya-panel /var/www

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=atulya-panel

[Install]
WantedBy=multi-user.target
EOL
    
    # Reload systemd and enable service
    systemctl daemon-reload
    systemctl enable atulya-panel
    systemctl start atulya-panel
    
    print_success "Systemd service created"
}

# Configure firewall
configure_firewall() {
    print_step "Configuring firewall..."
    
    case $PKG_MANAGER in
        "apt")
            ufw --force enable
            ufw allow 22/tcp
            ufw allow 80/tcp
            ufw allow 443/tcp
            ufw allow 3000/tcp
            ;;
        "yum"|"dnf")
            systemctl start firewalld
            systemctl enable firewalld
            firewall-cmd --permanent --add-service=ssh
            firewall-cmd --permanent --add-service=http
            firewall-cmd --permanent --add-service=https
            firewall-cmd --permanent --add-port=3000/tcp
            firewall-cmd --reload
            ;;
    esac
    
    print_success "Firewall configured"
}

# Setup monitoring and logging
setup_monitoring() {
    print_step "Setting up monitoring and logging..."
    
    # Create log directory
    mkdir -p /var/log/atulya-panel
    chown "$SERVICE_USER:$SERVICE_GROUP" /var/log/atulya-panel
    
    # Configure logrotate
    cat > /etc/logrotate.d/atulya-panel << EOL
/var/log/atulya-panel/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 $SERVICE_USER $SERVICE_GROUP
    postrotate
        systemctl reload atulya-panel
    endscript
}
EOL
    
    print_success "Monitoring and logging configured"
}

# Create management scripts
create_management_scripts() {
    print_step "Creating management scripts..."
    
    # Create start script
    cat > /usr/local/bin/atulya-start << 'EOL'
#!/bin/bash
systemctl start atulya-panel
echo "Atulya Panel started"
EOL
    
    # Create stop script
    cat > /usr/local/bin/atulya-stop << 'EOL'
#!/bin/bash
systemctl stop atulya-panel
echo "Atulya Panel stopped"
EOL
    
    # Create restart script
    cat > /usr/local/bin/atulya-restart << 'EOL'
#!/bin/bash
systemctl restart atulya-panel
echo "Atulya Panel restarted"
EOL
    
    # Create status script
    cat > /usr/local/bin/atulya-status << 'EOL'
#!/bin/bash
systemctl status atulya-panel
EOL
    
    # Create logs script
    cat > /usr/local/bin/atulya-logs << 'EOL'
#!/bin/bash
journalctl -u atulya-panel -f
EOL
    
    # Make scripts executable
    chmod +x /usr/local/bin/atulya-*
    
    print_success "Management scripts created"
}

# Display installation summary
display_summary() {
    print_header
    echo -e "${GREEN}🎉 Installation completed successfully!${NC}"
    echo ""
    echo -e "${CYAN}📋 Installation Summary:${NC}"
    echo -e "  • Atulya Panel installed to: $INSTALL_DIR"
    echo -e "  • Service user: $SERVICE_USER"
    echo -e "  • Database: PostgreSQL (atulya_panel)"
    echo -e "  • Cache: Redis"
    echo -e "  • Web server: Nginx"
    echo ""
    echo -e "${CYAN}🌐 Access Information:${NC}"
    echo -e "  • Web Panel: http://$(hostname -I | awk '{print $1}')"
    echo -e "  • API: http://$(hostname -I | awk '{print $1}')/api"
    echo -e "  • Health Check: http://$(hostname -I | awk '{print $1}')/api/health"
    echo ""
    echo -e "${CYAN}🔑 Default Credentials:${NC}"
    echo -e "  • Admin Email: admin@atulya-panel.com"
    echo -e "  • Admin Password: admin123"
    echo -e "  • User Email: user@example.com"
    echo -e "  • User Password: user123"
    echo ""
    echo -e "${YELLOW}⚠️  Important Security Notes:${NC}"
    echo -e "  • Change default passwords immediately!"
    echo -e "  • Configure SSL with your domain: certbot --nginx -d yourdomain.com"
    echo -e "  • Review firewall settings: ufw status"
    echo -e "  • Monitor logs: atulya-logs"
    echo ""
    echo -e "${CYAN}🛠️  Management Commands:${NC}"
    echo -e "  • Start: atulya-start"
    echo -e "  • Stop: atulya-stop"
    echo -e "  • Restart: atulya-restart"
    echo -e "  • Status: atulya-status"
    echo -e "  • Logs: atulya-logs"
    echo ""
    echo -e "${GREEN}🚀 Atulya Panel is ready to use!${NC}"
    echo ""
}

# Main installation function
main() {
    print_header
    
    # Check if already installed
    if [[ -d "$INSTALL_DIR" ]]; then
        print_warning "Atulya Panel appears to be already installed at $INSTALL_DIR"
        read -p "Do you want to reinstall? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Installation cancelled"
            exit 0
        fi
        print_status "Reinstalling Atulya Panel..."
    fi
    
    # Run installation steps
    check_root
    detect_os
    update_system
    install_nodejs
    install_dependencies
    setup_postgresql
    setup_mysql
    setup_redis
    create_service_user
    install_atulya_panel
    configure_environment
    setup_database
    build_application
    configure_nginx
    create_systemd_service
    configure_firewall
    setup_monitoring
    create_management_scripts
    
    # Display summary
    display_summary
}

# Run main function
main "$@"
