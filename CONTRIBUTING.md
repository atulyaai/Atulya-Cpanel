# Contributing to Atulya Panel

Thank you for your interest in contributing to Atulya Panel! This document provides guidelines for contributing to our project.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites

- Node.js 20.0.0 or higher
- npm 9.0.0 or higher
- Git
- PostgreSQL 15.0 or higher
- MySQL/MariaDB 10.6 or higher
- Redis 6.0 or higher

### Development Setup

1. **Fork the repository**
   ```bash
   # Click the "Fork" button on GitHub
   ```

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/Atulya-Cpanel.git
   cd Atulya-Cpanel
   ```

3. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/atulyaai/Atulya-Cpanel.git
   ```

4. **Install dependencies**
   ```bash
   npm install
   cd backend && npm install
   cd ../frontend && npm install
   ```

5. **Setup environment**
   ```bash
   cp backend/env.example backend/.env
   # Edit backend/.env with your configuration
   ```

6. **Setup database**
   ```bash
   cd backend
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

7. **Start development servers**
   ```bash
   # Terminal 1 - Backend
   cd backend && npm run dev
   
   # Terminal 2 - Frontend
   cd frontend && npm run dev
   ```

## Development Workflow

### Branch Strategy

- `main`: Production-ready code
- `develop`: Integration branch for features
- `feature/*`: Feature development branches
- `bugfix/*`: Bug fix branches
- `hotfix/*`: Critical bug fixes

### Making Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write clean, readable code
   - Add tests for new functionality
   - Update documentation if needed
   - Follow the coding standards

3. **Test your changes**
   ```bash
   npm run test
   npm run lint
   npm run type-check
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

5. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request**
   - Go to your fork on GitHub
   - Click "New Pull Request"
   - Fill out the PR template
   - Request review from maintainers

## Coding Standards

### TypeScript

- Use strict mode enabled
- Prefer interfaces over types for object shapes
- Use proper type annotations
- Avoid `any` type usage
- Use meaningful variable and function names

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

## Testing

### Test Types

- **Unit Tests**: Test individual functions and components
- **Integration Tests**: Test API endpoints and database operations
- **End-to-End Tests**: Test complete user workflows
- **Security Tests**: Test for vulnerabilities and security issues

### Running Tests

```bash
# All tests
npm run test

# Backend tests only
cd backend && npm test

# Frontend tests only
cd frontend && npm test

# Security tests
npm run test:security
```

### Test Coverage

- Minimum 80% code coverage required
- All new code must include tests
- Tests must be meaningful and test actual functionality

## Documentation

### Code Documentation

- Add JSDoc comments for functions and classes
- Include inline comments for complex logic
- Update README.md for user-facing changes
- Update API documentation for endpoint changes

### Commit Messages

Use conventional commit format:

```
type(scope): description

feat(auth): add JWT token refresh functionality
fix(database): resolve connection pool issue
docs(readme): update installation instructions
test(auth): add unit tests for login endpoint
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

## Pull Request Process

### Before Submitting

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] All tests pass locally

### PR Requirements

- Clear description of changes
- Reference to related issues
- Screenshots for UI changes
- Breaking changes clearly marked
- Migration instructions if needed

### Review Process

1. Automated checks must pass
2. Code review by maintainers
3. Address feedback and suggestions
4. Approval from at least 2 reviewers
5. Merge after approval

## Issue Guidelines

### Bug Reports

- Use the bug report template
- Provide clear reproduction steps
- Include environment details
- Add screenshots if applicable
- Check existing issues first

### Feature Requests

- Use the feature request template
- Describe the problem clearly
- Explain the proposed solution
- Consider alternatives
- Check existing requests first

## Community

### Getting Help

- Check existing documentation
- Search GitHub issues
- Ask questions in Discussions
- Join our community channels

### Recognition

Contributors will be recognized in:
- CONTRIBUTORS.md file
- Release notes
- Project documentation
- Community highlights

## License

By contributing to Atulya Panel, you agree that your contributions will be licensed under the MIT License.

## Questions?

If you have any questions about contributing, please:
- Open a GitHub Discussion
- Contact maintainers directly
- Check our documentation

Thank you for contributing to Atulya Panel! 🚀
