import type { Context } from 'hono';

/**
 * Cache Configuration for Utah Churches Directory
 *
 * This site has very low update frequency (churches don't change often),
 * so we use aggressive 14-day caching to maximize performance and minimize costs.
 *
 * Cache Strategy:
 * - 1 hour fresh: Content served directly from cache, no origin requests
 * - 14 days stale-while-revalidate: Content served from cache while background revalidation happens
 * - Total: 14+ days of cached content
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

// 14-day cache strategy for low-update-frequency church directory site
// Total effective cache: 14 days (1 hour fresh + 14 days stale-while-revalidate)
const CACHE_CONFIGS: Record<string, CacheConfig> = {
  homepage: { ttl: 3600, swr: 1209600 }, // 1h fresh, 14d stale
  counties: { ttl: 3600, swr: 1209600 }, // 1h fresh, 14d stale
  churches: { ttl: 3600, swr: 1209600 }, // 1h fresh, 14d stale
  networks: { ttl: 3600, swr: 1209600 }, // 1h fresh, 14d stale
  dataExports: { ttl: 3600, swr: 1209600 }, // 1h fresh, 14d stale
  map: { ttl: 3600, swr: 1209600 }, // 1h fresh, 14d stale
  pages: { ttl: 3600, swr: 1209600 }, // 1h fresh, 14d stale
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
