import { Hono } from 'hono';
import type { Bindings } from '../types';
import { createAuth } from '../lib/auth';
import { BetterAuthLogin } from '../components/BetterAuthLogin';
import { Layout } from '../components/Layout';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { users } from '../db/auth-schema';
import { eq } from 'drizzle-orm';

const betterAuthApp = new Hono<{ Bindings: Bindings }>();

// Login page
betterAuthApp.get('/signin', async (c) => {
  const error = c.req.query('error');
  const redirectUrl = c.req.query('redirect') || '/admin';
  
  return c.html(
    <Layout title="Sign In" currentPath="/auth/signin">
      <BetterAuthLogin error={error} redirectUrl={redirectUrl} />
    </Layout>
  );
});

// Handle login
betterAuthApp.post('/signin', async (c) => {
  const formData = await c.req.formData();
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const redirectUrl = formData.get('redirectUrl') as string || '/';
  
  const auth = createAuth(c.env);
  
  try {
    const result = await auth.api.signInEmail({
      body: {
        email,
        password,
      },
    });
    
    if (!result.data) {
      return c.redirect('/auth/signin?error=Invalid credentials');
    }
    
    // Forward the session cookie
    const cookies = result.headers.get('set-cookie');
    if (cookies) {
      c.header('Set-Cookie', cookies);
    }
    
    // Redirect based on role
    if (result.data.user.role === 'admin') {
      return c.redirect('/admin');
    } else {
      return c.redirect(redirectUrl);
    }
  } catch (error) {
    console.error('Login error:', error);
    return c.redirect('/auth/signin?error=Login failed');
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

// User registration (optional, for initial setup)
betterAuthApp.get('/signup', async (c) => {
  return c.html(
    <Layout title="Sign Up" currentPath="/auth/signup">
      <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div class="max-w-md w-full space-y-8">
          <div>
            <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Create an account
            </h2>
          </div>
          
          <form class="mt-8 space-y-6" method="POST" action="/auth/signup">
            <div class="rounded-md shadow-sm -space-y-px">
              <div>
                <label for="name" class="sr-only">
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autocomplete="name"
                  required
                  class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Full name"
                />
              </div>
              <div>
                <label for="email" class="sr-only">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autocomplete="email"
                  required
                  class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Email address"
                />
              </div>
              <div>
                <label for="password" class="sr-only">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autocomplete="new-password"
                  required
                  class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Password"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Sign up
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
});

// Handle registration
betterAuthApp.post('/signup', async (c) => {
  const formData = await c.req.formData();
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  
  const auth = createAuth(c.env);
  
  try {
    const result = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
      },
    });
    
    if (!result.data) {
      return c.redirect('/auth/signup?error=Registration failed');
    }
    
    // Set session cookie
    const cookies = result.headers.get('set-cookie');
    if (cookies) {
      c.header('Set-Cookie', cookies);
    }
    
    // Check if this is the first user to make them admin
    const client = createClient({
      url: c.env.TURSO_DATABASE_URL,
      authToken: c.env.TURSO_AUTH_TOKEN,
    });
    const db = drizzle(client, { schema: { users } });
    const userCount = await db.select().from(users).limit(2);
    
    if (userCount.length === 1) {
      // Make first user admin
      await db.update(users)
        .set({ role: 'admin' })
        .where(eq(users.email, email));
      
      return c.redirect('/admin');
    }
    
    return c.redirect('/');
  } catch (error) {
    console.error('Registration error:', error);
    return c.redirect('/auth/signup?error=Registration failed');
  }
});

export { betterAuthApp };