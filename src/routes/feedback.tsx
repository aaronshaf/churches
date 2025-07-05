import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { Layout } from '../components/Layout';
import { createDbWithContext } from '../db';
import { churches, churchSuggestions, comments } from '../db/schema';
import { getUser } from '../middleware/better-auth';
import type { Bindings } from '../types';
import { getNavbarPages } from '../utils/pages';
import { getLogoUrl } from '../utils/settings';

type Variables = {
  user: any;
};

export const feedbackRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Main feedback page
feedbackRoutes.get('/', async (c) => {
  const user = await getUser(c);
  const logoUrl = await getLogoUrl(c.env);
  const navbarPages = await getNavbarPages(c.env);
  const db = createDbWithContext(c);

  // Check referrer for church context
  const referrer = c.req.header('referer');
  let referringChurch = null;
  if (referrer) {
    const churchMatch = referrer.match(/\/churches\/([^/?]+)/);
    if (churchMatch) {
      const churchPath = churchMatch[1];
      referringChurch = await db.select().from(churches).where(eq(churches.path, churchPath)).get();
    }
  }

  // Get query params with defaults based on context
  let feedbackType = c.req.query('type');
  let churchId = c.req.query('churchId');

  // If no type specified but coming from a church page, default to church feedback
  if (!feedbackType && referringChurch) {
    feedbackType = 'church';
  } else if (!feedbackType) {
    feedbackType = 'general';
  }

  // Get church info
  let church = null;
  if (churchId) {
    church = await db
      .select()
      .from(churches)
      .where(eq(churches.id, Number(churchId)))
      .get();
  } else if (referringChurch && feedbackType === 'church') {
    church = referringChurch;
    churchId = referringChurch.id.toString();
  }

  // Get all churches for dropdown
  const allChurches = await db
    .select({
      id: churches.id,
      name: churches.name,
    })
    .from(churches)
    .where(eq(churches.status, 'Listed'))
    .orderBy(churches.name)
    .all();

  return c.html(
    <Layout title="Submit Feedback" user={user} currentPath="/feedback" logoUrl={logoUrl} pages={navbarPages}>
      <div class="min-h-full bg-gray-50">
        <div class="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
          {/* Header */}
          <div class="text-center mb-10">
            <h1 class="text-3xl font-bold text-gray-900">Submit Feedback</h1>
            <p class="mt-3 text-lg text-gray-600">Help us improve by sharing your thoughts and suggestions</p>
            {church && feedbackType === 'church' && (
              <div class="mt-4 inline-flex items-center text-sm text-gray-500">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                Providing feedback for: <span class="font-medium ml-1">{church.name}</span>
              </div>
            )}
          </div>

          {!user ? (
            <div class="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <h3 class="mt-4 text-lg font-medium text-gray-900">Sign in required</h3>
              <p class="mt-2 text-sm text-gray-600">
                You must be signed in to submit feedback. This helps us maintain quality and respond to your
                suggestions.
              </p>
              <div class="mt-6">
                <a
                  href={`/auth/signin?redirect=${encodeURIComponent(c.req.url)}`}
                  class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Sign in to continue
                </a>
              </div>
            </div>
          ) : (
            <div class="space-y-6">
              {/* Feedback Type Selection */}
              <div>
                <div class="grid gap-4 sm:grid-cols-3">
                  <button
                    onclick={`updateFeedbackType('general'${churchId ? `, '${churchId}'` : ''})`}
                    class={`relative rounded-lg border-2 p-6 text-left hover:border-gray-400 transition-all ${
                      feedbackType === 'general'
                        ? 'border-primary-600 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div
                      class={`rounded-lg inline-flex p-3 ${
                        feedbackType === 'general' ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                        />
                      </svg>
                    </div>
                    <div class="mt-4">
                      <p class="font-semibold text-gray-900">General Feedback</p>
                    </div>
                  </button>

                  <button
                    onclick={`updateFeedbackType('church'${churchId ? `, '${churchId}'` : ''})`}
                    class={`relative rounded-lg border-2 p-6 text-left hover:border-gray-400 transition-all ${
                      feedbackType === 'church'
                        ? 'border-primary-600 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div
                      class={`rounded-lg inline-flex p-3 ${
                        feedbackType === 'church' ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        />
                      </svg>
                    </div>
                    <div class="mt-4">
                      <p class="font-semibold text-gray-900">Church Feedback</p>
                    </div>
                  </button>

                  <button
                    onclick={`updateFeedbackType('suggestion'${churchId ? `, '${churchId}'` : ''})`}
                    class={`relative rounded-lg border-2 p-6 text-left hover:border-gray-400 transition-all ${
                      feedbackType === 'suggestion'
                        ? 'border-primary-600 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div
                      class={`rounded-lg inline-flex p-3 ${
                        feedbackType === 'suggestion' ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <div class="mt-4">
                      <p class="font-semibold text-gray-900">Suggest a Church</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Feedback Form */}
              {feedbackType === 'general' && (
                <form method="post" action="/feedback/submit" class="space-y-8">
                  <input type="hidden" name="type" value="general" />
                  <div class="bg-white ring-1 ring-gray-900/5 sm:rounded-xl">
                    <div class="px-4 py-6 sm:p-8">
                      <div class="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
                        <div class="sm:col-span-6">
                          <label for="content" class="block text-sm font-medium leading-6 text-gray-900">
                            What's on your mind?
                          </label>
                          <div class="mt-2">
                            <textarea
                              id="content"
                              name="content"
                              rows={6}
                              required
                              class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                              placeholder="Share your thoughts about Utah Churches..."
                            ></textarea>
                            <p class="mt-3 text-sm text-gray-600">
                              Your feedback helps us improve the website for everyone.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div class="flex items-center justify-end gap-x-6 border-t border-gray-900/10 px-4 py-4 sm:px-8">
                      <button
                        type="button"
                        onclick="window.history.back()"
                        class="text-sm font-semibold leading-6 text-gray-900"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        class="rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                      >
                        Submit Feedback
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {feedbackType === 'church' && (
                <form method="post" action="/feedback/submit" class="space-y-8">
                  <input type="hidden" name="type" value="church" />
                  <div class="bg-white ring-1 ring-gray-900/5 sm:rounded-xl">
                    <div class="px-4 py-6 sm:p-8">
                      <div class="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
                        <div class="sm:col-span-6">
                          <label for="churchId" class="block text-sm font-medium leading-6 text-gray-900">
                            Church <span class="text-red-500">*</span>
                          </label>
                          <div class="mt-2">
                            <select
                              id="churchId"
                              name="churchId"
                              required
                              class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                            >
                              <option value="">Select a church...</option>
                              {allChurches.map((ch) => (
                                <option value={ch.id} selected={church?.id === ch.id}>
                                  {ch.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div class="sm:col-span-6">
                          <label for="content" class="block text-sm font-medium leading-6 text-gray-900">
                            Your feedback <span class="text-red-500">*</span>
                          </label>
                          <div class="mt-2">
                            <textarea
                              id="content"
                              name="content"
                              rows={6}
                              required
                              class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                              placeholder="Provide information about this church..."
                            ></textarea>
                            <p class="mt-3 text-sm text-gray-600">
                              Your feedback helps us maintain accurate information.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div class="flex items-center justify-end gap-x-6 border-t border-gray-900/10 px-4 py-4 sm:px-8">
                      <button
                        type="button"
                        onclick="window.history.back()"
                        class="text-sm font-semibold leading-6 text-gray-900"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        class="rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                      >
                        Submit Feedback
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {feedbackType === 'suggestion' && (
                <form method="post" action="/feedback/suggest-church" class="space-y-8">
                  <div class="bg-white ring-1 ring-gray-900/5 sm:rounded-xl">
                    <div class="px-4 py-6 sm:p-8">
                      <div class="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
                        <div class="sm:col-span-4">
                          <label for="churchName" class="block text-sm font-medium leading-6 text-gray-900">
                            Church Name <span class="text-red-500">*</span>
                          </label>
                          <div class="mt-2">
                            <input
                              type="text"
                              name="churchName"
                              id="churchName"
                              required
                              class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                            />
                          </div>
                        </div>

                        <div class="sm:col-span-6">
                          <label for="address" class="block text-sm font-medium leading-6 text-gray-900">
                            Address
                          </label>
                          <div class="mt-2">
                            <input
                              type="text"
                              name="address"
                              id="address"
                              class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                            />
                          </div>
                        </div>

                        <div class="sm:col-span-3">
                          <label for="website" class="block text-sm font-medium leading-6 text-gray-900">
                            Website
                          </label>
                          <div class="mt-2">
                            <input
                              type="url"
                              name="website"
                              id="website"
                              class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                            />
                          </div>
                        </div>

                        <div class="sm:col-span-3">
                          <label for="phone" class="block text-sm font-medium leading-6 text-gray-900">
                            Phone
                          </label>
                          <div class="mt-2">
                            <input
                              type="tel"
                              name="phone"
                              id="phone"
                              class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                            />
                          </div>
                        </div>

                        <div class="sm:col-span-4">
                          <label for="denomination" class="block text-sm font-medium leading-6 text-gray-900">
                            Denomination/Affiliation
                          </label>
                          <div class="mt-2">
                            <input
                              type="text"
                              name="denomination"
                              id="denomination"
                              class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                            />
                          </div>
                        </div>

                        <div class="sm:col-span-6">
                          <label for="serviceTimes" class="block text-sm font-medium leading-6 text-gray-900">
                            Service Times
                          </label>
                          <div class="mt-2">
                            <textarea
                              name="serviceTimes"
                              id="serviceTimes"
                              rows={3}
                              class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                              placeholder="e.g., Sunday 10:30 AM, Wednesday 7:00 PM"
                            ></textarea>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div class="flex items-center justify-end gap-x-6 border-t border-gray-900/10 px-4 py-4 sm:px-8">
                      <button
                        type="button"
                        onclick="window.history.back()"
                        class="text-sm font-semibold leading-6 text-gray-900"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        class="rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                      >
                        Submit Church Suggestion
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
          function updateFeedbackType(type, churchId) {
            const url = new URL(window.location);
            url.searchParams.set('type', type);
            
            // Preserve churchId if provided or if switching to church type
            if (churchId) {
              url.searchParams.set('churchId', churchId);
            } else if (type !== 'church' && !url.searchParams.get('churchId')) {
              url.searchParams.delete('churchId');
            }
            
            window.location.href = url.toString();
          }
        `,
        }}
      />
    </Layout>
  );
});

// Handle general and church feedback submission
feedbackRoutes.post('/submit', async (c) => {
  const user = await getUser(c);
  if (!user) {
    return c.redirect('/auth/signin');
  }

  const db = createDbWithContext(c);
  const body = await c.req.parseBody();

  const feedbackType = body.type as string;
  const content = body.content as string;
  const churchId = body.churchId ? Number(body.churchId) : null;

  if (!content) {
    return c.redirect('/feedback?error=missing-content');
  }

  try {
    // Insert feedback as a comment
    await db
      .insert(comments)
      .values({
        userId: user.id,
        churchId: churchId,
        content: content,
        type: 'user', // We'll use metadata to distinguish feedback types
        metadata: JSON.stringify({ feedbackType: feedbackType }),
        isPublic: false,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();

    // If this is church feedback with a churchId, redirect back to the church page
    if (feedbackType === 'church' && churchId) {
      const church = await db
        .select({ path: churches.path })
        .from(churches)
        .where(eq(churches.id, churchId))
        .get();
      
      if (church?.path) {
        return c.redirect(`/churches/${church.path}?feedback=success`);
      }
    }

    return c.redirect('/feedback?success=true');
  } catch (error) {
    console.error('Error submitting feedback:', error);
    
    // If this is church feedback with a churchId, redirect back to the church page with error
    if (feedbackType === 'church' && churchId) {
      const church = await db
        .select({ path: churches.path })
        .from(churches)
        .where(eq(churches.id, churchId))
        .get();
      
      if (church?.path) {
        return c.redirect(`/churches/${church.path}?feedback=error`);
      }
    }
    
    return c.redirect('/feedback?error=submission-failed');
  }
});

// Handle church suggestion submission
feedbackRoutes.post('/suggest-church', async (c) => {
  const user = await getUser(c);
  if (!user) {
    return c.redirect('/auth/signin');
  }

  const db = createDbWithContext(c);
  const body = await c.req.parseBody();

  const churchName = body.churchName as string;
  if (!churchName) {
    return c.redirect('/feedback?type=suggestion&error=missing-name');
  }

  try {
    // Insert church suggestion
    await db
      .insert(churchSuggestions)
      .values({
        userId: user.id,
        churchName: churchName,
        denomination: (body.denomination as string) || null,
        address: (body.address as string) || null,
        website: (body.website as string) || null,
        phone: (body.phone as string) || null,
        email: null,
        serviceTimes: (body.serviceTimes as string) || null,
        statementOfFaith: null,
        facebook: null,
        instagram: null,
        youtube: null,
        spotify: null,
        createdAt: new Date(),
      })
      .run();

    return c.redirect('/feedback?type=suggestion&success=true');
  } catch (error) {
    console.error('Error submitting church suggestion:', error);
    return c.redirect('/feedback?type=suggestion&error=submission-failed');
  }
});
