import { createClient } from '@libsql/client';
import 'dotenv/config';

async function checkMigrationState() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  try {
    // Check current tables
    console.log('=== Current Database Tables ===');
    const tablesResult = await client.execute(
      `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;`
    );
    tablesResult.rows.forEach(row => console.log(`  - ${row.name}`));

    // Check if __drizzle_migrations table exists
    console.log('\n=== Migration Tracking Table ===');
    const migrationTableExists = await client.execute(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations';`
    );
    
    if (migrationTableExists.rows.length > 0) {
      console.log('✅ __drizzle_migrations table exists');
      
      const migrations = await client.execute(
        'SELECT * FROM __drizzle_migrations ORDER BY created_at;'
      );
      console.log('Applied migrations:');
      migrations.rows.forEach((row, i) => {
        console.log(`  ${i + 1}. ${row.hash} (${row.created_at})`);
      });
    } else {
      console.log('❌ __drizzle_migrations table does NOT exist');
      console.log('   This means no migrations have been applied via drizzle-kit migrate');
    }

    // Check schema version/state
    console.log('\n=== Schema State Analysis ===');
    
    // Check for newer fields that should exist
    try {
      await client.execute('SELECT language FROM churches LIMIT 1;');
      console.log('✅ churches.language field exists');
    } catch {
      console.log('❌ churches.language field missing');
    }

    try {
      await client.execute('SELECT path FROM churches LIMIT 1;');
      console.log('✅ churches.path field exists');
    } catch {
      console.log('❌ churches.path field missing');
    }

    try {
      await client.execute('SELECT id FROM pages LIMIT 1;');
      console.log('✅ pages table exists');
    } catch {
      console.log('❌ pages table missing');
    }

    try {
      await client.execute('SELECT id FROM settings LIMIT 1;');
      console.log('✅ settings table exists');
    } catch {
      console.log('❌ settings table missing');
    }

  } catch (error) {
    console.error('Error checking migration state:', error);
  } finally {
    client.close();
  }
}

checkMigrationState();