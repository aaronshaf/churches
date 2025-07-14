import { desc, eq, isNotNull, sql } from 'drizzle-orm';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { ChurchCard } from './components/ChurchCard';
import { ChurchComments } from './components/ChurchComments';
import { CountyForm } from './components/CountyForm';
import { ErrorPage } from './components/ErrorPage';
import { Layout } from './components/Layout';
import { MonitoringDashboard } from './components/MonitoringDashboard';
import { NotFound } from './components/NotFound';
import { OptimizedImage } from './components/OptimizedImage';
import { PageForm } from './components/PageForm';
import { SettingsForm } from './components/SettingsForm';
import { createDb, createDbWithContext } from './db';
import { users } from './db/auth-schema';
import {
  affiliations,
  churchAffiliations,
  churches,
  churchGatherings,
  churchImages,
  churchSuggestions,
  comments,
  counties,
  pages,
  settings,
} from './db/schema';
import { createAuth } from './lib/auth';
import { betterAuthMiddleware, getUser, requireAdminBetter } from './middleware/better-auth';
import { applyCacheHeaders, shouldSkipCache } from './middleware/cache';
import { domainRedirectMiddleware } from './middleware/domain-redirect';
import { envCheckMiddleware } from './middleware/env-check';
import { i18nMiddleware } from './middleware/i18n';
import { adminActivityRoutes } from './routes/admin/activity';
import { adminAffiliationsRoutes } from './routes/admin/affiliations';
import { adminChurchesRoutes } from './routes/admin/churches';
import { adminDebugRoutes } from './routes/admin/debug';
import { adminFeedbackRoutes } from './routes/admin/feedback';
import { adminNotificationsRoutes } from './routes/admin/notifications';
import { adminUsersApp } from './routes/admin-users';
import { apiRoutes } from './routes/api';
import { betterAuthApp } from './routes/better-auth';
import { churchDetailRoutes } from './routes/church-detail';
import { dataExportRoutes } from './routes/data-export';
import { feedbackRoutes } from './routes/feedback';
import { seoRoutes } from './routes/seo';
import type { AuthVariables, BetterAuthUser, Bindings } from './types';
import { cacheInvalidation } from './utils/cache-invalidation';
import { getGravatarUrl } from './utils/crypto';
import { EnvironmentError } from './utils/env-validation';
import { generateErrorId, getErrorStatusCode, sanitizeErrorMessage } from './utils/error-handling';
import { getCommonLayoutProps } from './utils/layout-props';
import { getImagePrefix, getSiteTitle } from './utils/settings';
import { countySchema, pageSchema, parseFormBody, validateFormData } from './utils/validation';

type Variables = AuthVariables;

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Apply environment check middleware globally
app.use('*', envCheckMiddleware);

// Apply domain redirect middleware globally (but after env check)
app.use('*', domainRedirectMiddleware);

// Apply i18n middleware globally
app.use('*', i18nMiddleware);

// Global error handler
app.onError((err, c) => {
  const errorId = generateErrorId();
  const statusCode = getErrorStatusCode(err);

  // Log the full error with ID for debugging
  console.error(`[${errorId}] Application error:`, err);

  // Handle environment variable errors specially
  if (err instanceof EnvironmentError) {
    return c.html(
      <Layout currentPath="/error" hideFooter={true}>
        <ErrorPage
          error={err.message}
          errorType="Configuration Error"
          errorDetails="Please ensure all required environment variables are set in your deployment configuration."
          statusCode={500}
          errorId={errorId}
        />
      </Layout>,
      500
    );
  }

  // Sanitize and categorize the error
  const { message, type, details } = sanitizeErrorMessage(err);

  // Check if it's an API request
  const isApiRequest = c.req.path.startsWith('/api/') || c.req.header('Accept')?.includes('application/json');

  if (isApiRequest) {
    return c.json(
      {
        error: type,
        message: details || message,
        errorId,
        statusCode,
      },
      statusCode
    );
  }

  // Handle HTML error pages
  return c.html(
    <Layout currentPath="/error" hideFooter={true}>
      <ErrorPage error={message} errorType={type} errorDetails={details} statusCode={statusCode} errorId={errorId} />
    </Layout>,
    statusCode
  );
});

// Test route to verify pattern matching
app.get('/api/auth/test', async (c) => {
  return c.json({ message: 'Test route works!' });
});

// Environment variables diagnostic route (only in development)
app.get('/api/env-check', async (c) => {
  // Only allow in development for security
  // NODE_ENV is not available in Cloudflare Workers
  // This endpoint should be protected by other means

  const { getEnvVarStatus } = await import('./utils/env-validation');
  const status = getEnvVarStatus(c.env);

  return c.json({
    status: status.allRequired ? 'OK' : 'ERROR',
    missing: status.missing,
    present: status.present.map((v) => v.replace(/_/g, '_')), // Just list the names
    allRequired: status.allRequired,
  });
});

// Debug route to see what better-auth provides
app.get('/api/auth/debug', async (c) => {
  try {
    const auth = createAuth(c.env);
    return c.json({
      message: 'Better-auth debug',
      config: {
        baseURL: auth.options.baseURL,
        socialProviders: Object.keys(auth.options.socialProviders || {}),
      },
    });
  } catch (error) {
    if (error instanceof EnvironmentError) {
      return c.json(
        {
          error: 'Missing required environment variables',
          missing: error.missingVars,
        },
        500
      );
    }
    throw error;
  }
});

// Mount better-auth API routes BEFORE middleware - try different pattern
app.all('/api/auth/*', async (c) => {
  console.log('Better-auth route called:', c.req.method, c.req.url);
  try {
    const auth = createAuth(c.env);
    const result = await auth.handler(c.req.raw);
    console.log('Better-auth handler result status:', result?.status);
    console.log('Better-auth handler result type:', typeof result);
    if (result?.status === 404) {
      console.log('Better-auth 404 - endpoint not found');
    }
    return result;
  } catch (error) {
    console.error('Better-auth handler error:', error);
    if (error instanceof EnvironmentError) {
      return c.json(
        {
          error: 'Authentication service configuration error',
          details: `Missing required environment variables: ${error.missingVars.join(', ')}`,
        },
        500
      );
    }
    return c.json({ error: 'Auth handler failed' }, 500);
  }
});

// Apply better-auth middleware globally
app.use('*', betterAuthMiddleware);

app.use('/api/*', cors());

// Helper function to fetch favicon URL
async function getFaviconUrl(env: Bindings): Promise<string | undefined> {
  const db = createDb(env.DB);
  const faviconUrlSetting = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, 'favicon_url'))
    .get();
  return faviconUrlSetting?.value || undefined;
}

// Helper function to fetch logo URL
async function getLogoUrl(env: Bindings): Promise<string | undefined> {
  const db = createDb(env.DB);
  const logoUrlSetting = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, 'logo_url'))
    .get();
  return logoUrlSetting?.value || undefined;
}

// Helper function to fetch navbar pages
async function getNavbarPages(
  env: Bindings
): Promise<Array<{ id: number; title: string; path: string; navbarOrder: number | null }>> {
  const db = createDb(env.DB);
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
  return navbarPages;
}

// Helper function to gather all common Layout props
async function getLayoutProps(c: { env: Bindings } & Pick<Context, 'req'>): Promise<{
  user: BetterAuthUser | null;
  faviconUrl?: string;
  logoUrl?: string;
  siteTitle: string;
  pages: Array<{ id: number; title: string; path: string; navbarOrder: number | null }>;
}> {
  const user = await getUser(c);
  const faviconUrl = await getFaviconUrl(c.env);
  const logoUrl = await getLogoUrl(c.env);
  const siteTitle = await getSiteTitle(c.env);
  const pages = await getNavbarPages(c.env);

  return {
    user,
    faviconUrl,
    logoUrl,
    siteTitle,
    pages,
  };
}

// Global error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);

  // Check if it's a database connection error
  const isDatabaseError =
    err.message?.includes('Network connection lost') ||
    err.message?.includes('Failed query') ||
    err.message?.includes('D1_ERROR') ||
    err.message?.includes('Database is not defined') ||
    err.message?.includes('Cannot read properties of undefined') ||
    ('cause' in err &&
      err.cause &&
      typeof err.cause === 'object' &&
      'message' in err.cause &&
      typeof err.cause.message === 'string' &&
      (err.cause.message.includes('Network connection lost') ||
        err.cause.message.includes('D1_ERROR') ||
        err.cause.message.includes('Database is not defined')));

  const rawStatus = 'status' in err && typeof err.status === 'number' ? err.status : 500;
  const statusCode: 400 | 401 | 403 | 404 | 408 | 429 | 500 = [400, 401, 403, 404, 408, 429, 500].includes(rawStatus)
    ? (rawStatus as 400 | 401 | 403 | 404 | 408 | 429 | 500)
    : 500;

  return c.html(
    <Layout title="Error">
      <ErrorPage error={isDatabaseError ? 'Database connection error' : err.message} statusCode={statusCode} />
    </Layout>,
    statusCode
  );
});

// .well-known/traffic-advice endpoint
app.get('/.well-known/traffic-advice', async (c) => {
  const db = createDbWithContext(c);

  // Get configured domain from settings
  const siteDomainSetting = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, 'site_domain'))
    .get();

  const configuredDomain = siteDomainSetting?.value || c.env.SITE_DOMAIN || 'localhost';

  return c.json([
    {
      user_agent: '*',
      canonical_domain: configuredDomain,
    },
  ]);
});

// Mount better-auth routes
app.route('/auth', betterAuthApp);

// Mount admin users route
app.route('/admin/users', adminUsersApp);

// Mount API routes
app.route('/api', apiRoutes);

// Mount SEO routes
app.route('/', seoRoutes);

// Mount data export routes
app.route('/', dataExportRoutes);

// Mount church detail routes
app.route('/', churchDetailRoutes);

// Mount admin routes
app.route('/admin/churches', adminChurchesRoutes);
app.route('/admin/affiliations', adminAffiliationsRoutes);
app.route('/admin/feedback', adminFeedbackRoutes);
app.route('/admin/activity', adminActivityRoutes);
app.route('/admin/debug', adminDebugRoutes);
app.route('/api/admin/notifications', adminNotificationsRoutes);
app.route('/feedback', feedbackRoutes);

app.get('/', async (c) => {
  try {
    const db = createDbWithContext(c);

    // Get all layout props with i18n support
    const layoutProps = await getCommonLayoutProps(c);

    // Check for missing critical settings
    const [siteDomainSetting, siteRegionSetting, siteTitleSetting, frontPageTitleSetting] = await Promise.all([
      db.select().from(settings).where(eq(settings.key, 'site_domain')).get(),
      db.select().from(settings).where(eq(settings.key, 'site_region')).get(),
      db.select().from(settings).where(eq(settings.key, 'site_title')).get(),
      db.select().from(settings).where(eq(settings.key, 'front_page_title')).get(),
    ]);

    const missingSettings = [];
    if (!siteDomainSetting?.value) missingSettings.push('Site Domain');
    if (!siteRegionSetting?.value) missingSettings.push('Site Region');
    if (!siteTitleSetting?.value) missingSettings.push('Site Title');
    if (!frontPageTitleSetting?.value) missingSettings.push('Front Page Title');

    const frontPageTitle = frontPageTitleSetting?.value || 'Christian Churches';

    // Get counties that have churches, with church count (only Listed and Unlisted)
    const countiesWithChurches = await db
      .select({
        id: counties.id,
        name: counties.name,
        path: counties.path,
        description: counties.description,
        population: counties.population,
        churchCount: sql<number>`COUNT(${churches.id})`.as('churchCount'),
      })
      .from(counties)
      .innerJoin(churches, sql`${counties.id} = ${churches.countyId} AND ${churches.status} IN ('Listed', 'Unlisted')`)
      .groupBy(counties.id, counties.name, counties.path, counties.description, counties.population)
      .orderBy(desc(counties.population))
      .all();

    const _totalChurches = countiesWithChurches.reduce((sum, county) => sum + county.churchCount, 0);

    const { t } = layoutProps;

    const response = await c.html(
      <Layout title={frontPageTitle} currentPath="/" {...layoutProps}>
        <div class="bg-gray-50">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8 sm:py-8">
            {/* Setup Alert for Admins */}
            {layoutProps.user?.role === 'admin' && missingSettings.length > 0 && (
              <div class="mb-6 bg-white rounded-lg shadow-sm ring-1 ring-gray-200 p-4">
                <div class="flex items-start gap-3">
                  <div class="flex-shrink-0">
                    <div class="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                      <svg
                        class="h-5 w-5 text-amber-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="2"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                        />
                      </svg>
                    </div>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900">{t('Complete your site setup')}</p>
                    <p class="mt-1 text-sm text-gray-500">
                      {missingSettings.length} setting{missingSettings.length !== 1 ? 's' : ''} need
                      {missingSettings.length === 1 ? 's' : ''} configuration:{' '}
                      {missingSettings.map((setting, index) => (
                        <>
                          {index > 0 && ', '}
                          <span class="font-medium text-gray-700">{setting}</span>
                        </>
                      ))}
                    </p>
                    <div class="mt-3">
                      <a href="/admin/settings" class="text-sm font-medium text-amber-600 hover:text-amber-500">
                        {t('Configure now →')}
                      </a>
                    </div>
                  </div>
                  <div class="flex-shrink-0 ml-4">
                    <button
                      type="button"
                      onclick="this.closest('.bg-white').remove()"
                      class="inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:text-gray-500"
                    >
                      <span class="sr-only">Dismiss</span>
                      <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fill-rule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clip-rule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Header */}
            <h1 class="sr-only">Churches</h1>
            <p class="sr-only">A directory of evangelical churches</p>

            {/* Map Card */}
            <div class="mb-4 sm:mb-8">
              <a
                href="/map"
                class="block bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl shadow-sm hover:shadow-lg transition-all duration-200 p-8 text-white group"
              >
                <div class="flex items-center justify-between">
                  <div>
                    <div class="flex items-center mb-2">
                      <svg class="w-8 h-8 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      <h2 class="text-2xl font-semibold group-hover:underline group-focus:underline group-active:underline">
                        {t('Find a Church Near You')}
                      </h2>
                    </div>
                    <p class="text-primary-100">{t('Explore map of evangelical churches')}</p>
                  </div>
                  <svg
                    class="h-8 w-8 text-primary-200 group-hover:translate-x-1 transition-transform"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </a>
            </div>

            {/* Counties Grid */}
            <div>
              <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
                <h2 class="text-2xl font-bold text-gray-900 mb-4 sm:mb-0">{t('Browse by County')}</h2>
                <div class="flex items-center space-x-2">
                  <span class="text-sm text-gray-700">{t('Sort by:')}</span>
                  <fieldset class="inline-flex rounded-md shadow-sm">
                    <button
                      type="button"
                      id="sort-population"
                      class="sort-button-population px-3 py-1.5 text-sm font-medium border rounded-l-md focus:z-10 focus:ring-2 focus:ring-primary-500"
                      onclick="sortCounties('population')"
                    >
                      {t('Population')}
                    </button>
                    <button
                      type="button"
                      id="sort-name"
                      class="sort-button-name px-3 py-1.5 text-sm font-medium border rounded-r-md focus:z-10 focus:ring-2 focus:ring-primary-500"
                      onclick="sortCounties('name')"
                    >
                      {t('Name')}
                    </button>
                  </fieldset>
                  <script
                    dangerouslySetInnerHTML={{
                      __html: `
                      // Set initial button styles based on saved preference
                      (function() {
                        const savedSort = localStorage.getItem('countySort') || 'population';
                        const popBtn = document.getElementById('sort-population');
                        const nameBtn = document.getElementById('sort-name');
                        
                        if (savedSort === 'name') {
                          popBtn.className = 'sort-button-population px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-l-md hover:bg-gray-50 focus:z-10 focus:ring-2 focus:ring-primary-500';
                          nameBtn.className = 'sort-button-name px-3 py-1.5 text-sm font-medium text-white bg-primary-600 border border-primary-600 rounded-r-md hover:bg-primary-700 focus:z-10 focus:ring-2 focus:ring-primary-500';
                        } else {
                          popBtn.className = 'sort-button-population px-3 py-1.5 text-sm font-medium text-white bg-primary-600 border border-primary-600 rounded-l-md hover:bg-primary-700 focus:z-10 focus:ring-2 focus:ring-primary-500';
                          nameBtn.className = 'sort-button-name px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-r-md hover:bg-gray-50 focus:z-10 focus:ring-2 focus:ring-primary-500';
                        }
                      })();
                    `,
                    }}
                  />
                </div>
              </div>
              <div id="counties-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {countiesWithChurches.map((county) => (
                  <div
                    class="county-card group bg-white rounded-lg ring-1 ring-gray-200 hover:ring-gray-300 transition-all duration-200 p-6"
                    data-name={county.name}
                    data-population={county.population || 0}
                  >
                    <div class="flex items-start justify-between">
                      <div class="flex-1">
                        <h3 class="text-base font-semibold mb-1">
                          <a
                            href={`/counties/${county.path || county.id}`}
                            class="text-primary-600 hover:text-primary-700 hover:underline transition-colors"
                            onmouseover={`preloadAfterDelay('/counties/${county.path || county.id}', 200)`}
                            onmouseout="cancelPreload()"
                          >
                            {county.name}
                          </a>
                        </h3>
                        <p class="mt-1 text-sm text-gray-500">
                          {county.churchCount} {county.churchCount === 1 ? t('church') : t('churches')}
                        </p>
                        {county.description && (
                          <p class="mt-2 text-sm text-gray-600 line-clamp-2">{county.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sorting Script */}
          <script
            dangerouslySetInnerHTML={{
              __html: `
              function sortCounties(sortBy) {
                const grid = document.getElementById('counties-grid');
                const cards = Array.from(document.querySelectorAll('.county-card'));
                
                // Update button styles
                const popBtn = document.getElementById('sort-population');
                const nameBtn = document.getElementById('sort-name');
                
                if (sortBy === 'population') {
                  popBtn.className = 'px-3 py-1.5 text-sm font-medium text-white bg-primary-600 border border-primary-600 rounded-l-md hover:bg-primary-700 focus:z-10 focus:ring-2 focus:ring-primary-500';
                  nameBtn.className = 'px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-r-md hover:bg-gray-50 focus:z-10 focus:ring-2 focus:ring-primary-500';
                  
                  // Sort by population (descending)
                  cards.sort((a, b) => {
                    const popA = parseInt(a.dataset.population) || 0;
                    const popB = parseInt(b.dataset.population) || 0;
                    return popB - popA;
                  });
                } else {
                  popBtn.className = 'px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-l-md hover:bg-gray-50 focus:z-10 focus:ring-2 focus:ring-primary-500';
                  nameBtn.className = 'px-3 py-1.5 text-sm font-medium text-white bg-primary-600 border border-primary-600 rounded-r-md hover:bg-primary-700 focus:z-10 focus:ring-2 focus:ring-primary-500';
                  
                  // Sort by name (ascending)
                  cards.sort((a, b) => {
                    const nameA = a.dataset.name.toLowerCase();
                    const nameB = b.dataset.name.toLowerCase();
                    return nameA.localeCompare(nameB);
                  });
                }
                
                // Re-append cards in new order
                cards.forEach(card => grid.appendChild(card));
                
                // Update aria-checked attributes
                const group = popBtn.parentElement;
                group.querySelectorAll('button').forEach(btn => {
                  btn.setAttribute('aria-checked', btn.classList.contains('bg-primary-600') ? 'true' : 'false');
                });
              }
            `,
            }}
          />
        </div>
      </Layout>
    );

    // Apply cache headers if not authenticated
    return shouldSkipCache(c) ? response : applyCacheHeaders(response, 'homepage');
  } catch (error) {
    console.error('Error loading home page:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to load churches';
    return c.html(
      <Layout title="Error">
        <ErrorPage error={errorMessage} statusCode={500} />
      </Layout>,
      500
    );
  }
});

app.get('/counties/:path', async (c) => {
  const db = createDbWithContext(c);
  const countyPath = c.req.param('path');

  // Get common layout props (includes user, i18n, favicon, etc.)
  const layoutProps = await getCommonLayoutProps(c);
  const { t } = layoutProps;

  // Get county by path
  const county = await db.select().from(counties).where(eq(counties.path, countyPath)).get();

  if (!county) {
    return c.html(
      <Layout title="Page Not Found" {...layoutProps}>
        <NotFound />
      </Layout>,
      404
    );
  }

  // Get all churches in this county (excluding heretical)
  const countyChurches = await db
    .select({
      id: churches.id,
      name: churches.name,
      path: churches.path,
      status: churches.status,
      gatheringAddress: churches.gatheringAddress,
      website: churches.website,
      language: churches.language,
      publicNotes: churches.publicNotes,
    })
    .from(churches)
    .where(sql`${churches.countyId} = ${county.id} AND ${churches.status} != 'Heretical'`)
    .orderBy(churches.name)
    .all();

  // Get gatherings for all churches
  const churchIds = countyChurches.map((c) => c.id);
  const gatherings =
    churchIds.length > 0
      ? await db
          .select()
          .from(churchGatherings)
          .where(sql`${churchGatherings.churchId} IN (${sql.join(churchIds, sql`, `)})`)
          .all()
      : [];

  // Create a map of church ID to gatherings
  const gatheringsByChurchId = gatherings.reduce(
    (acc, gathering) => {
      if (!acc[gathering.churchId]) {
        acc[gathering.churchId] = [];
      }
      acc[gathering.churchId].push(gathering);
      return acc;
    },
    {} as Record<number, typeof gatherings>
  );

  // Add gatherings to each church
  const churchesWithGatherings = countyChurches.map((church) => ({
    ...church,
    gatherings: gatheringsByChurchId[church.id] || [],
  }));

  // Separate listed and unlisted churches
  const listedChurches = churchesWithGatherings.filter((c) => c.status === 'Listed');
  const unlistedChurches = churchesWithGatherings.filter((c) => c.status === 'Unlisted');

  // Layout props already fetched above

  // Get site domain for ChurchCard
  const siteDomainSetting = await db.select().from(settings).where(eq(settings.key, 'site_domain')).get();
  const siteDomain = siteDomainSetting?.value || c.env.SITE_DOMAIN || 'localhost';

  const response = await c.html(
    <Layout title={`${county.name} Churches`} countyId={county.id.toString()} {...layoutProps}>
      <div>
        {/* Header */}
        <div class="bg-gradient-to-r from-primary-600 to-primary-700">
          <div class="max-w-7xl mx-auto px-8 sm:px-6 lg:px-8">
            <div class="py-12 md:py-16">
              <div class="md:flex md:items-center md:justify-between">
                <div class="flex-1 min-w-0">
                  <h1 class="text-4xl font-bold text-white md:text-5xl">{county.name}</h1>
                  <div class="mt-4 text-xl text-primary-100">
                    <p>
                      {listedChurches.length + unlistedChurches.length}{' '}
                      {listedChurches.length + unlistedChurches.length === 1
                        ? 'evangelical church'
                        : 'evangelical churches'}
                    </p>
                    {county.population && (
                      <p
                        class="cursor-help"
                        title={`1 evangelical church per ${Math.round(county.population / (listedChurches.length + unlistedChurches.length)).toLocaleString()} people`}
                      >
                        Population: {county.population.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Churches Grid */}
        <div class="max-w-7xl mx-auto px-8 sm:px-6 lg:px-8 py-6 sm:py-12">
          {listedChurches.length === 0 && unlistedChurches.length === 0 ? (
            <div class="text-center py-12">
              <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 class="mt-2 text-sm font-medium text-gray-900">No churches found</h3>
              <p class="mt-1 text-sm text-gray-500">No churches have been added to this county yet.</p>
              <div class="mt-6">
                <a href="/" class="text-primary-600 hover:text-primary-500 font-medium">
                  &larr; Back to all counties
                </a>
              </div>
            </div>
          ) : (
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Listed Churches */}
              {listedChurches.map((church) => (
                <div class="church-card listed-church">
                  <ChurchCard church={church} domain={siteDomain} />
                </div>
              ))}

              {/* Unlisted Churches (hidden by default unless no listed churches) */}
              {unlistedChurches.map((church) => (
                <div class={`church-card unlisted-church ${listedChurches.length > 0 ? 'hidden' : ''}`}>
                  <ChurchCard church={church} domain={siteDomain} />
                </div>
              ))}
            </div>
          )}

          {/* Show unlisted checkbox - moved to bottom */}
          {unlistedChurches.length > 0 && listedChurches.length > 0 && (
            <div class="mt-8 text-center">
              <button
                type="button"
                id="show-unlisted"
                class="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                onclick="showUnlistedChurches()"
                disabled={listedChurches.length + unlistedChurches.length === 1}
              >
                Show more churches ({unlistedChurches.length})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* JavaScript for showing unlisted churches */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
          function showUnlistedChurches() {
            const button = document.getElementById('show-unlisted');
            const unlistedChurches = document.querySelectorAll('.unlisted-church');
            
            // Show all unlisted churches
            unlistedChurches.forEach(church => {
              church.classList.remove('hidden');
            });
            
            // Hide the button after clicking
            button.style.display = 'none';
          }
        `,
        }}
      />
    </Layout>
  );

  // Apply cache headers if not authenticated
  return shouldSkipCache(c) ? response : applyCacheHeaders(response, 'counties');
});

app.get('/networks', async (c) => {
  const db = createDbWithContext(c);

  // Get common layout props (includes user, i18n, favicon, etc.)
  const layoutProps = await getCommonLayoutProps(c);
  const { t } = layoutProps;

  // Get all listed affiliations with church count (only count churches with 'Listed' status)
  const listedAffiliations = await db
    .select({
      id: affiliations.id,
      name: affiliations.name,
      path: affiliations.path,
      website: affiliations.website,
      publicNotes: affiliations.publicNotes,
      churchCount: sql<number>`COUNT(DISTINCT ${churches.id})`.as('churchCount'),
    })
    .from(affiliations)
    .leftJoin(churchAffiliations, eq(affiliations.id, churchAffiliations.affiliationId))
    .leftJoin(churches, sql`${churchAffiliations.churchId} = ${churches.id} AND ${churches.status} = 'Listed'`)
    .where(eq(affiliations.status, 'Listed'))
    .groupBy(affiliations.id)
    .having(sql`COUNT(DISTINCT ${churches.id}) > 0`)
    .orderBy(affiliations.name)
    .all();

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
              {listedAffiliations.map((affiliation) => (
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

            {listedAffiliations.length === 0 && (
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

  // Apply cache headers if not authenticated
  return shouldSkipCache(c) ? response : applyCacheHeaders(response, 'networks');
});

// Suggest a Church page
app.get('/suggest-church', async (c) => {
  const user = await getUser(c);
  const logoUrl = await getLogoUrl(c.env);
  const navbarPages = await getNavbarPages(c.env);
  const showSuccess = c.req.query('success') === 'true';

  // Show login prompt if not logged in
  if (!user) {
    return c.html(
      <Layout title="Suggest a Church" user={user} logoUrl={logoUrl} pages={navbarPages} currentPath="/suggest-church">
        <div class="mx-auto max-w-lg px-4 py-16 sm:px-6 lg:px-8">
          <div class="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl p-8 text-center">
            <svg class="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <h2 class="text-2xl font-semibold text-gray-900 mb-2">Sign In Required</h2>
            <p class="text-gray-600 mb-6">
              You need to sign in before you can suggest a church. This helps us maintain the quality of our directory
              and contact you if we have questions about your suggestion.
            </p>
            <a
              href={`/auth/signin?redirect=${encodeURIComponent('/suggest-church')}`}
              class="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
              data-testid="signin-button"
            >
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                />
              </svg>
              Sign In to Continue
            </a>
          </div>
        </div>
      </Layout>
    );
  }

  return c.html(
    <Layout
      title="Suggest a Church - Utah Churches"
      user={user}
      logoUrl={logoUrl}
      pages={navbarPages}
      currentPath="/suggest-church"
    >
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <form
          method="post"
          action="/suggest-church"
          onsubmit="handleSuggestSubmit(event)"
          class="space-y-8 max-w-4xl mx-auto"
          data-testid="suggest-church-form"
        >
          <div class="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
            <div class="px-4 py-6 sm:p-8">
              <div class="mx-auto">
                <h2 class="text-xl font-semibold leading-7 text-gray-900 mb-4">Suggest a Church</h2>

                {showSuccess && (
                  <div class="rounded-md bg-green-50 p-4 mb-6" data-testid="success-message">
                    <div class="flex">
                      <div class="flex-shrink-0">
                        <svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fill-rule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clip-rule="evenodd"
                          />
                        </svg>
                      </div>
                      <div class="ml-3">
                        <p class="text-sm font-medium text-green-800">
                          Thank you! Your church suggestion has been submitted successfully.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div class="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-6">
                  <div class="sm:col-span-4">
                    <label for="church-name" class="block text-sm font-medium leading-6 text-gray-900">
                      Church Name <span class="text-red-500">*</span>
                    </label>
                    <div class="mt-1">
                      <input
                        type="text"
                        id="church-name"
                        name="churchName"
                        required
                        class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                        placeholder="Grace Community Church"
                        data-testid="church-name-input"
                      />
                    </div>
                  </div>

                  <div class="sm:col-span-6">
                    <label for="denomination" class="block text-sm font-medium leading-6 text-gray-900">
                      Affiliations
                    </label>
                    <div class="mt-1">
                      <input
                        type="text"
                        id="denomination"
                        name="denomination"
                        class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                        placeholder="Presbyterian Church in America, Southern Baptist Convention"
                        data-testid="denomination-input"
                      />
                    </div>
                  </div>

                  <div class="sm:col-span-6">
                    <label for="address" class="block text-sm font-medium leading-6 text-gray-900">
                      Address
                    </label>
                    <div class="mt-1">
                      <input
                        type="text"
                        id="address"
                        name="address"
                        class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                        placeholder="123 Main St, Salt Lake City, UT 84101"
                        data-testid="address-input"
                      />
                    </div>
                  </div>

                  <div class="sm:col-span-6">
                    <label for="service-times" class="block text-sm font-medium leading-6 text-gray-900">
                      Service Times
                    </label>
                    <div class="mt-1">
                      <textarea
                        id="service-times"
                        name="serviceTimes"
                        rows={3}
                        class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                        placeholder="Sunday 9:00 AM - Traditional Service&#10;Sunday 11:00 AM - Contemporary Service&#10;Wednesday 7:00 PM - Bible Study"
                        data-testid="service-times-textarea"
                      ></textarea>
                    </div>
                  </div>

                  <div class="sm:col-span-6">
                    <label for="website" class="block text-sm font-medium leading-6 text-gray-900">
                      Website <span class="text-red-500">*</span>
                    </label>
                    <div class="mt-1">
                      <input
                        type="url"
                        id="website"
                        name="website"
                        required
                        class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                        placeholder="https://example.church"
                        data-testid="website-input"
                      />
                    </div>
                  </div>

                  <div class="sm:col-span-6">
                    <label for="statement-of-faith" class="block text-sm font-medium leading-6 text-gray-900">
                      Statement of Faith URL
                    </label>
                    <div class="mt-1">
                      <input
                        type="url"
                        id="statement-of-faith"
                        name="statementOfFaith"
                        class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                        placeholder="https://example.church/beliefs"
                        data-testid="statement-of-faith-input"
                      />
                    </div>
                  </div>

                  <div class="sm:col-span-3">
                    <label for="phone" class="block text-sm font-medium leading-6 text-gray-900">
                      Phone Number
                    </label>
                    <div class="mt-1">
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                        placeholder="(801) 555-0123"
                        data-testid="phone-input"
                      />
                    </div>
                  </div>

                  <div class="sm:col-span-3">
                    <label for="email" class="block text-sm font-medium leading-6 text-gray-900">
                      Email
                    </label>
                    <div class="mt-1">
                      <input
                        type="email"
                        id="email"
                        name="email"
                        class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                        placeholder="info@example.church"
                        data-testid="email-input"
                      />
                    </div>
                  </div>

                  <div class="sm:col-span-3">
                    <label for="facebook" class="block text-sm font-medium leading-6 text-gray-900">
                      Facebook
                    </label>
                    <div class="mt-1">
                      <input
                        type="url"
                        id="facebook"
                        name="facebook"
                        class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                        placeholder="https://facebook.com/churchname"
                        data-testid="facebook-input"
                      />
                    </div>
                  </div>

                  <div class="sm:col-span-3">
                    <label for="instagram" class="block text-sm font-medium leading-6 text-gray-900">
                      Instagram
                    </label>
                    <div class="mt-1">
                      <input
                        type="url"
                        id="instagram"
                        name="instagram"
                        class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                        placeholder="https://instagram.com/churchname"
                        data-testid="instagram-input"
                      />
                    </div>
                  </div>

                  <div class="sm:col-span-3">
                    <label for="youtube" class="block text-sm font-medium leading-6 text-gray-900">
                      YouTube
                    </label>
                    <div class="mt-1">
                      <input
                        type="url"
                        id="youtube"
                        name="youtube"
                        class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                        placeholder="https://youtube.com/@churchname"
                        data-testid="youtube-input"
                      />
                    </div>
                  </div>

                  <div class="sm:col-span-3">
                    <label for="spotify" class="block text-sm font-medium leading-6 text-gray-900">
                      Spotify
                    </label>
                    <div class="mt-1">
                      <input
                        type="url"
                        id="spotify"
                        name="spotify"
                        class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                        placeholder="https://open.spotify.com/artist/..."
                        data-testid="spotify-input"
                      />
                    </div>
                  </div>

                  <div class="sm:col-span-6">
                    <label for="notes" class="block text-sm font-medium leading-6 text-gray-900">
                      Additional Notes
                    </label>
                    <div class="mt-1">
                      <textarea
                        id="notes"
                        name="notes"
                        rows={4}
                        class="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                        placeholder="Any additional information about this church..."
                        data-testid="notes-textarea"
                      ></textarea>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-end gap-x-6 px-4 py-3 sm:px-8">
            <a href="/" class="text-sm font-semibold leading-6 text-gray-900 hover:text-gray-700">
              Cancel
            </a>
            <button
              type="submit"
              id="submit-button"
              class="rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              data-testid="submit-suggestion-button"
            >
              Submit Suggestion
            </button>
          </div>
        </form>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
        function handleSuggestSubmit(event) {
          const submitButton = document.getElementById('submit-button');
          const originalText = submitButton.textContent;
          
          submitButton.disabled = true;
          submitButton.innerHTML = '<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Submitting...';
        }
      `,
        }}
      />
    </Layout>
  );
});

// Handle church suggestion submission
app.post('/suggest-church', async (c) => {
  const user = await getUser(c);

  // Require login
  if (!user) {
    return c.redirect(`/auth/signin?redirect=${encodeURIComponent('/suggest-church')}`);
  }

  const db = createDbWithContext(c);
  const body = await c.req.parseBody();

  // Extract city and state from address if provided
  let city = '';
  let zip = '';
  const addressStr = String(body.address || '');
  if (addressStr) {
    // Simple regex to extract city and zip from addresses like "123 Main St, Salt Lake City, UT 84101"
    const match = addressStr.match(/,\s*([^,]+),\s*UT\s*(\d{5})?/);
    if (match) {
      city = match[1].trim();
      zip = match[2] || '';
    }
  }

  // Store the suggestion in the dedicated church_suggestions table
  await db.insert(churchSuggestions).values({
    userId: user.id,
    churchName: String(body.churchName || ''),
    denomination: String(body.denomination || ''),
    address: addressStr,
    city: city,
    state: 'UT',
    zip: zip,
    website: String(body.website || ''),
    phone: String(body.phone || ''),
    email: String(body.email || ''),
    serviceTimes: String(body.serviceTimes || ''),
    statementOfFaith: String(body.statementOfFaith || ''),
    facebook: String(body.facebook || ''),
    instagram: String(body.instagram || ''),
    youtube: String(body.youtube || ''),
    spotify: String(body.spotify || ''),
    notes: String(body.notes || ''),
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Redirect back to suggest page with success message
  return c.redirect('/suggest-church?success=true');
});

app.get('/networks/:id', async (c) => {
  const db = createDbWithContext(c);
  const affiliationIdOrPath = c.req.param('id');

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
  const affiliation = await db
    .select()
    .from(affiliations)
    .where(isNumericId ? eq(affiliations.id, Number(affiliationIdOrPath)) : eq(affiliations.path, affiliationIdOrPath))
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
      sql`${churchAffiliations.affiliationId} = ${affiliation.id} AND (${churches.status} = 'Listed' OR ${churches.status} = 'Unlisted')`
    )
    .orderBy(churches.name)
    .all();

  // Separate listed and unlisted churches
  const listedChurches = affiliationChurches.filter((c) => c.status === 'Listed');
  const unlistedChurches = affiliationChurches.filter((c) => c.status === 'Unlisted');

  // Layout props already fetched above

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
              // Check if user is not in an input field
              const tagName = e.target.tagName.toLowerCase();
              const isInputField = tagName === 'input' || tagName === 'textarea' || tagName === 'select' || e.target.contentEditable === 'true';
              
              if (e.key === 'e' && !isInputField && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
                e.preventDefault();
                window.location.href = '/admin/affiliations/${affiliation.id}/edit';
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

  // Apply cache headers if not authenticated
  return shouldSkipCache(c) ? response : applyCacheHeaders(response, 'networks');
});

app.get('/map', async (c) => {
  // Check if Google Maps API key is present
  const { hasGoogleMapsApiKey } = await import('./utils/env-validation');
  if (!hasGoogleMapsApiKey(c.env)) {
    const faviconUrl = await getFaviconUrl(c.env);
    const logoUrl = await getLogoUrl(c.env);
    const navbarPages = await getNavbarPages(c.env);
    const user = await getUser(c);

    return c.html(
      <Layout
        title="Map Unavailable"
        currentPath="/map"
        user={user}
        faviconUrl={faviconUrl}
        logoUrl={logoUrl}
        pages={navbarPages}
      >
        <div class="max-w-4xl mx-auto px-6 py-6 sm:py-12">
          <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-8">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-12 w-12 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div class="ml-4">
                <h1 class="text-2xl font-bold text-yellow-800 mb-2">Map Feature Unavailable</h1>
                <p class="text-yellow-700">
                  The interactive map feature is currently unavailable because the Google Maps API key has not been
                  configured.
                </p>
                <p class="mt-4 text-sm text-yellow-600">
                  <strong>For administrators:</strong> Please set the{' '}
                  <code class="font-mono bg-yellow-100 px-1 py-0.5 rounded">GOOGLE_MAPS_API_KEY</code> environment
                  variable to enable this feature.
                </p>
              </div>
            </div>
          </div>

          <div class="mt-8">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">Alternative Options</h2>
            <div class="space-y-4">
              <a
                href="/"
                class="block p-4 bg-white rounded-lg border border-gray-200 hover:border-primary-500 hover:shadow-md transition-all"
              >
                <h3 class="font-medium text-gray-900">Browse Churches by County</h3>
                <p class="text-gray-600 text-sm mt-1">View churches organized by Utah counties</p>
              </a>
              <a
                href="/networks"
                class="block p-4 bg-white rounded-lg border border-gray-200 hover:border-primary-500 hover:shadow-md transition-all"
              >
                <h3 class="font-medium text-gray-900">Browse by Network</h3>
                <p class="text-gray-600 text-sm mt-1">Find churches by their affiliation or denomination</p>
              </a>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const db = createDbWithContext(c);

  // Check for heretical query param
  const showHereticalOption = c.req.query('heretical') !== undefined;

  // Check for user session
  const user = await getUser(c);

  // Get all churches with coordinates (excluding heretical unless param is present)
  const allChurchesWithCoords = await db
    .select({
      id: churches.id,
      name: churches.name,
      path: churches.path,
      latitude: churches.latitude,
      longitude: churches.longitude,
      gatheringAddress: churches.gatheringAddress,
      countyName: counties.name,
      website: churches.website,
      statementOfFaith: churches.statementOfFaith,
      email: churches.email,
      phone: churches.phone,
      facebook: churches.facebook,
      instagram: churches.instagram,
      youtube: churches.youtube,
      spotify: churches.spotify,
      status: churches.status,
      language: churches.language,
      publicNotes: churches.publicNotes,
    })
    .from(churches)
    .leftJoin(counties, eq(churches.countyId, counties.id))
    .where(
      showHereticalOption
        ? sql`${churches.latitude} IS NOT NULL AND ${churches.longitude} IS NOT NULL`
        : sql`${churches.latitude} IS NOT NULL AND ${churches.longitude} IS NOT NULL AND ${churches.status} != 'Heretical'`
    )
    .all();

  // Get gatherings for all churches (query all and filter in JS to avoid D1's SQL variable limit)
  const churchIds = allChurchesWithCoords.map((c) => c.id);
  const churchIdSet = new Set(churchIds);
  const allGatheringsRaw = await db.select().from(churchGatherings).all();
  const allGatherings = allGatheringsRaw.filter((gathering) => churchIdSet.has(gathering.churchId));

  // Group gatherings by church ID
  const gatheringsByChurchId = allGatherings.reduce(
    (acc, gathering) => {
      if (!acc[gathering.churchId]) {
        acc[gathering.churchId] = [];
      }
      acc[gathering.churchId].push(gathering);
      return acc;
    },
    {} as Record<number, typeof allGatherings>
  );

  // Add gatherings to each church
  const churchesWithGatherings = allChurchesWithCoords.map((church) => ({
    ...church,
    gatherings: gatheringsByChurchId[church.id] || [],
  }));

  // Separate listed, unlisted, and heretical churches
  const listedChurches = churchesWithGatherings.filter((c) => c.status === 'Listed');
  const unlistedChurches = churchesWithGatherings.filter((c) => c.status === 'Unlisted');
  const hereticalChurches = showHereticalOption ? churchesWithGatherings.filter((c) => c.status === 'Heretical') : [];

  // Get all layout props with i18n support
  const layoutProps = await getCommonLayoutProps(c);
  const { t } = layoutProps;

  const response = await c.html(
    <Layout title="Church Map" currentPath="/map" {...layoutProps}>
      <div>
        {/* Map Container */}
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div class="bg-white rounded-lg overflow-hidden">
            <div id="map" class="w-full h-[calc(100vh-280px)] min-h-[400px] max-h-[600px]"></div>
          </div>

          <div class="mt-4 space-y-3">
            {/* Checkbox for unlisted churches */}
            <div class="bg-white border border-gray-200 rounded-lg p-3">
              <label class="flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="showUnlisted"
                  class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <span class="ml-2 text-sm text-gray-700">
                  {t('map.showMoreChurches', { count: unlistedChurches.length })}
                </span>
              </label>
            </div>

            {/* Checkbox for heretical churches - only show if query param is present */}
            {showHereticalOption && (
              <div class="bg-white border border-gray-200 rounded-lg p-3">
                <label class="flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    id="showHeretical"
                    class="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                  />
                  <span class="ml-2 text-sm text-gray-700">
                    Show heretical churches ({hereticalChurches.length} heretical)
                  </span>
                </label>
              </div>
            )}

            {/* Info box */}
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div class="flex">
                <div class="flex-shrink-0">
                  <svg class="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div class="ml-3">
                  <p class="text-sm text-blue-800">
                    <span id="church-count">{listedChurches.length}</span>{' '}
                    {t('churches shown. Click markers for details.')}
                    {t('Blue marker = your location.')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>
        {`
        .map-popup-link {
          color: #2563eb;
          text-decoration: none;
          transition: color 0.15s ease-in-out;
        }
        .map-popup-link:hover {
          color: #1d4ed8;
          text-decoration: underline;
        }
        `}
      </style>

      <script
        dangerouslySetInnerHTML={{
          __html: `
        const listedChurches = ${JSON.stringify(listedChurches)};
        const unlistedChurches = ${JSON.stringify(unlistedChurches)};
        const hereticalChurches = ${JSON.stringify(hereticalChurches)};
        const showHereticalOption = ${showHereticalOption};
        let listedMarkers = [];
        let unlistedMarkers = [];
        let hereticalMarkers = [];
        let map;
        let currentInfoWindow = null;
        let userMarker = null;
        
        async function initMap() {
          const { Map } = await google.maps.importLibrary("maps");
          const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker");
          await google.maps.importLibrary("geometry");
          
          // Initialize map centered on region
          map = new Map(document.getElementById('map'), {
            mapId: "churches",
            gestureHandling: "greedy",
            center: { lat: 39.3210, lng: -111.0937 },
            zoom: 7,
            mapTypeControl: false,
            streetViewControl: false,
          });
          
          // Add markers for listed churches
          listedChurches.forEach((church) => {
            if (!church.latitude || !church.longitude) return;
            
            const pin = new PinElement();
            
            const marker = new AdvancedMarkerElement({
              position: { lat: church.latitude, lng: church.longitude },
              map: map,
              title: church.name,
              content: pin.element,
            });
            
            listedMarkers.push(marker);
            
            // Create info window content
            const infoContent = createInfoContent(church);
            const infoWindow = new google.maps.InfoWindow({
              content: infoContent,
            });
            
            marker.addListener('click', () => {
              if (currentInfoWindow) {
                currentInfoWindow.close();
              }
              infoWindow.open(map, marker);
              currentInfoWindow = infoWindow;
            });
          });
          
          // Create markers for unlisted churches (but don't show them yet)
          unlistedChurches.forEach((church) => {
            if (!church.latitude || !church.longitude) return;
            
            const pin = new PinElement({
              background: '#F3A298',
              borderColor: '#C5221F',
              glyphColor: '#B31512',
            });
            
            const marker = new AdvancedMarkerElement({
              position: { lat: church.latitude, lng: church.longitude },
              map: null, // Not shown initially
              title: church.name,
              content: pin.element,
            });
            
            unlistedMarkers.push(marker);
            
            // Create info window content
            const infoContent = createInfoContent(church);
            const infoWindow = new google.maps.InfoWindow({
              content: infoContent,
            });
            
            marker.addListener('click', () => {
              if (currentInfoWindow) {
                currentInfoWindow.close();
              }
              infoWindow.open(map, marker);
              currentInfoWindow = infoWindow;
            });
          });
          
          // Create markers for heretical churches (if option is enabled)
          if (showHereticalOption) {
            hereticalChurches.forEach((church) => {
              if (!church.latitude || !church.longitude) return;
              
              const pin = new PinElement({
                background: '#DC2626',
                borderColor: '#991B1B',
                glyphColor: '#7F1D1D',
              });
              
              const marker = new AdvancedMarkerElement({
                position: { lat: church.latitude, lng: church.longitude },
                map: null, // Not shown initially
                title: church.name,
                content: pin.element,
              });
              
              hereticalMarkers.push(marker);
              
              // Create info window content
              const infoContent = createInfoContent(church);
              const infoWindow = new google.maps.InfoWindow({
                content: infoContent,
              });
              
              marker.addListener('click', () => {
                if (currentInfoWindow) {
                  currentInfoWindow.close();
                }
                infoWindow.open(map, marker);
                currentInfoWindow = infoWindow;
              });
            });
          }
          
          // Set up checkbox listener
          document.getElementById('showUnlisted').addEventListener('change', function(e) {
            const show = e.target.checked;
            const showHeretical = showHereticalOption && document.getElementById('showHeretical').checked;
            const countSpan = document.getElementById('church-count');
            
            if (show) {
              // Show unlisted markers
              unlistedMarkers.forEach(marker => marker.map = map);
              // Update count
              let totalCount = listedChurches.length + unlistedChurches.length;
              if (showHeretical) totalCount += hereticalChurches.length;
              countSpan.textContent = totalCount;
            } else {
              // Hide unlisted markers
              unlistedMarkers.forEach(marker => marker.map = null);
              // Update count
              let totalCount = listedChurches.length;
              if (showHeretical) totalCount += hereticalChurches.length;
              countSpan.textContent = totalCount;
            }
          });
          
          // Set up heretical checkbox listener (if option is enabled)
          if (showHereticalOption) {
            document.getElementById('showHeretical').addEventListener('change', function(e) {
              const show = e.target.checked;
              const showUnlisted = document.getElementById('showUnlisted').checked;
              const countSpan = document.getElementById('church-count');
              
              if (show) {
                // Show heretical markers
                hereticalMarkers.forEach(marker => marker.map = map);
                // Update count
                let totalCount = listedChurches.length;
                if (showUnlisted) totalCount += unlistedChurches.length;
                totalCount += hereticalChurches.length;
                countSpan.textContent = totalCount;
              } else {
                // Hide heretical markers
                hereticalMarkers.forEach(marker => marker.map = null);
                // Update count
                let totalCount = listedChurches.length;
                if (showUnlisted) totalCount += unlistedChurches.length;
                countSpan.textContent = totalCount;
              }
            });
          }
          
          // Try to get user location
          loadLocation();
        }
        
        function createInfoContent(church) {
          const content = document.createElement('div');
          content.style.maxWidth = '350px';
          content.style.lineHeight = '1.5';
          
          // Format gathering times
          let gatheringTimes = '';
          if (church.gatherings && church.gatherings.length > 0) {
            gatheringTimes = church.gatherings.map(g => g.time).join(', ');
          }
          
          // Build website links
          let websiteLinks = [];
          if (church.website) {
            websiteLinks.push(\`<a href="\${church.website}" target="_blank" class="map-popup-link">Website</a>\`);
          }
          if (church.statementOfFaith) {
            websiteLinks.push(\`<a href="\${church.statementOfFaith}" target="_blank" class="map-popup-link">Statement of Faith</a>\`);
          }
          
          // Build social media links
          let socialLinks = [];
          if (church.facebook) {
            socialLinks.push(\`<a href="\${church.facebook}" target="_blank" class="map-popup-link">Facebook</a>\`);
          }
          if (church.instagram) {
            socialLinks.push(\`<a href="\${church.instagram}" target="_blank" class="map-popup-link">Instagram</a>\`);
          }
          if (church.youtube) {
            socialLinks.push(\`<a href="\${church.youtube}" target="_blank" class="map-popup-link">YouTube</a>\`);
          }
          if (church.spotify) {
            socialLinks.push(\`<a href="\${church.spotify}" target="_blank" class="map-popup-link">Spotify</a>\`);
          }
          
          content.innerHTML = \`
            <h3 style="margin: 0 0 0.5rem 0; font-size: 1.125rem; font-weight: 600;">\${church.name}</h3>
            \${church.gatheringAddress ? \`<div style="margin-bottom: 0.25rem;">\${church.gatheringAddress}</div>\` : ''}
            \${gatheringTimes ? \`<div style="margin-bottom: 0.25rem;">Gathering times: \${gatheringTimes}</div>\` : ''}
            \${websiteLinks.length > 0 ? \`<div style="margin-bottom: 0.25rem;">\${websiteLinks.join(' | ')}</div>\` : ''}
            \${church.email ? \`<div style="margin-bottom: 0.25rem;"><a href="mailto:\${church.email}" class="map-popup-link">\${church.email}</a></div>\` : ''}
            \${church.phone ? \`<div style="margin-bottom: 0.25rem;"><a href="tel:\${church.phone}" class="map-popup-link">\${church.phone}</a></div>\` : ''}
            \${socialLinks.length > 0 ? \`<div style="margin-bottom: 0.5rem;">\${socialLinks.join(' | ')}</div>\` : ''}
            \${church.path ? \`<div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #e5e7eb;"><a href="/churches/\${church.path}" class="map-popup-link" style="font-weight: 500;">View Details →</a></div>\` : ''}
          \`;
          
          return content;
        }
        
        function loadLocation() {
          let loadingDiv = null;
          let loadingTimeout = null;
          
          // Only show loading indicator if location takes more than 500ms
          loadingTimeout = setTimeout(() => {
            loadingDiv = document.createElement('div');
            loadingDiv.id = 'loading-indicator';
            loadingDiv.style.cssText = 'position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); background-color: rgba(0, 0, 0, 0.8); color: white; padding: 0.75rem 1.5rem; border-radius: 0.5rem; font-size: 0.875rem; z-index: 10; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);';
            loadingDiv.innerHTML = '<div style="display: flex; align-items: center; gap: 0.5rem;"><svg style="animation: spin 1s linear infinite; width: 1rem; height: 1rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg><span>Locating...</span></div>';
            
            // Add CSS animation for spinner
            const style = document.createElement('style');
            style.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
            document.head.appendChild(style);
            
            const mapElement = document.getElementById('map');
            if (mapElement) {
              mapElement.appendChild(loadingDiv);
            }
          }, 500);
          
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                clearTimeout(loadingTimeout);
                if (loadingDiv) loadingDiv.remove();
                processPosition(position);
              },
              () => {
                clearTimeout(loadingTimeout);
                if (loadingDiv) loadingDiv.remove();
                console.debug("Error fetching location");
              }
            );
          } else {
            clearTimeout(loadingTimeout);
            if (loadingDiv) loadingDiv.remove();
          }
        }
        
        async function processPosition(position) {
          const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker");
          
          const userLocation = new google.maps.LatLng(
            position.coords.latitude,
            position.coords.longitude
          );
          
          // Check if user is in the region (TODO: make these bounds configurable)
          if (
            position.coords.latitude >= 36.9979667 && // Southern border
            position.coords.latitude <= 42.0013889 && // Northern border
            position.coords.longitude >= -114.0520555 && // Western border
            position.coords.longitude <= -109.0452236 // Eastern border
          ) {
            const userPin = new PinElement({
              background: "#4285F4",
              borderColor: "#4285F4",
              glyphColor: "white",
            });
            
            const userMarker = new AdvancedMarkerElement({
              title: "Your location",
              map,
              position: userLocation,
              content: userPin.element,
            });
            
            recenterMap(userLocation);
          }
        }
        
        function recenterMap(userLocation) {
          const bounds = new google.maps.LatLngBounds();
          bounds.extend(userLocation);
          
          // Get all currently visible markers
          const showUnlisted = document.getElementById('showUnlisted').checked;
          const visibleMarkers = showUnlisted ? [...listedMarkers, ...unlistedMarkers] : listedMarkers;
          
          // Calculate distances to all visible markers
          const distances = visibleMarkers.map((marker) => ({
            marker,
            distance: google.maps.geometry.spherical.computeDistanceBetween(
              userLocation,
              new google.maps.LatLng(marker.position.lat, marker.position.lng)
            ),
          }));
          
          // Sort by distance and include 4 closest churches
          distances.sort((a, b) => a.distance - b.distance);
          distances.slice(0, 4).forEach((item) => {
            bounds.extend(
              new google.maps.LatLng(
                item.marker.position.lat,
                item.marker.position.lng
              )
            );
          });
          
          // Fit bounds with padding
          map.fitBounds(bounds, { padding: 100 });
          
          // Limit zoom level
          google.maps.event.addListenerOnce(map, 'bounds_changed', function() {
            const currentZoom = map.getZoom();
            if (currentZoom > 15) {
              map.setZoom(15);
            } else if (currentZoom < 10) {
              map.setZoom(10);
            }
          });
        }
        
        window.initMap = initMap;
        `,
        }}
      />

      <script
        async
        defer
        src={`https://maps.googleapis.com/maps/api/js?key=${c.env.GOOGLE_MAPS_API_KEY}&callback=initMap&libraries=marker,geometry`}
      ></script>
    </Layout>
  );

  // Apply cache headers if not authenticated
  return shouldSkipCache(c) ? response : applyCacheHeaders(response, 'map');
});

// Debug route
app.get('/debug/login', async (c) => {
  try {
    const faviconUrl = await getFaviconUrl(c.env);
    const logoUrl = await getLogoUrl(c.env);

    return c.json({
      authSystem: 'better-auth',
      BETTER_AUTH_SECRET: c.env.BETTER_AUTH_SECRET ? 'Set' : 'Not set',
      GOOGLE_CLIENT_ID: c.env.GOOGLE_CLIENT_ID ? 'Set' : 'Not set',
      faviconUrl,
      logoUrl,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: errorMessage }, 500);
  }
});

// Login routes
app.get('/login', async (c) => {
  // Redirect to better-auth signin page
  const redirectUrl = c.req.query('redirect_url') || '/admin';
  return c.redirect(`/auth/signin?redirect=${encodeURIComponent(redirectUrl)}`);
});

// Auth callback route - checks user role and redirects appropriately
app.get('/auth/callback', async (c) => {
  const user = await getUser(c);

  if (!user) {
    // Not authenticated, redirect to login
    return c.redirect('/login');
  }

  // Check if user has admin role
  if (user.role === 'admin') {
    return c.redirect('/admin');
  }

  // Non-admin users go to home page
  return c.redirect('/');
});

// POST /login route removed - better-auth handles authentication via OAuth

app.get('/logout', async (c) => {
  // Redirect to better-auth signout endpoint
  return c.redirect('/auth/signout');
});

// Force refresh route - logs out and redirects to login
app.get('/force-refresh', async (c) => {
  return c.redirect('/logout');
});

// Auth Monitoring placeholder
app.get('/admin/monitoring', requireAdminBetter, async (c) => {
  try {
    const db = createDbWithContext(c);
    const layoutProps = await getLayoutProps(c);

    // Get total user count
    const totalUsersResult = await db.select({ count: sql<number>`COUNT(*)` }).from(users).get();
    const totalUsers = totalUsersResult?.count || 0;

    // Get users who logged in within last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const { sessions } = await import('./db/auth-schema');

    const activeUsersResult = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${sessions.userId})` })
      .from(sessions)
      .where(sql`${sessions.createdAt} > ${twentyFourHoursAgo}`)
      .get();
    const activeUsers24h = activeUsersResult?.count || 0;

    // Get recent login sessions
    const recentSessions = await db
      .select({
        id: sessions.id,
        userId: sessions.userId,
        createdAt: sessions.createdAt,
        ipAddress: sessions.ipAddress,
        userEmail: users.email,
        userName: users.name,
        userRole: users.role,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .orderBy(desc(sessions.createdAt))
      .limit(10)
      .all();

    // Convert to login stats format
    const recentLogins = recentSessions.map((session) => ({
      id: session.id,
      user: session.userName || 'Unknown User',
      email: session.userEmail,
      role: session.userRole as 'admin' | 'contributor' | 'user',
      loginTime: new Date(session.createdAt),
      ipAddress: session.ipAddress || undefined,
    }));

    // Get comment statistics
    const { comments } = await import('./db/schema');
    const totalCommentsResult = await db.select({ count: sql<number>`COUNT(*)` }).from(comments).get();
    const totalComments = totalCommentsResult?.count || 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const commentsTodayResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(comments)
      .where(sql`${comments.createdAt} >= ${today}`)
      .get();
    const commentsToday = commentsTodayResult?.count || 0;

    // Create activity feed combining logins and comments
    const loginActivity = recentSessions.slice(0, 5).map((session) => ({
      id: `login-${session.id}`,
      type: 'login' as const,
      user: session.userName || session.userEmail,
      description: `signed in`,
      timestamp: new Date(session.createdAt),
    }));

    // Get recent comments for activity feed
    const recentComments = await db
      .select({
        id: comments.id,
        content: comments.content,
        createdAt: comments.createdAt,
        userName: users.name,
        userEmail: users.email,
        churchName: churches.name,
      })
      .from(comments)
      .innerJoin(users, eq(comments.userId, users.id))
      .leftJoin(churches, eq(comments.churchId, churches.id))
      .orderBy(desc(comments.createdAt))
      .limit(5)
      .all();

    const commentActivity = recentComments.map((comment) => ({
      id: `comment-${comment.id}`,
      type: 'comment' as const,
      user: comment.userName || comment.userEmail,
      description: `commented on ${comment.churchName || 'a church'}`,
      timestamp: new Date(comment.createdAt),
    }));

    // Combine and sort activities
    const recentActivity = [...loginActivity, ...commentActivity]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);

    const loginStats = {
      totalUsers,
      activeUsers24h,
      recentLogins,
    };

    const activityStats = {
      totalComments,
      commentsToday,
      recentActivity,
    };

    return c.html(
      <Layout title="Activity Monitoring" currentPath="/admin/monitoring" {...layoutProps}>
        <div class="min-h-screen bg-gray-50 py-8">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <MonitoringDashboard loginStats={loginStats} activityStats={activityStats} />
          </div>
        </div>
      </Layout>
    );
  } catch (error) {
    console.error('Error loading monitoring dashboard:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to load monitoring dashboard';
    return c.html(
      <Layout title="Error">
        <ErrorPage error={errorMessage} statusCode={500} />
      </Layout>,
      500
    );
  }
});

// Admin routes
app.get('/admin', requireAdminBetter, async (c) => {
  const user = c.get('betterUser');
  const db = createDbWithContext(c);

  // Get logo URL
  const logoUrl = await getLogoUrl(c.env);

  // Get navbar pages
  const navbarPages = await getNavbarPages(c.env);

  // Get statistics using COUNT for efficiency
  const churchCount = await db.select({ count: sql<number>`COUNT(*)` }).from(churches).get();
  const countyCount = await db.select({ count: sql<number>`COUNT(*)` }).from(counties).get();
  const affiliationCount = await db.select({ count: sql<number>`COUNT(*)` }).from(affiliations).get();
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
    .where(sql`${churches.status} != 'Closed' OR ${churches.status} IS NULL`)
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
    <Layout title="Admin Dashboard" user={user} currentPath="/admin" logoUrl={logoUrl} pages={navbarPages}>
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
                              ? new Date(church.lastUpdated).toLocaleDateString('en-US', {
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
                  <p class="mt-1 text-sm text-gray-500">Manage static content pages</p>
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
                  <span class="rounded-lg inline-flex p-2 bg-purple-50 text-purple-700 group-hover:bg-purple-100">
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
                  <p class="mt-1 text-sm text-gray-500">Manage user accounts and permissions</p>
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
                  <p class="mt-1 text-sm text-gray-500">Configure site settings and options</p>
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
                  <span class="rounded-lg inline-flex p-2 bg-indigo-50 text-indigo-700 group-hover:bg-indigo-100">
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                  </span>
                </div>
                <div class="mt-3">
                  <h3 class="text-base font-medium">
                    <span class="absolute inset-0" aria-hidden="true"></span>
                    Submissions ({submissionCount?.count || 0})
                  </h3>
                  <p class="mt-1 text-sm text-gray-500">Review church suggestions from users</p>
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
                  <span class="rounded-lg inline-flex p-2 bg-amber-50 text-amber-700 group-hover:bg-amber-100">
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
                  <p class="mt-1 text-sm text-gray-500">View and manage user comments and feedback</p>
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
                  <span class="rounded-lg inline-flex p-2 bg-blue-50 text-blue-700 group-hover:bg-blue-100">
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </span>
                </div>
                <div class="mt-3">
                  <h3 class="text-base font-medium">
                    <span class="absolute inset-0" aria-hidden="true"></span>
                    Activity
                  </h3>
                  <p class="mt-1 text-sm text-gray-500">View system activity and change logs</p>
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

          {/* Feedback Section */}
          {recentFeedback && recentFeedback.length > 0 && (
            <div class="mb-8" data-testid="feedback-section">
              <div class="flex items-start justify-between mb-4">
                <div>
                  <h2 class="text-lg font-semibold text-gray-900">Feedback</h2>
                  <p class="text-sm text-gray-600 mt-1">Latest comments and feedback from users</p>
                </div>
                <a href="/admin/feedback" class="text-sm font-medium text-primary-600 hover:text-primary-500">
                  View all feedback →
                </a>
              </div>

              <div class="space-y-3" data-testid="feedback-list">
                {recentFeedback.map((comment, _index) => (
                  <div key={comment.id} class="group">
                    <div class="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-sm transition-shadow">
                      <div class="flex items-start space-x-3">
                        {/* Avatar */}
                        <div class="flex-shrink-0">
                          {comment.userImage ? (
                            <img
                              src={comment.userImage}
                              alt={comment.userName || comment.userEmail}
                              class="w-9 h-9 rounded-full object-cover border border-gray-200"
                              onerror={`this.src='${getGravatarUrl(comment.userEmail, 36)}'; this.onerror=function(){this.style.display='none'; this.nextElementSibling.style.display='flex';}`}
                            />
                          ) : (
                            <img
                              src={getGravatarUrl(comment.userEmail, 36)}
                              alt={comment.userName || comment.userEmail}
                              class="w-9 h-9 rounded-full object-cover border border-gray-200"
                              onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'"
                            />
                          )}
                          <div
                            class="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 hidden items-center justify-center"
                            style="display: none;"
                          >
                            <span class="text-sm font-semibold text-white">
                              {comment.userName
                                ? comment.userName.charAt(0).toUpperCase()
                                : comment.userEmail.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>

                        {/* Content */}
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center justify-between mb-2">
                            <div class="flex items-center space-x-2">
                              <p class="text-sm font-medium text-gray-900">
                                {comment.userName || comment.userEmail?.split('@')[0] || 'Anonymous'}
                              </p>
                              <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                                Member
                              </span>
                            </div>
                            <div class="flex items-center space-x-3">
                              <time class="text-xs text-gray-500">
                                {new Date(comment.createdAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year:
                                    new Date(comment.createdAt).getFullYear() !== new Date().getFullYear()
                                      ? 'numeric'
                                      : undefined,
                                })}
                              </time>
                              <div class="border-l border-gray-300 pl-3">
                                <form method="post" action={`/api/comments/${comment.id}/delete`} class="inline">
                                  <button
                                    type="submit"
                                    onclick="return confirm('Are you sure you want to delete this comment?')"
                                    class="text-xs text-red-600 hover:text-red-800 focus:outline-none transition-colors font-medium"
                                    title="Delete comment"
                                  >
                                    Delete
                                  </button>
                                </form>
                              </div>
                            </div>
                          </div>
                          {comment.churchName && (
                            <p class="text-sm text-gray-600 mb-2">
                              On:{' '}
                              <a
                                href={`/churches/${comment.churchPath}`}
                                class="text-primary-600 hover:text-primary-500 font-medium"
                              >
                                {comment.churchName}
                              </a>
                            </p>
                          )}
                          <div class="prose prose-sm max-w-none">
                            <p class="text-gray-700 leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity Section */}
          {recentActivity && recentActivity.length > 0 && (
            <div class="mb-8" data-testid="recent-activity-section">
              <div class="flex items-start justify-between mb-4">
                <div>
                  <h2 class="text-lg font-semibold text-gray-900">Activity</h2>
                  <p class="text-sm text-gray-600 mt-1">Latest system activity and changes</p>
                </div>
                <a href="/admin/activity" class="text-sm font-medium text-primary-600 hover:text-primary-500">
                  View all activity →
                </a>
              </div>

              <div class="space-y-3" data-testid="activity-list">
                {recentActivity.map((activity, _index) => (
                  <div key={activity.id} class="group">
                    <div class="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-sm transition-shadow">
                      <div class="flex items-start space-x-3">
                        {/* User Avatar */}
                        <div class="flex-shrink-0">
                          {activity.userEmail ? (
                            <img
                              class="w-9 h-9 rounded-full"
                              src={activity.userImage || getGravatarUrl(activity.userEmail)}
                              alt={activity.userName || 'User'}
                            />
                          ) : (
                            <div class="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="2"
                                  d="M13 10V3L4 14h7v7l9-11h-7z"
                                />
                              </svg>
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center justify-between mb-2">
                            <div class="flex items-center space-x-2">
                              <p class="text-sm font-medium text-gray-900">{activity.userName || 'System'}</p>
                              <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                                <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M13 10V3L4 14h7v7l9-11h-7z"
                                  />
                                </svg>
                                Change
                              </span>
                            </div>
                            <div class="flex items-center space-x-3">
                              <time
                                class="text-xs text-gray-500 cursor-help"
                                title={new Date(activity.createdAt).toLocaleString('en-US', {
                                  weekday: 'long',
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}
                              >
                                {new Date(activity.createdAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year:
                                    new Date(activity.createdAt).getFullYear() !== new Date().getFullYear()
                                      ? 'numeric'
                                      : undefined,
                                })}
                              </time>
                              <div class="border-l border-gray-300 pl-3">
                                <form method="post" action={`/api/comments/${activity.id}/delete`} class="inline">
                                  <button
                                    type="submit"
                                    onclick="return handleActivityDelete(this, 'Are you sure you want to delete this activity log?')"
                                    class="text-xs text-red-600 hover:text-red-800 focus:outline-none transition-colors font-medium"
                                    title="Delete activity log"
                                  >
                                    Delete
                                  </button>
                                </form>
                              </div>
                            </div>
                          </div>
                          {activity.churchName && (
                            <p class="text-sm text-gray-600 mb-2">
                              On:{' '}
                              <a
                                href={`/churches/${activity.churchPath}`}
                                class="text-primary-600 hover:text-primary-500 font-medium"
                              >
                                {activity.churchName}
                              </a>
                            </p>
                          )}
                          <div class="prose prose-sm max-w-none">
                            <div
                              class="text-gray-700 text-sm"
                              dangerouslySetInnerHTML={{
                                __html: activity.content
                                  .replace(/```yaml\n([\s\S]*?)```/g, (_match, p1) => {
                                    return `<pre class="bg-gray-50 p-3 rounded-lg overflow-x-auto mt-1 text-xs font-mono">${p1.trim()}</pre>`;
                                  })
                                  .replace(/\n/g, '<br>'),
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notifications Section */}
          <div class="mb-8">
            <div class="bg-white rounded-lg shadow-sm ring-1 ring-gray-900/5 p-6">
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <h3 class="text-lg font-semibold text-gray-900 mb-2">Web Notifications</h3>
                  <p class="text-sm text-gray-600 mb-4">
                    Get notified when new feedback is submitted or churches are suggested for review.
                  </p>
                  <div id="notification-status" class="flex items-center gap-3">
                    <button
                      id="enable-notifications"
                      class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                      onclick="setupNotifications()"
                    >
                      <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M15 17h5l-5 5v-5zM21 12v-1a9 9 0 10-18 0v1M5.5 17h13a2.5 2.5 0 000-5h-13a2.5 2.5 0 000 5z"
                        />
                      </svg>
                      Enable Notifications
                    </button>
                    <span id="notification-info" class="text-sm text-gray-500">
                      Browser notifications are not enabled
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
            function handleActivityDelete(button, message) {
              if (!confirm(message)) {
                return false;
              }
              
              // Find the activity item container
              const activityItem = button.closest('.group');
              if (activityItem) {
                // Add visual feedback
                activityItem.style.opacity = '0.5';
                activityItem.style.pointerEvents = 'none';
                button.innerHTML = 'Deleting...';
                button.disabled = true;
                
                // Add a subtle red border to indicate deletion
                const card = activityItem.querySelector('.bg-white');
                if (card) {
                  card.classList.add('border-red-200', 'bg-red-50');
                }
              }
              
              return true;
            }
          `,
        }}
      />

      <script
        dangerouslySetInnerHTML={{
          __html: `
            // Web Notifications Setup
            async function setupNotifications() {
              const button = document.getElementById('enable-notifications');
              const info = document.getElementById('notification-info');
              
              if (!('serviceWorker' in navigator) || !('Notification' in window)) {
                info.textContent = 'Notifications not supported in this browser';
                button.disabled = true;
                return;
              }
              
              try {
                // Request notification permission
                const permission = await Notification.requestPermission();
                
                if (permission === 'granted') {
                  // Register service worker
                  const registration = await navigator.serviceWorker.register('/sw.js');
                  
                  // Wait for service worker to be ready
                  await navigator.serviceWorker.ready;
                  
                  // Send initialization message to service worker
                  if (registration.active) {
                    registration.active.postMessage({ type: 'INIT_ADMIN_CHECKS' });
                  }
                  
                  button.textContent = 'Notifications Enabled';
                  button.disabled = true;
                  button.classList.remove('bg-primary-600', 'hover:bg-primary-700');
                  button.classList.add('bg-green-600');
                  info.textContent = 'You will be notified of new feedback and submissions';
                  
                  // Subscribe for push notifications (optional enhancement)
                  try {
                    const subscription = await registration.pushManager.subscribe({
                      userVisibleOnly: true,
                      applicationServerKey: null // Would need VAPID keys for push notifications
                    });
                    
                    // Send subscription to server
                    await fetch('/api/admin/notifications/subscribe', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(subscription)
                    });
                  } catch (pushError) {
                    console.log('Push notifications not available, using service worker polling');
                  }
                  
                } else if (permission === 'denied') {
                  info.textContent = 'Notifications blocked. Enable in browser settings.';
                  button.disabled = true;
                } else {
                  info.textContent = 'Notification permission required';
                }
              } catch (error) {
                console.error('Error setting up notifications:', error);
                info.textContent = 'Error setting up notifications';
              }
            }
            
            // Check current notification status on page load
            document.addEventListener('DOMContentLoaded', async function() {
              const button = document.getElementById('enable-notifications');
              const info = document.getElementById('notification-info');
              
              if (!('serviceWorker' in navigator) || !('Notification' in window)) {
                info.textContent = 'Notifications not supported';
                button.disabled = true;
                return;
              }
              
              if (Notification.permission === 'granted') {
                const registration = await navigator.serviceWorker.getRegistration('/sw.js');
                if (registration) {
                  button.textContent = 'Notifications Enabled';
                  button.disabled = true;
                  button.classList.remove('bg-primary-600', 'hover:bg-primary-700');
                  button.classList.add('bg-green-600');
                  info.textContent = 'Notifications are active';
                }
              } else if (Notification.permission === 'denied') {
                info.textContent = 'Notifications blocked. Enable in browser settings.';
                button.disabled = true;
              }
            });
          `,
        }}
      />
    </Layout>
  );
});

// Church suggestions management
app.get('/admin/submissions', requireAdminBetter, async (c) => {
  const db = createDbWithContext(c);
  const user = c.get('betterUser');
  const logoUrl = await getLogoUrl(c.env);
  const navbarPages = await getNavbarPages(c.env);

  // Get all church suggestions with user info
  const suggestionsRaw = await db
    .select()
    .from(churchSuggestions)
    .leftJoin(users, eq(churchSuggestions.userId, users.id))
    .orderBy(desc(churchSuggestions.createdAt))
    .all();

  // Transform the data to a cleaner format
  const suggestions = suggestionsRaw.map((row) => ({
    id: row.church_suggestions.id,
    churchName: row.church_suggestions.churchName,
    denomination: row.church_suggestions.denomination,
    address: row.church_suggestions.address,
    website: row.church_suggestions.website,
    phone: row.church_suggestions.phone,
    email: row.church_suggestions.email,
    serviceTimes: row.church_suggestions.serviceTimes,
    statementOfFaith: row.church_suggestions.statementOfFaith,
    facebook: row.church_suggestions.facebook,
    instagram: row.church_suggestions.instagram,
    youtube: row.church_suggestions.youtube,
    spotify: row.church_suggestions.spotify,
    createdAt: row.church_suggestions.createdAt,
    submittedByEmail: row.users?.email || null,
    submittedByName: row.users?.name || null,
  }));

  return c.html(
    <Layout
      title="Church Submissions - Admin"
      user={user}
      logoUrl={logoUrl}
      pages={navbarPages}
      currentPath="/admin/submissions"
    >
      <div class="min-h-full">
        <div class="bg-white shadow">
          <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div class="py-6">
              <nav class="flex" aria-label="Breadcrumb">
                <ol class="flex items-center space-x-4">
                  <li>
                    <a href="/admin" class="text-gray-500 hover:text-gray-700">
                      Admin
                    </a>
                  </li>
                  <li>
                    <span class="mx-2 text-gray-400">/</span>
                  </li>
                  <li>
                    <span class="text-gray-900 font-medium">Submissions</span>
                  </li>
                </ol>
              </nav>
            </div>
          </div>
        </div>

        <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div class="mb-8">
            <h1 class="text-2xl font-bold text-gray-900">Church Submissions</h1>
            <p class="mt-2 text-sm text-gray-700">Review church suggestions submitted by users</p>
          </div>

          {suggestions.length === 0 ? (
            <div class="text-center py-12">
              <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <h3 class="mt-2 text-sm font-semibold text-gray-900">No submissions</h3>
              <p class="mt-1 text-sm text-gray-500">No church suggestions have been submitted yet.</p>
            </div>
          ) : (
            <div class="space-y-4">
              {suggestions.map((suggestion, _index) => (
                <div class="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-lg overflow-hidden">
                  {/* Header */}
                  <div class="px-6 py-4 bg-gray-50 border-b border-gray-200">
                    <div class="flex items-center justify-between">
                      <div class="flex-1">
                        <h3 class="text-lg font-semibold text-gray-900">{suggestion.churchName}</h3>
                        {suggestion.denomination && (
                          <p class="text-sm text-gray-600 mt-0.5">{suggestion.denomination}</p>
                        )}
                      </div>
                      <div class="flex items-center gap-3 ml-4">
                        <a
                          href={`/admin/churches/new?from_suggestion=${suggestion.id}`}
                          class="inline-flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors border border-transparent min-h-[36px]"
                        >
                          <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                          </svg>
                          Create Church
                        </a>
                        <form method="post" action={`/admin/submissions/${suggestion.id}/delete`} class="inline m-0">
                          <button
                            type="submit"
                            onclick="return confirm('Are you sure you want to delete this submission?')"
                            class="inline-flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors border border-gray-300 min-h-[36px]"
                          >
                            <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                            Delete
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div class="px-6 py-4">
                    <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {/* Contact Information */}
                      {(suggestion.address || suggestion.phone || suggestion.email || suggestion.website) && (
                        <>
                          {suggestion.address && (
                            <div>
                              <dt class="text-xs font-medium text-gray-500 uppercase tracking-wider">Address</dt>
                              <dd class="mt-1 text-sm text-gray-900">{suggestion.address}</dd>
                            </div>
                          )}
                          {suggestion.phone && (
                            <div>
                              <dt class="text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</dt>
                              <dd class="mt-1 text-sm text-gray-900">{suggestion.phone}</dd>
                            </div>
                          )}
                          {suggestion.email && (
                            <div>
                              <dt class="text-xs font-medium text-gray-500 uppercase tracking-wider">Email</dt>
                              <dd class="mt-1 text-sm">
                                <a href={`mailto:${suggestion.email}`} class="text-primary-600 hover:text-primary-500">
                                  {suggestion.email}
                                </a>
                              </dd>
                            </div>
                          )}
                          {suggestion.website && (
                            <div>
                              <dt class="text-xs font-medium text-gray-500 uppercase tracking-wider">Website</dt>
                              <dd class="mt-1 text-sm">
                                <a
                                  href={suggestion.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  class="text-primary-600 hover:text-primary-500 break-all"
                                >
                                  {suggestion.website}
                                </a>
                              </dd>
                            </div>
                          )}
                        </>
                      )}

                      {/* Service Times */}
                      {suggestion.serviceTimes && (
                        <div class="sm:col-span-2">
                          <dt class="text-xs font-medium text-gray-500 uppercase tracking-wider">Service Times</dt>
                          <dd class="mt-1 text-sm text-gray-900 whitespace-pre-line">{suggestion.serviceTimes}</dd>
                        </div>
                      )}

                      {/* Statement of Faith */}
                      {suggestion.statementOfFaith && (
                        <div>
                          <dt class="text-xs font-medium text-gray-500 uppercase tracking-wider">Statement of Faith</dt>
                          <dd class="mt-1 text-sm">
                            <a
                              href={suggestion.statementOfFaith}
                              target="_blank"
                              rel="noopener noreferrer"
                              class="text-primary-600 hover:text-primary-500 inline-flex items-center"
                            >
                              View Statement
                              <svg class="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="2"
                                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                />
                              </svg>
                            </a>
                          </dd>
                        </div>
                      )}
                    </dl>

                    {/* Social Media */}
                    {(suggestion.facebook || suggestion.instagram || suggestion.youtube || suggestion.spotify) && (
                      <div class="mt-4 pt-4 border-t border-gray-100">
                        <dt class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Social Media</dt>
                        <dd class="flex items-center gap-3">
                          {suggestion.facebook && (
                            <a
                              href={suggestion.facebook}
                              target="_blank"
                              rel="noopener noreferrer"
                              class="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              <span class="sr-only">Facebook</span>
                              <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                              </svg>
                            </a>
                          )}
                          {suggestion.instagram && (
                            <a
                              href={suggestion.instagram}
                              target="_blank"
                              rel="noopener noreferrer"
                              class="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              <span class="sr-only">Instagram</span>
                              <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zM5.838 12a6.162 6.162 0 1112.324 0 6.162 6.162 0 01-12.324 0zM12 16a4 4 0 110-8 4 4 0 010 8zm4.965-10.405a1.44 1.44 0 112.881.001 1.44 1.44 0 01-2.881-.001z" />
                              </svg>
                            </a>
                          )}
                          {suggestion.youtube && (
                            <a
                              href={suggestion.youtube}
                              target="_blank"
                              rel="noopener noreferrer"
                              class="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              <span class="sr-only">YouTube</span>
                              <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                              </svg>
                            </a>
                          )}
                          {suggestion.spotify && (
                            <a
                              href={suggestion.spotify}
                              target="_blank"
                              rel="noopener noreferrer"
                              class="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              <span class="sr-only">Spotify</span>
                              <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                              </svg>
                            </a>
                          )}
                        </dd>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div class="px-6 py-3 bg-gray-50 border-t border-gray-200">
                    <div class="flex items-center justify-between text-xs text-gray-500">
                      <span>Submitted by {suggestion.submittedByName || suggestion.submittedByEmail || 'Unknown'}</span>
                      <time>
                        {new Date(suggestion.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
});

// County management routes
app.get('/admin/counties', requireAdminBetter, async (c) => {
  const db = createDbWithContext(c);
  const user = c.get('betterUser');
  const logoUrl = await getLogoUrl(c.env);
  const allCounties = await db.select().from(counties).orderBy(counties.name).all();

  return c.html(
    <Layout title="Manage Counties - Utah Churches" user={user} logoUrl={logoUrl}>
      <div class="bg-gray-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div class="md:flex md:items-center md:justify-between mb-8">
            <div class="flex-1 min-w-0">
              <nav class="flex" aria-label="Breadcrumb">
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
                    <span class="text-gray-900">Counties</span>
                  </li>
                </ol>
              </nav>
              <h1 class="mt-2 text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">Manage Counties</h1>
            </div>
            <div class="mt-4 flex md:mt-0 md:ml-4">
              <a
                href="/admin/counties/new"
                class="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                data-testid="btn-add-county"
              >
                <svg class="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                Add New County
              </a>
            </div>
          </div>

          {/* Table */}
          <div class="bg-white shadow overflow-hidden sm:rounded-md">
            <table class="min-w-full divide-y divide-gray-200" data-testid="counties-table">
              <thead class="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Name
                  </th>
                  <th
                    scope="col"
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Path
                  </th>
                  <th
                    scope="col"
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Description
                  </th>
                  <th
                    scope="col"
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Population
                  </th>
                  <th scope="col" class="relative px-6 py-3">
                    <span class="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                {allCounties.map((county) => (
                  <tr class="hover:bg-gray-50" data-testid={`county-row-${county.id}`}>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="text-sm font-medium text-gray-900">{county.name}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {county.path || <span class="text-gray-400">-</span>}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500">
                      {county.description || <span class="text-gray-400">-</span>}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {county.population ? county.population.toLocaleString() : <span class="text-gray-400">-</span>}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <a
                        href={`/admin/counties/${county.id}/edit`}
                        class="text-primary-600 hover:text-primary-900 mr-4"
                        data-testid={`btn-edit-county-${county.id}`}
                      >
                        Edit
                      </a>
                      <form method="post" action={`/admin/counties/${county.id}/delete`} class="inline">
                        <button
                          type="submit"
                          class="text-red-600 hover:text-red-900"
                          onclick="return confirm('Are you sure you want to delete this county?')"
                          data-testid={`btn-delete-county-${county.id}`}
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
    </Layout>
  );
});

// Create comment on church
app.post('/churches/:path/comments', async (c) => {
  const user = await getUser(c);

  if (!user) {
    return c.redirect('/auth/signin');
  }

  const db = createDbWithContext(c);
  const path = c.req.param('path');

  // Get church by path
  const church = await db.select().from(churches).where(eq(churches.path, path)).get();

  if (!church) {
    return c.json({ error: 'Church not found' }, 404);
  }

  const body = await c.req.parseBody();
  const content = String(body.content || '').trim();

  if (!content) {
    return c.redirect(`/churches/${path}?error=empty`);
  }

  // Create comment
  await db.insert(comments).values({
    userId: user.id,
    churchId: church.id,
    content,
    isPublic: false, // Comments are private by default
    status: 'approved', // Auto-approve comments
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return c.redirect(`/churches/${path}#comments`);
});

// Delete comment (admin only)
app.post('/churches/:path/comments/:commentId/delete', async (c) => {
  const user = await getUser(c);

  if (!user || user.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  const db = createDbWithContext(c);
  const path = c.req.param('path');
  const commentId = parseInt(c.req.param('commentId'));

  // Get church by path to verify it exists
  const church = await db.select().from(churches).where(eq(churches.path, path)).get();

  if (!church) {
    return c.json({ error: 'Church not found' }, 404);
  }

  // Delete the comment
  const result = await db.delete(comments).where(eq(comments.id, commentId)).returning();

  if (result.length === 0) {
    return c.json({ error: 'Comment not found' }, 404);
  }

  return c.redirect(`/churches/${path}#comments`);
});

// Delete church submission
app.post('/admin/submissions/:id/delete', requireAdminBetter, async (c) => {
  const db = createDbWithContext(c);
  const suggestionId = parseInt(c.req.param('id'));

  // Delete the submission
  const result = await db.delete(churchSuggestions).where(eq(churchSuggestions.id, suggestionId)).returning();

  if (result.length === 0) {
    return c.json({ error: 'Submission not found' }, 404);
  }

  return c.redirect('/admin/submissions');
});

// Create new county
app.get('/admin/counties/new', requireAdminBetter, async (c) => {
  const user = c.get('betterUser');
  const logoUrl = await getLogoUrl(c.env);
  return c.html(
    <Layout title="Create County - Utah Churches" user={user} logoUrl={logoUrl}>
      <div style="max-width: 600px; margin: 0 auto;">
        <CountyForm action="/admin/counties" isNew={true} />
      </div>
    </Layout>
  );
});

app.post('/admin/counties', requireAdminBetter, async (c) => {
  const db = createDbWithContext(c);
  const body = await c.req.parseBody();
  const user = c.get('betterUser');
  const parsedBody = parseFormBody(body);

  // Validate input
  const validation = validateFormData(countySchema, parsedBody);

  if (!validation.success) {
    return c.html(
      <Layout title="Create County - Utah Churches" user={user}>
        <div style="max-width: 600px; margin: 0 auto;">
          <div class="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <h3 class="text-lg font-medium text-red-800 mb-2">Validation Error</h3>
            <p class="text-red-700">{validation.message}</p>
          </div>
          <CountyForm
            action="/admin/counties"
            isNew={true}
            county={
              parsedBody as {
                id?: number;
                name?: string;
                path?: string | null;
                population?: number | null;
                description?: string | null;
              }
            }
          />
        </div>
      </Layout>
    );
  }

  const { name, path, description, population } = validation.data;

  // Check if name already exists
  const existing = await db.select().from(counties).where(eq(counties.name, name)).get();
  if (existing) {
    return c.html(
      <Layout title="Create County - Utah Churches" user={user}>
        <div style="max-width: 600px; margin: 0 auto;">
          <CountyForm
            action="/admin/counties"
            isNew={true}
            error="A county with this name already exists"
            county={{ name, path, description, population }}
          />
        </div>
      </Layout>
    );
  }

  const result = await db
    .insert(counties)
    .values({
      name,
      path: path || null,
      description: description || null,
      population,
    })
    .returning();

  // Invalidate cache for county changes
  if (result[0]) {
    await cacheInvalidation.county(c, result[0].id.toString());
  }

  return c.redirect('/admin/counties');
});

// Edit county
app.get('/admin/counties/:id/edit', requireAdminBetter, async (c) => {
  const db = createDbWithContext(c);
  const id = c.req.param('id');
  const user = c.get('betterUser');

  // Get logo URL
  const logoUrl = await getLogoUrl(c.env);

  const county = await db
    .select()
    .from(counties)
    .where(eq(counties.id, Number(id)))
    .get();

  if (!county) {
    return c.redirect('/admin/counties');
  }

  return c.html(
    <Layout title="Edit County - Utah Churches" user={user} logoUrl={logoUrl}>
      <div style="max-width: 600px; margin: 0 auto;">
        <CountyForm action={`/admin/counties/${id}`} county={county} />
      </div>
    </Layout>
  );
});

app.post('/admin/counties/:id', requireAdminBetter, async (c) => {
  const db = createDbWithContext(c);
  const id = c.req.param('id');
  const body = await c.req.parseBody();

  const name = body.name as string;
  const path = body.path as string;
  const description = body.description as string;
  const population = body.population ? parseInt(body.population as string) : null;

  await db
    .update(counties)
    .set({
      name,
      path: path || null,
      description: description || null,
      population,
    })
    .where(eq(counties.id, Number(id)));

  // Invalidate cache for county changes
  await cacheInvalidation.county(c, id);

  return c.redirect('/admin/counties');
});

// Delete county
app.post('/admin/counties/:id/delete', requireAdminBetter, async (c) => {
  const db = createDbWithContext(c);
  const id = c.req.param('id');

  // TODO: Check if any churches are using this county before deleting
  await db.delete(counties).where(eq(counties.id, Number(id)));

  // Invalidate cache for county changes
  await cacheInvalidation.county(c, id);

  return c.redirect('/admin/counties');
});

// Pages routes
app.get('/admin/pages', requireAdminBetter, async (c) => {
  const db = createDbWithContext(c);
  const user = c.get('betterUser');
  const logoUrl = await getLogoUrl(c.env);
  const allPages = await db.select().from(pages).orderBy(pages.title).all();

  return c.html(
    <Layout title="Manage Pages - Utah Churches" user={user} logoUrl={logoUrl}>
      <div class="bg-gray-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div class="md:flex md:items-center md:justify-between mb-8">
            <div class="flex-1 min-w-0">
              <nav class="flex" aria-label="Breadcrumb">
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
                    <span class="text-gray-900">Pages</span>
                  </li>
                </ol>
              </nav>
              <h1 class="mt-2 text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">Manage Pages</h1>
            </div>
            <div class="mt-4 flex md:mt-0 md:ml-4">
              <a
                href="/admin/pages/new"
                class="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                data-testid="btn-new-page"
              >
                <svg class="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                New Page
              </a>
            </div>
          </div>

          {/* Pages list */}
          <div class="bg-white shadow rounded-lg overflow-hidden">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Path</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Navbar Order
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th class="relative px-6 py-3">
                    <span class="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                {allPages.map((page) => (
                  <tr key={page.id} data-testid={`page-row-${page.id}`}>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="text-sm font-medium text-gray-900">{page.title}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="text-sm text-gray-900">/{page.path}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="text-sm text-gray-900">{page.navbarOrder || '-'}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(page.createdAt).toLocaleDateString()}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <a
                        href={`/${page.path}`}
                        target="_blank"
                        class="text-primary-600 hover:text-primary-900 mr-4"
                        data-testid={`view-page-${page.id}`}
                      >
                        View
                      </a>
                      <a
                        href={`/admin/pages/${page.id}/edit`}
                        class="text-primary-600 hover:text-primary-900 mr-4"
                        data-testid={`edit-page-${page.id}`}
                      >
                        Edit
                      </a>
                      <form method="post" action={`/admin/pages/${page.id}/delete`} class="inline">
                        <button
                          type="submit"
                          class="text-red-600 hover:text-red-900"
                          data-testid={`delete-page-${page.id}`}
                          onclick="return confirm('Are you sure you want to delete this page?')"
                        >
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {allPages.length === 0 && (
              <div class="text-center py-12">
                <svg
                  class="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <h3 class="mt-2 text-sm font-medium text-gray-900">No pages</h3>
                <p class="mt-1 text-sm text-gray-500">Get started by creating a new page.</p>
                <div class="mt-6">
                  <a
                    href="/admin/pages/new"
                    class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    <svg class="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                    New Page
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
});

app.get('/admin/pages/new', requireAdminBetter, async (c) => {
  const user = c.get('betterUser');
  const logoUrl = await getLogoUrl(c.env);

  return c.html(
    <Layout title="New Page - Utah Churches" user={user} logoUrl={logoUrl}>
      <div class="bg-gray-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                <a href="/admin/pages" class="text-gray-500 hover:text-gray-700">
                  Pages
                </a>
              </li>
              <li>
                <span class="mx-2 text-gray-400">/</span>
              </li>
              <li>
                <span class="text-gray-900">New</span>
              </li>
            </ol>
          </nav>

          <PageForm action="/admin/pages" isNew={true} />
        </div>
      </div>
    </Layout>
  );
});

app.post('/admin/pages', requireAdminBetter, async (c) => {
  const db = createDbWithContext(c);
  const body = await c.req.parseBody();

  const title = (body.title as string)?.trim();
  const path = (body.path as string)?.trim();
  const content = body.content as string;
  const navbarOrder = body.navbarOrder ? parseInt(body.navbarOrder as string) : null;

  const result = pageSchema.safeParse({ title, path, content });
  if (!result.success) {
    return c.text(result.error.errors[0].message, 400);
  }

  const pageData = {
    title,
    path,
    content: content || null,
    navbarOrder,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.insert(pages).values(pageData);

  return c.redirect('/admin/pages');
});

app.get('/admin/pages/:id/edit', requireAdminBetter, async (c) => {
  const db = createDbWithContext(c);
  const user = c.get('betterUser');
  const logoUrl = await getLogoUrl(c.env);
  const id = c.req.param('id');

  const page = await db
    .select()
    .from(pages)
    .where(eq(pages.id, Number(id)))
    .get();

  if (!page) {
    return c.redirect('/admin/pages');
  }

  return c.html(
    <Layout title={`Edit ${page.title} - Utah Churches`} user={user} logoUrl={logoUrl}>
      <div class="bg-gray-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                <a href="/admin/pages" class="text-gray-500 hover:text-gray-700">
                  Pages
                </a>
              </li>
              <li>
                <span class="mx-2 text-gray-400">/</span>
              </li>
              <li>
                <span class="text-gray-900">Edit</span>
              </li>
            </ol>
          </nav>

          <PageForm action={`/admin/pages/${page.id}`} page={page} />
        </div>
      </div>
    </Layout>
  );
});

app.post('/admin/pages/:id', requireAdminBetter, async (c) => {
  const db = createDbWithContext(c);
  const id = c.req.param('id');
  const body = await c.req.parseBody();

  const title = (body.title as string)?.trim();
  const path = (body.path as string)?.trim();
  const content = body.content as string;
  const navbarOrder = body.navbarOrder ? parseInt(body.navbarOrder as string) : null;

  const result = pageSchema.safeParse({ title, path, content });
  if (!result.success) {
    return c.text(result.error.errors[0].message, 400);
  }

  // Get current page to check for existing image
  const currentPage = await db
    .select()
    .from(pages)
    .where(eq(pages.id, Number(id)))
    .get();

  const pageData = {
    title,
    path,
    content: content || null,
    navbarOrder,
    updatedAt: new Date(),
  };

  await db
    .update(pages)
    .set(pageData)
    .where(eq(pages.id, Number(id)));

  return c.redirect('/admin/pages');
});

app.post('/admin/pages/:id/delete', requireAdminBetter, async (c) => {
  const db = createDbWithContext(c);
  const id = c.req.param('id');

  // Get page to check for image
  const page = await db
    .select()
    .from(pages)
    .where(eq(pages.id, Number(id)))
    .get();

  await db.delete(pages).where(eq(pages.id, Number(id)));

  return c.redirect('/admin/pages');
});

// Settings routes
app.get('/admin/settings', requireAdminBetter, async (c) => {
  const db = createDbWithContext(c);
  const user = c.get('betterUser');

  // Get layout props
  const layoutProps = await getLayoutProps(c);

  // Get current settings
  const [
    siteTitle,
    tagline,
    frontPageTitle,
    siteDomain,
    siteRegion,
    imagePrefix,
    r2ImageDomain,
    faviconUrl,
    logoUrlSetting,
  ] = await Promise.all([
    db.select().from(settings).where(eq(settings.key, 'site_title')).get(),
    db.select().from(settings).where(eq(settings.key, 'tagline')).get(),
    db.select().from(settings).where(eq(settings.key, 'front_page_title')).get(),
    db.select().from(settings).where(eq(settings.key, 'site_domain')).get(),
    db.select().from(settings).where(eq(settings.key, 'site_region')).get(),
    db.select().from(settings).where(eq(settings.key, 'image_prefix')).get(),
    db.select().from(settings).where(eq(settings.key, 'r2_image_domain')).get(),
    db.select().from(settings).where(eq(settings.key, 'favicon_url')).get(),
    db.select().from(settings).where(eq(settings.key, 'logo_url')).get(),
  ]);

  return c.html(
    <Layout title="Settings" {...layoutProps}>
      <div class="bg-gray-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                <span class="text-gray-900">Settings</span>
              </li>
            </ol>
          </nav>

          <SettingsForm
            siteTitle={siteTitle?.value || undefined}
            tagline={tagline?.value || undefined}
            frontPageTitle={frontPageTitle?.value || undefined}
            siteDomain={siteDomain?.value || undefined}
            siteRegion={siteRegion?.value || undefined}
            imagePrefix={imagePrefix?.value || undefined}
            r2ImageDomain={r2ImageDomain?.value || undefined}
            faviconUrl={faviconUrl?.value || undefined}
            logoUrl={logoUrlSetting?.value || undefined}
          />
        </div>
      </div>
    </Layout>
  );
});

app.post('/admin/settings', requireAdminBetter, async (c) => {
  const db = createDbWithContext(c);
  const body = await c.req.parseBody();

  const siteTitle = (body.siteTitle as string)?.trim();
  const tagline = (body.tagline as string)?.trim();
  const frontPageTitle = (body.frontPageTitle as string)?.trim();
  const siteDomain = (body.siteDomain as string)?.trim();
  const siteRegion = (body.siteRegion as string)?.trim().toUpperCase();
  const imagePrefix = (body.imagePrefix as string)
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');
  const r2ImageDomain = (body.r2ImageDomain as string)?.trim();

  // Update or insert site title
  const existingSiteTitle = await db.select().from(settings).where(eq(settings.key, 'site_title')).get();

  if (existingSiteTitle) {
    await db.update(settings).set({ value: siteTitle, updatedAt: new Date() }).where(eq(settings.key, 'site_title'));
  } else {
    await db.insert(settings).values({
      key: 'site_title',
      value: siteTitle,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Update or insert tagline
  const existingTagline = await db.select().from(settings).where(eq(settings.key, 'tagline')).get();

  if (existingTagline) {
    await db.update(settings).set({ value: tagline, updatedAt: new Date() }).where(eq(settings.key, 'tagline'));
  } else {
    await db.insert(settings).values({
      key: 'tagline',
      value: tagline,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Update or insert front page title
  const existingFrontPageTitle = await db.select().from(settings).where(eq(settings.key, 'front_page_title')).get();

  if (existingFrontPageTitle) {
    await db
      .update(settings)
      .set({ value: frontPageTitle, updatedAt: new Date() })
      .where(eq(settings.key, 'front_page_title'));
  } else {
    await db.insert(settings).values({
      key: 'front_page_title',
      value: frontPageTitle,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Update or insert site domain
  const existingSiteDomain = await db.select().from(settings).where(eq(settings.key, 'site_domain')).get();

  if (existingSiteDomain) {
    await db.update(settings).set({ value: siteDomain, updatedAt: new Date() }).where(eq(settings.key, 'site_domain'));
  } else {
    await db.insert(settings).values({
      key: 'site_domain',
      value: siteDomain,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Update or insert site region
  const existingSiteRegion = await db.select().from(settings).where(eq(settings.key, 'site_region')).get();

  if (existingSiteRegion) {
    await db.update(settings).set({ value: siteRegion, updatedAt: new Date() }).where(eq(settings.key, 'site_region'));
  } else {
    await db.insert(settings).values({
      key: 'site_region',
      value: siteRegion,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Update or insert image prefix (only if explicitly provided)
  if (imagePrefix) {
    const existingImagePrefix = await db.select().from(settings).where(eq(settings.key, 'image_prefix')).get();

    if (existingImagePrefix) {
      await db
        .update(settings)
        .set({ value: imagePrefix, updatedAt: new Date() })
        .where(eq(settings.key, 'image_prefix'));
    } else {
      await db.insert(settings).values({
        key: 'image_prefix',
        value: imagePrefix,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  // Update or insert R2 image domain (only if explicitly provided)
  if (r2ImageDomain) {
    const existingR2ImageDomain = await db.select().from(settings).where(eq(settings.key, 'r2_image_domain')).get();

    if (existingR2ImageDomain) {
      await db
        .update(settings)
        .set({ value: r2ImageDomain, updatedAt: new Date() })
        .where(eq(settings.key, 'r2_image_domain'));
    } else {
      await db.insert(settings).values({
        key: 'r2_image_domain',
        value: r2ImageDomain,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  // Invalidate all cache when settings change (affects all pages)
  await cacheInvalidation.settings(c);

  // Also invalidate KV settings cache
  const { invalidateSettingsCache } = await import('./utils/settings-cache');
  await invalidateSettingsCache(c.env.SETTINGS_CACHE);

  return c.redirect('/admin/settings');
});

// 404 catch-all route
app.get('*', async (c) => {
  const path = c.req.path;

  // Check if this might be a bare slug (no slashes except at start)
  if (path.startsWith('/') && !path.includes('/', 1) && path.length > 1) {
    const slug = path.substring(1);
    const db = createDbWithContext(c);

    // Get common layout props (includes user, i18n, favicon, etc.)
    const layoutProps = await getCommonLayoutProps(c);

    // First check if it's a page
    const page = await db.select().from(pages).where(eq(pages.path, slug)).get();

    if (page) {
      // Render the page content
      return c.html(
        <Layout title={`${page.title} - Utah Churches`} currentPath={`/${slug}`} {...layoutProps}>
          <div class="bg-white">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
              <div class="max-w-3xl mx-auto">
                <h1 class="text-3xl font-bold text-gray-900 mb-8">{page.title}</h1>
                <div class="prose prose-lg max-w-none" dangerouslySetInnerHTML={{ __html: page.content || '' }} />
              </div>
            </div>
          </div>
        </Layout>
      );
    }

    // Then check if it's a church redirect
    const church = await db.select({ id: churches.id }).from(churches).where(eq(churches.path, slug)).get();

    if (church) {
      return c.redirect(`/churches/${slug}`, 301);
    }

    // Check if it's a county redirect
    const county = await db.select({ id: counties.id }).from(counties).where(eq(counties.path, slug)).get();

    if (county) {
      return c.redirect(`/counties/${slug}`, 301);
    }
  }

  // For 404 page, also check for user session
  const user = await getUser(c);

  // Get favicon and logo URLs for 404 page
  const faviconUrl = await getFaviconUrl(c.env);
  const logoUrl = await getLogoUrl(c.env);

  // Get navbar pages
  const navbarPages = await getNavbarPages(c.env);

  return c.html(
    <Layout
      title="Page Not Found - Utah Churches"
      user={user}
      faviconUrl={faviconUrl}
      logoUrl={logoUrl}
      pages={navbarPages}
    >
      <NotFound />
    </Layout>,
    404
  );
});

// Chrome DevTools workspace support (development only)
app.get('/.well-known/appspecific/com.chrome.devtools.json', (c) => {
  // Only respond in development environment
  const isDevelopment =
    c.env.ENVIRONMENT !== 'production' &&
    (c.req.header('host')?.includes('localhost') || c.req.header('host')?.includes('.workers.dev'));

  if (!isDevelopment) {
    return c.notFound();
  }

  return c.json({
    workspace: {
      root: process.cwd?.() || '/workspace/churches',
      uuid: 'utah-churches-dev-workspace-2025',
    },
  });
});

// Custom 404 handler
app.notFound((c) => {
  const errorId = generateErrorId();

  // Check if it's an API request
  const isApiRequest = c.req.path.startsWith('/api/') || c.req.header('Accept')?.includes('application/json');

  if (isApiRequest) {
    return c.json(
      {
        error: 'Not Found',
        message: 'The requested API endpoint does not exist.',
        errorId,
        statusCode: 404,
      },
      404
    );
  }

  return c.html(
    <Layout currentPath="/error" hideFooter={true}>
      <ErrorPage
        error="The requested page could not be found."
        errorType="Not Found"
        errorDetails="The page you are looking for may have been moved or deleted."
        statusCode={404}
        errorId={errorId}
      />
    </Layout>,
    404
  );
});

export default app;
