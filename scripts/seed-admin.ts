import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import bcrypt from 'bcryptjs';
import { users } from '../src/db/schema';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.dev.vars' });

async function seedAdmin() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  const db = drizzle(client);

  // Check if admin already exists
  const existingAdmin = await db.select().from(users).where(eq(users.username, 'admin')).get();
  
  if (existingAdmin) {
    console.log('Admin user already exists');
    return;
  }

  // Create admin user
  const passwordHash = await bcrypt.hash('admin', 10);
  
  await db.insert(users).values({
    username: 'admin',
    email: 'admin@example.com',
    passwordHash,
    userType: 'admin',
  });

  console.log('Admin user created successfully');
  console.log('Username: admin');
  console.log('Password: admin');
  console.log('⚠️  Please change the password after first login!');
}

// Import eq from drizzle-orm
import { eq } from 'drizzle-orm';

seedAdmin().catch(console.error);