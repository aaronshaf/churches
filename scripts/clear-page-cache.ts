#!/usr/bin/env bun

/**
 * Script to clear cached pages that are missing the logo
 * This is needed when settings like logo_url are updated but pages are still cached
 */

import { deleteFromCache } from '../src/utils/cf-cache';

// URLs that need cache clearing
const urlsToClear = [
  '/counties/salt-lake',
  '/networks',
  '/resources',
  '/churches/la-iglesia-mountain-life',
  // Add more specific URLs as needed
];

async function clearPageCache() {
  console.log('🧹 Clearing page cache for URLs missing logo...\n');

  for (const url of urlsToClear) {
    try {
      // Create a mock request object
      const request = new Request(`https://utahchurches.com${url}`);

      await deleteFromCache(request);
      console.log(`✅ Cleared cache for: ${url}`);
    } catch (error) {
      console.error(`❌ Failed to clear cache for ${url}:`, error);
    }
  }

  console.log('\n✨ Cache clearing complete!');
  console.log('The pages should now show the logo on next visit.');
}

// Run the script
clearPageCache().catch(console.error);
