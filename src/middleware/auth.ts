import type { MiddlewareHandler } from 'hono';
import { 
  requireAuth as clerkRequireAuth, 
  requireAdmin as clerkRequireAdmin,
  getCurrentUser as clerkGetCurrentUser 
} from './clerk-rbac';

// Authentication middleware - uses Clerk
export const authMiddleware: MiddlewareHandler = async (c, next) => {
  return clerkRequireAuth(c, next);
};

// Admin middleware - uses Clerk with role-based access control
export const adminMiddleware: MiddlewareHandler = async (c, next) => {
  return clerkRequireAdmin(c, next);
};

// Helper to get current user (for optional auth in public routes)
export const getCurrentUser = async (c: any) => {
  const user = await clerkGetCurrentUser(c);
  // Return null instead of user with undefined properties
  return user && user.id ? user : null;
};
