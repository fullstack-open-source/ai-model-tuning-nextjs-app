/**
 * usePermissionCheck Hook
 * Provides permission checking utilities for conditional logic and API calls
 */

import { usePermissions } from "./usePermissions";
import { useMemo } from "react";

export function usePermissionCheck() {
  const {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasGroup,
    hasAnyGroup,
    isSuperAdmin,
    isAdmin,
  } = usePermissions();

  /**
   * Check if user can perform an action based on permission requirements
   */
  const canPerformAction = useMemo(() => {
    return (options: {
      requirePermission?: string | string[];
      requireAnyPermission?: string[];
      requireAllPermissions?: string[];
      requireGroup?: string | string[];
      requireAnyGroup?: string[];
      requireSuperAdmin?: boolean;
      requireAdmin?: boolean;
    }): boolean => {
      const {
        requirePermission,
        requireAnyPermission,
        requireAllPermissions,
        requireGroup,
        requireAnyGroup,
        requireSuperAdmin,
        requireAdmin,
      } = options;

      // Check super admin requirement
      if (requireSuperAdmin && !isSuperAdmin) {
        return false;
      }

      // Check admin requirement
      if (requireAdmin && !isAdmin) {
        return false;
      }

      // Check single permission
      if (requirePermission) {
        const permissions = Array.isArray(requirePermission) ? requirePermission : [requirePermission];
        if (!hasAllPermissions(permissions)) {
          return false;
        }
      }

      // Check any permission
      if (requireAnyPermission && requireAnyPermission.length > 0) {
        if (!hasAnyPermission(requireAnyPermission)) {
          return false;
        }
      }

      // Check all permissions
      if (requireAllPermissions && requireAllPermissions.length > 0) {
        if (!hasAllPermissions(requireAllPermissions)) {
          return false;
        }
      }

      // Check single group
      if (requireGroup) {
        const groups = Array.isArray(requireGroup) ? requireGroup : [requireGroup];
        if (!groups.some((g) => hasGroup(g))) {
          return false;
        }
      }

      // Check any group
      if (requireAnyGroup && requireAnyGroup.length > 0) {
        if (!hasAnyGroup(requireAnyGroup)) {
          return false;
        }
      }

      return true;
    };
  }, [
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasGroup,
    hasAnyGroup,
    isSuperAdmin,
    isAdmin,
  ]);

  return {
    canPerformAction,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasGroup,
    hasAnyGroup,
    isSuperAdmin,
    isAdmin,
  };
}

