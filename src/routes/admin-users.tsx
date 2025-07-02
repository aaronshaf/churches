import { Hono } from 'hono';
import type { Bindings } from '../types';
import { requireAdminMiddleware } from '../middleware/requireAdmin';
import { getAllUsersWithRoles, updateUserRole } from '../middleware/clerk-rbac';
import { UserRoleManager } from '../components/admin/UserRoleManager';
import { Layout } from '../components/Layout';

const adminUsersApp = new Hono<{ Bindings: Bindings }>();

// Apply admin middleware to all routes
adminUsersApp.use('*', requireAdminMiddleware);

// List all users with role management
adminUsersApp.get('/', async (c) => {
  const currentUser = c.get('user');
  const users = await getAllUsersWithRoles(c);

  return c.html(
    <Layout title="User Management - Admin" user={currentUser} currentPath="/admin/users" clerkPublishableKey={c.env.CLERK_PUBLISHABLE_KEY || ''}>
      <UserRoleManager users={users} currentUserId={currentUser.id} />
    </Layout>
  );
});

// Update user role
adminUsersApp.post('/:userId/role', async (c) => {
  const currentUser = c.get('user');
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

  const success = await updateUserRole(c, userId, newRole, currentUser.id);

  if (success) {
    return c.redirect('/admin/users?success=role-updated');
  } else {
    return c.redirect('/admin/users?error=update-failed');
  }
});

// Bulk role update page
adminUsersApp.get('/bulk', async (c) => {
  const currentUser = c.get('user');

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
                class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
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
adminUsersApp.post('/bulk', async (c) => {
  const currentUser = c.get('user');
  const formData = await c.req.formData();
  const userEmails = (formData.get('userEmails') as string).split('\n').map(e => e.trim()).filter(e => e);
  const role = formData.get('role') as 'admin' | 'contributor';

  if (!role || (role !== 'admin' && role !== 'contributor')) {
    return c.redirect('/admin/users/bulk?error=invalid-role');
  }

  let successCount = 0;
  let failCount = 0;

  for (const email of userEmails) {
    try {
      // Search for user by email using Clerk API
      const response = await fetch(`https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}`, {
        headers: {
          Authorization: `Bearer ${c.env.CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const users = await response.json();
        if (users.length > 0) {
          const success = await updateUserRole(c, users[0].id, role, currentUser.id);
          if (success) {
            successCount++;
          } else {
            failCount++;
          }
        } else {
          failCount++;
        }
      } else {
        failCount++;
      }
    } catch (error) {
      console.error(`Error updating user ${email}:`, error);
      failCount++;
    }
  }

  return c.redirect(`/admin/users?bulk-success=${successCount}&bulk-fail=${failCount}`);
});

export { adminUsersApp };