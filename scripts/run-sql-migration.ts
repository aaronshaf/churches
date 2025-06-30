import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables from .dev.vars
const envPath = join(process.cwd(), '.dev.vars');
const envContent = readFileSync(envPath, 'utf-8');
const envVars = Object.fromEntries(
  envContent
    .split('\n')
    .filter((line) => line.includes('='))
    .map((line) => {
      const [key, ...valueParts] = line.split('=');
      return [key.trim(), valueParts.join('=').trim()];
    })
);

const client = createClient({
  url: envVars.TURSO_DATABASE_URL!,
  authToken: envVars.TURSO_AUTH_TOKEN!,
});

async function runMigration() {
  try {
    // Get SQL file path from command line argument
    const sqlFilePath = process.argv[2];
    if (!sqlFilePath) {
      console.error('Please provide a SQL file path as an argument');
      process.exit(1);
    }
    
    console.log(`Running migration from ${sqlFilePath}...`);
    
    // Read SQL file
    const sqlContent = readFileSync(sqlFilePath, 'utf-8');
    
    // Split SQL content by semicolons to handle multiple statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    // Execute each statement
    for (const statement of statements) {
      console.log('Executing:', statement.substring(0, 50) + '...');
      await client.execute(statement);
    }
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.close();
  }
}

runMigration();