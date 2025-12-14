/**
 * WebSocket Context
 * Provides WebSocket connection and event handling throughout the app
 */

'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { websocketService, NotificationEvent, UserEvent, ActivityLogEvent } from '@services/websocket.service';
import { useAuth } from './AuthContext';

interface WebSocketContextType {
  connected: boolean;
  subscribeToNotifications: () => void;
  unsubscribeFromNotifications: () => void;
  subscribeToDashboard: () => void;
  unsubscribeFromDashboard: () => void;
  subscribeToActivity: () => void;
  unsubscribeFromActivity: () => void;
  subscribeToMedia: () => void;
  unsubscribeFromMedia: () => void;
  onNotification: (callback: (data: NotificationEvent) => void) => () => void;
  onNotificationUpdate: (callback: (data: NotificationEvent) => void) => () => void;
  onNotificationDelete: (callback: (data: { id: string }) => void) => () => void;
  onNotificationsAllRead: (callback: (data: { userId: string }) => void) => () => void;
  onUserCreated: (callback: (data: UserEvent) => void) => () => void;
  onUserUpdated: (callback: (data: UserEvent) => void) => () => void;
  onUserDeleted: (callback: (data: { user_id: string }) => void) => () => void;
  onActivityNew: (callback: (data: ActivityLogEvent) => void) => () => void;
  onDashboardStatsUpdate: (callback: () => void) => () => void;
  onMediaCreated: (callback: (data: any) => void) => () => void;
  onMediaUpdated: (callback: (data: any) => void) => () => void;
  onMediaDeleted: (callback: (data: { media_id: string }) => void) => () => void;
  onFolderCreated: (callback: (data: any) => void) => () => void;
  onFolderUpdated: (callback: (data: { old_name: string; new_name: string }) => void) => () => void;
  onFolderDeleted: (callback: (data: { folder_name: string }) => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
  const { tokens, user } = useAuth();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Prefer session_token, fallback to access_token
    const token = tokens?.session_token || tokens?.access_token;
    
    if (!token || !user) {
      // Disconnect if no token
      if (websocketService.isConnected()) {
        websocketService.disconnect();
      }
      // Update state in next tick to avoid synchronous setState
      setTimeout(() => setConnected(false), 0);
      return;
    }

    // Validate token before connecting
    // Check if token is valid by decoding it (without verification, just to check format)
    const validateTokenFormat = (token: string): boolean => {
      try {
        // Basic JWT format check - should have 3 parts separated by dots
        const parts = token.split('.');
        if (parts.length !== 3) {
          return false;
        }
        
        // Decode the payload (without verification) to check expiration
        // Use browser-compatible base64 decoding
        const base64Url = parts[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        
        const payload = JSON.parse(jsonPayload);
        const now = Math.floor(Date.now() / 1000);
        
        // Check if token is expired
        if (payload.exp && payload.exp < now) {
          console.warn('WebSocket: Token is expired, will wait for refresh');
          return false;
        }
        
        // Check if token has required fields
        if (!payload.sub && !payload.user_id) {
          console.warn('WebSocket: Token missing user_id');
          return false;
        }
        
        return true;
      } catch (error) {
        console.warn('WebSocket: Invalid token format', error);
        return false;
      }
    };

    // Small delay to ensure token is valid before connecting
    // This prevents connection attempts with stale/expired tokens
    const connectTimer = setTimeout(() => {
      // Double-check token is still available (use closure values)
      const currentToken = tokens?.session_token || tokens?.access_token;
      if (!currentToken || !user) {
        setConnected(false);
        return;
      }

      // Validate token format and expiration before connecting
      if (!validateTokenFormat(currentToken)) {
        console.warn('WebSocket: Token validation failed, will retry when token is refreshed');
        setConnected(false);
        return;
      }

      // Connect to WebSocket with token
      // Wrap in try-catch and handle gracefully - WebSocket is optional
      try {
        websocketService.connect(currentToken);
        // Set a timeout to mark as disconnected if connection doesn't establish quickly
        const connectionTimeout = setTimeout(() => {
          if (!websocketService.isConnected()) {
            // Connection is taking too long, mark as disconnected
            // This prevents the app from waiting indefinitely
            setConnected(false);
          }
        }, 15000); // 15 seconds max wait
        
        // Clear timeout if connection succeeds
        const checkConnection = setInterval(() => {
          if (websocketService.isConnected()) {
            clearTimeout(connectionTimeout);
            clearInterval(checkConnection);
            setConnected(true);
          }
        }, 500);
        
        // Cleanup interval after 20 seconds
        setTimeout(() => {
          clearInterval(checkConnection);
        }, 20000);
      } catch (error) {
        // WebSocket connection failure is not critical - app can work without it
        console.warn('WebSocket connection failed (non-critical):', error instanceof Error ? error.message : 'Unknown error');
        setConnected(false);
      }
    }, 100); // Small delay to ensure tokens are ready

    // Listen for connection status
    const handleConnected = () => {
      setConnected(true);
    };

    const handleDisconnected = () => {
      setConnected(false);
    };

    websocketService.on('connected', handleConnected);
    websocketService.on('disconnected', handleDisconnected);

    // Auto-subscribe to notifications
    let checkConnectionInterval: NodeJS.Timeout | null = null;
    if (websocketService.isConnected()) {
      websocketService.subscribeToNotifications();
    } else {
      // Wait for connection then subscribe
      checkConnectionInterval = setInterval(() => {
        if (websocketService.isConnected()) {
          websocketService.subscribeToNotifications();
          if (checkConnectionInterval) {
            clearInterval(checkConnectionInterval);
          }
        }
      }, 100);
    }

    return () => {
      clearTimeout(connectTimer);
      if (checkConnectionInterval) {
        clearInterval(checkConnectionInterval);
      }
      websocketService.off('connected', handleConnected);
      websocketService.off('disconnected', handleDisconnected);
      websocketService.disconnect();
      setConnected(false);
    };
  }, [tokens.session_token, tokens.access_token, user]);

  const subscribeToNotifications = useCallback(() => {
    websocketService.subscribeToNotifications();
  }, []);

  const unsubscribeFromNotifications = useCallback(() => {
    websocketService.unsubscribeFromNotifications();
  }, []);

  const subscribeToDashboard = useCallback(() => {
    websocketService.subscribeToDashboard();
  }, []);

  const unsubscribeFromDashboard = useCallback(() => {
    websocketService.unsubscribeFromDashboard();
  }, []);

  const subscribeToActivity = useCallback(() => {
    websocketService.subscribeToActivity();
  }, []);

  const unsubscribeFromActivity = useCallback(() => {
    websocketService.unsubscribeFromActivity();
  }, []);

  const onNotification = useCallback((callback: (data: NotificationEvent) => void) => {
    websocketService.on('notification:new', callback);
    return () => {
      websocketService.off('notification:new', callback);
    };
  }, []);

  const onNotificationUpdate = useCallback((callback: (data: NotificationEvent) => void) => {
    websocketService.on('notification:updated', callback);
    return () => {
      websocketService.off('notification:updated', callback);
    };
  }, []);

  const onNotificationDelete = useCallback((callback: (data: { id: string }) => void) => {
    websocketService.on('notification:deleted', callback);
    return () => {
      websocketService.off('notification:deleted', callback);
    };
  }, []);

  const onNotificationsAllRead = useCallback((callback: (data: { userId: string }) => void) => {
    websocketService.on('notifications:all-read', callback);
    return () => {
      websocketService.off('notifications:all-read', callback);
    };
  }, []);

  const onUserCreated = useCallback((callback: (data: UserEvent) => void) => {
    websocketService.on('user:created', callback);
    return () => {
      websocketService.off('user:created', callback);
    };
  }, []);

  const onUserUpdated = useCallback((callback: (data: UserEvent) => void) => {
    websocketService.on('user:updated', callback);
    return () => {
      websocketService.off('user:updated', callback);
    };
  }, []);

  const onUserDeleted = useCallback((callback: (data: { user_id: string }) => void) => {
    websocketService.on('user:deleted', callback);
    return () => {
      websocketService.off('user:deleted', callback);
    };
  }, []);

  const onActivityNew = useCallback((callback: (data: ActivityLogEvent) => void) => {
    websocketService.on('activity:new', callback);
    return () => {
      websocketService.off('activity:new', callback);
    };
  }, []);

  const onDashboardStatsUpdate = useCallback((callback: () => void) => {
    websocketService.on('dashboard:stats:update', callback);
    return () => {
      websocketService.off('dashboard:stats:update', callback);
    };
  }, []);

  const subscribeToMedia = useCallback(() => {
    websocketService.subscribeToMedia();
  }, []);

  const unsubscribeFromMedia = useCallback(() => {
    websocketService.unsubscribeFromMedia();
  }, []);

  const onMediaCreated = useCallback((callback: (data: any) => void) => {
    websocketService.on('media:created', callback);
    return () => {
      websocketService.off('media:created', callback);
    };
  }, []);

  const onMediaUpdated = useCallback((callback: (data: any) => void) => {
    websocketService.on('media:updated', callback);
    return () => {
      websocketService.off('media:updated', callback);
    };
  }, []);

  const onMediaDeleted = useCallback((callback: (data: { media_id: string }) => void) => {
    websocketService.on('media:deleted', callback);
    return () => {
      websocketService.off('media:deleted', callback);
    };
  }, []);

  const onFolderCreated = useCallback((callback: (data: any) => void) => {
    websocketService.on('folder:created', callback);
    return () => {
      websocketService.off('folder:created', callback);
    };
  }, []);

  const onFolderUpdated = useCallback((callback: (data: { old_name: string; new_name: string }) => void) => {
    websocketService.on('folder:updated', callback);
    return () => {
      websocketService.off('folder:updated', callback);
    };
  }, []);

  const onFolderDeleted = useCallback((callback: (data: { folder_name: string }) => void) => {
    websocketService.on('folder:deleted', callback);
    return () => {
      websocketService.off('folder:deleted', callback);
    };
  }, []);

  return (
    <WebSocketContext.Provider
      value={{
        connected,
        subscribeToNotifications,
        unsubscribeFromNotifications,
        subscribeToDashboard,
        unsubscribeFromDashboard,
        subscribeToActivity,
        unsubscribeFromActivity,
        subscribeToMedia,
        unsubscribeFromMedia,
        onNotification,
        onNotificationUpdate,
        onNotificationDelete,
        onNotificationsAllRead,
        onUserCreated,
        onUserUpdated,
        onUserDeleted,
        onActivityNew,
        onDashboardStatsUpdate,
        onMediaCreated,
        onMediaUpdated,
        onMediaDeleted,
        onFolderCreated,
        onFolderUpdated,
        onFolderDeleted,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};
