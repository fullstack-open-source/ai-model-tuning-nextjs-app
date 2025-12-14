/**
 * Centralized Environment Configuration
 * 
 * This file centralizes all environment variables from .env
 * Use this instead of accessing process.env directly throughout the codebase
 */

// ==============================================================================
// Application Configuration
// ==============================================================================
export const appConfig = {
  // Internal API URL - Used by server-side Next.js API routes
  internalUrl: process.env.API_INTERNAL_URL || 'http://localhost:3000',
  
  // External/Public API URL - Used by client-side browser calls
  publicUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  
  // API Mode - Defines the API path prefix
  // Normalized: ensures it starts with / and doesn't end with /
  mode: (() => {
    const rawMode = process.env.MODE || 'dev/v1/api';
    // Normalize: remove leading/trailing slashes, then add leading slash
    const normalized = rawMode.replace(/^\/+|\/+$/g, '');
    return normalized ? `/${normalized}` : '/dev/v1/api';
  })(),
  appMode: process.env.APP_MODE || 'development',
  
  
  // External/Third-Party API Configuration
  // Only used when USE_EXTERNAL_API=true
  useExternalApi: process.env.USE_EXTERNAL_API === 'true' || process.env.USE_EXTERNAL_API === '1',
  externalApiUrl: process.env.EXTERNAL_API_URL || 'http://localhost:8001',
  externalApiMode: (() => {
    const rawMode = process.env.EXTERNAL_API_MODE || process.env.MODE || 'dev/v1/api';
    const normalized = rawMode.replace(/^\/+|\/+$/g, '');
    return normalized ? `/${normalized}` : '/dev/v1/api';
  })(),
} as const;

// ==============================================================================
// CORS Configuration
// ==============================================================================
export const corsConfig = {
  // Allowed origins (comma-separated)
  origins: (process.env.CORS_ORIGINS || 'http://localhost:8500,http://localhost:8001')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean),
} as const;

// ==============================================================================
// Security & Authentication
// ==============================================================================
export const authConfig = {
  jwtSecret: process.env.JWT_SECRET || process.env.JWT_SECRET_KEY || '',
  jwtSecretKey: process.env.JWT_SECRET_KEY || process.env.JWT_SECRET || '',
  jwtAlgorithm: (process.env.JWT_ALGORITHM || 'HS256') as 'HS256' | 'HS384' | 'HS512' | 'RS256',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  accessTokenExpiryMinutes: parseInt(process.env.ACCESS_TOKEN_EXPIRY_MINUTES || '60', 10),
  sessionTokenExpiryMinutes: parseInt(process.env.SESSION_TOKEN_EXPIRY_MINUTES || '10080', 10),
  refreshTokenExpiryMinutes: parseInt(process.env.REFRESH_TOKEN_EXPIRY_MINUTES || '43200', 10),
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10),
  // OTP Configuration
  adminOtp: process.env.MASTER_OTP || process.env.MASTER_ADMIN_OTP || '1408199',
  fastOtpEnabled: process.env.FAST_OTP_ENABLED === 'true' || process.env.FAST_OTP_ENABLED === '1',
  fastOtp: process.env.FAST_OTP || '123456',
} as const;

// ==============================================================================
// Database Configuration
// ==============================================================================
export const dbConfig = {
  // PostgreSQL Configuration
  host: process.env.DATABASE_HOST || '',
  name: process.env.DATABASE_NAME || 'postgres',
  user: process.env.DATABASE_USER || '',
  password: process.env.DATABASE_PASSWORD || '',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  url: process.env.DATABASE_URL || '',
  ssl: process.env.DATABASE_SSL === 'true',
  
  // Database Pool Configuration
  poolMax: parseInt(process.env.DB_POOL_MAX || '50', 10),
  poolMin: parseInt(process.env.DB_POOL_MIN || '2', 10),
  poolIdleTimeout: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10),
  poolConnectionTimeout: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '10000', 10),
} as const;

// ==============================================================================
// Redis Configuration
// ==============================================================================
export const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || '',
  url: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  // Cache enable flag - set to 'false' to disable caching layer
  enabled: process.env.REDIS_CACHE_ENABLED !== 'false' && process.env.REDIS_CACHE_ENABLED !== '0',
  // Default TTL (fallback) in seconds
  defaultTTL: parseInt(process.env.REDIS_DEFAULT_TTL || '600', 10),
  // Tiered TTLs (in seconds)
  shortTTL: parseInt(process.env.REDIS_SHORT_TTL || (5 * 60).toString(), 10),        // 5 minutes
  mediumTTL: parseInt(process.env.REDIS_MEDIUM_TTL || (15 * 60).toString(), 10),     // 15 minutes
  longTTL: parseInt(process.env.REDIS_LONG_TTL || (60 * 60).toString(), 10),         // 1 hour
  veryLongTTL: parseInt(process.env.REDIS_VERY_LONG_TTL || (24 * 60 * 60).toString(), 10), // 1 day
} as const;

// ==============================================================================
// Sentry Configuration
// ==============================================================================
export const sentryConfig = {
  dsn: process.env.SENTRY_DSN || '',
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '1.0'),
  profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '1.0'),
  enableDev: process.env.SENTRY_ENABLE_DEV === 'true',
} as const;

// ==============================================================================
// Logging Configuration
// ==============================================================================
export const loggingConfig = {
  level: (process.env.LOG_LEVEL || 'info') as 'error' | 'warn' | 'info' | 'debug',
  timezone: process.env.TIMEZONE || 'UTC',
  utc: process.env.UTC === 'true',
  debugMode: process.env.DEBUG_MODE === 'true',
} as const;

// ==============================================================================
// PM2 Configuration
// ==============================================================================
export const pm2Config = {
  instances: process.env.PM2_INSTANCES || 'max',
  execMode: (process.env.PM2_EXEC_MODE || 'fork') as 'fork' | 'cluster',
} as const;

// ==============================================================================
// Storage Configuration (Google Cloud Storage / DigitalOcean Spaces)
// ==============================================================================
export const storageConfig = {
  googleBucketName: process.env.GOOGLE_STORAGE_BUCKET_NAME || '',
  bucketName: process.env.STORAGE_BUCKET || process.env.GOOGLE_STORAGE_BUCKET_NAME || '',
  bucketAccessKey: process.env.STORAGE_BUCKET_ACCESS_KEY || '',
  bucketSecretKey: process.env.STORAGE_BUCKET_SECRET_KEY || '',
  bucketServer: process.env.STORAGE_BUCKET_SERVER || '',
} as const;

// ==============================================================================
// Media Access Configuration
// ==============================================================================
export const mediaAccessConfig = {
  // Enable access key for private media (default: true)
  enableAccessKey: process.env.MEDIA_ENABLE_ACCESS_KEY !== 'false',
  // Access key length (default: 32 characters)
  accessKeyLength: parseInt(process.env.MEDIA_ACCESS_KEY_LENGTH || '32', 10),
  // Require access key even for public files (default: false)
  requireAccessKeyForPublic: process.env.MEDIA_REQUIRE_ACCESS_KEY_FOR_PUBLIC === 'true',
  // Allow admin to access private media without access key (default: true)
  allowAdminAccessWithoutKey: process.env.MEDIA_ALLOW_ADMIN_ACCESS_WITHOUT_KEY !== 'false',
} as const;

// ==============================================================================
// Email Configuration
// ==============================================================================
export const emailConfig = {
  host: process.env.EMAIL_HOST || '',
  user: process.env.EMAIL_HOST_USER || '',
  password: process.env.EMAIL_HOST_PASSWORD || '',
  port: parseInt(process.env.EMAIL_PORT || '587', 10),
  useTLS: process.env.EMAIL_USE_TLS === 'True' || process.env.EMAIL_USE_TLS === 'true',
} as const;

// ==============================================================================
// Twilio Configuration
// ==============================================================================
export const twilioConfig = {
  accountSid: process.env.TWILIO_ACCOUNT_SID || '',
  authToken: process.env.TWILIO_AUTH_TOKEN || '',
  phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
  whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER || '',
  callerId: process.env.TWILIO_CALLER_ID || '',
} as const;

// ==============================================================================
// PGAdmin Configuration
// ==============================================================================
export const pgAdminConfig = {
  email: process.env.PGADMIN_EMAIL || 'admin@example.com',
  password: process.env.PGADMIN_PASSWORD || 'admin@123',
  port: parseInt(process.env.PGADMIN_PORT || '5050', 10),
} as const;

// ==============================================================================
// Node Environment
// ==============================================================================
export const nodeEnv = {
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  value: process.env.NODE_ENV || 'development',
} as const;

// ==============================================================================
// Validation Functions
// ==============================================================================

/**
 * Validate required environment variables
 * Throws error if required variables are missing
 */
export function validateRequiredEnv(): void {
  const required: Array<{ key: string; value: string | number | undefined }> = [
    { key: 'JWT_SECRET or JWT_SECRET_KEY', value: authConfig.jwtSecret },
    { key: 'DATABASE_HOST', value: dbConfig.host },
    { key: 'DATABASE_USER', value: dbConfig.user },
    { key: 'DATABASE_PASSWORD', value: dbConfig.password },
  ];

  const missing = required.filter(({ value }) => !value);

  if (missing.length > 0) {
    const missingKeys = missing.map(({ key }) => key).join(', ');
    throw new Error(`Missing required environment variables: ${missingKeys}`);
  }
}

/**
 * Get all configuration as a single object
 * Useful for debugging or logging
 */
export function getAllConfig() {
  return {
    app: appConfig,
    cors: corsConfig,
    auth: { ...authConfig, jwtSecret: '***', jwtSecretKey: '***' }, // Hide secrets
    db: { ...dbConfig, password: '***', url: dbConfig.url ? '***' : '' }, // Hide secrets
    redis: { ...redisConfig, password: redisConfig.password ? '***' : '' }, // Hide secrets
    sentry: sentryConfig,
    logging: loggingConfig,
    pm2: pm2Config,
    storage: { ...storageConfig, bucketSecretKey: '***' }, // Hide secrets
    email: { ...emailConfig, password: emailConfig.password ? '***' : '' }, // Hide secrets
    twilio: { ...twilioConfig, authToken: twilioConfig.authToken ? '***' : '' }, // Hide secrets
    pgAdmin: pgAdminConfig,
    nodeEnv,
  };
}

// ==============================================================================
// Default Export
// ==============================================================================
const config = {
  app: appConfig,
  cors: corsConfig,
  auth: authConfig,
  db: dbConfig,
  redis: redisConfig,
  sentry: sentryConfig,
  logging: loggingConfig,
  pm2: pm2Config,
  storage: storageConfig,
  email: emailConfig,
  twilio: twilioConfig,
  pgAdmin: pgAdminConfig,
  nodeEnv,
  validateRequiredEnv,
  getAllConfig,
};

export default config;

