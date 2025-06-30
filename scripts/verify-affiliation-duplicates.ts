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

async function verifyDuplicates() {
  try {
    console.log('Verifying affiliations that need path updates...\n');
    
    // Check the specific problematic affiliations
    const problematic = await client.execute(`
      SELECT id, name, path, 
        CASE 
          WHEN name LIKE '% ' THEN 'Has trailing space'
          ELSE ''
        END as issue
      FROM affiliations 
      WHERE id IN (29, 60, 42, 61)
      ORDER BY name, id
    `);
    
    console.log('Affiliations to be updated:');
    problematic.rows.forEach(row => {
      console.log(`  ID ${row.id}: "${row.name}" → "${row.path}" ${row.issue}`);
    });
    
    // Check which churches are affiliated with these
    console.log('\nChurches affiliated with these organizations:');
    for (const row of problematic.rows) {
      const churches = await client.execute(`
        SELECT c.id, c.name, c.path
        FROM churches c
        JOIN church_affiliations ca ON c.id = ca.church_id
        WHERE ca.affiliation_id = ?
        ORDER BY c.name
      `, [row.id]);
      
      if (churches.rows.length > 0) {
        console.log(`\n  Affiliation ID ${row.id} (${row.name}):`);
        churches.rows.forEach(church => {
          console.log(`    - ${church.name} (/churches/${church.path})`);
        });
      } else {
        console.log(`\n  Affiliation ID ${row.id} (${row.name}): No churches affiliated`);
      }
    }
    
  } catch (error) {
    console.error('Verification failed:', error);
    process.exit(1);
  } finally {
    client.close();
  }
}

verifyDuplicates();