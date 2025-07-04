import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { sql } from 'drizzle-orm';

async function manualSchemaSync() {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    throw new Error('Missing required environment variables');
  }

  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const db = drizzle(client);

  try {
    console.log('🔧 Manually syncing schema...\n');
    
    // 1. Drop service_times column (need to recreate table in SQLite)
    console.log('1. Handling service_times column...');
    // SQLite doesn't support dropping columns directly, so we'll create a new table
    
    // Create new churches table without service_times
    await db.run(sql`
      CREATE TABLE churches_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        path TEXT UNIQUE,
        status TEXT,
        private_notes TEXT,
        public_notes TEXT,
        last_updated INTEGER,
        gathering_address TEXT,
        latitude REAL,
        longitude REAL,
        county_id INTEGER REFERENCES counties(id),
        website TEXT,
        statement_of_faith TEXT,
        phone TEXT,
        email TEXT,
        facebook TEXT,
        instagram TEXT,
        youtube TEXT,
        spotify TEXT,
        language TEXT NOT NULL DEFAULT 'English',
        image_id TEXT,
        image_url TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);
    
    // Copy data (excluding service_times)
    await db.run(sql`
      INSERT INTO churches_new 
      SELECT 
        id, name, path, status, private_notes, public_notes, last_updated,
        gathering_address, latitude, longitude, county_id, website,
        statement_of_faith, phone, email, facebook, instagram, youtube,
        spotify, language, image_id, image_url, created_at, updated_at
      FROM churches
    `);
    
    // Drop old table and rename new one
    await db.run(sql`DROP TABLE churches`);
    await db.run(sql`ALTER TABLE churches_new RENAME TO churches`);
    console.log('✅ Removed service_times column');
    
    // 2. Create comments table
    console.log('\n2. Creating comments table...');
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
    
    // 3. Create church_suggestions table
    console.log('\n3. Creating church_suggestions table...');
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
    
    // 4. Update pages table to add showInNavbar if missing
    console.log('\n4. Checking pages table...');
    try {
      await db.run(sql`ALTER TABLE pages ADD COLUMN show_in_navbar INTEGER DEFAULT 0`);
      console.log('✅ Added show_in_navbar column to pages');
    } catch (e) {
      console.log('ℹ️  show_in_navbar column already exists or error adding it');
    }
    
    console.log('\n✅ Manual schema sync complete!');
    console.log('\nYour database schema should now match the application schema.');
    console.log('The audit trail system with comments table is ready to use.');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.close();
  }
}

manualSchemaSync().catch(console.error);