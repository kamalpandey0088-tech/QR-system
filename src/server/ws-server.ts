/**
 * @fileoverview Socket.io WebSocket server for real-time KDS and customer notifications.
 * @security
 * - JWT authentication on every connection
 * - Tenant room isolation prevents cross-tenant data leakage
 * - Role-based event filtering
 * - Auto-reconnection with REST fallback
 *
 * This runs as a SEPARATE process from Next.js (not inside API routes).
 * Start with: npm run ws:dev (development) or npm run ws:start (production)
 */

import { createServer } from 'node:http';
import { Server } from 'socket.io';
import * as jose from 'jose';
import { SOCKET_EVENTS } from '@/types';

// ── Environment Validation ───────────────────────────────────

const WS_PORT = parseInt(process.env.WS_PORT ?? '4000', 10);
const AUTH_SECRET = process.env.AUTH_SECRET;
const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',');

if (!AUTH_SECRET) {
  console.error('[WS-SERVER] FATAL: AUTH_SECRET is not set. Refusing to start.');
  process.exit(1);
}

// ── Server Setup ─────────────────────────────────────────────

const httpServer = createServer((_req, res) => {
  // Health check endpoint for the WS server
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', service: 'websocket' }));
});

const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGINS,
    credentials: true,
  },
  pingInterval: 25000,
  pingTimeout: 20000,
  transports: ['websocket', 'polling'],
});

// ── JWT Authentication Middleware ────────────────────────────

/**
 * Authenticates WebSocket connections using JWT.
 * @security Every connection must present a valid JWT with tenant and role claims.
 * Connections without valid tokens are immediately rejected.
 */
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token as string | undefined;

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    // Verify JWT using jose (edge-compatible)
    const secret = new TextEncoder().encode(AUTH_SECRET);
    const { payload } = await jose.jwtVerify(token, secret);

    const tenantId = payload.tenantId as string | undefined;
    const role = payload.role as string | undefined;
    const userId = payload.userId as string | undefined;

    if (!tenantId || !role || !userId) {
      return next(new Error('Invalid token: missing required claims'));
    }

    // Attach verified claims to socket data
    socket.data.tenantId = tenantId;
    socket.data.role = role;
    socket.data.userId = userId;

    next();
  } catch (error) {
    // Do NOT log the token itself - it's sensitive
    console.error('[WS-AUTH] Authentication failed for connection');
    next(new Error('Authentication failed'));
  }
});

// ── Connection Handler ───────────────────────────────────────

io.on('connection', (socket) => {
  const { tenantId, role, userId } = socket.data;

  // Join tenant-specific room for isolation
  const tenantRoom = `tenant:${tenantId}`;
  socket.join(tenantRoom);

  // Chefs join the kitchen room
  if (role === 'CHEF' || role === 'CAFE_OWNER' || role === 'SUPER_ADMIN') {
    socket.join(`${tenantRoom}:kitchen`);
  }

  console.info(`[WS] User connected: role=${role} tenant=${tenantId}`);

  // Send confirmation
  socket.emit(SOCKET_EVENTS.AUTHENTICATED, {
    userId,
    role,
    tenantId,
  });

  // ── Event Handlers ───────────────────────────────────────

  /**
   * Chef accepts an order (moves PAID -> PREPARING)
   */
  socket.on(SOCKET_EVENTS.ORDER_ACCEPT, (data: { orderId: string }) => {
    if (role !== 'CHEF' && role !== 'CAFE_OWNER' && role !== 'SUPER_ADMIN') {
      socket.emit(SOCKET_EVENTS.AUTH_ERROR, { message: 'Unauthorized' });
      return;
    }

    // Broadcast to all clients in the tenant room
    io.to(tenantRoom).emit(SOCKET_EVENTS.ORDER_PREPARING, {
      orderId: data.orderId,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Chef marks order as ready
   */
  socket.on(SOCKET_EVENTS.ORDER_MARK_READY, (data: { orderId: string }) => {
    if (role !== 'CHEF' && role !== 'CAFE_OWNER' && role !== 'SUPER_ADMIN') {
      socket.emit(SOCKET_EVENTS.AUTH_ERROR, { message: 'Unauthorized' });
      return;
    }

    // Notify all clients (including customer) in the tenant room
    io.to(tenantRoom).emit(SOCKET_EVENTS.ORDER_READY, {
      orderId: data.orderId,
      timestamp: new Date().toISOString(),
    });
  });

  // ── Disconnect Handler ───────────────────────────────────

  socket.on('disconnect', (reason) => {
    console.info(`[WS] User disconnected: role=${role} reason=${reason}`);
  });
});

// ── Public API for emitting events from API routes ───────────

/**
 * Emits an event to a specific tenant's room.
 * Called by API routes (e.g., webhook handler) to notify KDS of new orders.
 */
export function emitToTenant(tenantId: string, event: string, data: unknown): void {
  io.to(`tenant:${tenantId}`).emit(event, data);
}

/**
 * Emits an event specifically to the kitchen room of a tenant.
 */
export function emitToKitchen(tenantId: string, event: string, data: unknown): void {
  io.to(`tenant:${tenantId}:kitchen`).emit(event, data);
}

// ── Start Server ─────────────────────────────────────────────

httpServer.listen(WS_PORT, () => {
  console.info(`[WS-SERVER] WebSocket server running on port ${WS_PORT}`);
  console.info(`[WS-SERVER] CORS origins: ${CORS_ORIGINS.join(', ')}`);
});

// ── Graceful Shutdown ────────────────────────────────────────

process.on('SIGTERM', () => {
  console.info('[WS-SERVER] SIGTERM received. Shutting down gracefully...');
  io.close(() => {
    httpServer.close(() => {
      console.info('[WS-SERVER] Server closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.info('[WS-SERVER] SIGINT received. Shutting down...');
  io.close(() => {
    httpServer.close(() => {
      process.exit(0);
    });
  });
});

export { io, httpServer };
