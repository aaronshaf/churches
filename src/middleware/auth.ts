import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { validateSession } from '../utils/auth';

export const authMiddleware: MiddlewareHandler = async (c, next) => {
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
  const sessionId = getCookie(c, 'session');
  const user = await validateSession(sessionId, c.env);

  if (!user) {
    return c.redirect('/login');
  }

  // For now, allow all authenticated users to access admin
  // You can add more granular permissions later
  c.set('user', user);

  await next();
};
