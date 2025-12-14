import { NextRequest } from 'next/server';
import { SUCCESS, ERROR } from '@lib/response/response';
import { logger } from '@lib/logger/logger';

/**
 * Test Sentry Integration
 * GET /api/test-sentry
 */
export async function GET(req: NextRequest) {
  try {
    // Test error logging
    logger.error('Test Sentry error', {
      module: 'Sentry',
      extraData: {
        test: true,
        message: 'This is a test error for Sentry integration',
      },
    });

    // Test warning
    logger.warning('Test Sentry warning', {
      module: 'Sentry',
      extraData: {
        test: true,
        message: 'This is a test warning for Sentry integration',
      },
    });

    return SUCCESS.json('Sentry test completed', {
      message: 'Sentry integration test completed. Check Sentry dashboard for logs.',
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error in test-sentry', {
      module: 'Sentry',
      extraData: {
        error: errorMessage,
        label: 'TEST_SENTRY',
      },
    });
    return ERROR.json('INTERNAL_ERROR', {}, error);
  }
}
