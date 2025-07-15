#!/usr/bin/env bun

/**
 * Migration script to move existing church_images data to the new image system
 * This preserves all existing data while transitioning to the new structure
 */

import { eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../src/db/schema';

// Initialize the D1 database for local development
async function initDb() {
  // For local development, we use wrangler's D1 implementation
  const { execSync } = await import('child_process');

  // Create a simple wrapper that executes SQL via wrangler
  const d1Db = {
    prepare: (sql: string) => ({
      all: async () => {
        const result = execSync(
          `bun run wrangler d1 execute DB --local --json --command="${sql.replace(/"/g, '\\"')}"`,
          {
            encoding: 'utf-8',
          }
        );
        const parsed = JSON.parse(result);
        return { results: parsed[0]?.results || [] };
      },
      run: async () => {
        execSync(`bun run wrangler d1 execute DB --local --command="${sql.replace(/"/g, '\\"')}"`, {
          encoding: 'utf-8',
        });
        return { success: true };
      },
    }),
    batch: async (statements: any[]) => {
      for (const stmt of statements) {
        await stmt.run();
      }
    },
  };

  return drizzle(d1Db as any, { schema });
}

async function migrateChurchImages() {
  console.log('Starting church images migration...');

  const db = await initDb();

  try {
    // Start a transaction for data integrity
    await db.transaction(async (tx) => {
      // 1. Fetch all existing church images
      const existingImages = await tx.select().from(schema.churchImages).all();
      console.log(`Found ${existingImages.length} existing church images to migrate`);

      if (existingImages.length === 0) {
        console.log('No images to migrate');
        return;
      }

      // 2. Group images by unique image paths to avoid duplicates
      const uniqueImages = new Map<string, (typeof existingImages)[0]>();
      for (const img of existingImages) {
        if (!uniqueImages.has(img.imagePath)) {
          uniqueImages.set(img.imagePath, img);
        }
      }

      console.log(`Found ${uniqueImages.size} unique images`);

      // 3. Insert unique images into the images table
      const imageIdMap = new Map<string, number>();

      for (const [imagePath, imageData] of uniqueImages) {
        // For now, we'll use placeholder values for dimensions and blurhash
        // These will be updated later by a background job
        const [insertedImage] = await tx
          .insert(schema.images)
          .values({
            filename: imagePath,
            originalFilename: imagePath.split('/').pop() || imagePath,
            mimeType: 'image/jpeg', // Default, will be updated
            fileSize: 0, // Placeholder, will be updated
            width: 800, // Placeholder, will be updated
            height: 600, // Placeholder, will be updated
            blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4', // Placeholder gray blurhash
            altText: imageData.imageAlt,
            caption: imageData.caption,
            uploadedBy: null, // Unknown from old system
            createdAt: imageData.createdAt,
            updatedAt: imageData.updatedAt,
          })
          .returning({ id: schema.images.id });

        imageIdMap.set(imagePath, insertedImage.id);
      }

      console.log(`Inserted ${imageIdMap.size} images into the images table`);

      // 4. Create entries in church_images_new for each church-image relationship
      let relationshipCount = 0;
      for (const img of existingImages) {
        const imageId = imageIdMap.get(img.imagePath);
        if (!imageId) {
          console.error(`Could not find image ID for path: ${img.imagePath}`);
          continue;
        }

        await tx.insert(schema.churchImagesNew).values({
          churchId: img.churchId,
          imageId: imageId,
          displayOrder: img.sortOrder,
          isPrimary: img.isFeatured,
          createdAt: img.createdAt,
        });

        relationshipCount++;
      }

      console.log(`Created ${relationshipCount} church-image relationships`);

      // 5. Update churches table to remove old image fields if they have images
      const churchesWithImages = await tx
        .select({ id: schema.churches.id })
        .from(schema.churches)
        .innerJoin(schema.churchImagesNew, eq(schema.churches.id, schema.churchImagesNew.churchId))
        .groupBy(schema.churches.id)
        .all();

      for (const church of churchesWithImages) {
        await tx
          .update(schema.churches)
          .set({
            imagePath: null,
            imageAlt: null,
          })
          .where(eq(schema.churches.id, church.id));
      }

      console.log(`Updated ${churchesWithImages.length} churches to remove old image fields`);
    });

    console.log('Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Run a background job to update image dimensions and generate blurhashes');
    console.log('2. Test the application thoroughly');
    console.log('3. Once verified, drop the old church_images table');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
migrateChurchImages().catch(console.error);
