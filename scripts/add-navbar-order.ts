import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { sql } from 'drizzle-orm';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.dev.vars' });

async function main() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  const db = drizzle(client);

  try {
    console.log('Adding navbar_order column to pages table...');
    
    await db.run(sql`
      ALTER TABLE pages ADD COLUMN navbar_order INTEGER;
    `);
    
    console.log('✅ Successfully added navbar_order column to pages table');
  } catch (error) {
    console.error('Error adding navbar_order column:', error);
    process.exit(1);
  } finally {
    client.close();
  }
}

main();