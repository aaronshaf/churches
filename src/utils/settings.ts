import { eq } from 'drizzle-orm';
import { createDb } from '../db';
import { settings } from '../db/schema';
import type { Bindings } from '../index';

export async function getFaviconUrl(env: Bindings): Promise<string | undefined> {
  try {
    const db = createDb(env);
    const faviconUrlSetting = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'favicon_url'))
      .get();
    
    return faviconUrlSetting?.value || undefined;
  } catch (error) {
    console.error('Error fetching favicon URL:', error);
    return undefined;
  }
}

export async function getSiteSettings(env: Bindings) {
  try {
    const db = createDb(env);
    
    const [siteTitle, tagline, frontPageTitle, faviconUrl] = await Promise.all([
      db.select().from(settings).where(eq(settings.key, 'site_title')).get(),
      db.select().from(settings).where(eq(settings.key, 'tagline')).get(),
      db.select().from(settings).where(eq(settings.key, 'front_page_title')).get(),
      db.select().from(settings).where(eq(settings.key, 'favicon_url')).get(),
    ]);
    
    return {
      siteTitle: siteTitle?.value || 'Utah Churches',
      tagline: tagline?.value || 'A directory of evangelical churches',
      frontPageTitle: frontPageTitle?.value || 'Christian Churches in Utah',
      faviconUrl: faviconUrl?.value || undefined,
    };
  } catch (error) {
    console.error('Error fetching site settings:', error);
    return {
      siteTitle: 'Utah Churches',
      tagline: 'A directory of evangelical churches',
      frontPageTitle: 'Christian Churches in Utah',
      faviconUrl: undefined,
    };
  }
}