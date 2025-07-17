#!/usr/bin/env bun
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

console.log('🚀 Importing production data into local database...\n');

// Read the production backup
const prodBackup = readFileSync('prod-schema-backup.sql', 'utf-8');
const lines = prodBackup.split('\n');

// Group INSERT statements by table for better organization
const insertsByTable = new Map<string, string[]>();

for (const line of lines) {
  if (line.startsWith('INSERT INTO')) {
    // Extract table name
    const match = line.match(/INSERT INTO (\w+)/);
    if (match) {
      const tableName = match[1];
      if (!insertsByTable.has(tableName)) {
        insertsByTable.set(tableName, []);
      }
      insertsByTable.get(tableName)!.push(line);
    }
  }
}

// Define the order to import tables (respecting foreign key constraints)
const importOrder = [
  'counties',
  'affiliations',
  'pages',
  'settings',
  'users',
  'sessions',
  'accounts',
  'verification',
  'verification_tokens',
  'churches',
  'church_gatherings',
  'church_images',
  'church_affiliations',
  'church_suggestions',
  'comments',
  'images',
  'church_images_new',
  'county_images',
  'affiliation_images',
  'site_images'
];

// Import data table by table
let totalImported = 0;
const errors: string[] = [];

for (const tableName of importOrder) {
  const inserts = insertsByTable.get(tableName);
  if (!inserts || inserts.length === 0) {
    console.log(`⏭️  No data to import for ${tableName}`);
    continue;
  }
  
  console.log(`📥 Importing ${inserts.length} rows into ${tableName}...`);
  
  // Process in batches to avoid command line length limits
  const batchSize = 50;
  let successCount = 0;
  
  for (let i = 0; i < inserts.length; i += batchSize) {
    const batch = inserts.slice(i, Math.min(i + batchSize, inserts.length));
    const batchSql = batch.join('\n');
    
    const tempFile = `.temp-import-${Date.now()}.sql`;
    writeFileSync(tempFile, batchSql);
    
    try {
      execSync(`bun run wrangler d1 execute DB --local --file=${tempFile}`, { 
        stdio: 'pipe' // Suppress output for cleaner logs
      });
      successCount += batch.length;
    } catch (error) {
      // Some inserts might fail due to duplicates or constraints, that's okay
      errors.push(`${tableName}: batch ${Math.floor(i / batchSize) + 1}`);
    } finally {
      require('fs').unlinkSync(tempFile);
    }
  }
  
  console.log(`   ✅ Imported ${successCount}/${inserts.length} rows\n`);
  totalImported += successCount;
}

// Verify the import
console.log('\n🔍 Verifying data import...\n');

const verifyTables = [
  'counties',
  'affiliations', 
  'churches',
  'church_gatherings',
  'users'
];

const verifySql = verifyTables.map(table => 
  `SELECT '${table}' as table_name, COUNT(*) as count FROM ${table}`
).join(' UNION ALL ') + ';';

writeFileSync('.temp-verify.sql', verifySql);

try {
  execSync('bun run wrangler d1 execute DB --local --file=.temp-verify.sql', { stdio: 'inherit' });
} catch (error) {
  console.error('Failed to verify import');
} finally {
  require('fs').unlinkSync('.temp-verify.sql');
}

console.log(`\n✨ Import complete! Imported data into ${insertsByTable.size} tables.`);
console.log(`   Total rows processed: ${totalImported}`);

if (errors.length > 0) {
  console.log(`\n⚠️  Some batches had errors (likely duplicates): ${errors.length}`);
}

console.log('\nYou can now run "bun run dev" to see the imported data!');