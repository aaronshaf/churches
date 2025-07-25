import { desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { Layout } from '../../components/Layout';
import { createDbWithContext } from '../../db';
import { users } from '../../db/auth-schema';
import { churches, churchSuggestions, comments } from '../../db/schema';
import { requireAdminWithRedirect } from '../../middleware/redirect-auth';
import type { AuthenticatedVariables, Bindings } from '../../types';
import { getNavbarPages } from '../../utils/pages';
import { getLogoUrl } from '../../utils/settings';

type Variables = AuthenticatedVariables;

export const adminFeedbackRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Apply admin middleware to all routes
adminFeedbackRoutes.use('*', requireAdminWithRedirect);

// List all feedback/comments
adminFeedbackRoutes.get('/', async (c) => {
  const db = createDbWithContext(c);
  const user = c.get('betterUser');
  const logoUrl = await getLogoUrl(c.env);
  const navbarPages = await getNavbarPages(c.env);

  // Get all user comments (excluding system activity)
  const allCommentsRaw = await db
    .select()
    .from(comments)
    .leftJoin(churches, eq(comments.churchId, churches.id))
    .leftJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.type, 'user'))
    .orderBy(desc(comments.createdAt))
    .all();

  // Transform the data to a cleaner format
  const allComments = allCommentsRaw.map((row) => {
    let feedbackType = 'general';
    if (row.comments.metadata) {
      try {
        const meta = JSON.parse(row.comments.metadata);
        feedbackType = meta.feedbackType || 'general';
      } catch {}
    }

    return {
      id: row.comments.id,
      content: row.comments.content,
      userId: row.comments.userId,
      churchId: row.comments.churchId,
      createdAt: row.comments.createdAt,
      type: row.comments.type,
      feedbackType: feedbackType,
      isPublic: row.comments.isPublic,
      status: row.comments.status,
      metadata: row.comments.metadata,
      churchName: row.churches?.name || null,
      churchPath: row.churches?.path || null,
      userName: row.users?.name || null,
      userEmail: row.users?.email || null,
    };
  });

  // Get church suggestions
  const suggestions = await db
    .select()
    .from(churchSuggestions)
    .leftJoin(users, eq(churchSuggestions.userId, users.id))
    .orderBy(desc(churchSuggestions.createdAt))
    .all();

  // Count feedback by type
  const generalFeedback = allComments.filter((c) => c.feedbackType === 'general').length;
  const churchFeedback = allComments.filter((c) => c.feedbackType === 'church').length;
  const totalSuggestions = suggestions.length;

  return c.html(
    <Layout title="Feedback - Admin" user={user} currentPath="/admin" logoUrl={logoUrl} pages={navbarPages}>
      <div class="bg-gray-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Breadcrumb */}
          <nav class="flex mb-8" aria-label="Breadcrumb">
            <ol class="flex items-center space-x-2">
              <li>
                <a href="/admin" class="text-gray-500 hover:text-gray-700">
                  Admin
                </a>
              </li>
              <li>
                <span class="mx-2 text-gray-400">/</span>
              </li>
              <li>
                <span class="text-gray-900">Feedback</span>
              </li>
            </ol>
          </nav>

          {/* Header */}
          <div class="mb-8">
            <h1 class="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">Feedback</h1>
            <p class="mt-2 text-sm text-gray-600">View and manage all user comments and feedback across the site</p>
          </div>

          {/* Stats */}
          <div class="grid grid-cols-1 gap-5 sm:grid-cols-4 mb-8">
            <div class="bg-white overflow-hidden shadow rounded-lg">
              <div class="p-5">
                <div class="flex items-center">
                  <div class="flex-shrink-0">
                    <svg class="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                      />
                    </svg>
                  </div>
                  <div class="ml-5 w-0 flex-1">
                    <dl>
                      <dt class="text-sm font-medium text-gray-500 truncate">All Feedback</dt>
                      <dd class="text-lg font-medium text-gray-900">{allComments.length + totalSuggestions}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div class="bg-white overflow-hidden shadow rounded-lg">
              <div class="p-5">
                <div class="flex items-center">
                  <div class="flex-shrink-0">
                    <svg class="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                  </div>
                  <div class="ml-5 w-0 flex-1">
                    <dl>
                      <dt class="text-sm font-medium text-gray-500 truncate">General</dt>
                      <dd class="text-lg font-medium text-gray-900">{generalFeedback}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div class="bg-white overflow-hidden shadow rounded-lg">
              <div class="p-5">
                <div class="flex items-center">
                  <div class="flex-shrink-0">
                    <svg class="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                  </div>
                  <div class="ml-5 w-0 flex-1">
                    <dl>
                      <dt class="text-sm font-medium text-gray-500 truncate">Churches</dt>
                      <dd class="text-lg font-medium text-gray-900">{churchFeedback}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div class="bg-white overflow-hidden shadow rounded-lg">
              <div class="p-5">
                <div class="flex items-center">
                  <div class="flex-shrink-0">
                    <svg class="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div class="ml-5 w-0 flex-1">
                    <dl>
                      <dt class="text-sm font-medium text-gray-500 truncate">Suggestions</dt>
                      <dd class="text-lg font-medium text-gray-900">{totalSuggestions}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Comments List */}
          <div class="bg-white shadow overflow-hidden sm:rounded-md">
            <ul class="divide-y divide-gray-200">
              {allComments.length === 0 ? (
                <li class="px-6 py-12 text-center">
                  <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                  <h3 class="mt-2 text-sm font-medium text-gray-900">No comments yet</h3>
                  <p class="mt-1 text-sm text-gray-500">Comments and feedback will appear here.</p>
                </li>
              ) : (
                allComments.map((comment) => (
                  <li id={`comment-${comment.id}`}>
                    <div class="px-6 py-6">
                      <div class="flex items-start justify-between">
                        <div class="flex-1">
                          {/* Header */}
                          <div class="flex items-center gap-3 mb-3">
                            <span class="font-medium text-gray-900">{comment.userName || 'Anonymous'}</span>
                            {comment.userEmail && <span class="text-sm text-gray-500">({comment.userEmail})</span>}
                            {comment.type === 'system' && (
                              <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset bg-gray-50 text-gray-700 ring-gray-600/20">
                                System
                              </span>
                            )}
                            <span class="text-sm text-gray-500">
                              {new Date(comment.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>

                          {/* Church link if applicable */}
                          {comment.churchName && (
                            <p class="text-sm text-gray-600 mb-2">
                              On church:{' '}
                              <a
                                href={`/churches/${comment.churchPath}`}
                                class="text-primary-600 hover:text-primary-500 font-medium"
                              >
                                {comment.churchName}
                              </a>{' '}
                              <a
                                href={`/admin/churches/${comment.churchId}/edit`}
                                class="text-gray-500 hover:text-gray-700 text-xs"
                              >
                                (edit)
                              </a>
                            </p>
                          )}

                          {/* Comment content */}
                          <div class="text-gray-700 whitespace-pre-wrap">{comment.content}</div>

                          {/* Metadata if system comment */}
                          {comment.type === 'system' && comment.metadata && (
                            <div class="mt-3 text-sm text-gray-500">
                              <details>
                                <summary class="cursor-pointer hover:text-gray-700">View change details</summary>
                                <pre class="mt-2 p-3 bg-gray-50 rounded text-xs overflow-x-auto">
                                  {JSON.stringify(JSON.parse(comment.metadata), null, 2)}
                                </pre>
                              </details>
                            </div>
                          )}

                          {/* Status badges */}
                          <div class="mt-3 flex items-center gap-2">
                            <span
                              class={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                                comment.isPublic
                                  ? 'bg-green-50 text-green-700 ring-green-600/20'
                                  : 'bg-gray-50 text-gray-700 ring-gray-600/20'
                              }`}
                            >
                              {comment.isPublic ? 'Public' : 'Private'}
                            </span>
                            <span
                              class={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                                comment.status === 'approved'
                                  ? 'bg-green-50 text-green-700 ring-green-600/20'
                                  : comment.status === 'rejected'
                                    ? 'bg-red-50 text-red-700 ring-red-600/20'
                                    : 'bg-yellow-50 text-yellow-700 ring-yellow-600/20'
                              }`}
                            >
                              {comment.status}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div class="ml-4 flex-shrink-0">
                          <button type="button" class="text-gray-400 hover:text-gray-500" title="Delete comment">
                            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  );
});
