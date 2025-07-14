import type { Context } from 'hono';

/**
 * Cache Configuration for Utah Churches Directory
 *
 * This site has very low update frequency (churches don't change often),
 * so we use aggressive 7-day caching to maximize performance and minimize costs.
 *
 * Cache Strategy:
 * - 3 days fresh: Content served directly from cache, no origin requests
 * - 4 days stale-while-revalidate: Content served from cache while background revalidation happens
 * - Total: 7 days of cached content
 *
 * Benefits:
 * - Reduced D1 database queries (lower costs)
 * - Faster response times globally
 * - Better user experience
 * - Lower bandwidth usage
 *
 * Cache is automatically invalidated when admins make changes.
 */
export interface CacheConfig {
  ttl: number; // Fresh cache time in seconds
  swr: number; // Stale-while-revalidate time in seconds
  skipAuth?: boolean; // Skip caching for authenticated users (default: true)
}

// 7-day cache strategy for low-update-frequency church directory site
// Total effective cache: 7 days (3 days fresh + 4 days stale-while-revalidate)
const CACHE_CONFIGS: Record<string, CacheConfig> = {
  homepage: { ttl: 259200, swr: 345600 }, // 3d fresh, 4d stale = 7d total
  counties: { ttl: 259200, swr: 345600 }, // 3d fresh, 4d stale = 7d total
  churches: { ttl: 259200, swr: 345600 }, // 3d fresh, 4d stale = 7d total
  networks: { ttl: 259200, swr: 345600 }, // 3d fresh, 4d stale = 7d total
  dataExports: { ttl: 259200, swr: 345600 }, // 3d fresh, 4d stale = 7d total
  map: { ttl: 259200, swr: 345600 }, // 3d fresh, 4d stale = 7d total
  pages: { ttl: 259200, swr: 345600 }, // 3d fresh, 4d stale = 7d total
};

export function shouldSkipCache(c: Context): boolean {
  const url = new URL(c.req.url);

  // Skip admin and API routes
  if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/api')) {
    return true;
  }

  // Skip authenticated users by default (they see private content)
  const sessionCookie = c.req.header('cookie')?.match(/session=([^;]+)/);
  if (sessionCookie) {
    return true;
  }

  return false;
}

export function applyCacheHeaders(response: Response, cacheType: keyof typeof CACHE_CONFIGS): Response {
  const config = CACHE_CONFIGS[cacheType];
  if (!config) {
    return response;
  }

  const cacheControl = `public, max-age=${config.ttl}, stale-while-revalidate=${config.swr}`;

  // Create new response with cache headers
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', cacheControl);
  headers.set('Vary', 'Accept-Encoding'); // Ensure proper compression handling

  const cachedResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });

  return cachedResponse;
}

export function withCache(cacheType: keyof typeof CACHE_CONFIGS) {
  return (next: () => Promise<Response>) => {
    return async (c: Context) => {
      // Skip caching if conditions not met
      if (shouldSkipCache(c)) {
        return next();
      }

      // Execute the route handler
      const response = await next();

      // Apply cache headers
      return applyCacheHeaders(response, cacheType);
    };
  };
}
