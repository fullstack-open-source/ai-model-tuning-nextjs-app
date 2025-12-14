/**
 * PermissionButton Component
 * Renders a button that is disabled or hidden based on user permissions
 */

"use client";

import { ReactNode } from "react";
import { Button, ButtonProps } from "@components/ui/button";
import { usePermissions } from "@hooks/usePermissions";
import { cn } from "@lib/utils";

interface PermissionButtonProps extends ButtonProps {
  /**
   * Required permission(s) - user must have ALL if array
   */
  requirePermission?: string | string[];
  /**
   * User must have ANY of these permissions
   */
  requireAnyPermission?: string[];
  /**
   * User must have ALL of these permissions
   */
  requireAllPermissions?: string[];
  /**
   * Required group(s)
   */
  requireGroup?: string | string[];
  /**
   * User must belong to ANY of these groups
   */
  requireAnyGroup?: string[];
  /**
   * Require super admin
   */
  requireSuperAdmin?: boolean;
  /**
   * Require admin (super_admin or admin group)
   */
  requireAdmin?: boolean;
  /**
   * If true, hide button instead of disabling it
   */
  hideIfNoPermission?: boolean;
  /**
   * Custom disabled message tooltip
   */
  disabledTooltip?: string;
  /**
   * Children to render
   */
  children: ReactNode;
}

export function PermissionButton({
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  requireGroup,
  requireAnyGroup,
  requireSuperAdmin,
  requireAdmin,
  hideIfNoPermission = false,
  disabledTooltip,
  children,
  className,
  ...buttonProps
}: PermissionButtonProps) {
  const {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasGroup,
    hasAnyGroup,
    isSuperAdmin,
    isAdmin,
  } = usePermissions();

  // Check permissions
  let hasAccess = true;

  // Check super admin requirement
  if (requireSuperAdmin && !isSuperAdmin) {
    hasAccess = false;
  }

  // Check admin requirement
  if (requireAdmin && !isAdmin) {
    hasAccess = false;
  }

  // Check single permission
  if (requirePermission && hasAccess) {
    const permissions = Array.isArray(requirePermission) ? requirePermission : [requirePermission];
    if (!hasAllPermissions(permissions)) {
      hasAccess = false;
    }
  }

  // Check any permission
  if (requireAnyPermission && requireAnyPermission.length > 0 && hasAccess) {
    if (!hasAnyPermission(requireAnyPermission)) {
      hasAccess = false;
    }
  }

  // Check all permissions
  if (requireAllPermissions && requireAllPermissions.length > 0 && hasAccess) {
    if (!hasAllPermissions(requireAllPermissions)) {
      hasAccess = false;
    }
  }

  // Check single group
  if (requireGroup && hasAccess) {
    const groups = Array.isArray(requireGroup) ? requireGroup : [requireGroup];
    if (!groups.some((g) => hasGroup(g))) {
      hasAccess = false;
    }
  }

  // Check any group
  if (requireAnyGroup && requireAnyGroup.length > 0 && hasAccess) {
    if (!hasAnyGroup(requireAnyGroup)) {
      hasAccess = false;
    }
  }

  // Hide button if no permission and hideIfNoPermission is true
  if (!hasAccess && hideIfNoPermission) {
    return null;
  }

  // Disable button if no permission
  const isDisabled = !hasAccess || buttonProps.disabled;

  return (
    <Button
      {...buttonProps}
      disabled={isDisabled}
      className={cn(
        className,
        !hasAccess && "opacity-50 cursor-not-allowed"
      )}
      title={!hasAccess && disabledTooltip ? disabledTooltip : buttonProps.title}
    >
      {children}
    </Button>
  );
}

