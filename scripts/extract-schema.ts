#!/usr/bin/env bun
import { readFileSync, writeFileSync } from 'fs';

const prodBackup = readFileSync('prod-schema-backup.sql', 'utf-8');
const lines = prodBackup.split('\n');

let output = '';
let inCreateTable = false;
let currentStatement = '';

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Skip PRAGMA and INSERT statements
  if (line.startsWith('PRAGMA') || line.startsWith('INSERT')) {
    continue;
  }
  
  // Handle CREATE TABLE
  if (line.startsWith('CREATE TABLE')) {
    inCreateTable = true;
    currentStatement = line;
    
    // Look for the closing );
    let j = i + 1;
    while (j < lines.length && !lines[j].trim().startsWith(');')) {
      currentStatement += '\n' + lines[j];
      j++;
    }
    if (j < lines.length) {
      currentStatement += '\n);';
      output += currentStatement + '\n';
    }
    i = j; // Skip to the end of the CREATE TABLE
    inCreateTable = false;
  }
  
  // Handle CREATE INDEX
  else if (line.startsWith('CREATE INDEX') || line.startsWith('CREATE UNIQUE INDEX')) {
    output += line + ';\n';
  }
}

// Write the clean schema
writeFileSync('clean-schema.sql', output);
console.log('✅ Extracted clean schema to clean-schema.sql');