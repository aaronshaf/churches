import type { MiddlewareHandler } from 'hono';
import { 
  requireAuth as clerkRequireAuth, 
  requireAdmin as clerkRequireAdmin,
  requireContributor as clerkRequireContributor,
  getCurrentUser as clerkGetCurrentUser 
} from './clerk-rbac';
import {
  requireAuthBetter,
  requireAdminBetter,
  requireContributorBetter
} from './better-auth';
import { logAuthEvent } from './auth-monitoring';

// Helper to check if using better-auth
const useBetterAuth = (c: any) => c.env.USE_BETTER_AUTH === 'true';

// Unified authentication middleware
export const requireAuth: MiddlewareHandler = async (c, next) => {
  const system = useBetterAuth(c) ? 'better-auth' : 'clerk';
  
  try {
    if (useBetterAuth(c)) {
      await requireAuthBetter(c, next);
    } else {
      await clerkRequireAuth(c, next);
    }
  } catch (error) {
    logAuthEvent({
      type: 'auth_error',
      system,
      error: error.message,
      path: c.req.path,
    });
    throw error;
  }
};

// Unified admin middleware
export const requireAdmin: MiddlewareHandler = async (c, next) => {
  const system = useBetterAuth(c) ? 'better-auth' : 'clerk';
  
  try {
    if (useBetterAuth(c)) {
      await requireAdminBetter(c, next);
    } else {
      await clerkRequireAdmin(c, next);
    }
    
    // Log successful role check
    const user = getUser(c);
    logAuthEvent({
      type: 'role_check',
      system,
      userId: user?.id,
      userRole: 'admin',
      path: c.req.path,
    });
  } catch (error) {
    logAuthEvent({
      type: 'auth_error',
      system,
      error: error.message,
      path: c.req.path,
    });
    throw error;
  }
};

// Unified contributor middleware
export const requireContributor: MiddlewareHandler = async (c, next) => {
  if (useBetterAuth(c)) {
    return requireContributorBetter(c, next);
  }
  return clerkRequireContributor(c, next);
};

// Helper to get current user (for optional auth in public routes)
export const getCurrentUser = async (c: any) => {
  if (useBetterAuth(c)) {
    const auth = c.get('betterAuth');
    if (!auth) return null;
    
    try {
      const session = await auth.api.getSession({ 
        headers: c.req.raw.headers 
      });
      return session?.user || null;
    } catch {
      return null;
    }
  }
  
  const user = await clerkGetCurrentUser(c);
  // Return null instead of user with undefined properties
  return user && user.id ? user : null;
};

// Get user from context (after middleware has run)
export const getUser = (c: any) => {
  if (useBetterAuth(c)) {
    return c.get('betterUser');
  }
  return c.get('user');
};