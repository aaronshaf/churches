import type { Context, Next } from 'hono';
import { createDbWithContext } from '../db';
import type { Bindings } from '../types';
import { getSettingWithCache } from '../utils/settings-cache';

export async function domainRedirectMiddleware(c: Context<{ Bindings: Bindings }>, next: Next) {
  const hostname = new URL(c.req.url).hostname;

  // Skip redirect for localhost and development
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('localhost')) {
    return next();
  }

  try {
    // Get configured domain from settings cache
    const db = createDbWithContext(c);
    const siteDomain = await getSettingWithCache(c.env.SETTINGS_CACHE, db, 'site_domain');
    const configuredDomain = siteDomain || c.env.SITE_DOMAIN || 'localhost';

    // If we're on workers.dev domain or not on the configured domain, redirect
    if (
      hostname.includes('.workers.dev') ||
      (hostname !== configuredDomain && hostname !== `www.${configuredDomain}`)
    ) {
      const url = new URL(c.req.url);
      url.hostname = configuredDomain;

      // Use 301 permanent redirect for SEO
      return c.redirect(url.toString(), 301);
    }
  } catch (error) {
    console.error('Domain redirect middleware error:', error);
    // If database query fails, continue without redirect to avoid breaking the site
    // This ensures the site remains accessible even if the database is temporarily unavailable
  }

  return next();
}
