import { Hono } from 'hono';
import { Layout } from '../../components/Layout';
import { requireAdminWithRedirect } from '../../middleware/redirect-auth';
import { getLogoUrl } from '../../utils/settings';
import { getNavbarPages } from '../../utils/pages';
import { createDbWithContext } from '../../db';
import { comments, churches } from '../../db/schema';
import { users } from '../../db/auth-schema';
import { desc, eq, sql, and, or, like } from 'drizzle-orm';
import type { Bindings } from '../../types';

type Variables = {
  betterUser: any;
};

export const adminActivityRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Apply admin middleware to all routes
adminActivityRoutes.use('*', requireAdminWithRedirect);

// List all system activity
adminActivityRoutes.get('/', async (c) => {
  const db = createDbWithContext(c);
  const user = c.get('betterUser');
  const logoUrl = await getLogoUrl(c.env);
  const navbarPages = await getNavbarPages(c.env);

  // Get query parameters for filtering
  const searchQuery = c.req.query('search') || '';
  const churchFilter = c.req.query('church') || '';
  const page = Number.parseInt(c.req.query('page') || '1', 10);
  const perPage = 20;
  const offset = (page - 1) * perPage;

  // Build filter conditions
  const conditions = [eq(comments.type, 'system')];
  
  if (searchQuery) {
    conditions.push(like(comments.content, `%${searchQuery}%`));
  }
  
  if (churchFilter) {
    conditions.push(eq(comments.churchId, Number.parseInt(churchFilter, 10)));
  }

  // Get total count for pagination
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(comments)
    .where(and(...conditions))
    .all();

  const totalPages = Math.ceil(count / perPage);

  // Get paginated results
  const allActivityRaw = await db
    .select()
    .from(comments)
    .leftJoin(churches, eq(comments.churchId, churches.id))
    .leftJoin(users, eq(comments.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(comments.createdAt))
    .limit(perPage)
    .offset(offset)
    .all();

  // Get unique churches for filter dropdown
  const uniqueChurches = await db
    .select({
      id: churches.id,
      name: churches.name,
    })
    .from(churches)
    .innerJoin(comments, and(
      eq(comments.churchId, churches.id),
      eq(comments.type, 'system')
    ))
    .groupBy(churches.id, churches.name)
    .orderBy(churches.name)
    .all();

  // Transform the data to a cleaner format
  const allActivity = allActivityRaw.map(row => ({
    id: row.comments.id,
    content: row.comments.content,
    userId: row.comments.userId,
    churchId: row.comments.churchId,
    createdAt: row.comments.createdAt,
    type: row.comments.type,
    isPublic: row.comments.isPublic,
    status: row.comments.status,
    metadata: row.comments.metadata,
    churchName: row.churches?.name || null,
    churchPath: row.churches?.path || null,
    userName: row.users?.username || null,
    userEmail: row.users?.email || null,
  }));

  // Calculate stats
  const last24h = Date.now() - (24 * 60 * 60 * 1000);
  const stats = {
    total: count,
    churchRelated: allActivity.filter(a => a.churchId).length,
    last24h: allActivity.filter(a => a.createdAt > last24h / 1000).length,
  };

  return c.html(
    <Layout
      title="System Activity - Admin"
      user={user}
      currentPath="/admin"
      logoUrl={logoUrl}
      pages={navbarPages}
    >
      <div class="min-h-full">
        {/* Header */}
        <div class="bg-white shadow">
          <div class="px-4 sm:px-6 lg:max-w-7xl lg:mx-auto lg:px-8">
            <div class="py-6 md:flex md:items-center md:justify-between lg:border-t lg:border-gray-200">
              <div class="flex-1 min-w-0">
                {/* Breadcrumb */}
                <nav class="flex" aria-label="Breadcrumb">
                  <ol role="list" class="flex items-center space-x-2">
                    <li>
                      <a href="/admin" class="text-sm font-medium text-gray-500 hover:text-gray-700">
                        Admin
                      </a>
                    </li>
                    <li>
                      <svg class="flex-shrink-0 w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M5.555 17.776l8-16 .894.448-8 16-.894-.448z" />
                      </svg>
                    </li>
                    <li>
                      <span class="text-sm font-medium text-gray-700">Activity</span>
                    </li>
                  </ol>
                </nav>
                <h1 class="mt-2 text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                  System Activity
                </h1>
              </div>
            </div>
          </div>
        </div>

        <main class="flex-1 pb-8">
          {/* Page header */}
          <div class="bg-white shadow">
            <div class="px-4 sm:px-6 lg:max-w-7xl lg:mx-auto lg:px-8">
              <div class="py-6 md:flex md:items-center md:justify-between">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center">
                    <div>
                      <div class="flex items-center">
                        <h1 class="text-xl font-semibold text-gray-900">Activity Log</h1>
                      </div>
                      <p class="mt-1 text-sm text-gray-500">
                        Track all system-generated changes and updates
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div class="mt-8">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 class="text-lg leading-6 font-medium text-gray-900">Overview</h2>
              <dl class="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div class="px-4 py-5 bg-white shadow rounded-lg overflow-hidden sm:p-6">
                  <dt class="text-sm font-medium text-gray-500 truncate">Total Activity Logs</dt>
                  <dd class="mt-1 text-3xl font-semibold text-gray-900">{stats.total}</dd>
                </div>
                <div class="px-4 py-5 bg-white shadow rounded-lg overflow-hidden sm:p-6">
                  <dt class="text-sm font-medium text-gray-500 truncate">Church-Related</dt>
                  <dd class="mt-1 text-3xl font-semibold text-gray-900">{stats.churchRelated}</dd>
                </div>
                <div class="px-4 py-5 bg-white shadow rounded-lg overflow-hidden sm:p-6">
                  <dt class="text-sm font-medium text-gray-500 truncate">Last 24 Hours</dt>
                  <dd class="mt-1 text-3xl font-semibold text-gray-900">{stats.last24h}</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Filters */}
          <div class="mt-8">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div class="bg-white shadow rounded-lg">
                <div class="px-4 py-5 sm:p-6">
                  <form method="get" class="space-y-4 sm:space-y-0 sm:flex sm:items-end sm:space-x-4">
                    {/* Search input */}
                    <div class="flex-1">
                      <label for="search" class="block text-sm font-medium text-gray-700">
                        Search activity
                      </label>
                      <div class="mt-1">
                        <input
                          type="text"
                          name="search"
                          id="search"
                          value={searchQuery}
                          placeholder="Search in activity logs..."
                          class="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>

                    {/* Church filter */}
                    <div class="sm:w-64">
                      <label for="church" class="block text-sm font-medium text-gray-700">
                        Filter by church
                      </label>
                      <select
                        id="church"
                        name="church"
                        class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                      >
                        <option value="">All churches</option>
                        {uniqueChurches.map((church) => (
                          <option value={church.id} selected={churchFilter === church.id.toString()}>
                            {church.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Submit button */}
                    <div>
                      <button
                        type="submit"
                        class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                      >
                        <svg class="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                        Filter
                      </button>
                    </div>

                    {/* Clear filters */}
                    {(searchQuery || churchFilter) && (
                      <div>
                        <a
                          href="/admin/activity"
                          class="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                        >
                          Clear filters
                        </a>
                      </div>
                    )}
                  </form>
                </div>
              </div>
            </div>
          </div>

          {/* Activity list */}
          <div class="mt-8">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div class="bg-white shadow overflow-hidden sm:rounded-md">
                {allActivity.length === 0 ? (
                  <div class="text-center py-12">
                    <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <h3 class="mt-2 text-sm font-medium text-gray-900">No activity found</h3>
                    <p class="mt-1 text-sm text-gray-500">
                      {searchQuery || churchFilter
                        ? 'Try adjusting your filters'
                        : 'System activity logs will appear here'
                      }
                    </p>
                  </div>
                ) : (
                  <>
                    <ul role="list" class="divide-y divide-gray-200">
                      {allActivity.map((activity) => (
                        <li key={activity.id}>
                          <div class="px-4 py-4 sm:px-6">
                            <div class="flex items-start space-x-3">
                              {/* Icon */}
                              <div class="flex-shrink-0">
                                <div class="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                                  <svg class="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </div>
                              </div>
                              
                              {/* Content */}
                              <div class="flex-1 min-w-0">
                                <div class="flex items-center justify-between">
                                  <p class="text-sm font-medium text-gray-900">
                                    {activity.userName || 'System'}
                                  </p>
                                  <div class="ml-2 flex-shrink-0 flex">
                                    <p class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-amber-100 text-amber-800">
                                      System Log
                                    </p>
                                  </div>
                                </div>
                                <p class="mt-1 text-sm text-gray-500">
                                  {new Date(activity.createdAt).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  })}
                                </p>
                                {activity.churchName && (
                                  <p class="mt-1 text-sm text-gray-900">
                                    Church: <a href={`/churches/${activity.churchPath}`} class="font-medium text-primary-600 hover:text-primary-500">
                                      {activity.churchName}
                                    </a>
                                  </p>
                                )}
                                <div class="mt-2 text-sm text-gray-700">
                                  <div 
                                    dangerouslySetInnerHTML={{ 
                                      __html: activity.content
                                        .replace(/```yaml\n([\s\S]*?)```/g, (match, p1) => {
                                          return `<pre class="bg-gray-50 p-3 rounded-lg overflow-x-auto mt-2 text-xs font-mono">${p1.trim()}</pre>`;
                                        })
                                        .replace(/\n/g, '<br>')
                                    }} 
                                  />
                                </div>
                                {activity.metadata && (
                                  <details class="mt-2">
                                    <summary class="text-sm text-primary-600 hover:text-primary-500 cursor-pointer">
                                      View technical details
                                    </summary>
                                    <pre class="mt-2 p-3 bg-gray-50 rounded text-xs overflow-x-auto">
                                      {JSON.stringify(JSON.parse(activity.metadata), null, 2)}
                                    </pre>
                                  </details>
                                )}
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                    
                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div class="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                        <div class="flex-1 flex justify-between sm:hidden">
                          {page > 1 ? (
                            <a
                              href={`?page=${page - 1}${searchQuery ? `&search=${searchQuery}` : ''}${churchFilter ? `&church=${churchFilter}` : ''}`}
                              class="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                            >
                              Previous
                            </a>
                          ) : (
                            <span class="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-300 bg-white cursor-not-allowed">
                              Previous
                            </span>
                          )}
                          {page < totalPages ? (
                            <a
                              href={`?page=${page + 1}${searchQuery ? `&search=${searchQuery}` : ''}${churchFilter ? `&church=${churchFilter}` : ''}`}
                              class="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                            >
                              Next
                            </a>
                          ) : (
                            <span class="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-300 bg-white cursor-not-allowed">
                              Next
                            </span>
                          )}
                        </div>
                        <div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                          <div>
                            <p class="text-sm text-gray-700">
                              Showing <span class="font-medium">{(page - 1) * perPage + 1}</span> to{' '}
                              <span class="font-medium">{Math.min(page * perPage, count)}</span> of{' '}
                              <span class="font-medium">{count}</span> results
                            </p>
                          </div>
                          <div>
                            <nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                              {page > 1 ? (
                                <a
                                  href={`?page=${page - 1}${searchQuery ? `&search=${searchQuery}` : ''}${churchFilter ? `&church=${churchFilter}` : ''}`}
                                  class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                                >
                                  <span class="sr-only">Previous</span>
                                  <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
                                  </svg>
                                </a>
                              ) : (
                                <span class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-300 cursor-not-allowed">
                                  <span class="sr-only">Previous</span>
                                  <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
                                  </svg>
                                </span>
                              )}
                              
                              {/* Page numbers */}
                              {[...Array(Math.min(totalPages, 7))].map((_, i) => {
                                const pageNum = i + 1;
                                if (pageNum === page) {
                                  return (
                                    <span
                                      key={pageNum}
                                      class="z-10 bg-primary-50 border-primary-500 text-primary-600 relative inline-flex items-center px-4 py-2 border text-sm font-medium"
                                    >
                                      {pageNum}
                                    </span>
                                  );
                                }
                                return (
                                  <a
                                    key={pageNum}
                                    href={`?page=${pageNum}${searchQuery ? `&search=${searchQuery}` : ''}${churchFilter ? `&church=${churchFilter}` : ''}`}
                                    class="bg-white border-gray-300 text-gray-500 hover:bg-gray-50 relative inline-flex items-center px-4 py-2 border text-sm font-medium"
                                  >
                                    {pageNum}
                                  </a>
                                );
                              })}

                              {page < totalPages ? (
                                <a
                                  href={`?page=${page + 1}${searchQuery ? `&search=${searchQuery}` : ''}${churchFilter ? `&church=${churchFilter}` : ''}`}
                                  class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                                >
                                  <span class="sr-only">Next</span>
                                  <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                                  </svg>
                                </a>
                              ) : (
                                <span class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-300 cursor-not-allowed">
                                  <span class="sr-only">Next</span>
                                  <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                                  </svg>
                                </span>
                              )}
                            </nav>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </Layout>
  );
});