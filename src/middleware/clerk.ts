import { clerkMiddleware as honoClerkMiddleware, getAuth } from '@hono/clerk-auth';
import type { Context, Next } from 'hono';
import type { Bindings } from '../types';

// Re-export the base Clerk middleware
export const clerkMiddleware = honoClerkMiddleware;

// Helper to check if user is authenticated
export const requireAuth = async (c: Context<{ Bindings: Bindings }>, next: Next) => {
  const auth = getAuth(c);
  
  if (!auth?.userId) {
    return c.redirect('/login');
  }
  
  // Add user info to context for compatibility with existing code
  c.set('user', {
    id: auth.userId,
    // We'll get more user data from Clerk client if needed
  });
  
  await next();
};

// Helper to check if user is admin
export const requireAdmin = async (c: Context<{ Bindings: Bindings }>, next: Next) => {
  const auth = getAuth(c);
  
  if (!auth?.userId) {
    return c.redirect('/login');
  }
  
  // Get user metadata from Clerk to check if admin
  const clerk = c.get('clerk');
  try {
    const user = await clerk.users.getUser(auth.userId);
    const userType = user.publicMetadata?.userType || 'contributor';
    
    if (userType !== 'admin') {
      return c.html(
        <div>
          <h1>403 - Forbidden</h1>
          <p>You don't have permission to access this resource.</p>
          <a href="/admin">Go back to admin dashboard</a>
        </div>,
        403
      );
    }
    
    // Add user info to context
    c.set('user', {
      id: auth.userId,
      email: user.emailAddresses[0]?.emailAddress,
      username: user.username || user.emailAddresses[0]?.emailAddress,
      userType: userType as 'admin' | 'contributor',
    });
    
    await next();
  } catch (error) {
    console.error('Error fetching user from Clerk:', error);
    return c.redirect('/login');
  }
};

// Helper to get current user (for optional auth routes)
export const getCurrentUser = async (c: Context<{ Bindings: Bindings }>) => {
  const auth = getAuth(c);
  
  if (!auth?.userId) {
    return null;
  }
  
  try {
    const clerk = c.get('clerk');
    const user = await clerk.users.getUser(auth.userId);
    
    return {
      id: auth.userId,
      email: user.emailAddresses[0]?.emailAddress,
      username: user.username || user.emailAddresses[0]?.emailAddress,
      userType: (user.publicMetadata?.userType || 'contributor') as 'admin' | 'contributor',
    };
  } catch (error) {
    console.error('Error fetching user from Clerk:', error);
    return null;
  }
};