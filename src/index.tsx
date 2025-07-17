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

app.get('/networks', async (c) => {
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

  // Cache the response for non-authenticated users
  if (!hasSession) {
    // Cache for 7 days (network data rarely changes)
    const ttl = 604800; // 7 days
    c.executionCtx.waitUntil(putInCache(c.req.raw, response.clone(), ttl));
    console.log('Cached networks page');
  }

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

  // Cache the response for non-authenticated users
  if (!hasSession) {
    // Cache for 7 days (network data rarely changes)
    const ttl = 604800; // 7 days
    c.executionCtx.waitUntil(putInCache(c.req.raw, response.clone(), ttl));
    console.log(`Cached network detail page: ${affiliationIdOrPath}`);
  }

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

  // Check if user is authenticated (skip cache for auth users)
  const hasSession = c.req.header('cookie')?.includes('session=');

  // Try to serve from cache first (only for non-authenticated users and without query params)
  const showHereticalOption = c.req.query('heretical') !== undefined;
  if (!hasSession && !showHereticalOption) {
    const cachedResponse = await getFromCache(c.req.raw);
    if (cachedResponse) {
      console.log('Cache HIT for map page');
      return cachedResponse;
    }
  }

  const db = createDbWithContext(c);

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

  // Cache the response for non-authenticated users and without query params
  if (!hasSession && !showHereticalOption) {
    // Cache for 3 days (map data changes more frequently than church details)
    const ttl = 259200; // 3 days
    c.executionCtx.waitUntil(putInCache(c.req.raw, response.clone(), ttl));
    console.log('Cached map page');
  }

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
