import { createDb } from '../db';
import type { Bindings } from '../types';
import { getSettingsWithCache, getSettingWithCache } from './settings-cache';

export async function getFaviconUrl(env: Bindings): Promise<string | undefined> {
  try {
    const db = createDb(env.DB);
    const value = await getSettingWithCache(env.SETTINGS_CACHE, db, 'favicon_url');
    return value || undefined;
  } catch (error) {
    console.error('Error fetching favicon URL:', error);
    return undefined;
  }
}

export async function getLogoUrl(env: Bindings): Promise<string | undefined> {
  try {
    const db = createDb(env.DB);
    const value = await getSettingWithCache(env.SETTINGS_CACHE, db, 'logo_url');
    return value || undefined;
  } catch (error) {
    console.error('Error fetching logo URL:', error);
    return undefined;
  }
}

export async function getSiteTitle(env: Bindings): Promise<string> {
  try {
    const db = createDb(env.DB);
    const value = await getSettingWithCache(env.SETTINGS_CACHE, db, 'site_title');
    return value || 'Churches';
  } catch (error) {
    console.error('Error fetching site title:', error);
    return 'Churches';
  }
}

export async function getSiteSettings(env: Bindings): Promise<{
  siteTitle: string;
  tagline: string;
  frontPageTitle: string;
  faviconUrl: string | undefined;
}> {
  try {
    const db = createDb(env.DB);

    // Get all settings at once from cache
    const allSettings = await getSettingsWithCache(env.SETTINGS_CACHE, db);

    return {
      siteTitle: allSettings.site_title || 'Churches',
      tagline: allSettings.tagline || 'A directory of evangelical churches',
      frontPageTitle: allSettings.front_page_title || 'Christian Churches',
      faviconUrl: allSettings.favicon_url || undefined,
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
    const db = createDb(env.DB);
    const allSettings = await getSettingsWithCache(env.SETTINGS_CACHE, db);

    // If no setting exists, derive from site domain or use default
    if (!allSettings.image_prefix && allSettings.site_domain) {
      // Extract domain name without TLD (e.g., "example" from "example.com")
      const domainParts = allSettings.site_domain.split('.');
      return domainParts[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    return allSettings.image_prefix || 'churches';
  } catch (error) {
    console.error('Error fetching image prefix:', error);
    return 'churches';
  }
}
