import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { validateSession } from '../utils/auth';
import { isClerkEnabled } from '../config/features';
import { 
  requireAuth as clerkRequireAuth, 
  requireAdmin as clerkRequireAdmin,
  getCurrentUser as clerkGetCurrentUser 
} from './clerk';

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  // Use Clerk if enabled
  if (isClerkEnabled(c.env)) {
    return clerkRequireAuth(c, next);
  }

  // Fall back to legacy session auth
  const sessionId = getCookie(c, 'session');
  const user = await validateSession(sessionId, c.env);

  if (!user) {
    return c.redirect('/login');
  }

  // Add user to context
  c.set('user', user);

  await next();
};

export const adminMiddleware: MiddlewareHandler = async (c, next) => {
  // Use Clerk RBAC if enabled
  if (isClerkEnabled(c.env)) {
    return clerkRequireAdmin(c, next);
  }

  // Fall back to legacy session auth
  const sessionId = getCookie(c, 'session');
  const user = await validateSession(sessionId, c.env);

  if (!user) {
    return c.redirect('/login');
  }

  // Legacy system: check userType from database
  if (user.userType !== 'admin') {
    return c.html(
      `<div style="padding: 2rem; text-align: center;">
        <h1>Access Denied</h1>
        <p>You don't have permission to access this area.</p>
        <a href="/">Go to Home</a>
      </div>`,
      403
    );
  }

  c.set('user', user);
  await next();
};

// Helper to get current user (for optional auth in public routes)
export const getCurrentUser = async (c: any) => {
  // Use Clerk if enabled
  if (isClerkEnabled(c.env)) {
    return await clerkGetCurrentUser(c);
  }

  // Fall back to legacy session auth
  const sessionId = getCookie(c, 'session');
  if (!sessionId) {
    return null;
  }

  return await validateSession(sessionId, c.env);
};
