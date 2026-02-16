import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { Layout } from '../../components/Layout';
import { createDbWithContext } from '../../db';
import { users } from '../../db/auth-schema';
import { affiliations, churches, churchSuggestions, comments, counties, pages } from '../../db/schema';
import { requireAdminBetter } from '../../middleware/better-auth';
import type { AuthVariables, Bindings } from '../../types';
import { getCommonLayoutProps } from '../../utils/layout-props';

type Variables = AuthVariables;

export const dashboardRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

dashboardRoutes.get('/admin', requireAdminBetter, async (c) => {
  const _user = c.get('betterUser');
  const db = createDbWithContext(c);
  const layoutProps = await getCommonLayoutProps(c);

  // Get statistics using COUNT for efficiency
  const churchCount = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(churches)
    .where(isNull(churches.deletedAt))
    .get();
  const countyCount = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(counties)
    .where(isNull(counties.deletedAt))
    .get();
  const affiliationCount = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(affiliations)
    .where(isNull(affiliations.deletedAt))
    .get();
  const pageCount = await db.select({ count: sql<number>`COUNT(*)` }).from(pages).get();
  const userCount = await db.select({ count: sql<number>`COUNT(*)` }).from(users).get();
  const submissionCount = await db.select({ count: sql<number>`COUNT(*)` }).from(churchSuggestions).get();

  // Get 1 oldest non-closed church for review
  const churchesForReview = await db
    .select({
      id: churches.id,
      name: churches.name,
      path: churches.path,
      status: churches.status,
      lastUpdated: churches.lastUpdated,
    })
    .from(churches)
    .where(and(isNull(churches.deletedAt), sql`${churches.status} != 'Closed' OR ${churches.status} IS NULL`))
    .orderBy(sql`${churches.lastUpdated} ASC NULLS FIRST`)
    .limit(1)
    .all();

  // Get recent human feedback (user comments)
  const recentFeedbackRaw = await db
    .select()
    .from(comments)
    .leftJoin(churches, eq(comments.churchId, churches.id))
    .leftJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.type, 'user'))
    .orderBy(desc(comments.createdAt))
    .limit(3)
    .all();

  // Transform feedback data
  const recentFeedback = recentFeedbackRaw.map((row) => ({
    id: row.comments.id,
    content: row.comments.content,
    userId: row.comments.userId,
    churchId: row.comments.churchId,
    createdAt: row.comments.createdAt,
    type: row.comments.type,
    churchName: row.churches?.name || null,
    churchPath: row.churches?.path || null,
    userName: row.users?.name || null,
    userEmail: row.users?.email || '',
    userImage: row.users?.image || null,
  }));

  // Get recent system activity
  const recentActivityRaw = await db
    .select()
    .from(comments)
    .leftJoin(churches, eq(comments.churchId, churches.id))
    .leftJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.type, 'system'))
    .orderBy(desc(comments.createdAt))
    .limit(3)
    .all();

  // Transform activity data
  const recentActivity = recentActivityRaw.map((row) => ({
    id: row.comments.id,
    content: row.comments.content,
    userId: row.comments.userId,
    churchId: row.comments.churchId,
    createdAt: row.comments.createdAt,
    type: row.comments.type,
    metadata: row.comments.metadata,
    churchName: row.churches?.name || null,
    churchPath: row.churches?.path || null,
    userName: row.users?.name || null,
    userEmail: row.users?.email || '',
    userImage: row.users?.image || null,
  }));

  return c.html(
    <Layout title="Admin Dashboard" {...layoutProps}>
      <div class="bg-gray-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div class="mb-8">
            <h1 class="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">Admin Dashboard</h1>
          </div>

          {/* To Review Section */}
          {churchesForReview && churchesForReview.length > 0 && (
            <div class="mb-8" data-testid="to-review-section">
              <div class="flex items-start justify-between mb-4">
                <div>
                  <h2 class="text-lg font-semibold text-gray-900">To Review</h2>
                  <p class="text-sm text-gray-600 mt-1">Church that hasn't been updated recently</p>
                </div>
              </div>

              <div class="space-y-3">
                {churchesForReview.map((church) => (
                  <div
                    class="bg-white rounded-lg shadow-sm ring-1 ring-gray-900/5 overflow-hidden"
                    data-testid={`church-review-${church.id}`}
                  >
                    <div class="p-4">
                      <div class="flex items-start justify-between">
                        <div class="flex-1">
                          <div class="flex items-center gap-2 mb-2">
                            <h3 class="text-base font-medium text-gray-900">{church.name}</h3>
                            {church.status && (
                              <span
                                class={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                                  church.status === 'Listed'
                                    ? 'bg-green-50 text-green-700 ring-green-600/20'
                                    : church.status === 'Ready to list'
                                      ? 'bg-blue-50 text-blue-700 ring-blue-600/20'
                                      : church.status === 'Assess'
                                        ? 'bg-yellow-50 text-yellow-700 ring-yellow-600/20'
                                        : church.status === 'Needs data'
                                          ? 'bg-orange-50 text-orange-700 ring-orange-600/20'
                                          : church.status === 'Unlisted'
                                            ? 'bg-gray-50 text-gray-700 ring-gray-600/20'
                                            : church.status === 'Heretical'
                                              ? 'bg-red-50 text-red-700 ring-red-600/20'
                                              : 'bg-gray-50 text-gray-700 ring-gray-600/20'
                                }`}
                              >
                                {church.status}
                              </span>
                            )}
                          </div>
                          <div class="mt-2 flex items-center text-sm text-gray-500">
                            <svg
                              class="mr-1.5 h-4 w-4 text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                              />
                            </svg>
                            Last updated:{' '}
                            {church.lastUpdated
                              ? new Date(Number(church.lastUpdated) * 1000).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })
                              : 'Never updated'}
                          </div>
                        </div>
                        <a
                          href={`/admin/churches/${church.id}/edit`}
                          class="ml-4 inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                          data-testid={`btn-review-${church.id}`}
                        >
                          Review
                          <svg class="ml-1.5 -mr-0.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                          </svg>
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div class="mt-4">
                <a
                  href="/admin/churches?sort=oldest"
                  class="text-sm font-medium text-primary-600 hover:text-primary-500"
                >
                  View all churches needing review →
                </a>
              </div>
            </div>
          )}

          {/* Manage */}
          <div class="mb-8" data-testid="manage-section">
            <h2 class="text-lg leading-6 font-medium text-gray-900 mb-4">Manage</h2>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <a
                href="/admin/churches"
                class="relative group bg-white p-4 rounded-lg shadow-sm ring-1 ring-gray-900/5 hover:ring-primary-500 transition-all"
                data-testid="card-churches"
              >
                <div>
                  <span class="rounded-lg inline-flex p-2 bg-primary-50 text-primary-700 group-hover:bg-primary-100">
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                  </span>
                </div>
                <div class="mt-3">
                  <h3 class="text-base font-medium">
                    <span class="absolute inset-0" aria-hidden="true"></span>
                    Churches ({churchCount?.count || 0})
                  </h3>
                  <p class="mt-1 text-sm text-gray-500">Add, edit, or remove church listings</p>
                </div>
                <span
                  class="pointer-events-none absolute top-6 right-6 text-gray-300 group-hover:text-gray-400"
                  aria-hidden="true"
                >
                  <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 4h1a1 1 0 00-1-1v1zm-1 12a1 1 0 102 0h-2zM8 3a1 1 0 000 2V3zM3.293 19.293a1 1 0 101.414 1.414l-1.414-1.414zM19 4v12h2V4h-2zm1-1H8v2h12V3zm-.707.293l-16 16 1.414 1.414 16-16-1.414-1.414z" />
                  </svg>
                </span>
              </a>

              <a
                href="/admin/affiliations"
                class="relative group bg-white p-4 rounded-lg shadow-sm ring-1 ring-gray-900/5 hover:ring-primary-500 transition-all"
                data-testid="card-affiliations"
              >
                <div>
                  <span class="rounded-lg inline-flex p-2 bg-purple-50 text-purple-700 group-hover:bg-purple-100">
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                  </span>
                </div>
                <div class="mt-3">
                  <h3 class="text-base font-medium">
                    <span class="absolute inset-0" aria-hidden="true"></span>
                    Affiliations ({affiliationCount?.count || 0})
                  </h3>
                  <p class="mt-1 text-sm text-gray-500">Manage denominations and networks</p>
                </div>
                <span
                  class="pointer-events-none absolute top-6 right-6 text-gray-300 group-hover:text-gray-400"
                  aria-hidden="true"
                >
                  <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 4h1a1 1 0 00-1-1v1zm-1 12a1 1 0 102 0h-2zM8 3a1 1 0 000 2V3zM3.293 19.293a1 1 0 101.414 1.414l-1.414-1.414zM19 4v12h2V4h-2zm1-1H8v2h12V3zm-.707.293l-16 16 1.414 1.414 16-16-1.414-1.414z" />
                  </svg>
                </span>
              </a>

              <a
                href="/admin/counties"
                class="relative group bg-white p-4 rounded-lg shadow-sm ring-1 ring-gray-900/5 hover:ring-primary-500 transition-all"
                data-testid="card-counties"
              >
                <div>
                  <span class="rounded-lg inline-flex p-2 bg-green-50 text-green-700 group-hover:bg-green-100">
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
                      />
                    </svg>
                  </span>
                </div>
                <div class="mt-3">
                  <h3 class="text-base font-medium">
                    <span class="absolute inset-0" aria-hidden="true"></span>
                    Counties ({countyCount?.count || 0})
                  </h3>
                  <p class="mt-1 text-sm text-gray-500">Manage county information</p>
                </div>
                <span
                  class="pointer-events-none absolute top-6 right-6 text-gray-300 group-hover:text-gray-400"
                  aria-hidden="true"
                >
                  <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 4h1a1 1 0 00-1-1v1zm-1 12a1 1 0 102 0h-2zM8 3a1 1 0 000 2V3zM3.293 19.293a1 1 0 101.414 1.414l-1.414-1.414zM19 4v12h2V4h-2zm1-1H8v2h12V3zm-.707.293l-16 16 1.414 1.414 16-16-1.414-1.414z" />
                  </svg>
                </span>
              </a>

              <a
                href="/admin/users"
                class="relative group bg-white p-4 rounded-lg shadow-sm ring-1 ring-gray-900/5 hover:ring-primary-500 transition-all"
                data-testid="card-users"
              >
                <div>
                  <span class="rounded-lg inline-flex p-2 bg-indigo-50 text-indigo-700 group-hover:bg-indigo-100">
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                  </span>
                </div>
                <div class="mt-3">
                  <h3 class="text-base font-medium">
                    <span class="absolute inset-0" aria-hidden="true"></span>
                    Users ({userCount?.count || 0})
                  </h3>
                  <p class="mt-1 text-sm text-gray-500">Manage admin and contributor access</p>
                </div>
                <span
                  class="pointer-events-none absolute top-6 right-6 text-gray-300 group-hover:text-gray-400"
                  aria-hidden="true"
                >
                  <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 4h1a1 1 0 00-1-1v1zm-1 12a1 1 0 102 0h-2zM8 3a1 1 0 000 2V3zM3.293 19.293a1 1 0 101.414 1.414l-1.414-1.414zM19 4v12h2V4h-2zm1-1H8v2h12V3zm-.707.293l-16 16 1.414 1.414 16-16-1.414-1.414z" />
                  </svg>
                </span>
              </a>

              <a
                href="/admin/pages"
                class="relative group bg-white p-4 rounded-lg shadow-sm ring-1 ring-gray-900/5 hover:ring-primary-500 transition-all"
                data-testid="card-pages"
              >
                <div>
                  <span class="rounded-lg inline-flex p-2 bg-yellow-50 text-yellow-700 group-hover:bg-yellow-100">
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </span>
                </div>
                <div class="mt-3">
                  <h3 class="text-base font-medium">
                    <span class="absolute inset-0" aria-hidden="true"></span>
                    Pages ({pageCount?.count || 0})
                  </h3>
                  <p class="mt-1 text-sm text-gray-500">Edit content pages and navigation</p>
                </div>
                <span
                  class="pointer-events-none absolute top-6 right-6 text-gray-300 group-hover:text-gray-400"
                  aria-hidden="true"
                >
                  <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 4h1a1 1 0 00-1-1v1zm-1 12a1 1 0 102 0h-2zM8 3a1 1 0 000 2V3zM3.293 19.293a1 1 0 101.414 1.414l-1.414-1.414zM19 4v12h2V4h-2zm1-1H8v2h12V3zm-.707.293l-16 16 1.414 1.414 16-16-1.414-1.414z" />
                  </svg>
                </span>
              </a>

              <a
                href="/admin/submissions"
                class="relative group bg-white p-4 rounded-lg shadow-sm ring-1 ring-gray-900/5 hover:ring-primary-500 transition-all"
                data-testid="card-submissions"
              >
                <div>
                  <span class="rounded-lg inline-flex p-2 bg-orange-50 text-orange-700 group-hover:bg-orange-100">
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                      />
                    </svg>
                  </span>
                </div>
                <div class="mt-3">
                  <h3 class="text-base font-medium">
                    <span class="absolute inset-0" aria-hidden="true"></span>
                    Submissions ({submissionCount?.count || 0})
                  </h3>
                  <p class="mt-1 text-sm text-gray-500">Review church submissions</p>
                </div>
                <span
                  class="pointer-events-none absolute top-6 right-6 text-gray-300 group-hover:text-gray-400"
                  aria-hidden="true"
                >
                  <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 4h1a1 1 0 00-1-1v1zm-1 12a1 1 0 102 0h-2zM8 3a1 1 0 000 2V3zM3.293 19.293a1 1 0 101.414 1.414l-1.414-1.414zM19 4v12h2V4h-2zm1-1H8v2h12V3zm-.707.293l-16 16 1.414 1.414 16-16-1.414-1.414z" />
                  </svg>
                </span>
              </a>
            </div>
          </div>

          {/* Additional Tools */}
          <div class="mb-8" data-testid="tools-section">
            <h2 class="text-lg leading-6 font-medium text-gray-900 mb-4">Additional Tools</h2>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <a
                href="/admin/monitoring"
                class="relative group bg-white p-4 rounded-lg shadow-sm ring-1 ring-gray-900/5 hover:ring-primary-500 transition-all"
                data-testid="card-monitoring"
              >
                <div>
                  <span class="rounded-lg inline-flex p-2 bg-blue-50 text-blue-700 group-hover:bg-blue-100">
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                  </span>
                </div>
                <div class="mt-3">
                  <h3 class="text-base font-medium">
                    <span class="absolute inset-0" aria-hidden="true"></span>
                    System Monitoring
                  </h3>
                  <p class="mt-1 text-sm text-gray-500">View system health and metrics</p>
                </div>
                <span
                  class="pointer-events-none absolute top-6 right-6 text-gray-300 group-hover:text-gray-400"
                  aria-hidden="true"
                >
                  <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 4h1a1 1 0 00-1-1v1zm-1 12a1 1 0 102 0h-2zM8 3a1 1 0 000 2V3zM3.293 19.293a1 1 0 101.414 1.414l-1.414-1.414zM19 4v12h2V4h-2zm1-1H8v2h12V3zm-.707.293l-16 16 1.414 1.414 16-16-1.414-1.414z" />
                  </svg>
                </span>
              </a>

              <a
                href="/admin/settings"
                class="relative group bg-white p-4 rounded-lg shadow-sm ring-1 ring-gray-900/5 hover:ring-primary-500 transition-all"
                data-testid="card-settings"
              >
                <div>
                  <span class="rounded-lg inline-flex p-2 bg-gray-50 text-gray-700 group-hover:bg-gray-100">
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </span>
                </div>
                <div class="mt-3">
                  <h3 class="text-base font-medium">
                    <span class="absolute inset-0" aria-hidden="true"></span>
                    Settings
                  </h3>
                  <p class="mt-1 text-sm text-gray-500">Configure site settings</p>
                </div>
                <span
                  class="pointer-events-none absolute top-6 right-6 text-gray-300 group-hover:text-gray-400"
                  aria-hidden="true"
                >
                  <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 4h1a1 1 0 00-1-1v1zm-1 12a1 1 0 102 0h-2zM8 3a1 1 0 000 2V3zM3.293 19.293a1 1 0 101.414 1.414l-1.414-1.414zM19 4v12h2V4h-2zm1-1H8v2h12V3zm-.707.293l-16 16 1.414 1.414 16-16-1.414-1.414z" />
                  </svg>
                </span>
              </a>

              <a
                href="/admin/cache"
                class="relative group bg-white p-4 rounded-lg shadow-sm ring-1 ring-gray-900/5 hover:ring-primary-500 transition-all"
                data-testid="card-cache"
              >
                <div>
                  <span class="rounded-lg inline-flex p-2 bg-red-50 text-red-700 group-hover:bg-red-100">
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </span>
                </div>
                <div class="mt-3">
                  <h3 class="text-base font-medium">
                    <span class="absolute inset-0" aria-hidden="true"></span>
                    Cache Management
                  </h3>
                  <p class="mt-1 text-sm text-gray-500">Clear and manage caches</p>
                </div>
                <span
                  class="pointer-events-none absolute top-6 right-6 text-gray-300 group-hover:text-gray-400"
                  aria-hidden="true"
                >
                  <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 4h1a1 1 0 00-1-1v1zm-1 12a1 1 0 102 0h-2zM8 3a1 1 0 000 2V3zM3.293 19.293a1 1 0 101.414 1.414l-1.414-1.414zM19 4v12h2V4h-2zm1-1H8v2h12V3zm-.707.293l-16 16 1.414 1.414 16-16-1.414-1.414z" />
                  </svg>
                </span>
              </a>

              <a
                href="/admin/activity"
                class="relative group bg-white p-4 rounded-lg shadow-sm ring-1 ring-gray-900/5 hover:ring-primary-500 transition-all"
                data-testid="card-activity"
              >
                <div>
                  <span class="rounded-lg inline-flex p-2 bg-cyan-50 text-cyan-700 group-hover:bg-cyan-100">
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </span>
                </div>
                <div class="mt-3">
                  <h3 class="text-base font-medium">
                    <span class="absolute inset-0" aria-hidden="true"></span>
                    Activity
                  </h3>
                  <p class="mt-1 text-sm text-gray-500">View system activity log</p>
                </div>
                <span
                  class="pointer-events-none absolute top-6 right-6 text-gray-300 group-hover:text-gray-400"
                  aria-hidden="true"
                >
                  <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 4h1a1 1 0 00-1-1v1zm-1 12a1 1 0 102 0h-2zM8 3a1 1 0 000 2V3zM3.293 19.293a1 1 0 101.414 1.414l-1.414-1.414zM19 4v12h2V4h-2zm1-1H8v2h12V3zm-.707.293l-16 16 1.414 1.414 16-16-1.414-1.414z" />
                  </svg>
                </span>
              </a>

              <a
                href="/admin/feedback"
                class="relative group bg-white p-4 rounded-lg shadow-sm ring-1 ring-gray-900/5 hover:ring-primary-500 transition-all"
                data-testid="card-feedback"
              >
                <div>
                  <span class="rounded-lg inline-flex p-2 bg-pink-50 text-pink-700 group-hover:bg-pink-100">
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                  </span>
                </div>
                <div class="mt-3">
                  <h3 class="text-base font-medium">
                    <span class="absolute inset-0" aria-hidden="true"></span>
                    Feedback
                  </h3>
                  <p class="mt-1 text-sm text-gray-500">Review user feedback</p>
                </div>
                <span
                  class="pointer-events-none absolute top-6 right-6 text-gray-300 group-hover:text-gray-400"
                  aria-hidden="true"
                >
                  <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 4h1a1 1 0 00-1-1v1zm-1 12a1 1 0 102 0h-2zM8 3a1 1 0 000 2V3zM3.293 19.293a1 1 0 101.414 1.414l-1.414-1.414zM19 4v12h2V4h-2zm1-1H8v2h12V3zm-.707.293l-16 16 1.414 1.414 16-16-1.414-1.414z" />
                  </svg>
                </span>
              </a>
            </div>
          </div>

          {/* Recent Activity */}
          {recentActivity.length > 0 && (
            <div class="mb-8" data-testid="recent-activity-section">
              <h2 class="text-lg leading-6 font-medium text-gray-900 mb-4">Recent System Activity</h2>
              <div class="bg-white shadow overflow-hidden sm:rounded-md">
                <ul class="divide-y divide-gray-200">
                  {recentActivity.map((activity) => (
                    <li key={activity.id}>
                      <div class="px-4 py-4 sm:px-6">
                        <div class="flex items-start justify-between">
                          <div class="flex-1">
                            <p class="text-sm text-gray-900">{activity.content}</p>
                            <div class="mt-2 text-sm text-gray-500">
                              {activity.churchName && (
                                <>
                                  <a
                                    href={`/churches/${activity.churchPath}`}
                                    class="text-primary-600 hover:text-primary-500"
                                  >
                                    {activity.churchName}
                                  </a>
                                  <span class="mx-2">•</span>
                                </>
                              )}
                              <span>{new Date(Number(activity.createdAt) * 1000).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Recent Feedback */}
          {recentFeedback.length > 0 && (
            <div class="mb-8" data-testid="recent-feedback-section">
              <h2 class="text-lg leading-6 font-medium text-gray-900 mb-4">Recent User Feedback</h2>
              <div class="bg-white shadow overflow-hidden sm:rounded-md">
                <ul class="divide-y divide-gray-200">
                  {recentFeedback.map((feedback) => (
                    <li key={feedback.id}>
                      <div class="px-4 py-4 sm:px-6">
                        <div class="flex items-start justify-between">
                          <div class="flex-1">
                            <p class="text-sm text-gray-900">{feedback.content}</p>
                            <div class="mt-2 text-sm text-gray-500">
                              <span>By {feedback.userName}</span>
                              {feedback.churchName && (
                                <>
                                  <span class="mx-2">•</span>
                                  <a
                                    href={`/churches/${feedback.churchPath}`}
                                    class="text-primary-600 hover:text-primary-500"
                                  >
                                    {feedback.churchName}
                                  </a>
                                </>
                              )}
                              <span class="mx-2">•</span>
                              <span>{new Date(Number(feedback.createdAt) * 1000).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
});
