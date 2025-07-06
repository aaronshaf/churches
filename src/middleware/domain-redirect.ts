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

  // Get configured domain from settings
  const db = createDbWithContext(c);
  const siteDomainSetting = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, 'site_domain'))
    .get();

  const configuredDomain = siteDomainSetting?.value || 'utahchurches.org';

  // If we're on workers.dev domain or not on the configured domain, redirect
  if (hostname.includes('.workers.dev') || (hostname !== configuredDomain && hostname !== `www.${configuredDomain}`)) {
    const url = new URL(c.req.url);
    url.hostname = configuredDomain;

    // Use 301 permanent redirect for SEO
    return c.redirect(url.toString(), 301);
  }

  return next();
}
