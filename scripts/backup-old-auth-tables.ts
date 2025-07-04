import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';

async function backupOldAuthTables() {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    throw new Error('Missing required environment variables');
  }

  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const db = drizzle(client);

  try {
    console.log('📦 Backing up old auth tables...\n');
    
    // Backup users table
    const users = await db.run(sql`SELECT * FROM users`);
    const usersData = users.rows.map(row => ({
      id: row[0],
      email: row[1],
      username: row[2],
      password_hash: row[3],
      user_type: row[4],
      created_at: row[5],
      updated_at: row[6]
    }));
    
    fs.writeFileSync('backup-users.json', JSON.stringify(usersData, null, 2));
    console.log(`✅ Backed up ${usersData.length} users to backup-users.json`);
    
    // Backup sessions table
    const sessions = await db.run(sql`SELECT * FROM sessions`);
    const sessionsData = sessions.rows.map(row => ({
      id: row[0],
      user_id: row[1],
      expires_at: row[2],
      created_at: row[3]
    }));
    
    fs.writeFileSync('backup-sessions.json', JSON.stringify(sessionsData, null, 2));
    console.log(`✅ Backed up ${sessionsData.length} sessions to backup-sessions.json`);

    console.log('\n📝 Backup complete! You can now safely proceed with db:push');
    console.log('The backed up data is in backup-users.json and backup-sessions.json');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.close();
  }
}

backupOldAuthTables().catch(console.error);