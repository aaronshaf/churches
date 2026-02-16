import { eq, isNotNull } from 'drizzle-orm';
import type { Context } from 'hono';
import { createDb } from '../db';
import { pages, settings } from '../db/schema';
import type { Bindings } from '../types';

/**
 * Get favicon URL from settings
 */
export async function getFaviconUrl(env: Bindings): Promise<string | undefined> {
  const db = createDb(env);
  const faviconSetting = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, 'favicon_url'))
    .get();

  return faviconSetting?.value ?? undefined;
}

/**
 * Get logo URL from settings
 */
export async function getLogoUrl(env: Bindings): Promise<string | undefined> {
  const db = createDb(env);
  const logoSetting = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, 'logo_url'))
    .get();

  return logoSetting?.value ?? undefined;
}

/**
 * Get navbar pages from database
 */
export async function getNavbarPages(env: Bindings): Promise<Array<{ id: number; title: string; path: string }>> {
  const db = createDb(env);
  return await db
    .select({
      id: pages.id,
      title: pages.title,
      path: pages.path,
    })
    .from(pages)
    .where(isNotNull(pages.navbarOrder))
    .orderBy(pages.navbarOrder)
    .all();
}

/**
 * Get layout props for pages
 */
export async function getLayoutProps(c: { env: Bindings } & Pick<Context, 'req'>): Promise<{
  faviconUrl?: string;
  logoUrl?: string;
  navbarPages: Array<{ id: number; title: string; path: string }>;
  currentPath: string;
}> {
  const [faviconUrl, logoUrl, navbarPages] = await Promise.all([
    getFaviconUrl(c.env),
    getLogoUrl(c.env),
    getNavbarPages(c.env),
  ]);

  return {
    faviconUrl,
    logoUrl,
    navbarPages,
    currentPath: c.req.path,
  };
}
