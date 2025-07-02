#!/usr/bin/env node
import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';

// Function to get Clerk secret key based on environment
function getClerkSecretKey(env?: string): string {
  // Check if CLERK_SECRET_KEY is already in environment (e.g., from wrangler)
  if (process.env.CLERK_SECRET_KEY) {
    const key = process.env.CLERK_SECRET_KEY;
    const envType = key.startsWith('sk_live_') ? 'production' : 'development';
    console.log(`📝 Using ${envType} environment (from environment variable)`);
    console.log(`🔑 Clerk API Key: ${key.substring(0, 12)}...`);
    return key;
  }

  // If no env var, try to load from file
  const envFile = env === 'prod' || env === 'production' ? '.prod.vars' : '.dev.vars';
  const envPath = resolve(__dirname, '..', envFile);
  
  if (!existsSync(envPath)) {
    console.error(`❌ No CLERK_SECRET_KEY found in environment variables and ${envFile} doesn't exist.`);
    console.error('');
    console.error('🔧 To use with Wrangler secrets (recommended for production):');
    console.error('   CLERK_SECRET_KEY=$(wrangler secret get CLERK_SECRET_KEY) pnpm tsx scripts/set-clerk-admin.ts <email> <role>');
    console.error('');
    console.error('🔧 Or create a local environment file:');
    console.error(`   Create ${envFile} with:`);
    console.error(`   CLERK_SECRET_KEY=${env === 'prod' ? 'sk_live_your_production_secret_key' : 'sk_test_your_development_secret_key'}`);
    process.exit(1);
  }

  // Load from file
  config({ path: envPath });
  
  const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
  
  if (!CLERK_SECRET_KEY) {
    console.error(`Missing CLERK_SECRET_KEY in ${envFile}`);
    process.exit(1);
  }

  const envType = CLERK_SECRET_KEY.startsWith('sk_live_') ? 'production' : 'development';
  console.log(`📝 Using ${envType} environment (${envFile})`);
  console.log(`🔑 Clerk API Key: ${CLERK_SECRET_KEY.substring(0, 12)}...`);
  
  return CLERK_SECRET_KEY;
}

async function setUserRole(userIdOrEmail: string, role: 'admin' | 'contributor' | 'user', clerkSecretKey: string) {
  try {
    // First, try to find the user
    let userId = userIdOrEmail;
    
    // If it looks like an email, search for the user
    if (userIdOrEmail.includes('@')) {
      const searchResponse = await fetch(
        `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(userIdOrEmail)}`,
        {
          headers: {
            Authorization: `Bearer ${clerkSecretKey}`,
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
          Authorization: `Bearer ${clerkSecretKey}`,
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

// Check for --env flag
let env: string | undefined;
let userIdOrEmail: string;
let role: string;

if (args.length === 4 && args[0] === '--env') {
  env = args[1];
  userIdOrEmail = args[2];
  role = args[3];
} else if (args.length === 2) {
  userIdOrEmail = args[0];
  role = args[1];
} else {
  console.log('Usage:');
  console.log('  pnpm tsx scripts/set-clerk-admin.ts <email_or_user_id> <role>');
  console.log('  pnpm tsx scripts/set-clerk-admin.ts --env <environment> <email_or_user_id> <role>');
  console.log('');
  console.log('Roles: admin, contributor, user');
  console.log('Environments: dev, development, prod, production');
  console.log('');
  console.log('Examples:');
  console.log('  # Using Wrangler secrets (recommended for production):');
  console.log('  CLERK_SECRET_KEY=$(wrangler secret get CLERK_SECRET_KEY) pnpm tsx scripts/set-clerk-admin.ts aaronshaf@gmail.com admin');
  console.log('');
  console.log('  # Using development environment:');
  console.log('  pnpm tsx scripts/set-clerk-admin.ts aaronshaf@gmail.com admin');
  console.log('');
  console.log('  # Explicit environment specification:');
  console.log('  pnpm tsx scripts/set-clerk-admin.ts --env prod aaronshaf@gmail.com admin');
  console.log('  pnpm tsx scripts/set-clerk-admin.ts --env dev aaronshaf@gmail.com admin');
  process.exit(1);
}

if (!['admin', 'contributor', 'user'].includes(role)) {
  console.error('Role must be one of: admin, contributor, user');
  process.exit(1);
}

// Get the Clerk secret key
const clerkSecretKey = getClerkSecretKey(env);

// Execute the role update
setUserRole(userIdOrEmail, role as 'admin' | 'contributor' | 'user', clerkSecretKey);