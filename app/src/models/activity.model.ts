/**
 * Activity Log Model
 * Defines activity logging data structures
 */

export interface ActivityLog {
  log_id: string;
  user_id?: string | null;
  level: 'info' | 'warn' | 'error' | 'debug' | 'audit';
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
  metadata?: Record<string, any> | null;
  error_details?: Record<string, any> | null;
  duration_ms?: number | null;
  created_at: string | Date;
  user?: any;
}

export interface ActivityLogFilters {
  user_id?: string;
  level?: ActivityLog['level'];
  action?: string;
  module?: string;
  start_date?: string | Date;
  end_date?: string | Date;
  limit?: number;
  offset?: number;
}

export interface ActivityLogStats {
  total_logs: number;
  by_level: Record<string, number>;
  by_module: Record<string, number>;
  by_action: Record<string, number>;
}

