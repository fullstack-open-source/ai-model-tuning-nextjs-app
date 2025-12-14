/**
 * Permission Model
 * Defines permission and group-related data structures
 */

import type { Group } from './user.model';

export interface Permission {
  permission_id: string;
  name: string;
  codename: string;
  description?: string | null;
  category?: string | null;
  created_at?: string | Date | null;
  last_updated?: string | Date | null;
}

export interface GroupPermission {
  id: string;
  group_id: string;
  permission_id: string;
  created_at?: string | Date | null;
  group?: Group;
  permission?: Permission;
}

export interface UserGroup {
  id: string;
  user_id: string;
  group_id: string;
  assigned_at?: string | Date | null;
  assigned_by_user_id?: string | null;
  user?: any;
  group?: Group;
  assignedByUser?: any;
}

export interface PermissionCategory {
  category: string;
  permissions: Permission[];
}

