/**
 * API Mode Utility
 * Optimized MODE handling with caching and normalization
 * 
 * MODE is read once from environment and cached for performance
 */

import { appConfig } from '@lib/config/env';

/**
 * Cached API mode (already normalized in appConfig)
 * Format: /dev/v1/api, /prod/v1/api, etc.
 */
let cachedMode: string | null = null;

/**
 * Get the API mode (cached for performance)
 * Returns normalized mode with leading slash, no trailing slash
 * Examples: /dev/v1/api, /prod/v1/api, /stg/v1/api
 */
export function getMode(): string {
  if (cachedMode === null) {
    cachedMode = appConfig.mode;
  }
  return cachedMode;
}

/**
 * Get API mode without leading slash
 * Examples: dev/v1/api, prod/v1/api, stg/v1/api
 */
export function getModeWithoutSlash(): string {
  return getMode().replace(/^\/+/, '');
}

/**
 * Check if mode matches a pattern
 */
export function isMode(pattern: string): boolean {
  const mode = getModeWithoutSlash();
  return mode === pattern || mode.startsWith(`${pattern}/`);
}

/**
 * Get mode parts (environment, version, api)
 * Example: /dev/v1/api -> { env: 'dev', version: 'v1', api: 'api' }
 */
export function getModeParts(): { env: string; version: string; api: string } {
  const mode = getModeWithoutSlash();
  const parts = mode.split('/');
  return {
    env: parts[0] || 'dev',
    version: parts[1] || 'v1',
    api: parts[2] || 'api',
  };
}

/**
 * Reset cache (useful for testing)
 */
export function resetModeCache(): void {
  cachedMode = null;
}

// Export default
export default {
  getMode,
  getModeWithoutSlash,
  isMode,
  getModeParts,
  resetModeCache,
};

