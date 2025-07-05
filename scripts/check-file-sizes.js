#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Maximum file size in bytes (gradually reducing from 231KB)
const MAX_FILE_SIZE = 195584; // bytes (reduced from 231KB, current largest is ~191KB)

// Get staged files
const { execSync } = require('child_process');

try {
  const stagedFiles = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' })
    .split('\n')
    .filter(file => file.trim())
    .filter(file => file.endsWith('.ts') || file.endsWith('.tsx'))
    .filter(file => file.startsWith('src/'));

  let hasOversizedFiles = false;

  for (const file of stagedFiles) {
    if (fs.existsSync(file)) {
      const stats = fs.statSync(file);
      const fileSizeInBytes = stats.size;
      
      if (fileSizeInBytes > MAX_FILE_SIZE) {
        console.error(`❌ File ${file} is too large: ${fileSizeInBytes} bytes (max: ${MAX_FILE_SIZE} bytes)`);
        console.error(`   Consider breaking this file into smaller modules.`);
        hasOversizedFiles = true;
      } else {
        console.log(`✅ ${file}: ${fileSizeInBytes} bytes (within limit)`);
      }
    }
  }

  if (hasOversizedFiles) {
    console.error('\n🚫 Commit blocked: Files exceed maximum size limit.');
    console.error('💡 Tip: Break large files into smaller, focused modules.');
    process.exit(1);
  } else if (stagedFiles.length > 0) {
    console.log('\n✅ All TypeScript files are within size limits.');
  }

} catch (error) {
  console.error('Error checking file sizes:', error.message);
  process.exit(1);
}