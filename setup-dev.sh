#!/bin/bash

# Atulya Panel Development Setup Script
# This script sets up the development environment for Atulya Panel

set -e

echo "🚀 Setting up Atulya Panel Development Environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Check if Node.js is installed
check_node() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 20 LTS first."
        echo "Visit: https://nodejs.org/en/download/"
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 20 ]; then
        print_error "Node.js version 20 or higher is required. Current version: $(node --version)"
        exit 1
    fi
    
    print_success "Node.js $(node --version) is installed"
}

# Check if PostgreSQL is installed
check_postgres() {
    if ! command -v psql &> /dev/null; then
        print_warning "PostgreSQL is not installed. You'll need to install it manually."
        echo "Ubuntu/Debian: sudo apt install postgresql postgresql-contrib"
        echo "macOS: brew install postgresql"
        echo "Windows: Download from https://www.postgresql.org/download/"
        return 1
    fi
    
    print_success "PostgreSQL is installed"
    return 0
}

# Check if Redis is installed
check_redis() {
    if ! command -v redis-server &> /dev/null; then
        print_warning "Redis is not installed. You'll need to install it manually."
        echo "Ubuntu/Debian: sudo apt install redis-server"
        echo "macOS: brew install redis"
        echo "Windows: Download from https://redis.io/download"
        return 1
    fi
    
    print_success "Redis is installed"
    return 0
}

# Setup backend
setup_backend() {
    print_status "Setting up backend..."
    
    cd backend
    
    # Install dependencies
    print_status "Installing backend dependencies..."
    npm install
    
    # Create .env file if it doesn't exist
    if [ ! -f .env ]; then
        print_status "Creating .env file..."
        cp env.example .env
        print_warning "Please edit backend/.env with your database credentials"
    fi
    
    # Generate Prisma client
    print_status "Generating Prisma client..."
    npx prisma generate
    
    # Run database migrations (if database is available)
    print_status "Running database migrations..."
    if npx prisma migrate dev --name init 2>/dev/null; then
        print_success "Database migrations completed"
        
        # Seed database
        print_status "Seeding database..."
        npx prisma db seed
        print_success "Database seeded with sample data"
    else
        print_warning "Could not run database migrations. Please ensure PostgreSQL is running and configured."
    fi
    
    cd ..
    print_success "Backend setup completed"
}

# Setup frontend
setup_frontend() {
    print_status "Setting up frontend..."
    
    cd frontend
    
    # Install dependencies
    print_status "Installing frontend dependencies..."
    npm install
    
    cd ..
    print_success "Frontend setup completed"
}

# Create development script
create_dev_script() {
    print_status "Creating development script..."
    
    cat > start-dev.sh << 'EOF'
#!/bin/bash

# Atulya Panel Development Startup Script

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
cd backend && npm run dev &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Start frontend
echo "🎨 Starting frontend server..."
cd ../frontend && npm run dev &
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
EOF

    chmod +x start-dev.sh
    print_success "Development script created: ./start-dev.sh"
}

# Main setup function
main() {
    print_status "Starting Atulya Panel development setup..."
    
    # Check prerequisites
    check_node
    
    if ! check_postgres; then
        print_warning "PostgreSQL setup required for full functionality"
    fi
    
    if ! check_redis; then
        print_warning "Redis setup required for job queues and caching"
    fi
    
    # Setup applications
    setup_backend
    setup_frontend
    create_dev_script
    
    print_success "🎉 Development environment setup completed!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Edit backend/.env with your database credentials"
    echo "2. Ensure PostgreSQL and Redis are running"
    echo "3. Run './start-dev.sh' to start development servers"
    echo ""
    echo "🔑 Demo credentials:"
    echo "Admin: admin@atulyapanel.com / admin123"
    echo "User:  user@example.com / user123"
    echo ""
    echo "📚 Documentation: README.md"
}

# Run main function
main "$@"
