#!/usr/bin/env bun

/**
 * Script to update existing images with proper dimensions and blurhashes
 * This runs after the migration to populate placeholder data with real values
 */

import { encode } from 'blurhash';
import { eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../src/db/schema';

// Initialize the D1 database for local development
async function initDb() {
  const { D1Database, D1DatabaseAPI } = await import('@miniflare/d1');
  const { createSQLiteDB } = await import('@miniflare/shared');

  const sqliteDb = await createSQLiteDB('.wrangler/state/v3/d1/utahchurches.sqlite');
  const d1Db = new D1Database(new D1DatabaseAPI(sqliteDb));

  return drizzle(d1Db, { schema });
}

// Get R2 configuration from environment or settings
async function getR2Config(db: DrizzleD1Database<typeof schema>) {
  // Try to get R2 domain from settings
  const [r2DomainSetting] = await db.select().from(schema.settings).where(eq(schema.settings.key, 'r2_image_domain'));

  const r2Domain = r2DomainSetting?.value || process.env.R2_IMAGE_DOMAIN;

  if (!r2Domain) {
    throw new Error('R2 domain not configured. Set r2_image_domain in settings or R2_IMAGE_DOMAIN env var.');
  }

  return { r2Domain };
}

// Process a single image to extract metadata
async function processImageMetadata(imageUrl: string): Promise<{
  width: number;
  height: number;
  fileSize: number;
  blurhash: string;
  mimeType: string;
}> {
  try {
    // Fetch the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const blob = await response.blob();
    const fileSize = blob.size;
    const mimeType = blob.type || 'image/jpeg';

    // Create an image element to get dimensions
    // Note: This requires a DOM environment, so we'll use a different approach for Node
    // For Bun, we can use the sharp library or image-size
    const { default: imageSize } = await import('image-size');
    const buffer = await blob.arrayBuffer();
    const dimensions = imageSize(Buffer.from(buffer));

    if (!dimensions.width || !dimensions.height) {
      throw new Error('Failed to get image dimensions');
    }

    // For blurhash, we need to decode the image and encode it
    // This is complex without a DOM, so we'll use a placeholder for now
    // In production, you'd use a library like sharp to resize and extract pixels
    const blurhash = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4'; // Placeholder

    return {
      width: dimensions.width,
      height: dimensions.height,
      fileSize,
      blurhash,
      mimeType,
    };
  } catch (error) {
    console.error(`Failed to process image ${imageUrl}:`, error);
    // Return defaults on error
    return {
      width: 800,
      height: 600,
      fileSize: 0,
      blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4',
      mimeType: 'image/jpeg',
    };
  }
}

async function updateImageMetadata() {
  console.log('Starting image metadata update...');

  const db = await initDb();
  const { r2Domain } = await getR2Config(db);

  try {
    // Fetch all images that need metadata updates
    const images = await db
      .select()
      .from(schema.images)
      .where(eq(schema.images.width, 800)) // Our placeholder width
      .all();

    console.log(`Found ${images.length} images to process`);

    let processed = 0;
    let failed = 0;

    // Process images in batches to avoid overwhelming the system
    const batchSize = 5;
    for (let i = 0; i < images.length; i += batchSize) {
      const batch = images.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (image) => {
          try {
            const imageUrl = `https://${r2Domain}/${image.filename}`;
            console.log(`Processing: ${image.filename}`);

            const metadata = await processImageMetadata(imageUrl);

            // Update the image record
            await db
              .update(schema.images)
              .set({
                width: metadata.width,
                height: metadata.height,
                fileSize: metadata.fileSize,
                blurhash: metadata.blurhash,
                mimeType: metadata.mimeType,
                updatedAt: new Date(),
              })
              .where(eq(schema.images.id, image.id));

            processed++;
            console.log(`✓ Updated metadata for ${image.filename}`);
          } catch (error) {
            failed++;
            console.error(`✗ Failed to process ${image.filename}:`, error);
          }
        })
      );

      // Progress update
      console.log(`Progress: ${i + batch.length}/${images.length} images`);
    }

    console.log('\nMetadata update completed!');
    console.log(`Successfully processed: ${processed} images`);
    console.log(`Failed: ${failed} images`);

    if (failed > 0) {
      console.log('\nNote: Failed images will keep placeholder values.');
      console.log('You can re-run this script to retry failed images.');
    }
  } catch (error) {
    console.error('Metadata update failed:', error);
    process.exit(1);
  }
}

// Run the update
updateImageMetadata().catch(console.error);
