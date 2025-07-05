import type { MiddlewareHandler } from 'hono';
import { getUser } from './better-auth';

/**
 * Middleware that redirects unauthenticated users to login
 * with a return URL to come back after authentication
 */
export const requireAuthWithRedirect: MiddlewareHandler = async (c, next) => {
  const user = await getUser(c);

  if (!user) {
    const returnUrl = encodeURIComponent(c.req.url);
    return c.redirect(`/auth/signin?returnTo=${returnUrl}`);
  }

  c.set('betterUser', user);
  await next();
};

/**
 * Middleware that redirects non-admin users to login
 * with a return URL to come back after authentication
 */
export const requireAdminWithRedirect: MiddlewareHandler = async (c, next) => {
  const user = await getUser(c);

  if (!user) {
    const returnUrl = encodeURIComponent(c.req.url);
    return c.redirect(`/auth/signin?returnTo=${returnUrl}`);
  }

  if (user.role !== 'admin') {
    // User is authenticated but not an admin
    return c.html(
      <div style="text-align: center; padding: 2rem;">
        <h1>Access Denied</h1>
        <p>You need admin permissions to access this page.</p>
        <a href="/" style="color: blue; text-decoration: underline;">
          Go back home
        </a>
      </div>,
      403
    );
  }

  c.set('betterUser', user);
  await next();
};

/**
 * Middleware that redirects non-admin/contributor users to login
 * with a return URL to come back after authentication
 */
export const requireContributorWithRedirect: MiddlewareHandler = async (c, next) => {
  const user = await getUser(c);

  if (!user) {
    const returnUrl = encodeURIComponent(c.req.url);
    return c.redirect(`/auth/signin?returnTo=${returnUrl}`);
  }

  if (user.role !== 'admin' && user.role !== 'contributor') {
    // User is authenticated but not an admin or contributor
    return c.html(
      <div style="text-align: center; padding: 2rem;">
        <h1>Access Denied</h1>
        <p>You need admin or contributor permissions to access this page.</p>
        <a href="/" style="color: blue; text-decoration: underline;">
          Go back home
        </a>
      </div>,
      403
    );
  }

  c.set('betterUser', user);
  await next();
};
