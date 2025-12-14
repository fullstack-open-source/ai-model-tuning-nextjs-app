/**
 * Dashboard Model
 * Defines dashboard and analytics data structures
 */

export interface DashboardStats {
  total_users: number;
  active_users: number;
  inactive_users: number;
  total_groups: number;
  total_permissions: number;
  recent_sign_ins: number;
}

export interface UserGrowthData {
  date: string;
  count: number;
  cumulative: number;
}

export interface UserByStatus {
  status: string;
  count: number;
}

export interface UserByType {
  user_type: string;
  count: number;
}

export interface UserByAuthType {
  auth_type: string;
  count: number;
}

export interface UserByCountry {
  country: string;
  count: number;
}

export interface UserByLanguage {
  language: string;
  count: number;
}

export interface RoleStatistics {
  role: string;
  count: number;
  percentage: number;
}

export interface RecentSignIn {
  user_id: string;
  email?: string | null;
  user_name?: string | null;
  last_sign_in_at: string | Date;
  ip_address?: string | null;
  device?: string | null;
}

export interface DashboardOverview {
  stats: DashboardStats;
  user_growth: UserGrowthData[];
  users_by_status: UserByStatus[];
  users_by_type: UserByType[];
  users_by_auth_type: UserByAuthType[];
  users_by_country: UserByCountry[];
  users_by_language: UserByLanguage[];
  role_statistics: RoleStatistics[];
  recent_sign_ins: RecentSignIn[];
}

