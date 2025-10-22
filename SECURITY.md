# Security Policy

## Supported Versions

Use this section to tell people about which versions of your project are
currently being supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 2.1.x   | :white_check_mark: |
| 2.0.x   | :white_check_mark: |
| 1.x.x   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in Atulya Panel, please follow these steps:

1. **DO NOT** create a public issue on GitHub
2. Email us at: security@atulyaai.com
3. Include the following information:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution**: Within 30 days (depending on severity)

## Security Measures

Atulya Panel implements the following security measures:

- JWT authentication with refresh tokens
- Role-based access control (RBAC)
- Input validation and sanitization
- SQL injection prevention
- CSRF protection
- Rate limiting
- Security headers
- Password policy enforcement
- Audit logging

## Security Best Practices

When using Atulya Panel:

1. Keep your installation updated
2. Use strong passwords
3. Enable SSL/TLS encryption
4. Regularly backup your data
5. Monitor system logs
6. Use firewall protection
7. Keep dependencies updated

## Acknowledgments

We appreciate responsible disclosure of security vulnerabilities. Contributors who report valid security issues will be acknowledged in our security advisories.
