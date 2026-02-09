import type { DbType } from '../db';
import { settings } from '../db/schema';

// Cache key for all settings
const SETTINGS_CACHE_KEY = 'settings:all';
// Cache TTL: 7 days (for low-update-frequency site)
const CACHE_TTL = 604800; // 7 * 24 * 60 * 60

export interface SettingsMap {
  site_domain?: string | null;
  site_region?: string | null;
  r2_image_domain?: string | null;
  favicon_url?: string | null;
  logo_url?: string | null;
  site_title?: string | null;
  tagline?: string | null;
  front_page_title?: string | null;
  image_prefix?: string | null;
  [key: string]: string | null | undefined;
}

/**
 * Get settings with KV cache layer
 * Tries KV first for fast access, falls back to D1 if not cached
 */
export async function getSettingsWithCache(kv: KVNamespace, db: DbType): Promise<SettingsMap> {
  try {
    // Try to get from KV cache first
    const cached = await kv.get<SettingsMap>(SETTINGS_CACHE_KEY, 'json');
    if (cached) {
      return cached;
    }
  } catch (error) {
    console.warn('KV cache read failed, falling back to D1:', error);
  }

  // Fetch from D1
  const settingsFromDb = await fetchSettingsFromD1(db);

  // Cache in KV for future requests
  try {
    await kv.put(SETTINGS_CACHE_KEY, JSON.stringify(settingsFromDb), {
      expirationTtl: CACHE_TTL,
    });
  } catch (error) {
    console.warn('KV cache write failed:', error);
    // Continue even if caching fails
  }

  return settingsFromDb;
}

/**
 * Fetch settings directly from D1
 */
async function fetchSettingsFromD1(db: DbType): Promise<SettingsMap> {
  // Fetch all settings that are commonly used
  const siteSettings = await db
    .select({
      key: settings.key,
      value: settings.value,
    })
    .from(settings)
    .all();

  // Convert array to map
  return siteSettings.reduce((acc, setting) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {} as SettingsMap);
}

/**
 * Invalidate settings cache
 * Called when settings are updated in admin panel
 */
export async function invalidateSettingsCache(kv: KVNamespace): Promise<void> {
  try {
    await kv.delete(SETTINGS_CACHE_KEY);
  } catch (error) {
    console.error('Failed to invalidate settings cache:', error);
    // Don't throw - cache invalidation failure shouldn't break updates
  }
}

/**
 * Get a specific setting with cache
 */
export async function getSettingWithCache(kv: KVNamespace, db: DbType, key: string): Promise<string | null> {
  const allSettings = await getSettingsWithCache(kv, db);
  return allSettings[key] ?? null;
}
