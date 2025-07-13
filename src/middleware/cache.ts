import type { Context } from 'hono';

export interface CacheConfig {
  ttl: number; // Fresh cache time in seconds
  swr: number; // Stale-while-revalidate time in seconds
  skipAuth?: boolean; // Skip caching for authenticated users (default: true)
}

const CACHE_CONFIGS: Record<string, CacheConfig> = {
  homepage: { ttl: 86400, swr: 86400 }, // 24h fresh, 24h stale
  counties: { ttl: 86400, swr: 86400 }, // 24h fresh, 24h stale
  churches: { ttl: 86400, swr: 172800 }, // 24h fresh, 48h stale
  networks: { ttl: 172800, swr: 259200 }, // 48h fresh, 72h stale
  dataExports: { ttl: 172800, swr: 259200 }, // 48h fresh, 72h stale
  map: { ttl: 86400, swr: 86400 }, // 24h fresh, 24h stale
  pages: { ttl: 86400, swr: 172800 }, // 24h fresh, 48h stale
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
