import { createClient } from '@libsql/client';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { Hono } from 'hono';
import { UserRoleManager } from '../components/admin/UserRoleManager';
import { Layout } from '../components/Layout';
import { users } from '../db/auth-schema';
import { getUser, requireAdminBetter } from '../middleware/better-auth';
import type { Bindings } from '../types';

const adminUsersApp = new Hono<{ Bindings: Bindings }>();

// Apply admin middleware to all routes
adminUsersApp.use('*', requireAdminBetter);

// Users management page
adminUsersApp.get('/', async (c) => {
  const currentUser = await getUser(c);
  const db = drizzle(
    createClient({
      url: c.env.TURSO_DATABASE_URL,
      authToken: c.env.TURSO_AUTH_TOKEN,
    }),
    { schema: { users } }
  );

  // Get all users
  const allUsers = await db.select().from(users).orderBy(users.createdAt);

  return c.html(
    <Layout title="User Management - Admin" user={currentUser} currentPath="/admin/users">
      <UserRoleManager users={allUsers} currentUserId={currentUser?.id || ''} />
    </Layout>
  );
});

// Handle role updates
adminUsersApp.post('/:userId/role', async (c) => {
  const userId = c.req.param('userId');
  const formData = await c.req.formData();
  const newRole = formData.get('newRole') as string;

  if (!['admin', 'contributor', 'user'].includes(newRole)) {
    return c.json({ error: 'Invalid role' }, 400);
  }

  const db = drizzle(
    createClient({
      url: c.env.TURSO_DATABASE_URL,
      authToken: c.env.TURSO_AUTH_TOKEN,
    }),
    { schema: { users } }
  );

  try {
    // Update user role
    await db
      .update(users)
      .set({
        role: newRole as 'admin' | 'contributor' | 'user',
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return c.redirect('/admin/users?success=role-updated');
  } catch (error) {
    console.error('Error updating user role:', error);
    return c.redirect('/admin/users?error=role-update-failed');
  }
});

export { adminUsersApp };
