#!/bin/sh
# ===========================================
# Nginx Custom Entrypoint
# Simple Prisma Studio IP whitelist from .env
# ===========================================

set -e

# Generate whitelist in writable location
WHITELIST_FILE="/tmp/prisma-studio-whitelist.conf"
ALLOWED_IPS="${PRISMA_STUDIO_ALLOWED_IPS:-}"

echo "[Entrypoint] Configuring Prisma Studio access..."

if [ -z "$ALLOWED_IPS" ]; then
    # Block all (default)
    echo "deny all;" > "$WHITELIST_FILE"
    echo "[Entrypoint] Prisma Studio: Blocked all IPs (default)"
elif [ "$ALLOWED_IPS" = "*" ]; then
    # Allow all (not recommended) - empty file means no restrictions
    echo "" > "$WHITELIST_FILE"
    echo "[Entrypoint] Prisma Studio: Allowing all IPs (NOT RECOMMENDED)"
else
    # Allow specific IPs
    {
        for ip in $ALLOWED_IPS; do
            echo "allow $ip;"
        done
        echo "deny all;"
    } > "$WHITELIST_FILE"
    echo "[Entrypoint] Prisma Studio: Allowed IPs: $ALLOWED_IPS"
fi

# Test nginx configuration
nginx -t || {
    echo "[Entrypoint] Error: Nginx configuration test failed"
    exit 1
}

# Start nginx
exec nginx -g "daemon off;"

