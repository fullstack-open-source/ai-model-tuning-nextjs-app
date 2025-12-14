/**
 * API Service Factory
 * 
 * Creates ApiService instances based on configuration:
 * - If USE_EXTERNAL_API=true: Routes to external Node.js backend API
 * - If USE_EXTERNAL_API=false: Routes to Next.js internal API routes
 * 
 * Optimized with caching for better performance
 */

import { ApiService } from './ApiService';
import { appConfig } from '@lib/config/env';
import { getInternalApiUrl, getPublicApiUrl, getApiUrl } from './getApiUrl';
import { getMode } from './mode';

// Cache for service instances (singleton pattern)
let cachedPublicService: ApiService | null = null;
let cachedInternalService: ApiService | null = null;
let cachedExternalService: ApiService | null = null;
let lastConfigHash: string | null = null;

/**
 * Generate config hash for cache invalidation
 */
function getConfigHash(): string {
  return `${appConfig.useExternalApi}-${appConfig.externalApiUrl}-${getMode()}`;
}

/**
 * Check if we should use external API (cached)
 */
export function shouldUseExternalApi(): boolean {
  return appConfig.useExternalApi;
}

/**
 * Get the appropriate API base URL based on configuration
 * - If USE_EXTERNAL_API=true: Returns external API URL (server-side only)
 * - If USE_EXTERNAL_API=false: Returns internal/Next.js API URL
 */
export function getApiBaseUrl(useInternal: boolean = false): string {
  if (shouldUseExternalApi()) {
    // External APIs are only used server-side (Next.js API routes)
    return appConfig.externalApiUrl;
  }
  
  // Use internal Next.js API URL
  if (useInternal) {
    return getInternalApiUrl();
  }
  
  return getApiUrl();
}

/**
 * Get the appropriate API mode based on configuration
 * - If USE_EXTERNAL_API=true: Returns external API mode (or MODE if not set)
 * - If USE_EXTERNAL_API=false: Returns internal MODE
 */
export function getApiModeForRequest(): string {
  if (shouldUseExternalApi()) {
    return appConfig.externalApiMode;
  }
  return getMode();
}

/**
 * Factory function to create ApiService instance
 * Automatically routes to external or internal API based on configuration
 * Uses caching for better performance
 */
export function createApiService(
  defaultHeaders?: Record<string, string>,
  timeout?: number
): ApiService {
  // For auto-routing, use public service (handles both client and server)
  return createPublicApiService(defaultHeaders, timeout);
}

/**
 * Factory function to create ApiService for internal Next.js routes
 * Always uses internal Next.js API (ignores USE_EXTERNAL_API)
 * Uses caching for better performance
 * Note: Internal Next.js routes don't use MODE prefix (they use /api/... directly)
 */
export function createInternalApiService(
  defaultHeaders?: Record<string, string>,
  timeout?: number
): ApiService {
  // Return cached instance if no custom headers/timeout
  if (cachedInternalService && !defaultHeaders && !timeout) {
    return cachedInternalService;
  }
  
  const baseURL = getInternalApiUrl();
  const mode = getMode();
  
  // Internal Next.js routes don't use MODE (routes are at /api/...)
  const useMode = false;
  
  const service = new ApiService(baseURL, defaultHeaders, timeout, mode, useMode);
  
  // Cache if no custom headers/timeout
  if (!defaultHeaders && !timeout) {
    cachedInternalService = service;
  }
  
  return service;
}

/**
 * Factory function to create ApiService for external API
 * Always uses external API (ignores USE_EXTERNAL_API)
 * Uses caching for better performance
 * Note: External APIs use MODE prefix (routes are at /dev/v1/api/...)
 * Note: Only server-side uses external APIs (no client-side calls)
 */
export function createExternalApiService(
  defaultHeaders?: Record<string, string>,
  timeout?: number
): ApiService {
  // Return cached instance if no custom headers/timeout
  if (cachedExternalService && !defaultHeaders && !timeout) {
    return cachedExternalService;
  }
  
  // External APIs are only used server-side (Next.js API routes)
  const baseURL = appConfig.externalApiUrl;
  const mode = appConfig.externalApiMode;
  
  // External APIs use MODE (routes are at /dev/v1/api/...)
  const useMode = true;
  
  const service = new ApiService(baseURL, defaultHeaders, timeout, mode, useMode);
  
  // Cache if no custom headers/timeout
  if (!defaultHeaders && !timeout) {
    cachedExternalService = service;
  }
  
  return service;
}

/**
 * Clear all cached service instances
 * Useful for testing or when config changes dynamically
 */
export function clearServiceCache(): void {
  cachedPublicService = null;
  cachedInternalService = null;
  cachedExternalService = null;
  lastConfigHash = null;
}

/**
 * Factory function to create ApiService for public/client-side usage
 * Automatically routes to internal Next.js API based on configuration
 * External APIs are only used server-side, so this always uses internal APIs
 * Uses caching for better performance
 */
export function createPublicApiService(
  defaultHeaders?: Record<string, string>,
  timeout?: number
): ApiService {
  const configHash = getConfigHash();
  
  // Return cached instance if config hasn't changed and no custom headers/timeout
  if (
    cachedPublicService &&
    lastConfigHash === configHash &&
    !defaultHeaders &&
    !timeout
  ) {
    return cachedPublicService;
  }
  
  // Client-side always uses internal Next.js APIs
  // External APIs are only used server-side (Next.js API routes)
  const baseURL = getPublicApiUrl();
  const mode = getMode();
  
  // Internal Next.js APIs don't use MODE (routes are at /api/...)
  const useMode = false;
  
  const service = new ApiService(baseURL, defaultHeaders, timeout, mode, useMode);
  
  // Cache if no custom headers/timeout
  if (!defaultHeaders && !timeout) {
    cachedPublicService = service;
    lastConfigHash = configHash;
  }
  
  return service;
}

// Default export
const apiServiceFactory = {
  shouldUseExternalApi,
  getApiBaseUrl,
  getApiModeForRequest,
  createApiService,
  createInternalApiService,
  createExternalApiService,
  createPublicApiService,
  clearServiceCache,
};

export default apiServiceFactory;

