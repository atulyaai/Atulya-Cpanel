#!/bin/bash

# Atulya Panel - Quick Start Script
# This script provides a quick way to test the installation

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

print_header() {
    echo -e "${PURPLE}================================${NC}"
    echo -e "${PURPLE}  🚀 Atulya Panel Quick Start  ${NC}"
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

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Check system requirements
check_requirements() {
    print_status "Checking system requirements..."
    
    # Check OS
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$NAME
        VER=$VERSION_ID
    else
        OS=$(uname -s)
        VER=$(uname -r)
    fi
    
    print_success "OS: $OS $VER"
    
    # Check available memory
    MEMORY=$(free -m | awk 'NR==2{printf "%.0f", $2}')
    if [ "$MEMORY" -lt 4000 ]; then
        print_warning "Low memory detected: ${MEMORY}MB (recommended: 4GB+)"
    else
        print_success "Memory: ${MEMORY}MB"
    fi
    
    # Check available disk space
    DISK=$(df -BG / | awk 'NR==2{print $4}' | sed 's/G//')
    if [ "$DISK" -lt 50 ]; then
        print_warning "Low disk space: ${DISK}GB (recommended: 50GB+)"
    else
        print_success "Disk space: ${DISK}GB"
    fi
}

# Install minimal dependencies for testing
install_minimal_deps() {
    print_status "Installing minimal dependencies..."
    
    # Update package list
    apt update
    
    # Install essential packages
    apt install -y curl wget git build-essential
    
    print_success "Minimal dependencies installed"
}

# Install Node.js
install_nodejs() {
    print_status "Installing Node.js..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -ge 20 ]; then
            print_success "Node.js $(node --version) is already installed"
            return
        fi
    fi
    
    # Install Node.js 20 LTS
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
    
    print_success "Node.js $(node --version) installed"
}

# Install PostgreSQL
install_postgresql() {
    print_status "Installing PostgreSQL..."
    
    apt install -y postgresql postgresql-contrib
    
    # Start and enable PostgreSQL
    systemctl start postgresql
    systemctl enable postgresql
    
    # Create database and user
    sudo -u postgres psql -c "CREATE DATABASE atulya_panel;" 2>/dev/null || true
    sudo -u postgres psql -c "CREATE USER atulya WITH PASSWORD 'atulya_secure_password_2024';" 2>/dev/null || true
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE atulya_panel TO atulya;" 2>/dev/null || true
    sudo -u postgres psql -c "ALTER USER atulya CREATEDB;" 2>/dev/null || true
    
    print_success "PostgreSQL installed and configured"
}

# Install Redis
install_redis() {
    print_status "Installing Redis..."
    
    apt install -y redis-server
    
    # Start and enable Redis
    systemctl start redis
    systemctl enable redis
    
    print_success "Redis installed and configured"
}

# Setup development environment
setup_dev_environment() {
    print_status "Setting up development environment..."
    
    # Install dependencies
    cd /workspace
    npm install
    
    # Install backend dependencies
    cd /workspace/backend
    npm install
    
    # Install frontend dependencies
    cd /workspace/frontend
    npm install
    
    print_success "Development environment setup completed"
}

# Configure environment
configure_environment() {
    print_status "Configuring environment..."
    
    # Generate secure passwords
    JWT_SECRET=$(openssl rand -base64 64)
    
    # Create development .env file
    cat > /workspace/backend/.env << EOL
# Database
DATABASE_URL="postgresql://atulya:atulya_secure_password_2024@localhost:5432/atulya_panel"

# JWT
JWT_SECRET="$JWT_SECRET"
JWT_EXPIRES_IN="7d"
JWT_REFRESH_EXPIRES_IN="30d"

# Redis
REDIS_URL="redis://localhost:6379"

# Server
PORT=3000
HOST="0.0.0.0"
NODE_ENV="development"

# System Configuration
PROVIDER="LOCAL"
SITES_ROOT="/var/www"
DRY_RUN="true"

# MySQL Configuration
MYSQL_HOST="localhost"
MYSQL_PORT=3306
MYSQL_ROOT_USER="root"
MYSQL_ROOT_PASSWORD="AtulyaRoot2024!"

# Email Configuration
POSTFIX_VIRTUAL_DIR="/etc/postfix/virtual"
DOVECOT_CONF_DIR="/etc/dovecot"

# SSL Configuration
CERTBOT_EMAIL="admin@$(hostname)"
SSL_STAGING="true"

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
FRONTEND_URL="http://localhost:5173"

# Logging
LOG_LEVEL="info"
LOG_FILE="/var/log/atulya-panel/app.log"
EOL
    
    print_success "Environment configured"
}

# Setup database
setup_database() {
    print_status "Setting up database..."
    
    cd /workspace/backend
    
    # Generate Prisma client
    npx prisma generate
    
    # Run migrations
    npx prisma migrate dev --name init
    
    # Seed database
    npx prisma db seed
    
    print_success "Database setup completed"
}

# Start development servers
start_development() {
    print_status "Starting development servers..."
    
    # Create start script
    cat > /workspace/start-dev.sh << 'EOL'
#!/bin/bash

echo "🚀 Starting Atulya Panel Development Environment..."

# Function to kill background processes on exit
cleanup() {
    echo "🛑 Stopping development servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start backend
echo "📡 Starting backend server..."
cd /workspace/backend && npm run dev &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Start frontend
echo "🎨 Starting frontend server..."
cd /workspace/frontend && npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Development environment is running!"
echo "📡 Backend API: http://localhost:3000"
echo "🎨 Frontend UI: http://localhost:5173"
echo "📚 API Health: http://localhost:3000/health"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for processes
wait
EOL
    
    chmod +x /workspace/start-dev.sh
    
    print_success "Development servers ready"
}

# Display summary
display_summary() {
    print_header
    echo -e "${GREEN}🎉 Quick start setup completed!${NC}"
    echo ""
    echo -e "${CYAN}📋 What's been set up:${NC}"
    echo -e "  • Node.js 20 LTS"
    echo -e "  • PostgreSQL database"
    echo -e "  • Redis cache"
    echo -e "  • Development environment"
    echo -e "  • Database schema and seed data"
    echo ""
    echo -e "${CYAN}🚀 Next steps:${NC}"
    echo -e "  1. Run: ./start-dev.sh"
    echo -e "  2. Open: http://localhost:5173"
    echo -e "  3. Login with: admin@atulya-panel.com / admin123"
    echo ""
    echo -e "${CYAN}🛠️  Management commands:${NC}"
    echo -e "  • Start dev: ./start-dev.sh"
    echo -e "  • Backend only: cd backend && npm run dev"
    echo -e "  • Frontend only: cd frontend && npm run dev"
    echo ""
    echo -e "${YELLOW}⚠️  Note: This is a development setup.${NC}"
    echo -e "  For production, use: sudo ./install.sh"
    echo ""
    echo -e "${GREEN}🚀 Ready to start development!${NC}"
    echo ""
}

# Main function
main() {
    print_header
    
    check_root
    check_requirements
    install_minimal_deps
    install_nodejs
    install_postgresql
    install_redis
    setup_dev_environment
    configure_environment
    setup_database
    start_development
    
    display_summary
}

# Run main function
main "$@"
