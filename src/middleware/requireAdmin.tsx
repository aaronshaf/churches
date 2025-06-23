import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { Layout } from '../components/Layout';
import { validateSession } from '../utils/auth';

export const requireAdminMiddleware: MiddlewareHandler = async (c, next) => {
  const sessionId = getCookie(c, 'session');
  const user = await validateSession(sessionId, c.env);

  if (!user) {
    return c.redirect('/login');
  }

  if (user.userType !== 'admin') {
    return c.html(
      <Layout title="Access Denied">
        <div style="text-align: center; padding: 4rem;">
          <h1 style="color: #dc2626; margin-bottom: 1rem;">Access Denied</h1>
          <p style="margin-bottom: 2rem;">You need admin privileges to access this page.</p>
          <a href="/admin" style="color: #3b82f6;">
            Go back to dashboard
          </a>
        </div>
      </Layout>,
      403
    );
  }

  c.set('user', user);

  await next();
};
