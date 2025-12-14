/**
 * Prisma Seed Script
 * Pulls schema from remote database and seeds local database
 */

const { execSync } = require('child_process');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

// Simple logger for seed script
const logger = {
  info: (message, data) => console.log(`[INFO] ${message}`, data || ''),
  warn: (message, data) => console.warn(`[WARN] ${message}`, data || ''),
  error: (message, data) => console.error(`[ERROR] ${message}`, data || ''),
  debug: (message, data) => console.debug(`[DEBUG] ${message}`, data || ''),
};

// Get DATABASE_URL from environment
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  logger.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

// Create PostgreSQL pool
const pool = new Pool({
  connectionString: databaseUrl,
});

// Create Prisma adapter
const adapter = new PrismaPg(pool);

// Initialize Prisma Client with adapter
const prisma = new PrismaClient({
  adapter: adapter,
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

/**
 * Pull schema from remote database
 */
async function pullSchema() {
  try {
    logger.info('Pulling schema from remote database...');
    
    // Use Prisma db pull to introspect the database
    execSync('npx prisma db pull', { 
      stdio: 'inherit',
      cwd: require('path').resolve(__dirname, '..')
    });
    
    logger.info('Schema pulled successfully');
    
    // Generate Prisma Client with new schema
    execSync('npx prisma generate', { 
      stdio: 'inherit',
      cwd: require('path').resolve(__dirname, '..')
    });
    
    logger.info('Prisma Client generated successfully');
  } catch (error) {
    logger.error('Failed to pull schema', { error: error.message });
    throw error;
  }
}

/**
 * Push schema to database (creates/updates tables)
 */
async function pushSchema() {
  try {
    logger.info('Pushing schema to database...');
    
   
    // Use Prisma db push to sync schema
    execSync('npx prisma db push', { 
      stdio: 'inherit',
      cwd: require('path').resolve(__dirname, '..')
    });
    
    logger.info('Schema pushed successfully');
    
    // Generate Prisma Client
    execSync('npx prisma generate', { 
      stdio: 'inherit',
      cwd: require('path').resolve(__dirname, '..')
    });
    
    logger.info('Prisma Client generated successfully');
  } catch (error) {
    logger.error('Failed to push schema', { error: error.message });
    
    // Provide helpful error message for Supabase pooler issue
    if (error.message && error.message.includes('prepared statement')) {
      logger.error('');
      logger.error('   Update DATABASE_URL in your .env file to use direct connection:');
      logger.error('   DATABASE_URL=postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres');
      logger.error('   (Use port 5432 for direct connection, not 6543 for pooler)');
    }
    
    throw error;
  }
}

/**
 * Seed database with initial data
 */
async function seed() {
  try {
    logger.info('Seeding database with default groups and permissions...');
    
    const { seed: seedDefaults } = require('./seed-defaults');
    await seedDefaults();
    
    // Disconnect Prisma after seeding to prevent hanging
    await prisma.$disconnect();
    
    logger.info('Database seeded successfully');
  } catch (error) {
    logger.error('Failed to seed database', { error: error.message });
    // Disconnect even on error
    await prisma.$disconnect().catch(() => {});
    throw error;
  }
}

// Main execution
async function main() {
  const command = process.argv[2];
  
  try {
    switch (command) {
      case 'pull':
        await pullSchema();
        break;
      case 'push':
        await pushSchema();
        break;
      case 'seed':
        await seed();
        break;
      case 'sync':
        // Pull from remote, then push to local
        await pullSchema();
        await pushSchema();
        break;
      default:
        console.log(`
Usage: node prisma/seed.js <command>

Commands:
  pull  - Pull schema from remote database
  push  - Push schema to database
  seed  - Seed database with initial data
  sync  - Pull schema from remote and push to local database
        `);
        process.exit(1);
    }
  } catch (error) {
    logger.error('Command failed', { error: error.message });
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { pullSchema, pushSchema, seed };

