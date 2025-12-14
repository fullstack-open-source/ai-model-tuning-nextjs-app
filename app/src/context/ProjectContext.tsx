/**
 * Project Context
 * Manages project information with persistent caching
 * Cache never expires - if expired, automatically re-fetches
 */

"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import { projectService } from "@services/project.service";
import { createPublicApiService } from "@lib/api/ApiServiceFactory";
import { cache } from "@lib/cache/cache";
import { getProjectInformationCacheKey } from "@lib/cache/keys";
import type { ProjectInformation } from "@models/project.model";

// Client-safe logger (console-based, no Node.js dependencies)
const clientLogger = {
  debug: (message: string, data?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[ProjectContext] ${message}`, data || '');
    }
  },
  warning: (message: string, data?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[ProjectContext] ${message}`, data || '');
    }
  },
  error: (message: string, data?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === 'development') {
      console.error(`[ProjectContext] ${message}`, data || '');
    }
  },
};

interface ProjectContextType {
  projectInfo: ProjectInformation | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isReady: boolean;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const CACHE_KEY = getProjectInformationCacheKey();
const CACHE_DURATION = 365 * 24 * 60 * 60; // 1 year in seconds

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projectInfo, setProjectInfo] = useState<ProjectInformation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(false);
  
  // Track pending request to prevent multiple simultaneous calls
  const pendingRequestRef = useRef<Promise<void> | null>(null);

  /**
   * Fetch project information from API
   */
  const fetchProjectInfo = useCallback(async (forceRefresh = false) => {
    // Don't update state if not mounted
    if (!isMountedRef.current) return;

    // If there's already a pending request, wait for it instead of making a new one
    if (pendingRequestRef.current && !forceRefresh) {
      try {
        await pendingRequestRef.current;
        return;
      } catch {
        // If pending request failed, continue with new request
      }
    }

    // Create new request promise
    const requestPromise = (async () => {
      try {
        if (!isMountedRef.current) return;
        
        setLoading(true);
        setError(null);

        // Try to get auth tokens (optional - project info might be public)
        let authenticatedApi = createPublicApiService();
        try {
          if (typeof window !== 'undefined') {
            const authTokens = localStorage.getItem("auth_tokens");
            if (authTokens) {
              const tokens = JSON.parse(authTokens);
              const authHeaders: Record<string, string> = {};
              if (tokens.session_token) {
                authHeaders["X-Session-Token"] = tokens.session_token;
              } else if (tokens.access_token && tokens.token_type) {
                authHeaders["Authorization"] = `${tokens.token_type} ${tokens.access_token}`;
              }
              if (Object.keys(authHeaders).length > 0) {
                authenticatedApi = createPublicApiService(authHeaders);
              }
            }
          }
        } catch (e) {
          clientLogger.debug("Failed to parse auth tokens for project context", {
            error: e instanceof Error ? e.message : String(e),
          });
        }

        projectService.setAuthApi(authenticatedApi);

        // Check cache first (unless force refresh)
        if (!forceRefresh) {
          const cached = await cache.get<ProjectInformation>(CACHE_KEY);
          if (cached !== null && isMountedRef.current) {
            clientLogger.debug("Project information loaded from cache", { fromCache: true });
            setProjectInfo(cached);
            setLoading(false);
            setIsReady(true);
            return;
          }
        }

        // Fetch from API with timeout protection
        const apiCallPromise = projectService.getProjectInformation();
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('API timeout')), 8000) // 8 second timeout
        );
        
        const response = await Promise.race([apiCallPromise, timeoutPromise]);

        // Check if still mounted before updating state
        if (!isMountedRef.current) return;

        if (response?.success && response.data) {
          // Handle both { project: {...} } and direct ProjectInformation formats
          const data = (response.data as any).project || response.data as ProjectInformation;
          await cache.set(CACHE_KEY, data, CACHE_DURATION);
          clientLogger.debug("Project information loaded from API and cached", { fromCache: false });
          setProjectInfo(data);
          setError(null);
        } else {
          // If API fails, try to use cached data as fallback
          const cached = await cache.get<ProjectInformation>(CACHE_KEY);
          if (cached !== null && isMountedRef.current) {
            clientLogger.warning("API failed, using cached project information", {
              apiError: response?.message || "Unknown error",
              usingCache: true,
            });
            setProjectInfo(cached);
            setError(null);
          } else if (isMountedRef.current) {
            throw new Error(response?.message || "Failed to fetch project information");
          }
        }
      } catch (err: unknown) {
        if (!isMountedRef.current) return;

        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        clientLogger.error("Error getting project information", {
          error: errorMessage,
          label: "GET_PROJECT_INFORMATION",
        });

        // Try to use cached data as fallback
        try {
          const cached = await cache.get<ProjectInformation>(CACHE_KEY);
          if (cached !== null && isMountedRef.current) {
            clientLogger.warning("Using cached project information after error", {
              error: errorMessage,
              usingCache: true,
            });
            setProjectInfo(cached);
            setError(null);
          } else if (isMountedRef.current) {
            setError(errorMessage);
          }
        } catch {
          if (isMountedRef.current) {
            setError(errorMessage);
          }
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setIsReady(true);
        }
        // Clear pending request
        pendingRequestRef.current = null;
      }
    })();

    // Store the promise to prevent duplicate requests
    pendingRequestRef.current = requestPromise;
    
    // Execute the request
    await requestPromise;
  }, []);

  /**
   * Refresh project information (force API call)
   */
  const refresh = useCallback(async () => {
    await fetchProjectInfo(true);
  }, [fetchProjectInfo]);

  // Set mounted flag and load project info
  useEffect(() => {
    isMountedRef.current = true;
    
    // Delay fetch to ensure component is fully mounted
    const timer = setTimeout(() => {
      if (isMountedRef.current) {
        void fetchProjectInfo();
      }
    }, 0);

    return () => {
      isMountedRef.current = false;
      clearTimeout(timer);
    };
  }, [fetchProjectInfo]);

  // Note: Removed periodic cache check to prevent repeated API calls
  // Cache is managed by the API route itself and client-side cache
  // Project info rarely changes, so no need for frequent refreshes

  return (
    <ProjectContext.Provider
      value={{
        projectInfo,
        loading,
        error,
        refresh,
        isReady,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}
