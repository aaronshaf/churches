#!/usr/bin/env bun

import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATABASE_NAME = 'utahchurches-production';
const BACKUPS_DIR = 'backups';

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

function createBackup(): void {
  // Ensure backups directory exists
  if (!existsSync(BACKUPS_DIR)) {
    mkdirSync(BACKUPS_DIR, { recursive: true });
    console.log(`📁 Created ${BACKUPS_DIR} directory`);
  }

  // Generate timestamped filename
  const timestamp = formatTimestamp();
  const filename = `${timestamp}_${DATABASE_NAME}.sql`;
  const filepath = join(BACKUPS_DIR, filename);

  console.log(`🔄 Creating database backup...`);
  console.log(`📂 Database: ${DATABASE_NAME}`);
  console.log(`📄 File: ${filepath}`);

  try {
    // Execute wrangler d1 export command
    const command = `bun run wrangler d1 export ${DATABASE_NAME} --remote --output ${filepath}`;
    console.log(`🚀 Running: ${command}`);
    
    const result = execSync(command, { stdio: 'pipe', encoding: 'utf-8' });
    console.log(result);
    
    // Check if file was created
    if (existsSync(filepath)) {
      console.log(`✅ Backup created successfully: ${filepath}`);
      console.log(`📊 Use 'ls -la ${BACKUPS_DIR}/' to view all backups`);
    } else {
      console.error(`❌ Backup file was not created: ${filepath}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Backup failed:`, error);
    process.exit(1);
  }
}

// Main execution
createBackup();