import { isNull } from 'drizzle-orm';
import type { Context } from 'hono';
import { createDbWithContext } from '../db';
import { affiliations, churches, counties } from '../db/schema';
import { deleteFromCache, getCacheUrlsForChurch } from './cf-cache';

export interface CacheInvalidationOptions {
  churchId?: string;
  countyId?: string;
  affiliationId?: string;
  clearAll?: boolean;
  // Additional context for better invalidation
  churchPath?: string;
  countyPath?: string;
  networkIds?: string[];
}

/**
 * Cache invalidation utility for Utah Churches app
 *
 * Uses Cloudflare's Cache API to selectively invalidate cached responses
 * when content is updated through admin operations.
 */
export class CacheInvalidator {
  private baseUrl: string;

  constructor(private c: Context) {
    this.baseUrl = new URL(c.req.url).origin;
  }

  private async deleteFromCache(path: string): Promise<boolean> {
    try {
      const fullUrl = `${this.baseUrl}${path}`;
      const request = new Request(fullUrl);
      await deleteFromCache([request.url]);
      console.log(`Cache invalidated for ${path}`);
      return true;
    } catch (error) {
      console.warn(`Failed to invalidate cache for ${path}:`, error);
      return false;
    }
  }

  /**
   * Invalidate cache entries based on the update type
   */
  async invalidate(options: CacheInvalidationOptions): Promise<void> {
    const promises: Promise<boolean>[] = [];

    if (options.clearAll) {
      // Clear all cached content (used for settings updates)
      await this.clearAllCache();
      return;
    }

    if (options.churchId) {
      promises.push(...(await this.getChurchInvalidationPromises(options.churchId, options)));
    }

    if (options.countyId) {
      promises.push(...this.getCountyInvalidationPromises(options.countyId));
    }

    if (options.affiliationId) {
      promises.push(...this.getAffiliationInvalidationPromises(options.affiliationId));
    }

    // Execute all invalidations in parallel
    await Promise.allSettled(promises);
  }

  /**
   * Get invalidation promises for church-related updates
   */
  private async getChurchInvalidationPromises(
    churchId: string,
    options: CacheInvalidationOptions
  ): Promise<Promise<boolean>[]> {
    const promises: Promise<boolean>[] = [];

    // If we have the church path and context, use smart invalidation
    if (options.churchPath) {
      const urls = getCacheUrlsForChurch(churchId, options.churchPath, options.countyPath, options.networkIds || []);

      // Delete all related URLs
      promises.push(...urls.map((url) => this.deleteFromCache(url)));
    } else {
      // Fallback to basic invalidation
      promises.push(this.deleteFromCache('/'));
      promises.push(this.deleteFromCache('/churches.json'));
      promises.push(this.deleteFromCache('/churches.yaml'));
      promises.push(this.deleteFromCache('/churches.csv'));
      promises.push(this.deleteFromCache('/data'));
      promises.push(this.deleteFromCache('/map'));
    }

    return promises;
  }

  /**
   * Get invalidation promises for county-related updates
   */
  private getCountyInvalidationPromises(_countyId: string): Promise<boolean>[] {
    const promises: Promise<boolean>[] = [];

    // Invalidate homepage (county info may change)
    promises.push(this.deleteFromCache('/'));

    // Note: Without county path, we can't invalidate specific county pages
    // In practice, county updates are rare, so homepage invalidation may be sufficient

    return promises;
  }

  /**
   * Get invalidation promises for affiliation-related updates
   */
  private getAffiliationInvalidationPromises(_affiliationId: string): Promise<boolean>[] {
    const promises: Promise<boolean>[] = [];

    // Invalidate networks pages
    promises.push(this.deleteFromCache('/networks'));

    // Invalidate data exports (affiliation data may change)
    promises.push(this.deleteFromCache('/churches.json'));
    promises.push(this.deleteFromCache('/churches.yaml'));
    promises.push(this.deleteFromCache('/churches.csv'));

    // Note: Similar to counties, we can't easily invalidate specific network pages
    // without knowing the affiliation path

    return promises;
  }

  /**
   * Clear all cached content (nuclear option for settings updates)
   */
  private async clearAllCache(): Promise<void> {
    console.log('Clearing all cache due to settings update...');

    // For settings changes that affect all pages (like logo, favicon, site title),
    // we need to clear ALL cached pages. Since we can't enumerate all possible URLs,
    // we'll clear the most common ones and rely on the 7-day TTL for the rest.
    const urlsToInvalidate = [
      '/',
      '/networks',
      '/map',
      '/data',
      '/churches.json',
      '/churches.yaml',
      '/churches.csv',
      '/churches.xlsx',
    ];

    // Also get some specific pages from the database to invalidate
    const db = createDbWithContext(this.c);

    try {
      // Get all county paths
      const countyPaths = await db
        .select({ path: counties.path })
        .from(counties)
        .where(isNull(counties.deletedAt))
        .all();

      countyPaths.forEach((county) => {
        urlsToInvalidate.push(`/counties/${county.path}`);
      });

      // Get all network paths
      const networkPaths = await db
        .select({ id: affiliations.id, path: affiliations.path })
        .from(affiliations)
        .where(isNull(affiliations.deletedAt))
        .all();

      networkPaths.forEach((network) => {
        urlsToInvalidate.push(`/networks/${network.path || network.id}`);
      });

      // Get custom pages
      const { pages } = await import('../db/schema');
      const customPages = await db.select({ path: pages.path }).from(pages).all();

      customPages.forEach((page) => {
        urlsToInvalidate.push(`/${page.path}`);
      });

      // For individual church pages, we'll just clear a sample
      // (too many to clear all, they'll expire via TTL)
      const sampleChurches = await db
        .select({ path: churches.path })
        .from(churches)
        .where(isNull(churches.deletedAt))
        .limit(20)
        .all();

      sampleChurches.forEach((church) => {
        urlsToInvalidate.push(`/churches/${church.path}`);
      });
    } catch (error) {
      console.error('Error fetching paths for cache invalidation:', error);
    }

    console.log(`Invalidating ${urlsToInvalidate.length} cached URLs...`);
    const promises = urlsToInvalidate.map((path) => this.deleteFromCache(path));
    await Promise.allSettled(promises);
  }
}

/**
 * Convenience function to invalidate cache from a Hono context
 */
export async function invalidateCache(c: Context, options: CacheInvalidationOptions): Promise<void> {
  const invalidator = new CacheInvalidator(c);
  await invalidator.invalidate(options);
}

/**
 * Convenience functions for common invalidation scenarios
 */
export const cacheInvalidation = {
  /**
   * Invalidate cache when a church is created, updated, or deleted
   */
  church: (c: Context, churchId: string) => invalidateCache(c, { churchId }),

  /**
   * Invalidate cache when a county is updated
   */
  county: (c: Context, countyId: string) => invalidateCache(c, { countyId }),

  /**
   * Invalidate cache when an affiliation is updated
   */
  affiliation: (c: Context, affiliationId: string) => invalidateCache(c, { affiliationId }),

  /**
   * Invalidate all cache when settings are updated
   */
  settings: (c: Context) => invalidateCache(c, { clearAll: true }),

  /**
   * Invalidate cache for multiple entities (useful for bulk operations)
   */
  multiple: (c: Context, options: CacheInvalidationOptions) => invalidateCache(c, options),
};
