import type { ExecutionContext } from '@cloudflare/workers-types';

/**
 * Cloudflare Cache API implementation for Utah Churches
 *
 * Uses Cloudflare's Cache API for edge caching with proper types
 * Documentation: https://developers.cloudflare.com/workers/runtime-apis/cache/
 */

// Cache namespace for preventing key collisions
const CACHE_VERSION = 'v1';

/**
 * Generate a properly formatted cache key
 */
export function createCacheKey(request: Request | string): Request {
  const url = typeof request === 'string' ? request : request.url;

  // Cloudflare requires the URL to be under the same zone
  const cacheUrl = new URL(url);

  // Add cache version to bust cache when needed
  cacheUrl.searchParams.set('cf-cache-version', CACHE_VERSION);

  // Create a GET request (only GET requests can be cached)
  return new Request(cacheUrl.toString(), {
    method: 'GET',
  });
}

/**
 * Get response from Cloudflare edge cache
 */
export async function getFromCache(request: Request | string): Promise<Response | null> {
  try {
    const cacheKey = createCacheKey(request);
    const cache = await caches.open('custom-cache');

    const response = await cache.match(cacheKey);

    if (response) {
      // Clone and add cache status header
      const cachedResponse = new Response(response.body, response);
      cachedResponse.headers.set('CF-Cache-Status', 'HIT');
      cachedResponse.headers.set('X-Cache-Version', CACHE_VERSION);
      return cachedResponse;
    }

    return null;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
}

/**
 * Store response in Cloudflare edge cache
 */
export async function putInCache(
  request: Request | string,
  response: Response,
  ttl: number = 259200 // 3 days default
): Promise<void> {
  try {
    // Only cache successful responses
    if (!response.ok) {
      return;
    }

    const cacheKey = createCacheKey(request);
    const cache = await caches.open('custom-cache');

    // Clone response to avoid consuming body
    const responseToCache = response.clone();

    // Create headers for caching
    const headers = new Headers(responseToCache.headers);
    headers.set('Cache-Control', `public, max-age=${ttl}`);
    headers.set('CF-Cache-Status', 'MISS');
    headers.set('X-Cache-Version', CACHE_VERSION);

    // Create cacheable response
    const cacheableResponse = new Response(responseToCache.body, {
      status: responseToCache.status,
      statusText: responseToCache.statusText,
      headers,
    });

    await cache.put(cacheKey, cacheableResponse);
  } catch (error) {
    console.error('Cache put error:', error);
  }
}

/**
 * Delete from cache
 */
export async function deleteFromCache(patterns: string[]): Promise<void> {
  try {
    const cache = await caches.open('custom-cache');

    for (const pattern of patterns) {
      const cacheKey = createCacheKey(pattern);
      await cache.delete(cacheKey);
    }
  } catch (error) {
    console.error('Cache delete error:', error);
  }
}

/**
 * Cache tags for organized invalidation
 */
export const CacheTags = {
  all: () => 'all',
  churches: () => 'churches',
  church: (id: string) => `church:${id}`,
  county: (id: string) => `county:${id}`,
  network: (id: string) => `network:${id}`,
  map: () => 'map',
  homepage: () => 'homepage',
} as const;

/**
 * URL patterns for cache invalidation
 */
export function getCacheUrlsForChurch(
  _churchId: string,
  churchPath: string,
  countyPath?: string,
  networkIds: string[] = []
): string[] {
  const urls = [
    `/churches/${churchPath}`,
    '/churches.json',
    '/churches.yaml',
    '/churches.csv',
    '/map',
    '/', // Homepage shows counts
  ];

  if (countyPath) {
    urls.push(`/counties/${countyPath}`);
  }

  for (const networkId of networkIds) {
    urls.push(`/networks/${networkId}`);
  }

  return urls;
}

/**
 * Cache middleware for routes
 */
export function withCache(ttl: number = 259200) {
  return async (c: any, next: () => Promise<void>) => {
    // Skip cache for authenticated users
    const hasSession = c.req.header('cookie')?.includes('session=');
    if (hasSession) {
      await next();
      return;
    }

    // Try cache first
    const cachedResponse = await getFromCache(c.req.raw);
    if (cachedResponse) {
      c.res = cachedResponse;
      return;
    }

    // Generate fresh response
    await next();

    // Cache successful responses in background
    if (c.res?.ok) {
      const responseToCache = c.res.clone();
      c.executionCtx.waitUntil(putInCache(c.req.raw, responseToCache, ttl));
    }
  };
}

/**
 * Warm cache by pre-fetching URLs
 */
export async function warmCache(urls: string[], baseUrl: string, ctx: ExecutionContext): Promise<void> {
  const warmingPromises = urls.map(async (url) => {
    try {
      const fullUrl = `${baseUrl}${url}`;
      const cached = await getFromCache(fullUrl);

      if (!cached) {
        const response = await fetch(fullUrl);
        if (response.ok) {
          await putInCache(fullUrl, response);
        }
      }
    } catch (error) {
      console.error(`Failed to warm ${url}:`, error);
    }
  });

  ctx.waitUntil(Promise.all(warmingPromises));
}
