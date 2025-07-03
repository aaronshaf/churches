import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load .dev.vars file
const devVarsPath = join(process.cwd(), '.dev.vars');
const devVars = readFileSync(devVarsPath, 'utf-8');
devVars.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    process.env[key.trim()] = valueParts.join('=').trim();
  }
});

async function runMigration() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  console.log('Adding new fields to church_suggestions table...');

  try {
    // Add new columns to church_suggestions table
    const alterStatements = [
      'ALTER TABLE church_suggestions ADD COLUMN denomination TEXT',
      'ALTER TABLE church_suggestions ADD COLUMN service_times TEXT',
      'ALTER TABLE church_suggestions ADD COLUMN statement_of_faith TEXT',
      'ALTER TABLE church_suggestions ADD COLUMN facebook TEXT',
      'ALTER TABLE church_suggestions ADD COLUMN instagram TEXT',
      'ALTER TABLE church_suggestions ADD COLUMN youtube TEXT',
      'ALTER TABLE church_suggestions ADD COLUMN spotify TEXT',
    ];

    for (const statement of alterStatements) {
      try {
        await client.execute(statement);
        console.log(`✓ ${statement}`);
      } catch (error: any) {
        if (error.message.includes('duplicate column name')) {
          console.log(`⚠️  Column already exists: ${statement.split(' ').pop()}`);
        } else {
          throw error;
        }
      }
    }

    console.log('\nMigration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();