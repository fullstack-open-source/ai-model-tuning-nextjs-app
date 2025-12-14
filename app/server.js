// ==============================================================================
// Next.js Custom Server with Socket.io
// Configured to work with Turbopack in Next.js 15
// 
// Note: Prisma Studio is managed separately via PM2 (ecosystem.config.js)
// Prisma Studio runs on port 5555 and is started automatically via start.sh
// Access it at: http://localhost:5555
// To disable: set ENABLE_PRISMA_STUDIO=false in environment variables
// ==============================================================================

// Load environment variables first (before Next.js loads them)
require('dotenv').config();

// Ensure development mode
const dev = process.env.NODE_ENV !== 'production';

// ==============================================================================
// Import dependencies
// ==============================================================================
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// ==============================================================================
// Initialize Next.js app with Turbopack enabled
// Note: In Next.js 15, Turbopack is the default bundler
// Custom servers should work with Turbopack, but there may be compatibility issues
// ==============================================================================
const app = next({ 
  dev, 
  hostname, 
  port
});
const handle = app.getRequestHandler();

// ==============================================================================
// JWT Configuration
// Use same logic as Next.js authConfig (from src/lib/config/env.ts)
// ==============================================================================
const SECRET_KEY = process.env.JWT_SECRET_KEY || process.env.JWT_SECRET;
const ALGORITHM = (process.env.JWT_ALGORITHM || 'HS256');

// ==============================================================================
// Validate Socket.io authentication token
// Uses the same validation logic as Next.js API routes (validateUser in middleware/auth.ts)
// ==============================================================================
function validateSocketToken(token) {
  if (!token) {
    console.error('Socket.io: No token provided to validateSocketToken');
    return null;
  }

  if (!SECRET_KEY) {
    console.error('Socket.io: JWT_SECRET_KEY not configured', {
      hasJwtSecret: !!process.env.JWT_SECRET,
      hasJwtSecretKey: !!process.env.JWT_SECRET_KEY,
    });
    return null;
  }

  try {
    // Decode and verify token - same logic as validateUser in middleware/auth.ts
    let payload;
    try {
      payload = jwt.verify(token, SECRET_KEY, {
        algorithms: [ALGORITHM],
        audience: 'authenticated',
      });
    } catch (audienceError) {
      // Fallback: try without audience check (same as middleware)
      // Some tokens may not have audience claim
      try {
        payload = jwt.verify(token, SECRET_KEY, {
          algorithms: [ALGORITHM],
        });
      } catch (verifyError) {
        console.error('Socket.io: Token verification failed', {
          error: verifyError.message,
          name: verifyError.name,
          audienceError: audienceError.message,
          tokenPrefix: token.substring(0, 50) + '...',
          secretKeyLength: SECRET_KEY ? SECRET_KEY.length : 0,
          algorithm: ALGORITHM,
        });
        throw verifyError;
      }
    }

    // Check token type - EXACT same logic as middleware (line 75-79 in auth.ts)
    const tokenType = payload.type || 'access';
    
    // Handle session tokens - EXACT same logic as middleware (line 76 in auth.ts)
    // The middleware checks: if (tokenType === 'session' && payload.user)
    // But our tokens have user_profile, not user, so we handle both
    if (tokenType === 'session') {
      // First check for payload.user (as middleware does) - legacy format
      if (payload.user) {
        // Return user object directly (same as middleware line 78)
        return payload.user;
      }
      
      // If no payload.user, check for user_profile (current format from helpers.ts)
      // This is what our tokens actually have, so we need to handle it
      if (payload.user_profile) {
        // Construct user object from user_profile - merge with top-level fields
        const userId = String(payload.sub || payload.user_profile.user_id || payload.user_id);
        if (!userId) {
          console.error('Socket.io: No user_id found in session token', {
            hasSub: !!payload.sub,
            hasUserProfileUserId: !!payload.user_profile?.user_id,
            payloadKeys: Object.keys(payload),
          });
          return null;
        }
        
        // Build user object - prioritize user_profile fields, then top-level payload fields
        const user = {
          uid: userId,
          user_id: userId,
          // Top-level fields from payload (email, username, etc. are at root level)
          email: payload.email || payload.user_profile.email || null,
          username: payload.username || payload.user_profile.user_name || null,
          first_name: payload.first_name || payload.user_profile.first_name || null,
          last_name: payload.last_name || payload.user_profile.last_name || null,
          // Include all user_profile fields (this will override any duplicates above)
          ...payload.user_profile,
          // Ensure uid and user_id are set correctly (override user_profile values if needed)
          uid: userId,
          user_id: userId,
        };
        return user;
      }
      
      // Fallback: extract from payload directly (same as middleware would do for access tokens)
      const userId = payload.sub || payload.user_id;
      if (userId) {
        const user = {
          uid: String(userId),
          user_id: String(userId),
          email: payload.email || null,
          username: payload.username || null,
          first_name: payload.first_name || null,
          last_name: payload.last_name || null,
        };
        return user;
      }
      
      console.error('Socket.io: Session token but no user data found', {
        hasUser: !!payload.user,
        hasUserProfile: !!payload.user_profile,
        hasSub: !!payload.sub,
        payloadKeys: Object.keys(payload),
      });
      return null;
    }

    // For access tokens - same logic as middleware (line 82-91 in auth.ts)
    const userId = payload.sub || payload.user_id;
    if (!userId) {
      console.error('Socket.io: Token validation failed - no user_id found', {
        tokenType,
        hasUser: !!payload.user,
        hasUserProfile: !!payload.user_profile,
        payloadKeys: Object.keys(payload),
      });
      return null;
    }

    // Return minimal user object for access tokens (same as middleware)
    const user = {
      uid: String(userId),
      user_id: String(userId),
      email: payload.email || null,
      username: payload.username || null,
      first_name: payload.first_name || null,
      last_name: payload.last_name || null,
    };
    return user;
  } catch (error) {
    // Log the specific error for debugging - same error handling as middleware
    if (error.name === 'TokenExpiredError') {
      console.warn('Socket.io: Token expired', { 
        error: error.message,
        expiredAt: error.expiredAt,
      });
    } else if (error.name === 'JsonWebTokenError') {
      console.error('Socket.io: Invalid token format', { 
        error: error.message,
        tokenPrefix: token.substring(0, 50) + '...',
      });
    } else {
      console.error('Socket.io: Token validation error', { 
        error: error.message, 
        name: error.name,
        stack: error.stack,
        tokenPrefix: token.substring(0, 50) + '...',
      });
    }
    return null;
  }
}

// ==============================================================================
// Initialize server after Next.js is ready
// ==============================================================================
app.prepare().then(() => {
  // Create HTTP server
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // ==============================================================================
  // Initialize Socket.io
  // ==============================================================================
  const io = new Server(httpServer, {
    cors: {
      // Allow all origins in development, or use CORS_ORIGINS in production
      origin: process.env.NODE_ENV === 'production' 
        ? (process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'])
        : true, // Allow all origins in development
      methods: ['GET', 'POST'],
      credentials: true,
      allowedHeaders: ['Authorization', 'X-Session-Token', 'Content-Type'],
    },
    transports: ['websocket', 'polling'],
    // Allow connections from any origin - we validate tokens anyway
    allowEIO3: true,
  });

  // ==============================================================================
  // Socket.io authentication middleware
  // Allow connections from any origin - we validate tokens for security
  // ==============================================================================
  io.use((socket, next) => {
    // Log origin for debugging (but don't block based on it)
    const origin = socket.handshake.headers.origin || socket.handshake.headers.referer || 'unknown';
    
    // Try multiple ways to get the token (for compatibility)
    let token = null;
    
    // Priority 1: auth.token (primary method from client)
    if (socket.handshake.auth?.token) {
      token = socket.handshake.auth.token;
    }
    // Priority 2: query.token (fallback from client)
    else if (socket.handshake.query?.token) {
      token = typeof socket.handshake.query.token === 'string' 
        ? socket.handshake.query.token 
        : socket.handshake.query.token[0];
    }
    // Priority 3: Authorization header (fallback from client extraHeaders)
    else if (socket.handshake.headers?.authorization) {
      const authHeader = socket.handshake.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.replace('Bearer ', '').trim();
      } else {
        token = authHeader.trim();
      }
    }

    if (!token) {
      console.error('Socket.io: No token provided in handshake', {
        origin,
        auth: socket.handshake.auth,
        query: socket.handshake.query,
        headers: Object.keys(socket.handshake.headers || {}),
        authKeys: Object.keys(socket.handshake.auth || {}),
        queryKeys: Object.keys(socket.handshake.query || {}),
      });
      return next(new Error('Authentication error: No token provided'));
    }

    // Validate token and get user
    let user;
    try {
      user = validateSocketToken(token);
    } catch (validationError) {
      return next(new Error('Authentication error: Invalid token'));
    }

    if (!user) {
      return next(new Error('Authentication error: Invalid token'));
    }

      // Ensure user_id is set correctly
      const userId = user.uid || user.user_id;
      if (!userId) {
        return next(new Error('Authentication error: Invalid token - missing user_id'));
      }

      socket.user = user;
      socket.userId = userId;
      next();
  });

  // ==============================================================================
  // Socket.io connection handler
  // ==============================================================================
  io.on('connection', (socket) => {
    const userId = socket.userId;
    const user = socket.user;

    // Join user-specific room
    socket.join(`user:${userId}`);

    // Join admin room if user is admin
    // Check if user has admin groups (handle both array and object formats)
    const userGroups = user?.groups || [];
    const isAdmin = Array.isArray(userGroups) 
      ? userGroups.some((g) => (typeof g === 'object' ? g.codename : g) === 'admin' || (typeof g === 'object' ? g.codename : g) === 'super_admin')
      : false;
    
    if (isAdmin) {
      socket.join('admin');
    }

    // Handle notification events
    socket.on('notification:subscribe', () => {
      socket.join('notifications');
      socket.emit('notification:subscribed', { userId });
    });

    socket.on('notification:unsubscribe', () => {
      socket.leave('notifications');
    });

    // Handle dashboard subscription for real-time stats
    socket.on('dashboard:subscribe', () => {
      socket.join('dashboard');
      socket.emit('dashboard:subscribed', { userId });
    });

    socket.on('dashboard:unsubscribe', () => {
      socket.leave('dashboard');
    });

    // Handle activity subscription for real-time activity logs
    socket.on('activity:subscribe', () => {
      socket.join('activity');
      socket.emit('activity:subscribed', { userId });
    });

    socket.on('activity:unsubscribe', () => {
      socket.leave('activity');
    });

    // Handle media subscription for real-time media updates
    socket.on('media:subscribe', () => {
      socket.join('media');
      socket.emit('media:subscribed', { userId });
    });

    socket.on('media:unsubscribe', () => {
      socket.leave('media');
    });

    // Handle support ticket events
    socket.on('ticket:join', (data) => {
      const { ticketId } = data;
      if (ticketId) {
        socket.join(`ticket:${ticketId}`);
        socket.emit('ticket:joined', { ticketId });
      }
    });

    socket.on('ticket:leave', (data) => {
      const { ticketId } = data;
      if (ticketId) {
        socket.leave(`ticket:${ticketId}`);
      }
    });

    // Handle typing indicators for ticket messages
    socket.on('ticket:typing:start', (data) => {
      const { ticketId } = data;
      if (ticketId) {
        // Broadcast to all other users in the ticket room (not the sender)
        socket.to(`ticket:${ticketId}`).emit('ticket:typing', {
          ticketId,
          userId,
          user: {
            user_id: userId,
            first_name: user?.first_name,
            last_name: user?.last_name,
            user_name: user?.user_name,
            email: user?.email,
          },
          isTyping: true,
        });
      }
    });

    socket.on('ticket:typing:stop', (data) => {
      const { ticketId } = data;
      if (ticketId) {
        // Broadcast to all other users in the ticket room (not the sender)
        socket.to(`ticket:${ticketId}`).emit('ticket:typing', {
          ticketId,
          userId,
          user: {
            user_id: userId,
            first_name: user?.first_name,
            last_name: user?.last_name,
            user_name: user?.user_name,
            email: user?.email,
          },
          isTyping: false,
        });
      }
    });

    // Handle chat events
    socket.on('chat:join', (data) => {
      const { chatId } = data;
      if (chatId) {
        socket.join(`chat:${chatId}`);
        socket.emit('chat:joined', { chatId });
      }
    });

    socket.on('chat:leave', (data) => {
      const { chatId } = data;
      if (chatId) {
        socket.leave(`chat:${chatId}`);
      }
    });

    // Handle typing indicators
    socket.on('chat:typing:start', (data) => {
      const { chatId } = data;
      if (chatId) {
        // Broadcast to all other users in the chat room (not the sender)
        socket.to(`chat:${chatId}`).emit('chat:typing', {
          chatId,
          userId,
          user: {
            user_id: userId,
            first_name: user?.first_name,
            last_name: user?.last_name,
            user_name: user?.user_name,
            email: user?.email,
          },
          isTyping: true,
        });
      }
    });

    socket.on('chat:typing:stop', (data) => {
      const { chatId } = data;
      if (chatId) {
        // Broadcast to all other users in the chat room (not the sender)
        socket.to(`chat:${chatId}`).emit('chat:typing', {
          chatId,
          userId,
          user: {
            user_id: userId,
            first_name: user?.first_name,
            last_name: user?.last_name,
            user_name: user?.user_name,
            email: user?.email,
          },
          isTyping: false,
        });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
    });

    // Ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong');
    });
  });

  // Export io instance for use in API routes
  global.io = io;

  // ==============================================================================
  // Start HTTP server
  // ==============================================================================
  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> WebSocket server initialized`);
      console.log(`> Using Turbopack (Next.js 15 default)`);
    });
});
