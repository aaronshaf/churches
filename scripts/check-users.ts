import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { users } from '../src/db/schema';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.dev.vars' });

async function checkUsers() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  const db = drizzle(client);

  const allUsers = await db.select().from(users).all();
  
  console.log('Total users:', allUsers.length);
  allUsers.forEach(user => {
    console.log('\nUser:', user.username);
    console.log('Email:', user.email);
    console.log('Type:', user.userType);
    console.log('Password hash:', user.passwordHash);
    console.log('Created:', user.createdAt);
  });
}

checkUsers().catch(console.error);