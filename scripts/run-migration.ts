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
    console.log('Running pages table migration...');
    
    // Create pages table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS pages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        content TEXT,
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