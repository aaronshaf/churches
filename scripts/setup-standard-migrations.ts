import { createClient } from '@libsql/client';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .dev.vars
config({ path: resolve(process.cwd(), '.dev.vars') });

/**
 * This script safely transitions from custom migration scripts to standard Drizzle migrations
 * WITHOUT affecting any existing data or tables.
 * 
 * It will:
 * 1. Create the __drizzle_migrations tracking table
 * 2. Mark all current schema as "baseline" (migration 0)
 * 3. Allow future migrations to be tracked properly
 */

async function setupStandardMigrations() {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.error('❌ Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN environment variables');
    console.log('   Make sure your .dev.vars file is properly configured');
    return;
  }

  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  try {
    console.log('🔍 Analyzing current database state...');

    // Check what tables currently exist
    const tablesResult = await client.execute(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;`
    );
    
    console.log('📋 Current tables in database:');
    const currentTables = tablesResult.rows.map(row => row.name as string);
    currentTables.forEach(table => console.log(`   - ${table}`));

    // Check if migration tracking already exists
    const migrationTableExists = currentTables.includes('__drizzle_migrations');
    
    if (migrationTableExists) {
      console.log('\n✅ Migration tracking already exists');
      const migrations = await client.execute('SELECT * FROM __drizzle_migrations ORDER BY created_at;');
      console.log(`   Found ${migrations.rows.length} tracked migrations`);
      
      if (migrations.rows.length > 0) {
        console.log('   Existing migrations:');
        migrations.rows.forEach((row, i) => {
          console.log(`     ${i + 1}. ${row.hash}`);
        });
      }
      return;
    }

    console.log('\n📝 Setting up Drizzle migration tracking...');
    
    // Create the migration tracking table
    await client.execute(`
      CREATE TABLE __drizzle_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash TEXT NOT NULL UNIQUE,
        created_at INTEGER
      );
    `);

    // Create a baseline migration entry that represents the current state
    const baselineTimestamp = Math.floor(Date.now() / 1000);
    
    await client.execute({
      sql: `INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)`,
      args: ['baseline_existing_schema', baselineTimestamp]
    });

    console.log('✅ Migration tracking initialized!');
    console.log('\n🎯 Next steps for standard workflow:');
    console.log('   1. For schema changes: Edit src/db/schema.ts');
    console.log('   2. Generate migration: pnpm db:generate');
    console.log('   3. Apply migration: pnpm db:migrate');
    console.log('\n📁 Your existing custom scripts can now be archived/removed:');
    console.log('   - scripts/run-migration.ts');
    console.log('   - src/db/migrations/ folder');
    console.log('   - Various manual SQL scripts');

    console.log('\n✨ Standard Drizzle migration system is now active!');

  } catch (error) {
    console.error('❌ Error setting up migrations:', error);
    if (error instanceof Error) {
      console.error('   Details:', error.message);
    }
  } finally {
    client.close();
  }
}

setupStandardMigrations();