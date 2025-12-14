#!/bin/bash
set -euo pipefail

# ==============================================================================
# Next.js Frontend Start Script with PM2
# ==============================================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Default values
APP_MODE=${APP_MODE:-production}

echo "=============================================="
echo "     Next.js Frontend Startup Script (PM2)"
echo "=============================================="
log_info "APP_MODE: $APP_MODE"
echo "=============================================="

# ------------------------------------------------------------------------------
# Load environment variables from .env if present
# Check parent directory first, then current directory
# ------------------------------------------------------------------------------
ENV_FILE=""
if [ -f ../.env ]; then
    ENV_FILE="../.env"
elif [ -f .env ]; then
    ENV_FILE=".env"
fi

if [ -n "$ENV_FILE" ]; then
    log_info "Loading .env file from $(dirname "$ENV_FILE")..."
    set -a
    source "$ENV_FILE"
    set +a
    log_success ".env file loaded"
else
    log_info "No .env file found (checked ../.env and .env)"
fi

# ------------------------------------------------------------------------------
# Determine PM2 app name based on APP_MODE
# ------------------------------------------------------------------------------
case "$APP_MODE" in
    production)
        PM2_APP_NAME="nextjs-frontend-prod"
        ;;
    staging)
        PM2_APP_NAME="nextjs-frontend-staging"
        ;;
    development)
        PM2_APP_NAME="nextjs-frontend-dev"
        ;;
    *)
        log_error "Unknown APP_MODE: $APP_MODE"
        log_info "Valid modes: production, development, staging"
        exit 1
        ;;
esac

# ------------------------------------------------------------------------------
# Verify required files exist
# ------------------------------------------------------------------------------
if [ ! -f "server.js" ]; then
    log_error "server.js not found in current directory!"
    exit 1
fi

if [ ! -f "ecosystem.config.js" ]; then
    log_error "ecosystem.config.js not found!"
    exit 1
fi

# ------------------------------------------------------------------------------
# Start application with PM2
# App is already built in Dockerfile, so we just run it with PM2
# ------------------------------------------------------------------------------
log_info "Starting application with PM2..."
log_info "PM2 App Name: $PM2_APP_NAME"
log_info "Using pre-built app from Dockerfile"
log_info "Port: ${APP_INTERNAL_PORT:-${PORT:-3000}}"

# ------------------------------------------------------------------------------
# Check if Prisma Studio should be enabled
# ------------------------------------------------------------------------------
ENABLE_PRISMA_STUDIO=${ENABLE_PRISMA_STUDIO:-true}
PRISMA_STUDIO_PORT=${PRISMA_STUDIO_PORT:-5555}

if [ "$ENABLE_PRISMA_STUDIO" = "true" ]; then
    log_info "Prisma Studio will be started on port $PRISMA_STUDIO_PORT"
    log_info "Access Prisma Studio at: http://localhost:$PRISMA_STUDIO_PORT"
    # Start both the app and Prisma Studio
    exec pm2-runtime start ecosystem.config.js --only "$PM2_APP_NAME,prisma-studio"
else
    log_info "Prisma Studio is disabled (set ENABLE_PRISMA_STUDIO=false to disable)"
    # Start only the app
    exec pm2-runtime start ecosystem.config.js --only "$PM2_APP_NAME"
fi
