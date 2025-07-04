import { eq } from 'drizzle-orm';
import { createDb } from '../db';
import { settings } from '../db/schema';
import type { Bindings } from '../types';

export async function getFaviconUrl(env: Bindings): Promise<string | undefined> {
  try {
    const db = createDb(env);
    const faviconUrlSetting = await db.select().from(settings).where(eq(settings.key, 'favicon_url')).get();

    return faviconUrlSetting?.value || undefined;
  } catch (error) {
    console.error('Error fetching favicon URL:', error);
    return undefined;
  }
}

export async function getLogoUrl(env: Bindings): Promise<string | undefined> {
  try {
    const db = createDb(env);
    const logoUrlSetting = await db.select().from(settings).where(eq(settings.key, 'logo_url')).get();

    return logoUrlSetting?.value || undefined;
  } catch (error) {
    console.error('Error fetching logo URL:', error);
    return undefined;
  }
}

export async function getSiteTitle(env: Bindings): Promise<string> {
  try {
    const db = createDb(env);
    const siteTitleSetting = await db.select().from(settings).where(eq(settings.key, 'site_title')).get();

    return siteTitleSetting?.value || 'Churches';
  } catch (error) {
    console.error('Error fetching site title:', error);
    return 'Churches';
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
      siteTitle: siteTitle?.value || 'Churches',
      tagline: tagline?.value || 'A directory of evangelical churches',
      frontPageTitle: frontPageTitle?.value || 'Christian Churches',
      faviconUrl: faviconUrl?.value || undefined,
    };
  } catch (error) {
    console.error('Error fetching site settings:', error);
    return {
      siteTitle: 'Churches',
      tagline: 'A directory of evangelical churches',
      frontPageTitle: 'Christian Churches',
      faviconUrl: undefined,
    };
  }
}

export async function getImagePrefix(env: Bindings): Promise<string> {
  try {
    const db = createDb(env);
    const imagePrefixSetting = await db.select().from(settings).where(eq(settings.key, 'image_prefix')).get();
    
    // If no setting exists, derive from site domain or use default
    if (!imagePrefixSetting?.value) {
      const domainSetting = await db.select().from(settings).where(eq(settings.key, 'site_domain')).get();
      if (domainSetting?.value) {
        // Extract domain name without TLD (e.g., "utahchurches" from "utahchurches.org")
        const domainParts = domainSetting.value.split('.');
        return domainParts[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      }
    }
    
    return imagePrefixSetting?.value || 'churches';
  } catch (error) {
    console.error('Error fetching image prefix:', error);
    return 'churches';
  }
}
