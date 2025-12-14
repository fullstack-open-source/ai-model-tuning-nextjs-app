# Nginx Security Configuration Guide

This document outlines the security features implemented in the Nginx reverse proxy configuration.

## Security Features

### 1. Rate Limiting

- **General API**: 10 requests/second per IP
- **Strict endpoints**: 5 requests/second per IP
- **Login endpoints**: 2 requests/second per IP
- **Upload endpoints**: 1 request/second per IP
- **Connection limits**: 20 concurrent connections per IP, 1000 total

### 2. Security Headers

The following security headers are automatically added to all responses:

- **X-XSS-Protection**: Prevents XSS attacks
- **X-Content-Type-Options**: Prevents MIME type sniffing
- **X-Frame-Options**: Prevents clickjacking
- **Referrer-Policy**: Controls referrer information
- **Permissions-Policy**: Restricts browser features
- **Content-Security-Policy**: Controls resource loading
- **Strict-Transport-Security**: Enforces HTTPS (when SSL is configured)

### 3. Request Validation

- Blocks invalid HTTP methods
- Blocks suspicious user agents
- Blocks suspicious referers
- Blocks SQL injection patterns in URLs
- Blocks XSS patterns in query strings
- Validates file upload extensions

### 4. Prisma Studio Access Control

**IMPORTANT**: Prisma Studio should NOT be publicly accessible in production.

#### Configuration

Set the `PRISMA_STUDIO_ALLOWED_IPS` environment variable in your `.env` file:

```bash
# Allow specific IPs (recommended)
PRISMA_STUDIO_ALLOWED_IPS="1.2.3.4 5.6.7.8"

# Block all access (most secure)
PRISMA_STUDIO_ALLOWED_IPS=""

# Allow all (NOT RECOMMENDED - only for development)
PRISMA_STUDIO_ALLOWED_IPS="*"
```

#### Access

- Direct: `http://localhost:5555`
- Via Nginx: `http://localhost:3001/prisma-studio`

### 5. File Upload Security

- Maximum file size: 50MB (100MB for upload endpoints)
- Rate limiting: 1 request/second per IP
- Blocked extensions: `.php`, `.phtml`, `.jsp`, `.asp`, `.sh`, `.cgi`, etc.
- Connection limits: 5 concurrent uploads per IP

### 6. Authentication Endpoint Security

- Rate limiting: 2 requests/second per IP
- SQL injection pattern blocking
- Connection limits: 3 concurrent connections per IP
- Security logging enabled

### 7. Security Logging

All security events are logged to `/var/log/nginx/security.log` with:
- Blocked requests
- Suspicious patterns
- Rate limit violations
- Authentication attempts

### 8. Server Information Hiding

- Server tokens disabled
- X-Powered-By header removed
- Server version hidden

## Best Practices

### Production Deployment

1. **Prisma Studio**: Set `PRISMA_STUDIO_ALLOWED_IPS` to specific admin IPs only
2. **SSL/TLS**: Enable HTTPS and uncomment HSTS header in `security.conf`
3. **CSP**: Adjust Content-Security-Policy based on your application needs
4. **Rate Limits**: Adjust based on your application's requirements
5. **Monitoring**: Regularly review `/var/log/nginx/security.log`

### Development

1. Use `PRISMA_STUDIO_ALLOWED_IPS="*"` only in local development
2. Monitor security logs for false positives
3. Test rate limiting to ensure legitimate users aren't blocked

### Monitoring

```bash
# View security logs
docker compose exec nginx tail -f /var/log/nginx/security.log

# View blocked requests
docker compose exec nginx grep "blocked=1" /var/log/nginx/security.log

# View rate limit violations
docker compose exec nginx grep "429" /var/log/nginx/access.log
```

## Customization

### Adjusting Rate Limits

Edit `nginx/conf.d/security.conf`:

```nginx
# Increase API rate limit
limit_req_zone $binary_remote_addr zone=req_limit_per_ip_api:10m rate=50r/s;
```

### Adjusting CSP

Edit `nginx/conf.d/security.conf`:

```nginx
add_header Content-Security-Policy "default-src 'self'; ..." always;
```

### Adding IP Whitelist

For additional IP restrictions, add to `nginx/conf.d/default.conf`:

```nginx
location /admin {
    allow 1.2.3.4;
    deny all;
    ...
}
```

## Security Checklist

- [ ] Prisma Studio IP whitelist configured
- [ ] SSL/TLS enabled (production)
- [ ] HSTS header enabled (production)
- [ ] CSP adjusted for your application
- [ ] Rate limits appropriate for your use case
- [ ] Security logging monitored
- [ ] File upload limits appropriate
- [ ] Server tokens disabled
- [ ] Security headers verified

## Troubleshooting

### Legitimate requests being blocked

1. Check `/var/log/nginx/security.log` for blocked patterns
2. Adjust rate limits if needed
3. Whitelist specific IPs if necessary

### Prisma Studio not accessible

1. Check `PRISMA_STUDIO_ALLOWED_IPS` in `.env`
2. Verify your IP is in the whitelist
3. Check nginx logs for access attempts

### Rate limit errors (429)

1. Check current rate limits
2. Adjust based on legitimate traffic patterns
3. Consider implementing exponential backoff in your application

