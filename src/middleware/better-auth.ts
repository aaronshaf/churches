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
  // Manual session lookup since we're not using better-auth's built-in session management
  const cookies = c.req.header('Cookie') || '';
  
  const sessionMatch = cookies.match(/session=([^;]+)/);
  if (!sessionMatch) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const sessionId = sessionMatch[1];
  
  // Look up session in database
  const { createClient } = await import('@libsql/client');
  const { drizzle } = await import('drizzle-orm/libsql');
  const { eq } = await import('drizzle-orm');
  const { users, sessions } = await import('../db/auth-schema');
  
  const client = createClient({
    url: c.env.TURSO_DATABASE_URL,
    authToken: c.env.TURSO_AUTH_TOKEN,
  });
  const db = drizzle(client, { schema: { users, sessions } });
  
  const session = await db.select({
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
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  if (new Date(session.expiresAt) < new Date()) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  if (session.userRole !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }
  c.set('betterUser', { 
    id: session.userId,
    email: session.userEmail, 
    name: session.userName,
    image: session.userImage,
    role: session.userRole 
  });

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
  const cookies = c.req.header('Cookie') || '';
  const sessionMatch = cookies.match(/session=([^;]+)/);
  
  if (!sessionMatch) {
    return null;
  }
  
  const sessionId = sessionMatch[1];
  
  try {
    // Look up session in database
    const { createClient } = await import('@libsql/client');
    const { drizzle } = await import('drizzle-orm/libsql');
    const { eq } = await import('drizzle-orm');
    const { users, sessions } = await import('../db/auth-schema');
    
    const client = createClient({
      url: c.env.TURSO_DATABASE_URL,
      authToken: c.env.TURSO_AUTH_TOKEN,
    });
    const db = drizzle(client, { schema: { users, sessions } });
    
    const session = await db.select({
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
      role: session.userRole 
    };
  } catch (error) {
    console.error('Error getting user session:', error);
    return null;
  }
};
