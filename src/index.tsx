import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';
import { eq, sql } from 'drizzle-orm';
import { createDb } from './db';
import { churches, users, affiliations, churchAffiliations, counties } from './db/schema';
import { Layout } from './components/Layout';
import { ChurchCard } from './components/ChurchCard';
import { LoginForm } from './components/LoginForm';
import { UserForm } from './components/UserForm';
import { AffiliationForm } from './components/AffiliationForm';
import { ChurchForm } from './components/ChurchForm';
import { CountyForm } from './components/CountyForm';
import { churchGridClass } from './styles/components';
import { 
  tableClass, 
  tableHeaderClass, 
  tableRowClass, 
  adminBadgeClass, 
  contributorBadgeClass,
  editButtonClass,
  deleteButtonClass,
  addButtonClass,
  statusBadgeClass
} from './styles/admin';
import { createSession, deleteSession, verifyPassword, validateSession } from './utils/auth';
import { adminMiddleware } from './middleware/auth';
import { requireAdminMiddleware } from './middleware/requireAdmin';
import bcrypt from 'bcryptjs';

type Bindings = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
};

type Variables = {
  user: any;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use('/api/*', cors());

// Serve static files
app.get('/js/*', async (c) => {
  const path = c.req.path;
  // @ts-ignore
  const asset = c.env.ASSETS.fetch(c.req.raw);
  return asset;
});

app.get('/', async (c) => {
  const db = createDb(c.env);
  
  // Get counties that have churches, with church count
  const countiesWithChurches = await db.select({
    id: counties.id,
    name: counties.name,
    path: counties.path,
    description: counties.description,
    churchCount: sql<number>`COUNT(${churches.id})`.as('churchCount'),
  })
    .from(counties)
    .innerJoin(churches, eq(counties.id, churches.countyId))
    .groupBy(counties.id, counties.name, counties.path, counties.description)
    .orderBy(counties.name)
    .all();
  
  const totalChurches = countiesWithChurches.reduce((sum, county) => sum + county.churchCount, 0);
  
  return c.html(
    <Layout>
      <div class="min-h-screen bg-gray-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900">Christian Churches in Utah</h1>
            <p class="mt-2 text-lg text-gray-600">
              A list of Christian churches in Utah
            </p>
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
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <h2 class="text-2xl font-semibold">Find Churches Near You</h2>
                  </div>
                  <p class="text-primary-100">
                    Explore an interactive map of churches in your area
                  </p>
                </div>
                <svg class="h-8 w-8 text-primary-200 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </a>
          </div>
          
          {/* Counties Grid */}
          <div>
            <h2 class="text-2xl font-bold text-gray-900 mb-6">Browse by County</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {countiesWithChurches.map((county) => (
                <a
                  href={`/county/${county.path || county.id}`}
                  class="group bg-white rounded-lg shadow-sm ring-1 ring-gray-200 hover:shadow-md hover:ring-primary-500 transition-all duration-200 p-5"
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
                    <svg class="h-5 w-5 text-gray-400 group-hover:text-primary-500 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  {county.description && (
                    <p class="mt-2 text-sm text-gray-600 line-clamp-2">
                      {county.description}
                    </p>
                  )}
                </a>
              ))}
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <footer class="bg-white border-t border-gray-200 mt-16">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div class="flex flex-col sm:flex-row justify-between items-center">
              <p class="text-gray-500 text-sm">
                Utah Churches
              </p>
              <a
                href="/churches.json"
                class="mt-4 sm:mt-0 inline-flex items-center text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Data (JSON)
              </a>
            </div>
          </div>
        </footer>
      </div>
    </Layout>
  );
});

app.get('/county/:path', async (c) => {
  const db = createDb(c.env);
  const countyPath = c.req.param('path');
  
  // Get county by path
  const county = await db.select()
    .from(counties)
    .where(eq(counties.path, countyPath))
    .get();
  
  if (!county) {
    return c.text('County not found', 404);
  }
  
  // Get all churches in this county
  const countyChurches = await db.select({
    id: churches.id,
    name: churches.name,
    path: churches.path,
    status: churches.status,
    gatheringAddress: churches.gatheringAddress,
    serviceTimes: churches.serviceTimes,
    website: churches.website,
    publicNotes: churches.publicNotes,
  })
    .from(churches)
    .where(eq(churches.countyId, county.id))
    .orderBy(churches.name)
    .all();
  
  return c.html(
    <Layout title={`${county.name} County Churches - Utah Churches`}>
      <div class="min-h-screen">
        {/* Header */}
        <div class="bg-gradient-to-r from-primary-600 to-primary-700">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="py-12 md:py-16">
              <div class="md:flex md:items-center md:justify-between">
                <div class="flex-1 min-w-0">
                  <nav class="flex" aria-label="Breadcrumb">
                    <ol class="flex items-center space-x-2">
                      <li>
                        <a href="/" class="text-primary-200 hover:text-white transition-colors">
                          Home
                        </a>
                      </li>
                      <li>
                        <span class="mx-2 text-primary-300">/</span>
                      </li>
                      <li>
                        <span class="text-white">{county.name} County</span>
                      </li>
                    </ol>
                  </nav>
                  <h1 class="mt-4 text-4xl font-bold text-white md:text-5xl">
                    {county.name} County
                  </h1>
                  <p class="mt-4 text-xl text-primary-100">
                    {countyChurches.length} {countyChurches.length === 1 ? 'church' : 'churches'} in this county
                  </p>
                  {county.description && (
                    <p class="mt-2 text-primary-100">
                      {county.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Churches Grid */}
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {countyChurches.length === 0 ? (
            <div class="text-center py-12">
              <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
              {countyChurches.map((church) => (
                <ChurchCard church={church} />
              ))}
            </div>
          )}
        </div>
      </div>
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
    offset
  });
});

app.get('/api/churches/:id', async (c) => {
  const db = createDb(c.env);
  const id = c.req.param('id');
  
  const church = await db.select().from(churches).where(eq(churches.id, Number(id))).get();
  
  if (!church) {
    return c.json({ error: 'Church not found' }, 404);
  }
  
  return c.json(church);
});

app.get('/map', async (c) => {
  const db = createDb(c.env);
  
  // Get all churches with coordinates
  const churchesWithCoords = await db.select({
    id: churches.id,
    name: churches.name,
    path: churches.path,
    latitude: churches.latitude,
    longitude: churches.longitude,
    gatheringAddress: churches.gatheringAddress,
    countyName: counties.name,
    website: churches.website,
    serviceTimes: churches.serviceTimes,
    status: churches.status,
    publicNotes: churches.publicNotes,
  })
    .from(churches)
    .leftJoin(counties, eq(churches.countyId, counties.id))
    .where(sql`${churches.latitude} IS NOT NULL AND ${churches.longitude} IS NOT NULL`)
    .all();
  
  return c.html(
    <Layout title="Church Map - Utah Churches">
      <div class="min-h-screen">
        {/* Header */}
        <div class="bg-gradient-to-r from-primary-600 to-primary-700">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="py-8">
              <h1 class="text-3xl font-bold text-white">
                Church Map
              </h1>
              <p class="mt-2 text-primary-100">
                Explore {churchesWithCoords.length} churches with location data
              </p>
            </div>
          </div>
        </div>
        
        {/* Map Container */}
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div class="bg-white rounded-lg shadow-lg overflow-hidden">
            <div id="map" class="w-full h-[600px]"></div>
          </div>
          
          <div class="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-blue-800">
                  Click on markers to view church details. Blue marker indicates your current location.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <script dangerouslySetInnerHTML={{
        __html: `
        const churches = ${JSON.stringify(churchesWithCoords)};
        let map;
        let markers = [];
        let currentInfoWindow = null;
        
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
          
          // Add markers for each church
          churches.forEach((church) => {
            if (!church.latitude || !church.longitude) return;
            
            const pin = new PinElement({
              background: church.status === 'Unlisted' ? '#F3A298' : undefined,
              borderColor: church.status === 'Unlisted' ? '#C5221F' : undefined,
              glyphColor: church.status === 'Unlisted' ? '#B31512' : undefined,
            });
            
            const marker = new AdvancedMarkerElement({
              position: { lat: church.latitude, lng: church.longitude },
              map: map,
              title: church.name,
              content: pin.element,
            });
            
            markers.push(marker);
            
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
            \${church.serviceTimes ? \`<div style="margin-bottom: 0.5rem;">🕐 Service times: \${church.serviceTimes}</div>\` : ''}
            \${church.website ? \`<div style="margin-bottom: 0.5rem;"><a href="\${church.website}" target="_blank" style="color: #4299e1;">Website</a></div>\` : ''}
            \${church.publicNotes ? \`<div style="margin-top: 0.5rem; font-style: italic; color: #718096;">\${church.publicNotes}</div>\` : ''}
            \${church.path ? \`<div style="margin-top: 0.5rem;"><a href="/church/\${church.path}" style="color: #4299e1;">View Details →</a></div>\` : ''}
          \`;
          
          return content;
        }
        
        function loadLocation() {
          const loadingDiv = document.createElement('div');
          loadingDiv.id = 'loading-indicator';
          loadingDiv.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; background-color: rgba(0, 0, 0, 0.7); color: white; padding: 1rem; text-align: center; z-index: 1000;';
          loadingDiv.textContent = 'Loading your location...';
          document.body.appendChild(loadingDiv);
          
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                processPosition(position);
                loadingDiv.remove();
              },
              () => {
                console.debug("Error fetching location");
                loadingDiv.remove();
              }
            );
          } else {
            loadingDiv.remove();
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
          
          // Calculate distances to all markers
          const distances = markers.map((marker) => ({
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
        `
      }} />
      
      <script async defer
        src="https://maps.googleapis.com/maps/api/js?key=YOUR_GOOGLE_MAPS_API_KEY&callback=initMap&libraries=marker,geometry">
      </script>
    </Layout>
  );
});

app.get('/churches.json', async (c) => {
  const db = createDb(c.env);
  
  // Get all churches with their public fields and county names
  const allChurches = await db.select({
    id: churches.id,
    name: churches.name,
    path: churches.path,
    status: churches.status,
    lastUpdated: churches.lastUpdated,
    gatheringAddress: churches.gatheringAddress,
    latitude: churches.latitude,
    longitude: churches.longitude,
    countyName: counties.name,
    countyPath: counties.path,
    serviceTimes: churches.serviceTimes,
    website: churches.website,
    statementOfFaith: churches.statementOfFaith,
    phone: churches.phone,
    email: churches.email,
    facebook: churches.facebook,
    instagram: churches.instagram,
    youtube: churches.youtube,
    spotify: churches.spotify,
    notes: churches.publicNotes,
  })
    .from(churches)
    .leftJoin(counties, eq(churches.countyId, counties.id))
    .orderBy(churches.name)
    .all();
  
  // Get affiliations for each church
  const churchIds = allChurches.map(c => c.id);
  let churchAffiliationData = [];
  
  if (churchIds.length > 0) {
    churchAffiliationData = await db.select({
      churchId: churchAffiliations.churchId,
      affiliationId: churchAffiliations.affiliationId,
      affiliationName: affiliations.name,
      affiliationWebsite: affiliations.website,
      affiliationPublicNotes: affiliations.publicNotes,
      order: churchAffiliations.order,
    })
      .from(churchAffiliations)
      .innerJoin(affiliations, eq(churchAffiliations.affiliationId, affiliations.id))
      .where(sql`${churchAffiliations.churchId} IN (${sql.join(churchIds.map(id => sql`${id}`), sql`, `)})`)
      .orderBy(churchAffiliations.churchId, churchAffiliations.order)
      .all();
  }
  
  // Group affiliations by church
  const affiliationsByChurch = churchAffiliationData.reduce((acc, item) => {
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
  }, {} as Record<number, any[]>);
  
  // Combine church data with affiliations
  const churchesWithAffiliations = allChurches.map(church => ({
    ...church,
    affiliations: affiliationsByChurch[church.id] || [],
  }));
  
  return c.json({
    total: churchesWithAffiliations.length,
    churches: churchesWithAffiliations,
  });
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
  const username = body.username as string;
  const password = body.password as string;
  
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
  
  // Get statistics
  const allChurches = await db.select().from(churches).all();
  const allCounties = await db.select().from(counties).all();
  const allAffiliations = await db.select().from(affiliations).all();
  const allUsers = await db.select().from(users).all();
  
  const listedChurches = allChurches.filter(c => c.status === 'Listed').length;
  const needsDataChurches = allChurches.filter(c => c.status === 'Needs data').length;
  
  return c.html(
    <Layout title="Admin Dashboard - Utah Churches" user={user}>
      <div class="min-h-screen bg-gray-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div class="md:flex md:items-center md:justify-between mb-8">
            <div class="flex-1 min-w-0">
              <h1 class="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                Admin Dashboard
              </h1>
            </div>
          </div>
          
          {/* Stats Grid */}
          <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <div class="bg-white overflow-hidden shadow rounded-lg">
              <div class="p-5">
                <div class="flex items-center">
                  <div class="flex-shrink-0">
                    <svg class="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div class="ml-5 w-0 flex-1">
                    <dl>
                      <dt class="text-sm font-medium text-gray-500 truncate">Total Churches</dt>
                      <dd class="text-lg font-semibold text-gray-900">{allChurches.length}</dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div class="bg-gray-50 px-5 py-3">
                <div class="text-sm">
                  <a href="/admin/churches" class="font-medium text-primary-600 hover:text-primary-500">
                    View all
                  </a>
                </div>
              </div>
            </div>
            
            <div class="bg-white overflow-hidden shadow rounded-lg">
              <div class="p-5">
                <div class="flex items-center">
                  <div class="flex-shrink-0">
                    <svg class="h-6 w-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div class="ml-5 w-0 flex-1">
                    <dl>
                      <dt class="text-sm font-medium text-gray-500 truncate">Listed Churches</dt>
                      <dd class="text-lg font-semibold text-gray-900">{listedChurches}</dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div class="bg-gray-50 px-5 py-3">
                <div class="text-sm text-gray-500">
                  {Math.round((listedChurches / allChurches.length) * 100)}% of total
                </div>
              </div>
            </div>
            
            <div class="bg-white overflow-hidden shadow rounded-lg">
              <div class="p-5">
                <div class="flex items-center">
                  <div class="flex-shrink-0">
                    <svg class="h-6 w-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div class="ml-5 w-0 flex-1">
                    <dl>
                      <dt class="text-sm font-medium text-gray-500 truncate">Needs Data</dt>
                      <dd class="text-lg font-semibold text-gray-900">{needsDataChurches}</dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div class="bg-gray-50 px-5 py-3">
                <div class="text-sm text-gray-500">
                  Churches requiring updates
                </div>
              </div>
            </div>
            
            <div class="bg-white overflow-hidden shadow rounded-lg">
              <div class="p-5">
                <div class="flex items-center">
                  <div class="flex-shrink-0">
                    <svg class="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                    </svg>
                  </div>
                  <div class="ml-5 w-0 flex-1">
                    <dl>
                      <dt class="text-sm font-medium text-gray-500 truncate">Counties</dt>
                      <dd class="text-lg font-semibold text-gray-900">{allCounties.length}</dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div class="bg-gray-50 px-5 py-3">
                <div class="text-sm">
                  <a href="/admin/counties" class="font-medium text-primary-600 hover:text-primary-500">
                    Manage
                  </a>
                </div>
              </div>
            </div>
          </div>
          
          {/* Quick Actions */}
          <div class="bg-white shadow rounded-lg">
            <div class="px-4 py-5 sm:p-6">
              <h2 class="text-lg leading-6 font-medium text-gray-900 mb-4">Quick Actions</h2>
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <a
                  href="/admin/churches"
                  class="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary-500 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  <div>
                    <span class="rounded-lg inline-flex p-3 bg-primary-50 text-primary-700 group-hover:bg-primary-100">
                      <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </span>
                  </div>
                  <div class="mt-4">
                    <h3 class="text-lg font-medium">
                      <span class="absolute inset-0" aria-hidden="true"></span>
                      Churches
                    </h3>
                    <p class="mt-2 text-sm text-gray-500">
                      Add, edit, or remove church listings
                    </p>
                  </div>
                  <span class="pointer-events-none absolute top-6 right-6 text-gray-300 group-hover:text-gray-400" aria-hidden="true">
                    <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20 4h1a1 1 0 00-1-1v1zm-1 12a1 1 0 102 0h-2zM8 3a1 1 0 000 2V3zM3.293 19.293a1 1 0 101.414 1.414l-1.414-1.414zM19 4v12h2V4h-2zm1-1H8v2h12V3zm-.707.293l-16 16 1.414 1.414 16-16-1.414-1.414z" />
                    </svg>
                  </span>
                </a>
                
                <a
                  href="/admin/affiliations"
                  class="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary-500 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  <div>
                    <span class="rounded-lg inline-flex p-3 bg-purple-50 text-purple-700 group-hover:bg-purple-100">
                      <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </span>
                  </div>
                  <div class="mt-4">
                    <h3 class="text-lg font-medium">
                      <span class="absolute inset-0" aria-hidden="true"></span>
                      Affiliations
                    </h3>
                    <p class="mt-2 text-sm text-gray-500">
                      Manage denominations and networks
                    </p>
                  </div>
                  <span class="pointer-events-none absolute top-6 right-6 text-gray-300 group-hover:text-gray-400" aria-hidden="true">
                    <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20 4h1a1 1 0 00-1-1v1zm-1 12a1 1 0 102 0h-2zM8 3a1 1 0 000 2V3zM3.293 19.293a1 1 0 101.414 1.414l-1.414-1.414zM19 4v12h2V4h-2zm1-1H8v2h12V3zm-.707.293l-16 16 1.414 1.414 16-16-1.414-1.414z" />
                    </svg>
                  </span>
                </a>
                
                <a
                  href="/admin/counties"
                  class="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary-500 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  <div>
                    <span class="rounded-lg inline-flex p-3 bg-green-50 text-green-700 group-hover:bg-green-100">
                      <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                      </svg>
                    </span>
                  </div>
                  <div class="mt-4">
                    <h3 class="text-lg font-medium">
                      <span class="absolute inset-0" aria-hidden="true"></span>
                      Counties
                    </h3>
                    <p class="mt-2 text-sm text-gray-500">
                      Manage Utah county information
                    </p>
                  </div>
                  <span class="pointer-events-none absolute top-6 right-6 text-gray-300 group-hover:text-gray-400" aria-hidden="true">
                    <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20 4h1a1 1 0 00-1-1v1zm-1 12a1 1 0 102 0h-2zM8 3a1 1 0 000 2V3zM3.293 19.293a1 1 0 101.414 1.414l-1.414-1.414zM19 4v12h2V4h-2zm1-1H8v2h12V3zm-.707.293l-16 16 1.414 1.414 16-16-1.414-1.414z" />
                    </svg>
                  </span>
                </a>
                
                <a
                  href="/admin/users"
                  class="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary-500 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  <div>
                    <span class="rounded-lg inline-flex p-3 bg-indigo-50 text-indigo-700 group-hover:bg-indigo-100">
                      <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </span>
                  </div>
                  <div class="mt-4">
                    <h3 class="text-lg font-medium">
                      <span class="absolute inset-0" aria-hidden="true"></span>
                      Users
                    </h3>
                    <p class="mt-2 text-sm text-gray-500">
                      Manage admin access and permissions
                    </p>
                  </div>
                  <span class="pointer-events-none absolute top-6 right-6 text-gray-300 group-hover:text-gray-400" aria-hidden="true">
                    <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20 4h1a1 1 0 00-1-1v1zm-1 12a1 1 0 102 0h-2zM8 3a1 1 0 000 2V3zM3.293 19.293a1 1 0 101.414 1.414l-1.414-1.414zM19 4v12h2V4h-2zm1-1H8v2h12V3zm-.707.293l-16 16 1.414 1.414 16-16-1.414-1.414z" />
                    </svg>
                  </span>
                </a>
              </div>
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
      <div class="min-h-screen bg-gray-50">
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
              <h1 class="mt-2 text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                Manage Users
              </h1>
            </div>
            <div class="mt-4 flex md:mt-0 md:ml-4">
              <a
                href="/admin/users/new"
                class="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <svg class="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add New User
              </a>
            </div>
          </div>
          
          {/* Table */}
          <div class="bg-white shadow overflow-hidden sm:rounded-md">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th scope="col" class="relative px-6 py-3">
                    <span class="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                {allUsers.map((user) => (
                  <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div class="text-sm font-medium text-gray-900">{user.username}</div>
                        <div class="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.userType === 'admin' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {user.userType}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <a href={`/admin/users/${user.id}/edit`} class="text-primary-600 hover:text-primary-900 mr-4">
                        Edit
                      </a>
                      {user.username !== 'admin' && (
                        <form method="POST" action={`/admin/users/${user.id}/delete`} class="inline">
                          <button 
                            type="submit"
                            class="text-red-600 hover:text-red-900"
                            onclick="return confirm('Are you sure you want to delete this user?')"
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
  
  const username = body.username as string;
  const email = body.email as string;
  const password = body.password as string;
  const userType = body.userType as string;
  
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
    userType: userType as 'admin' | 'contributor'
  });
  
  return c.redirect('/admin/users');
});

// Edit user
app.get('/admin/users/:id/edit', requireAdminMiddleware, async (c) => {
  const db = createDb(c.env);
  const id = c.req.param('id');
  const user = await db.select().from(users).where(eq(users.id, Number(id))).get();
  
  if (!user) {
    return c.redirect('/admin/users');
  }
  
  // Check if this is the only admin user
  let isOnlyAdmin = false;
  if (user.userType === 'admin') {
    const adminCount = await db.select()
      .from(users)
      .where(eq(users.userType, 'admin'))
      .all();
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
  const currentUser = await db.select().from(users).where(eq(users.id, Number(id))).get();
  if (!currentUser) {
    return c.redirect('/admin/users');
  }
  
  // Check if trying to change the only admin to contributor
  if (currentUser.userType === 'admin' && userType !== 'admin') {
    const adminCount = await db.select()
      .from(users)
      .where(eq(users.userType, 'admin'))
      .all();
    
    if (adminCount.length === 1) {
      // This is the only admin, don't allow changing to contributor
      return c.redirect('/admin/users');
    }
  }
  
  const updateData: any = {
    email,
    userType: userType as 'admin' | 'contributor'
  };
  
  // Only update password if provided
  if (password && password.length >= 6) {
    updateData.passwordHash = await bcrypt.hash(password, 10);
  }
  
  await db.update(users)
    .set(updateData)
    .where(eq(users.id, Number(id)));
  
  return c.redirect('/admin/users');
});

// Delete user
app.post('/admin/users/:id/delete', requireAdminMiddleware, async (c) => {
  const db = createDb(c.env);
  const id = c.req.param('id');
  
  // Don't allow deleting the admin user
  const user = await db.select().from(users).where(eq(users.id, Number(id))).get();
  if (user && user.username !== 'admin') {
    await db.delete(users).where(eq(users.id, Number(id)));
  }
  
  return c.redirect('/admin/users');
});

// Affiliation management routes
app.get('/admin/affiliations', adminMiddleware, async (c) => {
  const db = createDb(c.env);
  const user = c.get('user');
  const allAffiliations = await db.select()
    .from(affiliations)
    .orderBy(affiliations.name)
    .all();
  
  return c.html(
    <Layout title="Manage Affiliations - Utah Churches" user={user}>
      <div class="min-h-screen bg-gray-50">
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
                Manage Affiliations
              </h1>
            </div>
            <div class="mt-4 flex md:mt-0 md:ml-4">
              <a
                href="/admin/affiliations/new"
                class="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <svg class="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add New Affiliation
              </a>
            </div>
          </div>
          
          {/* Table */}
          <div class="bg-white shadow overflow-hidden sm:rounded-md">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Website
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Public Notes
                  </th>
                  <th scope="col" class="relative px-6 py-3">
                    <span class="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                {allAffiliations.map((affiliation) => (
                  <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="text-sm font-medium text-gray-900">{affiliation.name}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {affiliation.website ? (
                        <a 
                          href={affiliation.website} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          class="text-primary-600 hover:text-primary-900"
                        >
                          {affiliation.website}
                        </a>
                      ) : (
                        <span class="text-gray-400">-</span>
                      )}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500">
                      {affiliation.publicNotes || <span class="text-gray-400">-</span>}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <a href={`/admin/affiliations/${affiliation.id}/edit`} class="text-primary-600 hover:text-primary-900 mr-4">
                        Edit
                      </a>
                      <form method="POST" action={`/admin/affiliations/${affiliation.id}/delete`} class="inline">
                        <button 
                          type="submit"
                          class="text-red-600 hover:text-red-900"
                          onclick="return confirm('Are you sure you want to delete this affiliation?')"
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

// Create new affiliation
app.get('/admin/affiliations/new', adminMiddleware, async (c) => {
  const user = c.get('user');
  return c.html(
    <Layout title="Create Affiliation - Utah Churches" user={user}>
      <div style="max-width: 600px; margin: 0 auto;">
        <AffiliationForm action="/admin/affiliations" isNew={true} />
      </div>
    </Layout>
  );
});

app.post('/admin/affiliations', adminMiddleware, async (c) => {
  const db = createDb(c.env);
  const body = await c.req.parseBody();
  const user = c.get('user');
  
  const name = body.name as string;
  const website = body.website as string;
  const publicNotes = body.publicNotes as string;
  const privateNotes = body.privateNotes as string;
  
  // Check if name already exists
  const existing = await db.select().from(affiliations).where(eq(affiliations.name, name)).get();
  if (existing) {
    return c.html(
      <Layout title="Create Affiliation - Utah Churches" user={user}>
        <div style="max-width: 600px; margin: 0 auto;">
          <AffiliationForm 
            action="/admin/affiliations" 
            isNew={true} 
            error="An affiliation with this name already exists"
            affiliation={{ name, website, publicNotes, privateNotes }}
          />
        </div>
      </Layout>
    );
  }
  
  await db.insert(affiliations).values({
    name,
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
  const affiliation = await db.select().from(affiliations).where(eq(affiliations.id, Number(id))).get();
  
  if (!affiliation) {
    return c.redirect('/admin/affiliations');
  }
  
  return c.html(
    <Layout title="Edit Affiliation - Utah Churches" user={user}>
      <div style="max-width: 600px; margin: 0 auto;">
        <AffiliationForm action={`/admin/affiliations/${id}`} affiliation={affiliation} />
      </div>
    </Layout>
  );
});

app.post('/admin/affiliations/:id', adminMiddleware, async (c) => {
  const db = createDb(c.env);
  const id = c.req.param('id');
  const body = await c.req.parseBody();
  
  const name = body.name as string;
  const website = body.website as string;
  const publicNotes = body.publicNotes as string;
  const privateNotes = body.privateNotes as string;
  
  await db.update(affiliations)
    .set({
      name,
      website: website || null,
      publicNotes: publicNotes || null,
      privateNotes: privateNotes || null,
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
  const db = createDb(c.env);
  const user = c.get('user');
  const allChurches = await db.select({
    id: churches.id,
    name: churches.name,
    path: churches.path,
    status: churches.status,
    gatheringAddress: churches.gatheringAddress,
    serviceTimes: churches.serviceTimes,
    countyName: counties.name,
  })
    .from(churches)
    .leftJoin(counties, eq(churches.countyId, counties.id))
    .orderBy(churches.name)
    .all();
  
  return c.html(
    <Layout title="Manage Churches - Utah Churches" user={user}>
      <div style="margin-bottom: 2rem;">
        <h1 style="margin-bottom: 1rem;">Manage Churches</h1>
        <a href="/admin" style="color: #3b82f6; margin-right: 1rem;">← Back to Admin</a>
      </div>
      
      <button class={addButtonClass} onclick="window.location.href='/admin/churches/new'">
        Add New Church
      </button>
      
      <table class={tableClass}>
        <thead class={tableHeaderClass}>
          <tr>
            <th>Name</th>
            <th>Path</th>
            <th>Status</th>
            <th>Address</th>
            <th>County</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {allChurches.map((church) => (
            <tr class={tableRowClass}>
              <td>{church.name}</td>
              <td style="font-size: 0.875rem; color: #6b7280;">{church.path || '-'}</td>
              <td>
                {church.status && (
                  <span class={`${statusBadgeClass} ${
                    church.status === 'Listed' ? 'bg-green-100 text-green-800' :
                    church.status === 'Ready to list' ? 'bg-blue-100 text-blue-800' :
                    church.status === 'Assess' ? 'bg-yellow-100 text-yellow-800' :
                    church.status === 'Needs data' ? 'bg-red-100 text-red-800' :
                    church.status === 'Unlisted' ? 'bg-gray-100 text-gray-800' :
                    church.status === 'Heretical' ? 'bg-red-900 text-white' :
                    church.status === 'Closed' ? 'bg-gray-600 text-white' : ''
                  }`} style={
                    church.status === 'Listed' ? 'background-color: #d1fae5; color: #065f46;' :
                    church.status === 'Ready to list' ? 'background-color: #dbeafe; color: #1e40af;' :
                    church.status === 'Assess' ? 'background-color: #fef3c7; color: #92400e;' :
                    church.status === 'Needs data' ? 'background-color: #fee2e2; color: #991b1b;' :
                    church.status === 'Unlisted' ? 'background-color: #f3f4f6; color: #374151;' :
                    church.status === 'Heretical' ? 'background-color: #991b1b; color: white;' :
                    church.status === 'Closed' ? 'background-color: #4b5563; color: white;' : ''
                  }>
                    {church.status}
                  </span>
                )}
              </td>
              <td>{church.gatheringAddress || '-'}</td>
              <td>{church.countyName || '-'}</td>
              <td>
                <button 
                  class={editButtonClass}
                  onclick={`window.location.href='/admin/churches/${church.id}/edit'`}
                >
                  Edit
                </button>
                <form method="POST" action={`/admin/churches/${church.id}/delete`} style="display: inline;">
                  <button 
                    type="submit"
                    class={deleteButtonClass}
                    onclick="return confirm('Are you sure you want to delete this church?')"
                  >
                    Delete
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Layout>
  );
});

// Create new church
app.get('/admin/churches/new', adminMiddleware, async (c) => {
  const db = createDb(c.env);
  const allAffiliations = await db.select()
    .from(affiliations)
    .orderBy(affiliations.name)
    .all();
  
  const allCounties = await db.select()
    .from(counties)
    .orderBy(counties.name)
    .all();
  
  return c.html(
    <Layout title="Create Church - Utah Churches">
      <div style="max-width: 800px; margin: 0 auto;">
        <ChurchForm 
          action="/admin/churches" 
          isNew={true}
          affiliations={allAffiliations}
          counties={allCounties}
        />
      </div>
    </Layout>
  );
});

app.post('/admin/churches', adminMiddleware, async (c) => {
  try {
    const db = createDb(c.env);
    const body = await c.req.parseBody();
    
    const churchData = {
      name: body.name as string,
      path: body.path as string || null,
      status: body.status as string || null,
      gatheringAddress: body.gatheringAddress as string || null,
      latitude: body.latitude ? parseFloat(body.latitude as string) : null,
      longitude: body.longitude ? parseFloat(body.longitude as string) : null,
      countyId: body.countyId ? Number(body.countyId) : null,
      serviceTimes: body.serviceTimes as string || null,
      website: body.website as string || null,
      statementOfFaith: body.statementOfFaith as string || null,
      phone: body.phone as string || null,
      email: body.email as string || null,
      facebook: body.facebook as string || null,
      instagram: body.instagram as string || null,
      youtube: body.youtube as string || null,
      spotify: body.spotify as string || null,
      privateNotes: body.privateNotes as string || null,
      publicNotes: body.publicNotes as string || null,
      lastUpdated: new Date(),
    };
    
    const result = await db.insert(churches).values(churchData).returning({ id: churches.id });
    const churchId = result[0].id;
    
    // Handle affiliations
    const selectedAffiliations = body.affiliations 
      ? (Array.isArray(body.affiliations) ? body.affiliations : [body.affiliations])
      : [];
    
    // Insert affiliations
    for (let i = 0; i < selectedAffiliations.length; i++) {
      await db.insert(churchAffiliations).values({
        churchId,
        affiliationId: Number(selectedAffiliations[i]),
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
  const id = c.req.param('id');
  
  const church = await db.select().from(churches).where(eq(churches.id, Number(id))).get();
  if (!church) {
    return c.redirect('/admin/churches');
  }
  
  const allAffiliations = await db.select()
    .from(affiliations)
    .orderBy(affiliations.name)
    .all();
  
  const allCounties = await db.select()
    .from(counties)
    .orderBy(counties.name)
    .all();
  
  const currentAffiliations = await db.select()
    .from(churchAffiliations)
    .where(eq(churchAffiliations.churchId, Number(id)))
    .all();
  
  return c.html(
    <Layout title="Edit Church - Utah Churches">
      <div style="max-width: 800px; margin: 0 auto;">
        <ChurchForm 
          action={`/admin/churches/${id}`} 
          church={church}
          affiliations={allAffiliations}
          counties={allCounties}
          churchAffiliations={currentAffiliations}
        />
      </div>
    </Layout>
  );
});

app.post('/admin/churches/:id', adminMiddleware, async (c) => {
  try {
    const db = createDb(c.env);
    const id = c.req.param('id');
    const body = await c.req.parseBody();
    
    const churchData = {
      name: body.name as string,
      path: body.path as string || null,
      status: body.status as string || null,
      gatheringAddress: body.gatheringAddress as string || null,
      latitude: body.latitude ? parseFloat(body.latitude as string) : null,
      longitude: body.longitude ? parseFloat(body.longitude as string) : null,
      countyId: body.countyId ? Number(body.countyId) : null,
      serviceTimes: body.serviceTimes as string || null,
      website: body.website as string || null,
      statementOfFaith: body.statementOfFaith as string || null,
      phone: body.phone as string || null,
      email: body.email as string || null,
      facebook: body.facebook as string || null,
      instagram: body.instagram as string || null,
      youtube: body.youtube as string || null,
      spotify: body.spotify as string || null,
      privateNotes: body.privateNotes as string || null,
      publicNotes: body.publicNotes as string || null,
      lastUpdated: new Date(),
    };
    
    await db.update(churches)
      .set(churchData)
      .where(eq(churches.id, Number(id)));
    
    // Update affiliations
    // First, delete existing affiliations
    await db.delete(churchAffiliations).where(eq(churchAffiliations.churchId, Number(id)));
    
    // Then insert new ones
    const selectedAffiliations = body.affiliations 
      ? (Array.isArray(body.affiliations) ? body.affiliations : [body.affiliations])
      : [];
    
    for (let i = 0; i < selectedAffiliations.length; i++) {
      await db.insert(churchAffiliations).values({
        churchId: Number(id),
        affiliationId: Number(selectedAffiliations[i]),
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
  const db = createDb(c.env);
  const id = c.req.param('id');
  
  // Delete affiliations first
  await db.delete(churchAffiliations).where(eq(churchAffiliations.churchId, Number(id)));
  
  // Then delete the church
  await db.delete(churches).where(eq(churches.id, Number(id)));
  
  return c.redirect('/admin/churches');
});

// County management routes
app.get('/admin/counties', adminMiddleware, async (c) => {
  const db = createDb(c.env);
  const user = c.get('user');
  const allCounties = await db.select()
    .from(counties)
    .orderBy(counties.name)
    .all();
  
  return c.html(
    <Layout title="Manage Counties - Utah Churches" user={user}>
      <div class="min-h-screen bg-gray-50">
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
              <h1 class="mt-2 text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                Manage Counties
              </h1>
            </div>
            <div class="mt-4 flex md:mt-0 md:ml-4">
              <a
                href="/admin/counties/new"
                class="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <svg class="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add New County
              </a>
            </div>
          </div>
          
          {/* Table */}
          <div class="bg-white shadow overflow-hidden sm:rounded-md">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Path
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Population
                  </th>
                  <th scope="col" class="relative px-6 py-3">
                    <span class="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                {allCounties.map((county) => (
                  <tr class="hover:bg-gray-50">
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
                      <a href={`/admin/counties/${county.id}/edit`} class="text-primary-600 hover:text-primary-900 mr-4">
                        Edit
                      </a>
                      <form method="POST" action={`/admin/counties/${county.id}/delete`} class="inline">
                        <button 
                          type="submit"
                          class="text-red-600 hover:text-red-900"
                          onclick="return confirm('Are you sure you want to delete this county?')"
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
  
  const name = body.name as string;
  const path = body.path as string;
  const description = body.description as string;
  const population = body.population ? parseInt(body.population as string) : null;
  
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
  const county = await db.select().from(counties).where(eq(counties.id, Number(id))).get();
  
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
  
  await db.update(counties)
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

export default app;