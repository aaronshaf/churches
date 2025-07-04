import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { sql } from 'drizzle-orm';
import { churches, churchGatherings } from '../src/db/schema';
import 'dotenv/config';

async function migrateServiceTimes() {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    throw new Error('Missing required environment variables: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN');
  }

  console.log('Using database:', process.env.TURSO_DATABASE_URL);

  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const db = drizzle(client);

  try {
    console.log('🔄 Migrating service_times to church_gatherings table...\n');
    
    // First, get all churches with service_times
    const churchesWithServiceTimes = await db.run(sql`
      SELECT id, name, service_times 
      FROM churches 
      WHERE service_times IS NOT NULL 
      AND service_times != ''
    `);

    console.log(`Found ${churchesWithServiceTimes.rows.length} churches with service times\n`);

    let migrated = 0;
    
    for (const row of churchesWithServiceTimes.rows) {
      const churchId = row[0] as number;
      const churchName = row[1] as string;
      const serviceTimes = row[2] as string;
      
      // Check if this church already has gatherings
      const existingGatherings = await db
        .select()
        .from(churchGatherings)
        .where(sql`${churchGatherings.churchId} = ${churchId}`)
        .all();
      
      if (existingGatherings.length === 0) {
        // Insert the service time into church_gatherings
        await db.insert(churchGatherings).values({
          churchId,
          time: serviceTimes,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        
        migrated++;
        console.log(`✅ Migrated: ${churchName} - "${serviceTimes}"`);
      } else {
        console.log(`⚠️  Skipped: ${churchName} - already has gatherings`);
      }
    }

    console.log(`\n✨ Migration complete! Migrated ${migrated} service times.`);
    
    // Now you can safely remove the service_times column
    console.log('\n📝 You can now run "pnpm db:push" to sync the schema.');
    console.log('The service_times column will be removed, but the data is safe in church_gatherings.');
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  } finally {
    client.close();
  }
}

migrateServiceTimes().catch(console.error);