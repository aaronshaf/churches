#!/usr/bin/env bun
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

// Read the production backup
const prodBackup = readFileSync('prod-schema-backup.sql', 'utf-8');

// Extract table definitions in dependency order
const tableOrder = [
  // Base tables with no dependencies
  'counties',
  'affiliations', 
  'pages',
  'settings',
  'users',
  
  // Tables that depend on users
  'sessions',
  'accounts',
  'verification',
  'verification_tokens',
  
  // Tables that depend on counties
  'churches',
  
  // Tables that depend on churches
  'church_gatherings',
  'church_images',
  'church_affiliations',
  'church_suggestions',
  'comments',
  
  // Image tables
  'images',
  'church_images_new',
  'county_images', 
  'affiliation_images',
  'site_images'
];

// Function to extract a specific table's CREATE statement
function extractTable(sql: string, tableName: string): string | null {
  const lines = sql.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Look for exact table name match
    if (line.startsWith(`CREATE TABLE ${tableName} (`) || 
        line.startsWith(`CREATE TABLE \`${tableName}\` (`) ||
        line.startsWith(`CREATE TABLE "${tableName}" (`) ||
        line.startsWith(`CREATE TABLE IF NOT EXISTS "${tableName}"`) ||
        line.startsWith(`CREATE TABLE IF NOT EXISTS \`${tableName}\``)) {
      
      let statement = line;
      
      // Collect lines until we find the closing );
      let j = i + 1;
      while (j < lines.length && !lines[j].trim().startsWith(');')) {
        statement += '\n' + lines[j];
        j++;
      }
      if (j < lines.length) {
        statement += '\n);';
      }
      
      return statement;
    }
  }
  
  return null;
}

// Step 1: Clean up
console.log('🧹 Cleaning up existing database...');
try {
  execSync('rm -rf .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*', { stdio: 'inherit' });
} catch {}

// Step 2: Create migrations table
console.log('🏗️  Creating migrations table...');
const migrationTableSql = `
CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL
);`;

writeFileSync('temp-init.sql', migrationTableSql);
execSync('bun run wrangler d1 execute DB --local --file=temp-init.sql', { stdio: 'inherit' });

// Step 3: Create tables in order
console.log('🏗️  Creating tables in dependency order...');

for (const tableName of tableOrder) {
  const createStatement = extractTable(prodBackup, tableName);
  
  if (createStatement) {
    console.log(`  Creating table: ${tableName}`);
    writeFileSync('temp-init.sql', createStatement);
    
    try {
      execSync('bun run wrangler d1 execute DB --local --file=temp-init.sql', { stdio: 'inherit' });
    } catch (error) {
      console.error(`  ⚠️  Failed to create ${tableName}, skipping...`);
    }
  }
}

// Step 4: Create indexes
console.log('🏗️  Creating indexes...');
const indexStatements = prodBackup
  .split('\n')
  .filter(line => line.startsWith('CREATE INDEX') || line.startsWith('CREATE UNIQUE INDEX'))
  .map(line => line + ';')
  .join('\n');

if (indexStatements) {
  writeFileSync('temp-init.sql', indexStatements);
  try {
    execSync('bun run wrangler d1 execute DB --local --file=temp-init.sql', { stdio: 'inherit' });
  } catch (error) {
    console.error('  ⚠️  Some indexes failed to create');
  }
}

// Step 5: Mark migrations as applied
console.log('📝 Marking migrations as applied...');
const markMigrationsSql = `
INSERT INTO __drizzle_migrations (hash, created_at) VALUES 
    ('0000_comprehensive_schema', ${Date.now()}),
    ('0001_auth_schema', ${Date.now()})
ON CONFLICT(hash) DO NOTHING;`;

writeFileSync('temp-init.sql', markMigrationsSql);
execSync('bun run wrangler d1 execute DB --local --file=temp-init.sql', { stdio: 'inherit' });

// Cleanup
require('fs').unlinkSync('temp-init.sql');

console.log('✨ Database initialized successfully!');