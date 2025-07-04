import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { sql } from 'drizzle-orm';

async function checkAllTables() {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    throw new Error('Missing required environment variables');
  }

  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const db = drizzle(client);

  try {
    console.log('📊 Checking all tables in database...\n');
    
    // Get all tables
    const tables = await db.run(sql`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);
    
    console.log('Tables found:');
    for (const row of tables.rows) {
      const tableName = row[0] as string;
      const count = await db.run(sql`SELECT COUNT(*) as count FROM ${sql.identifier(tableName)}`);
      console.log(`  - ${tableName}: ${count.rows[0][0]} rows`);
    }

    // Check indexes on affiliations table
    console.log('\n📊 Checking indexes on affiliations table...\n');
    const indexes = await db.run(sql`
      SELECT name, sql FROM sqlite_master 
      WHERE type='index' 
      AND tbl_name='affiliations'
    `);
    
    console.log('Indexes on affiliations:');
    for (const row of indexes.rows) {
      console.log(`  - ${row[0]}`);
    }

    // Check if users and sessions are being used
    console.log('\n📊 Checking users and sessions tables...\n');
    
    try {
      const users = await db.run(sql`SELECT id, email FROM users`);
      console.log('Users in users table:');
      for (const row of users.rows) {
        console.log(`  - ID: ${row[0]}, Email: ${row[1]}`);
      }
    } catch (e) {
      console.log('Could not read users table');
    }

    try {
      const sessions = await db.run(sql`SELECT COUNT(*) as count FROM sessions`);
      console.log(`Sessions in sessions table: ${sessions.rows[0][0]}`);
    } catch (e) {
      console.log('Could not read sessions table');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.close();
  }
}

checkAllTables().catch(console.error);