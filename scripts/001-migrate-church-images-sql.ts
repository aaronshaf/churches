#!/usr/bin/env bun

/**
 * Direct SQL migration script to move existing church_images data to the new image system
 */

import { execSync } from 'child_process';

const migrationSQL = `
-- Step 1: Check if we have any data to migrate
SELECT COUNT(*) as count FROM church_images;

-- Step 2: Insert unique images into the images table
INSERT INTO images (filename, original_filename, mime_type, file_size, width, height, blurhash, alt_text, caption, uploaded_by, created_at, updated_at)
SELECT DISTINCT
  image_path as filename,
  image_path as original_filename,
  'image/jpeg' as mime_type,
  0 as file_size,
  800 as width,
  600 as height,
  'L6PZfSi_.AyE_3t7t7R**0o#DgR4' as blurhash,
  image_alt as alt_text,
  caption,
  NULL as uploaded_by,
  created_at,
  updated_at
FROM church_images
WHERE image_path IS NOT NULL;

-- Step 3: Create entries in church_images_new
INSERT INTO church_images_new (church_id, image_id, display_order, is_primary, created_at)
SELECT 
  ci.church_id,
  i.id as image_id,
  ci.sort_order as display_order,
  ci.is_featured as is_primary,
  ci.created_at
FROM church_images ci
INNER JOIN images i ON i.filename = ci.image_path;

-- Step 4: Update churches table to remove old image fields if they have images in the new system
UPDATE churches 
SET image_path = NULL, image_alt = NULL
WHERE id IN (
  SELECT DISTINCT church_id 
  FROM church_images_new
);

-- Step 5: Report migration results
SELECT 
  (SELECT COUNT(*) FROM church_images) as original_count,
  (SELECT COUNT(*) FROM images) as images_created,
  (SELECT COUNT(*) FROM church_images_new) as relationships_created,
  (SELECT COUNT(*) FROM churches WHERE image_path IS NULL) as churches_updated;
`;

async function runMigration() {
  console.log('Starting church images migration...');

  try {
    // Write migration SQL to a temporary file
    const fs = await import('fs/promises');
    const tmpFile = '/tmp/church-images-migration.sql';
    await fs.writeFile(tmpFile, migrationSQL);

    // Execute the migration
    console.log('Executing migration SQL...');
    const result = execSync(`bun run wrangler d1 execute DB --local --file=${tmpFile}`, {
      encoding: 'utf-8',
    });

    console.log('Migration output:', result);

    // Clean up
    await fs.unlink(tmpFile);

    console.log('Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Run the image metadata update script to fetch real dimensions and blurhashes');
    console.log('2. Test the application thoroughly');
    console.log('3. Once verified, you can drop the old church_images table');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration().catch(console.error);
