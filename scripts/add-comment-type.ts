import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { sql } from 'drizzle-orm';
import 'dotenv/config';

async function addCommentTypeField() {
  // Load environment variables from .dev.vars if present
  const fs = require('fs');
  const path = require('path');
  const devVarsPath = path.join(process.cwd(), '.dev.vars');
  
  if (fs.existsSync(devVarsPath)) {
    const devVars = fs.readFileSync(devVarsPath, 'utf-8');
    devVars.split('\n').forEach((line: string) => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    });
  }

  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    throw new Error('Missing required environment variables: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN');
  }

  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const db = drizzle(client);

  try {
    console.log('Adding type and metadata fields to comments table...');
    
    // Add type field with default 'user'
    await db.run(sql`
      ALTER TABLE comments 
      ADD COLUMN type TEXT DEFAULT 'user' CHECK (type IN ('user', 'system'))
    `);
    
    // Add metadata field for storing change details
    await db.run(sql`
      ALTER TABLE comments 
      ADD COLUMN metadata TEXT
    `);

    console.log('Successfully added type and metadata fields to comments table');
    
    // Update existing comments to have type 'user'
    await db.run(sql`
      UPDATE comments 
      SET type = 'user' 
      WHERE type IS NULL
    `);
    
    console.log('Updated existing comments to type "user"');
    
  } catch (error) {
    console.error('Error adding fields:', error);
    throw error;
  } finally {
    client.close();
  }
}

addCommentTypeField().catch(console.error);