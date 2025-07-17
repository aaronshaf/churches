#!/usr/bin/env bun
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { resolve } from 'path';

// Function to extract and clean CREATE TABLE statements from the production dump
function extractCreateStatements(sql: string): string[] {
  const statements: string[] = [];
  const lines = sql.split('\n');
  let currentStatement = '';
  let inCreateTable = false;
  
  for (const line of lines) {
    // Start of a CREATE TABLE statement
    if (line.startsWith('CREATE TABLE')) {
      inCreateTable = true;
      currentStatement = line;
    }
    // Continuation of CREATE TABLE
    else if (inCreateTable && line.match(/^  /)) {
      currentStatement += '\n' + line;
    }
    // End of CREATE TABLE
    else if (inCreateTable && line.trim() === ');') {
      currentStatement += '\n);';
      statements.push(currentStatement);
      currentStatement = '';
      inCreateTable = false;
    }
    // CREATE INDEX statements
    else if (line.startsWith('CREATE INDEX') || line.startsWith('CREATE UNIQUE INDEX')) {
      statements.push(line + ';');
    }
  }
  
  return statements;
}

// Function to execute SQL in batches
function executeSqlBatch(statements: string[], dbName: string): void {
  const batchSize = 5; // Execute 5 statements at a time
  
  for (let i = 0; i < statements.length; i += batchSize) {
    const batch = statements.slice(i, Math.min(i + batchSize, statements.length));
    const sql = batch.join('\n');
    
    // Write to temporary file
    const tempFile = `.temp-init-${Date.now()}.sql`;
    require('fs').writeFileSync(tempFile, sql);
    
    try {
      // Execute the batch
      execSync(`bun run wrangler d1 execute ${dbName} --local --file=${tempFile}`, {
        stdio: 'inherit'
      });
      console.log(`✅ Executed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(statements.length / batchSize)}`);
    } catch (error) {
      console.error(`❌ Failed to execute batch: ${error}`);
      throw error;
    } finally {
      // Clean up temp file
      require('fs').unlinkSync(tempFile);
    }
  }
}

async function main() {
  console.log('🚀 Initializing local D1 database...\n');
  
  // Step 1: Clean up existing database
  console.log('🧹 Cleaning up existing database...');
  try {
    execSync('rm -rf .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*', { stdio: 'inherit' });
    console.log('✅ Cleaned up existing database files\n');
  } catch (error) {
    console.log('⚠️  No existing database files to clean\n');
  }
  
  // Step 2: Read the production schema backup
  console.log('📖 Reading production schema...');
  const prodSchemaSql = readFileSync(resolve('prod-schema-backup.sql'), 'utf-8');
  const createStatements = extractCreateStatements(prodSchemaSql);
  console.log(`✅ Found ${createStatements.length} CREATE statements\n`);
  
  // Step 3: Create tables from production schema
  console.log('🏗️  Creating tables from production schema...');
  
  // First, create the drizzle migrations table
  const migrationTableSql = `
CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL
);`;
  
  require('fs').writeFileSync('.temp-migrations-table.sql', migrationTableSql);
  try {
    execSync('bun run wrangler d1 execute DB --local --file=.temp-migrations-table.sql', { stdio: 'inherit' });
    console.log('✅ Created migrations tracking table');
  } catch (error) {
    console.error('❌ Failed to create migrations table:', error);
  } finally {
    require('fs').unlinkSync('.temp-migrations-table.sql');
  }
  
  // Execute CREATE statements in batches
  executeSqlBatch(createStatements, 'DB');
  
  // Step 4: Mark migrations as applied
  console.log('\n📝 Marking migrations as applied...');
  const markMigrationsSql = `
INSERT INTO __drizzle_migrations (hash, created_at) VALUES 
    ('0000_comprehensive_schema', ${Date.now()}),
    ('0001_auth_schema', ${Date.now()})
ON CONFLICT(hash) DO NOTHING;`;
  
  require('fs').writeFileSync('.temp-mark-migrations.sql', markMigrationsSql);
  try {
    execSync('bun run wrangler d1 execute DB --local --file=.temp-mark-migrations.sql', { stdio: 'inherit' });
    console.log('✅ Marked migrations as applied');
  } catch (error) {
    console.error('❌ Failed to mark migrations:', error);
  } finally {
    require('fs').unlinkSync('.temp-mark-migrations.sql');
  }
  
  // Step 5: Verify the setup
  console.log('\n🔍 Verifying database setup...');
  const verifyTablesFile = '.temp-verify.sql';
  const verifySql = `
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;`;
  
  require('fs').writeFileSync(verifyTablesFile, verifySql);
  try {
    execSync(`bun run wrangler d1 execute DB --local --file=${verifyTablesFile}`, { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ Failed to verify tables:', error);
  } finally {
    require('fs').unlinkSync(verifyTablesFile);
  }
  
  console.log('\n✨ Local D1 database initialized successfully!');
  console.log('You can now run "bun run dev" to start the development server.');
}

main().catch(console.error);