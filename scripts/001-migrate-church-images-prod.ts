#!/usr/bin/env bun

/**
 * Production migration script for church images
 */

import { execSync } from 'child_process';

async function runProductionMigration() {
  console.log('Starting production church images migration...');

  try {
    // Step 1: Check current state
    console.log('\n1. Checking current data...');
    const countResult = execSync(
      'bun run wrangler d1 execute DB --remote --json --command="SELECT COUNT(*) as count FROM church_images"',
      {
        encoding: 'utf-8',
      }
    );
    const count = JSON.parse(countResult)[0].results[0].count;
    console.log(`Found ${count} church images to migrate`);

    if (count === 0) {
      console.log('No images to migrate');
      return;
    }

    // Step 2: Insert unique images
    console.log('\n2. Inserting unique images into images table...');
    const insertImagesSQL = `
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
WHERE image_path IS NOT NULL
`;

    execSync(
      `bun run wrangler d1 execute DB --remote --command="${insertImagesSQL.replace(/\n/g, ' ').replace(/"/g, '\\"')}"`,
      {
        encoding: 'utf-8',
      }
    );
    console.log('Images inserted successfully');

    // Step 3: Create relationships
    console.log('\n3. Creating church-image relationships...');
    const createRelationshipsSQL = `
INSERT INTO church_images_new (church_id, image_id, display_order, is_primary, created_at)
SELECT 
  ci.church_id,
  i.id as image_id,
  ci.sort_order as display_order,
  ci.is_featured as is_primary,
  ci.created_at
FROM church_images ci
INNER JOIN images i ON i.filename = ci.image_path
`;

    execSync(
      `bun run wrangler d1 execute DB --remote --command="${createRelationshipsSQL.replace(/\n/g, ' ').replace(/"/g, '\\"')}"`,
      {
        encoding: 'utf-8',
      }
    );
    console.log('Relationships created successfully');

    // Step 4: Update churches table
    console.log('\n4. Updating churches table...');
    const updateChurchesSQL = `
UPDATE churches 
SET image_path = NULL, image_alt = NULL
WHERE id IN (
  SELECT DISTINCT church_id 
  FROM church_images_new
)
`;

    execSync(
      `bun run wrangler d1 execute DB --remote --command="${updateChurchesSQL.replace(/\n/g, ' ').replace(/"/g, '\\"')}"`,
      {
        encoding: 'utf-8',
      }
    );
    console.log('Churches updated successfully');

    // Step 5: Report results
    console.log('\n5. Checking migration results...');
    const resultsSQL = `
SELECT 
  (SELECT COUNT(*) FROM images) as images_created,
  (SELECT COUNT(*) FROM church_images_new) as relationships_created,
  (SELECT COUNT(*) FROM churches WHERE image_path IS NULL) as churches_updated
`;

    const resultsStr = execSync(
      `bun run wrangler d1 execute DB --remote --json --command="${resultsSQL.replace(/\n/g, ' ').replace(/"/g, '\\"')}"`,
      {
        encoding: 'utf-8',
      }
    );
    const results = JSON.parse(resultsStr)[0].results[0];

    console.log('\n✅ Migration completed successfully!');
    console.log(`- Images created: ${results.images_created}`);
    console.log(`- Relationships created: ${results.relationships_created}`);
    console.log(`- Churches updated: ${results.churches_updated}`);

    console.log('\n📋 Next steps:');
    console.log('1. Run the image metadata update script to fetch real dimensions and blurhashes');
    console.log('2. Test the application thoroughly');
    console.log('3. Once verified, the old church_images table can be dropped');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('\nNote: If the migration partially completed, you may need to manually clean up.');
    process.exit(1);
  }
}

runProductionMigration().catch(console.error);
