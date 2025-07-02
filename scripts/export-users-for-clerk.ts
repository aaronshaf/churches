import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { users } from '../src/db/schema';
import * as fs from 'fs/promises';
import * as path from 'path';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: '.dev.vars' });

async function exportUsersForClerk() {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.error('Missing required environment variables');
    process.exit(1);
  }

  const turso = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const db = drizzle(turso);

  try {
    console.log('Fetching users from database...');
    const allUsers = await db.select().from(users).all();
    
    console.log(`Found ${allUsers.length} users`);

    // Format users for Clerk import
    const clerkUsers = allUsers.map(user => ({
      email_address: user.email,
      username: user.username,
      // Store original ID and userType in public metadata
      public_metadata: {
        originalId: user.id,
        userType: user.userType,
      },
      // Password reset will be required
      skip_password_checks: true,
      // Set as verified since these are existing users
      email_verified: true,
    }));

    // Write to JSON file
    const outputPath = path.join(process.cwd(), 'clerk-user-import.json');
    await fs.writeFile(outputPath, JSON.stringify(clerkUsers, null, 2));
    
    console.log(`\nExport complete! Users saved to: ${outputPath}`);
    console.log('\nNext steps:');
    console.log('1. Create a Clerk application at https://dashboard.clerk.com');
    console.log('2. Use Clerk\'s bulk import feature to import these users');
    console.log('3. Configure password reset emails to be sent to all users');
    console.log('4. Update the application to use Clerk authentication');

    // Also create a mapping file for ID migration
    const idMapping = allUsers.map(user => ({
      originalId: user.id,
      email: user.email,
      username: user.username,
      userType: user.userType,
    }));

    const mappingPath = path.join(process.cwd(), 'user-id-mapping.json');
    await fs.writeFile(mappingPath, JSON.stringify(idMapping, null, 2));
    console.log(`\nID mapping saved to: ${mappingPath}`);

  } catch (error) {
    console.error('Error exporting users:', error);
    process.exit(1);
  } finally {
    turso.close();
  }
}

// Run the export
exportUsersForClerk();