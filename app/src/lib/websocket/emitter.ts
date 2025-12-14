/**
 * WebSocket Emitter Helper
 * Provides helper functions to emit WebSocket events from API routes
 */

// Access the global io instance from server.js
declare global {
  var io: any;
}

/**
 * Check if WebSocket server is available
 */
function isWebSocketAvailable(): boolean {
  return typeof global !== 'undefined' && global.io && typeof global.io.emit === 'function';
}

/**
 * Emit notification event to specific user
 */
export function emitNotificationToUser(userId: string, notification: any): void {
  if (isWebSocketAvailable() && userId) {
    try {
      // Emit as new notification if it doesn't have read_at, otherwise emit as update
      if (notification.read_at) {
        global.io.to(`user:${userId}`).emit('notification:updated', notification);
      } else {
        global.io.to(`user:${userId}`).emit('notification:new', notification);
      }
      // Also emit to notifications room for subscribers
      global.io.to('notifications').emit(notification.read_at ? 'notification:updated' : 'notification:new', notification);
    } catch (error) {
      console.error('Failed to emit notification to user:', error);
    }
  }
}

/**
 * Emit notification update event to specific user
 */
export function emitNotificationUpdateToUser(userId: string, notification: any): void {
  if (isWebSocketAvailable() && userId) {
    try {
      global.io.to(`user:${userId}`).emit('notification:updated', notification);
      // Also emit to notifications room for subscribers
      global.io.to('notifications').emit('notification:updated', notification);
    } catch (error) {
      console.error('Failed to emit notification update to user:', error);
    }
  }
}

/**
 * Emit notification event to all admins
 */
export function emitNotificationToAdmins(notification: any): void {
  if (isWebSocketAvailable()) {
    try {
      // Emit as new notification if it doesn't have read_at, otherwise emit as update
      if (notification.read_at) {
        global.io.to('admin').emit('notification:updated', notification);
      } else {
        global.io.to('admin').emit('notification:new', notification);
      }
    } catch (error) {
      console.error('Failed to emit notification to admins:', error);
    }
  }
}

/**
 * Emit notification event to all users in notifications room
 */
export function emitNotificationToAll(notification: any): void {
  if (isWebSocketAvailable()) {
    try {
      // Emit as new notification if it doesn't have read_at, otherwise emit as update
      if (notification.read_at) {
        global.io.to('notifications').emit('notification:updated', notification);
      } else {
        global.io.to('notifications').emit('notification:new', notification);
      }
    } catch (error) {
      console.error('Failed to emit notification to all:', error);
    }
  }
}

/**
 * Emit notification deletion event
 */
export function emitNotificationDeleted(userId: string, notificationId: string): void {
  if (isWebSocketAvailable() && userId) {
    try {
      global.io.to(`user:${userId}`).emit('notification:deleted', { id: notificationId });
      // Also emit to notifications room
      global.io.to('notifications').emit('notification:deleted', { id: notificationId });
    } catch (error) {
      console.error('Failed to emit notification deletion:', error);
    }
  }
}

/**
 * Emit ticket message event to ticket room
 */
export function emitTicketMessage(ticketId: string, message: any): void {
  if (isWebSocketAvailable() && ticketId) {
    try {
      global.io.to(`ticket:${ticketId}`).emit('ticket:message:new', message);
    } catch (error) {
      console.error('Failed to emit ticket message:', error);
    }
  }
}

/**
 * Emit ticket update event to ticket room and user
 */
export function emitTicketUpdate(ticketId: string, ticket: any, userId?: string): void {
  if (isWebSocketAvailable() && ticketId) {
    try {
      // Emit to ticket room
      global.io.to(`ticket:${ticketId}`).emit('ticket:updated', ticket);
      
      // Emit to specific user if provided
      if (userId) {
        global.io.to(`user:${userId}`).emit('ticket:updated', ticket);
      }
    } catch (error) {
      console.error('Failed to emit ticket update:', error);
    }
  }
}

/**
 * Emit ticket assignment event
 */
export function emitTicketAssignment(ticketId: string, ticket: any, assignedToId: string): void {
  if (isWebSocketAvailable() && ticketId && assignedToId) {
    try {
      // Emit to assigned user
      global.io.to(`user:${assignedToId}`).emit('ticket:assigned', ticket);
      
      // Emit to ticket room
      global.io.to(`ticket:${ticketId}`).emit('ticket:updated', ticket);
    } catch (error) {
      console.error('Failed to emit ticket assignment:', error);
    }
  }
}

/**
 * Emit chat message event to chat room
 */
export function emitChatMessage(chatId: string, message: any): void {
  if (isWebSocketAvailable() && chatId) {
    try {
      global.io.to(`chat:${chatId}`).emit('chat:message:new', message);
    } catch (error) {
      console.error('Failed to emit chat message:', error);
    }
  }
}

/**
 * Emit chat update event to chat room
 */
export function emitChatUpdate(chatId: string, chat: any): void {
  if (isWebSocketAvailable() && chatId) {
    try {
      global.io.to(`chat:${chatId}`).emit('chat:updated', chat);
    } catch (error) {
      console.error('Failed to emit chat update:', error);
    }
  }
}

/**
 * Emit new chat event to user
 */
export function emitNewChat(userId: string, chat: any): void {
  if (isWebSocketAvailable() && userId) {
    try {
      global.io.to(`user:${userId}`).emit('chat:new', chat);
    } catch (error) {
      console.error('Failed to emit new chat:', error);
    }
  }
}

/**
 * Emit new ticket event to user and admins
 */
export function emitNewTicket(ticket: any, userId?: string): void {
  if (isWebSocketAvailable()) {
    try {
      // Emit to ticket creator
      if (userId) {
        global.io.to(`user:${userId}`).emit('ticket:new', ticket);
      }
      // Emit to ticket room
      if (ticket.ticket_id) {
        global.io.to(`ticket:${ticket.ticket_id}`).emit('ticket:new', ticket);
      }
      // Emit to all admins
      global.io.to('admin').emit('ticket:new', ticket);
    } catch (error) {
      console.error('Failed to emit new ticket:', error);
    }
  }
}

/**
 * Emit user created event to admins
 */
export function emitUserCreated(user: any): void {
  if (isWebSocketAvailable()) {
    try {
      // Remove password before emitting - never send password to frontend
      const { password: _, ...userWithoutPassword } = user || {};
      // Emit to all admins
      global.io.to('admin').emit('user:created', userWithoutPassword);
      // Emit to dashboard room for stats updates
      global.io.to('dashboard').emit('user:created', userWithoutPassword);
    } catch (error) {
      console.error('Failed to emit user created:', error);
    }
  }
}

/**
 * Emit user updated event to admins
 */
export function emitUserUpdated(user: any): void {
  if (isWebSocketAvailable()) {
    try {
      // Remove password before emitting - never send password to frontend
      const { password: _, ...userWithoutPassword } = user || {};
      // Emit to all admins
      global.io.to('admin').emit('user:updated', userWithoutPassword);
      // Emit to dashboard room for stats updates
      global.io.to('dashboard').emit('user:updated', userWithoutPassword);
      // Emit to specific user if they're viewing their own profile
      if (userWithoutPassword.user_id) {
        global.io.to(`user:${userWithoutPassword.user_id}`).emit('user:updated', userWithoutPassword);
      }
    } catch (error) {
      console.error('Failed to emit user updated:', error);
    }
  }
}

/**
 * Emit user deleted event to admins
 */
export function emitUserDeleted(userId: string): void {
  if (isWebSocketAvailable()) {
    try {
      // Emit to all admins
      global.io.to('admin').emit('user:deleted', { user_id: userId });
      // Emit to dashboard room for stats updates
      global.io.to('dashboard').emit('user:deleted', { user_id: userId });
    } catch (error) {
      console.error('Failed to emit user deleted:', error);
    }
  }
}

/**
 * Emit activity log created event
 */
export function emitActivityLogCreated(activityLog: any): void {
  if (isWebSocketAvailable()) {
    try {
      // Emit to admins
      global.io.to('admin').emit('activity:new', activityLog);
      // Emit to activity room
      global.io.to('activity').emit('activity:new', activityLog);
    } catch (error) {
      console.error('Failed to emit activity log created:', error);
    }
  }
}

/**
 * Emit dashboard stats update event
 */
export function emitDashboardStatsUpdate(): void {
  if (isWebSocketAvailable()) {
    try {
      // Emit to dashboard room to trigger stats refresh
      global.io.to('dashboard').emit('dashboard:stats:update');
    } catch (error) {
      console.error('Failed to emit dashboard stats update:', error);
    }
  }
}

/**
 * Emit media created event
 */
export function emitMediaCreated(media: any, userId?: string): void {
  if (isWebSocketAvailable()) {
    try {
      global.io.to('media').emit('media:created', media);
      if (userId) {
        global.io.to(`user:${userId}`).emit('media:created', media);
      }
    } catch (error) {
      console.error('Failed to emit media created:', error);
    }
  }
}

/**
 * Emit media updated event
 */
export function emitMediaUpdated(media: any, userId?: string): void {
  if (isWebSocketAvailable()) {
    try {
      global.io.to('media').emit('media:updated', media);
      if (userId) {
        global.io.to(`user:${userId}`).emit('media:updated', media);
      }
    } catch (error) {
      console.error('Failed to emit media updated:', error);
    }
  }
}

/**
 * Emit media deleted event
 */
export function emitMediaDeleted(mediaId: string, userId?: string): void {
  if (isWebSocketAvailable()) {
    try {
      global.io.to('media').emit('media:deleted', { media_id: mediaId });
      if (userId) {
        global.io.to(`user:${userId}`).emit('media:deleted', { media_id: mediaId });
      }
    } catch (error) {
      console.error('Failed to emit media deleted:', error);
    }
  }
}

/**
 * Emit folder created event
 */
export function emitFolderCreated(folder: any, userId?: string): void {
  if (isWebSocketAvailable()) {
    try {
      global.io.to('media').emit('folder:created', folder);
      if (userId) {
        global.io.to(`user:${userId}`).emit('folder:created', folder);
      }
    } catch (error) {
      console.error('Failed to emit folder created:', error);
    }
  }
}

/**
 * Emit folder updated event
 */
export function emitFolderUpdated(oldName: string, newName: string, userId?: string): void {
  if (isWebSocketAvailable()) {
    try {
      global.io.to('media').emit('folder:updated', { old_name: oldName, new_name: newName });
      if (userId) {
        global.io.to(`user:${userId}`).emit('folder:updated', { old_name: oldName, new_name: newName });
      }
    } catch (error) {
      console.error('Failed to emit folder updated:', error);
    }
  }
}

/**
 * Emit folder deleted event
 */
export function emitFolderDeleted(folderName: string, userId?: string): void {
  if (isWebSocketAvailable()) {
    try {
      global.io.to('media').emit('folder:deleted', { folder_name: folderName });
      if (userId) {
        global.io.to(`user:${userId}`).emit('folder:deleted', { folder_name: folderName });
      }
    } catch (error) {
      console.error('Failed to emit folder deleted:', error);
    }
  }
}

/**
 * Emit bot created event to admins
 */
export function emitBotCreated(bot: any): void {
  if (isWebSocketAvailable()) {
    try {
      global.io.to('admin').emit('bot:created', bot);
      global.io.to('bots').emit('bot:created', bot);
    } catch (error) {
      console.error('Failed to emit bot created:', error);
    }
  }
}

/**
 * Emit bot updated event to admins
 */
export function emitBotUpdated(bot: any): void {
  if (isWebSocketAvailable()) {
    try {
      global.io.to('admin').emit('bot:updated', bot);
      global.io.to('bots').emit('bot:updated', bot);
    } catch (error) {
      console.error('Failed to emit bot updated:', error);
    }
  }
}

/**
 * Emit bot deleted event to admins
 */
export function emitBotDeleted(botId: string): void {
  if (isWebSocketAvailable()) {
    try {
      global.io.to('admin').emit('bot:deleted', { bot_id: botId });
      global.io.to('bots').emit('bot:deleted', { bot_id: botId });
    } catch (error) {
      console.error('Failed to emit bot deleted:', error);
    }
  }
}

/**
 * Emit dataset created event to admins
 */
export function emitDatasetCreated(dataset: any): void {
  if (isWebSocketAvailable()) {
    try {
      global.io.to('admin').emit('dataset:created', dataset);
      global.io.to('bots').emit('dataset:created', dataset);
    } catch (error) {
      console.error('Failed to emit dataset created:', error);
    }
  }
}

/**
 * Emit dataset updated event to admins
 */
export function emitDatasetUpdated(dataset: any): void {
  if (isWebSocketAvailable()) {
    try {
      global.io.to('admin').emit('dataset:updated', dataset);
      global.io.to('bots').emit('dataset:updated', dataset);
    } catch (error) {
      console.error('Failed to emit dataset updated:', error);
    }
  }
}

/**
 * Emit dataset deleted event to admins
 */
export function emitDatasetDeleted(datasetId: string): void {
  if (isWebSocketAvailable()) {
    try {
      global.io.to('admin').emit('dataset:deleted', { dataset_id: datasetId });
      global.io.to('bots').emit('dataset:deleted', { dataset_id: datasetId });
    } catch (error) {
      console.error('Failed to emit dataset deleted:', error);
    }
  }
}

/**
 * Emit dataset progress event (for generation jobs)
 */
export function emitDatasetProgress(dataset: any): void {
  if (isWebSocketAvailable()) {
    try {
      global.io.to('admin').emit('dataset:progress', dataset);
      global.io.to('bots').emit('dataset:progress', dataset);
    } catch (error) {
      console.error('Failed to emit dataset progress:', error);
    }
  }
}

/**
 * Emit fine-tune job created event to admins
 */
export function emitFineTuneJobCreated(job: any): void {
  if (isWebSocketAvailable()) {
    try {
      global.io.to('admin').emit('fine-tune:job:created', job);
      global.io.to('bots').emit('fine-tune:job:created', job);
    } catch (error) {
      console.error('Failed to emit fine-tune job created:', error);
    }
  }
}

/**
 * Emit fine-tune job updated event to admins
 */
export function emitFineTuneJobUpdated(job: any): void {
  if (isWebSocketAvailable()) {
    try {
      global.io.to('admin').emit('fine-tune:job:updated', job);
      global.io.to('bots').emit('fine-tune:job:updated', job);
    } catch (error) {
      console.error('Failed to emit fine-tune job updated:', error);
    }
  }
}

/**
 * Emit fine-tune job progress event (for training updates)
 */
export function emitFineTuneJobProgress(job: any): void {
  if (isWebSocketAvailable()) {
    try {
      global.io.to('admin').emit('fine-tune:job:progress', job);
      global.io.to('bots').emit('fine-tune:job:progress', job);
    } catch (error) {
      console.error('Failed to emit fine-tune job progress:', error);
    }
  }
}

