import { Hono } from 'hono';
import type { Bindings } from '../types';
import { requireContributor, getUser } from '../middleware/unified-auth';
import { createClient } from '@libsql/client';
import { churchSuggestions, comments } from '../db/schema';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { Layout } from '../components/Layout';

const contributorApp = new Hono<{ Bindings: Bindings }>();

// Apply contributor middleware to all routes
contributorApp.use('*', requireContributor);

// Dashboard for contributors
contributorApp.get('/dashboard', async (c) => {
  const user = getUser(c);
  const db = drizzle(createClient({ 
    url: c.env.TURSO_DATABASE_URL,
    authToken: c.env.TURSO_AUTH_TOKEN,
  }));

  // Get user's suggestions
  const userSuggestions = await db.select()
    .from(churchSuggestions)
    .where(eq(churchSuggestions.userId, user.id))
    .orderBy(churchSuggestions.createdAt);

  // Get user's comments
  const userComments = await db.select()
    .from(comments)
    .where(eq(comments.userId, user.id))
    .orderBy(comments.createdAt);

  return c.html(
    <Layout title="Contributor Dashboard" user={user} currentPath="/contributor/dashboard" clerkPublishableKey={c.env.CLERK_PUBLISHABLE_KEY || ''}>
      <div class="max-w-6xl mx-auto p-6">
        <h1 class="text-3xl font-bold mb-6">Contributor Dashboard</h1>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div class="bg-white p-6 rounded-lg shadow">
            <h2 class="text-xl font-semibold mb-2">Your Suggestions</h2>
            <p class="text-3xl font-bold text-blue-600">{userSuggestions.length}</p>
            <p class="text-gray-600">Church suggestions submitted</p>
            <a href="/contributor/suggest" class="text-blue-500 hover:underline mt-2 inline-block">
              Suggest a new church →
            </a>
          </div>
          
          <div class="bg-white p-6 rounded-lg shadow">
            <h2 class="text-xl font-semibold mb-2">Your Comments</h2>
            <p class="text-3xl font-bold text-green-600">{userComments.length}</p>
            <p class="text-gray-600">Comments posted</p>
          </div>
        </div>

        {/* Recent Suggestions */}
        <div class="bg-white rounded-lg shadow mb-8">
          <div class="px-6 py-4 border-b">
            <h2 class="text-xl font-semibold">Recent Suggestions</h2>
          </div>
          <div class="p-6">
            {userSuggestions.length === 0 ? (
              <p class="text-gray-500">No suggestions yet. <a href="/contributor/suggest" class="text-blue-500 hover:underline">Suggest a church</a></p>
            ) : (
              <div class="space-y-4">
                {userSuggestions.slice(0, 5).map((suggestion) => (
                  <div key={suggestion.id} class="border-l-4 border-gray-200 pl-4">
                    <h3 class="font-semibold">{suggestion.churchName}</h3>
                    <p class="text-sm text-gray-600">
                      {suggestion.city}, {suggestion.state} • 
                      <span class={`ml-2 px-2 py-1 text-xs rounded ${
                        suggestion.status === 'approved' ? 'bg-green-100 text-green-800' :
                        suggestion.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {suggestion.status}
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
});

// Suggest a church form
contributorApp.get('/suggest', async (c) => {
  const user = getUser(c);

  return c.html(
    <Layout title="Suggest a Church" user={user} currentPath="/contributor/suggest" clerkPublishableKey={c.env.CLERK_PUBLISHABLE_KEY || ''}>
      <div class="max-w-3xl mx-auto p-6">
        <h1 class="text-3xl font-bold mb-6">Suggest a Church</h1>
        
        <form method="POST" action="/contributor/suggest" class="bg-white rounded-lg shadow p-6">
          <div class="mb-4">
            <label for="churchName" class="block text-sm font-medium text-gray-700 mb-2">
              Church Name *
            </label>
            <input
              type="text"
              id="churchName"
              name="churchName"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div class="mb-4">
            <label for="address" class="block text-sm font-medium text-gray-700 mb-2">
              Address
            </label>
            <input
              type="text"
              id="address"
              name="address"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label for="city" class="block text-sm font-medium text-gray-700 mb-2">
                City
              </label>
              <input
                type="text"
                id="city"
                name="city"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label for="state" class="block text-sm font-medium text-gray-700 mb-2">
                State
              </label>
              <input
                type="text"
                id="state"
                name="state"
                value="UT"
                readonly
                class="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
              />
            </div>
            <div>
              <label for="zip" class="block text-sm font-medium text-gray-700 mb-2">
                ZIP Code
              </label>
              <input
                type="text"
                id="zip"
                name="zip"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div class="mb-4">
            <label for="website" class="block text-sm font-medium text-gray-700 mb-2">
              Website
            </label>
            <input
              type="url"
              id="website"
              name="website"
              placeholder="https://"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label for="phone" class="block text-sm font-medium text-gray-700 mb-2">
                Phone
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label for="email" class="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div class="mb-6">
            <label for="notes" class="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={4}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            ></textarea>
          </div>

          <div class="flex justify-end gap-4">
            <a
              href="/contributor/dashboard"
              class="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
            >
              Cancel
            </a>
            <button
              type="submit"
              class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Submit Suggestion
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
});

// Handle church suggestion submission
contributorApp.post('/suggest', async (c) => {
  const user = getUser(c);
  const formData = await c.req.formData();
  
  const db = drizzle(createClient({ 
    url: c.env.TURSO_DATABASE_URL,
    authToken: c.env.TURSO_AUTH_TOKEN,
  }));

  try {
    await db.insert(churchSuggestions).values({
      userId: user.id,
      churchName: formData.get('churchName') as string,
      address: formData.get('address') as string || undefined,
      city: formData.get('city') as string || undefined,
      state: formData.get('state') as string || 'UT',
      zip: formData.get('zip') as string || undefined,
      website: formData.get('website') as string || undefined,
      phone: formData.get('phone') as string || undefined,
      email: formData.get('email') as string || undefined,
      notes: formData.get('notes') as string || undefined,
    });

    return c.redirect('/contributor/dashboard?success=suggestion');
  } catch (error) {
    console.error('Error saving suggestion:', error);
    return c.html(
      <Layout title="Error" user={user} clerkPublishableKey={c.env.CLERK_PUBLISHABLE_KEY || ''}>
        <div class="max-w-3xl mx-auto p-6">
          <h1 class="text-2xl font-bold mb-4">Error</h1>
          <p class="text-red-600">Failed to save your suggestion. Please try again.</p>
          <a href="/contributor/suggest" class="text-blue-500 hover:underline">Go back</a>
        </div>
      </Layout>
    );
  }
});

// Add comment to a church
contributorApp.post('/churches/:id/comment', async (c) => {
  const user = getUser(c);
  const churchId = parseInt(c.req.param('id'));
  const formData = await c.req.formData();
  
  const db = drizzle(createClient({ 
    url: c.env.TURSO_DATABASE_URL,
    authToken: c.env.TURSO_AUTH_TOKEN,
  }));

  try {
    await db.insert(comments).values({
      userId: user.id,
      churchId: churchId,
      content: formData.get('content') as string,
      isPublic: formData.get('isPublic') === 'true',
    });

    return c.redirect(`/churches/${c.req.param('path')}?success=comment`);
  } catch (error) {
    console.error('Error saving comment:', error);
    return c.redirect(`/churches/${c.req.param('path')}?error=comment`);
  }
});

export { contributorApp };