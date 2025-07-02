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
  
  // Check publicMetadata from the session (it's in the JWT)
  const sessionClaims = auth.sessionClaims;
  let role = sessionClaims?.publicMetadata?.role || 'user';
  
  // If role is not admin, check directly with Clerk API for fresh data
  if (role !== 'admin' && c.env.CLERK_SECRET_KEY) {
    try {
      const response = await fetch(`https://api.clerk.com/v1/users/${auth.userId}`, {
        headers: {
          Authorization: `Bearer ${c.env.CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const userData = await response.json();
        const freshRole = userData.public_metadata?.role || 'user';
        if (freshRole === 'admin') {
          role = 'admin';
          console.log(`Role updated from JWT cache: ${sessionClaims?.publicMetadata?.role} -> fresh API: ${freshRole}`);
        }
      }
    } catch (error) {
      console.error('Error checking fresh user role:', error);
    }
  }
  
  // Add debugging info to the error page
  const tokenInfo = {
    userId: auth.userId,
    role: role,
    jwtRole: sessionClaims?.publicMetadata?.role || 'user',
    email: sessionClaims?.email,
    iat: sessionClaims?.iat, // Token issued at
    exp: sessionClaims?.exp, // Token expires at
    currentTime: Math.floor(Date.now() / 1000)
  };
  
  if (role !== 'admin') {
    const tokenAge = tokenInfo.currentTime - (tokenInfo.iat || 0);
    const tokenExpiry = tokenInfo.exp || 0;
    const timeUntilExpiry = tokenExpiry - tokenInfo.currentTime;
    
    return c.html(
      `<div style="max-width: 600px; margin: 50px auto; padding: 20px; font-family: sans-serif;">
        <h1 style="color: #dc2626;">Access Denied</h1>
        <p>You need admin privileges to access this area.</p>
        <p>Your current role: <strong>${role}</strong></p>
        <p style="margin-top: 20px; padding: 10px; background-color: #fef3c7; border-radius: 4px; font-size: 14px;">
          <strong>Note:</strong> If you were recently promoted to admin, you may need to 
          <a href="/force-refresh" style="color: #dc2626; text-decoration: underline;">force refresh your session</a> 
          or wait for your JWT token to expire naturally.
        </p>
        <div style="margin-top: 15px; padding: 10px; background-color: #f3f4f6; border-radius: 4px; font-size: 12px;">
          <strong>Debug Info:</strong><br>
          User ID: ${tokenInfo.userId}<br>
          Email: ${sessionClaims?.email || sessionClaims?.emailAddress || 'N/A'}<br>
          JWT Role: ${tokenInfo.jwtRole}<br>
          Fresh API Role: ${role}<br>
          Token age: ${Math.floor(tokenAge / 60)} minutes<br>
          Time until token expiry: ${Math.floor(timeUntilExpiry / 60)} minutes
        </div>
        <div style="margin-top: 20px;">
          <a href="/" style="color: #3b82f6; text-decoration: underline;">Go to homepage</a>
        </div>
      </div>`,
      403
    );
  }
  
  // Add user info to context
  c.set('user', {
    id: auth.userId,
    email: sessionClaims?.email as string,
    role: role as string,
  });
  
  await next();
};

// Helper to get current user (for optional auth routes)
export const getCurrentUser = async (c: Context<{ Bindings: Bindings }>) => {
  const auth = getAuth(c);
  
  if (!auth?.userId) {
    return null;
  }
  
  const sessionClaims = auth.sessionClaims;
  let role = sessionClaims?.publicMetadata?.role || 'user';
  
  // Auto-promote first user to admin
  if (role === 'user') {
    role = await checkAndPromoteFirstUser(c, auth.userId);
  }
  
  return {
    id: auth.userId,
    email: sessionClaims?.email as string,
    role: role as string,
    // For backward compatibility with legacy code
    userType: role === 'admin' ? 'admin' : 'contributor',
  };
};

// Helper to auto-promote the first user to admin
async function checkAndPromoteFirstUser(c: Context<{ Bindings: Bindings }>, userId: string): Promise<string> {
  try {
    const clerk = c.get('clerk');
    
    // Get total user count
    const userList = await clerk.users.getUserList({ limit: 1 });
    
    // If this is the first user, make them admin
    if (userList.totalCount === 1) {
      console.log('First user detected, promoting to admin:', userId);
      
      await clerk.users.updateUser(userId, {
        publicMetadata: {
          role: 'admin'
        }
      });
      
      return 'admin';
    }
    
    return 'user';
  } catch (error) {
    console.error('Error checking/promoting first user:', error);
    return 'user';
  }
}