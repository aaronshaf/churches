import { execSync } from 'child_process';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

// Since this is a D1 database (Cloudflare), we need to use wrangler for migrations
const main = async () => {
  console.log('Running D1 migrations...');

  const migrationsDir = join(process.cwd(), 'drizzle');

  // Get all SQL migration files
  const migrationFiles = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql') && !file.includes('reset'))
    .sort();

  console.log(`Found ${migrationFiles.length} migration files`);

  // For local development, use wrangler d1 execute
  for (const file of migrationFiles) {
    console.log(`Applying migration: ${file}`);
    const sqlPath = join(migrationsDir, file);

    try {
      // Execute the migration using wrangler
      execSync(`wrangler d1 execute DB --local --file=${sqlPath}`, {
        stdio: 'inherit',
      });
    } catch (error) {
      console.error(`Failed to apply migration ${file}:`, error);
      process.exit(1);
    }
  }

  console.log('All migrations completed successfully!');
};

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
