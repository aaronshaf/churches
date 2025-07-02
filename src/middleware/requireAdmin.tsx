import type { MiddlewareHandler } from 'hono';
import { requireAdmin as clerkRequireAdmin } from './clerk-rbac';

// Admin middleware - uses Clerk with role-based access control
export const requireAdminMiddleware: MiddlewareHandler = async (c, next) => {
  return clerkRequireAdmin(c, next);
};
