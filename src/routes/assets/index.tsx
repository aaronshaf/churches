import { Hono } from 'hono';
import type { D1SessionVariables } from '../../middleware/d1-session';
import type { AuthVariables, Bindings } from '../../types';

type Variables = AuthVariables & D1SessionVariables;

export const assetsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Traffic advice for domain configuration
assetsRoutes.get('/.well-known/traffic-advice', async (c) => {
  return c.json({
    version: 1,
    endpoints: [
      {
        location: '.',
        region: 'us-east-1',
        weight: 1,
      },
    ],
  });
});

// Local R2 image serving
assetsRoutes.get('/r2-local/*', async (c) => {
  const path = c.req.path.replace('/r2-local/', '');

  try {
    const object = await c.env.IMAGES_BUCKET.get(path);

    if (!object) {
      return c.notFound();
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('cache-control', 'public, max-age=31536000, immutable');

    return c.newResponse(object.body, { headers });
  } catch (error) {
    console.error('Error serving R2 image:', error);
    return c.notFound();
  }
});

// CDN image proxy for Cloudflare Image Transformations
assetsRoutes.get('/cdn-cgi/image/*', async (c) => {
  // Extract the source URL from the path
  const fullPath = c.req.path;
  const match = fullPath.match(/\/cdn-cgi\/image\/[^/]+\/(https?:\/\/.+)$/);

  if (!match) {
    return c.notFound();
  }

  const sourceUrl = match[1];

  try {
    // Check if it's a local R2 URL
    if (sourceUrl.includes('/r2-local/')) {
      // Extract the path and serve from local R2
      const r2Path = sourceUrl.split('/r2-local/')[1];
      const object = await c.env.IMAGES_BUCKET.get(r2Path);

      if (!object) {
        return c.notFound();
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('cache-control', 'public, max-age=31536000, immutable');

      return c.newResponse(object.body, { headers });
    }

    // Otherwise, proxy from external URL
    const response = await fetch(sourceUrl);

    if (!response.ok) {
      return c.notFound();
    }

    const headers = new Headers();
    headers.set('content-type', response.headers.get('content-type') || 'image/jpeg');
    headers.set('cache-control', 'public, max-age=31536000, immutable');

    return c.newResponse(response.body, { headers });
  } catch (error) {
    console.error('Error proxying image:', error);
    return c.notFound();
  }
});

// Chrome DevTools support
assetsRoutes.get('/.well-known/appspecific/com.chrome.devtools.json', (c) => {
  return c.json({
    version: 1,
    origins: ['*'],
  });
});
