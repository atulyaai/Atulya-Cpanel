@echo off
setlocal enabledelayedexpansion

REM Atulya Panel Development Setup Script for Windows
REM This script sets up the development environment for Atulya Panel

echo 🚀 Setting up Atulya Panel Development Environment...

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js 20 LTS first.
    echo Visit: https://nodejs.org/en/download/
    pause
    exit /b 1
)

echo [SUCCESS] Node.js is installed

REM Check if npm is installed
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed. Please install npm first.
    pause
    exit /b 1
)

echo [SUCCESS] npm is installed

REM Setup backend
echo [INFO] Setting up backend...
cd backend

echo [INFO] Installing backend dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install backend dependencies
    pause
    exit /b 1
)

REM Create .env file if it doesn't exist
if not exist .env (
    echo [INFO] Creating .env file...
    copy env.example .env
    echo [WARNING] Please edit backend\.env with your database credentials
)

REM Generate Prisma client
echo [INFO] Generating Prisma client...
call npx prisma generate
if %errorlevel% neq 0 (
    echo [WARNING] Failed to generate Prisma client
)

REM Try to run database migrations
echo [INFO] Running database migrations...
call npx prisma migrate dev --name init >nul 2>nul
if %errorlevel% equ 0 (
    echo [SUCCESS] Database migrations completed
    echo [INFO] Seeding database...
    call npx prisma db seed >nul 2>nul
    if %errorlevel% equ 0 (
        echo [SUCCESS] Database seeded with sample data
    ) else (
        echo [WARNING] Failed to seed database
    )
) else (
    echo [WARNING] Could not run database migrations. Please ensure PostgreSQL is running and configured.
)

cd ..
echo [SUCCESS] Backend setup completed

REM Setup frontend
echo [INFO] Setting up frontend...
cd frontend

echo [INFO] Installing frontend dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install frontend dependencies
    pause
    exit /b 1
)

cd ..
echo [SUCCESS] Frontend setup completed

REM Create development script
echo [INFO] Creating development script...
(
echo @echo off
echo.
echo 🚀 Starting Atulya Panel Development Environment...
echo.
echo 📡 Starting backend server...
echo start /b cmd /c "cd backend && npm run dev"
echo.
echo 📡 Waiting for backend to start...
echo timeout /t 5 /nobreak >nul
echo.
echo 🎨 Starting frontend server...
echo start /b cmd /c "cd frontend && npm run dev"
echo.
echo ✅ Development environment is running!
echo 📡 Backend API: http://localhost:3000
echo 🎨 Frontend UI: http://localhost:5173
echo 📚 API Health: http://localhost:3000/health
echo.
echo 🔑 Demo credentials:
echo Admin: admin@atulyapanel.com / admin123
echo User:  user@example.com / user123
echo.
echo Press any key to stop servers...
echo pause >nul
) > start-dev.bat

echo [SUCCESS] Development script created: start-dev.bat

echo.
echo [SUCCESS] 🎉 Development environment setup completed!
echo.
echo 📋 Next steps:
echo 1. Edit backend\.env with your database credentials
echo 2. Ensure PostgreSQL and Redis are running
echo 3. Run 'start-dev.bat' to start development servers
echo.
echo 🔑 Demo credentials:
echo Admin: admin@atulyapanel.com / admin123
echo User:  user@example.com / user123
echo.
echo 📚 Documentation: README.md
echo.
pause
