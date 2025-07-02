import { clerkMiddleware as honoClerkMiddleware, getAuth } from '@hono/clerk-auth';
import type { Context, Next } from 'hono';
import type { Bindings } from '../types';

// Re-export the base Clerk middleware
export const clerkMiddleware = honoClerkMiddleware;

// User role types
export type UserRole = 'admin' | 'contributor' | 'user';

export interface ClerkUser {
  id: string;
  email?: string;
  username?: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  // For backward compatibility with legacy code
  userType?: 'admin' | 'contributor';
}

export interface ClerkPublicMetadata {
  role?: UserRole;
  approvedAt?: string;
  approvedBy?: string;
}

// Helper to get user with role from Clerk
const getUserWithRole = async (c: Context<{ Bindings: Bindings }>, userId: string, sessionClaims?: any): Promise<ClerkUser | null> => {
  try {
    if (!c.env.CLERK_SECRET_KEY) {
      console.error('CLERK_SECRET_KEY not available');
      return null;
    }

    const response = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${c.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Clerk API error fetching user:', response.status, response.statusText);
      return null;
    }

    const user = await response.json();
    
    // Extract role from publicMetadata, default to 'user'
    const metadata = user.public_metadata as ClerkPublicMetadata;
    const roleFromJWT = sessionClaims?.publicMetadata?.role || 'user';
    const freshRole = metadata?.role || 'user';
    
    // For admin roles from JWT, trust the cached value to avoid unnecessary future API calls
    // For non-admin roles, always use fresh data to ensure accurate permissions
    const role = (roleFromJWT === 'admin' && freshRole === 'admin') ? 'admin' : freshRole;
    
    // Log role changes for debugging
    if (roleFromJWT !== freshRole) {
      console.log(`Role updated from JWT cache: ${roleFromJWT} -> fresh API: ${freshRole}`);
    }
    
    return {
      id: user.id,
      email: user.email_addresses?.[0]?.email_address,
      username: user.username || user.first_name || user.email_addresses?.[0]?.email_address,
      role,
      firstName: user.first_name || undefined,
      lastName: user.last_name || undefined,
      userType: role === 'admin' ? 'admin' : 'contributor', // Backward compatibility
    };
  } catch (error) {
    console.error('Error fetching user from Clerk:', error);
    return null;
  }
};

// Helper to check if user is authenticated (any role)
export const requireAuth = async (c: Context<{ Bindings: Bindings }>, next: Next) => {
  const auth = getAuth(c);
  
  if (!auth?.userId) {
    return c.redirect('/login');
  }
  
  const user = await getUserWithRole(c, auth.userId, auth.sessionClaims);
  if (!user) {
    return c.redirect('/login');
  }
  
  // Add user info to context
  c.set('user', user);
  
  await next();
};

// Helper to check if user is admin
export const requireAdmin = async (c: Context<{ Bindings: Bindings }>, next: Next) => {
  const auth = getAuth(c);
  
  if (!auth?.userId) {
    return c.redirect('/login');
  }
  
  const user = await getUserWithRole(c, auth.userId, auth.sessionClaims);
  if (!user) {
    return c.redirect('/login');
  }
  
  // Check if user has admin role
  if (user.role !== 'admin') {
    return c.html(
      `<div style="padding: 2rem; text-align: center;">
        <h1>Access Denied</h1>
        <p>You don't have permission to access this area.</p>
        <p>Required role: <strong>admin</strong></p>
        <p>Your current role: <strong>${user.role}</strong></p>
        <div style="margin-top: 2rem;">
          <a href="/" style="margin-right: 1rem;">Go to Home</a>
        </div>
      </div>`,
      403
    );
  }
  
  // Add user info to context
  c.set('user', user);
  
  await next();
};

// Helper to check if user is contributor or admin
export const requireContributor = async (c: Context<{ Bindings: Bindings }>, next: Next) => {
  const auth = getAuth(c);
  
  if (!auth?.userId) {
    return c.redirect('/login');
  }
  
  const user = await getUserWithRole(c, auth.userId, auth.sessionClaims);
  if (!user) {
    return c.redirect('/login');
  }
  
  // Both contributors and admins can access contributor features
  if (user.role !== 'contributor' && user.role !== 'admin') {
    return c.html(
      `<div style="padding: 2rem; text-align: center;">
        <h1>Access Denied</h1>
        <p>You need to be a contributor or admin to access this feature.</p>
        <p>Your current role: <strong>${user.role}</strong></p>
        <div style="margin-top: 2rem;">
          <a href="/">Go to Home</a>
        </div>
      </div>`,
      403
    );
  }
  
  // Add user info to context
  c.set('user', user);
  
  await next();
};

// Helper to get current user (for optional auth routes)
export const getCurrentUser = async (c: Context<{ Bindings: Bindings }>): Promise<ClerkUser | null> => {
  const auth = getAuth(c);
  
  if (!auth?.userId) {
    return null;
  }
  
  return await getUserWithRole(c, auth.userId);
};

// Helper to update user role (admin only)
export const updateUserRole = async (
  c: Context<{ Bindings: Bindings }>, 
  userId: string, 
  newRole: UserRole,
  updatedBy: string
): Promise<boolean> => {
  try {
    if (!c.env.CLERK_SECRET_KEY) {
      console.error('CLERK_SECRET_KEY not available');
      return false;
    }

    const response = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${c.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        public_metadata: {
          role: newRole,
          approvedAt: new Date().toISOString(),
          approvedBy: updatedBy,
        },
      }),
    });

    if (!response.ok) {
      console.error('Clerk API error updating user role:', response.status, response.statusText);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error updating user role:', error);
    return false;
  }
};

// Helper to get all users with roles (for admin management)
export const getAllUsersWithRoles = async (
  c: Context<{ Bindings: Bindings }>,
  limit = 100
): Promise<ClerkUser[]> => {
  try {
    if (!c.env.CLERK_SECRET_KEY) {
      console.error('CLERK_SECRET_KEY not available');
      return [];
    }

    const response = await fetch(`https://api.clerk.com/v1/users?limit=${limit}`, {
      headers: {
        Authorization: `Bearer ${c.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Clerk API error:', response.status, response.statusText);
      return [];
    }

    const userList = await response.json();
    
    return userList.map((user: any) => {
      const metadata = user.public_metadata as ClerkPublicMetadata;
      return {
        id: user.id,
        email: user.email_addresses?.[0]?.email_address,
        username: user.username || user.first_name || user.email_addresses?.[0]?.email_address,
        role: metadata?.role || 'user',
        firstName: user.first_name || undefined,
        lastName: user.last_name || undefined,
      };
    });
  } catch (error) {
    console.error('Error fetching users from Clerk:', error);
    return [];
  }
};