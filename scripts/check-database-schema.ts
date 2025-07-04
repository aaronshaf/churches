import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { sql } from 'drizzle-orm';

async function checkSchema() {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    throw new Error('Missing required environment variables: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN');
  }

  console.log('Connecting to:', process.env.TURSO_DATABASE_URL);

  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const db = drizzle(client);

  try {
    // Check what columns exist in the churches table
    console.log('\n📊 Checking churches table schema...\n');
    
    const tableInfo = await db.run(sql`PRAGMA table_info(churches)`);
    
    console.log('Columns in churches table:');
    for (const row of tableInfo.rows) {
      console.log(`  - ${row[1]} (${row[2]})`);
    }

    // Check if church_gatherings table exists
    console.log('\n📊 Checking church_gatherings table...\n');
    try {
      const gatheringsCount = await db.run(sql`SELECT COUNT(*) as count FROM church_gatherings`);
      console.log(`church_gatherings table exists with ${gatheringsCount.rows[0][0]} rows`);
    } catch (e) {
      console.log('church_gatherings table does not exist');
    }

    // Check if service_times column exists
    const hasServiceTimes = tableInfo.rows.some(row => row[1] === 'service_times');
    console.log(`\n✅ service_times column exists: ${hasServiceTimes}`);

    if (hasServiceTimes) {
      // Count how many churches have service_times
      const count = await db.run(sql`
        SELECT COUNT(*) as count 
        FROM churches 
        WHERE service_times IS NOT NULL 
        AND service_times != ''
      `);
      console.log(`Churches with service_times: ${count.rows[0][0]}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.close();
  }
}

// Run with environment variables from command line
checkSchema().catch(console.error);