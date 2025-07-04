import { createClient } from '@libsql/client';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .dev.vars
config({ path: resolve(process.cwd(), '.dev.vars') });

async function markMigrationAsApplied() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  try {
    console.log('🔍 Checking migration tracking state...');

    // Check current migration entries
    const migrations = await client.execute('SELECT * FROM __drizzle_migrations ORDER BY created_at;');
    console.log(`Found ${migrations.rows.length} tracked migrations`);

    if (migrations.rows.length > 0) {
      console.log('Migration entries:');
      migrations.rows.forEach((row, i) => {
        console.log(`  ${i + 1}. ${row.hash} (${row.created_at})`);
      });
      console.log('✅ Migrations already tracked, no action needed');
      return;
    }

    console.log('📝 Marking existing schema as baseline migration...');
    
    // Mark the existing migration file as applied
    // This corresponds to the migration file that was generated: 0000_sparkling_northstar
    const baselineTimestamp = Math.floor(Date.now() / 1000);
    
    await client.execute({
      sql: `INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)`,
      args: ['0000_sparkling_northstar', baselineTimestamp]
    });

    console.log('✅ Migration marked as applied!');
    console.log('');
    console.log('🎯 You can now use standard Drizzle workflow:');
    console.log('   1. Edit src/db/schema.ts for changes');
    console.log('   2. Run pnpm db:generate for new migrations');
    console.log('   3. Run pnpm db:migrate to apply them');

  } catch (error) {
    console.error('❌ Error marking migration as applied:', error);
  } finally {
    client.close();
  }
}

markMigrationAsApplied();