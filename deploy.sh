#!/bin/bash

# ==============================================================================
# 🚀 Next.js Frontend Starter - Complete Deployment & Testing Script
# ==============================================================================
# This script handles:
# - Docker network creation
# - Building the application
# - Starting all containers (PostgreSQL, Redis, App, pgAdmin)
# - Health check validation
# - Endpoint testing
# - Status summary
# ==============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
NETWORK_NAME="nextjs_frontend_network"
APP_URL="http://localhost:3000"
PGADMIN_URL="http://localhost:5050"
MAX_RETRIES=30
RETRY_INTERVAL=2

# Service endpoints for health checks
declare -A SERVICE_HEALTH=(
    ["app"]="$APP_URL/api/health"
    ["postgres"]="postgres"  # Internal check
    ["redis"]="redis"        # Internal check
    ["pgadmin"]="$PGADMIN_URL"
)

# ==============================================================================
# Helper Functions
# ==============================================================================

print_header() {
    echo ""
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${PURPLE}  $1${NC}"
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_step() {
    echo -e "${CYAN}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Prompt with timeout
prompt_with_timeout() {
    local prompt_message=$1
    local default_choice=$2
    local timeout=$3
    local user_input

    read -t "$timeout" -p "$prompt_message" user_input || user_input="$default_choice"
    echo "$user_input"
}

# Check if command exists
command_exists() {
    command -v "$1" &> /dev/null
}

# ==============================================================================
# Pre-flight Checks
# ==============================================================================

preflight_checks() {
    print_header "🔍 PRE-FLIGHT CHECKS"
    
    # Check Docker
    print_step "Checking Docker..."
    if command_exists docker; then
        DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | tr -d ',')
        print_success "Docker installed: $DOCKER_VERSION"
    else
        print_error "Docker is not installed!"
        exit 1
    fi
    
    # Check Docker Compose
    print_step "Checking Docker Compose..."
    if docker compose version &> /dev/null; then
        COMPOSE_VERSION=$(docker compose version --short)
        print_success "Docker Compose installed: $COMPOSE_VERSION"
    else
        print_error "Docker Compose is not installed!"
        exit 1
    fi
    
    # Check if Docker daemon is running
    print_step "Checking Docker daemon..."
    if docker info &> /dev/null; then
        print_success "Docker daemon is running"
    else
        print_error "Docker daemon is not running!"
        exit 1
    fi
    
    # Check .env file
    print_step "Checking .env file..."
    if [ -f ".env" ]; then
        print_success ".env file found"
    else
        print_warning ".env file not found - using example.env if available"
        if [ -f "example.env" ]; then
            cp example.env .env
            print_info "Created .env from example.env"
        else
            print_warning "No .env or example.env found - some features may not work"
        fi
    fi
    
    # Check required directories
    print_step "Checking required directories..."
    local dirs=("nginx" "nginx/conf.d" "scripts")
    for dir in "${dirs[@]}"; do
        if [ -d "$dir" ]; then
            print_success "Directory exists: $dir"
        else
            print_warning "Directory missing: $dir (may be optional)"
        fi
    done
}

# ==============================================================================
# Network Setup
# ==============================================================================

setup_network() {
    print_header "🌐 NETWORK SETUP"
    
    print_step "Checking Docker network: $NETWORK_NAME..."
    if docker network inspect "$NETWORK_NAME" &> /dev/null; then
        print_success "Network '$NETWORK_NAME' already exists"
    else
        print_step "Creating Docker network: $NETWORK_NAME..."
        docker network create "$NETWORK_NAME"
        print_success "Network '$NETWORK_NAME' created"
    fi
}

# ==============================================================================
# Build Services
# ==============================================================================

build_services() {
    print_header "🔨 BUILDING SERVICES"
    
    local build_args=""
    
    # Ask for no-cache build
    echo ""
    choice=$(prompt_with_timeout "Build with --no-cache? (y/N) [auto-skip in 5s]: " "n" 5)
    echo ""
    
    if [[ "$choice" =~ ^[Yy]([Ee][Ss])?$ ]]; then
        build_args="--no-cache"
        print_info "Building with --no-cache flag"
    fi
    
    print_step "Building all services..."
    echo ""
    
    if docker compose build $build_args; then
        print_success "All services built successfully"
    else
        print_error "Build failed!"
        exit 1
    fi
}

# ==============================================================================
# Start Services
# ==============================================================================

start_services() {
    print_header "🚀 STARTING SERVICES"
    
    # Stop existing containers
    print_step "Stopping existing containers..."
    docker compose down --remove-orphans 2>/dev/null || true
    print_success "Existing containers stopped"
    
    # Start containers
    print_step "Starting all services in detached mode..."
    echo ""
    
    if docker compose up -d; then
        print_success "All services started"
    else
        print_error "Failed to start services!"
        exit 1
    fi
    
    # Show running containers
    echo ""
    print_step "Running containers:"
    docker compose ps
}

# ==============================================================================
# Health Check Functions
# ==============================================================================

wait_for_service() {
    local service_name=$1
    local url=$2
    local retries=0
    
    print_step "Waiting for $service_name..."
    
    # Handle internal service checks
    if [ "$url" = "postgres" ]; then
        while [ $retries -lt $MAX_RETRIES ]; do
            if docker compose exec -T postgres pg_isready -U postgres &> /dev/null; then
                print_success "$service_name is healthy"
                return 0
            fi
            retries=$((retries + 1))
            echo -ne "\r${YELLOW}  Attempt $retries/$MAX_RETRIES...${NC}"
            sleep $RETRY_INTERVAL
        done
    elif [ "$url" = "redis" ]; then
        while [ $retries -lt $MAX_RETRIES ]; do
            if docker compose exec -T redis redis-cli ping &> /dev/null; then
                print_success "$service_name is healthy"
                return 0
            fi
            retries=$((retries + 1))
            echo -ne "\r${YELLOW}  Attempt $retries/$MAX_RETRIES...${NC}"
            sleep $RETRY_INTERVAL
        done
    else
        # HTTP health check
        while [ $retries -lt $MAX_RETRIES ]; do
            if curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null | grep -q "200\|201\|204"; then
                print_success "$service_name is healthy"
                return 0
            fi
            
            retries=$((retries + 1))
            echo -ne "\r${YELLOW}  Attempt $retries/$MAX_RETRIES...${NC}"
            sleep $RETRY_INTERVAL
        done
    fi
    
    echo ""
    print_error "$service_name failed health check after $MAX_RETRIES attempts"
    return 1
}

check_container_health() {
    local container=$1
    local status=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "unknown")
    echo "$status"
}

health_checks() {
    print_header "🏥 HEALTH CHECKS"
    
    local all_healthy=true
    
    # Wait a bit for containers to start
    print_step "Waiting for containers to initialize..."
    sleep 5
    
    # Check each service
    for service in "${!SERVICE_HEALTH[@]}"; do
        url="${SERVICE_HEALTH[$service]}"
        
        if wait_for_service "$service" "$url"; then
            :
        else
            all_healthy=false
        fi
    done
    
    echo ""
    
    if $all_healthy; then
        print_success "All services are healthy!"
        return 0
    else
        print_warning "Some services may not be fully ready"
        return 1
    fi
}

# ==============================================================================
# Endpoint Testing
# ==============================================================================

test_endpoint() {
    local name=$1
    local url=$2
    local expected_status=${3:-200}
    
    local response_code=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
    
    if [ "$response_code" = "$expected_status" ] || [ "$response_code" = "200" ] || [ "$response_code" = "201" ]; then
        echo -e "${GREEN}  ✓ $name: $response_code${NC}"
        return 0
    else
        echo -e "${RED}  ✗ $name: $response_code (expected: $expected_status)${NC}"
        return 1
    fi
}

run_tests() {
    print_header "🧪 ENDPOINT TESTING"
    
    local passed=0
    local failed=0
    
    echo ""
    echo -e "${CYAN}Testing Health Endpoints:${NC}"
    
    # Health endpoints
    test_endpoint "App Health" "$APP_URL/api/health" && ((passed++)) || ((failed++))
    test_endpoint "pgAdmin" "$PGADMIN_URL" && ((passed++)) || ((failed++))
    
    echo ""
    echo -e "${CYAN}Testing API Endpoints:${NC}"
    
    # API endpoints (may require auth, so 401/403 is acceptable)
    test_endpoint "API Root" "$APP_URL/api" "200" && ((passed++)) || ((failed++))
    
    echo ""
    echo -e "${CYAN}Test Results:${NC}"
    echo -e "  ${GREEN}Passed: $passed${NC}"
    echo -e "  ${RED}Failed: $failed${NC}"
    
    if [ $failed -eq 0 ]; then
        print_success "All tests passed!"
        return 0
    else
        print_warning "$failed test(s) failed"
        return 1
    fi
}

# ==============================================================================
# Status Summary
# ==============================================================================

show_status() {
    print_header "📊 DEPLOYMENT STATUS"
    
    echo ""
    echo -e "${CYAN}Container Status:${NC}"
    docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
    
    echo ""
    echo -e "${CYAN}Service URLs:${NC}"
    echo -e "  ${GREEN}Next.js App:${NC}  $APP_URL"
    echo -e "  ${GREEN}pgAdmin:${NC}       $PGADMIN_URL"
    echo -e "  ${GREEN}Database:${NC}      localhost:5432"
    echo -e "  ${GREEN}Redis:${NC}         localhost:6379"
    
    echo ""
    echo -e "${CYAN}Quick Commands:${NC}"
    echo -e "  ${YELLOW}View logs:${NC}        docker compose logs -f"
    echo -e "  ${YELLOW}View app logs:${NC}    docker compose logs -f app"
    echo -e "  ${YELLOW}DB shell:${NC}        make db-shell"
    echo -e "  ${YELLOW}Restart:${NC}          docker compose restart"
    echo -e "  ${YELLOW}Stop:${NC}             docker compose down"
    echo -e "  ${YELLOW}Status:${NC}           docker compose ps"
    
    echo ""
    echo -e "${CYAN}Resource Usage:${NC}"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null || echo "  Unable to fetch stats"
}

# ==============================================================================
# Cleanup Function
# ==============================================================================

cleanup() {
    print_header "🧹 CLEANUP"
    
    choice=$(prompt_with_timeout "Do you want to stop all containers? (y/N) [auto-skip in 5s]: " "n" 5)
    echo ""
    
    if [[ "$choice" =~ ^[Yy]([Ee][Ss])?$ ]]; then
        print_step "Stopping all containers..."
        docker compose down
        print_success "All containers stopped"
    fi
}

# ==============================================================================
# Main Function
# ==============================================================================

main() {
    echo -e "${PURPLE}"
    echo "╔══════════════════════════════════════════════════════════════════════════════╗"
    echo "║                                                                              ║"
    echo "║   🚀 Next.js Frontend Starter - Complete Deployment                         ║"
    echo "║                                                                              ║"
    echo "║   Services:                                                                  ║"
    echo "║   ├── 📱 Next.js App         (Port 3000)                                     ║"
    echo "║   ├── 🗄️  PostgreSQL          (Port 5432)                                     ║"
    echo "║   ├── ⚡ Redis                (Port 6379, optional)                          ║"
    echo "║   ├── 🔧 pgAdmin              (Port 5050)                                    ║"
    echo "║   └── 🌐 Nginx                (Port 9080, optional)                          ║"
    echo "║                                                                              ║"
    echo "╚══════════════════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    # Parse command line arguments
    local skip_build=false
    local skip_tests=false
    local follow_logs=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-build|-s)
                skip_build=true
                shift
                ;;
            --skip-tests|-t)
                skip_tests=true
                shift
                ;;
            --follow|-f)
                follow_logs=true
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --skip-build, -s    Skip the build step"
                echo "  --skip-tests, -t    Skip endpoint testing"
                echo "  --follow, -f        Follow logs after deployment"
                echo "  --help, -h          Show this help message"
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Run deployment steps
    preflight_checks
    setup_network
    
    if ! $skip_build; then
        build_services
    else
        print_info "Skipping build step (--skip-build)"
    fi
    
    start_services
    health_checks
    
    if ! $skip_tests; then
        run_tests
    else
        print_info "Skipping tests (--skip-tests)"
    fi
    
    show_status
    
    print_header "🎉 DEPLOYMENT COMPLETE"
    
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✅ All services are deployed and running!                                  ║${NC}"
    echo -e "${GREEN}║                                                                              ║${NC}"
    echo -e "${GREEN}║  🌐 Access your app at: $APP_URL                                    ║${NC}"
    echo -e "${GREEN}║  🔧 Access pgAdmin at:  $PGADMIN_URL                                    ║${NC}"
    echo -e "${GREEN}║                                                                              ║${NC}"
    echo -e "${GREEN}║  📊 Features:                                                               ║${NC}"
    echo -e "${GREEN}║     • JWT Authentication                                                   ║${NC}"
    echo -e "${GREEN}║     • Real-time WebSocket support                                           ║${NC}"
    echo -e "${GREEN}║     • Role-based access control                                             ║${NC}"
    echo -e "${GREEN}║     • Media management                                                       ║${NC}"
    echo -e "${GREEN}║     • Internationalization (i18n)                                           ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    if $follow_logs; then
        print_info "Following logs... (Ctrl+C to exit)"
        docker compose logs -f
    else
        echo -e "${YELLOW}Run 'docker compose logs -f' to follow logs${NC}"
    fi
}

# ==============================================================================
# Run Main
# ==============================================================================

# Change to script directory
cd "$(dirname "$0")"

# Run main function with all arguments
main "$@"
