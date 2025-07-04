import { createClient } from '@libsql/client';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .dev.vars
config({ path: resolve(process.cwd(), '.dev.vars') });

async function resetMigrationSystem() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  try {
    console.log('🔍 Resetting migration tracking system...');

    // Clear all migration entries (safe - this is just tracking data)
    await client.execute('DELETE FROM __drizzle_migrations;');
    console.log('✅ Cleared migration tracking entries');

    // Mark all existing migrations in /drizzle/ as baseline (already applied)
    const baselineTimestamp = Math.floor(Date.now() / 1000);
    
    // Mark the original migrations as applied (the good ones)
    const existingMigrations = [
      '0000_sleepy_piledriver',  // Original schema
      '0001_cloudy_wild_pack',   // Auth updates  
      '0002_add_performance_indices', // Performance indices
      '0003_add_language_field'  // Language field
    ];

    console.log('📝 Marking safe migrations as applied...');
    for (const [index, migration] of existingMigrations.entries()) {
      await client.execute({
        sql: 'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
        args: [migration, baselineTimestamp + index]
      });
      console.log(`   ✓ ${migration}`);
    }

    console.log('');
    console.log('⚠️  IMPORTANT: You should now:');
    console.log('   1. DELETE the problematic migration file: drizzle/0000_sparkling_northstar.sql');
    console.log('   2. Reset the journal to clean state');
    console.log('   3. Your database schema is already correct - no changes needed');
    console.log('');
    console.log('✅ Migration system reset completed safely!');

  } catch (error) {
    console.error('❌ Error resetting migration system:', error);
  } finally {
    client.close();
  }
}

resetMigrationSystem();