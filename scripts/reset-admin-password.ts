import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import bcrypt from 'bcryptjs';
import { users } from '../src/db/schema.js';
import * as dotenv from 'dotenv';
import { eq } from 'drizzle-orm';

// Load environment variables
dotenv.config({ path: '.dev.vars' });

async function resetAdminPassword() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  const db = drizzle(client);

  // Reset admin password to 'admin'
  const passwordHash = await bcrypt.hash('admin', 10);
  
  await db.update(users)
    .set({ passwordHash })
    .where(eq(users.username, 'admin'));

  console.log('Admin password has been reset');
  console.log('Username: admin');
  console.log('Password: admin');
}

resetAdminPassword().catch(console.error);