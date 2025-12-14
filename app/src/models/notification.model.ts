/**
 * Notification Model
 */

export interface Notification {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  status: string;
  priority: string;
  action_url?: string | null;
  action_text?: string | null;
  icon_class?: string | null;
  metadata?: Record<string, unknown> | null;
  read_at?: string | null;
  created_at: string;
  last_updated: string;
  read_by_id?: string | null;
  user_id?: string | null; // User who receives the notification (null for system-wide notifications)
  created_by_id?: string | null; // User who created the notification
}

export interface NotificationCreateInput {
  title: string;
  message: string;
  notification_type: string;
  status?: string;
  priority?: string;
  action_url?: string;
  action_text?: string;
  icon_class?: string;
  metadata?: Record<string, unknown>;
  user_id?: string; // Optional: user_id to send notification to specific user (admin only)
}

export interface NotificationUpdateInput {
  title?: string;
  message?: string;
  notification_type?: string;
  status?: string;
  priority?: string;
  action_url?: string | null;
  action_text?: string | null;
  icon_class?: string | null;
  metadata?: Record<string, unknown> | null;
}

