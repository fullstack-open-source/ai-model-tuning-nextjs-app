#!/bin/bash

# ==============================================================================
# 🔄 Next.js Frontend Starter - Quick Reload Script
# ==============================================================================
# For full deployment with testing, use: ./deploy.sh
# This script is for quick reloads without full testing
# ==============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Function to prompt with timeout
prompt_with_timeout() {
    local prompt_message=$1
    local default_choice=$2
    local timeout=$3
    local user_input

    read -t "$timeout" -p "$prompt_message" user_input || user_input="$default_choice"
    echo "$user_input"
}

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  🔄 Next.js Frontend Starter - Quick Reload${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if network exists, create if not
NETWORK_NAME="nextjs_frontend_network"
if ! docker network inspect "$NETWORK_NAME" &> /dev/null; then
    echo -e "${YELLOW}Creating Docker network: $NETWORK_NAME${NC}"
    docker network create "$NETWORK_NAME"
fi

# Ask for no-cache build
choice=$(prompt_with_timeout "Build with --no-cache? (y/N) [auto-skip in 5s]: " "n" 5)
echo ""

if [[ "$choice" =~ ^[Yy]([Ee][Ss])?$ ]]; then
    echo -e "${BLUE}🔧 Building with --no-cache...${NC}"
    docker compose build --no-cache
else
    echo -e "${YELLOW}⏭ Skipping no-cache build...${NC}"
fi

# Ask to push to Docker Hub (only if build was selected)
if [[ "$choice" =~ ^[Yy]([Ee][Ss])?$ ]]; then
    push_choice=$(prompt_with_timeout "Push to Docker Hub? (y/N) [auto-skip in 5s]: " "n" 5)
    echo ""
    if [[ "$push_choice" =~ ^[Yy]([Ee][Ss])?$ ]]; then
        echo -e "${BLUE}📤 Pushing Docker images...${NC}"
        docker compose push
    else
        echo -e "${YELLOW}⏭ Skipping Docker Hub push...${NC}"
    fi
fi

# Bring down existing containers
echo -e "${BLUE}📦 Stopping containers...${NC}"
docker compose down --remove-orphans

# Start containers
echo -e "${BLUE}🚀 Starting containers...${NC}"
docker compose up -d

# Quick health check
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  📊 Container Status${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

docker compose ps

echo ""
echo -e "${GREEN}✅ Reload complete!${NC}"
echo ""
echo -e "${YELLOW}Quick commands:${NC}"
echo -e "  ./deploy.sh           - Full deployment with testing"
echo -e "  make logs             - View all logs"
echo -e "  make logs-app         - View app logs only"
echo -e "  make db-shell         - Open PostgreSQL shell"
echo -e "  docker compose logs -f - Follow all logs"
echo ""
echo -e "${CYAN}Access Points:${NC}"
echo -e "  App:      http://localhost:3000"
echo -e "  pgAdmin:  http://localhost:5050"
echo -e "  Database: localhost:5432"
echo ""

# Ask to follow logs
log_choice=$(prompt_with_timeout "Follow logs? (y/N) [auto-skip in 3s]: " "n" 3)
echo ""

if [[ "$log_choice" =~ ^[Yy]([Ee][Ss])?$ ]]; then
    echo -e "${BLUE}📜 Following logs... (Ctrl+C to exit)${NC}"
    docker compose logs -f
fi
