import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import bcrypt from 'bcryptjs';
import { users } from '../src/db/schema';
import * as dotenv from 'dotenv';
import { eq } from 'drizzle-orm';

// Load environment variables
dotenv.config({ path: '.dev.vars' });

async function fixAdmin() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  const db = drizzle(client);

  // Reset admin user completely
  const passwordHash = await bcrypt.hash('admin', 10);
  
  await db.update(users)
    .set({ 
      passwordHash,
      userType: 'admin',
      email: 'admin@example.com'
    })
    .where(eq(users.username, 'admin'));

  console.log('Admin user has been fixed');
  console.log('Username: admin');
  console.log('Password: admin');
  console.log('Type: admin');
  console.log('Email: admin@example.com');
}

fixAdmin().catch(console.error);