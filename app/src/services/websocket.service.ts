/**
 * WebSocket Service
 * Handles Socket.io client connections and events
 */

import { io, Socket } from 'socket.io-client';
import { appConfig } from '@lib/config/env';
import type { Notification } from '@models/notification.model';

export type NotificationEvent = Notification;

export interface UserEvent {
  user_id: string;
  email?: string;
  user_name?: string;
  first_name?: string;
  last_name?: string;
  status?: string;
  is_active?: boolean;
  is_verified?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ActivityLogEvent {
  log_id: string;
  user_id?: string;
  level: string;
  action: string;
  module: string;
  message: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private listeners: Map<string, Set<Function>> = new Map();
  private connectionTimeoutId: NodeJS.Timeout | null = null;

  /**
   * Connect to WebSocket server
   */
  connect(token: string): void {
    // Clear any existing connection timeout
    if (this.connectionTimeoutId) {
      clearTimeout(this.connectionTimeoutId);
      this.connectionTimeoutId = null;
    }

    // Disconnect existing connection if token changed
    if (this.socket) {
      if (this.socket.connected) {
        // Check if we need to reconnect with new token
        const currentToken = (this.socket.auth as any)?.token;
        if (currentToken === token) {
          // Same token, no need to reconnect
          return;
        }
      }
      // Disconnect old connection
      this.socket.disconnect();
      this.socket = null;
    }

    if (!token) {
      console.warn('WebSocket: No token provided, cannot connect');
      return;
    }

    const url = appConfig.publicUrl || 'http://localhost:3000';
    
    // Set a connection timeout to prevent indefinite waiting
    this.connectionTimeoutId = setTimeout(() => {
      if (this.socket && !this.socket.connected) {
        console.warn('WebSocket: Connection timeout - server may be unavailable');
        // Don't disconnect, let socket.io handle reconnection
        // Just log the warning
      }
      this.connectionTimeoutId = null;
    }, 12000); // 12 seconds - slightly longer than connectTimeout

    // Send token in multiple ways for compatibility
    this.socket = io(url, {
      auth: {
        token, // Primary method - accessible via socket.handshake.auth.token
      },
      // Also send in query string as fallback
      query: {
        token, // Fallback method - accessible via socket.handshake.query.token
      },
      // Also send in extraHeaders as fallback
      extraHeaders: {
        'Authorization': `Bearer ${token}`, // Fallback method - accessible via socket.handshake.headers.authorization
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
      // Force new connection on reconnect
      forceNew: false,
      // Timeout configuration - shorter timeout to fail faster
      timeout: 10000, // 10 seconds connection timeout (reduced from 20s)
      connectTimeout: 10000, // 10 seconds connection timeout
      // Auto-connect immediately
      autoConnect: true,
      // Upgrade transport if available
      upgrade: true,
    });

    this.setupEventHandlers();
  }

  /**
   * Setup socket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      // Clear connection timeout on successful connect
      if (this.connectionTimeoutId) {
        clearTimeout(this.connectionTimeoutId);
        this.connectionTimeoutId = null;
      }
      this.reconnectAttempts = 0;
      this.emit('connected', {});
      // Auto-subscribe to notifications on reconnect
      this.subscribeToNotifications();
    });

    this.socket.on('disconnect', (reason) => {
      this.emit('disconnected', { reason });
    });

    this.socket.on('connect_error', (error) => {
      this.reconnectAttempts++;
      
      // Handle authentication errors specifically
      if (error.message?.includes('Authentication error') || error.message?.includes('Invalid token')) {
        // Don't log as error - this is expected when tokens expire
        // The WebSocketContext will reconnect when tokens are refreshed
        this.socket?.disconnect();
        this.socket = null;
        // Don't emit error for auth failures - they're expected when tokens expire
        // Just silently fail and wait for token refresh
        return;
      }
      
      // Handle timeout errors gracefully
      if (error.message?.includes('timeout') || error.type === 'TransportError') {
        // Timeout is not critical - WebSocket is optional for real-time features
        console.warn('WebSocket connection timeout - real-time features will be unavailable');
        // Don't emit error for timeouts - they're not critical
        return;
      }
      
      // Log other connection errors (but don't spam console)
      if (this.reconnectAttempts <= 1) {
        console.warn('WebSocket connection error:', error.message || error);
      }
      this.emit('error', { error: error.message });
    });

    this.socket.on('reconnect', (attemptNumber) => {
      this.reconnectAttempts = 0;
      this.emit('connected', {});
      // Auto-subscribe to notifications on reconnect
      this.subscribeToNotifications();
    });

    this.socket.on('notification:new', (data: NotificationEvent) => {
      this.emit('notification:new', data);
    });

    this.socket.on('notification:updated', (data: NotificationEvent) => {
      this.emit('notification:updated', data);
    });

    this.socket.on('notification:deleted', (data: { id: string }) => {
      this.emit('notification:deleted', data);
    });

    this.socket.on('notifications:all-read', (data: { userId: string }) => {
      this.emit('notifications:all-read', data);
    });

    // User events
    this.socket.on('user:created', (data: UserEvent) => {
      this.emit('user:created', data);
    });

    this.socket.on('user:updated', (data: UserEvent) => {
      this.emit('user:updated', data);
    });

    this.socket.on('user:deleted', (data: { user_id: string }) => {
      this.emit('user:deleted', data);
    });

    // Activity log events
    this.socket.on('activity:new', (data: ActivityLogEvent) => {
      this.emit('activity:new', data);
    });

    // Dashboard events
    this.socket.on('dashboard:stats:update', () => {
      this.emit('dashboard:stats:update', {});
    });

    // Media events
    this.socket.on('media:created', (data: any) => {
      this.emit('media:created', data);
    });

    this.socket.on('media:updated', (data: any) => {
      this.emit('media:updated', data);
    });

    this.socket.on('media:deleted', (data: { media_id: string }) => {
      this.emit('media:deleted', data);
    });

    // Folder events
    this.socket.on('folder:created', (data: any) => {
      this.emit('folder:created', data);
    });

    this.socket.on('folder:updated', (data: { old_name: string; new_name: string }) => {
      this.emit('folder:updated', data);
    });

    this.socket.on('folder:deleted', (data: { folder_name: string }) => {
      this.emit('folder:deleted', data);
    });

    this.socket.on('pong', () => {
      // Connection health check
    });
  }

  /**
   * Subscribe to notifications
   */
  subscribeToNotifications(): void {
    if (this.socket?.connected) {
      this.socket.emit('notification:subscribe');
    }
  }

  /**
   * Unsubscribe from notifications
   */
  unsubscribeFromNotifications(): void {
    if (this.socket?.connected) {
      this.socket.emit('notification:unsubscribe');
    }
  }

  /**
   * Subscribe to dashboard updates (for real-time stats)
   */
  subscribeToDashboard(): void {
    if (this.socket?.connected) {
      this.socket.emit('dashboard:subscribe');
    }
  }

  /**
   * Unsubscribe from dashboard updates
   */
  unsubscribeFromDashboard(): void {
    if (this.socket?.connected) {
      this.socket.emit('dashboard:unsubscribe');
    }
  }

  /**
   * Subscribe to activity updates (for real-time activity logs)
   */
  subscribeToActivity(): void {
    if (this.socket?.connected) {
      this.socket.emit('activity:subscribe');
    }
  }

  /**
   * Unsubscribe from activity updates
   */
  unsubscribeFromActivity(): void {
    if (this.socket?.connected) {
      this.socket.emit('activity:unsubscribe');
    }
  }

  /**
   * Subscribe to media updates
   */
  subscribeToMedia(): void {
    if (this.socket?.connected) {
      this.socket.emit('media:subscribe');
    }
  }

  /**
   * Unsubscribe from media updates
   */
  unsubscribeFromMedia(): void {
    if (this.socket?.connected) {
      this.socket.emit('media:unsubscribe');
    }
  }

  /**
   * Add event listener
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Get socket instance (for advanced usage)
   */
  getSocket(): Socket | null {
    return this.socket;
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();
