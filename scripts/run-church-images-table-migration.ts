import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables from .dev.vars
const envPath = join(process.cwd(), '.dev.vars');
const envContent = readFileSync(envPath, 'utf-8');
const envVars = Object.fromEntries(
  envContent
    .split('\n')
    .filter((line) => line.includes('='))
    .map((line) => {
      const [key, ...valueParts] = line.split('=');
      return [key.trim(), valueParts.join('=').trim()];
    })
);

const client = createClient({
  url: envVars.TURSO_DATABASE_URL!,
  authToken: envVars.TURSO_AUTH_TOKEN!,
});

async function runMigration() {
  try {
    console.log('Running church_images table migration...');
    
    // Create church_images table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS church_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        church_id INTEGER NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
        image_id TEXT NOT NULL,
        image_url TEXT NOT NULL,
        caption TEXT,
        display_order INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
        updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
      )
    `);
    
    console.log('Created church_images table');
    
    // Create indices
    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_church_images_church_id ON church_images(church_id)
    `);
    
    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_church_images_display_order ON church_images(display_order)
    `);
    
    console.log('Created indices');
    
    // Migrate existing single images from churches table to church_images table
    console.log('Migrating existing church images...');
    
    const churches = await client.execute(`
      SELECT id, image_id, image_url 
      FROM churches 
      WHERE image_id IS NOT NULL AND image_url IS NOT NULL
    `);
    
    for (const church of churches.rows) {
      await client.execute({
        sql: `
          INSERT INTO church_images (church_id, image_id, image_url, display_order, created_at, updated_at)
          VALUES (?, ?, ?, 0, unixepoch(), unixepoch())
        `,
        args: [church.id, church.image_id, church.image_url]
      });
    }
    
    console.log(`Migrated ${churches.rows.length} existing church images`);
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.close();
  }
}

runMigration();