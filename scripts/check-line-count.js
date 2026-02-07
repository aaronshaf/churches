#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Maximum line count for files
const MAX_LINES = 1000; // Start with 1000 lines as the limit

// ANSI color codes
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function countLines(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.split('\n').length;
  } catch (error) {
    console.error(`Error reading file ${filePath}: ${error.message}`);
    return 0;
  }
}

function getChangedFiles() {
  try {
    // Get staged files
    const staged = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' });
    const stagedFiles = staged.trim().split('\n').filter(Boolean).sort();

    // Filter for TypeScript/TSX files in src/
    const tsFiles = stagedFiles.filter(
      (file) => (file.endsWith('.ts') || file.endsWith('.tsx')) && file.startsWith('src/') && fs.existsSync(file)
    );

    return tsFiles;
  } catch (error) {
    console.log(`${colors.yellow}Warning: Could not get staged files${colors.reset}`);
    return [];
  }
}

function checkAllFiles() {
  try {
    // Check all TypeScript files in src/ in deterministic order.
    const result = execSync('rg --files src -g "*.ts" -g "*.tsx" | sort', { encoding: 'utf8' });
    return result.trim().split('\n').filter(Boolean);
  } catch (error) {
    console.error('Error finding files:', error.message);
    return [];
  }
}

function main() {
  console.log(`${colors.blue}${colors.bold}📏 Checking file line counts...${colors.reset}`);

  const filesToCheck = getChangedFiles();
  
  // If no staged files, check all files in CI mode
  const isCI = process.env.CI === 'true';
  const files = filesToCheck.length > 0 ? filesToCheck : (isCI ? checkAllFiles() : []);

  if (files.length === 0) {
    console.log(`${colors.green}✅ No files to check${colors.reset}`);
    return 0;
  }

  let hasViolations = false;
  const violations = [];

  for (const file of files) {
    const lineCount = countLines(file);
    
    if (lineCount > MAX_LINES) {
      violations.push({ file, lineCount });
      hasViolations = true;
    } else if (lineCount > MAX_LINES * 0.9) {
      // Warn if file is getting close to the limit
      console.log(`${colors.yellow}⚠️  ${file}: ${lineCount} lines (approaching limit of ${MAX_LINES})${colors.reset}`);
    } else {
      console.log(`${colors.green}✅ ${file}: ${lineCount} lines${colors.reset}`);
    }
  }

  if (hasViolations) {
    console.log(`\n${colors.red}${colors.bold}❌ Files exceed line count limit:${colors.reset}`);
    
    for (const { file, lineCount } of violations) {
      console.log(`${colors.red}   ${file}: ${lineCount} lines (max: ${MAX_LINES})${colors.reset}`);
    }
    
    console.log(`\n${colors.yellow}💡 Consider breaking large files into smaller modules${colors.reset}`);
    console.log(`${colors.yellow}   - Extract related functions into separate files${colors.reset}`);
    console.log(`${colors.yellow}   - Split route handlers into route modules${colors.reset}`);
    console.log(`${colors.yellow}   - Move types/interfaces to dedicated files${colors.reset}`);
    
    return 1;
  }

  console.log(`\n${colors.green}✅ All files are within line count limits${colors.reset}`);
  return 0;
}

// Run the check
const exitCode = main();
process.exit(exitCode);
