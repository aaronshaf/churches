import { Hono } from 'hono';
import { Layout } from '../../components/Layout';
import { createDbWithContext } from '../../db';
import { users } from '../../db/auth-schema';
import { requireAdminBetter } from '../../middleware/better-auth';
import type { D1SessionVariables } from '../../middleware/d1-session';
import type { AuthVariables, Bindings } from '../../types';
import { getCommonLayoutProps } from '../../utils/layout-props';

type Variables = AuthVariables & D1SessionVariables;

export const authCoreRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Debug login helper
authCoreRoutes.get('/debug/login', async (c) => {
  const db = createDbWithContext(c);
  const allUsers = await db.select().from(users).all();

  return c.html(`
    <html>
      <head><title>Debug Login</title></head>
      <body>
        <h1>Debug Login</h1>
        <h2>All Users:</h2>
        <ul>
          ${allUsers.map((user) => `<li>${user.email} - ${user.role}</li>`).join('')}
        </ul>
      </body>
    </html>
  `);
});

// Login redirect
authCoreRoutes.get('/login', async (c) => {
  return c.redirect('/auth/signin');
});

// OAuth callback handler
authCoreRoutes.get('/auth/callback', async (c) => {
  const layoutProps = await getCommonLayoutProps(c);

  return c.html(
    <Layout title="Signing In..." {...layoutProps}>
      <div class="max-w-2xl mx-auto px-4 py-8">
        <div class="text-center">
          <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <h1 class="mt-4 text-xl font-medium text-gray-900">Signing you in...</h1>
          <p class="mt-2 text-gray-500">Please wait while we complete your authentication.</p>
        </div>
      </div>
    </Layout>
  );
});

// Logout redirect
authCoreRoutes.get('/logout', async (c) => {
  return c.redirect('/auth/signout');
});

// Force refresh - logout and refresh
authCoreRoutes.get('/force-refresh', async (c) => {
  return c.redirect('/auth/signout');
});
