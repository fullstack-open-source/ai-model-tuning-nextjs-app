# Centralized Configuration

This directory contains centralized configuration management for all environment variables.

## Usage

Instead of accessing `process.env` directly, import from `@lib/config/env`:

```typescript
import { appConfig, dbConfig, authConfig } from '@lib/config/env';

// Use config values
const apiUrl = appConfig.internalUrl;
const dbHost = dbConfig.host;
const jwtSecret = authConfig.jwtSecret;
```

## Available Configurations

### Application Config (`appConfig`)
- `internalUrl` - Internal API URL for server-side
- `publicUrl` - Public API URL for client-side
- `host` - API host
- `proxyPort` - Proxy port
- `mode` - API mode (e.g., `dev/v1/api`)
- `appMode` - Application mode (development/production)

### CORS Config (`corsConfig`)
- `origins` - Array of allowed CORS origins

### Auth Config (`authConfig`)
- `jwtSecret` - JWT secret key
- `jwtAlgorithm` - JWT algorithm (HS256, HS384, HS512, RS256)
- `jwtExpiresIn` - JWT expiration time
- `accessTokenExpiryMinutes` - Access token expiry
- `sessionTokenExpiryMinutes` - Session token expiry
- `refreshTokenExpiryMinutes` - Refresh token expiry
- `bcryptSaltRounds` - Bcrypt salt rounds

### Database Config (`dbConfig`)
- `host` - Database host
- `name` - Database name
- `user` - Database user
- `password` - Database password
- `port` - Database port
- `url` - Full database URL
- `poolMax` - Max pool connections
- `poolMin` - Min pool connections

### Redis Config (`redisConfig`)
- `host` - Redis host
- `port` - Redis port
- `password` - Redis password
- `url` - Redis URL
- `db` - Redis database number
- `defaultTTL` - Default TTL in seconds

### Logging Config (`loggingConfig`)
- `level` - Log level (error, warn, info, debug)
- `timezone` - Timezone
- `utc` - Use UTC
- `debugMode` - Debug mode enabled

### Storage Config (`storageConfig`)
- `googleBucketName` - Google Cloud Storage bucket name
- `bucketName` - Storage bucket name
- `bucketAccessKey` - Bucket access key
- `bucketSecretKey` - Bucket secret key
- `bucketServer` - Bucket server URL

### Email Config (`emailConfig`)
- `host` - SMTP host
- `user` - SMTP user
- `password` - SMTP password
- `port` - SMTP port
- `useTLS` - Use TLS

### Twilio Config (`twilioConfig`)
- `accountSid` - Twilio account SID
- `authToken` - Twilio auth token
- `phoneNumber` - Phone number for SMS
- `whatsappNumber` - WhatsApp number
- `callerId` - Caller ID

### Node Environment (`nodeEnv`)
- `isDevelopment` - Is development environment
- `isProduction` - Is production environment
- `isTest` - Is test environment
- `value` - NODE_ENV value

## Validation

Validate required environment variables on startup:

```typescript
import { validateRequiredEnv } from '@lib/config/env';

// Call this at application startup
validateRequiredEnv();
```

## Get All Config (for debugging)

```typescript
import { getAllConfig } from '@lib/config/env';

// Returns all config with secrets hidden
const config = getAllConfig();
console.log(config);
```

## Default Export

You can also use the default export:

```typescript
import config from '@lib/config/env';

const apiUrl = config.app.internalUrl;
const dbHost = config.db.host;
```

## Benefits

1. **Type Safety** - All config values are typed
2. **Centralized** - Single source of truth for all environment variables
3. **Validation** - Built-in validation for required variables
4. **Default Values** - Sensible defaults for optional variables
5. **Documentation** - Self-documenting configuration structure
6. **Testing** - Easy to mock in tests

