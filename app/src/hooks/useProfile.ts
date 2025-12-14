/**
 * useProfile Hook
 * Manages user profile data with localStorage caching
 * Only calls API when necessary (cache expired or force refresh)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { profileService } from '@services/profile.service';
import type { User } from '@models/user.model';
import type { ApiResponse } from '@models/api.model';

const PROFILE_STORAGE_KEY = 'user_profile';
const PROFILE_TIMESTAMP_KEY = 'user_profile_timestamp';
const PROFILE_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

interface UseProfileReturn {
  profile: User | null;
  loading: boolean;
  error: string | null;
  refresh: (force?: boolean) => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

/**
 * Get profile from localStorage
 */
function getProfileFromStorage(): User | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(PROFILE_STORAGE_KEY);
    const timestamp = localStorage.getItem(PROFILE_TIMESTAMP_KEY);
    
    if (!stored || !timestamp) return null;
    
    // Check if cache is still valid (within 15 minutes)
    const cacheAge = Date.now() - parseInt(timestamp, 10);
    if (cacheAge > PROFILE_CACHE_DURATION) {
      // Cache expired, remove it
      localStorage.removeItem(PROFILE_STORAGE_KEY);
      localStorage.removeItem(PROFILE_TIMESTAMP_KEY);
      return null;
    }
    
    return JSON.parse(stored) as User;
  } catch (error) {
    console.error('Error reading profile from localStorage:', error);
    return null;
  }
}

/**
 * Save profile to localStorage
 */
function saveProfileToStorage(profile: User): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    localStorage.setItem(PROFILE_TIMESTAMP_KEY, Date.now().toString());
  } catch (error) {
    console.error('Error saving profile to localStorage:', error);
  }
}

/**
 * Hook to manage user profile with localStorage caching
 */
export function useProfile(apiService?: any, autoLoad: boolean = true): UseProfileReturn {
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  // Load profile from localStorage on mount
  useEffect(() => {
    if (autoLoad && !profile && !loadingRef.current) {
      const cachedProfile = getProfileFromStorage();
      if (cachedProfile) {
        setProfile(cachedProfile);
      }
    }
  }, [autoLoad, profile]);

  // Refresh profile (from localStorage or API)
  const refresh = useCallback(async (force: boolean = false) => {
    // Prevent multiple simultaneous calls
    if (loadingRef.current) return;
    
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      // If not forcing, try localStorage first
      if (!force) {
        const cachedProfile = getProfileFromStorage();
        if (cachedProfile) {
          setProfile(cachedProfile);
          setLoading(false);
          loadingRef.current = false;
          return;
        }
      }

      // Set API service if provided
      if (apiService) {
        profileService.setAuthApi(apiService);
      }

      // Fetch from API (will use Redis cache on server side)
      const response = await profileService.getProfile(force);
      
      if (response?.success && response.data) {
        setProfile(response.data);
        saveProfileToStorage(response.data);
      } else {
        throw new Error(response?.message || 'Failed to fetch profile');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [apiService]);

  // Update profile
  const updateProfile = useCallback(async (data: Partial<User>) => {
    if (!apiService) {
      throw new Error('API service not available');
    }

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      profileService.setAuthApi(apiService);
      const response = await profileService.updateProfile(data);
      
      if (response?.success && response.data) {
        setProfile(response.data);
        saveProfileToStorage(response.data);
      } else {
        throw new Error(response?.message || 'Failed to update profile');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [apiService]);

  // Auto-load on mount if enabled
  useEffect(() => {
    if (autoLoad && apiService && !profile && !loadingRef.current) {
      // Try localStorage first
      const cachedProfile = getProfileFromStorage();
      if (cachedProfile) {
        setProfile(cachedProfile);
      } else {
        // Only call API if no cache
        refresh(false);
      }
    }
  }, [autoLoad, apiService, profile, refresh]);

  return {
    profile,
    loading,
    error,
    refresh,
    updateProfile,
  };
}

