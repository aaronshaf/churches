import { and, desc, eq, inArray, isNotNull, isNull, like, or, sql } from 'drizzle-orm';
import type { Context } from 'hono';
import { Layout } from '../../../components/Layout';
import { createDbWithContext } from '../../../db';
import { affiliations, churchAffiliations, churches, counties } from '../../../db/schema';
import type { AuthenticatedVariables, Bindings, ChurchStatus } from '../../../types';
import { batchedInQuery } from '../../../utils/db-helpers';
import { getLogoUrl } from '../../../utils/settings';

type Variables = AuthenticatedVariables;

export async function listChurches(c: Context<{ Bindings: Bindings; Variables: Variables }>) {
  const db = createDbWithContext(c);
  const user = c.get('betterUser');

  // Get query parameters
  const url = new URL(c.req.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const pageSize = parseInt(url.searchParams.get('pageSize') || '50');
  const search = url.searchParams.get('search') || '';
  const statusFilter = url.searchParams.get('status') as ChurchStatus | '';
  const countyFilter = url.searchParams.get('county') || '';
  const affiliationFilter = url.searchParams.get('affiliation') || '';
  const sortBy = url.searchParams.get('sortBy') || 'name';
  const sortOrder = url.searchParams.get('sortOrder') || 'asc';
  const success = url.searchParams.get('success') || '';
  const error = url.searchParams.get('error') || '';

  // Build where conditions
  const whereConditions = [isNull(churches.deletedAt)];

  if (search) {
    const searchCondition = or(like(churches.name, `%${search}%`), like(churches.gatheringAddress, `%${search}%`));
    if (searchCondition) {
      whereConditions.push(searchCondition);
    }
  }

  if (statusFilter) {
    whereConditions.push(eq(churches.status, statusFilter));
  }

  if (countyFilter) {
    whereConditions.push(eq(churches.countyId, parseInt(countyFilter)));
  }

  // Build the base query
  let query = db
    .select({
      id: churches.id,
      name: churches.name,
      status: churches.status,
      gatheringAddress: churches.gatheringAddress,
      phone: churches.phone,
      email: churches.email,
      website: churches.website,
      updatedAt: churches.updatedAt,
      countyId: churches.countyId,
      countyName: counties.name,
    })
    .from(churches)
    .leftJoin(counties, eq(churches.countyId, counties.id))
    .$dynamic();

  // Apply where conditions
  if (whereConditions.length > 0) {
    query = query.where(sql`${sql.join(whereConditions, sql` AND `)}`);
  }

  // Apply sorting
  const orderColumn =
    sortBy === 'name'
      ? churches.name
      : sortBy === 'status'
        ? churches.status
        : sortBy === 'address'
          ? churches.gatheringAddress
          : sortBy === 'updatedAt'
            ? churches.updatedAt
            : churches.name;

  if (sortOrder === 'desc') {
    query = query.orderBy(desc(orderColumn));
  } else {
    query = query.orderBy(orderColumn);
  }

  // Apply pagination
  const offset = (page - 1) * pageSize;
  const churchesResult = await query.limit(pageSize).offset(offset).all();

  // Get total count for pagination
  const totalCountQuery = db.select({ count: sql<number>`COUNT(*)` }).from(churches).$dynamic();

  if (whereConditions.length > 0) {
    totalCountQuery.where(sql`${sql.join(whereConditions, sql` AND `)}`);
  }

  const totalCount = await totalCountQuery.get();
  const totalPages = Math.ceil((totalCount?.count || 0) / pageSize);

  // Handle affiliation filter if provided
  let filteredChurches = churchesResult;
  if (affiliationFilter) {
    const affiliationId = parseInt(affiliationFilter);
    const churchIds = churchesResult.map((c) => c.id);

    if (churchIds.length > 0) {
      const churchesWithAffiliation = await batchedInQuery(
        churchIds,
        100,
        async (batchIds) =>
          await db
            .select()
            .from(churchAffiliations)
            .where(
              and(inArray(churchAffiliations.churchId, batchIds), eq(churchAffiliations.affiliationId, affiliationId))
            )
            .all()
      );

      const affiliatedChurchIds = new Set(churchesWithAffiliation.map((ca: any) => ca.churchId));
      filteredChurches = churchesResult.filter((church) => affiliatedChurchIds.has(church.id));
    }
  }

  // Get all counties for filter dropdown
  const allCounties = await db.select().from(counties).where(isNull(counties.deletedAt)).orderBy(counties.name).all();

  // Get all affiliations for filter dropdown
  const allAffiliations = await db
    .select()
    .from(affiliations)
    .where(isNull(affiliations.deletedAt))
    .orderBy(affiliations.name)
    .all();

  const deletedChurches = await db
    .select({
      id: churches.id,
      name: churches.name,
      status: churches.status,
      deletedAt: churches.deletedAt,
    })
    .from(churches)
    .where(isNotNull(churches.deletedAt))
    .orderBy(desc(churches.deletedAt))
    .limit(100)
    .all();

  // Get logo URL
  const logoUrl = await getLogoUrl(c.env);

  return c.html(
    <Layout
      title="Church Management"
      faviconUrl={undefined}
      logoUrl={logoUrl}
      pages={[]}
      currentPath={c.req.path}
      user={user}
    >
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="sm:flex sm:items-center">
          <div class="sm:flex-auto">
            <h1 class="text-3xl font-bold text-gray-900">Church Management</h1>
            <p class="mt-2 text-sm text-gray-700">Manage churches, their information, and status updates.</p>
          </div>
          <div class="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
            <a
              href="/admin/churches/new"
              class="inline-flex items-center justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
            >
              Add Church
            </a>
          </div>
        </div>

        {success && (
          <div class="mt-6 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success === 'deleted' && 'Church deleted successfully.'}
            {success === 'restored' && 'Church restored successfully.'}
          </div>
        )}

        {error && (
          <div class="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error === 'invalid_id' && 'Invalid church id.'}
            {error === 'not_found' && 'Church not found.'}
            {error === 'not_found_deleted' && 'Deleted church not found.'}
            {error === 'delete_failed' && 'Failed to delete church.'}
            {error === 'restore_failed' && 'Failed to restore church.'}
          </div>
        )}

        {/* Filters */}
        <div class="mt-6 bg-white shadow-sm ring-1 ring-gray-900/5 rounded-lg p-6">
          <form method="get" class="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <div>
              <label for="search" class="block text-sm font-medium text-gray-700">
                Search
              </label>
              <input
                type="text"
                name="search"
                id="search"
                value={search}
                placeholder="Search churches..."
                class="mt-1 block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
              />
            </div>

            <div>
              <label for="status" class="block text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                name="status"
                id="status"
                class="mt-1 block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
              >
                <option value="">All Statuses</option>
                <option value="Listed" selected={statusFilter === 'Listed'}>
                  Listed
                </option>
                <option value="Ready to list" selected={statusFilter === 'Ready to list'}>
                  Ready to list
                </option>
                <option value="Assess" selected={statusFilter === 'Assess'}>
                  Assess
                </option>
                <option value="Needs data" selected={statusFilter === 'Needs data'}>
                  Needs data
                </option>
                <option value="Unlisted" selected={statusFilter === 'Unlisted'}>
                  Unlisted
                </option>
                <option value="Heretical" selected={statusFilter === 'Heretical'}>
                  Heretical
                </option>
                <option value="Closed" selected={statusFilter === 'Closed'}>
                  Closed
                </option>
              </select>
            </div>

            <div>
              <label for="county" class="block text-sm font-medium text-gray-700">
                County
              </label>
              <select
                name="county"
                id="county"
                class="mt-1 block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
              >
                <option value="">All Counties</option>
                {allCounties.map((county) => (
                  <option key={county.id} value={county.id} selected={countyFilter === county.id.toString()}>
                    {county.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label for="affiliation" class="block text-sm font-medium text-gray-700">
                Affiliation
              </label>
              <select
                name="affiliation"
                id="affiliation"
                class="mt-1 block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
              >
                <option value="">All Affiliations</option>
                {allAffiliations.map((affiliation) => (
                  <option
                    key={affiliation.id}
                    value={affiliation.id}
                    selected={affiliationFilter === affiliation.id.toString()}
                  >
                    {affiliation.name}
                  </option>
                ))}
              </select>
            </div>

            <div class="flex items-end">
              <button
                type="submit"
                class="w-full inline-flex items-center justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
              >
                Filter
              </button>
            </div>
          </form>
        </div>

        {/* Results */}
        <div class="mt-6 bg-white shadow-sm ring-1 ring-gray-900/5 rounded-lg">
          <div class="px-4 py-5 sm:p-6">
            <div class="sm:flex sm:items-center">
              <div class="sm:flex-auto">
                <h2 class="text-lg font-semibold text-gray-900">
                  Churches ({filteredChurches.length} of {totalCount?.count || 0})
                </h2>
              </div>
            </div>

            <div class="mt-4 flow-root">
              <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                  <table class="min-w-full divide-y divide-gray-300">
                    <thead>
                      <tr>
                        <th class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">
                          <a
                            href={`?${new URLSearchParams({ ...Object.fromEntries(url.searchParams), sortBy: 'name', sortOrder: sortBy === 'name' && sortOrder === 'asc' ? 'desc' : 'asc' }).toString()}`}
                          >
                            Name
                          </a>
                        </th>
                        <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          <a
                            href={`?${new URLSearchParams({ ...Object.fromEntries(url.searchParams), sortBy: 'status', sortOrder: sortBy === 'status' && sortOrder === 'asc' ? 'desc' : 'asc' }).toString()}`}
                          >
                            Status
                          </a>
                        </th>
                        <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          <a
                            href={`?${new URLSearchParams({ ...Object.fromEntries(url.searchParams), sortBy: 'city', sortOrder: sortBy === 'city' && sortOrder === 'asc' ? 'desc' : 'asc' }).toString()}`}
                          >
                            Location
                          </a>
                        </th>
                        <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Contact</th>
                        <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          <a
                            href={`?${new URLSearchParams({ ...Object.fromEntries(url.searchParams), sortBy: 'updatedAt', sortOrder: sortBy === 'updatedAt' && sortOrder === 'asc' ? 'desc' : 'asc' }).toString()}`}
                          >
                            Updated
                          </a>
                        </th>
                        <th class="relative py-3.5 pl-3 pr-4 sm:pr-0">
                          <span class="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                      {filteredChurches.map((church) => (
                        <tr key={church.id}>
                          <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0">
                            {church.name}
                          </td>
                          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            <span
                              class={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                church.status === 'Listed'
                                  ? 'bg-green-100 text-green-800'
                                  : church.status === 'Ready to list'
                                    ? 'bg-blue-100 text-blue-800'
                                    : church.status === 'Assess'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : church.status === 'Needs data'
                                        ? 'bg-orange-100 text-orange-800'
                                        : church.status === 'Unlisted'
                                          ? 'bg-gray-100 text-gray-800'
                                          : church.status === 'Heretical'
                                            ? 'bg-red-100 text-red-800'
                                            : church.status === 'Closed'
                                              ? 'bg-gray-100 text-gray-800'
                                              : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {church.status}
                            </span>
                          </td>
                          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {church.gatheringAddress}
                            {church.countyName && <div class="text-xs text-gray-400">{church.countyName}</div>}
                          </td>
                          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {church.phone && <div>{church.phone}</div>}
                            {church.email && <div>{church.email}</div>}
                            {church.website && (
                              <div class="text-xs text-gray-400 truncate max-w-xs">{church.website}</div>
                            )}
                          </td>
                          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {church.updatedAt ? new Date(Number(church.updatedAt) * 1000).toLocaleDateString() : 'N/A'}
                          </td>
                          <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                            <a
                              href={`/admin/churches/${church.id}/edit`}
                              class="text-primary-600 hover:text-primary-900 mr-4"
                            >
                              Edit
                            </a>
                            <form method="post" action={`/admin/churches/${church.id}/delete`} class="inline">
                              <button
                                type="submit"
                                onclick="return confirm('Are you sure you want to delete this church?')"
                                class="text-red-600 hover:text-red-900"
                              >
                                Delete
                              </button>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div class="mt-6 flex items-center justify-between">
                <div class="flex-1 flex justify-between sm:hidden">
                  {page > 1 && (
                    <a
                      href={`?${new URLSearchParams({ ...Object.fromEntries(url.searchParams), page: (page - 1).toString() }).toString()}`}
                      class="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Previous
                    </a>
                  )}
                  {page < totalPages && (
                    <a
                      href={`?${new URLSearchParams({ ...Object.fromEntries(url.searchParams), page: (page + 1).toString() }).toString()}`}
                      class="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Next
                    </a>
                  )}
                </div>
                <div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p class="text-sm text-gray-700">
                      Showing <span class="font-medium">{offset + 1}</span> to{' '}
                      <span class="font-medium">{Math.min(offset + pageSize, totalCount?.count || 0)}</span> of{' '}
                      <span class="font-medium">{totalCount?.count || 0}</span> results
                    </p>
                  </div>
                  <div>
                    <nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      {page > 1 && (
                        <a
                          href={`?${new URLSearchParams({ ...Object.fromEntries(url.searchParams), page: (page - 1).toString() }).toString()}`}
                          class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                        >
                          Previous
                        </a>
                      )}
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                        <a
                          key={pageNum}
                          href={`?${new URLSearchParams({ ...Object.fromEntries(url.searchParams), page: pageNum.toString() }).toString()}`}
                          class={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            pageNum === page
                              ? 'z-10 bg-primary-50 border-primary-500 text-primary-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </a>
                      ))}
                      {page < totalPages && (
                        <a
                          href={`?${new URLSearchParams({ ...Object.fromEntries(url.searchParams), page: (page + 1).toString() }).toString()}`}
                          class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                        >
                          Next
                        </a>
                      )}
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {deletedChurches.length > 0 && (
          <div class="mt-6 rounded-md border border-gray-200 bg-gray-50 p-4">
            <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-700">Deleted Churches</h2>
            <ul class="mt-3 divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
              {deletedChurches.map((church) => (
                <li class="flex items-center justify-between px-4 py-3">
                  <div>
                    <p class="text-sm font-medium text-gray-900">{church.name}</p>
                    <p class="text-xs text-gray-500">
                      Status: {church.status || 'Unknown'} | Deleted:{' '}
                      {church.deletedAt ? church.deletedAt.toISOString() : 'unknown'}
                    </p>
                  </div>
                  <form method="post" action={`/admin/churches/${church.id}/restore`}>
                    <button
                      type="submit"
                      class="rounded-md border border-green-300 bg-white px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50"
                    >
                      Restore
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Layout>
  );
}
