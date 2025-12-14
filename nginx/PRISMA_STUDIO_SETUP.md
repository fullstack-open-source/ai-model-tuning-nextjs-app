# Prisma Studio IP Whitelist - Simple Setup

## Quick Setup

Add your IP to `.env` file:

```bash
PRISMA_STUDIO_ALLOWED_IPS="103.134.218.204"
```

For multiple IPs:

```bash
PRISMA_STUDIO_ALLOWED_IPS="103.134.218.204 192.168.1.100"
```

## Restart Nginx

```bash
docker compose restart nginx
```

## Access

- Via Nginx: `http://localhost:3001/prisma-studio`
- Direct: `http://localhost:5555`

## Options

**Block all (default):**
```bash
PRISMA_STUDIO_ALLOWED_IPS=""
```

**Allow all (NOT RECOMMENDED):**
```bash
PRISMA_STUDIO_ALLOWED_IPS="*"
```

That's it! Simple and secure.
