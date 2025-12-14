/**
 * PermissionGuard Component
 * Conditionally renders children based on user permissions or groups
 */

"use client";

import { ReactNode } from "react";
import { usePermissions } from "@hooks/usePermissions";

interface PermissionGuardProps {
  children: ReactNode;
  requirePermission?: string | string[];
  requireAnyPermission?: string[];
  requireAllPermissions?: string[];
  requireGroup?: string | string[];
  requireAnyGroup?: string[];
  requireSuperAdmin?: boolean;
  requireAdmin?: boolean;
  fallback?: ReactNode;
}

export function PermissionGuard({
  children,
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  requireGroup,
  requireAnyGroup,
  requireSuperAdmin,
  requireAdmin,
  fallback = null,
}: PermissionGuardProps) {
  const {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasGroup,
    hasAnyGroup,
    isSuperAdmin,
    isAdmin,
  } = usePermissions();

  // Check super admin requirement
  if (requireSuperAdmin && !isSuperAdmin) {
    return <>{fallback}</>;
  }

  // Check admin requirement (super_admin or admin)
  if (requireAdmin && !isAdmin) {
    return <>{fallback}</>;
  }

  // Check single permission
  if (requirePermission) {
    const permissions = Array.isArray(requirePermission) ? requirePermission : [requirePermission];
    if (!hasAllPermissions(permissions)) {
      return <>{fallback}</>;
    }
  }

  // Check any permission
  if (requireAnyPermission && requireAnyPermission.length > 0) {
    if (!hasAnyPermission(requireAnyPermission)) {
      return <>{fallback}</>;
    }
  }

  // Check all permissions
  if (requireAllPermissions && requireAllPermissions.length > 0) {
    if (!hasAllPermissions(requireAllPermissions)) {
      return <>{fallback}</>;
    }
  }

  // Check single group
  if (requireGroup) {
    const groups = Array.isArray(requireGroup) ? requireGroup : [requireGroup];
    if (!groups.some((g) => hasGroup(g))) {
      return <>{fallback}</>;
    }
  }

  // Check any group
  if (requireAnyGroup && requireAnyGroup.length > 0) {
    if (!hasAnyGroup(requireAnyGroup)) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
}

