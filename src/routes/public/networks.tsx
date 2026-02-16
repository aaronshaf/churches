import { and, eq, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { ChurchCard } from '../../components/ChurchCard';
import { Layout } from '../../components/Layout';
import { createDbWithContext } from '../../db';
import { affiliations, churchAffiliations, churches, counties, settings } from '../../db/schema';
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

  // Get all non-heretical affiliations
  const affiliationsData = await db
    .select()
    .from(affiliations)
    .where(and(sql`${affiliations.status} != 'Heretical'`, isNull(affiliations.deletedAt)))
    .orderBy(affiliations.name)
    .all();

  // Get all church-affiliation relationships with church status
  const churchAffiliationData = await db
    .select({
      affiliationId: churchAffiliations.affiliationId,
      churchId: churchAffiliations.churchId,
      churchStatus: churches.status,
    })
    .from(churchAffiliations)
    .innerJoin(churches, eq(churches.id, churchAffiliations.churchId))
    .where(sql`${churches.status} IN ('Listed', 'Unlisted') AND ${churches.deletedAt} IS NULL`)
    .all();

  // Count churches per affiliation
  const affiliationCounts = new Map<number, { listed: number; unlisted: number }>();

  for (const ca of churchAffiliationData) {
    const counts = affiliationCounts.get(ca.affiliationId) || { listed: 0, unlisted: 0 };
    if (ca.churchStatus === 'Listed') {
      counts.listed++;
    } else if (ca.churchStatus === 'Unlisted') {
      counts.unlisted++;
    }
    affiliationCounts.set(ca.affiliationId, counts);
  }

  // Filter affiliations that have at least one church
  const activeAffiliations = affiliationsData
    .map((aff) => {
      const counts = affiliationCounts.get(aff.id) || { listed: 0, unlisted: 0 };
      return {
        ...aff,
        churchCount: counts.listed,
        unlistedCount: counts.unlisted,
      };
    })
    .filter((aff) => aff.churchCount > 0 || aff.unlistedCount > 0);

  const response = await c.html(
    <Layout title={t('networks.title')} currentPath="/networks" {...layoutProps}>
      <div class="bg-gray-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900">{t('networks.title')}</h1>
          </div>

          {/* Affiliations Grid */}
          <div class="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-lg">
            <ul class="divide-y divide-gray-200">
              {activeAffiliations.map((affiliation) => (
                <li>
                  <a
                    href={`/networks/${affiliation.path || affiliation.id}`}
                    class="block px-6 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div class="flex items-center justify-between">
                      <div>
                        <h3 class="text-lg font-medium text-gray-900">
                          {affiliation.name}
                          <span class="ml-2 text-gray-500">({affiliation.churchCount})</span>
                        </h3>
                        {affiliation.publicNotes && <p class="mt-1 text-sm text-gray-600">{affiliation.publicNotes}</p>}
                      </div>
                      <svg
                        class="h-5 w-5 text-gray-400 flex-shrink-0 ml-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </a>
                </li>
              ))}
            </ul>

            {activeAffiliations.length === 0 && (
              <div class="text-center py-12">
                <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                <h3 class="mt-2 text-sm font-semibold text-gray-900">No networks available</h3>
                <p class="mt-1 text-sm text-gray-500">Check back later for church network information.</p>
              </div>
            )}
          </div>
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

// Individual network (affiliation) page
networksRoutes.get('/networks/:id', async (c) => {
  const affiliationIdOrPath = c.req.param('id');

  // Check if user is authenticated (skip cache for auth users)
  const hasSession = c.req.header('cookie')?.includes('session=');

  // Try to serve from cache first (only for non-authenticated users)
  if (!hasSession) {
    const cachedResponse = await getFromCache(c.req.raw);
    if (cachedResponse) {
      console.log(`Cache HIT for network: ${affiliationIdOrPath}`);
      return cachedResponse;
    }
  }

  const db = createDbWithContext(c);

  // Get common layout props (includes user, i18n, favicon, etc.)
  const layoutProps = await getCommonLayoutProps(c);
  const { t, user } = layoutProps;

  // Helper function to format URLs for display
  const formatUrlForDisplay = (url: string, maxLength: number = 40): string => {
    // Remove protocol
    let displayUrl = url.replace(/^https?:\/\//i, '');
    // Remove www.
    displayUrl = displayUrl.replace(/^www\./i, '');
    // Remove trailing slash
    displayUrl = displayUrl.replace(/\/$/, '');
    // Truncate if too long
    if (displayUrl.length > maxLength) {
      return `${displayUrl.substring(0, maxLength)}...`;
    }
    return displayUrl;
  };

  // Get affiliation details - check if it's a numeric ID or a path
  const isNumericId = /^\d+$/.test(affiliationIdOrPath);
  const affiliationIdentifierFilter = isNumericId
    ? eq(affiliations.id, Number(affiliationIdOrPath))
    : eq(affiliations.path, affiliationIdOrPath);
  const affiliation = await db
    .select()
    .from(affiliations)
    .where(and(affiliationIdentifierFilter, isNull(affiliations.deletedAt)))
    .get();

  if (!affiliation) {
    return c.notFound();
  }

  // Get all churches for this affiliation
  const affiliationChurches = await db
    .select({
      id: churches.id,
      name: churches.name,
      path: churches.path,
      status: churches.status,
      gatheringAddress: churches.gatheringAddress,
      website: churches.website,
      countyName: counties.name,
      countyPath: counties.path,
    })
    .from(churches)
    .innerJoin(churchAffiliations, eq(churches.id, churchAffiliations.churchId))
    .leftJoin(counties, eq(churches.countyId, counties.id))
    .where(
      sql`${churchAffiliations.affiliationId} = ${affiliation.id} AND (${churches.status} = 'Listed' OR ${churches.status} = 'Unlisted') AND ${churches.deletedAt} IS NULL`
    )
    .orderBy(churches.name)
    .all();

  // Separate listed and unlisted churches
  const listedChurches = affiliationChurches.filter((c) => c.status === 'Listed');
  const unlistedChurches = affiliationChurches.filter((c) => c.status === 'Unlisted');

  // Get site domain for ChurchCard
  const siteDomainSetting = await db.select().from(settings).where(eq(settings.key, 'site_domain')).get();
  const siteDomain = siteDomainSetting?.value || c.env.SITE_DOMAIN || 'localhost';

  const response = await c.html(
    <Layout title={`${affiliation.name}`} affiliationId={affiliation.id.toString()} {...layoutProps}>
      <div>
        {/* Header */}
        <div class="bg-gradient-to-r from-primary-600 to-primary-700">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="py-6 md:py-16">
              <div class="md:flex md:items-center md:justify-between">
                <div class="flex-1 min-w-0">
                  <h1 class="text-3xl font-bold text-white md:text-5xl">{affiliation.name}</h1>
                  <p class="mt-4 text-xl text-primary-100">
                    {listedChurches.length + unlistedChurches.length}{' '}
                    {listedChurches.length + unlistedChurches.length === 1 ? 'church' : 'churches'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {affiliation.website && (
            <div class="mb-6">
              <a
                href={affiliation.website}
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center text-primary-600 hover:text-primary-500"
              >
                <svg class="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                {formatUrlForDisplay(affiliation.website)}
              </a>
            </div>
          )}

          {affiliation.publicNotes && (
            <div class="mb-8">
              <p class="text-gray-700">{affiliation.publicNotes}</p>
            </div>
          )}

          {/* Churches List */}
          {listedChurches.length > 0 ? (
            <>
              <h2 class="sr-only">Churches</h2>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {listedChurches.map((church) => (
                  <div class="church-card listed-church">
                    <ChurchCard church={church} showCounty={false} domain={siteDomain} />
                  </div>
                ))}
              </div>
            </>
          ) : unlistedChurches.length > 0 ? (
            // If there are only unlisted churches, show them directly
            <>
              <h2 class="text-lg font-medium text-gray-900 mb-4">Unlisted Churches</h2>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {unlistedChurches.map((church) => (
                  <div class="church-card unlisted-church">
                    <ChurchCard church={church} showCounty={false} domain={siteDomain} />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p class="text-gray-600">No churches found for this network.</p>
          )}

          {/* Show more churches button only if there are listed churches AND unlisted churches */}
          {listedChurches.length > 0 && unlistedChurches.length > 0 && (
            <div class="mt-8">
              <button
                type="button"
                id="show-unlisted"
                class="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                onclick="showUnlistedChurches()"
              >
                Show more churches ({unlistedChurches.length})
              </button>

              <div id="unlisted-churches" class="hidden mt-6">
                <h2 class="sr-only">Unlisted Churches</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {unlistedChurches.map((church) => (
                    <div class="church-card unlisted-church">
                      <ChurchCard church={church} domain={siteDomain} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* JavaScript for showing unlisted churches and quick edit */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
            function showUnlistedChurches() {
              const button = document.getElementById('show-unlisted');
              const unlistedSection = document.getElementById('unlisted-churches');
              
              // Show the section
              unlistedSection.classList.remove('hidden');
              
              // Hide the button
              button.style.display = 'none';
            }
            
            // Edit hotkey for admins and contributors
            ${
              user && (user.role === 'admin' || user.role === 'contributor')
                ? `
            document.addEventListener('keydown', function(e) {
              // Check if 'E' key is pressed and we're not in an input field
              if (e.key === 'e' || e.key === 'E') {
                const activeElement = document.activeElement;
                const isInputField = activeElement && (
                  activeElement.tagName === 'INPUT' ||
                  activeElement.tagName === 'TEXTAREA' ||
                  activeElement.tagName === 'SELECT' ||
                  activeElement.contentEditable === 'true'
                );
                
                if (!isInputField) {
                  e.preventDefault();
                  window.location.href = '/admin/affiliations/${affiliation.id}/edit';
                }
              }
            });
            `
                : ''
            }
            `,
          }}
        />
      </div>
    </Layout>
  );

  // Cache the response for non-authenticated users
  if (!hasSession) {
    // Cache for 1 day
    const ttl = 86400;
    c.executionCtx.waitUntil(putInCache(c.req.raw, response.clone(), ttl));
    console.log(`Cached network page: ${affiliationIdOrPath}`);
  }

  // Apply cache headers if not authenticated
  return shouldSkipCache(c) ? response : applyCacheHeaders(response, 'network-detail');
});
