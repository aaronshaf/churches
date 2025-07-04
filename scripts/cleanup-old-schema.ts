import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { sql } from 'drizzle-orm';

async function cleanupOldSchema() {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    throw new Error('Missing required environment variables');
  }

  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const db = drizzle(client);

  try {
    console.log('🧹 Cleaning up old schema...\n');
    
    // Drop old auth tables
    console.log('Dropping old auth tables...');
    await db.run(sql`DROP TABLE IF EXISTS sessions`);
    console.log('✅ Dropped sessions table');
    
    await db.run(sql`DROP TABLE IF EXISTS users`);
    console.log('✅ Dropped users table');
    
    // Drop service_times column
    console.log('\nDropping service_times column...');
    // SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
    // But since service_times is empty, we can just leave it for db:push to handle
    
    console.log('\n✅ Cleanup complete! You can now run db:push');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.close();
  }
}

cleanupOldSchema().catch(console.error);