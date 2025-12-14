/**
 * Activity Log Service
 * Centralized service for creating activity logs across the application
 * Automatically captures user actions, CRUD operations, imports, exports, and errors
 */

import { prisma } from '@lib/db/prisma';
import { logger } from '@lib/logger/logger';
import { invalidateActivityLogsCache } from '@lib/cache/invalidation';
import { emitActivityLogCreated } from '@lib/websocket/emitter';

export interface ActivityLogData {
  user_id?: string | null;
  level?: 'info' | 'warn' | 'error' | 'debug' | 'audit';
  message: string;
  action?: string; // e.g., 'create_user', 'update_user', 'delete_user', 'import_users', 'export_users'
  module?: string; // e.g., 'users', 'permissions', 'dashboard'
  ip_address?: string | null;
  user_agent?: string | null;
  metadata?: Record<string, any> | null;
  error_details?: Record<string, any> | null;
  status_code?: number | null;
  duration_ms?: number | null;
  endpoint?: string | null;
  method?: string | null;
}

class ActivityLogService {
  /**
   * Create an activity log entry
   * This is the main method to use throughout the application
   */
  async createLog(data: ActivityLogData, req?: { headers?: Headers; url?: string; method?: string }): Promise<void> {
    try {
      // Extract IP address and user agent from request if provided
      let ipAddress = data.ip_address || null;
      let userAgent = data.user_agent || null;
      let endpoint = data.endpoint || null;
      let method = data.method || null;

      if (req) {
        if (req.headers) {
          ipAddress = ipAddress || 
            req.headers.get('x-forwarded-for')?.split(',')[0] || 
            req.headers.get('x-real-ip') || 
            null;
          userAgent = userAgent || req.headers.get('user-agent') || null;
        }
        endpoint = endpoint || req.url || null;
        method = method || req.method || null;
      }

      // Parse user agent for device/browser/OS info
      const deviceInfo = this.parseUserAgent(userAgent || '');

      const logData = {
        user_id: data.user_id || null,
        level: data.level || 'info',
        message: data.message,
        action: data.action || null,
        module: data.module || null,
        ip_address: ipAddress,
        user_agent: userAgent,
        device: deviceInfo.device,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        platform: 'web',
        endpoint,
        method,
        status_code: data.status_code || null,
        session_id: null, // Can be extracted from request if needed
        request_id: null, // Can be extracted from request if needed
        metadata: data.metadata || null,
        error_details: data.error_details || null,
        duration_ms: data.duration_ms || null,
      };

      // Create activity log in database
      const activityLog = await prisma.activityLog.create({
        data: {
          ...logData,
          // Convert null to undefined for Prisma JSON fields
          metadata: logData.metadata === null ? undefined : logData.metadata,
          error_details: logData.error_details === null ? undefined : logData.error_details,
        },
      });

      // Invalidate cache
      await invalidateActivityLogsCache();

      // Emit WebSocket event for real-time updates
      try {
        emitActivityLogCreated(activityLog);
      } catch (wsError) {
        logger.warning('Failed to emit activity log WebSocket event', {
          module: 'ActivityLogService',
          extraData: { error: wsError instanceof Error ? wsError.message : 'Unknown error' }
        });
      }

      // Also log to winston logger
      logger.info(data.message, {
        module: data.module || 'ActivityLog',
        label: data.action || 'ACTIVITY_LOG',
        userId: data.user_id ?? undefined,
        extraData: {
          action: data.action,
          module: data.module,
          level: data.level,
        },
      });
    } catch (error) {
      // Don't throw - activity log failure shouldn't break the main operation
      logger.error('Failed to create activity log', {
        module: 'ActivityLogService',
        extraData: {
          error: error instanceof Error ? error.message : 'Unknown error',
          logData: data,
        },
      });
    }
  }

  /**
   * Helper method for CREATE operations
   */
  async logCreate(
    user_id: string | null | undefined,
    module: string,
    resource: string,
    resource_id: string,
    details?: Record<string, any>,
    req?: { headers?: Headers; url?: string; method?: string }
  ): Promise<void> {
    await this.createLog({
      user_id: user_id || null,
      level: 'info',
      message: `Created ${resource}: ${resource_id}`,
      action: `create_${module}`,
      module,
      metadata: {
        resource,
        resource_id,
        ...details,
      },
    }, req);
  }

  /**
   * Helper method for UPDATE operations
   */
  async logUpdate(
    user_id: string | null | undefined,
    module: string,
    resource: string,
    resource_id: string,
    changes?: Record<string, any>,
    req?: { headers?: Headers; url?: string; method?: string }
  ): Promise<void> {
    await this.createLog({
      user_id: user_id || null,
      level: 'info',
      message: `Updated ${resource}: ${resource_id}`,
      action: `update_${module}`,
      module,
      metadata: {
        resource,
        resource_id,
        changes,
      },
    }, req);
  }

  /**
   * Helper method for DELETE operations
   */
  async logDelete(
    user_id: string | null | undefined,
    module: string,
    resource: string,
    resource_id: string,
    details?: Record<string, any>,
    req?: { headers?: Headers; url?: string; method?: string }
  ): Promise<void> {
    await this.createLog({
      user_id: user_id || null,
      level: 'warn',
      message: `Deleted ${resource}: ${resource_id}`,
      action: `delete_${module}`,
      module,
      metadata: {
        resource,
        resource_id,
        ...details,
      },
    }, req);
  }

  /**
   * Helper method for IMPORT operations
   */
  async logImport(
    user_id: string | null | undefined,
    module: string,
    resource: string,
    count: number,
    details?: Record<string, any>,
    req?: { headers?: Headers; url?: string; method?: string }
  ): Promise<void> {
    await this.createLog({
      user_id: user_id || null,
      level: 'info',
      message: `Imported ${count} ${resource}(s)`,
      action: `import_${module}`,
      module,
      metadata: {
        resource,
        count,
        ...details,
      },
    }, req);
  }

  /**
   * Helper method for EXPORT operations
   */
  async logExport(
    user_id: string | null | undefined,
    module: string,
    resource: string,
    count: number,
    format?: string,
    details?: Record<string, any>,
    req?: { headers?: Headers; url?: string; method?: string }
  ): Promise<void> {
    await this.createLog({
      user_id: user_id || null,
      level: 'info',
      message: `Exported ${count} ${resource}(s) as ${format || 'file'}`,
      action: `export_${module}`,
      module,
      metadata: {
        resource,
        count,
        format,
        ...details,
      },
    }, req);
  }

  /**
   * Helper method for ERROR logging
   */
  async logError(
    user_id: string | null | undefined,
    module: string,
    action: string,
    error: Error | string,
    details?: Record<string, any>,
    req?: { headers?: Headers; url?: string; method?: string }
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : null;

    await this.createLog({
      user_id: user_id || null,
      level: 'error',
      message: `Error in ${action}: ${errorMessage}`,
      action: `error_${action}`,
      module,
      error_details: {
        message: errorMessage,
        stack: errorStack,
        ...details,
      },
      metadata: details,
    }, req);
  }

  /**
   * Helper method for LOGIN operations
   */
  async logLogin(
    user_id: string | null,
    success: boolean,
    details?: Record<string, any>,
    req?: { headers?: Headers; url?: string; method?: string }
  ): Promise<void> {
    await this.createLog({
      user_id: user_id || null,
      level: success ? 'info' : 'warn',
      message: success ? `User logged in successfully` : `Failed login attempt`,
      action: success ? 'login' : 'login_failed',
      module: 'authentication',
      metadata: details,
    }, req);
  }

  /**
   * Helper method for LOGOUT operations
   */
  async logLogout(
    user_id: string,
    req?: { headers?: Headers; url?: string; method?: string }
  ): Promise<void> {
    await this.createLog({
      user_id,
      level: 'info',
      message: `User logged out`,
      action: 'logout',
      module: 'authentication',
    }, req);
  }

  /**
   * Helper method for ASSIGN operations (e.g., assign user to group, assign ticket to agent)
   */
  async logAssign(
    user_id: string | null | undefined,
    module: string,
    resource: string,
    resource_id: string,
    assigned_to: string,
    details?: Record<string, any>,
    req?: { headers?: Headers; url?: string; method?: string }
  ): Promise<void> {
    await this.createLog({
      user_id: user_id || null,
      level: 'info',
      message: `Assigned ${resource} ${resource_id} to user ${assigned_to}`,
      action: `assign_${module}`,
      module,
      metadata: {
        resource,
        resource_id,
        assigned_to,
        ...details,
      },
    }, req);
  }

  /**
   * Helper method for PERMISSION operations
   */
  async logPermissionChange(
    user_id: string | null | undefined,
    action: 'grant' | 'revoke',
    target_user_id: string,
    permission: string,
    details?: Record<string, any>,
    req?: { headers?: Headers; url?: string; method?: string }
  ): Promise<void> {
    await this.createLog({
      user_id: user_id || null,
      level: 'audit',
      message: `${action === 'grant' ? 'Granted' : 'Revoked'} permission "${permission}" to user ${target_user_id}`,
      action: `${action}_permission`,
      module: 'permissions',
      metadata: {
        target_user_id,
        permission,
        action,
        ...details,
      },
    }, req);
  }

  /**
   * Parse user agent string to extract device, browser, and OS info
   */
  private parseUserAgent(userAgent: string): { device: string | null; browser: string | null; os: string | null } {
    if (!userAgent) {
      return { device: null, browser: null, os: null };
    }

    const ua = userAgent.toLowerCase();

    // Detect device
    let device: string | null = null;
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      device = 'mobile';
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
      device = 'tablet';
    } else {
      device = 'desktop';
    }

    // Detect browser
    let browser: string | null = null;
    if (ua.includes('chrome') && !ua.includes('edg')) {
      browser = 'chrome';
    } else if (ua.includes('firefox')) {
      browser = 'firefox';
    } else if (ua.includes('safari') && !ua.includes('chrome')) {
      browser = 'safari';
    } else if (ua.includes('edg')) {
      browser = 'edge';
    } else if (ua.includes('opera')) {
      browser = 'opera';
    } else {
      browser = 'unknown';
    }

    // Detect OS
    let os: string | null = null;
    if (ua.includes('windows')) {
      os = 'windows';
    } else if (ua.includes('mac os') || ua.includes('macos')) {
      os = 'macos';
    } else if (ua.includes('linux')) {
      os = 'linux';
    } else if (ua.includes('android')) {
      os = 'android';
    } else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) {
      os = 'ios';
    } else {
      os = 'unknown';
    }

    return { device, browser, os };
  }
}

// Export singleton instance
export const activityLogService = new ActivityLogService();

