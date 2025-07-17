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
  countyImages,
  images,
  pages,
  settings,
} from './db/schema';
import { createAuth } from './lib/auth';
import { betterAuthMiddleware, getUser, requireAdminBetter } from './middleware/better-auth';
import { applyCacheHeaders, shouldSkipCache } from './middleware/cache';
import type { D1SessionVariables } from './middleware/d1-session';
import { d1SessionMiddleware } from './middleware/d1-session';
import { domainRedirectMiddleware } from './middleware/domain-redirect';
import { envCheckMiddleware } from './middleware/env-check';
import { i18nMiddleware } from './middleware/i18n';
import { adminActivityRoutes } from './routes/admin/activity';
import { adminAffiliationsRoutes } from './routes/admin/affiliations';
import { adminCacheRoutes } from './routes/admin/cache';
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
import { getFromCache, putInCache } from './utils/cf-cache';
import { getGravatarUrl } from './utils/crypto';
import { EnvironmentError } from './utils/env-validation';
import { generateErrorId, getErrorStatusCode, sanitizeErrorMessage } from './utils/error-handling';
import { getCommonLayoutProps } from './utils/layout-props';
import { deleteImage, uploadImage } from './utils/r2-images';
import { getImagePrefix, getSiteTitle } from './utils/settings';
import { countySchema, pageSchema, parseFormBody, validateFormData } from './utils/validation';

type Variables = AuthVariables & D1SessionVariables;

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Apply environment check middleware globally
app.use('*', envCheckMiddleware);

// Apply domain redirect middleware globally (but after env check)
app.use('*', domainRedirectMiddleware);

// Apply i18n middleware globally
app.use('*', i18nMiddleware);

// Apply D1 session middleware for read replication
app.use('*', d1SessionMiddleware);

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
app.route('/admin/cache', adminCacheRoutes);
app.route('/admin/debug', adminDebugRoutes);
app.route('/api/admin/notifications', adminNotificationsRoutes);
app.route('/feedback', feedbackRoutes);

app.get('/', async (c) => {
  try {
    // Check if user is authenticated (skip cache for auth users)
    const hasSession = c.req.header('cookie')?.includes('session=');

    // Try to serve from cache first (only for non-authenticated users)
    if (!hasSession) {
      const cachedResponse = await getFromCache(c.req.raw);
      if (cachedResponse) {
        console.log('Cache HIT for homepage');
        return cachedResponse;
      }
    }

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

    // Cache the response for non-authenticated users
    if (!hasSession) {
      // Cache for 3 days (homepage is more dynamic than church pages)
      const ttl = 259200; // 3 days
      c.executionCtx.waitUntil(putInCache(c.req.raw, response.clone(), ttl));
      console.log('Cached homepage');
    }

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
  const countyPath = c.req.param('path');

  // Check if user is authenticated (skip cache for auth users)
  const hasSession = c.req.header('cookie')?.includes('session=');

  // Try to serve from cache first (only for non-authenticated users)
  if (!hasSession) {
    const cachedResponse = await getFromCache(c.req.raw);
    if (cachedResponse) {
      console.log(`Cache HIT for county: ${countyPath}`);
      return cachedResponse;
    }
  }

  const db = createDbWithContext(c);

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
        <div class="max-w-7xl mx-auto px-6 sm:px-6 lg:px-8 py-6 md:py-8">
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

  // Cache the response for non-authenticated users
  if (!hasSession) {
    // Cache for 7 days (same as church detail pages)
    const ttl = 604800;
    c.executionCtx.waitUntil(putInCache(c.req.raw, response.clone(), ttl));
    console.log(`Cached county page: ${countyPath}`);
  }

  // Apply cache headers if not authenticated
  return shouldSkipCache(c) ? response : applyCacheHeaders(response, 'counties');
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
