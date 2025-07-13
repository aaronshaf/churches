import type { Context } from 'hono';

export interface CacheConfig {
  ttl: number; // Fresh cache time in seconds
  swr: number; // Stale-while-revalidate time in seconds
  skipAuth?: boolean; // Skip caching for authenticated users (default: true)
}

const CACHE_CONFIGS: Record<string, CacheConfig> = {
  homepage: { ttl: 300, swr: 3600 }, // 5min fresh, 1h stale
  counties: { ttl: 600, swr: 3600 }, // 10min fresh, 1h stale
  churches: { ttl: 1800, swr: 7200 }, // 30min fresh, 2h stale
  networks: { ttl: 3600, swr: 86400 }, // 1h fresh, 24h stale
  dataExports: { ttl: 3600, swr: 86400 }, // 1h fresh, 24h stale
  map: { ttl: 600, swr: 3600 }, // 10min fresh, 1h stale
  pages: { ttl: 1800, swr: 7200 }, // 30min fresh, 2h stale (custom pages)
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
