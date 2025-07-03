import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';
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
    console.log('Running database migration...');
    
    // Add image column to users table if it doesn't exist
    try {
      await client.execute(`
        ALTER TABLE users ADD COLUMN image TEXT;
      `);
      console.log('Added image column to users table');
    } catch (error) {
      // Column might already exist, which is fine
      console.log('Image column already exists or error adding it:', error.message);
    }
    
    // Create pages table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS pages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        content TEXT,
        featured_image_id TEXT,
        featured_image_url TEXT,
        navbar_order INTEGER,
        created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
        updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
      )
    `);
    
    // Create comments table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        church_id INTEGER REFERENCES churches(id),
        content TEXT NOT NULL,
        is_public INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        reviewed_by TEXT,
        reviewed_at INTEGER,
        created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
        updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
      )
    `);
    
    // Create church_suggestions table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS church_suggestions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        church_name TEXT NOT NULL,
        address TEXT,
        city TEXT,
        state TEXT DEFAULT 'UT',
        zip TEXT,
        website TEXT,
        phone TEXT,
        email TEXT,
        notes TEXT,
        status TEXT DEFAULT 'pending',
        reviewed_by TEXT,
        reviewed_at INTEGER,
        created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
        updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
      )
    `);
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.close();
  }
}

runMigration();