import { createClient } from '@libsql/client';
import 'dotenv/config';

/**
 * This script safely initializes Drizzle's migration tracking system
 * for an existing database without affecting any data.
 * 
 * It marks existing migrations as "already applied" so future migrations
 * can be tracked properly.
 */

async function initializeDrizzleMigrations() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  try {
    console.log('🔍 Checking current database state...');

    // Check if migration table already exists
    const migrationTableExists = await client.execute(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations';`
    );

    if (migrationTableExists.rows.length > 0) {
      console.log('✅ __drizzle_migrations table already exists');
      const existing = await client.execute('SELECT * FROM __drizzle_migrations;');
      console.log(`   Found ${existing.rows.length} tracked migrations`);
      return;
    }

    console.log('📝 Creating __drizzle_migrations table...');
    
    // Create the migration tracking table
    await client.execute(`
      CREATE TABLE __drizzle_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash TEXT NOT NULL UNIQUE,
        created_at INTEGER
      );
    `);

    // Mark existing migrations as applied (based on your drizzle/ folder)
    // These are the migrations you already have in /drizzle/
    const existingMigrations = [
      '0000_sleepy_piledriver', // Initial schema
      '0001_cloudy_wild_pack',  // Auth tables
      '0002_add_performance_indices', // Performance indices
      '0003_add_language_field' // Language field
    ];

    console.log('📋 Marking existing migrations as applied...');
    const now = Math.floor(Date.now() / 1000);
    
    for (const [index, migration] of existingMigrations.entries()) {
      await client.execute({
        sql: 'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
        args: [migration, now + index] // Slight time offset for ordering
      });
      console.log(`   ✓ ${migration}`);
    }

    console.log('🎉 Drizzle migration tracking initialized successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Future schema changes: Edit src/db/schema.ts');
    console.log('2. Generate migration: pnpm db:generate');
    console.log('3. Apply migration: pnpm db:migrate');
    console.log('');
    console.log('⚠️  You can now remove custom migration scripts from /scripts/');

  } catch (error) {
    console.error('❌ Error initializing migrations:', error);
  } finally {
    client.close();
  }
}

initializeDrizzleMigrations();