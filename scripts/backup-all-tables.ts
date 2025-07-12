#!/usr/bin/env bun

import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATABASE_NAME = 'utahchurches-production';
const BACKUPS_DIR = 'backups';

// All tables in the database
const TABLES = [
  'counties',
  'affiliations', 
  'churches',
  'church_affiliations',
  'church_gatherings',
  'pages',
  'settings',
  'church_images',
  'church_suggestions',
  'comments',
  'users',
  'sessions',
  'accounts',
  'verification_tokens',
  'verification'
];

function formatTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day}_${hours}${minutes}${seconds}`;
}

function backupAllTables(): void {
  // Ensure backups directory exists
  if (!existsSync(BACKUPS_DIR)) {
    mkdirSync(BACKUPS_DIR, { recursive: true });
    console.log(`📁 Created ${BACKUPS_DIR} directory`);
  }

  const timestamp = formatTimestamp();
  console.log(`🔄 Starting complete table-by-table backup...`);
  console.log(`📂 Database: ${DATABASE_NAME}`);
  console.log(`📊 Tables to backup: ${TABLES.length}`);
  console.log(`⏰ Timestamp: ${timestamp}\n`);

  const results: { table: string; status: 'success' | 'failed'; file?: string; error?: string }[] = [];

  for (const table of TABLES) {
    const filename = `${timestamp}_${table}.sql`;
    const filepath = join(BACKUPS_DIR, filename);
    
    console.log(`📄 Backing up table: ${table}`);
    
    try {
      const command = `bun run wrangler d1 export ${DATABASE_NAME} --remote --table ${table} --output ${filepath}`;
      execSync(command, { stdio: 'pipe' });
      
      if (existsSync(filepath)) {
        console.log(`   ✅ Success: ${filename}`);
        results.push({ table, status: 'success', file: filename });
      } else {
        console.log(`   ❌ Failed: File not created`);
        results.push({ table, status: 'failed', error: 'File not created' });
      }
    } catch (error) {
      console.log(`   ❌ Failed: ${error instanceof Error ? error.message : String(error)}`);
      results.push({ table, status: 'failed', error: error instanceof Error ? error.message : String(error) });
    }
  }

  // Summary
  console.log(`\n📋 Backup Summary:`);
  console.log(`==================`);
  
  const successful = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status === 'failed');
  
  console.log(`✅ Successful: ${successful.length}/${TABLES.length}`);
  if (successful.length > 0) {
    successful.forEach(r => console.log(`   • ${r.table} → ${r.file}`));
  }
  
  if (failed.length > 0) {
    console.log(`\n❌ Failed: ${failed.length}/${TABLES.length}`);
    failed.forEach(r => console.log(`   • ${r.table}: ${r.error}`));
  }
  
  console.log(`\n📂 Backup location: ${BACKUPS_DIR}/`);
  console.log(`📊 Use 'ls -la ${BACKUPS_DIR}/' to view all backup files`);
  
  if (failed.length > 0) {
    console.log(`\n⚠️  Some tables failed to backup. Check errors above.`);
    process.exit(1);
  } else {
    console.log(`\n🎉 All tables backed up successfully!`);
  }
}

// Main execution
backupAllTables();