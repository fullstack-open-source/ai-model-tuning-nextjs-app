/**
 * User Service
 * Handles all user-related API calls
 */

import { createPublicApiService } from '@lib/api/ApiServiceFactory';
import type { ApiService } from '@lib/api/ApiService';
import type { User, UserStats } from '@models/user.model';
import type { ApiResponse, PaginatedResponse } from '@models/api.model';

class UserService {
  private api: ApiService;

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
   * Get current user profile
   */
  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this.api.get<ApiResponse<User>>('/settings/profile');
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<ApiResponse<User>> {
    return this.api.get<ApiResponse<User>>(`/settings/profile/${userId}`);
  }

  /**
   * Update user profile
   */
  async updateProfile(data: Partial<User>): Promise<ApiResponse<User>> {
    return this.api.patch<ApiResponse<User>>('/settings/update-profile', data);
  }

  /**
   * Update profile picture
   */
  async updateProfilePicture(file: File): Promise<ApiResponse<{ profile_picture_url: string }>> {
    const formData = new FormData();
    formData.append('file', file);
    return this.api.post<ApiResponse<{ profile_picture_url: string }>>(
      '/settings/update-profile-picture',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
  }

  /**
   * Get user statistics
   */
  async getUserStats(): Promise<ApiResponse<UserStats>> {
    return this.api.get<ApiResponse<UserStats>>('/dashboard/users-by-status');
  }

  /**
   * Get all users with filters and pagination
   */
  async getUsers(filters?: {
    page?: number;
    limit?: number;
    search?: string;
    auth_type?: string;
    status?: string;
    gender?: string;
    is_active?: boolean;
    is_verified?: boolean;
  }): Promise<PaginatedResponse<User>> {
    const params = new URLSearchParams();
    
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));
    if (filters?.search) params.append('search', filters.search);
    if (filters?.auth_type) params.append('auth_type', filters.auth_type);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.gender) params.append('gender', filters.gender);
    if (filters?.is_active !== undefined) params.append('is_active', String(filters.is_active));
    if (filters?.is_verified !== undefined) params.append('is_verified', String(filters.is_verified));

    const query = params.toString();
    const response = await this.api.get<ApiResponse<User[]> & { meta?: { pagination?: { page: number; limit: number; total: number; total_pages: number } } }>(`/users${query ? `?${query}` : ''}`);
    
    // Transform response to PaginatedResponse format
    if (response?.success && response.data) {
      return {
        success: true,
        message: response.message || 'Users retrieved successfully',
        data: Array.isArray(response.data) ? response.data : [],
        pagination: response.meta?.pagination || {
          page: filters?.page || 1,
          limit: filters?.limit || 50,
          total: 0,
          total_pages: 1,
        },
      };
    }
    
    return {
      success: false,
      message: response?.message || 'Failed to retrieve users',
      data: [],
      pagination: {
        page: filters?.page || 1,
        limit: filters?.limit || 50,
        total: 0,
        total_pages: 1,
      },
    };
  }

  /**
   * Refresh users list (force API call, bypassing cache)
   */
  async refreshUsers(filters?: {
    page?: number;
    limit?: number;
    search?: string;
    auth_type?: string;
    status?: string;
    gender?: string;
    is_active?: boolean;
    is_verified?: boolean;
  }): Promise<PaginatedResponse<User>> {
    const params = new URLSearchParams();
    
    // Add cache-busting parameter
    params.append('_refresh', String(Date.now()));
    
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));
    if (filters?.search) params.append('search', filters.search);
    if (filters?.auth_type) params.append('auth_type', filters.auth_type);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.gender) params.append('gender', filters.gender);
    if (filters?.is_active !== undefined) params.append('is_active', String(filters.is_active));
    if (filters?.is_verified !== undefined) params.append('is_verified', String(filters.is_verified));

    const query = params.toString();
    const response = await this.api.get<ApiResponse<User[]> & { meta?: { pagination?: { page: number; limit: number; total: number; total_pages: number } } }>(`/users?${query}`);
    
    // Transform response to PaginatedResponse format
    if (response?.success && response.data) {
      return {
        success: true,
        message: response.message || 'Users retrieved successfully',
        data: Array.isArray(response.data) ? response.data : [],
        pagination: response.meta?.pagination || {
          page: filters?.page || 1,
          limit: filters?.limit || 50,
          total: 0,
          total_pages: 1,
        },
      };
    }
    
    return {
      success: false,
      message: response?.message || 'Failed to retrieve users',
      data: [],
      pagination: {
        page: filters?.page || 1,
        limit: filters?.limit || 50,
        total: 0,
        total_pages: 1,
      },
    };
  }

  /**
   * Create new user
   */
  async createUser(data: {
    email?: string;
    phone_number?: { phone: string; country_code?: string };
    password: string;
    first_name?: string;
    last_name?: string;
    user_name?: string;
    auth_type?: string;
    status?: string;
    gender?: string;
    country?: string;
    user_type?: string;
    is_email_verified?: boolean;
    is_phone_verified?: boolean;
  }): Promise<ApiResponse<User>> {
    return this.api.post<ApiResponse<User>>('/users', data);
  }

  /**
   * Update user status
   */
  async updateUserStatus(userId: string, status: string): Promise<ApiResponse<User>> {
    return this.api.patch<ApiResponse<User>>(`/users/${userId}`, { status });
  }

  /**
   * Delete user
   */
  async deleteUser(userId: string): Promise<ApiResponse<void>> {
    return this.api.delete<ApiResponse<void>>(`/users/${userId}`);
  }

  /**
   * Update user (admin)
   */
  async updateUser(userId: string, data: Partial<User>): Promise<ApiResponse<User>> {
    return this.api.patch<ApiResponse<User>>(`/users/${userId}`, data);
  }
}

// Export singleton instance
export const userService = new UserService();

