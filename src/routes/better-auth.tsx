import { createClient } from '@libsql/client';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { Hono } from 'hono';
import { Layout } from '../components/Layout';
import { users } from '../db/auth-schema';
import { createAuth } from '../lib/auth';
import type { Bindings } from '../types';

const betterAuthApp = new Hono<{ Bindings: Bindings }>();

// Login page - Google OAuth only
betterAuthApp.get('/signin', async (c) => {
  const error = c.req.query('error');
  const redirectUrl = c.req.query('redirect') || '/admin';

  return c.html(
    <Layout title="Sign In" currentPath="/auth/signin">
      <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div class="max-w-md w-full space-y-8">
          <div>
            <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">Sign in to your account</h2>
            <p class="mt-2 text-center text-sm text-gray-600">Sign in with your Google account to continue</p>
          </div>

          {error && (
            <div class="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded relative" role="alert">
              <span class="block sm:inline">{error}</span>
            </div>
          )}

          <div class="mt-8">
            <a
              href={`/auth/google?redirect=${encodeURIComponent(redirectUrl)}`}
              class="group relative w-full flex justify-center py-3 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <svg class="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </a>
          </div>
        </div>
      </div>
    </Layout>
  );
});

// Google OAuth initiation - redirect to better-auth's sign-in
betterAuthApp.get('/google', async (c) => {
  const redirectUrl = c.req.query('redirect') || '/admin';
  
  // Store redirect URL in session/cookie for after OAuth
  c.header('Set-Cookie', `auth_redirect=${encodeURIComponent(redirectUrl)}; Path=/; HttpOnly; Max-Age=600`);
  
  // Redirect to better-auth's Google sign-in endpoint
  return c.redirect('/api/auth/sign-in/social/google');
});

// Google OAuth callback - let better-auth handle this, but check for first admin
betterAuthApp.get('/callback/google', async (c) => {
  // First, let better-auth handle the OAuth callback
  const auth = createAuth(c.env);
  
  try {
    // Get current session after OAuth
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (session?.user) {
      // Check if this is the first user and make them admin
      const client = createClient({
        url: c.env.TURSO_DATABASE_URL,
        authToken: c.env.TURSO_AUTH_TOKEN,
      });
      const db = drizzle(client, { schema: { users } });
      
      // Count total users
      const userCount = await db.select().from(users).limit(2);
      
      if (userCount.length === 1) {
        // This is the first user, make them admin
        await db.update(users).set({ role: 'admin' }).where(eq(users.email, session.user.email));
        console.log('First user made admin:', session.user.email);
      }
      
      // Get redirect URL from cookie
      const cookies_header = c.req.header('Cookie') || '';
      const redirectMatch = cookies_header.match(/auth_redirect=([^;]+)/);
      const redirectUrl = redirectMatch ? decodeURIComponent(redirectMatch[1]) : '/admin';

      // Clear redirect cookie
      c.header('Set-Cookie', 'auth_redirect=; Path=/; HttpOnly; Max-Age=0');

      return c.redirect(redirectUrl);
    } else {
      throw new Error('No session created after OAuth');
    }
  } catch (error) {
    console.error('OAuth callback processing error:', error);
    return c.redirect('/auth/signin?error=OAuth callback failed');
  }
});

// Handle signout (GET route for simple redirect)
betterAuthApp.get('/signout', async (c) => {
  const auth = createAuth(c.env);

  try {
    const response = await auth.api.signOut({
      headers: c.req.raw.headers,
    });

    // Clear session cookie
    const cookies = response.headers.get('set-cookie');
    if (cookies) {
      c.header('Set-Cookie', cookies);
    }

    return c.redirect('/');
  } catch (error) {
    console.error('Signout error:', error);
    return c.redirect('/');
  }
});

// Handle signout (POST route for forms)
betterAuthApp.post('/signout', async (c) => {
  const auth = createAuth(c.env);

  try {
    const response = await auth.api.signOut({
      headers: c.req.raw.headers,
    });

    // Clear session cookie
    const cookies = response.headers.get('set-cookie');
    if (cookies) {
      c.header('Set-Cookie', cookies);
    }

    return c.redirect('/');
  } catch (error) {
    console.error('Signout error:', error);
    return c.redirect('/');
  }
});

// Signup redirects to signin (Google OAuth only)
betterAuthApp.get('/signup', async (c) => {
  return c.redirect('/auth/signin');
});

// Test route to check cookies
betterAuthApp.get('/test-session', async (c) => {
  const cookies = c.req.header('Cookie') || '';
  return c.json({
    cookies: cookies,
    headers: Object.fromEntries(c.req.raw.headers.entries()),
  });
});

export { betterAuthApp };
