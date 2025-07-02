#!/usr/bin/env node

const CLERK_SECRET_KEY = process.argv[2];
const USER_ID = process.argv[3];

if (!CLERK_SECRET_KEY || !USER_ID) {
  console.log('Usage: pnpm tsx scripts/check-user-metadata.ts <clerk_secret_key> <user_id>');
  process.exit(1);
}

async function checkUserMetadata(userId: string) {
  try {
    const response = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user: ${response.statusText}`);
    }

    const user = await response.json();
    
    console.log('User ID:', user.id);
    console.log('Email:', user.email_addresses?.[0]?.email_address);
    console.log('Public Metadata:', JSON.stringify(user.public_metadata, null, 2));
    console.log('Private Metadata:', JSON.stringify(user.private_metadata, null, 2));
    console.log('Unsafe Metadata:', JSON.stringify(user.unsafe_metadata, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkUserMetadata(USER_ID);