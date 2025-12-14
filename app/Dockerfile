# ==============================================================================
# Multi-stage Dockerfile for Next.js Frontend
# Optimized for production with security and performance best practices
# Includes PostgreSQL support with Prisma migrations
# ==============================================================================

# ==============================================================================
# Stage 1: Dependencies - Install and cache dependencies
# ==============================================================================
FROM node:20-alpine AS dependencies

WORKDIR /frontend

# Install build dependencies (including PostgreSQL client for health checks)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    bash \
    openssl \
    postgresql-client \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Install dependencies (this will also run postinstall: prisma generate)
RUN npm ci --prefer-offline --no-audit --progress=false && \
    npm cache clean --force

# ==============================================================================
# Stage 2: Builder - Build Next.js app
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /frontend

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    bash \
    openssl \
    postgresql-client \
    && rm -rf /var/cache/apk/*

# Copy node_modules from dependencies stage
COPY --from=dependencies /frontend/node_modules ./node_modules

# Copy package files
COPY package*.json ./

# Copy Prisma schema, config, and migrations
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Generate Prisma Client (already generated in dependencies stage, but ensure it's up to date)
RUN npx prisma generate

# Copy configuration files
COPY next.config.* ./
COPY tsconfig.json ./
COPY tailwind.config.js ./
COPY postcss.config.mjs ./
COPY components.json ./

# Copy source code
COPY src ./src
COPY public ./public

# Copy custom server and scripts
COPY server.js ./
COPY start.sh ./
COPY ecosystem.config.js ./

# Copy helper scripts
COPY scripts ./scripts/

# Build Next.js production app (Prisma Client already generated)
RUN npm run build:no-cache

# ==============================================================================
# Stage 3: Production - Final optimized image
# ==============================================================================
FROM node:20-alpine AS production

ARG APP_INTERNAL_PORT=3000
ARG PRISMA_STUDIO_PORT=5555
ARG ENABLE_PRISMA_STUDIO=true
ARG APP_MODE=production

LABEL maintainer="mrdas" \
      version="1.0" \
      description="Next.js Frontend - Production Image with PostgreSQL" \
      org.opencontainers.image.title="nextjs-frontend" \
      org.opencontainers.image.description="Production-ready Next.js frontend with PostgreSQL support" \
      org.opencontainers.image.version="1.0.0"

ENV NODE_ENV=production \
    PATH="/frontend/node_modules/.bin:$PATH" \
    APP_INTERNAL_PORT=${APP_INTERNAL_PORT} \
    APP_MODE=${APP_MODE} \
    PORT=${APP_INTERNAL_PORT} \
    # Database defaults (can be overridden)
    WAIT_FOR_DB=true \
    DB_WAIT_TIMEOUT=60 \
    SKIP_MIGRATIONS=false \
    SKIP_SEED=false \
    # Prisma Studio defaults
    ENABLE_PRISMA_STUDIO=${ENABLE_PRISMA_STUDIO} \
    PRISMA_STUDIO_PORT=${PRISMA_STUDIO_PORT}

# Install runtime dependencies (including PostgreSQL client)
RUN apk add --no-cache \
    curl \
    dumb-init \
    bash \
    openssl \
    postgresql-client \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S mrdas && \
    adduser -S mrdas -u 1001 -G mrdas

WORKDIR /frontend

# Copy package files
COPY --from=builder --chown=mrdas:mrdas /frontend/package*.json ./

# Copy Prisma files (needed for Prisma Client at runtime and migrations)
COPY --from=builder --chown=mrdas:mrdas /frontend/prisma ./prisma/
COPY --from=builder --chown=mrdas:mrdas /frontend/prisma.config.ts ./

# Copy built Next.js app
COPY --from=builder --chown=mrdas:mrdas /frontend/.next ./.next
COPY --from=builder --chown=mrdas:mrdas /frontend/.next/static ./.next/static

# Copy public assets
COPY --from=builder --chown=mrdas:mrdas /frontend/public ./public

# Copy configuration files (needed at runtime)
COPY --from=builder --chown=mrdas:mrdas /frontend/next.config.* ./
COPY --from=builder --chown=mrdas:mrdas /frontend/tsconfig.json ./
COPY --from=builder --chown=mrdas:mrdas /frontend/tailwind.config.js ./
COPY --from=builder --chown=mrdas:mrdas /frontend/postcss.config.mjs ./

# Copy custom server and scripts
COPY --from=builder --chown=mrdas:mrdas /frontend/server.js ./
COPY --from=builder --chown=mrdas:mrdas /frontend/start.sh ./
COPY --from=builder --chown=mrdas:mrdas /frontend/ecosystem.config.js ./

# Copy helper scripts
COPY --from=builder --chown=mrdas:mrdas /frontend/scripts ./scripts/

# Install only production dependencies (exclude devDependencies)
# Prisma Client is already generated in builder stage, so we skip postinstall
# Note: --only=production is deprecated in npm 7+, use --omit=dev instead
RUN npm ci --omit=dev --prefer-offline --no-audit --progress=false --ignore-scripts && \
    npm install -g pm2 && \
    npm cache clean --force && \
    # Generate Prisma Client for production (needed at runtime)
    npx prisma generate

# Create necessary directories
RUN mkdir -p /frontend/logs /frontend/public/uploads && \
    chown -R mrdas:mrdas /frontend

# Set executable permissions
RUN chmod +x /frontend/start.sh

USER mrdas

# Expose ports
# Port 3000 (or APP_INTERNAL_PORT) for Next.js app
# Port 5555 for Prisma Studio
EXPOSE ${APP_INTERNAL_PORT} ${PRISMA_STUDIO_PORT}

# Health check for Next.js
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=5 \
    CMD sh -c "curl -f http://localhost:${APP_INTERNAL_PORT}/api/health || exit 1"

ENTRYPOINT ["dumb-init", "--"]
CMD ["/frontend/start.sh"]
