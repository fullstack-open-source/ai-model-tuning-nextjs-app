import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { nodeEnv, dbConfig } from '@lib/config/env';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Create Prisma client with pg adapter for Prisma 7
function createPrismaClient() {
  // Get database URL from environment
  const databaseUrl = process.env.DATABASE_URL || '';
  
  // Configure pool with better connection management
  const poolConfig = {
    connectionString: databaseUrl || 'postgresql://user:pass@localhost:5432/db',
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection cannot be established
    statement_timeout: 30000, // Cancel queries that take longer than 30 seconds
  };
  
  // For builds/static generation, return a simple prisma client
  // The adapter is only needed at runtime
  if (process.env.NODE_ENV === 'production' || !databaseUrl) {
    // For SSG/build time - use a placeholder that won't connect
    // The actual connection happens at runtime
    const pool = new Pool(poolConfig);
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ 
      adapter,
      log: nodeEnv.isDevelopment ? ['error', 'warn'] : ['error'],
    });
  }
  
  // For development with actual connection
  const pool = new Pool(poolConfig);
  const adapter = new PrismaPg(pool);
  
  return new PrismaClient({
    adapter,
    log: nodeEnv.isDevelopment ? ['error', 'warn'] : ['error'],
  });
}

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

if (!nodeEnv.isProduction) globalForPrisma.prisma = prisma;
