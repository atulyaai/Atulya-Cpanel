# Development Guide

This document provides comprehensive guidelines for developing and contributing to Atulya Panel.

## Overview

Atulya Panel is a production-ready cPanel alternative built with modern technologies. This guide covers development setup, architecture, coding standards, and contribution guidelines.

## Architecture

### Backend Architecture
- **Runtime**: Node.js 20+
- **Framework**: Fastify with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with refresh tokens and RBAC
- **Real-time**: WebSocket with Socket.IO
- **Monitoring**: systeminformation library

### Frontend Architecture
- **Framework**: Vue 3 with TypeScript
- **Build Tool**: Vite with optimized bundling
- **State Management**: Pinia
- **UI Library**: PrimeVue with TailwindCSS
- **Real-time**: WebSocket client integration

### System Integration
- **Web Servers**: Nginx, Apache with PHP-FPM
- **Databases**: MySQL, MariaDB, PostgreSQL
- **Email**: Postfix, Dovecot with virtual mailboxes
- **SSL**: Let's Encrypt with Certbot automation
- **Cache**: Redis for session management

## Development Setup

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- MySQL/MariaDB 10.6+
- Redis 6+
- Git

### Quick Setup
```bash
# Clone repository
git clone https://github.com/atulya-panel/atulya-panel.git
cd atulya-panel

# Run setup script
./setup-dev.sh  # Linux/macOS
# or
setup-dev.bat   # Windows
```

### Manual Setup
```bash
# Backend setup
cd backend
npm install
cp env.example .env
# Edit .env with your configuration
npm run db:generate
npm run db:migrate
npm run dev

# Frontend setup (new terminal)
cd frontend
npm install
npm run dev
```

## Project Structure

```
atulya-panel/
├── backend/                  # TypeScript backend
│   ├── src/
│   │   ├── config/          # Configuration files
│   │   ├── middleware/      # Authentication, security, logging
│   │   ├── providers/       # System integration providers
│   │   ├── routes/          # API route handlers
│   │   ├── services/        # Business logic services
│   │   ├── utils/           # Utility functions
│   │   └── server.ts        # Main server file
│   ├── prisma/              # Database schema and migrations
│   └── package.json
├── frontend/                 # Vue 3 frontend
│   ├── src/
│   │   ├── components/      # Reusable Vue components
│   │   ├── composables/     # Vue composables
│   │   ├── stores/          # Pinia state management
│   │   ├── views/           # Page components
│   │   ├── router/          # Vue Router configuration
│   │   └── api/             # API client configuration
│   └── package.json
├── setup-dev.sh             # Linux/macOS development setup
├── setup-dev.bat            # Windows development setup
├── README.md                # Project documentation
├── LICENSE                  # MIT License
├── CHANGELOG.md             # Version history
├── ROADMAP.md               # Future development plans
├── TESTING.md               # Testing documentation
└── DEVELOPMENT_GUIDE.md     # This file
```

## Coding Standards

### TypeScript
- Use strict mode enabled
- Prefer interfaces over types for object shapes
- Use proper type annotations
- Avoid `any` type usage

### Backend Standards
- Use Fastify decorators for request/response typing
- Implement proper error handling with custom error classes
- Use Zod for input validation
- Follow RESTful API conventions
- Implement proper logging with structured logs

### Frontend Standards
- Use Vue 3 Composition API
- Implement proper TypeScript types
- Use Pinia for state management
- Follow component naming conventions
- Implement proper error boundaries

### Security Standards
- Validate all inputs with Zod schemas
- Use parameterized queries for database operations
- Implement proper authentication and authorization
- Follow OWASP security guidelines
- Use HTTPS in production

## Development Workflow

### Branch Strategy
- `main`: Production-ready code
- `develop`: Integration branch for features
- `feature/*`: Feature development branches
- `hotfix/*`: Critical bug fixes

### Commit Standards
- Use conventional commits format
- Include descriptive commit messages
- Reference issues in commit messages
- Keep commits atomic and focused

### Pull Request Process
1. Create feature branch from `develop`
2. Implement changes with tests
3. Update documentation if needed
4. Create pull request with description
5. Request code review
6. Address review feedback
7. Merge after approval

## Testing

### Test Types
- **Unit Tests**: Test individual functions and components
- **Integration Tests**: Test API endpoints and database operations
- **End-to-End Tests**: Test complete user workflows
- **Security Tests**: Test for vulnerabilities and security issues

### Running Tests
```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

# Integration tests
npm run test:integration

# Security tests
npm run test:security
```

### Test Coverage
- Minimum 80% code coverage required
- All new code must include tests
- Tests must be meaningful and test actual functionality

## Database Management

### Migrations
```bash
# Create new migration
npm run db:migrate:create

# Apply migrations
npm run db:migrate

# Generate Prisma client
npm run db:generate
```

### Schema Changes
- Always create migrations for schema changes
- Test migrations on development data
- Include rollback procedures
- Update seed data if needed

## API Development

### Route Structure
```
/api/v1/
├── auth/          # Authentication endpoints
├── sites/         # Site management
├── databases/     # Database management
├── email/         # Email management
├── files/         # File management
├── monitoring/    # System monitoring
└── ssl/           # SSL certificate management
```

### API Standards
- Use RESTful conventions
- Implement proper HTTP status codes
- Include comprehensive error responses
- Use consistent response formats
- Implement rate limiting

### Authentication
- Use JWT tokens for authentication
- Implement refresh token rotation
- Use RBAC for authorization
- Secure sensitive endpoints

## Frontend Development

### Component Structure
```vue
<template>
  <!-- Template content -->
</template>

<script setup lang="ts">
// Component logic
</script>

<style scoped>
/* Component styles */
</style>
```

### State Management
- Use Pinia for global state
- Keep component state local when possible
- Use composables for reusable logic
- Implement proper error handling

### Styling
- Use TailwindCSS for utility-first styling
- Use PrimeVue components for UI elements
- Follow design system guidelines
- Ensure responsive design

## Security Considerations

### Input Validation
- Validate all user inputs
- Use Zod schemas for validation
- Sanitize data before processing
- Implement CSRF protection

### Authentication
- Use secure JWT implementation
- Implement proper session management
- Use strong password requirements
- Implement account lockout policies

### Database Security
- Use parameterized queries
- Implement proper access controls
- Encrypt sensitive data
- Regular security audits

## Performance Optimization

### Backend Optimization
- Use connection pooling for databases
- Implement caching strategies
- Optimize database queries
- Use compression for responses

### Frontend Optimization
- Implement code splitting
- Use lazy loading for routes
- Optimize bundle size
- Implement proper caching

## Deployment

### Development Deployment
- Use Docker Compose for local development
- Configure environment variables
- Set up development databases
- Enable debug logging

### Production Deployment
- Use proper environment configuration
- Implement health checks
- Set up monitoring and logging
- Configure SSL certificates
- Implement backup strategies

## Monitoring and Logging

### Application Monitoring
- Use structured logging
- Implement health check endpoints
- Monitor system resources
- Set up alerting for critical issues

### Performance Monitoring
- Monitor API response times
- Track database query performance
- Monitor memory and CPU usage
- Implement performance budgets

## Contributing

### Getting Started
1. Fork the repository
2. Create a feature branch
3. Set up development environment
4. Make your changes
5. Add tests for new functionality
6. Update documentation
7. Submit a pull request

### Code Review Process
- All code must be reviewed before merging
- Reviewers should check for:
  - Code quality and standards
  - Security vulnerabilities
  - Performance implications
  - Test coverage
  - Documentation updates

### Documentation
- Update README.md for user-facing changes
- Update API documentation for endpoint changes
- Add inline comments for complex logic
- Update this guide for process changes

## Troubleshooting

### Common Issues
- Database connection issues
- Authentication problems
- Build and deployment errors
- Performance issues

### Debug Tools
- Use browser dev tools for frontend debugging
- Use Node.js debugger for backend issues
- Check logs for error details
- Use database query analyzers

### Getting Help
- Check existing documentation
- Search GitHub issues
- Create new issue with detailed description
- Contact maintainers for urgent issues

## Resources

### Documentation
- [Vue 3 Documentation](https://vuejs.org/)
- [Fastify Documentation](https://fastify.dev/)
- [Prisma Documentation](https://prisma.io/)
- [TypeScript Documentation](https://typescriptlang.org/)

### Tools
- [ESLint](https://eslint.org/) - Code linting
- [Prettier](https://prettier.io/) - Code formatting
- [Vitest](https://vitest.dev/) - Testing framework
- [Playwright](https://playwright.dev/) - E2E testing

---

This development guide is a living document and should be updated as the project evolves. For questions or suggestions, please create an issue or contact the maintainers.
