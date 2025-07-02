import type { MiddlewareHandler } from 'hono';
import { 
  requireAuth,
  requireAdmin,
  getCurrentUser as getUnifiedCurrentUser
} from './unified-auth';

// Authentication middleware - uses unified auth (Clerk or better-auth based on flag)
export const authMiddleware: MiddlewareHandler = async (c, next) => {
  return requireAuth(c, next);
};

// Admin middleware - uses unified auth with role-based access control
export const adminMiddleware: MiddlewareHandler = async (c, next) => {
  return requireAdmin(c, next);
};

// Helper to get current user (for optional auth in public routes)
export const getCurrentUser = async (c: any) => {
  return getUnifiedCurrentUser(c);
};
