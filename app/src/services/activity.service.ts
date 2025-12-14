/**
 * Activity Service
 * Handles activity log API calls
 */

import { createPublicApiService } from '@lib/api/ApiServiceFactory';
import type { ApiService } from '@lib/api/ApiService';
import type { ActivityLog, ActivityLogFilters, ActivityLogStats } from '@models/activity.model';
import type { ApiResponse, PaginatedResponse } from '@models/api.model';

class ActivityService {
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
   * Get activity logs (caching handled by API middleware)
   */
  async getActivityLogs(filters?: ActivityLogFilters): Promise<PaginatedResponse<ActivityLog>> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }
    const query = params.toString();
    return await this.api.get<PaginatedResponse<ActivityLog>>(
      `/activity/logs${query ? `?${query}` : ''}`
    );
  }

  /**
   * Refresh activity logs (force API call, bypassing cache)
   */
  async refreshActivityLogs(filters?: ActivityLogFilters): Promise<PaginatedResponse<ActivityLog>> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }
    params.append('_refresh', String(Date.now()));
    const query = params.toString();
    return await this.api.get<PaginatedResponse<ActivityLog>>(
      `/activity/logs${query ? `?${query}` : ''}`
    );
  }

  /**
   * Get activity log by ID
   */
  async getActivityLogById(logId: string): Promise<ApiResponse<ActivityLog>> {
    return this.api.get<ApiResponse<ActivityLog>>(`/activity/logs/${logId}`);
  }

  /**
   * Get my activity logs
   */
  async getMyActivityLogs(filters?: ActivityLogFilters): Promise<PaginatedResponse<ActivityLog>> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }
    const query = params.toString();
    return this.api.get<PaginatedResponse<ActivityLog>>(
      `/activity/me/logs${query ? `?${query}` : ''}`
    );
  }

  /**
   * Get user activity logs
   */
  async getUserActivityLogs(
    userId: string,
    filters?: ActivityLogFilters
  ): Promise<PaginatedResponse<ActivityLog>> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }
    const query = params.toString();
    return this.api.get<PaginatedResponse<ActivityLog>>(
      `/activity/users/${userId}/logs${query ? `?${query}` : ''}`
    );
  }

  /**
   * Get activity statistics (caching handled by API middleware)
   */
  async getActivityStatistics(): Promise<ApiResponse<ActivityLogStats>> {
    return await this.api.get<ApiResponse<ActivityLogStats>>('/activity/statistics');
  }

  /**
   * Refresh activity statistics (force API call, bypassing cache)
   */
  async refreshActivityStatistics(): Promise<ApiResponse<ActivityLogStats>> {
    return await this.api.get<ApiResponse<ActivityLogStats>>('/activity/statistics?_refresh=' + Date.now());
  }

  /**
   * Delete activity log
   */
  async deleteActivityLog(logId: string): Promise<ApiResponse<void>> {
    return this.api.delete<ApiResponse<void>>(`/activity/logs/${logId}`);
  }

  /**
   * Cleanup old activity logs
   */
  async cleanupActivityLogs(days: number = 90): Promise<ApiResponse<{ deleted_count: number }>> {
    return this.api.post<ApiResponse<{ deleted_count: number }>>('/activity/logs/cleanup', {
      days,
    });
  }
}

// Export singleton instance
export const activityService = new ActivityService();

