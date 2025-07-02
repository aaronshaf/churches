#!/usr/bin/env node

const CLERK_SECRET_KEY = process.argv[2];
const USER_ID = process.argv[3];

if (!CLERK_SECRET_KEY || !USER_ID) {
  console.log('Usage: pnpm tsx scripts/force-update-metadata.ts <clerk_secret_key> <user_id>');
  process.exit(1);
}

async function forceUpdateMetadata(userId: string) {
  try {
    console.log('Updating user metadata...');
    
    const response = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        public_metadata: {
          role: 'admin',
          updated_at: new Date().toISOString(),
          force_update: true
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update user: ${error}`);
    }

    const updatedUser = await response.json();
    console.log('✅ Updated successfully');
    console.log('Public Metadata:', JSON.stringify(updatedUser.public_metadata, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

forceUpdateMetadata(USER_ID);