# ==============================================================================
# Makefile for Next.js Frontend with Docker
# ==============================================================================

.PHONY: help build up down restart logs shell db-shell db-migrate db-seed db-reset clean prune

# Colors
GREEN := \033[0;32m
YELLOW := \033[1;33m
BLUE := \033[0;34m
NC := \033[0m

# Default target
help:
	@echo ""
	@echo "$(BLUE)╔══════════════════════════════════════════════════════════════╗$(NC)"
	@echo "$(BLUE)║       Next.js Frontend - Docker Management Commands          ║$(NC)"
	@echo "$(BLUE)╚══════════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
	@echo "$(GREEN)Docker Commands:$(NC)"
	@echo "  make build          - Build Docker images"
	@echo "  make up             - Start all services"
	@echo "  make up-dev         - Start services in development mode"
	@echo "  make down           - Stop all services"
	@echo "  make restart        - Restart all services"
	@echo "  make logs           - View logs (all services)"
	@echo "  make logs-app       - View app logs only"
	@echo "  make logs-db        - View database logs only"
	@echo ""
	@echo "$(GREEN)Database Commands:$(NC)"
	@echo "  make db-shell       - Open PostgreSQL shell"
	@echo "  make db-migrate     - Run Prisma migrations"
	@echo "  make db-seed        - Seed the database"
	@echo "  make db-reset       - Reset database (migrate + seed)"
	@echo "  make db-studio      - Open Prisma Studio"
	@echo ""
	@echo "$(GREEN)Utility Commands:$(NC)"
	@echo "  make shell              - Open bash shell in app container"
	@echo "  make clean              - Stop services and remove volumes"
	@echo "  make clean-nginx-cache   - Clear Nginx proxy cache"
	@echo "  make nginx-logs         - View Nginx access logs"
	@echo "  make nginx-security-logs - View Nginx security logs"
	@echo "  make prune              - Clean up all Docker resources"
	@echo ""
	@echo "$(YELLOW)URLs:$(NC)"
	@echo "  App:           http://localhost:3001"
	@echo "  Prisma Studio: http://localhost:5555 (or via Nginx: http://localhost:$${PROXY_PORT:-3001}/prisma-studio)"
	@echo "  pgAdmin:       http://localhost:5050"
	@echo "  Nginx Proxy:   http://localhost:$${PROXY_PORT:-3001}"
	@echo "  Database:      localhost:5432"
	@echo "  Redis:         localhost:6379"
	@echo ""

# ==============================================================================
# Docker Commands
# ==============================================================================

build:
	@echo "$(GREEN)Building Docker images...$(NC)"
	docker compose build

up:
	@echo "$(GREEN)Starting all services...$(NC)"
	docker compose up -d
	@echo ""
	@echo "$(GREEN)Services started!$(NC)"
	@echo "  App:           http://localhost:3000"
	@echo "  Prisma Studio: http://localhost:5555"
	@echo "  pgAdmin:       http://localhost:5050"

up-dev:
	@echo "$(GREEN)Starting services in development mode...$(NC)"
	docker compose -f docker-compose.yaml -f docker-compose.dev.yaml up -d

up-nginx:
	@echo "$(GREEN)Starting services with Nginx...$(NC)"
	@echo "$(YELLOW)Note: Nginx is now included by default. Use 'make up' instead.$(NC)"
	docker compose up -d

down:
	@echo "$(YELLOW)Stopping all services...$(NC)"
	docker compose down

restart:
	@echo "$(YELLOW)Restarting all services...$(NC)"
	docker compose restart

logs:
	docker compose logs -f

logs-app:
	docker compose logs -f app

logs-db:
	docker compose logs -f postgres

logs-redis:
	docker compose logs -f redis

logs-pgadmin:
	docker compose logs -f pgadmin

# ==============================================================================
# Database Commands
# ==============================================================================

db-shell:
	@echo "$(GREEN)Opening PostgreSQL shell...$(NC)"
	docker compose exec postgres psql -U $${DATABASE_USER:-nextjs_db} -d $${DATABASE_NAME:-postgres}

db-migrate:
	@echo "$(GREEN)Running Prisma migrations...$(NC)"
	docker compose exec app npx prisma migrate deploy

db-migrate-dev:
	@echo "$(GREEN)Running Prisma migrations (dev)...$(NC)"
	docker compose exec app npx prisma migrate dev

db-seed:
	@echo "$(GREEN)Seeding database...$(NC)"
	docker compose exec app npx prisma db seed

db-reset:
	@echo "$(YELLOW)Resetting database...$(NC)"
	docker compose exec app npx prisma migrate reset --force

db-studio:
	@echo "$(GREEN)Opening Prisma Studio...$(NC)"
	docker compose exec app npx prisma studio

db-generate:
	@echo "$(GREEN)Generating Prisma Client...$(NC)"
	docker compose exec app npx prisma generate

db-push:
	@echo "$(GREEN)Pushing schema to database...$(NC)"
	docker compose exec app npx prisma db push

# ==============================================================================
# Utility Commands
# ==============================================================================

shell:
	@echo "$(GREEN)Opening bash shell in app container...$(NC)"
	docker compose exec app sh

shell-postgres:
	@echo "$(GREEN)Opening shell in postgres container...$(NC)"
	docker compose exec postgres sh

shell-redis:
	@echo "$(GREEN)Opening shell in redis container...$(NC)"
	docker compose exec redis sh

status:
	@echo "$(GREEN)Container status:$(NC)"
	docker compose ps

health:
	@echo "$(GREEN)Health check:$(NC)"
	@docker compose exec app curl -s http://localhost:3000/api/health | jq . 2>/dev/null || echo "App not responding"
	@docker compose exec postgres pg_isready -U postgres && echo "PostgreSQL: Ready" || echo "PostgreSQL: Not ready"
	@docker compose exec redis redis-cli ping && echo "Redis: Ready" || echo "Redis: Not ready"

# ==============================================================================
# Cleanup Commands
# ==============================================================================

clean:
	@echo "$(YELLOW)Stopping services and removing volumes...$(NC)"
	docker compose down -v
	@echo "$(GREEN)Cleanup complete!$(NC)"

clean-nginx-cache:
	@echo "$(YELLOW)Clearing Nginx cache...$(NC)"
	@docker compose exec nginx sh -c "rm -rf /var/cache/nginx/*" 2>/dev/null || echo "Nginx container not running or cache already cleared"
	@echo "$(GREEN)Nginx cache cleared!$(NC)"

nginx-logs:
	@echo "$(GREEN)Viewing Nginx access logs...$(NC)"
	@docker compose logs -f nginx 2>/dev/null || echo "Nginx container not running"

nginx-security-logs:
	@echo "$(GREEN)Viewing Nginx security logs...$(NC)"
	@docker compose exec nginx tail -f /var/log/nginx/security.log 2>/dev/null || echo "Nginx container not running or security.log not found"

clean-images:
	@echo "$(YELLOW)Removing Docker images...$(NC)"
	docker compose down --rmi local

prune:
	@echo "$(YELLOW)Pruning all Docker resources...$(NC)"
	docker system prune -af
	docker volume prune -f
	@echo "$(GREEN)Prune complete!$(NC)"

# ==============================================================================
# Development Commands
# ==============================================================================

dev:
	@echo "$(GREEN)Starting development environment...$(NC)"
	npm run dev

install:
	@echo "$(GREEN)Installing dependencies...$(NC)"
	npm ci

lint:
	@echo "$(GREEN)Running linter...$(NC)"
	npm run lint

format:
	@echo "$(GREEN)Formatting code...$(NC)"
	npm run format

# ==============================================================================
# Production Commands
# ==============================================================================

prod-build:
	@echo "$(GREEN)Building for production...$(NC)"
	docker compose -f docker-compose.yaml build --no-cache

prod-up:
	@echo "$(GREEN)Starting production services...$(NC)"
	docker compose -f docker-compose.yaml up -d

prod-deploy:
	@echo "$(GREEN)Deploying to production...$(NC)"
	docker compose -f docker-compose.yaml pull
	docker compose -f docker-compose.yaml up -d --build
	docker compose -f docker-compose.yaml exec app npx prisma migrate deploy

