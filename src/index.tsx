import { desc, eq, isNotNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import yaml from 'js-yaml';
import * as XLSX from 'xlsx';
import { AffiliationForm } from './components/AffiliationForm';
import { ChurchCard } from './components/ChurchCard';
import { ChurchComments } from './components/ChurchComments';
import { ChurchForm } from './components/ChurchForm';
import { CountyForm } from './components/CountyForm';
import { ErrorPage } from './components/ErrorPage';
import { Layout } from './components/Layout';
import { MonitoringDashboard } from './components/MonitoringDashboard';
import { NotFound } from './components/NotFound';
import { PageForm } from './components/PageForm';
import { SettingsForm } from './components/SettingsForm';
import { createDb } from './db';
import {
  affiliations,
  churchAffiliations,
  churches,
  churchGatherings,
  churchImages,
  comments,
  counties,
  pages,
  settings,
} from './db/schema';
import { users } from './db/auth-schema';
import { createAuth } from './lib/auth';
import { betterAuthMiddleware, getUser, requireAdminBetter } from './middleware/better-auth';
import { adminUsersApp } from './routes/admin-users';
import { betterAuthApp } from './routes/better-auth';
import type { Bindings } from './types';
import {
  deleteFromCloudflareImages,
  getCloudflareImageUrl,
  IMAGE_VARIANTS,
  uploadToCloudflareImages,
} from './utils/cloudflare-images';
import {
  affiliationSchema,
  churchWithGatheringsSchema,
  countySchema,
  pageSchema,
  parseAffiliationsFromForm,
  parseFormBody,
  parseGatheringsFromForm,
  prepareChurchDataFromForm,
  validateFormData,
} from './utils/validation';
import { extractChurchDataFromWebsite } from './utils/website-extraction';

type Variables = {
  user: any;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Test route to verify pattern matching
app.get('/api/auth/test', async (c) => {
  return c.json({ message: 'Test route works!' });
});


// Debug route to see what better-auth provides
app.get('/api/auth/debug', async (c) => {
  const auth = createAuth(c.env);
  return c.json({ 
    message: 'Better-auth debug',
    config: {
      baseURL: auth.options.baseURL,
      socialProviders: Object.keys(auth.options.socialProviders || {}),
    }
  });
});

// Mount better-auth API routes BEFORE middleware - try different pattern
app.all('/api/auth/*', async (c) => {
  console.log('Better-auth route called:', c.req.method, c.req.url);
  const auth = createAuth(c.env);
  try {
    const result = await auth.handler(c.req.raw);
    console.log('Better-auth handler result status:', result?.status);
    console.log('Better-auth handler result type:', typeof result);
    if (result?.status === 404) {
      console.log('Better-auth 404 - endpoint not found');
    }
    return result;
  } catch (error) {
    console.error('Better-auth handler error:', error);
    return c.json({ error: 'Auth handler failed' }, 500);
  }
});

// Apply better-auth middleware globally
app.use('*', betterAuthMiddleware);

app.use('/api/*', cors());

// Helper function to fetch favicon URL
async function getFaviconUrl(env: Bindings): Promise<string | undefined> {
  const db = createDb(env);
  const faviconUrlSetting = await db.select().from(settings).where(eq(settings.key, 'favicon_url')).get();
  return faviconUrlSetting?.value || undefined;
}

// Helper function to fetch logo URL
async function getLogoUrl(env: Bindings): Promise<string | undefined> {
  const db = createDb(env);
  const logoUrlSetting = await db.select().from(settings).where(eq(settings.key, 'logo_url')).get();
  return logoUrlSetting?.value || undefined;
}

// Helper function to fetch navbar pages
async function getNavbarPages(
  env: Bindings
): Promise<Array<{ id: number; title: string; path: string; navbarOrder: number | null }>> {
  const db = createDb(env);
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
async function getLayoutProps(c: any): Promise<{
  user: any;
  faviconUrl?: string;
  logoUrl?: string;
  pages: Array<{ id: number; title: string; path: string; navbarOrder: number | null }>;
}> {
  const user = await getUser(c);
  const faviconUrl = await getFaviconUrl(c.env);
  const logoUrl = await getLogoUrl(c.env);
  const pages = await getNavbarPages(c.env);

  return {
    user,
    faviconUrl,
    logoUrl,
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
    err.cause?.message?.includes('Network connection lost');

  return c.html(
    <Layout title="Error - Utah Churches">
      <ErrorPage error={isDatabaseError ? 'Database connection error' : err.message} statusCode={err.status || 500} />
    </Layout>,
    err.status || 500
  );
});

// Mount better-auth routes
app.route('/auth', betterAuthApp);

// Mount admin users route
app.route('/admin/users', adminUsersApp);

app.get('/', async (c) => {
  try {
    const db = createDb(c.env);

    // Get all layout props
    const layoutProps = await getLayoutProps(c);

    // Get front page title from settings
    const frontPageTitleSetting = await db.select().from(settings).where(eq(settings.key, 'front_page_title')).get();
    const frontPageTitle = frontPageTitleSetting?.value || 'Christian Churches in Utah';

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

    return c.html(
      <Layout
        title={frontPageTitle}
        currentPath="/"
        {...layoutProps}
      >
        <div class="bg-gray-50">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div class="mb-4">
              <h1 class="sr-only">Churches in Utah</h1>
              <p class="sr-only">A directory of evangelical churches</p>
            </div>

            {/* Map Card */}
            <div class="mb-8">
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
                      <h2 class="text-2xl font-semibold">Find Churches Near You</h2>
                    </div>
                    <p class="text-primary-100">Explore an interactive map of evangelical churches in Utah</p>
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
                <h2 class="text-2xl font-bold text-gray-900 mb-4 sm:mb-0">Browse by County</h2>
                <div class="flex items-center space-x-2">
                  <span class="text-sm text-gray-700">Sort by:</span>
                  <div class="inline-flex rounded-md shadow-sm" role="group">
                    <button
                      type="button"
                      id="sort-population"
                      class="sort-button-population px-3 py-1.5 text-sm font-medium border rounded-l-md focus:z-10 focus:ring-2 focus:ring-primary-500"
                      onclick="sortCounties('population')"
                    >
                      Population
                    </button>
                    <button
                      type="button"
                      id="sort-name"
                      class="sort-button-name px-3 py-1.5 text-sm font-medium border rounded-r-md focus:z-10 focus:ring-2 focus:ring-primary-500"
                      onclick="sortCounties('name')"
                    >
                      Name
                    </button>
                  </div>
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
                  <a
                    href={`/counties/${county.path || county.id}`}
                    class="county-card group bg-white rounded-lg shadow-sm ring-1 ring-gray-200 hover:shadow-md hover:ring-primary-500 transition-all duration-200 p-6"
                    data-name={county.name}
                    data-population={county.population || 0}
                  >
                    <div class="flex items-start justify-between">
                      <div>
                        <h3 class="text-base font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                          {county.name}
                        </h3>
                        <p class="mt-1 text-sm text-gray-500">
                          {county.churchCount} {county.churchCount === 1 ? 'church' : 'churches'}
                        </p>
                      </div>
                      <svg
                        class="h-5 w-5 text-gray-400 group-hover:text-primary-500 transition-colors flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    {county.description && <p class="mt-2 text-sm text-gray-600 line-clamp-2">{county.description}</p>}
                  </a>
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
  } catch (error) {
    console.error('Error loading home page:', error);
    return c.html(
      <Layout title="Error - Utah Churches">
        <ErrorPage error={error.message || 'Failed to load churches'} statusCode={500} />
      </Layout>,
      500
    );
  }
});

app.get('/counties/:path', async (c) => {
  const db = createDb(c.env);
  const countyPath = c.req.param('path');

  // Check if user is logged in
  const user = await getUser(c);

  // Get county by path
  const county = await db.select().from(counties).where(eq(counties.path, countyPath)).get();

  if (!county) {
    return c.html(
      <Layout title="Page Not Found - Utah Churches" user={user}>
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

  // Get favicon URL
  const faviconUrl = await getFaviconUrl(c.env);

  // Get logo URL
  const logoUrl = await getLogoUrl(c.env);

  // Get navbar pages
  const navbarPages = await getNavbarPages(c.env);

  return c.html(
    <Layout
      title={`${county.name} Churches - Utah Churches`}
      user={user}
      countyId={county.id.toString()}
      faviconUrl={faviconUrl}
      logoUrl={logoUrl}
      pages={navbarPages}
    >
      <div>
        {/* Header */}
        <div class="bg-gradient-to-r from-primary-600 to-primary-700">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
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
                  <ChurchCard church={church} />
                </div>
              ))}

              {/* Unlisted Churches (hidden by default unless no listed churches) */}
              {unlistedChurches.map((church) => (
                <div class={`church-card unlisted-church ${listedChurches.length > 0 ? 'hidden' : ''}`}>
                  <ChurchCard church={church} />
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
                Show unlisted churches ({unlistedChurches.length})
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
});

app.get('/api/churches', async (c) => {
  const db = createDb(c.env);
  const limit = Number(c.req.query('limit')) || 20;
  const offset = Number(c.req.query('offset')) || 0;

  const allChurches = await db.select().from(churches).limit(limit).offset(offset);

  return c.json({
    churches: allChurches,
    limit,
    offset,
  });
});

app.get('/api/churches/:id', async (c) => {
  const db = createDb(c.env);
  const id = c.req.param('id');

  const church = await db
    .select()
    .from(churches)
    .where(eq(churches.id, Number(id)))
    .get();

  if (!church) {
    return c.json({ error: 'Church not found' }, 404);
  }

  return c.json(church);
});

app.get('/networks', async (c) => {
  const db = createDb(c.env);

  // Check for user session
  const user = await getUser(c);

  // Get all listed affiliations with church count (only count churches with 'Listed' status)
  const listedAffiliations = await db
    .select({
      id: affiliations.id,
      name: affiliations.name,
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

  // Get favicon URL
  const faviconUrl = await getFaviconUrl(c.env);

  // Get logo URL
  const logoUrl = await getLogoUrl(c.env);

  // Get navbar pages
  const navbarPages = await getNavbarPages(c.env);

  return c.html(
    <Layout
      title="Church Networks - Utah Churches"
      currentPath="/networks"
      user={user}
      faviconUrl={faviconUrl}
      logoUrl={logoUrl}
      pages={navbarPages}
    >
      <div class="bg-gray-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900">Church Networks</h1>
          </div>

          {/* Affiliations Grid */}
          <div class="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-lg">
            <ul class="divide-y divide-gray-200">
              {listedAffiliations.map((affiliation) => (
                <li>
                  <a href={`/networks/${affiliation.id}`} class="block px-6 py-4 hover:bg-gray-50 transition-colors">
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
});

app.get('/robots.txt', async (c) => {
  const robotsTxt = `User-agent: *
Allow: /

# Block admin and authentication pages
Disallow: /admin/
Disallow: /login
Disallow: /logout

# API endpoints
Disallow: /api/

Sitemap: https://utahchurches.org/sitemap.xml`;

  return c.text(robotsTxt, 200, {
    'Content-Type': 'text/plain',
    'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
  });
});

app.get('/sitemap.xml', async (c) => {
  const db = createDb(c.env);

  // Get all churches, counties, and pages
  const [allChurches, allCounties, allPages, listedAffiliations] = await Promise.all([
    db
      .select({
        path: churches.path,
        updatedAt: churches.updatedAt,
        createdAt: churches.createdAt,
      })
      .from(churches)
      .where(eq(churches.status, 'Listed'))
      .all(),
    db.select({ path: counties.path }).from(counties).all(),
    db.select({ path: pages.path }).from(pages).all(),
    db
      .select({
        id: affiliations.id,
        path: affiliations.path,
      })
      .from(affiliations)
      .where(eq(affiliations.status, 'Listed'))
      .all(),
  ]);

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://utahchurches.org/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://utahchurches.org/map</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://utahchurches.org/networks</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://utahchurches.org/data</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>${allCounties
    .map(
      (county) => `
  <url>
    <loc>https://utahchurches.org/counties/${county.path}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
    )
    .join('')}${allChurches
    .map((church) => {
      const lastMod = church.updatedAt || church.createdAt;
      if (lastMod) {
        // Check if timestamp is already in milliseconds (very large number) or seconds
        const timestamp = lastMod > 10000000000 ? lastMod : lastMod * 1000;
        const date = new Date(timestamp);
        // Only include lastmod if it's a valid date between 2020 and 2030
        if (date.getFullYear() >= 2020 && date.getFullYear() <= 2030) {
          return `
  <url>
    <loc>https://utahchurches.org/churches/${church.path}</loc>
    <lastmod>${date.toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;
        }
      }
      return `
  <url>
    <loc>https://utahchurches.org/churches/${church.path}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;
    })
    .join('')}${listedAffiliations
    .map(
      (affiliation) => `
  <url>
    <loc>https://utahchurches.org/networks/${affiliation.path || affiliation.id}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`
    )
    .join('')}${allPages
    .map(
      (page) => `
  <url>
    <loc>https://utahchurches.org/${page.path}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`
    )
    .join('')}
</urlset>`;

  return c.text(sitemap, 200, {
    'Content-Type': 'application/xml',
    'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
  });
});

app.get('/churches/:path', async (c) => {
  const db = createDb(c.env);
  const churchPath = c.req.param('path');

  // Check for admin user (optional)
  const user = await getUser(c);

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

  // Helper function to format phone numbers
  const formatPhoneNumber = (phone: string): string => {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');

    // Check if it's a 10-digit US phone number
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }

    // Return original if not a standard 10-digit number
    return phone;
  };

  // Get church by path with county and affiliations
  const church = await db
    .select({
      id: churches.id,
      name: churches.name,
      path: churches.path,
      status: churches.status,
      publicNotes: churches.publicNotes,
      privateNotes: churches.privateNotes,
      lastUpdated: churches.lastUpdated,
      gatheringAddress: churches.gatheringAddress,
      latitude: churches.latitude,
      longitude: churches.longitude,
      countyId: churches.countyId,
      countyName: counties.name,
      countyPath: counties.path,
      website: churches.website,
      statementOfFaith: churches.statementOfFaith,
      phone: churches.phone,
      email: churches.email,
      facebook: churches.facebook,
      instagram: churches.instagram,
      youtube: churches.youtube,
      spotify: churches.spotify,
      imageId: churches.imageId,
      imageUrl: churches.imageUrl,
    })
    .from(churches)
    .leftJoin(counties, eq(churches.countyId, counties.id))
    .where(eq(churches.path, churchPath))
    .get();

  if (!church) {
    return c.notFound();
  }

  // Get church affiliations
  const churchAffiliationsList = await db
    .select({
      id: affiliations.id,
      name: affiliations.name,
      path: affiliations.path,
      website: affiliations.website,
    })
    .from(churchAffiliations)
    .innerJoin(affiliations, eq(churchAffiliations.affiliationId, affiliations.id))
    .where(eq(churchAffiliations.churchId, church.id))
    .orderBy(churchAffiliations.order)
    .all();

  // Get church gatherings
  const churchGatheringsList = await db
    .select()
    .from(churchGatherings)
    .where(eq(churchGatherings.churchId, church.id))
    .orderBy(churchGatherings.id)
    .all();

  // Get church images
  const churchImagesList = await db
    .select()
    .from(churchImages)
    .where(eq(churchImages.churchId, church.id))
    .orderBy(churchImages.displayOrder)
    .all();

  // Get church comments
  const allComments = await db
    .select({
      id: comments.id,
      content: comments.content,
      createdAt: comments.createdAt,
      userId: comments.userId,
      userName: users.name,
      userEmail: users.email,
    })
    .from(comments)
    .leftJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.churchId, church.id))
    .orderBy(desc(comments.createdAt))
    .all();

  // Process comments with visibility rules
  const processedComments = allComments.map(comment => ({
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt,
    userName: comment.userName,
    userEmail: comment.userEmail || '',
    userId: comment.userId,
    isOwn: user ? comment.userId === user.id : false,
  }));

  // Get favicon URL
  const faviconUrl = await getFaviconUrl(c.env);

  // Get logo URL
  const logoUrl = await getLogoUrl(c.env);

  // Get navbar pages
  const navbarPages = await getNavbarPages(c.env);

  // Helper function to get next occurrence of a day
  const getNextDayDate = (dayName: string): string => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = new Date();
    const todayDay = today.getDay();
    const targetDay = days.indexOf(dayName);

    if (targetDay === -1) return new Date().toISOString().split('T')[0]; // fallback to today

    let daysUntilTarget = targetDay - todayDay;
    if (daysUntilTarget <= 0) daysUntilTarget += 7;

    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + daysUntilTarget);
    return nextDate.toISOString().split('T')[0];
  };

  // Parse gathering time to extract day and time
  const parseGatheringTime = (timeStr: string) => {
    // Match patterns like "10 AM Sunday" or "6:30 PM Wednesday"
    const match = timeStr.match(
      /(\d{1,2}(?::\d{2})?\s*(?:AM|PM))\s+(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)/i
    );
    if (match) {
      return { time: match[1], day: match[2] };
    }
    // Try to match day in parentheses like "10 AM (Sunday)"
    const parenMatch = timeStr.match(
      /(\d{1,2}(?::\d{2})?\s*(?:AM|PM)).*\((Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\)/i
    );
    if (parenMatch) {
      return { time: parenMatch[1], day: parenMatch[2] };
    }
    return null;
  };

  // Build JSON-LD structured data with Events
  const events = churchGatheringsList
    .map((gathering) => {
      const parsed = parseGatheringTime(gathering.time);
      if (!parsed) return null;

      const nextDate = getNextDayDate(parsed.day);
      const timeMatch = parsed.time.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
      if (!timeMatch) return null;

      let hour = parseInt(timeMatch[1]);
      const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      const isPM = timeMatch[3].toUpperCase() === 'PM';

      if (isPM && hour !== 12) hour += 12;
      if (!isPM && hour === 12) hour = 0;

      const eventTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`;

      return {
        '@type': 'Event',
        name: gathering.notes || 'Church Gathering',
        description: `${gathering.notes || 'Church Gathering'} at ${church.name}`,
        startDate: `${nextDate}T${eventTime}`,
        eventSchedule: {
          '@type': 'Schedule',
          repeatFrequency: 'P1W',
          byDay: `https://schema.org/${parsed.day}`,
          startTime: eventTime,
          duration: 'PT1H30M', // Assume 1.5 hour duration
        },
        location: {
          '@type': 'Church',
          name: church.name,
          ...(church.gatheringAddress && {
            address: {
              '@type': 'PostalAddress',
              streetAddress: church.gatheringAddress,
              addressLocality: church.countyName ? church.countyName.replace(' County', '') : undefined,
              addressRegion: 'UT',
              addressCountry: 'US',
            },
          }),
        },
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        eventStatus: 'https://schema.org/EventScheduled',
      };
    })
    .filter(Boolean);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Church',
    name: church.name,
    ...(church.gatheringAddress && {
      address: {
        '@type': 'PostalAddress',
        streetAddress: church.gatheringAddress,
        addressLocality: church.countyName ? church.countyName.replace(' County', '') : undefined,
        addressRegion: 'UT',
        addressCountry: 'US',
      },
    }),
    ...(church.latitude &&
      church.longitude && {
        geo: {
          '@type': 'GeoCoordinates',
          latitude: church.latitude,
          longitude: church.longitude,
        },
      }),
    ...(church.phone && { telephone: church.phone }),
    ...(church.email && { email: church.email }),
    ...(church.website && { url: church.website }),
    ...(churchGatheringsList.length > 0 && {
      openingHours: churchGatheringsList.map((g) => g.time).join(', '),
    }),
    ...(church.publicNotes && { description: church.publicNotes }),
    ...(churchAffiliationsList.length > 0 && {
      memberOf: churchAffiliationsList.map((a) => ({
        '@type': 'Organization',
        name: a.name,
        ...(a.website && { url: a.website }),
      })),
    }),
    sameAs: [church.facebook, church.instagram, church.youtube, church.spotify].filter(Boolean),
    ...(events.length > 0 && { event: events }),
  };

  return c.html(
    <Layout
      title={`${church.name} - Utah Churches`}
      jsonLd={jsonLd}
      user={user}
      churchId={church.id}
      faviconUrl={faviconUrl}
      logoUrl={logoUrl}
      pages={navbarPages}
      currentPath={`/churches/${church.path}`}
    >
      <div>
        {/* Header */}
        <div class="bg-gradient-to-r from-primary-600 to-primary-700" data-testid="church-header">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="py-12 md:py-16">
              <div class="md:flex md:items-center md:justify-between">
                <div class="flex-1 min-w-0">
                  <h1 class="text-4xl font-bold text-white md:text-5xl" data-testid="church-name">
                    {church.name}
                  </h1>
                  {church.gatheringAddress && (
                    <p class="mt-4 text-xl text-primary-100" data-testid="church-address">
                      {church.gatheringAddress}
                    </p>
                  )}
                  {church.status && church.status !== 'Listed' && (
                    <div class="mt-4">
                      <span
                        class={`inline-flex items-center rounded-md px-3 py-1 text-sm font-medium ${
                          church.status === 'Unlisted'
                            ? 'bg-primary-800 text-primary-100'
                            : church.status === 'Heretical'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-primary-800 text-primary-100'
                        }`}
                        data-testid="church-status"
                      >
                        {church.status}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Church Content */}
        <div class="bg-gray-50">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div class="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-lg">
              <div class="p-6 sm:p-8">
                {/* Church Details Grid */}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div class="space-y-4" data-testid="church-details">
                    {church.gatheringAddress && (
                      <div data-testid="church-directions">
                        <h3 class="text-base font-medium text-gray-500">Directions</h3>
                        {church.latitude && church.longitude && (
                          <div class="flex gap-2 mt-3">
                            <a
                              href={`https://maps.google.com/?q=${church.latitude},${church.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              class="inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                            >
                              <svg class="w-5 h-5 mr-1.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                              </svg>
                              <span class="hidden sm:inline">Google Maps</span>
                              <span class="sm:hidden">Google</span>
                            </a>
                            <a
                              href={`https://maps.apple.com/?ll=${church.latitude},${church.longitude}&q=${encodeURIComponent(church.name)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              class="inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                            >
                              <svg class="w-5 h-5 mr-1.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z" />
                              </svg>
                              <span class="hidden sm:inline">Apple Maps</span>
                              <span class="sm:hidden">Apple</span>
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    {churchGatheringsList.length > 0 && (
                      <div>
                        <h3 class="text-base font-medium text-gray-500">Gatherings</h3>
                        <div class="mt-1 space-y-1">
                          {churchGatheringsList.map((gathering) => (
                            <div class="text-base text-gray-900">
                              <span class="font-medium">{gathering.time}</span>
                              {gathering.notes && <span class="text-gray-600"> – {gathering.notes}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {church.phone && (
                      <div data-testid="church-phone">
                        <h3 class="text-base font-medium text-gray-500">Phone</h3>
                        <a href={`tel:${church.phone}`} class="mt-1 text-base text-primary-600 hover:text-primary-500">
                          {formatPhoneNumber(church.phone)}
                        </a>
                      </div>
                    )}

                    {church.email && (
                      <div data-testid="church-email">
                        <h3 class="text-base font-medium text-gray-500">Email</h3>
                        <a
                          href={`mailto:${church.email}`}
                          class="mt-1 text-base text-primary-600 hover:text-primary-500"
                        >
                          {church.email}
                        </a>
                      </div>
                    )}
                  </div>

                  <div class="space-y-4">
                    {church.website && (
                      <div data-testid="church-website">
                        <h3 class="text-base font-medium text-gray-500">Website</h3>
                        <a
                          href={church.website}
                          rel="noopener noreferrer"
                          class="inline-flex items-center mt-1 text-base text-primary-600 hover:text-primary-500"
                        >
                          {formatUrlForDisplay(church.website)}
                          <svg class="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                        </a>
                      </div>
                    )}

                    {church.statementOfFaith && (
                      <div data-testid="church-statement-of-faith">
                        <h3 class="text-base font-medium text-gray-500">Statement of Faith</h3>
                        <a
                          href={church.statementOfFaith}
                          rel="noopener noreferrer"
                          class="inline-flex items-center mt-1 text-base text-primary-600 hover:text-primary-500"
                        >
                          {formatUrlForDisplay(church.statementOfFaith)}
                          <svg class="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                        </a>
                      </div>
                    )}

                    {/* Social Media Links */}
                    {(church.facebook || church.instagram || church.youtube || church.spotify) && (
                      <div>
                        <h3 class="text-base font-medium text-gray-500">Social Media</h3>
                        <div class="flex gap-2 mt-3 flex-wrap">
                          {church.facebook && (
                            <a
                              href={church.facebook}
                              target="_blank"
                              rel="noopener noreferrer"
                              class="inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                            >
                              <svg class="w-5 h-5 mr-1.5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                              </svg>
                              <span>Facebook</span>
                            </a>
                          )}
                          {church.instagram && (
                            <a
                              href={church.instagram}
                              target="_blank"
                              rel="noopener noreferrer"
                              class="inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                            >
                              <svg class="w-5 h-5 mr-1.5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" />
                              </svg>
                              <span>Instagram</span>
                            </a>
                          )}
                          {church.youtube && (
                            <a
                              href={church.youtube}
                              target="_blank"
                              rel="noopener noreferrer"
                              class="inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                            >
                              <svg class="w-5 h-5 mr-1.5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                              </svg>
                              <span>YouTube</span>
                            </a>
                          )}
                          {church.spotify && (
                            <a
                              href={church.spotify}
                              target="_blank"
                              rel="noopener noreferrer"
                              class="inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                            >
                              <svg class="w-5 h-5 mr-1.5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                              </svg>
                              <span>Spotify</span>
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {churchAffiliationsList.length > 0 && (
                      <div data-testid="church-affiliations">
                        <h3 class="text-base font-medium text-gray-500">Affiliations</h3>
                        <ul class="mt-1 space-y-1">
                          {churchAffiliationsList.map((affiliation) => (
                            <li class="text-base">
                              <a
                                href={`/networks/${affiliation.path || affiliation.id}`}
                                class="text-primary-600 hover:text-primary-500"
                              >
                                {affiliation.name}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {church.publicNotes && (
                  <div class="mt-6 pt-6 border-t border-gray-200" data-testid="church-notes">
                    <h3 class="text-base font-medium text-gray-500 mb-2">Notes</h3>
                    <p class="text-base text-gray-700">{church.publicNotes}</p>
                  </div>
                )}

                {churchImagesList.length > 0 && (
                  <div class="mt-6 pt-6 border-t border-gray-200" data-testid="church-images">
                    <h3 class="text-base font-medium text-gray-500 mb-4">Photos</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {churchImagesList.map((image, index) => (
                        <div class="relative group">
                          <img
                            src={getCloudflareImageUrl(
                              image.imageId,
                              c.env.CLOUDFLARE_ACCOUNT_HASH,
                              IMAGE_VARIANTS.MEDIUM
                            )}
                            alt={image.caption || `${church.name} photo ${index + 1}`}
                            class="rounded-lg shadow-lg w-full h-64 object-cover cursor-pointer hover:opacity-95 transition-opacity"
                            onclick={`showImageModal('${getCloudflareImageUrl(image.imageId, c.env.CLOUDFLARE_ACCOUNT_HASH, IMAGE_VARIANTS.LARGE)}', '${(image.caption || '').replace(/'/g, "\\'")}')`}
                          />
                          {image.caption && <p class="mt-2 text-sm text-gray-600">{image.caption}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Comments Section */}
                <div id="comments" class="mt-6 pt-6 border-t border-gray-200">
                  <ChurchComments
                    churchId={church.id}
                    churchName={church.name}
                    churchPath={church.path}
                    comments={processedComments}
                    user={user}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Image Modal */}
      <div
        id="imageModal"
        class="hidden fixed inset-0 z-50 overflow-y-auto"
        aria-labelledby="modal-title"
        role="dialog"
        aria-modal="true"
      >
        <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          <div
            class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
            aria-hidden="true"
            onclick="closeImageModal()"
          ></div>
          <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
            &#8203;
          </span>
          <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
            <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div class="relative">
                <button
                  onclick="closeImageModal()"
                  class="absolute -top-2 -right-2 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100"
                >
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <img id="modalImage" src="" alt="" class="w-full h-auto" />
                <p id="modalCaption" class="mt-4 text-gray-700 text-center"></p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
            function showImageModal(imageUrl, caption) {
              const modal = document.getElementById('imageModal');
              const modalImage = document.getElementById('modalImage');
              const modalCaption = document.getElementById('modalCaption');
              
              modalImage.src = imageUrl;
              modalCaption.textContent = caption || '';
              modal.classList.remove('hidden');
              document.body.style.overflow = 'hidden';
            }
            
            function closeImageModal() {
              const modal = document.getElementById('imageModal');
              modal.classList.add('hidden');
              document.body.style.overflow = '';
            }
            
            // Close modal on escape key
            document.addEventListener('keydown', function(e) {
              if (e.key === 'Escape') {
                closeImageModal();
              }
            });
          `,
        }}
      />
    </Layout>
  );
});

app.get('/networks/:id', async (c) => {
  const db = createDb(c.env);
  const affiliationIdOrPath = c.req.param('id');

  // Check for user session
  const user = await getUser(c);

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

  // Get logo URL
  const logoUrl = await getLogoUrl(c.env);

  // Get navbar pages
  const navbarPages = await getNavbarPages(c.env);

  return c.html(
    <Layout
      title={`${affiliation.name} - Utah Churches`}
      user={user}
      affiliationId={affiliation.id.toString()}
      logoUrl={logoUrl}
      pages={navbarPages}
    >
      <div>
        {/* Header */}
        <div class="bg-gradient-to-r from-primary-600 to-primary-700">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="py-12 md:py-16">
              <div class="md:flex md:items-center md:justify-between">
                <div class="flex-1 min-w-0">
                  <h1 class="text-4xl font-bold text-white md:text-5xl">{affiliation.name}</h1>
                  <p class="mt-4 text-xl text-primary-100">
                    {listedChurches.length + unlistedChurches.length}{' '}
                    {listedChurches.length + unlistedChurches.length === 1 ? 'church' : 'churches'} in Utah
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
                    <ChurchCard church={church} showCounty={false} />
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
                    <ChurchCard church={church} showCounty={false} />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p class="text-gray-600">No churches found for this network.</p>
          )}

          {/* Show unlisted churches button only if there are listed churches AND unlisted churches */}
          {listedChurches.length > 0 && unlistedChurches.length > 0 && (
            <div class="mt-8">
              <button
                type="button"
                id="show-unlisted"
                class="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                onclick="showUnlistedChurches()"
              >
                Show unlisted churches ({unlistedChurches.length})
              </button>

              <div id="unlisted-churches" class="hidden mt-6">
                <h2 class="sr-only">Unlisted Churches</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {unlistedChurches.map((church) => (
                    <div class="church-card unlisted-church">
                      <ChurchCard church={church} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* JavaScript for showing unlisted churches */}
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
          `,
          }}
        />
      </div>
    </Layout>
  );
});

app.get('/map', async (c) => {
  const db = createDb(c.env);

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

  // Get gatherings for all churches
  const churchIds = allChurchesWithCoords.map((c) => c.id);
  const allGatherings =
    churchIds.length > 0
      ? await db
          .select()
          .from(churchGatherings)
          .where(
            sql`${churchGatherings.churchId} IN (${sql.join(
              churchIds.map((id) => sql`${id}`),
              sql`, `
            )})`
          )
          .all()
      : [];

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

  // Get favicon URL
  const faviconUrl = await getFaviconUrl(c.env);

  // Get logo URL
  const logoUrl = await getLogoUrl(c.env);

  // Get navbar pages
  const navbarPages = await getNavbarPages(c.env);

  return c.html(
    <Layout
      title="Church Map - Utah Churches"
      currentPath="/map"
      user={user}
      faviconUrl={faviconUrl}
      logoUrl={logoUrl}
      pages={navbarPages}
    >
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
                  Show unlisted churches ({unlistedChurches.length} unlisted)
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
                    <span id="church-count">{listedChurches.length}</span> churches shown. Click markers for details.
                    Blue marker = your location.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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
          
          // Initialize map centered on Utah
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
            websiteLinks.push(\`<a href="\${church.website}" target="_blank" style="color: #4299e1;">Website</a>\`);
          }
          if (church.statementOfFaith) {
            websiteLinks.push(\`<a href="\${church.statementOfFaith}" target="_blank" style="color: #4299e1;">Statement of Faith</a>\`);
          }
          
          // Build social media links
          let socialLinks = [];
          if (church.facebook) {
            socialLinks.push(\`<a href="\${church.facebook}" target="_blank" style="color: #4299e1;">Facebook</a>\`);
          }
          if (church.instagram) {
            socialLinks.push(\`<a href="\${church.instagram}" target="_blank" style="color: #4299e1;">Instagram</a>\`);
          }
          if (church.youtube) {
            socialLinks.push(\`<a href="\${church.youtube}" target="_blank" style="color: #4299e1;">YouTube</a>\`);
          }
          if (church.spotify) {
            socialLinks.push(\`<a href="\${church.spotify}" target="_blank" style="color: #4299e1;">Spotify</a>\`);
          }
          
          content.innerHTML = \`
            <h3 style="margin: 0 0 0.5rem 0; font-size: 1.125rem; font-weight: 600;">\${church.name}</h3>
            \${church.gatheringAddress ? \`<div style="margin-bottom: 0.25rem;">\${church.gatheringAddress}</div>\` : ''}
            \${gatheringTimes ? \`<div style="margin-bottom: 0.25rem;">Gathering times: \${gatheringTimes}</div>\` : ''}
            \${websiteLinks.length > 0 ? \`<div style="margin-bottom: 0.25rem;">\${websiteLinks.join(' | ')}</div>\` : ''}
            \${church.email ? \`<div style="margin-bottom: 0.25rem;"><a href="mailto:\${church.email}" style="color: #4299e1;">\${church.email}</a></div>\` : ''}
            \${church.phone ? \`<div style="margin-bottom: 0.25rem;"><a href="tel:\${church.phone}" style="color: #4299e1;">\${church.phone}</a></div>\` : ''}
            \${socialLinks.length > 0 ? \`<div style="margin-bottom: 0.5rem;">\${socialLinks.join(' | ')}</div>\` : ''}
            \${church.path ? \`<div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #e5e7eb;"><a href="/churches/\${church.path}" style="color: #4299e1; font-weight: 500;">View Details →</a></div>\` : ''}
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
            loadingDiv.innerHTML = '<div style="display: flex; align-items: center; gap: 0.5rem;"><svg style="animation: spin 1s linear infinite; width: 1rem; height: 1rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg><span>Finding your location...</span></div>';
            
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
          
          // Check if user is in Utah
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
});

app.get('/churches.json', async (c) => {
  const db = createDb(c.env);

  // Get all churches with 'Listed' or 'Unlisted' status
  const allChurches = await db
    .select({
      id: churches.id,
      name: churches.name,
      path: churches.path,
      status: churches.status,
      lastUpdated: churches.lastUpdated,
      gatheringAddress: churches.gatheringAddress,
      latitude: churches.latitude,
      longitude: churches.longitude,
      county: counties.name,
      website: churches.website,
      statementOfFaith: churches.statementOfFaith,
      phone: churches.phone,
      email: churches.email,
      facebook: churches.facebook,
      instagram: churches.instagram,
      youtube: churches.youtube,
      spotify: churches.spotify,
      language: churches.language,
      notes: churches.publicNotes,
    })
    .from(churches)
    .leftJoin(counties, eq(churches.countyId, counties.id))
    .where(sql`${churches.status} IN ('Listed', 'Unlisted')`)
    .orderBy(churches.name)
    .all();

  // Get affiliations for each church
  const churchIds = allChurches.map((c) => c.id);
  let churchAffiliationData = [];

  if (churchIds.length > 0) {
    churchAffiliationData = await db
      .select({
        churchId: churchAffiliations.churchId,
        affiliationId: churchAffiliations.affiliationId,
        affiliationName: affiliations.name,
        affiliationWebsite: affiliations.website,
        affiliationPublicNotes: affiliations.publicNotes,
        order: churchAffiliations.order,
      })
      .from(churchAffiliations)
      .innerJoin(affiliations, eq(churchAffiliations.affiliationId, affiliations.id))
      .where(
        sql`${churchAffiliations.churchId} IN (${sql.join(
          churchIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      )
      .orderBy(churchAffiliations.churchId, churchAffiliations.order)
      .all();
  }

  // Group affiliations by church
  const affiliationsByChurch = churchAffiliationData.reduce(
    (acc, item) => {
      if (!acc[item.churchId]) {
        acc[item.churchId] = [];
      }
      acc[item.churchId].push({
        id: item.affiliationId,
        name: item.affiliationName,
        website: item.affiliationWebsite,
        notes: item.affiliationPublicNotes,
      });
      return acc;
    },
    {} as Record<number, any[]>
  );

  // Combine church data with affiliations
  const churchesWithAffiliations = allChurches.map((church) => ({
    ...church,
    affiliations: affiliationsByChurch[church.id] || [],
  }));

  return c.json({
    total: churchesWithAffiliations.length,
    churches: churchesWithAffiliations,
  });
});

app.get('/churches.yaml', async (c) => {
  const db = createDb(c.env);

  // Get all churches with 'Listed' or 'Unlisted' status
  const allChurches = await db
    .select({
      id: churches.id,
      name: churches.name,
      path: churches.path,
      status: churches.status,
      lastUpdated: churches.lastUpdated,
      gatheringAddress: churches.gatheringAddress,
      latitude: churches.latitude,
      longitude: churches.longitude,
      county: counties.name,
      website: churches.website,
      statementOfFaith: churches.statementOfFaith,
      phone: churches.phone,
      email: churches.email,
      facebook: churches.facebook,
      instagram: churches.instagram,
      youtube: churches.youtube,
      spotify: churches.spotify,
      language: churches.language,
      notes: churches.publicNotes,
    })
    .from(churches)
    .leftJoin(counties, eq(churches.countyId, counties.id))
    .where(sql`${churches.status} IN ('Listed', 'Unlisted')`)
    .orderBy(churches.name)
    .all();

  // Get affiliations for each church
  const churchIds = allChurches.map((c) => c.id);
  let churchAffiliationData = [];

  if (churchIds.length > 0) {
    churchAffiliationData = await db
      .select({
        churchId: churchAffiliations.churchId,
        affiliationId: churchAffiliations.affiliationId,
        affiliationName: affiliations.name,
        affiliationWebsite: affiliations.website,
        affiliationPublicNotes: affiliations.publicNotes,
        order: churchAffiliations.order,
      })
      .from(churchAffiliations)
      .innerJoin(affiliations, eq(churchAffiliations.affiliationId, affiliations.id))
      .where(
        sql`${churchAffiliations.churchId} IN (${sql.join(
          churchIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      )
      .orderBy(churchAffiliations.churchId, churchAffiliations.order)
      .all();
  }

  // Group affiliations by church
  const affiliationsByChurch = churchAffiliationData.reduce(
    (acc, item) => {
      if (!acc[item.churchId]) {
        acc[item.churchId] = [];
      }
      const affiliation: any = {
        id: item.affiliationId,
        name: item.affiliationName,
      };
      if (item.affiliationWebsite) affiliation.website = item.affiliationWebsite;
      if (item.affiliationPublicNotes) affiliation.notes = item.affiliationPublicNotes;
      acc[item.churchId].push(affiliation);
      return acc;
    },
    {} as Record<number, any[]>
  );

  // Helper function to remove null values from objects
  const removeNulls = (obj: any): any => {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null && value !== undefined) {
        cleaned[key] = value;
      }
    }
    return cleaned;
  };

  // Combine church data with affiliations and remove nulls
  const churchesWithAffiliations = allChurches.map((church) => {
    const cleanChurch = removeNulls(church);
    cleanChurch.affiliations = affiliationsByChurch[church.id] || [];
    return cleanChurch;
  });

  const yamlData = yaml.dump({
    total: churchesWithAffiliations.length,
    churches: churchesWithAffiliations,
  });

  return c.text(yamlData, 200, {
    'Content-Type': 'text/yaml',
  });
});

app.get('/churches.csv', async (c) => {
  const db = createDb(c.env);

  // Get all churches with 'Listed' or 'Unlisted' status
  const allChurches = await db
    .select({
      id: churches.id,
      name: churches.name,
      path: churches.path,
      status: churches.status,
      lastUpdated: churches.lastUpdated,
      gatheringAddress: churches.gatheringAddress,
      latitude: churches.latitude,
      longitude: churches.longitude,
      county: counties.name,
      website: churches.website,
      statementOfFaith: churches.statementOfFaith,
      phone: churches.phone,
      email: churches.email,
      facebook: churches.facebook,
      instagram: churches.instagram,
      youtube: churches.youtube,
      spotify: churches.spotify,
      language: churches.language,
      notes: churches.publicNotes,
    })
    .from(churches)
    .leftJoin(counties, eq(churches.countyId, counties.id))
    .where(sql`${churches.status} IN ('Listed', 'Unlisted')`)
    .orderBy(churches.name)
    .all();

  // Get affiliations for each church
  const churchIds = allChurches.map((c) => c.id);
  let churchAffiliationData = [];

  if (churchIds.length > 0) {
    churchAffiliationData = await db
      .select({
        churchId: churchAffiliations.churchId,
        affiliationName: affiliations.name,
      })
      .from(churchAffiliations)
      .innerJoin(affiliations, eq(churchAffiliations.affiliationId, affiliations.id))
      .where(
        sql`${churchAffiliations.churchId} IN (${sql.join(
          churchIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      )
      .orderBy(churchAffiliations.churchId, churchAffiliations.order)
      .all();
  }

  // Group affiliations by church
  const affiliationsByChurch = churchAffiliationData.reduce(
    (acc, item) => {
      if (!acc[item.churchId]) {
        acc[item.churchId] = [];
      }
      acc[item.churchId].push(item.affiliationName);
      return acc;
    },
    {} as Record<number, string[]>
  );

  // Helper function to escape CSV values
  const escapeCSV = (value: any): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Create CSV header
  const headers = [
    'Name',
    'Status',
    'Address',
    'County',
    'Website',
    'Phone',
    'Email',
    'Affiliations',
    'Notes',
    'Last Updated',
  ];

  // Create CSV rows
  const rows = allChurches.map((church) => {
    const affiliations = affiliationsByChurch[church.id]?.join('; ') || '';
    return [
      church.name,
      church.status || '',
      church.gatheringAddress || '',
      church.county || '',
      church.website || '',
      church.phone || '',
      church.email || '',
      affiliations,
      church.notes || '',
      church.lastUpdated ? new Date(church.lastUpdated).toISOString().split('T')[0] : '',
    ].map(escapeCSV);
  });

  // Combine header and rows
  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

  return c.text(csvContent, 200, {
    'Content-Type': 'text/csv',
    'Content-Disposition': 'attachment; filename="utah-churches.csv"',
  });
});

app.get('/churches.xlsx', async (c) => {
  const db = createDb(c.env);

  // Get all churches with 'Listed' or 'Unlisted' status
  const allChurches = await db
    .select({
      id: churches.id,
      name: churches.name,
      path: churches.path,
      status: churches.status,
      lastUpdated: churches.lastUpdated,
      gatheringAddress: churches.gatheringAddress,
      latitude: churches.latitude,
      longitude: churches.longitude,
      county: counties.name,
      website: churches.website,
      statementOfFaith: churches.statementOfFaith,
      phone: churches.phone,
      email: churches.email,
      facebook: churches.facebook,
      instagram: churches.instagram,
      youtube: churches.youtube,
      spotify: churches.spotify,
      language: churches.language,
      notes: churches.publicNotes,
    })
    .from(churches)
    .leftJoin(counties, eq(churches.countyId, counties.id))
    .where(sql`${churches.status} IN ('Listed', 'Unlisted')`)
    .orderBy(churches.name)
    .all();

  // Get all counties
  const allCounties = await db
    .select({
      name: counties.name,
      path: counties.path,
      description: counties.description,
      population: counties.population,
    })
    .from(counties)
    .orderBy(counties.name)
    .all();

  // Get all listed affiliations
  const allAffiliations = await db
    .select({
      name: affiliations.name,
      status: affiliations.status,
      website: affiliations.website,
      publicNotes: affiliations.publicNotes,
    })
    .from(affiliations)
    .where(eq(affiliations.status, 'Listed'))
    .orderBy(affiliations.name)
    .all();

  // Get affiliations for each church
  const churchIds = allChurches.map((c) => c.id);
  let churchAffiliationData = [];

  if (churchIds.length > 0) {
    churchAffiliationData = await db
      .select({
        churchId: churchAffiliations.churchId,
        affiliationId: churchAffiliations.affiliationId,
        affiliationName: affiliations.name,
        order: churchAffiliations.order,
      })
      .from(churchAffiliations)
      .innerJoin(affiliations, eq(churchAffiliations.affiliationId, affiliations.id))
      .where(
        sql`${churchAffiliations.churchId} IN (${sql.join(
          churchIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      )
      .orderBy(churchAffiliations.churchId, churchAffiliations.order)
      .all();
  }

  // Group affiliations by church
  const affiliationsByChurch = churchAffiliationData.reduce(
    (acc, item) => {
      if (!acc[item.churchId]) {
        acc[item.churchId] = [];
      }
      acc[item.churchId].push(item.affiliationName);
      return acc;
    },
    {} as Record<number, string[]>
  );

  // Prepare church data for Excel
  const churchData = allChurches.map((church) => ({
    Name: church.name,
    Status: church.status || '',
    Address: church.gatheringAddress || '',
    County: church.county || '',
    Website: church.website || '',
    Phone: church.phone || '',
    Email: church.email || '',
    Affiliations: affiliationsByChurch[church.id]?.join('; ') || '',
    Facebook: church.facebook || '',
    Instagram: church.instagram || '',
    YouTube: church.youtube || '',
    Spotify: church.spotify || '',
    Notes: church.notes || '',
    'Last Updated': church.lastUpdated ? new Date(church.lastUpdated).toISOString().split('T')[0] : '',
  }));

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Add Churches sheet
  const churchesWs = XLSX.utils.json_to_sheet(churchData);

  // Set column widths for Churches sheet
  churchesWs['!cols'] = [
    { wch: 40 }, // Name
    { wch: 12 }, // Status
    { wch: 50 }, // Address
    { wch: 20 }, // County
    { wch: 35 }, // Website
    { wch: 15 }, // Phone
    { wch: 30 }, // Email
    { wch: 40 }, // Affiliations
    { wch: 25 }, // Facebook
    { wch: 25 }, // Instagram
    { wch: 25 }, // YouTube
    { wch: 25 }, // Spotify
    { wch: 50 }, // Notes
    { wch: 12 }, // Last Updated
  ];

  // Apply header styling
  const range = XLSX.utils.decode_range(churchesWs['!ref'] || 'A1');
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const address = `${XLSX.utils.encode_col(C)}1`;
    if (!churchesWs[address]) continue;
    churchesWs[address].s = {
      font: { bold: true },
      fill: { fgColor: { rgb: '2563EB' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    };
  }

  XLSX.utils.book_append_sheet(wb, churchesWs, 'Churches');

  // Add Counties sheet
  const countiesWs = XLSX.utils.json_to_sheet(allCounties);

  // Set column widths for Counties sheet
  countiesWs['!cols'] = [
    { wch: 20 }, // name
    { wch: 20 }, // path
    { wch: 50 }, // description
    { wch: 12 }, // population
  ];

  XLSX.utils.book_append_sheet(wb, countiesWs, 'Counties');

  // Add Affiliations sheet
  const affiliationsWs = XLSX.utils.json_to_sheet(allAffiliations);

  // Set column widths for Affiliations sheet
  affiliationsWs['!cols'] = [
    { wch: 40 }, // name
    { wch: 12 }, // status
    { wch: 35 }, // website
    { wch: 50 }, // publicNotes
  ];

  XLSX.utils.book_append_sheet(wb, affiliationsWs, 'Affiliations');

  // Generate buffer
  const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

  return c.body(xlsxBuffer, 200, {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': 'attachment; filename="utah-churches.xlsx"',
  });
});

app.get('/data', async (c) => {
  try {
    const db = createDb(c.env);

    // Check for admin user
    const user = await getUser(c);

    // Get count of churches with 'Listed' or 'Unlisted' status
    const churchCount = await db
      .select({
        count: sql<number>`COUNT(*)`.as('count'),
      })
      .from(churches)
      .where(sql`${churches.status} IN ('Listed', 'Unlisted')`)
      .get();

    // Get favicon URL
    const faviconUrl = await getFaviconUrl(c.env);

    // Get logo URL
    const logoUrl = await getLogoUrl(c.env);

    // Get navbar pages
    const navbarPages = await getNavbarPages(c.env);

    return c.html(
      <Layout
        title="Download Data - Utah Churches"
        currentPath="/data"
        user={user}
        faviconUrl={faviconUrl}
        logoUrl={logoUrl}
        pages={navbarPages}
      >
        <div class="bg-gray-50">
          <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div class="bg-white rounded-lg shadow-lg overflow-hidden">
              <div class="px-6 py-8 sm:p-10">
                <h1 class="text-3xl font-bold text-gray-900 mb-2">Download Church Data</h1>
                <p class="text-lg text-gray-600 mb-8">
                  Export data for {churchCount?.count || 0} evangelical churches in various formats
                </p>

                <div class="grid gap-4 grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto">
                  {/* XLSX Download */}
                  <a
                    href="/churches.xlsx"
                    class="relative group bg-white p-5 rounded-lg border-2 border-gray-200 hover:border-primary-500 transition-colors"
                  >
                    <div class="flex flex-col items-center text-center">
                      <div class="rounded-lg inline-flex p-3 bg-orange-50 text-orange-700 group-hover:bg-orange-100 mb-3">
                        <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <h3 class="text-base font-semibold text-gray-900 mb-1">Excel Format</h3>
                      <p class="text-xs text-gray-600 mb-3">
                        Multi-sheet workbook with churches, counties, and affiliations
                      </p>
                      <span class="inline-flex items-center text-sm font-medium text-primary-600 group-hover:text-primary-500">
                        Download XLSX
                        <svg class="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                      </span>
                    </div>
                  </a>

                  {/* CSV Download */}
                  <a
                    href="/churches.csv"
                    class="relative group bg-white p-5 rounded-lg border-2 border-gray-200 hover:border-primary-500 transition-colors"
                  >
                    <div class="flex flex-col items-center text-center">
                      <div class="rounded-lg inline-flex p-3 bg-green-50 text-green-700 group-hover:bg-green-100 mb-3">
                        <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <h3 class="text-base font-semibold text-gray-900 mb-1">CSV Format</h3>
                      <p class="text-xs text-gray-600 mb-3">Spreadsheet-compatible format with church details</p>
                      <span class="inline-flex items-center text-sm font-medium text-primary-600 group-hover:text-primary-500">
                        Download CSV
                        <svg class="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                      </span>
                    </div>
                  </a>

                  {/* JSON Download */}
                  <a
                    href="/churches.json"
                    class="relative group bg-white p-5 rounded-lg border-2 border-gray-200 hover:border-primary-500 transition-colors"
                  >
                    <div class="flex flex-col items-center text-center">
                      <div class="rounded-lg inline-flex p-3 bg-blue-50 text-blue-700 group-hover:bg-blue-100 mb-3">
                        <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
                          />
                        </svg>
                      </div>
                      <h3 class="text-base font-semibold text-gray-900 mb-1">JSON Format</h3>
                      <p class="text-xs text-gray-600 mb-3">Programmer-friendly format with complete data</p>
                      <span class="inline-flex items-center text-sm font-medium text-primary-600 group-hover:text-primary-500">
                        Download JSON
                        <svg class="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                      </span>
                    </div>
                  </a>

                  {/* YAML Download */}
                  <a
                    href="/churches.yaml"
                    class="relative group bg-white p-5 rounded-lg border-2 border-gray-200 hover:border-primary-500 transition-colors"
                  >
                    <div class="flex flex-col items-center text-center">
                      <div class="rounded-lg inline-flex p-3 bg-purple-50 text-purple-700 group-hover:bg-purple-100 mb-3">
                        <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                          />
                        </svg>
                      </div>
                      <h3 class="text-base font-semibold text-gray-900 mb-1">YAML Format</h3>
                      <p class="text-xs text-gray-600 mb-3">Readable format for documentation and LLMs</p>
                      <span class="inline-flex items-center text-sm font-medium text-primary-600 group-hover:text-primary-500">
                        Download YAML
                        <svg class="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                      </span>
                    </div>
                  </a>
                </div>

                <div class="mt-10 bg-blue-50 border border-blue-200 rounded-lg p-4">
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
                      <h3 class="text-sm font-medium text-blue-800">About the data</h3>
                      <div class="mt-2 text-sm text-blue-700">
                        <ul class="list-disc list-inside space-y-1">
                          <li>Data includes church details, locations, and affiliations</li>
                          <li>Updated regularly as new churches are added</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  } catch (error) {
    console.error('Error loading data page:', error);
    return c.html(
      <Layout title="Error - Utah Churches">
        <ErrorPage error={error.message || 'Failed to load data'} statusCode={500} />
      </Layout>,
      500
    );
  }
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
    return c.json({ error: error.message }, 500);
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
    const db = createDb(c.env);
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
      ipAddress: session.ipAddress,
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
      <Layout
        title="Activity Monitoring - Utah Churches"
        currentPath="/admin/monitoring"
        {...layoutProps}
      >
        <div class="min-h-screen bg-gray-50 py-8">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <MonitoringDashboard
              loginStats={loginStats}
              activityStats={activityStats}
            />
          </div>
        </div>
      </Layout>
    );
  } catch (error) {
    console.error('Error loading monitoring dashboard:', error);
    return c.html(
      <Layout title="Error - Utah Churches">
        <ErrorPage error={error.message || 'Failed to load monitoring dashboard'} statusCode={500} />
      </Layout>,
      500
    );
  }
});

// Admin routes
app.get('/admin', requireAdminBetter, async (c) => {
  const user = c.get('betterUser');
  const db = createDb(c.env);

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

  return c.html(
    <Layout
      title="Admin Dashboard - Utah Churches"
      user={user}
      currentPath="/admin"
      logoUrl={logoUrl}
      pages={navbarPages}
    >
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
                class="relative group bg-white p-6 rounded-lg shadow-sm ring-1 ring-gray-900/5 hover:ring-primary-500 transition-all"
                data-testid="card-churches"
              >
                <div>
                  <span class="rounded-lg inline-flex p-3 bg-primary-50 text-primary-700 group-hover:bg-primary-100">
                    <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                  </span>
                </div>
                <div class="mt-4">
                  <h3 class="text-lg font-medium">
                    <span class="absolute inset-0" aria-hidden="true"></span>
                    Churches ({churchCount?.count || 0})
                  </h3>
                  <p class="mt-2 text-sm text-gray-500">Add, edit, or remove church listings</p>
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
                class="relative group bg-white p-6 rounded-lg shadow-sm ring-1 ring-gray-900/5 hover:ring-primary-500 transition-all"
                data-testid="card-affiliations"
              >
                <div>
                  <span class="rounded-lg inline-flex p-3 bg-purple-50 text-purple-700 group-hover:bg-purple-100">
                    <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                  </span>
                </div>
                <div class="mt-4">
                  <h3 class="text-lg font-medium">
                    <span class="absolute inset-0" aria-hidden="true"></span>
                    Affiliations ({affiliationCount?.count || 0})
                  </h3>
                  <p class="mt-2 text-sm text-gray-500">Manage denominations and networks</p>
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
                class="relative group bg-white p-6 rounded-lg shadow-sm ring-1 ring-gray-900/5 hover:ring-primary-500 transition-all"
                data-testid="card-counties"
              >
                <div>
                  <span class="rounded-lg inline-flex p-3 bg-green-50 text-green-700 group-hover:bg-green-100">
                    <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
                      />
                    </svg>
                  </span>
                </div>
                <div class="mt-4">
                  <h3 class="text-lg font-medium">
                    <span class="absolute inset-0" aria-hidden="true"></span>
                    Counties ({countyCount?.count || 0})
                  </h3>
                  <p class="mt-2 text-sm text-gray-500">Manage Utah county information</p>
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
                class="relative group bg-white p-6 rounded-lg shadow-sm ring-1 ring-gray-900/5 hover:ring-primary-500 transition-all"
                data-testid="card-pages"
              >
                <div>
                  <span class="rounded-lg inline-flex p-3 bg-yellow-50 text-yellow-700 group-hover:bg-yellow-100">
                    <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </span>
                </div>
                <div class="mt-4">
                  <h3 class="text-lg font-medium">
                    <span class="absolute inset-0" aria-hidden="true"></span>
                    Pages ({pageCount?.count || 0})
                  </h3>
                  <p class="mt-2 text-sm text-gray-500">Manage static content pages</p>
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
                class="relative group bg-white p-6 rounded-lg shadow-sm ring-1 ring-gray-900/5 hover:ring-primary-500 transition-all"
                data-testid="card-users"
              >
                <div>
                  <span class="rounded-lg inline-flex p-3 bg-purple-50 text-purple-700 group-hover:bg-purple-100">
                    <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                  </span>
                </div>
                <div class="mt-4">
                  <h3 class="text-lg font-medium">
                    <span class="absolute inset-0" aria-hidden="true"></span>
                    Users ({userCount?.count || 0})
                  </h3>
                  <p class="mt-2 text-sm text-gray-500">Manage user accounts and permissions</p>
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
                class="relative group bg-white p-6 rounded-lg shadow-sm ring-1 ring-gray-900/5 hover:ring-primary-500 transition-all"
                data-testid="card-settings"
              >
                <div>
                  <span class="rounded-lg inline-flex p-3 bg-gray-50 text-gray-700 group-hover:bg-gray-100">
                    <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <div class="mt-4">
                  <h3 class="text-lg font-medium">
                    <span class="absolute inset-0" aria-hidden="true"></span>
                    Settings
                  </h3>
                  <p class="mt-2 text-sm text-gray-500">Configure site settings and options</p>
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
                href="/admin/monitoring"
                class="relative group bg-white p-6 rounded-lg shadow-sm ring-1 ring-gray-900/5 hover:ring-primary-500 transition-all"
                data-testid="card-monitoring"
              >
                <div>
                  <span class="rounded-lg inline-flex p-3 bg-blue-50 text-blue-700 group-hover:bg-blue-100">
                    <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                  </span>
                </div>
                <div class="mt-4">
                  <h3 class="text-lg font-medium">
                    <span class="absolute inset-0" aria-hidden="true"></span>
                    Auth Monitoring
                  </h3>
                  <p class="mt-2 text-sm text-gray-500">Monitor authentication system performance</p>
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
        </div>
      </div>
    </Layout>
  );
});

// Affiliation management routes
app.get('/admin/affiliations', requireAdminBetter, async (c) => {
  const db = createDb(c.env);
  const user = c.get('betterUser');
  const logoUrl = await getLogoUrl(c.env);

  // Get all affiliations first
  const allAffiliations = await db.select().from(affiliations).orderBy(affiliations.name).all();

  // Get church counts for each affiliation
  const churchCounts = await db
    .select({
      affiliationId: churchAffiliations.affiliationId,
      count: sql<number>`count(*)`.as('count'),
    })
    .from(churchAffiliations)
    .groupBy(churchAffiliations.affiliationId)
    .all();

  // Create a map of affiliation ID to church count
  const countMap = new Map(churchCounts.map((c) => [c.affiliationId, c.count]));

  // Add church counts to affiliations
  const affiliationsWithCounts = allAffiliations.map((aff) => ({
    ...aff,
    churchCount: countMap.get(aff.id) || 0,
  }));

  return c.html(
    <Layout title="Manage Affiliations - Utah Churches" user={user} currentPath="/admin/affiliations" logoUrl={logoUrl}>
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
                    <span class="text-gray-900">Affiliations</span>
                  </li>
                </ol>
              </nav>
              <h1 class="mt-2 text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                Manage Affiliations ({affiliationsWithCounts.length})
              </h1>
            </div>
            <div class="mt-4 flex md:mt-0 md:ml-4">
              <a
                href="/admin/affiliations/new"
                class="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                data-testid="btn-add-affiliation"
              >
                <svg class="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                Add New Affiliation
              </a>
            </div>
          </div>

          {/* Table */}
          <div class="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
            <table class="min-w-full divide-y divide-gray-300" data-testid="affiliations-table">
              <thead>
                <tr>
                  <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                    Name
                  </th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Status
                  </th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Website
                  </th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Public Notes
                  </th>
                  <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span class="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                {affiliationsWithCounts.map((affiliation, _index) => (
                  <tr class="hover:bg-gray-50 transition-colors" data-testid={`affiliation-row-${affiliation.id}`}>
                    <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                      {affiliation.name} {affiliation.churchCount > 0 && `(${affiliation.churchCount})`}
                    </td>
                    <td class="whitespace-nowrap px-3 py-4 text-sm">
                      <span
                        class={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                          affiliation.status === 'Listed'
                            ? 'bg-green-50 text-green-700 ring-green-600/20'
                            : affiliation.status === 'Unlisted'
                              ? 'bg-gray-50 text-gray-600 ring-gray-500/10'
                              : affiliation.status === 'Heretical'
                                ? 'bg-red-50 text-red-700 ring-red-600/10'
                                : 'bg-green-50 text-green-700 ring-green-600/20' // Default to Listed if not set
                        }`}
                      >
                        {affiliation.status || 'Listed'}
                      </span>
                    </td>
                    <td class="px-3 py-4 text-sm text-gray-900">
                      {affiliation.website ? (
                        <a
                          href={affiliation.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          class="text-primary-600 hover:text-primary-900 underline underline-offset-2 block truncate max-w-xs"
                          title={affiliation.website}
                        >
                          {(() => {
                            const cleanUrl = affiliation.website.replace(/^https?:\/\//, '').replace(/\/$/, '');
                            return cleanUrl.length > 40 ? `${cleanUrl.substring(0, 40)}…` : cleanUrl;
                          })()}
                        </a>
                      ) : (
                        <span class="text-gray-400">—</span>
                      )}
                    </td>
                    <td class="px-3 py-4 text-sm text-gray-600 max-w-md">
                      <div class="break-words">{affiliation.publicNotes || <span class="text-gray-400">—</span>}</div>
                    </td>
                    <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <a
                        href={`/admin/affiliations/${affiliation.id}/edit`}
                        class="text-primary-600 hover:text-primary-900 pr-2"
                        data-testid={`btn-edit-affiliation-${affiliation.id}`}
                      >
                        Edit<span class="sr-only">, {affiliation.name}</span>
                      </a>
                      <span class="text-gray-300">|</span>
                      <form method="POST" action={`/admin/affiliations/${affiliation.id}/delete`} class="inline">
                        <button
                          type="submit"
                          class="text-red-600 hover:text-red-900 pl-2"
                          onclick="return confirm('Are you sure you want to delete this affiliation?')"
                          data-testid={`btn-delete-affiliation-${affiliation.id}`}
                        >
                          Delete<span class="sr-only">, {affiliation.name}</span>
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {affiliationsWithCounts.length === 0 && (
              <div class="text-center py-12">
                <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                <h3 class="mt-2 text-sm font-semibold text-gray-900">No affiliations</h3>
                <p class="mt-1 text-sm text-gray-500">Get started by creating a new affiliation.</p>
                <div class="mt-6">
                  <a
                    href="/admin/affiliations/new"
                    class="inline-flex items-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                  >
                    <svg class="-ml-0.5 mr-1.5 h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                    </svg>
                    New Affiliation
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

// Create new affiliation
app.get('/admin/affiliations/new', requireAdminBetter, async (c) => {
  const user = c.get('betterUser');
  const logoUrl = await getLogoUrl(c.env);
  return c.html(
    <Layout title="Create Affiliation - Utah Churches" user={user} logoUrl={logoUrl}>
      <div class="bg-gray-50 py-8">
        <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="bg-white shadow sm:rounded-lg p-6">
            <AffiliationForm action="/admin/affiliations" isNew={true} />
          </div>
        </div>
      </div>
    </Layout>
  );
});

app.post('/admin/affiliations', requireAdminBetter, async (c) => {
  const db = createDb(c.env);
  const body = await c.req.parseBody();
  const user = c.get('betterUser');
  const parsedBody = parseFormBody(body);

  // Validate input
  const validation = validateFormData(affiliationSchema, parsedBody);

  if (!validation.success) {
    return c.html(
      <Layout title="Create Affiliation - Utah Churches" user={user}>
        <div class="bg-gray-50 py-8">
          <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="bg-white shadow sm:rounded-lg p-6">
              <div class="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
                <h3 class="text-lg font-medium text-red-800 mb-2">Validation Error</h3>
                <p class="text-red-700">{validation.message}</p>
              </div>
              <AffiliationForm action="/admin/affiliations" isNew={true} affiliation={parsedBody} />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const { name, path, status, website, publicNotes, privateNotes } = validation.data;

  // Generate path from name if not provided
  const finalPath =
    path ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens

  // Check if name already exists
  const existing = await db.select().from(affiliations).where(eq(affiliations.name, name)).get();
  if (existing) {
    return c.html(
      <Layout title="Create Affiliation - Utah Churches" user={user}>
        <div class="bg-gray-50 py-8">
          <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="bg-white shadow sm:rounded-lg p-6">
              <AffiliationForm
                action="/admin/affiliations"
                isNew={true}
                error="An affiliation with this name already exists"
                affiliation={{ name, path, status, website, publicNotes, privateNotes }}
              />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Check if path already exists
  const existingPath = await db.select().from(affiliations).where(eq(affiliations.path, finalPath)).get();
  if (existingPath) {
    return c.html(
      <Layout title="Create Affiliation - Utah Churches" user={user}>
        <div class="bg-gray-50 py-8">
          <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="bg-white shadow sm:rounded-lg p-6">
              <AffiliationForm
                action="/admin/affiliations"
                isNew={true}
                error="An affiliation with this URL path already exists"
                affiliation={{ name, path, status, website, publicNotes, privateNotes }}
              />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  await db.insert(affiliations).values({
    name,
    path: finalPath,
    status: status as 'Listed' | 'Unlisted' | 'Heretical',
    website: website || null,
    publicNotes: publicNotes || null,
    privateNotes: privateNotes || null,
  });

  return c.redirect('/admin/affiliations');
});

// Edit affiliation
app.get('/admin/affiliations/:id/edit', requireAdminBetter, async (c) => {
  const db = createDb(c.env);
  const id = c.req.param('id');
  const user = c.get('betterUser');
  const logoUrl = await getLogoUrl(c.env);

  const affiliation = await db
    .select()
    .from(affiliations)
    .where(eq(affiliations.id, Number(id)))
    .get();

  if (!affiliation) {
    return c.redirect('/admin/affiliations');
  }

  // Get churches affiliated with this affiliation
  const affiliatedChurches = await db
    .select({
      id: churches.id,
      name: churches.name,
      status: churches.status,
      countyName: counties.name,
    })
    .from(churches)
    .innerJoin(churchAffiliations, eq(churches.id, churchAffiliations.churchId))
    .leftJoin(counties, eq(churches.countyId, counties.id))
    .where(eq(churchAffiliations.affiliationId, Number(id)))
    .orderBy(churches.name)
    .all();

  // Get all churches for the checkbox list
  const allChurches = await db
    .select({
      id: churches.id,
      name: churches.name,
      status: churches.status,
      countyName: counties.name,
    })
    .from(churches)
    .leftJoin(counties, eq(churches.countyId, counties.id))
    .orderBy(churches.name)
    .all();

  return c.html(
    <Layout title="Edit Affiliation - Utah Churches" user={user} logoUrl={logoUrl}>
      <div class="bg-gray-50 py-8">
        <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="bg-white shadow sm:rounded-lg p-6">
            <AffiliationForm
              action={`/admin/affiliations/${id}`}
              affiliation={affiliation}
              affiliatedChurches={affiliatedChurches}
              allChurches={allChurches}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
});

app.post('/admin/affiliations/:id', requireAdminBetter, async (c) => {
  const db = createDb(c.env);
  const id = c.req.param('id');

  // Get form data directly to handle multiple checkbox values
  const formData = await c.req.formData();

  // Convert FormData to object, handling multiple values
  const body: Record<string, any> = {};
  const selectedChurches: number[] = [];

  for (const [key, value] of formData.entries()) {
    if (key === 'churches') {
      // Collect all church selections
      selectedChurches.push(Number(value.toString()));
    } else if (body[key]) {
      // If key already exists, convert to array
      if (!Array.isArray(body[key])) {
        body[key] = [body[key]];
      }
      body[key].push(value.toString());
    } else {
      body[key] = value.toString();
    }
  }

  const parsedBody = parseFormBody(body);

  // Validate input
  const validation = validateFormData(affiliationSchema, parsedBody);
  if (!validation.success) {
    return c.redirect(`/admin/affiliations/${id}/edit`);
  }

  const { name, path, status, website, publicNotes, privateNotes } = validation.data;

  // Generate path from name if not provided
  const finalPath =
    path ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens

  // Check if path already exists (excluding current affiliation)
  const existingPath = await db
    .select()
    .from(affiliations)
    .where(sql`${affiliations.path} = ${finalPath} AND ${affiliations.id} != ${Number(id)}`)
    .get();

  if (existingPath) {
    return c.redirect(`/admin/affiliations/${id}/edit`);
  }

  // Update affiliation details
  await db
    .update(affiliations)
    .set({
      name,
      path: finalPath,
      status: status as 'Listed' | 'Unlisted' | 'Heretical',
      website: website || null,
      publicNotes: publicNotes || null,
      privateNotes: privateNotes || null,
      updatedAt: new Date(),
    })
    .where(eq(affiliations.id, Number(id)));

  // Get current church associations
  const currentAssociations = await db
    .select({ churchId: churchAffiliations.churchId })
    .from(churchAffiliations)
    .where(eq(churchAffiliations.affiliationId, Number(id)))
    .all();

  const currentChurchIds = currentAssociations.map((a) => a.churchId);

  // Find churches to add and remove
  const churchesToAdd = selectedChurches.filter((churchId) => !currentChurchIds.includes(churchId));
  const churchesToRemove = currentChurchIds.filter((churchId) => !selectedChurches.includes(churchId));

  // Remove unselected churches
  if (churchesToRemove.length > 0) {
    await db.delete(churchAffiliations).where(
      sql`${churchAffiliations.affiliationId} = ${Number(id)} AND ${churchAffiliations.churchId} IN (${sql.join(
        churchesToRemove.map((id) => sql`${id}`),
        sql`, `
      )})`
    );
  }

  // Add newly selected churches
  for (const churchId of churchesToAdd) {
    // Get the next order value for this church
    const maxOrder = await db
      .select({ maxOrder: sql<number>`COALESCE(MAX(${churchAffiliations.order}), 0)` })
      .from(churchAffiliations)
      .where(eq(churchAffiliations.churchId, churchId))
      .get();

    await db.insert(churchAffiliations).values({
      churchId,
      affiliationId: Number(id),
      order: (maxOrder?.maxOrder || 0) + 1,
    });
  }

  return c.redirect('/admin/affiliations');
});

// Delete affiliation
app.post('/admin/affiliations/:id/delete', requireAdminBetter, async (c) => {
  const db = createDb(c.env);
  const id = c.req.param('id');

  // TODO: Check if any churches are using this affiliation before deleting
  await db.delete(affiliations).where(eq(affiliations.id, Number(id)));

  return c.redirect('/admin/affiliations');
});

// Church management routes
app.get('/admin/churches', requireAdminBetter, async (c) => {
  try {
    const db = createDb(c.env);
    const user = c.get('betterUser');
    const logoUrl = await getLogoUrl(c.env);
    const allChurches = await db
      .select({
        id: churches.id,
        name: churches.name,
        path: churches.path,
        status: churches.status,
        gatheringAddress: churches.gatheringAddress,
        countyName: counties.name,
        lastUpdated: churches.lastUpdated,
      })
      .from(churches)
      .leftJoin(counties, eq(churches.countyId, counties.id))
      .orderBy(churches.name)
      .all();

    const statusStyles: Record<string, string> = {
      Listed: 'bg-green-50 text-green-700 ring-green-600/20',
      'Ready to list': 'bg-blue-50 text-blue-700 ring-blue-600/20',
      Assess: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
      'Needs data': 'bg-orange-50 text-orange-700 ring-orange-600/20',
      Unlisted: 'bg-gray-50 text-gray-700 ring-gray-600/20',
      Heretical: 'bg-red-50 text-red-700 ring-red-600/20',
      Closed: 'bg-gray-800 text-white ring-gray-800',
    };

    return c.html(
      <Layout title="Manage Churches - Utah Churches" user={user} logoUrl={logoUrl}>
        <style
          dangerouslySetInnerHTML={{
            __html: `
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .animate-spin {
            animation: spin 1s linear infinite;
          }
        `,
          }}
        />
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
                      <span class="text-gray-900">Churches</span>
                    </li>
                  </ol>
                </nav>
                <h1 class="mt-2 text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">Manage Churches</h1>
              </div>
              <div class="mt-4 flex md:mt-0 md:ml-4">
                <a
                  href="/admin/churches/new"
                  class="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  data-testid="btn-add-church"
                >
                  <svg class="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                  Add Church
                </a>
              </div>
            </div>

            {/* Sorting controls */}
            <div class="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div class="text-sm text-gray-700 mb-2 sm:mb-0">
                {allChurches.length} {allChurches.length === 1 ? 'church' : 'churches'}
              </div>
              <div class="flex items-center space-x-2">
                <span class="text-sm text-gray-700 font-medium" style="min-width: 50px;">
                  Sort by:
                </span>
                <div class="inline-flex rounded-md shadow-sm" role="group">
                  <button
                    type="button"
                    id="sort-name"
                    class="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 border border-primary-600 rounded-l-md hover:bg-primary-700 focus:z-10 focus:ring-2 focus:ring-primary-500"
                    onclick="sortChurches('name')"
                    data-testid="btn-sort-name"
                  >
                    Name
                  </button>
                  <button
                    type="button"
                    id="sort-updated"
                    class="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border-t border-b border-gray-300 hover:bg-gray-50 focus:z-10 focus:ring-2 focus:ring-primary-500"
                    onclick="sortChurches('updated-desc')"
                    data-testid="btn-sort-updated"
                  >
                    Recently Updated
                  </button>
                  <button
                    type="button"
                    id="sort-oldest"
                    class="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-r-md hover:bg-gray-50 focus:z-10 focus:ring-2 focus:ring-primary-500"
                    onclick="sortChurches('updated-asc')"
                    data-testid="btn-sort-oldest"
                  >
                    Needs Update
                  </button>
                </div>
              </div>
            </div>

            {/* Table */}
            <div class="bg-white shadow overflow-hidden sm:rounded-md">
              <table class="min-w-full divide-y divide-gray-200" data-testid="churches-table">
                <thead class="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Church
                    </th>
                    <th
                      scope="col"
                      class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Location
                    </th>
                    <th scope="col" class="relative px-6 py-3">
                      <span class="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  {allChurches.map((church) => (
                    <tr
                      class="church-row hover:bg-gray-50 transition-all duration-300"
                      id={`church-row-${church.id}`}
                      data-name={church.name}
                      data-updated={church.lastUpdated ? new Date(church.lastUpdated).getTime() : 0}
                      data-testid={`church-row-${church.id}`}
                    >
                      <td class="px-6 py-4">
                        <div>
                          <div class="text-sm font-medium text-gray-900 church-name">{church.name}</div>
                          {church.path && <div class="text-sm text-gray-500">/{church.path}</div>}
                        </div>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        {church.status ? (
                          <span
                            class={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${statusStyles[church.status] || ''}`}
                          >
                            {church.status}
                          </span>
                        ) : (
                          <span class="text-gray-400">-</span>
                        )}
                      </td>
                      <td class="px-6 py-4">
                        <div class="text-sm text-gray-900">
                          {church.gatheringAddress || <span class="text-gray-400">No address</span>}
                        </div>
                        {church.countyName && <div class="text-sm text-gray-500">{church.countyName} County</div>}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <a
                          href={`/admin/churches/${church.id}/edit`}
                          class="text-primary-600 hover:text-primary-900 mr-4"
                          data-testid={`btn-edit-church-${church.id}`}
                        >
                          Edit
                        </a>
                        <form
                          method="POST"
                          action={`/admin/churches/${church.id}/delete`}
                          class="inline"
                          id={`delete-form-${church.id}`}
                        >
                          <button
                            type="submit"
                            class="text-red-600 hover:text-red-900 delete-btn"
                            data-church-id={church.id}
                            data-testid={`btn-delete-church-${church.id}`}
                            onclick={`
                            event.preventDefault();
                            if (!confirm('Are you sure you want to delete this church?')) return false;
                            
                            // Show loading state
                            this.disabled = true;
                            const originalText = this.innerHTML;
                            this.innerHTML = '<svg class="animate-spin h-4 w-4 text-red-600 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
                            
                            // Fade out the row
                            const row = document.getElementById('church-row-${church.id}');
                            row.style.opacity = '0.5';
                            row.style.transform = 'translateX(-10px)';
                            
                            // Add strikethrough to the name
                            row.querySelector('.church-name').style.textDecoration = 'line-through';
                            
                            // Disable edit link
                            const editLink = row.querySelector('a[href*="edit"]');
                            if (editLink) {
                              editLink.style.pointerEvents = 'none';
                              editLink.style.opacity = '0.5';
                            }
                            
                            // Submit the form
                            document.getElementById('delete-form-${church.id}').submit();
                          `}
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

        {/* Sorting Script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
            function sortChurches(sortBy) {
              const tbody = document.querySelector('tbody');
              const rows = Array.from(document.querySelectorAll('.church-row'));
              
              // Update button styles
              const nameBtn = document.getElementById('sort-name');
              const updatedBtn = document.getElementById('sort-updated');
              const oldestBtn = document.getElementById('sort-oldest');
              
              // Define button classes
              const baseClasses = 'px-3 py-1.5 text-sm font-medium focus:z-10 focus:ring-2 focus:ring-primary-500';
              const activeClasses = 'text-white bg-primary-600 border-primary-600 hover:bg-primary-700';
              const inactiveClasses = 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50';
              
              // Reset all buttons
              nameBtn.className = baseClasses + ' ' + inactiveClasses + ' rounded-l-md border';
              updatedBtn.className = baseClasses + ' ' + inactiveClasses + ' border-t border-b';
              oldestBtn.className = baseClasses + ' ' + inactiveClasses + ' rounded-r-md border';
              
              // Sort and style based on selection
              if (sortBy === 'name') {
                nameBtn.className = baseClasses + ' ' + activeClasses + ' rounded-l-md border';
                
                // Sort by name
                rows.sort((a, b) => {
                  const nameA = a.dataset.name || '';
                  const nameB = b.dataset.name || '';
                  return nameA.toLowerCase().localeCompare(nameB.toLowerCase());
                });
              } else if (sortBy === 'updated-desc') {
                updatedBtn.className = baseClasses + ' ' + activeClasses + ' border';
                
                // Sort by updated date (descending - most recent first)
                rows.sort((a, b) => {
                  const updatedA = parseInt(a.dataset.updated) || 0;
                  const updatedB = parseInt(b.dataset.updated) || 0;
                  return updatedB - updatedA;
                });
              } else if (sortBy === 'updated-asc') {
                oldestBtn.className = baseClasses + ' ' + activeClasses + ' rounded-r-md border';
                
                // Sort by updated date (ascending - oldest first)
                rows.sort((a, b) => {
                  const updatedA = parseInt(a.dataset.updated) || 0;
                  const updatedB = parseInt(b.dataset.updated) || 0;
                  return updatedA - updatedB;
                });
              }
              
              // Clear tbody and re-append rows in new order
              tbody.innerHTML = '';
              rows.forEach(row => tbody.appendChild(row));
              
              // Update aria-checked attributes
              const group = nameBtn.parentElement;
              group.querySelectorAll('button').forEach(btn => {
                btn.setAttribute('aria-checked', btn.classList.contains('bg-primary-600') ? 'true' : 'false');
              });
            }
            
            // Check URL parameters on page load
            document.addEventListener('DOMContentLoaded', function() {
              const urlParams = new URLSearchParams(window.location.search);
              const sortParam = urlParams.get('sort');
              
              if (sortParam === 'oldest') {
                sortChurches('updated-asc');
              } else if (sortParam === 'recent') {
                sortChurches('updated-desc');
              } else if (sortParam === 'name') {
                sortChurches('name');
              }
            });
          `,
          }}
        />
      </Layout>
    );
  } catch (error) {
    console.error('Error loading churches:', error);
    return c.html(
      <Layout title="Error - Utah Churches" user={user}>
        <ErrorPage error={error.message || 'Failed to load churches'} statusCode={500} />
      </Layout>,
      500
    );
  }
});

// Create new church
app.get('/admin/churches/new', requireAdminBetter, async (c) => {
  const db = createDb(c.env);
  const user = c.get('betterUser');
  const logoUrl = await getLogoUrl(c.env);
  const allAffiliations = await db.select().from(affiliations).orderBy(affiliations.name).all();

  const allCounties = await db.select().from(counties).orderBy(counties.name).all();

  return c.html(
    <Layout title="Create Church - Utah Churches" user={user} logoUrl={logoUrl}>
      <div class="bg-gray-50">
        <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                <a href="/admin/churches" class="text-gray-500 hover:text-gray-700">
                  Churches
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
          <ChurchForm action="/admin/churches" isNew={true} affiliations={allAffiliations} counties={allCounties} />
        </div>
      </div>
    </Layout>
  );
});

app.post('/admin/churches', requireAdminBetter, async (c) => {
  try {
    const db = createDb(c.env);
    // Get form data directly to handle multiple checkbox values
    const formData = await c.req.formData();

    // Convert FormData to a regular object, handling multiple values
    const body: Record<string, any> = {};
    for (const [key, value] of formData.entries()) {
      if (key === 'affiliations') {
        // Handle affiliations specially - get all values
        if (!body.affiliations) body.affiliations = [];
        body.affiliations.push(value.toString());
      } else if (body[key]) {
        // If key already exists, convert to array
        if (!Array.isArray(body[key])) {
          body[key] = [body[key]];
        }
        body[key].push(value.toString());
      } else {
        body[key] = value.toString();
      }
    }

    const parsedBody = parseFormBody(body);

    // Parse complex form data
    const gatherings = parseGatheringsFromForm(parsedBody);
    const affiliations = parseAffiliationsFromForm(parsedBody);
    const churchData = prepareChurchDataFromForm(parsedBody);

    // Validate input
    const validation = validateFormData(churchWithGatheringsSchema, {
      church: churchData,
      gatherings,
      affiliations,
    });

    if (!validation.success) {
      // Return a more user-friendly error response
      return c.html(
        <Layout title="Error - Utah Churches">
          <div class="max-w-2xl mx-auto px-4 py-8">
            <div class="bg-red-50 border border-red-200 rounded-md p-4">
              <h3 class="text-lg font-medium text-red-800 mb-2">Validation Error</h3>
              <p class="text-red-700 mb-4">{validation.message}</p>
              <ul class="text-sm text-red-600 space-y-1">
                {Object.entries(validation.errors).map(([field, errors]) => (
                  <li key={field}>
                    <strong>{field}:</strong> {errors.join(', ')}
                  </li>
                ))}
              </ul>
              <div class="mt-4">
                <a href="/admin/churches/new" class="text-red-800 hover:text-red-900 font-medium">
                  ← Go back and try again
                </a>
              </div>
            </div>
          </div>
        </Layout>,
        400
      );
    }

    const {
      church: validatedChurchData,
      gatherings: validatedGatherings,
      affiliations: selectedAffiliations,
    } = validation.data;

    // Create church (without single image fields)
    const result = await db
      .insert(churches)
      .values({
        ...validatedChurchData,
        lastUpdated: new Date(),
      })
      .returning({ id: churches.id });
    const churchId = result[0].id;

    // Handle multiple image uploads
    const churchImagesFiles = body.churchImages;
    const images = Array.isArray(churchImagesFiles) ? churchImagesFiles : churchImagesFiles ? [churchImagesFiles] : [];

    let displayOrder = 0;
    for (const imageFile of images) {
      if (imageFile instanceof File && imageFile.size > 0) {
        try {
          const uploadResult = await uploadToCloudflareImages(
            imageFile,
            c.env.CLOUDFLARE_ACCOUNT_ID,
            c.env.CLOUDFLARE_IMAGES_API_TOKEN
          );

          if (uploadResult.success && uploadResult.result) {
            const imageId = uploadResult.result.id;
            const imageUrl = getCloudflareImageUrl(imageId, c.env.CLOUDFLARE_ACCOUNT_HASH, IMAGE_VARIANTS.LARGE);

            await db.insert(churchImages).values({
              churchId,
              imageId,
              imageUrl,
              displayOrder: displayOrder++,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        } catch (error) {
          console.error('Image upload error:', error);
        }
      }
    }

    // Insert gatherings
    for (const gathering of validatedGatherings) {
      await db.insert(churchGatherings).values({
        churchId,
        time: gathering.time,
        notes: gathering.notes || null,
      });
    }

    // Insert affiliations
    for (let i = 0; i < selectedAffiliations.length; i++) {
      await db.insert(churchAffiliations).values({
        churchId,
        affiliationId: selectedAffiliations[i],
        order: i + 1,
      });
    }

    return c.redirect('/admin/churches');
  } catch (error) {
    console.error('Error creating church:', error);
    return c.text(`Error creating church: ${error.message}`, 500);
  }
});

// Edit church
app.get('/admin/churches/:id/edit', requireAdminBetter, async (c) => {
  const db = createDb(c.env);
  const user = c.get('betterUser');
  const logoUrl = await getLogoUrl(c.env);
  const id = c.req.param('id');

  const church = await db
    .select()
    .from(churches)
    .where(eq(churches.id, Number(id)))
    .get();
  if (!church) {
    return c.redirect('/admin/churches');
  }

  const allAffiliations = await db.select().from(affiliations).orderBy(affiliations.name).all();

  const allCounties = await db.select().from(counties).orderBy(counties.name).all();

  const currentAffiliations = await db
    .select()
    .from(churchAffiliations)
    .where(eq(churchAffiliations.churchId, Number(id)))
    .all();

  const currentGatherings = await db
    .select()
    .from(churchGatherings)
    .where(eq(churchGatherings.churchId, Number(id)))
    .orderBy(churchGatherings.id)
    .all();

  const currentImages = await db
    .select()
    .from(churchImages)
    .where(eq(churchImages.churchId, Number(id)))
    .orderBy(churchImages.displayOrder)
    .all();

  return c.html(
    <Layout title="Edit Church - Utah Churches" user={user} logoUrl={logoUrl}>
      <div class="bg-gray-50">
        <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                <a href="/admin/churches" class="text-gray-500 hover:text-gray-700">
                  Churches
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
          <ChurchForm
            action={`/admin/churches/${id}`}
            church={church}
            gatherings={currentGatherings}
            affiliations={allAffiliations}
            counties={allCounties}
            churchAffiliations={currentAffiliations}
            images={currentImages}
          />
        </div>
      </div>
    </Layout>
  );
});

app.post('/admin/churches/:id', requireAdminBetter, async (c) => {
  try {
    const db = createDb(c.env);
    const id = c.req.param('id');
    // Get form data directly to handle multiple checkbox values
    const formData = await c.req.formData();

    // Convert FormData to a regular object, handling multiple values
    const body: Record<string, any> = {};
    for (const [key, value] of formData.entries()) {
      if (key === 'affiliations') {
        // Handle affiliations specially - get all values
        if (!body.affiliations) body.affiliations = [];
        body.affiliations.push(value.toString());
      } else if (body[key]) {
        // If key already exists, convert to array
        if (!Array.isArray(body[key])) {
          body[key] = [body[key]];
        }
        body[key].push(value.toString());
      } else {
        body[key] = value.toString();
      }
    }

    const parsedBody = parseFormBody(body);

    // Parse complex form data
    const gatherings = parseGatheringsFromForm(parsedBody);
    const affiliations = parseAffiliationsFromForm(parsedBody);
    const churchData = prepareChurchDataFromForm(parsedBody);

    // Validate input
    const validationResult = churchWithGatheringsSchema.safeParse({
      church: churchData,
      gatherings,
      affiliations,
    });

    if (!validationResult.success) {
      const errors = validationResult.error.flatten();
      return c.text(`Validation error: ${JSON.stringify(errors)}`, 400);
    }

    const {
      church: validatedChurchData,
      gatherings: validatedGatherings,
      affiliations: selectedAffiliations,
    } = validationResult.data;

    // Update church (remove single image fields from church data)
    await db
      .update(churches)
      .set({
        ...validatedChurchData,
        lastUpdated: new Date(),
      })
      .where(eq(churches.id, Number(id)));

    // Handle existing images updates (captions, order, deletions)
    let imageIndex = 0;
    while (body[`existingImages[${imageIndex}][id]`]) {
      const imageId = Number(body[`existingImages[${imageIndex}][id]`]);
      const shouldDelete = body[`existingImages[${imageIndex}][delete]`] === 'true';
      const caption = body[`existingImages[${imageIndex}][caption]`] as string;
      const order = Number(body[`existingImages[${imageIndex}][order]`]);

      if (shouldDelete) {
        // Get image details for deletion
        const image = await db.select().from(churchImages).where(eq(churchImages.id, imageId)).get();

        if (image) {
          // Delete from Cloudflare
          try {
            await deleteFromCloudflareImages(
              image.imageId,
              c.env.CLOUDFLARE_ACCOUNT_ID,
              c.env.CLOUDFLARE_IMAGES_API_TOKEN
            );
          } catch (error) {
            console.error('Failed to delete image from Cloudflare:', error);
          }

          // Delete from database
          await db.delete(churchImages).where(eq(churchImages.id, imageId));
        }
      } else {
        // Update caption and order
        await db
          .update(churchImages)
          .set({
            caption: caption || null,
            displayOrder: order,
            updatedAt: new Date(),
          })
          .where(eq(churchImages.id, imageId));
      }

      imageIndex++;
    }

    // Handle new image uploads
    const churchImagesFiles = body.churchImages;
    const newImages = Array.isArray(churchImagesFiles)
      ? churchImagesFiles
      : churchImagesFiles
        ? [churchImagesFiles]
        : [];

    // Get current max display order
    const maxOrderResult = await db
      .select({ maxOrder: sql<number>`MAX(display_order)` })
      .from(churchImages)
      .where(eq(churchImages.churchId, Number(id)))
      .get();

    let nextOrder = (maxOrderResult?.maxOrder || 0) + 1;

    for (const imageFile of newImages) {
      if (imageFile instanceof File && imageFile.size > 0) {
        try {
          const uploadResult = await uploadToCloudflareImages(
            imageFile,
            c.env.CLOUDFLARE_ACCOUNT_ID,
            c.env.CLOUDFLARE_IMAGES_API_TOKEN
          );

          if (uploadResult.success && uploadResult.result) {
            const imageId = uploadResult.result.id;
            const imageUrl = getCloudflareImageUrl(imageId, c.env.CLOUDFLARE_ACCOUNT_HASH, IMAGE_VARIANTS.LARGE);

            await db.insert(churchImages).values({
              churchId: Number(id),
              imageId,
              imageUrl,
              displayOrder: nextOrder++,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        } catch (error) {
          console.error('Image upload error:', error);
        }
      }
    }

    // Update gatherings
    // First, delete existing gatherings
    await db.delete(churchGatherings).where(eq(churchGatherings.churchId, Number(id)));

    // Then insert new ones
    for (const gathering of validatedGatherings) {
      await db.insert(churchGatherings).values({
        churchId: Number(id),
        time: gathering.time,
        notes: gathering.notes || null,
      });
    }

    // Update affiliations
    // First, delete existing affiliations
    await db.delete(churchAffiliations).where(eq(churchAffiliations.churchId, Number(id)));

    // Then insert new ones
    for (let i = 0; i < selectedAffiliations.length; i++) {
      await db.insert(churchAffiliations).values({
        churchId: Number(id),
        affiliationId: selectedAffiliations[i],
        order: i + 1,
      });
    }

    // Check if "Save and continue" was clicked
    if (body.continue === 'true') {
      // Find the next church with the oldest update date (excluding the current church)
      const nextChurch = await db
        .select({
          id: churches.id,
        })
        .from(churches)
        .where(sql`(${churches.status} != 'Closed' OR ${churches.status} IS NULL) AND ${churches.id} != ${Number(id)}`)
        .orderBy(sql`${churches.lastUpdated} ASC NULLS FIRST`)
        .limit(1)
        .get();

      if (nextChurch) {
        return c.redirect(`/admin/churches/${nextChurch.id}/edit`);
      }
    }

    return c.redirect(validatedChurchData.path ? `/churches/${validatedChurchData.path}` : '/admin/churches');
  } catch (error) {
    console.error('Error updating church:', error);
    return c.text(`Error updating church: ${error.message}`, 500);
  }
});

// Delete church
app.post('/admin/churches/:id/delete', requireAdminBetter, async (c) => {
  try {
    const db = createDb(c.env);
    const id = c.req.param('id');

    // Get all church images for deletion
    const images = await db
      .select()
      .from(churchImages)
      .where(eq(churchImages.churchId, Number(id)))
      .all();

    // Delete all images from Cloudflare
    for (const image of images) {
      try {
        await deleteFromCloudflareImages(image.imageId, c.env.CLOUDFLARE_ACCOUNT_ID, c.env.CLOUDFLARE_IMAGES_API_TOKEN);
      } catch (error) {
        console.error('Failed to delete church image:', error);
      }
    }

    // Delete related data first
    await db.delete(churchAffiliations).where(eq(churchAffiliations.churchId, Number(id)));
    await db.delete(churchGatherings).where(eq(churchGatherings.churchId, Number(id)));
    await db.delete(churchImages).where(eq(churchImages.churchId, Number(id)));

    // Then delete the church
    await db.delete(churches).where(eq(churches.id, Number(id)));

    return c.redirect('/admin/churches');
  } catch (error) {
    console.error('Error deleting church:', error);
    return c.redirect('/admin/churches?error=delete_failed');
  }
});

// Extract church data from website
app.post('/admin/churches/:id/extract', requireAdminBetter, async (c) => {
  try {
    const body = await c.req.parseBody();
    const websiteUrl = body.websiteUrl as string;

    if (!websiteUrl) {
      return c.json({ error: 'Website URL is required' }, 400);
    }

    // Extract data using AI
    const extractedData = await extractChurchDataFromWebsite(websiteUrl, c.env.OPENROUTER_API_KEY);

    // Format the response to include which fields were extracted
    const response = {
      extracted: extractedData,
      fields: {
        phone: !!extractedData.phone,
        email: !!extractedData.email,
        address: !!extractedData.address,
        gatheringTimes: !!extractedData.service_times?.length,
        instagram: !!extractedData.instagram,
        facebook: !!extractedData.facebook,
        spotify: !!extractedData.spotify,
        youtube: !!extractedData.youtube,
        statementOfFaithUrl: !!extractedData.statement_of_faith_url,
      },
    };

    return c.json(response);
  } catch (error) {
    console.error('Extraction error:', error);
    return c.json({ error: error.message || 'Failed to extract data' }, 500);
  }
});

// County management routes
app.get('/admin/counties', requireAdminBetter, async (c) => {
  const db = createDb(c.env);
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
                      <form method="POST" action={`/admin/counties/${county.id}/delete`} class="inline">
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

  const db = createDb(c.env);
  const path = c.req.param('path');
  
  // Get church by path
  const church = await db
    .select()
    .from(churches)
    .where(eq(churches.path, path))
    .get();

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
  const db = createDb(c.env);
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
          <CountyForm action="/admin/counties" isNew={true} county={parsedBody} />
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
            county={{ name, description, population }}
          />
        </div>
      </Layout>
    );
  }

  await db.insert(counties).values({
    name,
    path: path || null,
    description: description || null,
    population,
  });

  return c.redirect('/admin/counties');
});

// Edit county
app.get('/admin/counties/:id/edit', requireAdminBetter, async (c) => {
  const db = createDb(c.env);
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
  const db = createDb(c.env);
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

  return c.redirect('/admin/counties');
});

// Delete county
app.post('/admin/counties/:id/delete', requireAdminBetter, async (c) => {
  const db = createDb(c.env);
  const id = c.req.param('id');

  // TODO: Check if any churches are using this county before deleting
  await db.delete(counties).where(eq(counties.id, Number(id)));

  return c.redirect('/admin/counties');
});

// Pages routes
app.get('/admin/pages', requireAdminBetter, async (c) => {
  const db = createDb(c.env);
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
                      <form method="POST" action={`/admin/pages/${page.id}/delete`} class="inline">
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
  const db = createDb(c.env);
  const body = await c.req.parseBody();

  const title = (body.title as string)?.trim();
  const path = (body.path as string)?.trim();
  const content = body.content as string;
  const navbarOrder = body.navbarOrder ? parseInt(body.navbarOrder as string) : null;

  const result = pageSchema.safeParse({ title, path, content });
  if (!result.success) {
    return c.text(result.error.errors[0].message, 400);
  }

  let featuredImageId = null;
  let featuredImageUrl = null;

  // Handle image upload
  const featuredImage = body.featuredImage as File;
  if (featuredImage && featuredImage.size > 0) {
    try {
      console.log('Cloudflare Account ID:', c.env.CLOUDFLARE_ACCOUNT_ID);
      console.log('Has API Token:', !!c.env.CLOUDFLARE_IMAGES_API_TOKEN);

      const uploadResult = await uploadToCloudflareImages(
        featuredImage,
        c.env.CLOUDFLARE_ACCOUNT_ID,
        c.env.CLOUDFLARE_IMAGES_API_TOKEN
      );

      if (uploadResult.success && uploadResult.result) {
        featuredImageId = uploadResult.result.id;
        featuredImageUrl = getCloudflareImageUrl(featuredImageId, c.env.CLOUDFLARE_ACCOUNT_HASH, IMAGE_VARIANTS.LARGE);
      } else {
        console.error('Image upload failed:', uploadResult.errors);
        return c.text('Failed to upload image', 500);
      }
    } catch (error) {
      console.error('Image upload error:', error);
      return c.text('Error uploading image', 500);
    }
  }

  const pageData = {
    title,
    path,
    content: content || null,
    featuredImageId,
    featuredImageUrl,
    navbarOrder,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.insert(pages).values(pageData);

  return c.redirect('/admin/pages');
});

app.get('/admin/pages/:id/edit', requireAdminBetter, async (c) => {
  const db = createDb(c.env);
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
  const db = createDb(c.env);
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

  let featuredImageId = currentPage?.featuredImageId;
  let featuredImageUrl = currentPage?.featuredImageUrl;

  // Handle image upload
  const featuredImage = body.featuredImage as File;
  if (featuredImage && featuredImage.size > 0) {
    try {
      // Delete old image if exists
      if (currentPage?.featuredImageId) {
        await deleteFromCloudflareImages(
          currentPage.featuredImageId,
          c.env.CLOUDFLARE_ACCOUNT_ID,
          c.env.CLOUDFLARE_IMAGES_API_TOKEN
        );
      }

      const uploadResult = await uploadToCloudflareImages(
        featuredImage,
        c.env.CLOUDFLARE_ACCOUNT_ID,
        c.env.CLOUDFLARE_IMAGES_API_TOKEN
      );

      if (uploadResult.success && uploadResult.result) {
        featuredImageId = uploadResult.result.id;
        featuredImageUrl = getCloudflareImageUrl(featuredImageId, c.env.CLOUDFLARE_ACCOUNT_HASH, IMAGE_VARIANTS.LARGE);
      } else {
        console.error('Image upload failed:', uploadResult.errors);
        return c.text('Failed to upload image', 500);
      }
    } catch (error) {
      console.error('Image upload error:', error);
      return c.text('Error uploading image', 500);
    }
  }

  const pageData = {
    title,
    path,
    content: content || null,
    featuredImageId,
    featuredImageUrl,
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
  const db = createDb(c.env);
  const id = c.req.param('id');

  // Get page to check for image
  const page = await db
    .select()
    .from(pages)
    .where(eq(pages.id, Number(id)))
    .get();

  // Delete image from Cloudflare if exists
  if (page?.featuredImageId) {
    try {
      await deleteFromCloudflareImages(
        page.featuredImageId,
        c.env.CLOUDFLARE_ACCOUNT_ID,
        c.env.CLOUDFLARE_IMAGES_API_TOKEN
      );
    } catch (error) {
      console.error('Failed to delete image:', error);
    }
  }

  await db.delete(pages).where(eq(pages.id, Number(id)));

  return c.redirect('/admin/pages');
});

// Settings routes
app.get('/admin/settings', requireAdminBetter, async (c) => {
  const db = createDb(c.env);
  const user = c.get('betterUser');

  // Get layout props
  const layoutProps = await getLayoutProps(c);

  // Get current settings
  const siteTitle = await db.select().from(settings).where(eq(settings.key, 'site_title')).get();

  const tagline = await db.select().from(settings).where(eq(settings.key, 'tagline')).get();

  const frontPageTitle = await db.select().from(settings).where(eq(settings.key, 'front_page_title')).get();

  const faviconUrl = await db.select().from(settings).where(eq(settings.key, 'favicon_url')).get();

  const logoUrlSetting = await db.select().from(settings).where(eq(settings.key, 'logo_url')).get();

  return c.html(
    <Layout 
      title="Settings - Utah Churches" 
      user={user}
      faviconUrl={layoutProps.faviconUrl}
      logoUrl={layoutProps.logoUrl}
      pages={layoutProps.pages}
    >
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
            faviconUrl={faviconUrl?.value || undefined}
            logoUrl={logoUrlSetting?.value || undefined}
          />
        </div>
      </div>
    </Layout>
  );
});

app.post('/admin/settings', requireAdminBetter, async (c) => {
  const db = createDb(c.env);
  const body = await c.req.parseBody();

  const siteTitle = (body.siteTitle as string)?.trim();
  const tagline = (body.tagline as string)?.trim();
  const frontPageTitle = (body.frontPageTitle as string)?.trim();

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

  // Handle favicon upload
  const favicon = body.favicon as File;
  if (favicon && favicon.size > 0) {
    try {
      // Get current favicon to delete if exists
      const existingFaviconId = await db.select().from(settings).where(eq(settings.key, 'favicon_id')).get();

      // Delete old favicon if exists
      if (existingFaviconId?.value) {
        await deleteFromCloudflareImages(
          existingFaviconId.value,
          c.env.CLOUDFLARE_ACCOUNT_ID,
          c.env.CLOUDFLARE_IMAGES_API_TOKEN
        );
      }

      const uploadResult = await uploadToCloudflareImages(
        favicon,
        c.env.CLOUDFLARE_ACCOUNT_ID,
        c.env.CLOUDFLARE_IMAGES_API_TOKEN
      );

      if (uploadResult.success && uploadResult.result) {
        const faviconId = uploadResult.result.id;
        const faviconUrl = getCloudflareImageUrl(faviconId, c.env.CLOUDFLARE_ACCOUNT_HASH, IMAGE_VARIANTS.FAVICON);

        // Save favicon ID
        const existingFaviconIdSetting = await db.select().from(settings).where(eq(settings.key, 'favicon_id')).get();

        if (existingFaviconIdSetting) {
          await db
            .update(settings)
            .set({ value: faviconId, updatedAt: new Date() })
            .where(eq(settings.key, 'favicon_id'));
        } else {
          await db.insert(settings).values({
            key: 'favicon_id',
            value: faviconId,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }

        // Save favicon URL
        const existingFaviconUrl = await db.select().from(settings).where(eq(settings.key, 'favicon_url')).get();

        if (existingFaviconUrl) {
          await db
            .update(settings)
            .set({ value: faviconUrl, updatedAt: new Date() })
            .where(eq(settings.key, 'favicon_url'));
        } else {
          await db.insert(settings).values({
            key: 'favicon_url',
            value: faviconUrl,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }
    } catch (error) {
      console.error('Favicon upload error:', error);
    }
  }

  // Handle logo upload
  const logo = body.logo as File;
  if (logo && logo.size > 0) {
    try {
      // Get current logo to delete if exists
      const existingLogoId = await db.select().from(settings).where(eq(settings.key, 'logo_id')).get();

      // Delete old logo if exists
      if (existingLogoId?.value) {
        await deleteFromCloudflareImages(
          existingLogoId.value,
          c.env.CLOUDFLARE_ACCOUNT_ID,
          c.env.CLOUDFLARE_IMAGES_API_TOKEN
        );
      }

      const uploadResult = await uploadToCloudflareImages(
        logo,
        c.env.CLOUDFLARE_ACCOUNT_ID,
        c.env.CLOUDFLARE_IMAGES_API_TOKEN
      );

      if (uploadResult.success && uploadResult.result) {
        const logoId = uploadResult.result.id;
        const logoUrl = getCloudflareImageUrl(logoId, c.env.CLOUDFLARE_ACCOUNT_HASH, IMAGE_VARIANTS.SMALL);

        // Save logo ID
        const existingLogoIdSetting = await db.select().from(settings).where(eq(settings.key, 'logo_id')).get();

        if (existingLogoIdSetting) {
          await db.update(settings).set({ value: logoId, updatedAt: new Date() }).where(eq(settings.key, 'logo_id'));
        } else {
          await db.insert(settings).values({
            key: 'logo_id',
            value: logoId,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }

        // Save logo URL
        const existingLogoUrl = await db.select().from(settings).where(eq(settings.key, 'logo_url')).get();

        if (existingLogoUrl) {
          await db.update(settings).set({ value: logoUrl, updatedAt: new Date() }).where(eq(settings.key, 'logo_url'));
        } else {
          await db.insert(settings).values({
            key: 'logo_url',
            value: logoUrl,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }
    } catch (error) {
      console.error('Logo upload error:', error);
    }
  }

  return c.redirect('/admin/settings');
});

// 404 catch-all route
app.get('*', async (c) => {
  const path = c.req.path;

  // Check if this might be a bare slug (no slashes except at start)
  if (path.startsWith('/') && !path.includes('/', 1) && path.length > 1) {
    const slug = path.substring(1);
    const db = createDb(c.env);

    // Check for user session
    const user = await getUser(c);

    // Get favicon URL and logo URL
    const faviconUrl = await getFaviconUrl(c.env);
    const logoUrl = await getLogoUrl(c.env);

    // Get navbar pages
    const navbarPages = await getNavbarPages(c.env);

    // First check if it's a page
    const page = await db.select().from(pages).where(eq(pages.path, slug)).get();

    if (page) {
      // Render the page content
      return c.html(
        <Layout
          title={`${page.title} - Utah Churches`}
          user={user}
          faviconUrl={faviconUrl}
          logoUrl={logoUrl}
          pages={navbarPages}
          currentPath={`/${slug}`}
        >
          <div class="bg-white">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
              <div class="max-w-3xl mx-auto">
                <h1 class="text-3xl font-bold text-gray-900 mb-8">{page.title}</h1>
                <div class="prose prose-lg max-w-none" dangerouslySetInnerHTML={{ __html: page.content || '' }} />
                {page.featuredImageUrl && (
                  <div class="mt-12 border-t pt-8">
                    <img src={page.featuredImageUrl} alt={page.title} class="w-full rounded-lg shadow-lg" />
                  </div>
                )}
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

export default app;
