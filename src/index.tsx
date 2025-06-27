import bcrypt from 'bcryptjs';
import { eq, sql, desc } from 'drizzle-orm';
import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { cors } from 'hono/cors';
import yaml from 'js-yaml';
import * as XLSX from 'xlsx';
import { AffiliationForm } from './components/AffiliationForm';
import { ChurchCard } from './components/ChurchCard';
import { ChurchForm } from './components/ChurchForm';
import { CountyForm } from './components/CountyForm';
import { ErrorPage } from './components/ErrorPage';
import { Layout } from './components/Layout';
import { LoginForm } from './components/LoginForm';
import { NotFound } from './components/NotFound';
import { UserForm } from './components/UserForm';
import { createDb } from './db';
import { affiliations, churchAffiliations, churches, churchGatherings, counties, users } from './db/schema';
import { adminMiddleware } from './middleware/auth';
import { requireAdminMiddleware } from './middleware/requireAdmin';
import { createSession, deleteSession, validateSession, verifyPassword } from './utils/auth';
import {
  affiliationSchema,
  churchWithGatheringsSchema,
  countySchema,
  loginSchema,
  parseAffiliationsFromForm,
  parseFormBody,
  parseGatheringsFromForm,
  prepareChurchDataFromForm,
  userSchema,
  validateFormData,
} from './utils/validation';

type Bindings = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  GOOGLE_MAPS_API_KEY: string;
};

type Variables = {
  user: any;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use('/api/*', cors());

// Smart redirect middleware for church pages
app.use('/*', async (c, next) => {
  await next();
  
  // Only handle 404s for paths that might be church slugs
  if (c.res.status === 404) {
    const path = c.req.path;
    
    // Check if path looks like a church slug (no slashes except at start)
    if (path.startsWith('/') && !path.includes('/', 1) && path.length > 1) {
      const churchPath = path.substring(1); // Remove leading slash
      
      // Check if this might be a church path
      const db = createDb(c.env);
      const church = await db
        .select({ id: churches.id })
        .from(churches)
        .where(eq(churches.path, churchPath))
        .get();
      
      if (church) {
        // Redirect to the correct church URL
        return c.redirect(`/churches/${churchPath}`, 301);
      }
    }
  }
});

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

app.get('/', async (c) => {
  try {
    const db = createDb(c.env);
    
    // Check for user session
    let user = null;
    const sessionId = getCookie(c, 'session');
    if (sessionId) {
      user = await validateSession(sessionId, c.env);
    }

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
      <Layout currentPath="/" user={user}>
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
  const sessionId = getCookie(c, 'session');
  const user = await validateSession(sessionId, c.env);

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

  return c.html(
    <Layout title={`${county.name} Churches - Utah Churches`} user={user}>
      <div>
        {/* Header */}
        <div class="bg-gradient-to-r from-primary-600 to-primary-700">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="py-12 md:py-16">
              <div class="md:flex md:items-center md:justify-between">
                <div class="flex-1 min-w-0">
                  <h1 class="text-4xl font-bold text-white md:text-5xl">{county.name}</h1>
                  <p class="mt-4 text-xl text-primary-100">
                    {listedChurches.length + unlistedChurches.length}{' '}
                    {listedChurches.length + unlistedChurches.length === 1 ? 'church' : 'churches'}
                  </p>
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

        {/* Edit button for logged-in users */}
        {user && (
          <div class="border-t border-gray-200 mt-12 pt-8">
            <div class="flex justify-center">
              <a
                href={`/admin/counties/${county.id}/edit`}
                class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <svg class="mr-2 -ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Edit County
              </a>
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
  let user = null;
  const sessionId = getCookie(c, 'session');
  if (sessionId) {
    user = await validateSession(sessionId, c.env);
  }

  // Get all listed affiliations with church count
  const listedAffiliations = await db
    .select({
      id: affiliations.id,
      name: affiliations.name,
      website: affiliations.website,
      publicNotes: affiliations.publicNotes,
      churchCount: sql<number>`COUNT(DISTINCT ${churchAffiliations.churchId})`.as('churchCount'),
    })
    .from(affiliations)
    .leftJoin(churchAffiliations, eq(affiliations.id, churchAffiliations.affiliationId))
    .where(eq(affiliations.status, 'Listed'))
    .groupBy(affiliations.id)
    .having(sql`COUNT(DISTINCT ${churchAffiliations.churchId}) > 0`)
    .orderBy(affiliations.name)
    .all();

  return c.html(
    <Layout title="Church Networks - Utah Churches" currentPath="/networks" user={user}>
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

app.get('/churches/:path', async (c) => {
  const db = createDb(c.env);
  const churchPath = c.req.param('path');

  // Check for admin session (optional)
  const sessionId = getCookie(c, 'session');
  let user = null;
  if (sessionId) {
    user = await validateSession(sessionId, c.env);
  }

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
      name: affiliations.name,
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

  // Build JSON-LD structured data
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
  };

  return c.html(
    <Layout title={`${church.name} - Utah Churches`} jsonLd={jsonLd} user={user} churchId={church.id}>
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
                        <h3 class="text-base font-medium text-gray-500">Services</h3>
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
                        <a href={`mailto:${church.email}`} class="mt-1 text-base text-primary-600 hover:text-primary-500">
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
                              {affiliation.website ? (
                                <a
                                  href={affiliation.website}
                                  rel="noopener noreferrer"
                                  class="text-primary-600 hover:text-primary-500"
                                >
                                  {affiliation.name}
                                </a>
                              ) : (
                                <span class="text-gray-900">{affiliation.name}</span>
                              )}
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
              </div>
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
});

app.get('/networks/:id', async (c) => {
  const db = createDb(c.env);
  const affiliationId = c.req.param('id');

  // Check for user session
  let user = null;
  const sessionId = getCookie(c, 'session');
  if (sessionId) {
    user = await validateSession(sessionId, c.env);
  }

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

  // Get affiliation details
  const affiliation = await db
    .select()
    .from(affiliations)
    .where(eq(affiliations.id, Number(affiliationId)))
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
      sql`${churchAffiliations.affiliationId} = ${affiliationId} AND (${churches.status} = 'Listed' OR ${churches.status} = 'Unlisted')`
    )
    .orderBy(churches.name)
    .all();

  // Separate listed and unlisted churches
  const listedChurches = affiliationChurches.filter((c) => c.status === 'Listed');
  const unlistedChurches = affiliationChurches.filter((c) => c.status === 'Unlisted');

  return c.html(
    <Layout title={`${affiliation.name} - Utah Churches`} user={user}>
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
                    <ChurchCard church={church} />
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
                    <ChurchCard church={church} />
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

  // Check for user session
  let user = null;
  const sessionId = getCookie(c, 'session');
  if (sessionId) {
    user = await validateSession(sessionId, c.env);
  }

  // Get all churches with coordinates (excluding heretical)
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
      status: churches.status,
      language: churches.language,
      publicNotes: churches.publicNotes,
    })
    .from(churches)
    .leftJoin(counties, eq(churches.countyId, counties.id))
    .where(
      sql`${churches.latitude} IS NOT NULL AND ${churches.longitude} IS NOT NULL AND ${churches.status} != 'Heretical'`
    )
    .all();

  // Separate listed and unlisted churches
  const listedChurches = allChurchesWithCoords.filter((c) => c.status === 'Listed');
  const unlistedChurches = allChurchesWithCoords.filter((c) => c.status === 'Unlisted');

  return c.html(
    <Layout title="Church Map - Utah Churches" currentPath="/map" user={user}>
      <div>
        {/* Map Container */}
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div class="bg-white rounded-lg shadow-lg overflow-hidden">
            <div id="map" class="w-full h-[calc(100vh-280px)] min-h-[400px] max-h-[600px]"></div>
          </div>

          <div class="mt-4 space-y-3">
            {/* Checkbox for unlisted churches */}
            <div class="bg-white border border-gray-200 rounded-lg p-3">
              <label class="flex items-center cursor-pointer">
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
        let listedMarkers = [];
        let unlistedMarkers = [];
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
          
          // Set up checkbox listener
          document.getElementById('showUnlisted').addEventListener('change', function(e) {
            const show = e.target.checked;
            const countSpan = document.getElementById('church-count');
            
            if (show) {
              // Show unlisted markers
              unlistedMarkers.forEach(marker => marker.map = map);
              countSpan.textContent = listedChurches.length + unlistedChurches.length;
            } else {
              // Hide unlisted markers
              unlistedMarkers.forEach(marker => marker.map = null);
              countSpan.textContent = listedChurches.length;
            }
          });
          
          // Try to get user location
          loadLocation();
        }
        
        function createInfoContent(church) {
          const content = document.createElement('div');
          content.style.maxWidth = '350px';
          content.style.lineHeight = '1.5';
          
          content.innerHTML = \`
            <h3 style="margin: 0 0 0.5rem 0; font-size: 1.125rem; font-weight: 600;">\${church.name}</h3>
            \${church.gatheringAddress ? \`<div style="margin-bottom: 0.5rem;">📍 \${church.gatheringAddress}</div>\` : ''}
            \${church.countyName ? \`<div style="margin-bottom: 0.5rem; color: #718096;">📌 \${church.countyName} County</div>\` : ''}
            \${church.website ? \`<div style="margin-bottom: 0.5rem;"><a href="\${church.website}" target="_blank" style="color: #4299e1;">Website</a></div>\` : ''}
            \${church.publicNotes ? \`<div style="margin-top: 0.5rem; font-style: italic; color: #718096;">\${church.publicNotes}</div>\` : ''}
            \${church.path ? \`<div style="margin-top: 0.5rem;"><a href="/churches/\${church.path}" style="color: #4299e1;">View Details →</a></div>\` : ''}
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

  // Get all churches with their public fields and county names (excluding heretical)
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
    .where(sql`${churches.status} != 'Heretical' OR ${churches.status} IS NULL`)
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

  // Get all churches with their public fields and county names (excluding heretical)
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
    .where(sql`${churches.status} != 'Heretical' OR ${churches.status} IS NULL`)
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

  // Get all churches with their public fields and county names (excluding heretical)
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
    .where(sql`${churches.status} != 'Heretical' OR ${churches.status} IS NULL`)
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

  // Get all churches (excluding heretical)
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
    .where(sql`${churches.status} != 'Heretical' OR ${churches.status} IS NULL`)
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

    // Get count of churches (excluding heretical)
    const churchCount = await db
      .select({
        count: sql<number>`COUNT(*)`.as('count'),
      })
      .from(churches)
      .where(sql`${churches.status} != 'Heretical' OR ${churches.status} IS NULL`)
      .get();

    return c.html(
      <Layout title="Download Data - Utah Churches" currentPath="/data">
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

// Login routes
app.get('/login', async (c) => {
  // If already logged in, redirect to admin
  const sessionId = getCookie(c, 'session');
  if (sessionId) {
    const user = await validateSession(sessionId, c.env);
    if (user) {
      return c.redirect('/admin');
    }
  }

  return c.html(
    <Layout title="Login - Utah Churches">
      <LoginForm />
    </Layout>
  );
});

app.post('/login', async (c) => {
  const db = createDb(c.env);
  const body = await c.req.parseBody();

  // Validate input
  const validation = validateFormData(loginSchema, parseFormBody(body));

  if (!validation.success) {
    return c.html(
      <Layout title="Login - Utah Churches">
        <LoginForm error={validation.message} />
      </Layout>
    );
  }

  const { username, password } = validation.data;

  // Find user
  const user = await db.select().from(users).where(eq(users.username, username)).get();

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return c.html(
      <Layout title="Login - Utah Churches">
        <LoginForm error="Invalid username or password" />
      </Layout>
    );
  }

  // Create session
  const sessionId = await createSession(user.id, c.env);

  // Set cookie
  setCookie(c, 'session', sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  // Always redirect to /admin after login
  return c.redirect('/admin');
});

app.get('/logout', async (c) => {
  const sessionId = getCookie(c, 'session');

  if (sessionId) {
    await deleteSession(sessionId, c.env);
    deleteCookie(c, 'session');
  }

  return c.redirect('/');
});

// Admin routes
app.get('/admin', adminMiddleware, async (c) => {
  const user = c.get('user');
  const db = createDb(c.env);

  // Get statistics using COUNT for efficiency
  const churchCount = await db.select({ count: sql<number>`COUNT(*)` }).from(churches).get();
  const countyCount = await db.select({ count: sql<number>`COUNT(*)` }).from(counties).get();
  const affiliationCount = await db.select({ count: sql<number>`COUNT(*)` }).from(affiliations).get();
  const userCount = await db.select({ count: sql<number>`COUNT(*)` }).from(users).get();

  // Get 3 oldest non-closed churches for review
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
    .limit(3)
    .all();

  return c.html(
    <Layout title="Admin Dashboard - Utah Churches" user={user} currentPath="/admin">
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
                  <p class="text-sm text-gray-600 mt-1">Churches that haven't been updated recently</p>
                </div>
              </div>

              <div class="space-y-3">
                {churchesForReview.map((church) => (
                  <div class="bg-white rounded-lg shadow-sm ring-1 ring-gray-900/5 overflow-hidden" data-testid={`church-review-${church.id}`}>
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
                <a href="/admin/churches?sort=oldest" class="text-sm font-medium text-primary-600 hover:text-primary-500">
                  View all churches needing review →
                </a>
              </div>
            </div>
          )}

          {/* Manage */}
          <div class="mb-8" data-testid="manage-section">
            <h2 class="text-lg leading-6 font-medium text-gray-900 mb-4">Manage</h2>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                  href="/admin/users"
                  class="relative group bg-white p-6 rounded-lg shadow-sm ring-1 ring-gray-900/5 hover:ring-primary-500 transition-all"
                  data-testid="card-users"
                >
                  <div>
                    <span class="rounded-lg inline-flex p-3 bg-indigo-50 text-indigo-700 group-hover:bg-indigo-100">
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
                    <p class="mt-2 text-sm text-gray-500">Manage admin access and permissions</p>
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

// Admin user management routes
app.get('/admin/users', requireAdminMiddleware, async (c) => {
  const db = createDb(c.env);
  const user = c.get('user');
  const allUsers = await db.select().from(users).all();

  return c.html(
    <Layout title="Manage Users - Utah Churches" user={user}>
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
                    <span class="text-gray-900">Users</span>
                  </li>
                </ol>
              </nav>
              <h1 class="mt-2 text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">Manage Users</h1>
            </div>
            <div class="mt-4 flex md:mt-0 md:ml-4">
              <a
                href="/admin/users/new"
                class="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                data-testid="btn-add-user"
              >
                <svg class="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                Add New User
              </a>
            </div>
          </div>

          {/* Table */}
          <div class="bg-white shadow overflow-hidden sm:rounded-md">
            <table class="min-w-full divide-y divide-gray-200" data-testid="users-table">
              <thead class="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    User
                  </th>
                  <th
                    scope="col"
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Type
                  </th>
                  <th
                    scope="col"
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Created
                  </th>
                  <th scope="col" class="relative px-6 py-3">
                    <span class="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                {allUsers.map((user) => (
                  <tr class="hover:bg-gray-50" data-testid={`user-row-${user.id}`}>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div class="text-sm font-medium text-gray-900">{user.username}</div>
                        <div class="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span
                        class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.userType === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {user.userType}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <a href={`/admin/users/${user.id}/edit`} class="text-primary-600 hover:text-primary-900 mr-4" data-testid={`btn-edit-user-${user.id}`}>
                        Edit
                      </a>
                      {user.username !== 'admin' && (
                        <form method="POST" action={`/admin/users/${user.id}/delete`} class="inline">
                          <button
                            type="submit"
                            class="text-red-600 hover:text-red-900"
                            onclick="return confirm('Are you sure you want to delete this user?')"
                            data-testid={`btn-delete-user-${user.id}`}
                          >
                            Delete
                          </button>
                        </form>
                      )}
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

// Create new user
app.get('/admin/users/new', requireAdminMiddleware, async (c) => {
  return c.html(
    <Layout title="Create User - Utah Churches">
      <div style="max-width: 600px; margin: 0 auto;">
        <UserForm action="/admin/users" isNew={true} />
      </div>
    </Layout>
  );
});

app.post('/admin/users', requireAdminMiddleware, async (c) => {
  const db = createDb(c.env);
  const body = await c.req.parseBody();
  const parsedBody = parseFormBody(body);

  // Validate input
  const validation = validateFormData(userSchema, parsedBody);

  if (!validation.success) {
    return c.html(
      <Layout title="Create User - Utah Churches">
        <div style="max-width: 600px; margin: 0 auto;">
          <UserForm action="/admin/users" isNew={true} error={validation.message} user={parsedBody} />
        </div>
      </Layout>
    );
  }

  const { username, email, password, userType } = validation.data;

  // Check if username already exists
  const existing = await db.select().from(users).where(eq(users.username, username)).get();
  if (existing) {
    return c.html(
      <Layout title="Create User - Utah Churches">
        <div style="max-width: 600px; margin: 0 auto;">
          <UserForm
            action="/admin/users"
            isNew={true}
            error="Username already exists"
            user={{ username, email, userType }}
          />
        </div>
      </Layout>
    );
  }

  // Hash password and create user
  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(users).values({
    username,
    email,
    passwordHash,
    userType: userType as 'admin' | 'contributor',
  });

  return c.redirect('/admin/users');
});

// Edit user
app.get('/admin/users/:id/edit', requireAdminMiddleware, async (c) => {
  const db = createDb(c.env);
  const id = c.req.param('id');
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, Number(id)))
    .get();

  if (!user) {
    return c.redirect('/admin/users');
  }

  // Check if this is the only admin user
  let isOnlyAdmin = false;
  if (user.userType === 'admin') {
    const adminCount = await db.select().from(users).where(eq(users.userType, 'admin')).all();
    isOnlyAdmin = adminCount.length === 1;
  }

  return c.html(
    <Layout title="Edit User - Utah Churches">
      <div style="max-width: 600px; margin: 0 auto;">
        <UserForm action={`/admin/users/${id}`} user={user} isOnlyAdmin={isOnlyAdmin} />
      </div>
    </Layout>
  );
});

app.post('/admin/users/:id', requireAdminMiddleware, async (c) => {
  const db = createDb(c.env);
  const id = c.req.param('id');
  const body = await c.req.parseBody();

  const email = body.email as string;
  const userType = body.userType as string;
  const password = body.password as string;

  // Get the current user
  const currentUser = await db
    .select()
    .from(users)
    .where(eq(users.id, Number(id)))
    .get();
  if (!currentUser) {
    return c.redirect('/admin/users');
  }

  // Check if trying to change the only admin to contributor
  if (currentUser.userType === 'admin' && userType !== 'admin') {
    const adminCount = await db.select().from(users).where(eq(users.userType, 'admin')).all();

    if (adminCount.length === 1) {
      // This is the only admin, don't allow changing to contributor
      return c.redirect('/admin/users');
    }
  }

  const updateData: any = {
    email,
    userType: userType as 'admin' | 'contributor',
  };

  // Only update password if provided
  if (password && password.length >= 6) {
    updateData.passwordHash = await bcrypt.hash(password, 10);
  }

  await db
    .update(users)
    .set(updateData)
    .where(eq(users.id, Number(id)));

  return c.redirect('/admin/users');
});

// Delete user
app.post('/admin/users/:id/delete', requireAdminMiddleware, async (c) => {
  const db = createDb(c.env);
  const id = c.req.param('id');

  // Don't allow deleting the admin user
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, Number(id)))
    .get();
  if (user && user.username !== 'admin') {
    await db.delete(users).where(eq(users.id, Number(id)));
  }

  return c.redirect('/admin/users');
});

// Affiliation management routes
app.get('/admin/affiliations', adminMiddleware, async (c) => {
  const db = createDb(c.env);
  const user = c.get('user');

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
    <Layout title="Manage Affiliations - Utah Churches" user={user}>
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
app.get('/admin/affiliations/new', adminMiddleware, async (c) => {
  const user = c.get('user');
  return c.html(
    <Layout title="Create Affiliation - Utah Churches" user={user}>
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

app.post('/admin/affiliations', adminMiddleware, async (c) => {
  const db = createDb(c.env);
  const body = await c.req.parseBody();
  const user = c.get('user');
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

  const { name, status, website, publicNotes, privateNotes } = validation.data;

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
                affiliation={{ name, status, website, publicNotes, privateNotes }}
              />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  await db.insert(affiliations).values({
    name,
    status: status as 'Listed' | 'Unlisted' | 'Heretical',
    website: website || null,
    publicNotes: publicNotes || null,
    privateNotes: privateNotes || null,
  });

  return c.redirect('/admin/affiliations');
});

// Edit affiliation
app.get('/admin/affiliations/:id/edit', adminMiddleware, async (c) => {
  const db = createDb(c.env);
  const id = c.req.param('id');
  const user = c.get('user');
  const affiliation = await db
    .select()
    .from(affiliations)
    .where(eq(affiliations.id, Number(id)))
    .get();

  if (!affiliation) {
    return c.redirect('/admin/affiliations');
  }

  return c.html(
    <Layout title="Edit Affiliation - Utah Churches" user={user}>
      <div class="bg-gray-50 py-8">
        <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="bg-white shadow sm:rounded-lg p-6">
            <AffiliationForm action={`/admin/affiliations/${id}`} affiliation={affiliation} />
          </div>
        </div>
      </div>
    </Layout>
  );
});

app.post('/admin/affiliations/:id', adminMiddleware, async (c) => {
  const db = createDb(c.env);
  const id = c.req.param('id');
  const body = await c.req.parseBody();

  const name = body.name as string;
  const status = body.status as string;
  const website = body.website as string;
  const publicNotes = body.publicNotes as string;
  const privateNotes = body.privateNotes as string;

  await db
    .update(affiliations)
    .set({
      name,
      status: status as 'Listed' | 'Unlisted' | 'Heretical',
      website: website || null,
      publicNotes: publicNotes || null,
      privateNotes: privateNotes || null,
      updatedAt: new Date(),
    })
    .where(eq(affiliations.id, Number(id)));

  return c.redirect('/admin/affiliations');
});

// Delete affiliation
app.post('/admin/affiliations/:id/delete', adminMiddleware, async (c) => {
  const db = createDb(c.env);
  const id = c.req.param('id');

  // TODO: Check if any churches are using this affiliation before deleting
  await db.delete(affiliations).where(eq(affiliations.id, Number(id)));

  return c.redirect('/admin/affiliations');
});

// Church management routes
app.get('/admin/churches', adminMiddleware, async (c) => {
  try {
    const db = createDb(c.env);
    const user = c.get('user');
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
      <Layout title="Manage Churches - Utah Churches" user={user}>
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
                <span class="text-sm text-gray-700">Sort by:</span>
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
                      data-updated={church.lastUpdated || 0}
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
              
              // Reset all buttons to default style
              [nameBtn, updatedBtn, oldestBtn].forEach(btn => {
                btn.className = 'px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 focus:z-10 focus:ring-2 focus:ring-primary-500';
              });
              
              // Style the active button
              if (sortBy === 'name') {
                nameBtn.className = 'px-3 py-1.5 text-sm font-medium text-white bg-primary-600 border border-primary-600 rounded-l-md hover:bg-primary-700 focus:z-10 focus:ring-2 focus:ring-primary-500';
                updatedBtn.className = 'px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border-t border-b border-gray-300 hover:bg-gray-50 focus:z-10 focus:ring-2 focus:ring-primary-500';
                oldestBtn.className = 'px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-r-md hover:bg-gray-50 focus:z-10 focus:ring-2 focus:ring-primary-500';
                
                // Sort by name
                rows.sort((a, b) => {
                  const nameA = a.dataset.name.toLowerCase();
                  const nameB = b.dataset.name.toLowerCase();
                  return nameA.localeCompare(nameB);
                });
              } else if (sortBy === 'updated-desc') {
                updatedBtn.className = 'px-3 py-1.5 text-sm font-medium text-white bg-primary-600 border border-primary-600 hover:bg-primary-700 focus:z-10 focus:ring-2 focus:ring-primary-500';
                nameBtn.className = 'px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-l-md hover:bg-gray-50 focus:z-10 focus:ring-2 focus:ring-primary-500';
                oldestBtn.className = 'px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-r-md hover:bg-gray-50 focus:z-10 focus:ring-2 focus:ring-primary-500';
                
                // Sort by updated date (descending - most recent first)
                rows.sort((a, b) => {
                  const updatedA = parseInt(a.dataset.updated) || 0;
                  const updatedB = parseInt(b.dataset.updated) || 0;
                  return updatedB - updatedA;
                });
              } else if (sortBy === 'updated-asc') {
                oldestBtn.className = 'px-3 py-1.5 text-sm font-medium text-white bg-primary-600 border border-primary-600 rounded-r-md hover:bg-primary-700 focus:z-10 focus:ring-2 focus:ring-primary-500';
                nameBtn.className = 'px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-l-md hover:bg-gray-50 focus:z-10 focus:ring-2 focus:ring-primary-500';
                updatedBtn.className = 'px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border-t border-b border-gray-300 hover:bg-gray-50 focus:z-10 focus:ring-2 focus:ring-primary-500';
                
                // Sort by updated date (ascending - oldest first)
                rows.sort((a, b) => {
                  const updatedA = parseInt(a.dataset.updated) || 0;
                  const updatedB = parseInt(b.dataset.updated) || 0;
                  return updatedA - updatedB;
                });
              }
              
              // Re-append rows in new order
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
app.get('/admin/churches/new', adminMiddleware, async (c) => {
  const db = createDb(c.env);
  const user = c.get('user');
  const allAffiliations = await db.select().from(affiliations).orderBy(affiliations.name).all();

  const allCounties = await db.select().from(counties).orderBy(counties.name).all();

  return c.html(
    <Layout title="Create Church - Utah Churches" user={user}>
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

app.post('/admin/churches', adminMiddleware, async (c) => {
  try {
    const db = createDb(c.env);
    const body = await c.req.parseBody();
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

    // Create church
    const result = await db
      .insert(churches)
      .values({
        ...validatedChurchData,
        lastUpdated: new Date(),
      })
      .returning({ id: churches.id });
    const churchId = result[0].id;

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
app.get('/admin/churches/:id/edit', adminMiddleware, async (c) => {
  const db = createDb(c.env);
  const user = c.get('user');
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

  return c.html(
    <Layout title="Edit Church - Utah Churches" user={user}>
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
          />
        </div>
      </div>
    </Layout>
  );
});

app.post('/admin/churches/:id', adminMiddleware, async (c) => {
  try {
    const db = createDb(c.env);
    const id = c.req.param('id');
    const body = await c.req.parseBody();

    // Parse gatherings from form data
    const gatherings = [];
    let index = 0;
    while (body[`gatherings[${index}][time]`]) {
      gatherings.push({
        time: body[`gatherings[${index}][time]`] as string,
        notes: (body[`gatherings[${index}][notes]`] as string) || undefined,
      });
      index++;
    }

    // Validate input
    const validationResult = churchWithGatheringsSchema.safeParse({
      church: {
        name: body.name as string,
        path: (body.path as string) || undefined,
        status: (body.status as string) || undefined,
        gatheringAddress: (body.gatheringAddress as string) || undefined,
        latitude: body.latitude ? parseFloat(body.latitude as string) : undefined,
        longitude: body.longitude ? parseFloat(body.longitude as string) : undefined,
        countyId: body.countyId ? Number(body.countyId) : undefined,
        website: (body.website as string) || undefined,
        statementOfFaith: (body.statementOfFaith as string) || undefined,
        phone: (body.phone as string) || undefined,
        email: (body.email as string) || undefined,
        facebook: (body.facebook as string) || undefined,
        instagram: (body.instagram as string) || undefined,
        youtube: (body.youtube as string) || undefined,
        spotify: (body.spotify as string) || undefined,
        language: (body.language as string) || 'English',
        privateNotes: (body.privateNotes as string) || undefined,
        publicNotes: (body.publicNotes as string) || undefined,
      },
      gatherings,
      affiliations: body.affiliations
        ? Array.isArray(body.affiliations)
          ? body.affiliations.map(Number)
          : [Number(body.affiliations)]
        : [],
    });

    if (!validationResult.success) {
      const errors = validationResult.error.flatten();
      return c.text(`Validation error: ${JSON.stringify(errors)}`, 400);
    }

    const {
      church: churchData,
      gatherings: validatedGatherings,
      affiliations: selectedAffiliations,
    } = validationResult.data;

    // Update church
    await db
      .update(churches)
      .set({
        ...churchData,
        lastUpdated: new Date(),
      })
      .where(eq(churches.id, Number(id)));

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

    return c.redirect('/admin/churches');
  } catch (error) {
    console.error('Error updating church:', error);
    return c.text(`Error updating church: ${error.message}`, 500);
  }
});

// Delete church
app.post('/admin/churches/:id/delete', adminMiddleware, async (c) => {
  try {
    const db = createDb(c.env);
    const id = c.req.param('id');

    // Delete related data first
    await db.delete(churchAffiliations).where(eq(churchAffiliations.churchId, Number(id)));
    await db.delete(churchGatherings).where(eq(churchGatherings.churchId, Number(id)));

    // Then delete the church
    await db.delete(churches).where(eq(churches.id, Number(id)));

    return c.redirect('/admin/churches');
  } catch (error) {
    console.error('Error deleting church:', error);
    return c.redirect('/admin/churches?error=delete_failed');
  }
});

// County management routes
app.get('/admin/counties', adminMiddleware, async (c) => {
  const db = createDb(c.env);
  const user = c.get('user');
  const allCounties = await db.select().from(counties).orderBy(counties.name).all();

  return c.html(
    <Layout title="Manage Counties - Utah Churches" user={user}>
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

// Create new county
app.get('/admin/counties/new', adminMiddleware, async (c) => {
  const user = c.get('user');
  return c.html(
    <Layout title="Create County - Utah Churches" user={user}>
      <div style="max-width: 600px; margin: 0 auto;">
        <CountyForm action="/admin/counties" isNew={true} />
      </div>
    </Layout>
  );
});

app.post('/admin/counties', adminMiddleware, async (c) => {
  const db = createDb(c.env);
  const body = await c.req.parseBody();
  const user = c.get('user');
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
app.get('/admin/counties/:id/edit', adminMiddleware, async (c) => {
  const db = createDb(c.env);
  const id = c.req.param('id');
  const user = c.get('user');
  const county = await db
    .select()
    .from(counties)
    .where(eq(counties.id, Number(id)))
    .get();

  if (!county) {
    return c.redirect('/admin/counties');
  }

  return c.html(
    <Layout title="Edit County - Utah Churches" user={user}>
      <div style="max-width: 600px; margin: 0 auto;">
        <CountyForm action={`/admin/counties/${id}`} county={county} />
      </div>
    </Layout>
  );
});

app.post('/admin/counties/:id', adminMiddleware, async (c) => {
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
app.post('/admin/counties/:id/delete', adminMiddleware, async (c) => {
  const db = createDb(c.env);
  const id = c.req.param('id');

  // TODO: Check if any churches are using this county before deleting
  await db.delete(counties).where(eq(counties.id, Number(id)));

  return c.redirect('/admin/counties');
});

// 404 catch-all route
app.get('*', (c) => {
  return c.html(
    <Layout title="Page Not Found - Utah Churches">
      <NotFound />
    </Layout>
  );
});

export default app;
