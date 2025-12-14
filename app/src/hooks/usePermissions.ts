/**
 * usePermissions Hook
 * Provides permission checking utilities based on user's groups and permissions
 */

import { useAuth } from "@context/AuthContext";
import { useMemo, useCallback, useEffect, useState } from "react";
import { permissionService } from "@services/permission.service";
import { createPublicApiService } from "@lib/api/ApiServiceFactory";

export function usePermissions() {
  const { groups, permissions, tokens, updatePermissions } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Ensure groups and permissions are always arrays
  const safeGroups = useMemo(() => {
    if (!Array.isArray(groups)) return [];
    // Ensure each group has a codename (normalize the data)
    return groups.map(g => ({
      ...g,
      codename: g?.codename || g?.name?.toLowerCase().replace(/\s+/g, '_') || g?.name || '',
    }));
  }, [groups]);

  const safePermissions = useMemo(() => {
    if (!Array.isArray(permissions)) return [];
    // Handle both string[] and object[] formats
    return permissions.map(p => {
      if (typeof p === 'string') return p;
      if (typeof p === 'object' && p !== null) {
        return (p as any).codename || (p as any).permission_codename || String(p);
      }
      return String(p);
    }).filter(Boolean);
  }, [permissions]);

  /**
   * Force refresh permissions and groups from the server
   */
  const refreshPermissions = useCallback(async () => {
    if (isRefreshing) return;
    
    try {
      setIsRefreshing(true);
      
      // Build auth headers
      const headers: Record<string, string> = {};
      if (tokens.session_token) {
        headers["X-Session-Token"] = tokens.session_token;
      } else if (tokens.access_token && tokens.token_type) {
        headers["Authorization"] = `${tokens.token_type} ${tokens.access_token}`;
      }
      
      const authedApi = createPublicApiService(headers);
      permissionService.setAuthApi(authedApi);
      
      // Force refresh from server (bypass cache)
      const [groupsResponse, permissionsResponse] = await Promise.all([
        permissionService.getMyGroups(true),
        permissionService.getMyPermissions(true),
      ]);
      
      const newGroups = Array.isArray(groupsResponse?.data) ? groupsResponse.data : [];
      const newPermissions = Array.isArray(permissionsResponse?.data) ? permissionsResponse.data : [];
      
      // Update context and localStorage
      updatePermissions(newGroups, newPermissions);
      
      console.log('🔄 Permissions refreshed:', {
        groups: newGroups.map((g: any) => g?.codename),
        permissionCount: newPermissions.length,
      });
      
      return { groups: newGroups, permissions: newPermissions };
    } catch (error) {
      console.error('Failed to refresh permissions:', error);
      return null;
    } finally {
      setIsRefreshing(false);
    }
  }, [tokens, updatePermissions, isRefreshing]);

  /**
   * Check if user has a specific permission (by codename)
   */
  const hasPermission = useCallback((permissionCodename: string): boolean => {
    if (!safePermissions || safePermissions.length === 0) return false;
    return safePermissions.includes(permissionCodename);
  }, [safePermissions]);

  /**
   * Check if user has any of the specified permissions
   */
  const hasAnyPermission = useCallback((permissionCodenames: string[]): boolean => {
    if (!safePermissions || safePermissions.length === 0) return false;
    return permissionCodenames.some((codename) => safePermissions.includes(codename));
  }, [safePermissions]);

  /**
   * Check if user has all of the specified permissions
   */
  const hasAllPermissions = useCallback((permissionCodenames: string[]): boolean => {
    if (!safePermissions || safePermissions.length === 0) return false;
    return permissionCodenames.every((codename) => safePermissions.includes(codename));
  }, [safePermissions]);

  /**
   * Check if user belongs to a specific group (by codename)
   */
  const hasGroup = useCallback((groupCodename: string): boolean => {
    if (!Array.isArray(safeGroups) || safeGroups.length === 0) return false;
    // Check both codename and name (case-insensitive for name)
    return safeGroups.some((group) => 
      group?.codename === groupCodename || 
      group?.name?.toLowerCase().replace(/\s+/g, '_') === groupCodename
    );
  }, [safeGroups]);

  /**
   * Check if user belongs to any of the specified groups
   */
  const hasAnyGroup = useCallback((groupCodenames: string[]): boolean => {
    if (!Array.isArray(safeGroups) || safeGroups.length === 0) return false;
    return groupCodenames.some((codename) => 
      safeGroups.some((g) => 
        g?.codename === codename || 
        g?.name?.toLowerCase().replace(/\s+/g, '_') === codename
      )
    );
  }, [safeGroups]);

  /**
   * Check if user is super admin
   */
  const isSuperAdmin = useMemo(() => {
    return hasGroup("super_admin");
  }, [hasGroup]);

  /**
   * Check if user is admin (super_admin or admin group)
   */
  const isAdmin = useMemo(() => {
    return hasAnyGroup(["super_admin", "admin"]);
  }, [hasAnyGroup]);

  // Debug log in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && (safeGroups.length > 0 || safePermissions.length > 0)) {
      console.log('🔐 usePermissions state:', {
        groups: safeGroups.map(g => ({ name: g.name, codename: g.codename })),
        permissionCount: safePermissions.length,
        isSuperAdmin,
        isAdmin,
      });
    }
  }, [safeGroups, safePermissions, isSuperAdmin, isAdmin]);

  return {
    groups: safeGroups,
    permissions: safePermissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasGroup,
    hasAnyGroup,
    isSuperAdmin,
    isAdmin,
    refreshPermissions,
    isRefreshing,
  };
}

