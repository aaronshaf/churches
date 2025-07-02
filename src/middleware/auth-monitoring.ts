import type { MiddlewareHandler } from 'hono';

// Auth event types for monitoring
export type AuthEvent = {
  type: 'login_attempt' | 'login_success' | 'login_failure' | 'logout' | 'session_check' | 'role_check' | 'auth_error';
  system: 'clerk' | 'better-auth';
  userId?: string;
  userRole?: string;
  error?: string;
  timestamp: number;
  userAgent?: string;
  ipAddress?: string;
  path?: string;
};

// Simple in-memory event store (in production, this could be sent to external monitoring)
const authEvents: AuthEvent[] = [];
const MAX_EVENTS = 1000; // Keep last 1000 events

export function logAuthEvent(event: Omit<AuthEvent, 'timestamp'>): void {
  const fullEvent: AuthEvent = {
    ...event,
    timestamp: Date.now(),
  };
  
  authEvents.push(fullEvent);
  
  // Keep only the most recent events
  if (authEvents.length > MAX_EVENTS) {
    authEvents.splice(0, authEvents.length - MAX_EVENTS);
  }
  
  // Log to console for debugging (in production, send to monitoring service)
  console.log(`[AUTH-${event.system.toUpperCase()}] ${event.type}:`, fullEvent);
}

export function getAuthEvents(system?: 'clerk' | 'better-auth', limit = 100): AuthEvent[] {
  const filtered = system ? authEvents.filter(e => e.system === system) : authEvents;
  return filtered.slice(-limit).reverse(); // Most recent first
}

export function getAuthStats(timeWindowMs = 24 * 60 * 60 * 1000): {
  clerk: { total: number; success: number; failure: number; };
  betterAuth: { total: number; success: number; failure: number; };
  totalEvents: number;
} {
  const cutoffTime = Date.now() - timeWindowMs;
  const recentEvents = authEvents.filter(e => e.timestamp > cutoffTime);
  
  const clerkEvents = recentEvents.filter(e => e.system === 'clerk');
  const betterAuthEvents = recentEvents.filter(e => e.system === 'better-auth');
  
  return {
    clerk: {
      total: clerkEvents.length,
      success: clerkEvents.filter(e => e.type === 'login_success').length,
      failure: clerkEvents.filter(e => e.type === 'login_failure' || e.type === 'auth_error').length,
    },
    betterAuth: {
      total: betterAuthEvents.length,
      success: betterAuthEvents.filter(e => e.type === 'login_success').length,
      failure: betterAuthEvents.filter(e => e.type === 'login_failure' || e.type === 'auth_error').length,
    },
    totalEvents: recentEvents.length,
  };
}

// Middleware to add monitoring to auth flows
export const authMonitoringMiddleware: MiddlewareHandler = async (c, next) => {
  const useBetterAuth = c.env.USE_BETTER_AUTH === 'true';
  const system = useBetterAuth ? 'better-auth' : 'clerk';
  const path = c.req.path;
  const userAgent = c.req.header('User-Agent');
  const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
  
  // Monitor session checks
  if (path.startsWith('/admin') || path.startsWith('/auth/')) {
    logAuthEvent({
      type: 'session_check',
      system,
      path,
      userAgent,
      ipAddress,
    });
  }
  
  await next();
};