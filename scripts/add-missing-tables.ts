import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { sql } from 'drizzle-orm';

async function addMissingTables() {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    throw new Error('Missing required environment variables');
  }

  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const db = drizzle(client);

  try {
    console.log('🔧 Adding missing tables...\n');
    
    // 1. Create comments table
    console.log('1. Creating comments table...');
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        church_id INTEGER NOT NULL REFERENCES churches(id),
        content TEXT NOT NULL,
        type TEXT DEFAULT 'user' CHECK (type IN ('user', 'system')),
        metadata TEXT,
        is_public INTEGER NOT NULL DEFAULT 1,
        status TEXT DEFAULT 'pending',
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);
    console.log('✅ Created comments table');
    
    // 2. Create church_suggestions table
    console.log('\n2. Creating church_suggestions table...');
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS church_suggestions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        church_name TEXT NOT NULL,
        denomination TEXT,
        address TEXT,
        city TEXT,
        state TEXT DEFAULT 'UT',
        zip TEXT,
        website TEXT,
        phone TEXT,
        email TEXT,
        facebook TEXT,
        instagram TEXT,
        youtube TEXT,
        spotify TEXT,
        service_times TEXT,
        statement_of_faith TEXT,
        status TEXT DEFAULT 'pending',
        admin_notes TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);
    console.log('✅ Created church_suggestions table');
    
    // 3. Add show_in_navbar to pages if missing
    console.log('\n3. Checking pages table...');
    try {
      await db.run(sql`ALTER TABLE pages ADD COLUMN show_in_navbar INTEGER DEFAULT 0`);
      console.log('✅ Added show_in_navbar column to pages');
    } catch (e) {
      console.log('ℹ️  show_in_navbar column already exists');
    }
    
    console.log('\n✅ Successfully added missing tables!');
    console.log('\nNote: The service_times column will remain in the churches table for now.');
    console.log('This is harmless since all data has been migrated to church_gatherings.');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.close();
  }
}

addMissingTables().catch(console.error);