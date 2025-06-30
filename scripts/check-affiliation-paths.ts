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

async function checkPaths() {
  try {
    console.log('Checking affiliation paths...\n');
    
    // Check for null paths
    const nullPaths = await client.execute(`
      SELECT id, name FROM affiliations WHERE path IS NULL
    `);
    
    if (nullPaths.rows.length > 0) {
      console.log('Affiliations with NULL paths:');
      nullPaths.rows.forEach(row => {
        console.log(`  ID: ${row.id}, Name: ${row.name}`);
      });
      console.log('');
    } else {
      console.log('✓ No NULL paths found\n');
    }
    
    // Check for duplicate paths
    const duplicatePaths = await client.execute(`
      SELECT path, COUNT(*) as count, GROUP_CONCAT(name, ', ') as names
      FROM affiliations 
      WHERE path IS NOT NULL
      GROUP BY path 
      HAVING COUNT(*) > 1
    `);
    
    if (duplicatePaths.rows.length > 0) {
      console.log('Duplicate paths found:');
      duplicatePaths.rows.forEach(row => {
        console.log(`  Path: "${row.path}" (${row.count} times)`);
        console.log(`  Names: ${row.names}`);
        console.log('');
      });
    } else {
      console.log('✓ No duplicate paths found\n');
    }
    
    // Show all affiliations with their paths
    const allAffiliations = await client.execute(`
      SELECT id, name, path FROM affiliations ORDER BY name
    `);
    
    console.log('All affiliations:');
    allAffiliations.rows.forEach(row => {
      console.log(`  ${row.id}: ${row.name} → ${row.path}`);
    });
    
  } catch (error) {
    console.error('Check failed:', error);
    process.exit(1);
  } finally {
    client.close();
  }
}

checkPaths();