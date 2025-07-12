#!/usr/bin/env bun

/**
 * Script to set the r2_image_domain setting in the database
 */

import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { settings } from '../src/db/schema';

// This will be replaced with actual D1 binding in production
const DB_PATH = './.wrangler/state/v3/d1/DB.sqlite3';

async function setR2Domain() {
  try {
    console.log('Setting r2_image_domain in database...');

    // For local development - in production this would use the D1 binding
    console.log('Note: In production, use wrangler CLI to set this:');
    console.log(
      "wrangler d1 execute utahchurches-production --command=\"INSERT OR REPLACE INTO settings (key, value, created_at, updated_at) VALUES ('r2_image_domain', 'images.utahchurches.com', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)\""
    );

    const domain = 'images.utahchurches.com';

    console.log(`Setting r2_image_domain to: ${domain}`);
    console.log('This setting will be used for generating image URLs.');
    console.log('');
    console.log('Manual SQL command for production:');
    console.log(
      `INSERT OR REPLACE INTO settings (key, value, created_at, updated_at) VALUES ('r2_image_domain', '${domain}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`
    );
  } catch (error) {
    console.error('Error setting r2_image_domain:', error);
    process.exit(1);
  }
}

setR2Domain();
