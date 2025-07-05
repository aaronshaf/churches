import type { Context, MiddlewareHandler } from 'hono';
import { createAuth } from '../lib/auth';
import { EnvironmentError } from '../utils/env-validation';

export const betterAuthMiddleware: MiddlewareHandler = async (c, next) => {
  try {
    const auth = createAuth(c.env);
    c.set('betterAuth', auth);
    await next();
  } catch (error) {
    if (error instanceof EnvironmentError) {
      // Let the global error handler catch this
      throw error;
    }
    throw error;
  }
};

export const requireAuthBetter: MiddlewareHandler = async (c, next) => {
  const auth = c.get('betterAuth');
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session?.user) {
    const isApiRequest = c.req.path.startsWith('/api/') || c.req.header('Accept')?.includes('application/json');

    if (isApiRequest) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const returnUrl = encodeURIComponent(c.req.url);
    return c.redirect(`/auth/signin?return=${returnUrl}`);
  }

  c.set('betterUser', session.user);
  c.set('betterSession', session.session);
  await next();
};

export const requireAdminBetter: MiddlewareHandler = async (c, next) => {
  // Manual session lookup since we're not using better-auth's built-in session management
  const cookies = c.req.header('Cookie') || '';

  const sessionMatch = cookies.match(/session=([^;]+)/);
  if (!sessionMatch) {
    // Check if this is an API request
    const isApiRequest = c.req.path.startsWith('/api/') || c.req.header('Accept')?.includes('application/json');

    if (isApiRequest) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // For HTML requests, redirect to login
    const returnUrl = encodeURIComponent(c.req.url);
    return c.redirect(`/auth/signin?return=${returnUrl}`);
  }

  const sessionId = sessionMatch[1];

  // Look up session in database
  const { drizzle } = await import('drizzle-orm/d1');
  const { eq } = await import('drizzle-orm');
  const { users, sessions } = await import('../db/auth-schema');
  const { validateDatabaseEnvVars } = await import('../utils/env-validation');

  // Validate environment variables
  validateDatabaseEnvVars(c.env);

  const db = drizzle(c.env.DB, { schema: { users, sessions } });

  const session = await db
    .select({
      sessionId: sessions.id,
      userId: sessions.userId,
      expiresAt: sessions.expiresAt,
      userEmail: users.email,
      userName: users.name,
      userImage: users.image,
      userRole: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, sessionId))
    .get();

  if (!session) {
    const isApiRequest = c.req.path.startsWith('/api/') || c.req.header('Accept')?.includes('application/json');

    if (isApiRequest) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const returnUrl = encodeURIComponent(c.req.url);
    return c.redirect(`/auth/signin?return=${returnUrl}`);
  }

  if (new Date(session.expiresAt) < new Date()) {
    const isApiRequest = c.req.path.startsWith('/api/') || c.req.header('Accept')?.includes('application/json');

    if (isApiRequest) {
      return c.json({ error: 'Session expired' }, 401);
    }

    const returnUrl = encodeURIComponent(c.req.url);
    return c.redirect(`/auth/signin?return=${returnUrl}`);
  }

  if (session.userRole !== 'admin') {
    const isApiRequest = c.req.path.startsWith('/api/') || c.req.header('Accept')?.includes('application/json');

    if (isApiRequest) {
      return c.json({ error: 'Forbidden - Admin access required' }, 403);
    }

    // Import error handling utilities
    const { AppError } = await import('../utils/async-handler');
    throw new AppError('Admin access required', 403, 'Permission Error');
  }
  c.set('betterUser', {
    id: session.userId,
    email: session.userEmail,
    name: session.userName,
    image: session.userImage,
    role: session.userRole,
  });

  await next();
};

export const requireContributorBetter: MiddlewareHandler = async (c, next) => {
  const auth = c.get('betterAuth');
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session?.user) {
    const isApiRequest = c.req.path.startsWith('/api/') || c.req.header('Accept')?.includes('application/json');

    if (isApiRequest) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const returnUrl = encodeURIComponent(c.req.url);
    return c.redirect(`/auth/signin?return=${returnUrl}`);
  }

  if (session.user.role !== 'admin' && session.user.role !== 'contributor') {
    const isApiRequest = c.req.path.startsWith('/api/') || c.req.header('Accept')?.includes('application/json');

    if (isApiRequest) {
      return c.json({ error: 'Forbidden - Contributor access required' }, 403);
    }

    // Import error handling utilities
    const { AppError } = await import('../utils/async-handler');
    throw new AppError('Contributor access required', 403, 'Permission Error');
  }

  c.set('betterUser', session.user);
  c.set('betterSession', session.session);
  await next();
};

export const getUser = async (c: Context): Promise<any | null> => {
  const cookies = c.req.header('Cookie') || '';
  const sessionMatch = cookies.match(/session=([^;]+)/);

  if (!sessionMatch) {
    return null;
  }

  const sessionId = sessionMatch[1];

  try {
    // Look up session in database
    const { drizzle } = await import('drizzle-orm/d1');
    const { eq } = await import('drizzle-orm');
    const { users, sessions } = await import('../db/auth-schema');
    const { validateDatabaseEnvVars } = await import('../utils/env-validation');

    // Validate environment variables
    validateDatabaseEnvVars(c.env);

    const db = drizzle(c.env.DB, { schema: { users, sessions } });

    const session = await db
      .select({
        userId: sessions.userId,
        expiresAt: sessions.expiresAt,
        userEmail: users.email,
        userName: users.name,
        userImage: users.image,
        userRole: users.role,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.id, sessionId))
      .get();

    if (!session || new Date(session.expiresAt) < new Date()) {
      return null;
    }

    return {
      id: session.userId,
      email: session.userEmail,
      name: session.userName,
      image: session.userImage,
      role: session.userRole,
    };
  } catch (error) {
    console.error('Error getting user session:', error);
    return null;
  }
};
