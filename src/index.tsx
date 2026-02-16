import { and, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { ErrorPage } from './components/ErrorPage';
import { Layout } from './components/Layout';
import { NotFound } from './components/NotFound';
import { createDb, createDbWithContext } from './db';
import { churches, counties, pages, settings } from './db/schema';
import { createAuth } from './lib/auth';
import { betterAuthMiddleware, getUser } from './middleware/better-auth';
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
import { adminCountiesRoutes } from './routes/admin/counties';
import { adminDebugRoutes } from './routes/admin/debug';
import { adminFeedbackRoutes } from './routes/admin/feedback';
import { adminMcpTokensRoutes } from './routes/admin/mcp-tokens';
import { adminNotificationsRoutes } from './routes/admin/notifications';
import { adminCoreRoutes } from './routes/admin-core';
import { adminUsersApp } from './routes/admin-users';
import { apiRoutes } from './routes/api';
import { assetsRoutes } from './routes/assets';
import { authCoreRoutes } from './routes/auth-core';
import { betterAuthApp } from './routes/better-auth';
import { churchDetailRoutes } from './routes/church-detail';
import { dataExportRoutes } from './routes/data-export';
import { feedbackRoutes } from './routes/feedback';
import { mcpRoutes } from './routes/mcp';
import { countiesRoutes } from './routes/public/counties';
import { mapRoutes } from './routes/public/map';
import { networksRoutes } from './routes/public/networks';
import { seoRoutes } from './routes/seo';
import type { AuthVariables, BetterAuthUser, Bindings } from './types';
import { getFromCache, putInCache } from './utils/cf-cache';
import { EnvironmentError } from './utils/env-validation';
import { generateErrorId, getErrorStatusCode, sanitizeErrorMessage } from './utils/error-handling';
import { getCommonLayoutProps } from './utils/layout-props';
import { getSiteTitle } from './utils/settings';

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
app.use('/mcp', cors());
app.use('/mcp/*', cors());

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
async function _getLayoutProps(c: { env: Bindings } & Pick<Context, 'req'>): Promise<{
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

// Mount better-auth routes
app.route('/auth', betterAuthApp);

// Mount admin users route
app.route('/admin/users', adminUsersApp);

// Mount admin MCP token management route
app.route('/admin/mcp-tokens', adminMcpTokensRoutes);

// Mount API routes
app.route('/api', apiRoutes);

// Mount MCP routes (ensure both /mcp and /mcp/* are handled)
app.route('/mcp', mcpRoutes);
app.route('/mcp/*', mcpRoutes);

// Mount SEO routes
app.route('/', seoRoutes);

// Mount data export routes
app.route('/', dataExportRoutes);

// Mount church detail routes
app.route('/', churchDetailRoutes);

// Mount admin routes
app.route('/admin/churches', adminChurchesRoutes);
app.route('/admin/counties', adminCountiesRoutes);
app.route('/admin/affiliations', adminAffiliationsRoutes);
app.route('/admin/feedback', adminFeedbackRoutes);
app.route('/admin/activity', adminActivityRoutes);
app.route('/admin/cache', adminCacheRoutes);
app.route('/admin/debug', adminDebugRoutes);
app.route('/api/admin/notifications', adminNotificationsRoutes);
app.route('/feedback', feedbackRoutes);

// Asset routes (images, static files)
app.route('/', assetsRoutes);

// Auth core routes (login, logout, callbacks)
app.route('/', authCoreRoutes);

// Public routes (counties, networks, map, etc.)
app.route('/', countiesRoutes);
app.route('/', networksRoutes);
app.route('/', mapRoutes);

// Admin core routes (dashboard, settings, etc.)
app.route('/', adminCoreRoutes);

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
      .innerJoin(
        churches,
        and(
          eq(counties.id, churches.countyId),
          sql`${churches.status} IN ('Listed', 'Unlisted')`,
          isNull(churches.deletedAt)
        )
      )
      .where(isNull(counties.deletedAt))
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
    const church = await db
      .select({ id: churches.id })
      .from(churches)
      .where(and(eq(churches.path, slug), isNull(churches.deletedAt)))
      .get();

    if (church) {
      return c.redirect(`/churches/${slug}`, 301);
    }

    // Check if it's a county redirect
    const county = await db
      .select({ id: counties.id })
      .from(counties)
      .where(and(eq(counties.path, slug), isNull(counties.deletedAt)))
      .get();

    if (county) {
      return c.redirect(`/counties/${slug}`, 301);
    }
  }

  // For 404 page, get common layout props including translations
  const layoutProps = await getCommonLayoutProps(c);

  return c.html(
    <Layout title="Page Not Found - Utah Churches" {...layoutProps}>
      <NotFound />
    </Layout>,
    404
  );
});

// Custom 404 handler
app.notFound(async (c) => {
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

  // Get layout props for proper translation
  const layoutProps = await getCommonLayoutProps(c).catch(() => ({
    faviconUrl: undefined,
    logoUrl: undefined,
    pages: [],
    currentPath: c.req.path,
    user: null,
    t: (key: string) => key, // Fallback translation function
  }));

  return c.html(
    <Layout currentPath="/error" hideFooter={true} {...layoutProps}>
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
