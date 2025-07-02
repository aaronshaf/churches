import { createClient } from '@libsql/client';
import { Clerk } from '@clerk/backend';
import { config } from 'dotenv';

// Load environment variables
config();

// Initialize database client
const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

// Initialize Clerk client
const clerk = new Clerk({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

interface LegacyUser {
  id: number;
  email: string;
  username: string;
  userType: 'admin' | 'contributor';
}

async function migrateAdminsToClerk() {
  console.log('Starting admin migration to Clerk...\n');

  try {
    // 1. Fetch all admin users from the database
    const result = await db.execute(`
      SELECT id, email, username, user_type as userType 
      FROM users 
      WHERE user_type = 'admin'
    `);

    const adminUsers = result.rows as LegacyUser[];
    console.log(`Found ${adminUsers.length} admin users to migrate:\n`);

    for (const adminUser of adminUsers) {
      console.log(`Processing: ${adminUser.email} (${adminUser.username})`);

      try {
        // 2. Search for user in Clerk by email
        const clerkUsers = await clerk.users.getUserList({
          emailAddress: [adminUser.email],
        });

        if (clerkUsers.length === 0) {
          console.log(`  ❌ User not found in Clerk. They need to sign up first.`);
          continue;
        }

        const clerkUser = clerkUsers[0];

        // 3. Update user's publicMetadata to include admin role
        await clerk.users.updateUser(clerkUser.id, {
          publicMetadata: {
            ...clerkUser.publicMetadata,
            role: 'admin',
            migratedFrom: 'legacy',
            migratedAt: new Date().toISOString(),
          },
        });

        console.log(`  ✅ Successfully updated user ${clerkUser.id} to admin role`);

      } catch (error) {
        console.error(`  ❌ Error processing user ${adminUser.email}:`, error);
      }
    }

    console.log('\n✅ Migration complete!');
    
    // 4. Display summary
    console.log('\nMigration Summary:');
    console.log('==================');
    console.log(`Total legacy admins: ${adminUsers.length}`);
    console.log('\nNext steps:');
    console.log('1. Verify admin access for migrated users');
    console.log('2. Users not found in Clerk need to sign up first');
    console.log('3. After sign up, manually grant them admin role via the admin panel');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
migrateAdminsToClerk()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });