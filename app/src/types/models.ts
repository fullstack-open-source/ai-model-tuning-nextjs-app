export interface IUser {
  user_id: string;
  created_at: string | Date | null;
  last_updated: string | Date | null;

  // Basic Information
  first_name?: string | null;
  last_name?: string | null;
  country?: string | null;
  gender?: string | null;
  dob?: string | Date | null;
  email?: string | null;
  profile_picture_url?: string | null;
  phone_number?: any | null;

  // Authentication
  auth_type?: string | null;
  is_email_verified?: boolean | null;
  is_phone_verified?: boolean | null;
  email_verified_at?: string | Date | null;
  phone_number_verified_at?: string | Date | null;
  last_sign_in_at?: string | Date | null;

  // Preferences
  bio?: string | null;
  theme?: string | null;
  profile_accessibility?: string | null;
  user_type?: string | null;
  user_name?: string | null;
  language?: string | null;

  // Status
  status?: string | null;
  timezone?: string | null;
  invited_by_user_id?: string | null;

  // Protection & Trash
  is_protected?: boolean | null;
  is_trashed?: boolean | null;

  // Status Model
  is_active?: boolean | null;
  is_verified?: boolean | null;

  // Relations
  userGroups?: IUserGroup[];
  assignedUserGroups?: IUserGroup[];
  activityLogs?: IActivityLog[];
}



export interface IPermission {
  permission_id: string;
  name: string;
  codename: string;
  description?: string | null;
  category?: string | null;
  created_at: string | Date | null;
  last_updated: string | Date | null;
}


export interface IGroup {
  group_id: string;
  name: string;
  codename: string;
  description?: string | null;
  is_system?: boolean | null;
  is_active?: boolean | null;
  created_at: string | Date | null;
  last_updated: string | Date | null;

  groupPermissions?: IGroupPermission[];
  userGroups?: IUserGroup[];
}


export interface IGroupPermission {
  id: string;
  group_id: string;
  permission_id: string;
  created_at: string | Date | null;

  group?: IGroup;
  permission?: IPermission;
}


export interface IActivityLog {
  log_id: string;
  user_id?: string | null;
  level: string;
  message: string;
  action?: string | null;
  module?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  device?: string | null;
  browser?: string | null;
  os?: string | null;
  platform?: string | null;
  endpoint?: string | null;
  method?: string | null;
  status_code?: number | null;
  request_id?: string | null;
  session_id?: string | null;
  metadata?: any | null;
  error_details?: any | null;
  duration_ms?: number | null;
  created_at: string | Date;

  user?: IUser | null;
}


export interface IUserGroup {
  id: string;
  user_id: string;
  group_id: string;
  assigned_at?: string | Date | null;
  assigned_by_user_id?: string | null;

  user?: IUser;
  group?: IGroup;
  assignedByUser?: IUser | null;
}



export interface IAuthUser {
  user_id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  user_name?: string | null;
  profile_picture_url?: string | null;

  // Roles & permissions
  groups?: IGroup[];
  permissions?: string[]; // list of codenames
}

export interface IAuthResponse {
  token: string;
  user: IAuthUser;
}


export type PermissionCodename =
  | string; // you can convert Prisma permissions to union type

export interface IUserPermissions {
  groups: IGroup[];
  permissions: PermissionCodename[];
}
