import { NextRequest } from 'next/server';
import { SUCCESS } from '@lib/response/response';
import { ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';
import { appConfig, loggingConfig } from '@lib/config/env';
import os from 'os';

/**
 * System health check endpoint
 * GET /api/health/system
 */
export async function GET(req: NextRequest) {
  try {
    const mode = appConfig.mode;
    
    const systemInfo = {
      platform: process.platform,
      nodeVersion: process.version,
      cpuCount: os.cpus().length,
      memoryTotal: os.totalmem(),
      memoryFree: os.freemem(),
      memoryUsed: os.totalmem() - os.freemem(),
      uptime: os.uptime(),
    };

    const envInfo = {
      API_VERSION: process.env.API_VERSION || 'N/A',
      API_MODE: process.env.API_MODE || 'N/A',
      API_URL: appConfig.internalUrl,
      MODE: mode,
      DEBUG_MODE: loggingConfig.debugMode ? 'true' : 'false',
      LOG_LEVEL: loggingConfig.level,
    };

    return SUCCESS.json(
      'System health check completed',
      {
        status: 'healthy',
        system_info: systemInfo,
        environment: envInfo,
        timestamp: Date.now(),
      }
    );
  } catch (error: any) {
    logger.error('System health check failed', { extraData: { error: error.message  }});
    return ERROR.json('HEALTH_CHECK_FAILED', {}, error);
  }
}

