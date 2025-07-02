import type { Context, MiddlewareHandler } from 'hono';
import { createAuth } from '../lib/auth';

export const betterAuthMiddleware: MiddlewareHandler = async (c, next) => {
  const auth = createAuth(c.env);
  c.set('betterAuth', auth);
  await next();
};

export const requireAuthBetter: MiddlewareHandler = async (c, next) => {
  const auth = c.get('betterAuth');
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session?.user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  c.set('betterUser', session.user);
  c.set('betterSession', session.session);
  await next();
};

export const requireAdminBetter: MiddlewareHandler = async (c, next) => {
  const auth = c.get('betterAuth');
  
  // Debug logging
  const cookies = c.req.header('Cookie');
  console.log('Request cookies:', cookies);
  
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  console.log('Better-auth session result:', session);

  if (!session?.user) {
    console.log('No session or user found, returning 401');
    return c.json({ error: 'Unauthorized' }, 401);
  }

  if (session.user.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  c.set('betterUser', session.user);
  c.set('betterSession', session.session);
  await next();
};

export const requireContributorBetter: MiddlewareHandler = async (c, next) => {
  const auth = c.get('betterAuth');
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session?.user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  if (session.user.role !== 'admin' && session.user.role !== 'contributor') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  c.set('betterUser', session.user);
  c.set('betterSession', session.session);
  await next();
};

export const getUser = async (c: Context): Promise<any | null> => {
  const auth = c.get('betterAuth');
  if (!auth) return null;

  try {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });
    return session?.user || null;
  } catch (error) {
    console.error('Error getting user session:', error);
    return null;
  }
};
