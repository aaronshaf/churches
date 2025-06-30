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

async function verifyMigration() {
  try {
    console.log('Verifying migration results...\n');
    
    // Check total affiliation count
    const count = await client.execute('SELECT COUNT(*) as total FROM affiliations');
    console.log(`Total affiliations: ${count.rows[0].total}\n`);
    
    // Check IFCA International churches
    const ifcaChurches = await client.execute(`
      SELECT c.name, c.path
      FROM churches c
      JOIN church_affiliations ca ON c.id = ca.church_id
      WHERE ca.affiliation_id = 29
      ORDER BY c.name
    `);
    
    console.log('Churches affiliated with IFCA International (ID 29):');
    ifcaChurches.rows.forEach(church => {
      console.log(`  - ${church.name}`);
    });
    
    // Check Potter's House churches
    const pottersChurches = await client.execute(`
      SELECT c.name, c.path
      FROM churches c
      JOIN church_affiliations ca ON c.id = ca.church_id
      WHERE ca.affiliation_id = 61
      ORDER BY c.name
    `);
    
    console.log('\nChurches affiliated with Potter\'s House Christian Fellowship (ID 61):');
    pottersChurches.rows.forEach(church => {
      console.log(`  - ${church.name}`);
    });
    
    // Check if path column has UNIQUE constraint
    const tableInfo = await client.execute(`
      SELECT sql FROM sqlite_master 
      WHERE type='table' AND name='affiliations'
    `);
    
    console.log('\nTable definition:');
    console.log(tableInfo.rows[0].sql);
    
    // Check for any orphaned church_affiliations
    const orphaned = await client.execute(`
      SELECT DISTINCT ca.affiliation_id
      FROM church_affiliations ca
      LEFT JOIN affiliations a ON ca.affiliation_id = a.id
      WHERE a.id IS NULL
    `);
    
    if (orphaned.rows.length > 0) {
      console.log('\n⚠️  WARNING: Found orphaned church_affiliations:');
      orphaned.rows.forEach(row => {
        console.log(`  - Affiliation ID: ${row.affiliation_id}`);
      });
    } else {
      console.log('\n✓ No orphaned church_affiliations found');
    }
    
  } catch (error) {
    console.error('Verification failed:', error);
    process.exit(1);
  } finally {
    client.close();
  }
}

verifyMigration();