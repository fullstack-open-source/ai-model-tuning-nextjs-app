/**
 * Dashboard Service
 * Handles all dashboard and analytics API calls
 */

import { createPublicApiService } from '@lib/api/ApiServiceFactory';
import type { ApiService } from '@lib/api/ApiService';
import type { DashboardOverview } from '@models/dashboard.model';
import type { ApiResponse } from '@models/api.model';

class DashboardService {
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
   * Get dashboard overview (caching handled by API middleware)
   */
  async getOverview(): Promise<ApiResponse<DashboardOverview>> {
    return await this.api.get<ApiResponse<DashboardOverview>>('/dashboard/overview');
  }

  /**
   * Refresh dashboard overview (force API call, bypassing cache)
   */
  async refreshOverview(): Promise<ApiResponse<DashboardOverview>> {
    // Add cache-busting parameter to force refresh
    return await this.api.get<ApiResponse<DashboardOverview>>('/dashboard/overview?_refresh=' + Date.now());
  }

  // Other endpoints kept without explicit typing to avoid over-constraining ApiResponse
  async getAllStatistics() {
    return this.api.get('/dashboard/all-statistics');
  }

  async getUserGrowth(days: number = 30) {
    return this.api.get(`/dashboard/user-growth?days=${days}`);
  }

  async getUsersByStatus() {
    return this.api.get('/dashboard/users-by-status');
  }

  async getUsersByType() {
    return this.api.get('/dashboard/users-by-type');
  }

  async getUsersByAuthType() {
    return this.api.get('/dashboard/users-by-auth-type');
  }

  async getUsersByCountry() {
    return this.api.get('/dashboard/users-by-country');
  }

  async getUsersByLanguage() {
    return this.api.get('/dashboard/users-by-language');
  }

  async getRoleStatistics() {
    return this.api.get('/dashboard/role-statistics');
  }

  async getRecentSignIns(limit: number = 10) {
    return this.api.get(`/dashboard/recent-sign-ins?limit=${limit}`);
  }

  async getNotificationsStats() {
    return this.api.get('/dashboard/notifications-stats');
  }

  async getActivityStats() {
    return this.api.get('/dashboard/activity-stats');
  }
}

// Export singleton instance
export const dashboardService = new DashboardService();

