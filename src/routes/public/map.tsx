import { eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { Layout } from '../../components/Layout';
import { createDbWithContext } from '../../db';
import { churches, churchGatherings, counties } from '../../db/schema';
import { getUser } from '../../middleware/better-auth';
import { applyCacheHeaders, shouldSkipCache } from '../../middleware/cache';
import type { AuthVariables, Bindings } from '../../types';
import { getFromCache, putInCache } from '../../utils/cf-cache';
import { hasGoogleMapsApiKey } from '../../utils/env-validation';
import { getCommonLayoutProps } from '../../utils/layout-props';

type Variables = AuthVariables;

export const mapRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

mapRoutes.get('/map', async (c) => {
  // Check if Google Maps API key is present
  if (!hasGoogleMapsApiKey(c.env)) {
    const layoutProps = await getCommonLayoutProps(c);

    return c.html(
      <Layout title="Map Unavailable" currentPath="/map" {...layoutProps}>
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
  const _user = await getUser(c);

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
        ? sql`${churches.latitude} IS NOT NULL AND ${churches.longitude} IS NOT NULL AND ${churches.deletedAt} IS NULL`
        : sql`${churches.latitude} IS NOT NULL AND ${churches.longitude} IS NOT NULL AND ${churches.status} != 'Heretical' AND ${churches.deletedAt} IS NULL`
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
