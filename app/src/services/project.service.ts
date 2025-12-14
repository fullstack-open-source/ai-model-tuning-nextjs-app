/**
 * Project Information Service
 * Handles project settings API calls
 */

import { createPublicApiService } from '@lib/api/ApiServiceFactory';
import type { ApiService } from '@lib/api/ApiService';
import type { ProjectInformation, ProjectInformationUpdate } from '@models/project.model';
import type { ApiResponse } from '@models/api.model';

class ProjectService {
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
   * Get project information (caching handled by API middleware)
   */
  async getProjectInformation(): Promise<ApiResponse<ProjectInformation>> {
    return await this.api.get<ApiResponse<ProjectInformation>>('/project/information');
  }

  /**
   * Refresh project information (force API call, bypassing cache)
   */
  async refreshProjectInformation(): Promise<ApiResponse<ProjectInformation>> {
    return await this.api.get<ApiResponse<ProjectInformation>>('/project/information?_refresh=' + Date.now());
  }

  /**
   * Update project information
   */
  async updateProjectInformation(
    data: ProjectInformationUpdate
  ): Promise<ApiResponse<ProjectInformation>> {
    return await this.api.patch<ApiResponse<ProjectInformation>>('/project/information', data);
  }

  /**
   * Create project information
   */
  async createProjectInformation(
    data: ProjectInformationUpdate
  ): Promise<ApiResponse<ProjectInformation>> {
    return this.api.post<ApiResponse<ProjectInformation>>('/project/information', data);
  }
}

// Export singleton instance
export const projectService = new ProjectService();

