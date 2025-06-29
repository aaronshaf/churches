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
    console.log('Checking if migrations are needed...');
    
    // Check if image fields already exist on pages table
    try {
      await client.execute('SELECT featured_image_id FROM pages LIMIT 1');
      console.log('Pages table already has image fields');
    } catch (error) {
      console.log('Adding image fields to pages table...');
      await client.execute(`
        ALTER TABLE pages ADD COLUMN featured_image_id TEXT;
      `);
      await client.execute(`
        ALTER TABLE pages ADD COLUMN featured_image_url TEXT;
      `);
      console.log('Added image fields to pages table');
    }
    
    // Check if image fields already exist on churches table
    try {
      await client.execute('SELECT image_id FROM churches LIMIT 1');
      console.log('Churches table already has image fields');
    } catch (error) {
      console.log('Adding image fields to churches table...');
      await client.execute(`
        ALTER TABLE churches ADD COLUMN image_id TEXT;
      `);
      await client.execute(`
        ALTER TABLE churches ADD COLUMN image_url TEXT;
      `);
      console.log('Added image fields to churches table');
    }
    
    console.log('All migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.close();
  }
}

runMigration();