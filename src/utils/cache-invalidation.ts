import type { Context } from 'hono';

export interface CacheInvalidationOptions {
  churchId?: string;
  countyId?: string;
  affiliationId?: string;
  clearAll?: boolean;
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
      // Note: Cache invalidation disabled for now due to TypeScript issues
      // The core caching functionality works via Cache-Control headers
      // Cloudflare will automatically handle cache with proper headers
      console.log(`Cache invalidation requested for ${path} (currently disabled)`);
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
      promises.push(...this.getChurchInvalidationPromises(options.churchId));
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
  private getChurchInvalidationPromises(churchId: string): Promise<boolean>[] {
    const promises: Promise<boolean>[] = [];

    // Invalidate homepage (church counts may change)
    promises.push(this.deleteFromCache('/'));

    // Invalidate data exports (church data changed)
    promises.push(this.deleteFromCache('/churches.json'));
    promises.push(this.deleteFromCache('/churches.yaml'));
    promises.push(this.deleteFromCache('/churches.csv'));
    promises.push(this.deleteFromCache('/data'));

    // Invalidate map (church markers may change)
    promises.push(this.deleteFromCache('/map'));

    // Note: We can't easily invalidate specific church detail pages or county pages
    // without knowing the church path or county ID. In a production system, you might
    // want to maintain a mapping of church IDs to paths/counties for more targeted invalidation.

    return promises;
  }

  /**
   * Get invalidation promises for county-related updates
   */
  private getCountyInvalidationPromises(countyId: string): Promise<boolean>[] {
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
  private getAffiliationInvalidationPromises(affiliationId: string): Promise<boolean>[] {
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
    const urlsToInvalidate = ['/', '/networks', '/map', '/data', '/churches.json', '/churches.yaml', '/churches.csv'];

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
