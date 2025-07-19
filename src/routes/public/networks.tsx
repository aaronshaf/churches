import { eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { Layout } from '../../components/Layout';
import { createDbWithContext } from '../../db';
import { affiliations, churchAffiliations, churches } from '../../db/schema';
import { applyCacheHeaders, shouldSkipCache } from '../../middleware/cache';
import type { D1SessionVariables } from '../../middleware/d1-session';
import type { AuthVariables, Bindings } from '../../types';
import { getFromCache, putInCache } from '../../utils/cf-cache';
import { getCommonLayoutProps } from '../../utils/layout-props';

type Variables = AuthVariables & D1SessionVariables;

export const networksRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Networks (affiliations) page
networksRoutes.get('/networks', async (c) => {
  // Check if user is authenticated (skip cache for auth users)
  const hasSession = c.req.header('cookie')?.includes('session=');

  // Try to serve from cache first (only for non-authenticated users)
  if (!hasSession) {
    const cachedResponse = await getFromCache(c.req.raw);
    if (cachedResponse) {
      console.log('Cache HIT for networks page');
      return cachedResponse;
    }
  }

  const db = createDbWithContext(c);
  
  // Get common layout props (includes user, i18n, favicon, etc.)
  const layoutProps = await getCommonLayoutProps(c);
  const { t } = layoutProps;

  // Get all affiliations with church counts
  const affiliationsData = await db
    .select({
      id: affiliations.id,
      name: affiliations.name,
      website: affiliations.website,
      status: affiliations.status,
      churchCount: sql<number>`(
        SELECT COUNT(DISTINCT ca.church_id) 
        FROM ${churchAffiliations} ca 
        JOIN ${churches} c ON ca.church_id = c.id 
        WHERE ca.affiliation_id = ${affiliations.id} 
        AND c.status = 'Listed'
      )`.as('church_count'),
      unlistedCount: sql<number>`(
        SELECT COUNT(DISTINCT ca.church_id) 
        FROM ${churchAffiliations} ca 
        JOIN ${churches} c ON ca.church_id = c.id 
        WHERE ca.affiliation_id = ${affiliations.id} 
        AND c.status = 'Unlisted'
      )`.as('unlisted_count'),
    })
    .from(affiliations)
    .where(sql`${affiliations.status} != 'Heretical'`)
    .orderBy(affiliations.name)
    .all();

  // Filter to only show affiliations that have at least one church
  const activeAffiliations = affiliationsData.filter(
    (aff) => (aff.churchCount as number) > 0 || (aff.unlistedCount as number) > 0
  );

  const response = await c.html(
    <Layout title="Church Networks" {...layoutProps}>
      <div>
        {/* Header */}
        <div class="bg-gradient-to-r from-primary-600 to-primary-700">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="py-12 md:py-16">
              <h1 class="text-4xl font-bold text-white md:text-5xl">Church Networks</h1>
              <p class="mt-4 text-xl text-primary-100">
                Denominations and church planting networks in Utah
              </p>
            </div>
          </div>
        </div>

        {/* Networks List */}
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {activeAffiliations.length === 0 ? (
            <div class="text-center py-12">
              <p class="text-gray-500">No church networks found.</p>
            </div>
          ) : (
            <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {activeAffiliations.map((affiliation) => {
                const totalChurches = (affiliation.churchCount as number) + (affiliation.unlistedCount as number);
                const showUnlisted = affiliation.status === 'Unlisted' || (affiliation.churchCount as number) === 0;
                
                return (
                  <div class="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow">
                    <div class="px-4 py-5 sm:p-6">
                      <h3 class="text-lg font-medium text-gray-900">
                        {affiliation.website ? (
                          <a
                            href={affiliation.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-primary-600 hover:text-primary-700"
                          >
                            {affiliation.name}
                            <svg
                              class="inline-block w-4 h-4 ml-1"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                              />
                            </svg>
                          </a>
                        ) : (
                          affiliation.name
                        )}
                      </h3>
                      <p class="mt-2 text-sm text-gray-500">
                        {totalChurches} {totalChurches === 1 ? 'church' : 'churches'}
                        {showUnlisted && (affiliation.unlistedCount as number) > 0 && (
                          <span class="text-gray-400"> (includes unlisted)</span>
                        )}
                      </p>
                      {affiliation.status === 'Unlisted' && (
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 mt-2">
                          Unlisted Network
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );

  // Cache the response for non-authenticated users
  if (!hasSession) {
    // Cache for 1 day
    const ttl = 86400;
    c.executionCtx.waitUntil(putInCache(c.req.raw, response.clone(), ttl));
    console.log('Cached networks page');
  }

  // Apply cache headers if not authenticated
  return shouldSkipCache(c) ? response : applyCacheHeaders(response, 'networks');
});