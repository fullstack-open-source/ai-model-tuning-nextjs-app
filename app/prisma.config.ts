// Prisma 7 Configuration
// This file is used by Prisma 7+ for datasource configuration
import { defineConfig } from 'prisma/config';

// For prisma generate, DATABASE_URL is not required
// Use a dummy value if not set (only needed for migrations/push)
// In Docker/production, DATABASE_URL will be provided via environment variables
const databaseUrl = process.env.DATABASE_URL || 'postgresql://nextjs_db:postgres123@localhost:5432/postgres';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: databaseUrl,
  },
});

