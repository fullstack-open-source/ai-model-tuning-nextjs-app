/**
 * API URL Utility
 * 
 * Automatically selects the correct API URL based on the execution context:
 * - Server-side (API routes, Server Components): Uses internal URL
 * - Client-side (Browser): Uses public/external URL
 * 
 * Mode is automatically prepended (e.g., dev/v1/api, prod/v1/api, stg/v1/api)
 * Endpoints should NOT include /api prefix as mode handles it
 */

import { appConfig } from '@lib/config/env';
import { getMode, getModeWithoutSlash } from './mode';

/**
 * Get the API mode from environment variable (optimized with caching)
 * Examples: /dev/v1/api, /prod/v1/api, /stg/v1/api
 * Always returns normalized mode with leading slash, no trailing slash
 */
export function getApiMode(): string {
  return getMode();
}

/**
 * Get normalized API mode (without leading slash for URL construction)
 * Examples: dev/v1/api, prod/v1/api, stg/v1/api
 */
export function getApiModeWithoutSlash(): string {
  return getModeWithoutSlash();
}

/**
 * Get the API base URL for server-side usage (API routes, Server Components, Server Actions)
 * Uses internal URL that works within the same network/container
 */
export function getInternalApiUrl(): string {
  return appConfig.internalUrl;
}

/**
 * Get the API base URL for client-side usage (Browser, Client Components)
 * Uses public URL that is accessible from the browser
 */
export function getPublicApiUrl(): string {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined') {
    return appConfig.publicUrl;
  }
  
  // Fallback for server-side rendering (SSR) - use internal URL
  return getInternalApiUrl();
}

/**
 * Get the appropriate API URL based on execution context
 * Automatically selects internal (server) or public (client) URL
 */
export function getApiUrl(): string {
  // If we're in a browser, use public URL
  if (typeof window !== 'undefined') {
    return getPublicApiUrl();
  }
  
  // Otherwise, use internal URL (server-side)
  return getInternalApiUrl();
}

/**
 * Get the full API endpoint URL with mode prefix
 * @param endpoint - API endpoint path (e.g., '/users' or 'users') - DO NOT include /api
 * @param useInternal - Force use of internal URL (default: auto-detect)
 * @param mode - Optional mode override (default: from env MODE)
 */
export function getApiEndpoint(
  endpoint: string,
  useInternal?: boolean,
  mode?: string
): string {
  const baseUrl = useInternal !== undefined
    ? (useInternal ? getInternalApiUrl() : getPublicApiUrl())
    : getApiUrl();
  
  // Use provided mode or get from config (already normalized)
  const apiMode = mode ? (mode.startsWith('/') ? mode : `/${mode}`) : getApiMode();
  
  // Remove /api from endpoint if present (mode already includes it)
  let normalizedEndpoint = endpoint.replace(/^\/api/, '').replace(/^api/, '');
  
  // Ensure endpoint starts with /
  normalizedEndpoint = normalizedEndpoint.startsWith('/') ? normalizedEndpoint : `/${normalizedEndpoint}`;
  
  // Remove trailing slash from baseUrl if present
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  
  // Mode is already normalized (leading slash, no trailing slash)
  // Just ensure it doesn't have trailing slash
  const cleanMode = apiMode.endsWith('/') ? apiMode.slice(0, -1) : apiMode;
  
  return `${normalizedBaseUrl}${cleanMode}${normalizedEndpoint}`;
}

/**
 * Get API URL with mode prefix (alias for getApiEndpoint)
 * @param endpoint - API endpoint path (e.g., '/users') - DO NOT include /api
 * @param mode - Optional mode override (default: from env MODE)
 */
export function getApiUrlWithMode(
  endpoint: string,
  mode?: string
): string {
  return getApiEndpoint(endpoint, undefined, mode);
}

// Default export for convenience
export default {
  getApiMode,
  getInternalApiUrl,
  getPublicApiUrl,
  getApiUrl,
  getApiEndpoint,
  getApiUrlWithMode,
};

