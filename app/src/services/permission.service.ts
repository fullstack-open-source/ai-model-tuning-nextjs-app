/**
 * Permission Service
 * Handles permission and group-related API calls
 */

import { createPublicApiService } from '@lib/api/ApiServiceFactory';
import type { ApiService } from '@lib/api/ApiService';
import type { Permission } from '@models/permission.model';
import type { Group } from '@models/user.model';
import type { ApiResponse } from '@models/api.model';

class PermissionService {
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
   * Get all permissions (caching handled by API middleware)
   */
  async getPermissions(forceRefresh: boolean = false): Promise<ApiResponse<Permission[]>> {
    const url = forceRefresh 
      ? `/permissions?_refresh=${Date.now()}`
      : '/permissions';
    const response = await this.api.get<ApiResponse<{ permissions: Permission[] } | Permission[]>>(url);
    
    // Extract permissions from nested data structure
    if (response?.success && response.data) {
      let permissionsData: Permission[];
      
      // Handle nested structure: data.permissions or data (array)
      if (Array.isArray(response.data)) {
        permissionsData = response.data;
      } else if (typeof response.data === 'object' && 'permissions' in response.data) {
        permissionsData = (response.data as { permissions: Permission[] }).permissions || [];
      } else {
        permissionsData = [];
      }
      
      return {
        ...response,
        data: permissionsData,
      };
    }
    
    // Return empty array if response failed
    return {
      ...response,
      data: [],
    } as ApiResponse<Permission[]>;
  }

  /**
   * Get permission by ID
   */
  async getPermissionById(permissionId: string): Promise<ApiResponse<Permission>> {
    return this.api.get<ApiResponse<Permission>>(`/permissions/${permissionId}`);
  }

  /**
   * Create permission
   */
  async createPermission(data: Partial<Permission>): Promise<ApiResponse<Permission>> {
    return await this.api.post<ApiResponse<Permission>>('/permissions', data);
  }

  /**
   * Update permission
   */
  async updatePermission(permissionId: string, data: Partial<Permission>): Promise<ApiResponse<Permission>> {
    return await this.api.put<ApiResponse<Permission>>(`/permissions/${permissionId}`, data);
  }

  /**
   * Delete permission
   */
  async deletePermission(permissionId: string): Promise<ApiResponse<void>> {
    return await this.api.delete<ApiResponse<void>>(`/permissions/${permissionId}`);
  }

  /**
   * Get all groups (caching handled by API middleware)
   */
  async getGroups(forceRefresh: boolean = false): Promise<ApiResponse<Group[]>> {
    const url = forceRefresh 
      ? `/groups?_refresh=${Date.now()}`
      : '/groups';
    const response = await this.api.get<ApiResponse<{ groups: Group[] } | Group[]>>(url);
    
    // Extract groups from nested data structure
    if (response?.success && response.data) {
      let groupsData: Group[];
      
      // Handle nested structure: data.groups or data (array)
      if (Array.isArray(response.data)) {
        groupsData = response.data;
      } else if (typeof response.data === 'object' && 'groups' in response.data) {
        groupsData = (response.data as { groups: Group[] }).groups || [];
      } else {
        groupsData = [];
      }
      
      return {
        ...response,
        data: groupsData,
      };
    }
    
    // Return empty array if response failed
    return {
      ...response,
      data: [],
    } as ApiResponse<Group[]>;
  }

  /**
   * Get group by ID
   */
  async getGroupById(groupId: string): Promise<ApiResponse<Group>> {
    return this.api.get<ApiResponse<Group>>(`/groups/${groupId}`);
  }

  /**
   * Create group
   */
  async createGroup(data: Partial<Group>): Promise<ApiResponse<Group>> {
    return await this.api.post<ApiResponse<Group>>('/groups', data);
  }

  /**
   * Update group
   */
  async updateGroup(groupId: string, data: Partial<Group>): Promise<ApiResponse<Group>> {
    return await this.api.patch<ApiResponse<Group>>(`/groups/${groupId}`, data);
  }

  /**
   * Delete group
   */
  async deleteGroup(groupId: string): Promise<ApiResponse<void>> {
    return await this.api.delete<ApiResponse<void>>(`/groups/${groupId}`);
  }

  /**
   * Assign permissions to group
   */
  async assignPermissionsToGroup(
    groupId: string,
    permissionIds: string[]
  ): Promise<ApiResponse<Group>> {
    return await this.api.post<ApiResponse<Group>>(`/groups/${groupId}/permissions`, {
      permission_ids: permissionIds,
    });
  }

  /**
   * Get user groups
   */
  async getUserGroups(userId: string): Promise<ApiResponse<Group[]>> {
    return this.api.get<ApiResponse<Group[]>>(`/users/${userId}/groups`);
  }

  /**
   * Get current user groups (caching handled by API middleware)
   */
  async getMyGroups(forceRefresh: boolean = false): Promise<ApiResponse<Group[]>> {
    const url = forceRefresh 
      ? `/users/me/groups?_refresh=${Date.now()}`
      : '/users/me/groups';
    const response = await this.api.get<ApiResponse<{ groups: Group[] } | Group[]>>(url);
    
    // Debug logging in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[PermissionService] getMyGroups response:', {
        success: response?.success,
        dataType: typeof response?.data,
        hasGroupsKey: response?.data && typeof response.data === 'object' && 'groups' in response.data,
      });
    }
    
    // Extract groups from nested data structure
    // API returns: { success: true, data: { groups: [...] } }
    if (response?.success && response.data) {
      let groupsData: Group[];
      const data = response.data as any;
      
      // Handle nested structure: data.groups (most common from API)
      if (typeof data === 'object' && data !== null && 'groups' in data) {
        groupsData = data.groups || [];
      } else if (Array.isArray(data)) {
        // Direct array: data = [...] (fallback)
        groupsData = data;
      } else {
        groupsData = [];
      }
      
      // Ensure each group has codename (normalize the data)
      groupsData = groupsData.map(g => ({
        ...g,
        codename: g?.codename || g?.name?.toLowerCase().replace(/\s+/g, '_') || g?.name || '',
      }));
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[PermissionService] Extracted groups:', groupsData.map(g => g.codename));
      }
      
      return {
        ...response,
        data: groupsData,
      };
    }
    
    return { ...response, data: [] } as ApiResponse<Group[]>;
  }

  /**
   * Assign groups to user (replaces all existing groups)
   * @param userId - User ID
   * @param groupCodenames - Array of group codenames (e.g., ['user', 'admin'])
   */
  async assignGroupsToUser(
    userId: string,
    groupCodenames: string[]
  ): Promise<ApiResponse<void>> {
    return await this.api.post<ApiResponse<void>>(`/users/${userId}/groups`, {
      group_codenames: groupCodenames,
    });
  }
  
  /**
   * Remove all groups from user (assigns empty array)
   * This effectively removes all access
   */
  async removeAllGroupsFromUser(userId: string): Promise<ApiResponse<void>> {
    return this.assignGroupsToUser(userId, []);
  }

  /**
   * Get user permissions
   */
  async getUserPermissions(userId: string): Promise<ApiResponse<string[]>> {
    return this.api.get<ApiResponse<string[]>>(`/users/${userId}/permissions`);
  }

  /**
   * Get current user permissions (caching handled by API middleware)
   */
  async getMyPermissions(forceRefresh: boolean = false): Promise<ApiResponse<string[]>> {
    const url = forceRefresh 
      ? `/users/me/permissions?_refresh=${Date.now()}`
      : '/users/me/permissions';
    const response = await this.api.get<ApiResponse<{ permissions: string[] } | string[]>>(url);
    
    // Debug logging in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[PermissionService] getMyPermissions response:', {
        success: response?.success,
        dataType: typeof response?.data,
        hasPermissionsKey: response?.data && typeof response.data === 'object' && 'permissions' in response.data,
      });
    }
    
    // Extract permissions from nested data structure
    // API returns: { success: true, data: { permissions: [...] } }
    if (response?.success && response.data) {
      let permissionsData: string[];
      const data = response.data as any;
      
      // Handle nested structure: data.permissions (most common from API)
      if (typeof data === 'object' && data !== null && 'permissions' in data) {
        const perms = data.permissions || [];
        // Handle array of strings or objects
        permissionsData = perms.map((p: any) => 
          typeof p === 'string' ? p : (p.codename || p.permission_codename || String(p))
        ).filter(Boolean);
      } else if (Array.isArray(data)) {
        // Direct array: data = [...] (fallback)
        if (data.length > 0 && typeof data[0] === 'string') {
          permissionsData = data;
        } else {
          // Extract codenames from permission objects
          permissionsData = data.map((p: any) => 
            typeof p === 'string' ? p : (p.codename || p.permission_codename || String(p))
          ).filter(Boolean);
        }
      } else {
        permissionsData = [];
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[PermissionService] Extracted permissions:', permissionsData.length);
      }
      
      return {
        ...response,
        data: permissionsData,
      };
    }
    
    return { ...response, data: [] } as ApiResponse<string[]>;
  }

  /**
   * Get groups statistics (caching handled by API middleware)
   */
  async getGroupsStatistics(forceRefresh: boolean = false): Promise<ApiResponse<any>> {
    const url = forceRefresh 
      ? `/groups/statistics?_refresh=${Date.now()}`
      : '/groups/statistics';
    return await this.api.get<ApiResponse<{ statistics: any }>>(url);
  }

  /**
   * Get permissions statistics (caching handled by API middleware)
   */
  async getPermissionsStatistics(forceRefresh: boolean = false): Promise<ApiResponse<any>> {
    const url = forceRefresh 
      ? `/permissions/statistics?_refresh=${Date.now()}`
      : '/permissions/statistics';
    return await this.api.get<ApiResponse<{ statistics: any }>>(url);
  }
}

// Export singleton instance
export const permissionService = new PermissionService();

