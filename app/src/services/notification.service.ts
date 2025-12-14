/**
 * Notification Service
 * Handles all notification API calls
 */

import { createPublicApiService } from '@lib/api/ApiServiceFactory';
import type { ApiService } from '@lib/api/ApiService';
import type { Notification, NotificationCreateInput, NotificationUpdateInput } from '@models/notification.model';

class NotificationService {
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
   * Get notifications (caching handled by API middleware)
   */
  async getNotifications(options?: {
    status?: 'read' | 'unread' | 'all';
    notification_type?: string;
    priority?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    notifications: Notification[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
    unread_count: number;
  }> {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.notification_type) params.append('notification_type', options.notification_type);
    if (options?.priority) params.append('priority', options.priority);
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.offset) params.append('offset', String(options.offset));

    const response = await this.api.get<{ data: {
      notifications: Notification[];
      pagination: {
        total: number;
        limit: number;
        offset: number;
        hasMore: boolean;
      };
      unread_count: number;
    } }>(`/notifications?${params}`);
    
    return response.data;
  }

  /**
   * Refresh notifications (force API call, bypassing cache)
   */
  async refreshNotifications(options?: {
    status?: 'read' | 'unread' | 'all';
    notification_type?: string;
    priority?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    notifications: Notification[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
    unread_count: number;
  }> {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.notification_type) params.append('notification_type', options.notification_type);
    if (options?.priority) params.append('priority', options.priority);
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.offset) params.append('offset', String(options.offset));
    params.append('_refresh', String(Date.now()));

    const response = await this.api.get<{ data: {
      notifications: Notification[];
      pagination: {
        total: number;
        limit: number;
        offset: number;
        hasMore: boolean;
      };
      unread_count: number;
    } }>(`/notifications?${params}`);
    
    return response.data;
  }

  /**
   * Get notification by ID
   */
  async getNotification(id: string): Promise<Notification> {
    const response = await this.api.get<{ data: { notification: Notification } }>(`/notifications/${id}`);
    return response.data.notification;
  }

  /**
   * Create notification
   */
  async createNotification(data: NotificationCreateInput): Promise<Notification> {
    const response = await this.api.post<{ data: { notification: Notification } }>('/notifications', data);
    return response.data.notification;
  }

  /**
   * Update notification
   */
  async updateNotification(id: string, data: NotificationUpdateInput): Promise<Notification> {
    const response = await this.api.put<{ data: { notification: Notification } }>(`/notifications/${id}`, data);
    return response.data.notification;
  }

  /**
   * Delete notification
   */
  async deleteNotification(id: string): Promise<void> {
    await this.api.delete<unknown>(`/notifications/${id}`);
  }

  /**
   * Mark notification as read
   */
  async markAsRead(id: string): Promise<Notification> {
    const response = await this.api.post<{ data: { notification: Notification } }>('/notifications/mark-read', { id });
    return response.data.notification;
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<{ count: number }> {
    const response = await this.api.post<{ data: { count: number } }>('/notifications/mark-read', { mark_all: true });
    return response.data;
  }

  /**
   * Get unread count
   */
  async getUnreadCount(): Promise<number> {
    const response = await this.api.get<{ data: { unread_count: number } }>('/notifications/unread-count');
    return response.data.unread_count;
  }
}

export const notificationService = new NotificationService();

