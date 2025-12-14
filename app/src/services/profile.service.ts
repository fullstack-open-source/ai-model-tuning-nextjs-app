/**
 * Profile Service
 * Handles profile-related API calls with localStorage caching
 */

import { createPublicApiService } from '@lib/api/ApiServiceFactory';
import type { ApiService } from '@lib/api/ApiService';
import type { User } from '@models/user.model';
import type { ApiResponse } from '@models/api.model';

const PROFILE_STORAGE_KEY = 'user_profile';
const PROFILE_TIMESTAMP_KEY = 'user_profile_timestamp';
const PROFILE_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

class ProfileService {
  private api: ApiService;
  private pendingRequest: Promise<ApiResponse<User>> | null = null; // Prevent multiple simultaneous requests

  constructor() {
    this.api = createPublicApiService();
  }

  /**
   * Set authenticated API service
   */
  setAuthApi(api: ApiService) {
    this.api = api;
  }

  /**
   * Get profile from localStorage
   */
  private getProfileFromStorage(): User | null {
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
  private saveProfileToStorage(profile: User): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
      localStorage.setItem(PROFILE_TIMESTAMP_KEY, Date.now().toString());
    } catch (error) {
      console.error('Error saving profile to localStorage:', error);
    }
  }

  /**
   * Clear profile from localStorage
   */
  clearProfileCache(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(PROFILE_STORAGE_KEY);
    localStorage.removeItem(PROFILE_TIMESTAMP_KEY);
  }

  /**
   * Get profile from localStorage only (no API call)
   * Useful for quick access without triggering API calls
   */
  getProfileFromCache(): User | null {
    return this.getProfileFromStorage();
  }

  /**
   * Get current user profile
   * Priority: localStorage -> API (with Redis cache) -> Return
   * Only calls API if:
   * - forceRefresh is true
   * - Profile not in localStorage
   * - Profile cache expired
   * 
   * Prevents multiple simultaneous API calls by reusing pending request
   */
  async getProfile(forceRefresh: boolean = false): Promise<ApiResponse<User>> {
    // If not forcing refresh, try localStorage first
    if (!forceRefresh) {
      const cachedProfile = this.getProfileFromStorage();
      if (cachedProfile) {
        // Return cached profile immediately without API call
        return {
          success: true,
          message: 'Profile loaded from localStorage',
          data: cachedProfile,
        } as ApiResponse<User>;
      }
    }

    // If there's already a pending request, wait for it instead of making a new one
    if (this.pendingRequest) {
      return this.pendingRequest;
    }

    // Create new request and store it
    this.pendingRequest = (async () => {
      try {
        // Fetch from API (will use Redis cache on server side)
        const url = '/settings/profile'; // Don't use _refresh, let Redis handle caching
        const response = await this.api.get<ApiResponse<User>>(url);
        
        // Save to localStorage if successful
        if (response?.success && response.data) {
          this.saveProfileToStorage(response.data);
        }
        
        return response;
      } finally {
        // Clear pending request after completion
        this.pendingRequest = null;
      }
    })();
    
    return this.pendingRequest;
  }

  /**
   * Update profile and update localStorage
   */
  async updateProfile(data: Partial<User>): Promise<ApiResponse<User>> {
    const response = await this.api.post<ApiResponse<User>>('/settings/update-profile', data);
    
    // Update localStorage if successful
    if (response?.success && response.data) {
      this.saveProfileToStorage(response.data);
    }
    
    return response;
  }

  /**
   * Complete onboarding - sets password, updates profile, and marks as completed
   */
  async completeOnboarding(data: {
    password?: string;
    confirm_password?: string;
    first_name: string;
    last_name: string;
    user_name?: string;
    bio?: string;
    country?: string;
    gender?: string;
    dob?: string;
    phone_number?: string | { phone: string };
  }): Promise<ApiResponse<User>> {
    const response = await this.api.post<ApiResponse<User>>('/settings/complete-onboarding', data);
    
    // Update localStorage if successful
    if (response?.success && response.data) {
      this.saveProfileToStorage(response.data);
    }
    
    return response;
  }

  /**
   * Update profile picture
   */
  async updateProfilePicture(file: File): Promise<ApiResponse<{ profile_picture_url: string }>> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await this.api.post<ApiResponse<{ profile_picture_url: string }>>(
      '/settings/update-profile-picture',
      formData
    );
    
    // Refresh profile after picture update to get updated profile
    if (response?.success) {
      await this.getProfile(true); // Force refresh to get updated profile
    }
    
    return response;
  }

  /**
   * Change email
   */
  async changeEmail(email: string, otp: string): Promise<ApiResponse<void>> {
    return await this.api.post<ApiResponse<void>>('/settings/change-email', { email, otp });
  }

  /**
   * Change phone
   */
  async changePhone(phone: string, otp: string): Promise<ApiResponse<void>> {
    return await this.api.post<ApiResponse<void>>('/settings/change-phone', { phone, otp });
  }

  /**
   * Update profile accessibility
   */
  async updateProfileAccessibility(accessibility: 'public' | 'private'): Promise<ApiResponse<User>> {
    const response = await this.api.post<ApiResponse<User>>('/settings/profile-accessibility', {
      profile_accessibility: accessibility,
    });
    
    // Update localStorage if successful
    if (response?.success && response.data) {
      this.saveProfileToStorage(response.data);
    }
    
    return response;
  }

  /**
   * Update theme
   */
  async updateTheme(theme: 'light' | 'dark' | 'dynamic'): Promise<ApiResponse<User>> {
    const response = await this.api.post<ApiResponse<User>>('/settings/update-theme', { theme });
    
    // Update localStorage if successful
    if (response?.success && response.data) {
      this.saveProfileToStorage(response.data);
    }
    
    return response;
  }

  /**
   * Update language
   */
  async updateLanguage(language: string): Promise<ApiResponse<User>> {
    const response = await this.api.post<ApiResponse<User>>('/settings/profile-language', { language });
    
    // Update localStorage if successful
    if (response?.success && response.data) {
      this.saveProfileToStorage(response.data);
    }
    
    return response;
  }

  /**
   * Update timezone
   */
  async updateTimezone(timezone: string): Promise<ApiResponse<User>> {
    const response = await this.api.post<ApiResponse<User>>('/settings/update-timezone', { timezone });
    
    // Update localStorage if successful
    if (response?.success && response.data) {
      this.saveProfileToStorage(response.data);
    }
    
    return response;
  }

  /**
   * Deactivate account
   */
  async deactivateAccount(): Promise<ApiResponse<void>> {
    return this.api.post<ApiResponse<void>>('/settings/deactivate-account', {});
  }

  /**
   * Delete account
   */
  async deleteAccount(): Promise<ApiResponse<void>> {
    return this.api.post<ApiResponse<void>>('/settings/delete-account', {});
  }
}

// Export singleton instance
export const profileService = new ProfileService();

