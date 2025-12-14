import { NextRequest } from 'next/server';
import { SUCCESS } from '@lib/response/response';
import { ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { appConfig, loggingConfig } from '@lib/config/env';

/**
 * Health check endpoint
 * GET /api/health
 */
export async function GET(req: NextRequest) {
  try {
    const mode = appConfig.mode;

    const envInfo = {
      API_VERSION: process.env.API_VERSION || 'N/A',
      API_MODE: process.env.API_MODE || 'N/A',
      API_URL: appConfig.internalUrl,
      MODE: mode,
      UTC: loggingConfig.utc ? 'true' : 'false',
      DEBUG_MODE: loggingConfig.debugMode ? 'true' : 'false',
      TIMEZONE: loggingConfig.timezone,
      LOG_LEVEL: loggingConfig.level,
    };

    const meta = {
      service: 'nextjs-backend-api',
      status: 'ok',
      env: envInfo,
    };

    return SUCCESS.json('Service is healthy', { status: 'ok' }, meta);
  } catch (error: any) {
    logger.error('Health check failed', { extraData: { error: error.message  }});
    return ERROR.json('HEALTH_CHECK_FAILED', {}, error);
  }
}

