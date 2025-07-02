import { config } from 'dotenv';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { sql } from 'drizzle-orm';

config({ path: '.dev.vars' });

async function generateAuthSchema() {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set');
  }

  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const db = drizzle(client);

  console.log('Creating better-auth tables...');

  try {
    // Create users table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        email_verified INTEGER DEFAULT 0,
        name TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        role TEXT DEFAULT 'user' NOT NULL CHECK (role IN ('admin', 'contributor', 'user'))
      )
    `);
    console.log('✓ Created users table');

    // Create sessions table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✓ Created sessions table');

    // Create accounts table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        access_token TEXT,
        refresh_token TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(provider_id, account_id)
      )
    `);
    console.log('✓ Created accounts table');

    // Create verification_tokens table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS verification_tokens (
        id TEXT PRIMARY KEY,
        token TEXT NOT NULL,
        identifier TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(token, identifier)
      )
    `);
    console.log('✓ Created verification_tokens table');

    // Create indexes
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON verification_tokens(token)`);
    console.log('✓ Created indexes');

    console.log('\n✅ Better-auth schema generated successfully!');
  } catch (error) {
    console.error('Error creating schema:', error);
    process.exit(1);
  }
}

generateAuthSchema().catch(console.error);