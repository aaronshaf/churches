#!/usr/bin/env node
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(__dirname, '../.dev.vars') });

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

if (!CLERK_SECRET_KEY) {
  console.error('Missing CLERK_SECRET_KEY in .dev.vars');
  process.exit(1);
}

async function setUserRole(userIdOrEmail: string, role: 'admin' | 'contributor' | 'user') {
  try {
    // First, try to find the user
    let userId = userIdOrEmail;
    
    // If it looks like an email, search for the user
    if (userIdOrEmail.includes('@')) {
      const searchResponse = await fetch(
        `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(userIdOrEmail)}`,
        {
          headers: {
            Authorization: `Bearer ${CLERK_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!searchResponse.ok) {
        throw new Error(`Failed to search users: ${searchResponse.statusText}`);
      }
      
      const users = await searchResponse.json();
      if (users.length === 0) {
        throw new Error(`No user found with email: ${userIdOrEmail}`);
      }
      
      userId = users[0].id;
      console.log(`Found user ${users[0].email_addresses[0].email_address} with ID: ${userId}`);
    }
    
    // Update the user's public metadata
    const response = await fetch(
      `https://api.clerk.com/v1/users/${userId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          public_metadata: {
            role: role,
          },
        }),
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update user: ${error}`);
    }
    
    const updatedUser = await response.json();
    console.log(`✅ Successfully set role '${role}' for user ${updatedUser.email_addresses[0].email_address}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length !== 2) {
  console.log('Usage: pnpm tsx scripts/set-clerk-admin.ts <email_or_user_id> <role>');
  console.log('Roles: admin, contributor, user');
  console.log('');
  console.log('Examples:');
  console.log('  pnpm tsx scripts/set-clerk-admin.ts user@example.com admin');
  console.log('  pnpm tsx scripts/set-clerk-admin.ts user_2abc123def admin');
  process.exit(1);
}

const [userIdOrEmail, role] = args;

if (!['admin', 'contributor', 'user'].includes(role)) {
  console.error('Role must be one of: admin, contributor, user');
  process.exit(1);
}

setUserRole(userIdOrEmail, role as 'admin' | 'contributor' | 'user');