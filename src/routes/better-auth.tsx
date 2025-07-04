import { createClient } from '@libsql/client';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import { Layout } from '../components/Layout';
import { users } from '../db/auth-schema';
import { settings } from '../db/schema';
import { createAuth } from '../lib/auth';
import { createDb } from '../db';
import { validateAuthEnvVars } from '../utils/env-validation';
import type { Bindings } from '../types';

const betterAuthApp = new Hono<{ Bindings: Bindings }>();

// Login page - Google OAuth only
betterAuthApp.get('/signin', async (c) => {
  const error = c.req.query('error');
  const redirectUrl = c.req.query('redirect') || '/admin';
  
  // Get all required data for Layout component
  const db = createDb(c.env);
  
  // Check for user session
  const { getUser } = await import('../middleware/better-auth');
  const user = await getUser(c);
  
  // Get logo URL
  const logoUrlSetting = await db.select().from(settings).where(eq(settings.key, 'logo_url')).get();
  const logoUrl = logoUrlSetting?.value || undefined;
  
  // Get favicon URL
  const faviconUrlSetting = await db.select().from(settings).where(eq(settings.key, 'favicon_url')).get();
  const faviconUrl = faviconUrlSetting?.value || undefined;
  
  // Get navbar pages
  const { isNotNull } = await import('drizzle-orm');
  const { pages } = await import('../db/schema');
  const navbarPages = await db
    .select({
      id: pages.id,
      title: pages.title,
      path: pages.path,
      navbarOrder: pages.navbarOrder,
    })
    .from(pages)
    .where(isNotNull(pages.navbarOrder))
    .orderBy(pages.navbarOrder)
    .all();

  return c.html(
    <Layout
      title="Sign In - Utah Churches"
      description="Sign in to manage your churches"
      currentPath="/auth/signin"
      user={user}
      faviconUrl={faviconUrl}
      logoUrl={logoUrl}
      pages={navbarPages}
    >
      <div class="min-h-[calc(100vh-200px)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div class="w-full max-w-md space-y-8">
          {/* Header */}
          <div class="text-center">
            <div class="mx-auto w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
              <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h2 class="text-3xl font-bold text-gray-900 tracking-tight">Sign In</h2>
          </div>

          {/* Error Alert */}
          {error && (
            <div class="bg-red-50 border border-red-200 rounded-xl p-4 animate-pulse">
              <div class="flex">
                <div class="flex-shrink-0">
                  <svg class="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div class="ml-3">
                  <h3 class="text-sm font-medium text-red-800">Authentication Error</h3>
                  <p class="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Main Card */}
          <div class="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div class="px-8 py-10">
              {/* Google Sign In Button */}
              <div class="space-y-6">
                <a
                  href={`/auth/google?redirect=${encodeURIComponent(redirectUrl)}`}
                  class="group relative w-full flex justify-center items-center px-6 py-4 border-2 border-gray-200 rounded-xl text-base font-semibold text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
                >
                  <svg class="w-5 h-5 mr-3 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
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
                  <div class="absolute inset-0 rounded-xl ring-2 ring-primary-500 opacity-0 group-focus:opacity-100 transition-opacity" />
                </a>

                {/* Divider */}
                <div class="relative">
                  <div class="absolute inset-0 flex items-center">
                    <div class="w-full border-t border-gray-200" />
                  </div>
                  <div class="relative flex justify-center text-sm">
                    <span class="px-4 bg-white text-gray-500 font-medium">Secure & Private</span>
                  </div>
                </div>

              </div>
            </div>

            {/* Footer */}
            <div class="px-8 py-6 bg-gray-50 border-t border-gray-100">
              <p class="text-center text-xs text-gray-500 leading-relaxed">
                Secure authentication provided by Google OAuth
              </p>
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
});

// Google OAuth initiation
betterAuthApp.get('/google', async (c) => {
  // Validate OAuth environment variables
  try {
    validateAuthEnvVars(c.env);
  } catch (error) {
    console.error('OAuth configuration error:', error);
    return c.redirect('/auth/signin?error=OAuth configuration missing');
  }
  
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
    // Validate OAuth environment variables
    validateAuthEnvVars(c.env);
    
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
        image: googleUser.picture || null,
        emailVerified: true,
        role: isFirstUser ? 'admin' : 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      await db.insert(users).values(newUser);
      user = newUser;
    } else {
      // Update existing user's image if they don't have one
      if (!user.image && googleUser.picture) {
        await db.update(users)
          .set({ 
            image: googleUser.picture,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id));
        user.image = googleUser.picture;
      }
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
  // Clear the session cookie by setting it with maxAge 0
  setCookie(c, 'session', '', {
    path: '/',
    maxAge: 0,
  });

  return c.redirect('/');
});

// Handle signout (POST route for forms)
betterAuthApp.post('/signout', async (c) => {
  // Clear the session cookie by setting it with maxAge 0
  setCookie(c, 'session', '', {
    path: '/',
    maxAge: 0,
  });

  return c.redirect('/');
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
