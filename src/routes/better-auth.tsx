import { createClient } from '@libsql/client';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
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

// Google OAuth initiation
betterAuthApp.get('/google', async (c) => {
  const redirectUrl = c.req.query('redirect') || '/admin';
  
  // Store redirect URL in session/cookie for after OAuth
  setCookie(c, 'auth_redirect', redirectUrl, {
    path: '/',
    httpOnly: true,
    maxAge: 600
  });
  
  // Create Google OAuth URL
  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.set('client_id', c.env.GOOGLE_CLIENT_ID);
  googleAuthUrl.searchParams.set('redirect_uri', `${c.env.BETTER_AUTH_URL}/auth/callback/google`);
  googleAuthUrl.searchParams.set('response_type', 'code');
  googleAuthUrl.searchParams.set('scope', 'openid email profile');
  googleAuthUrl.searchParams.set('access_type', 'offline');
  
  return c.redirect(googleAuthUrl.toString());
});

// Google OAuth callback
betterAuthApp.get('/callback/google', async (c) => {
  const code = c.req.query('code');
  const error = c.req.query('error');

  if (error) {
    console.error('Google OAuth error:', error);
    return c.redirect('/auth/signin?error=Google OAuth failed');
  }

  if (!code) {
    return c.redirect('/auth/signin?error=No authorization code received');
  }

  try {
    
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: c.env.GOOGLE_CLIENT_ID,
        client_secret: c.env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${c.env.BETTER_AUTH_URL}/auth/callback/google`,
      }),
    });

    const tokens = await tokenResponse.json();
    if (!tokens.access_token) {
      throw new Error('No access token received');
    }

    // Get user info from Google
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const googleUser = await userResponse.json();
    if (!googleUser.email) {
      throw new Error('No email received from Google');
    }


    // Simple manual user/session creation
    const client = createClient({
      url: c.env.TURSO_DATABASE_URL,
      authToken: c.env.TURSO_AUTH_TOKEN,
    });
    const db = drizzle(client, { schema: { users } });

    // Check if user exists
    let user = await db.select().from(users).where(eq(users.email, googleUser.email)).get();
    
    if (!user) {
      const userCount = await db.select().from(users).limit(1);
      const isFirstUser = userCount.length === 0;
      
      const newUser = {
        id: crypto.randomUUID(),
        email: googleUser.email,
        name: googleUser.name || null,
        emailVerified: true,
        role: isFirstUser ? 'admin' : 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      await db.insert(users).values(newUser);
      user = newUser;
    }

    // Create session
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 24 * 30 * 1000);
    
    const { sessions } = await import('../db/auth-schema');
    await db.insert(sessions).values({
      id: sessionId,
      userId: user.id,
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: c.req.header('CF-Connecting-IP') || null,
      userAgent: c.req.header('User-Agent') || null,
    });
    
    // Get redirect URL first
    const cookies_header = c.req.header('Cookie') || '';
    const redirectMatch = cookies_header.match(/auth_redirect=([^;]+)/);
    const redirectUrl = redirectMatch ? decodeURIComponent(redirectMatch[1]) : '/admin';

    // Set session cookie using Hono's setCookie function
    setCookie(c, 'session', sessionId, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    
    // Clear redirect cookie
    setCookie(c, 'auth_redirect', '', {
      path: '/',
      maxAge: 0,
    });
    

    // Try redirect approach instead of HTML response
    return c.redirect(redirectUrl);
  } catch (error) {
    console.error('OAuth callback error:', error);
    return c.redirect('/auth/signin?error=Google sign-in failed');
  }
});

// Remove old manual OAuth - Better Auth handles this automatically

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
