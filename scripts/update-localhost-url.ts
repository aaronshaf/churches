#!/usr/bin/env tsx

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const devVarsPath = join(process.cwd(), '.dev.vars');

if (!existsSync(devVarsPath)) {
  console.log('✅ No .dev.vars file found. Nothing to update.');
  process.exit(0);
}

try {
  let content = readFileSync(devVarsPath, 'utf-8');

  // Check if it still has the old localhost URL
  if (content.includes('BETTER_AUTH_URL=http://localhost:8787')) {
    // Update to new URL
    content = content.replace(
      'BETTER_AUTH_URL=http://localhost:8787',
      'BETTER_AUTH_URL=http://utahchurches.localhost:8787'
    );

    writeFileSync(devVarsPath, content);
    console.log('✅ Updated BETTER_AUTH_URL to http://utahchurches.localhost:8787');
  } else if (content.includes('BETTER_AUTH_URL=http://utahchurches.localhost:8787')) {
    console.log('✅ BETTER_AUTH_URL already uses utahchurches.localhost');
  } else {
    console.log('⚠️  BETTER_AUTH_URL has a custom value. Please verify it matches your development URL.');
  }
} catch (error) {
  console.error('❌ Error updating .dev.vars:', error);
  process.exit(1);
}
