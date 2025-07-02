import { Hono } from 'hono';
import type { Bindings } from '../types';
import { requireAdmin, getUser } from '../middleware/unified-auth';
import { getAllUsersWithRoles, updateUserRole } from '../middleware/clerk-rbac';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { users } from '../db/auth-schema';
import { eq } from 'drizzle-orm';
import { UserRoleManager } from '../components/admin/UserRoleManager';
import { Layout } from '../components/Layout';

const adminUsersUnifiedApp = new Hono<{ Bindings: Bindings }>();

// Apply admin middleware to all routes
adminUsersUnifiedApp.use('*', requireAdmin);

// Helper to get all users based on auth system
async function getAllUsers(c: any) {
  const useBetterAuth = c.env.USE_BETTER_AUTH === 'true';
  
  if (useBetterAuth) {
    // Get users from better-auth database
    const client = createClient({
      url: c.env.TURSO_DATABASE_URL,
      authToken: c.env.TURSO_AUTH_TOKEN,
    });
    const db = drizzle(client, { schema: { users } });
    const betterAuthUsers = await db.select().from(users).orderBy(users.createdAt);
    
    // Convert to consistent format
    return betterAuthUsers.map(user => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      firstName: user.name?.split(' ')[0] || '',
      lastName: user.name?.split(' ').slice(1).join(' ') || '',
    }));
  } else {
    // Get users from Clerk
    return await getAllUsersWithRoles(c);
  }
}

// Helper to update user role based on auth system
async function updateUserRoleUnified(c: any, userId: string, newRole: 'admin' | 'contributor', updatedBy: string) {
  const useBetterAuth = c.env.USE_BETTER_AUTH === 'true';
  
  if (useBetterAuth) {
    // Update role in better-auth database
    const client = createClient({
      url: c.env.TURSO_DATABASE_URL,
      authToken: c.env.TURSO_AUTH_TOKEN,
    });
    const db = drizzle(client, { schema: { users } });
    
    try {
      await db.update(users)
        .set({ 
          role: newRole,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));
      return true;
    } catch (error) {
      console.error('Error updating user role:', error);
      return false;
    }
  } else {
    // Update role in Clerk
    return await updateUserRole(c, userId, newRole, updatedBy);
  }
}

// List all users with role management
adminUsersUnifiedApp.get('/', async (c) => {
  const currentUser = getUser(c);
  const users = await getAllUsers(c);

  return c.html(
    <Layout title="User Management - Admin" user={currentUser} currentPath="/admin/users" clerkPublishableKey={c.env.CLERK_PUBLISHABLE_KEY || ''}>
      <UserRoleManager users={users} currentUserId={currentUser.id} />
    </Layout>
  );
});

// Update user role
adminUsersUnifiedApp.post('/:userId/role', async (c) => {
  const currentUser = getUser(c);
  const userId = c.req.param('userId');
  const formData = await c.req.formData();
  const newRole = formData.get('newRole') as 'admin' | 'contributor';

  if (!newRole || (newRole !== 'admin' && newRole !== 'contributor')) {
    return c.redirect('/admin/users?error=invalid-role');
  }

  // Prevent users from changing their own role
  if (userId === currentUser.id) {
    return c.redirect('/admin/users?error=cannot-change-own-role');
  }

  const success = await updateUserRoleUnified(c, userId, newRole, currentUser.id);

  if (success) {
    return c.redirect('/admin/users?success=role-updated');
  } else {
    return c.redirect('/admin/users?error=update-failed');
  }
});

// Bulk role update page
adminUsersUnifiedApp.get('/bulk', async (c) => {
  const currentUser = getUser(c);

  return c.html(
    <Layout title="Bulk User Update - Admin" user={currentUser} currentPath="/admin/users" clerkPublishableKey={c.env.CLERK_PUBLISHABLE_KEY || ''}>
      <div class="max-w-4xl mx-auto p-6">
        <h1 class="text-3xl font-bold mb-6">Bulk User Role Update</h1>
        
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold mb-4">Update Multiple Users</h2>
          
          <form method="POST" action="/admin/users/bulk" class="space-y-4">
            <div>
              <label for="userEmails" class="block text-sm font-medium text-gray-700 mb-2">
                User Emails (one per line)
              </label>
              <textarea
                id="userEmails"
                name="userEmails"
                rows={10}
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="user1@example.com&#10;user2@example.com&#10;user3@example.com"
              ></textarea>
            </div>
            
            <div>
              <label for="role" class="block text-sm font-medium text-gray-700 mb-2">
                New Role
              </label>
              <select
                id="role"
                name="role"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a role</option>
                <option value="admin">Admin</option>
                <option value="contributor">Contributor</option>
              </select>
            </div>
            
            <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <div class="flex">
                <div class="ml-3">
                  <p class="text-sm text-yellow-700">
                    <strong>Warning:</strong> This will update all listed users to the selected role. 
                    Make sure you've reviewed the email list carefully.
                  </p>
                </div>
              </div>
            </div>
            
            <div class="flex justify-end gap-4">
              <a
                href="/admin/users"
                class="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancel
              </a>
              <button
                type="submit"
                class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Update Roles
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
});

// Handle bulk role update
adminUsersUnifiedApp.post('/bulk', async (c) => {
  const currentUser = getUser(c);
  const formData = await c.req.formData();
  const userEmails = (formData.get('userEmails') as string)?.split('\n').map(email => email.trim()).filter(Boolean);
  const newRole = formData.get('role') as 'admin' | 'contributor';

  if (!userEmails || userEmails.length === 0) {
    return c.redirect('/admin/users/bulk?error=no-emails');
  }

  if (!newRole || (newRole !== 'admin' && newRole !== 'contributor')) {
    return c.redirect('/admin/users/bulk?error=invalid-role');
  }

  const useBetterAuth = c.env.USE_BETTER_AUTH === 'true';
  let successCount = 0;
  let errorCount = 0;

  if (useBetterAuth) {
    // Update users in better-auth database
    const client = createClient({
      url: c.env.TURSO_DATABASE_URL,
      authToken: c.env.TURSO_AUTH_TOKEN,
    });
    const db = drizzle(client, { schema: { users } });

    for (const email of userEmails) {
      try {
        const result = await db.update(users)
          .set({ 
            role: newRole,
            updatedAt: new Date()
          })
          .where(eq(users.email, email));
        
        if (result.changes > 0) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        console.error(`Error updating user ${email}:`, error);
        errorCount++;
      }
    }
  } else {
    // Use existing Clerk bulk update logic
    // This would need to be implemented based on the existing bulk update functionality
    return c.redirect('/admin/users/bulk?error=bulk-not-implemented-clerk');
  }

  if (errorCount === 0) {
    return c.redirect(`/admin/users?success=bulk-updated&count=${successCount}`);
  } else {
    return c.redirect(`/admin/users?warning=partial-success&success=${successCount}&errors=${errorCount}`);
  }
});

export { adminUsersUnifiedApp };