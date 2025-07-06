import { eq } from 'drizzle-orm';
import type { Context, Next } from 'hono';
import { createDbWithContext } from '../db';
import { settings } from '../db/schema';
import type { Bindings } from '../types';

export async function domainRedirectMiddleware(c: Context<{ Bindings: Bindings }>, next: Next) {
  const hostname = new URL(c.req.url).hostname;

  // Skip redirect for localhost and development
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('localhost')) {
    return next();
  }

  // Check if DB is available before attempting to use it
  if (!c.env.DB) {
    console.error('Domain redirect middleware: DB environment variable not found');
    // Fall back to default behavior without database lookup
    const defaultDomain = 'utahchurches.org';

    if (hostname.includes('.workers.dev') || (hostname !== defaultDomain && hostname !== `www.${defaultDomain}`)) {
      const url = new URL(c.req.url);
      url.hostname = defaultDomain;
      return c.redirect(url.toString(), 301);
    }

    return next();
  }

  try {
    // Get configured domain from settings
    const db = createDbWithContext(c);
    const siteDomainSetting = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, 'site_domain'))
      .get();

    const configuredDomain = siteDomainSetting?.value || 'utahchurches.org';

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
