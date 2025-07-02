import { readFileSync, writeFileSync } from 'fs';
import { randomBytes } from 'crypto';

console.log('🔧 Better-Auth Environment Setup');
console.log('=================================\n');

try {
  // Read existing .dev.vars file
  let envContent = '';
  try {
    envContent = readFileSync('.dev.vars', 'utf8');
  } catch {
    console.log('Creating new .dev.vars file...');
  }

  // Generate a secure secret
  const secret = randomBytes(32).toString('hex');

  // Check if better-auth variables are already set
  const lines = envContent.split('\n');
  let hasUseFlag = false;
  let hasSecret = false;
  let hasUrl = false;

  const newLines = lines.map(line => {
    if (line.startsWith('USE_BETTER_AUTH=')) {
      hasUseFlag = true;
      return 'USE_BETTER_AUTH=true';
    }
    if (line.startsWith('BETTER_AUTH_SECRET=')) {
      hasSecret = true;
      return line; // Keep existing secret
    }
    if (line.startsWith('BETTER_AUTH_URL=')) {
      hasUrl = true;
      return 'BETTER_AUTH_URL=http://localhost:8787';
    }
    return line;
  });

  // Add missing variables
  if (!hasUseFlag) {
    newLines.push('USE_BETTER_AUTH=true');
  }
  if (!hasSecret) {
    newLines.push(`BETTER_AUTH_SECRET=${secret}`);
  }
  if (!hasUrl) {
    newLines.push('BETTER_AUTH_URL=http://localhost:8787');
  }

  // Add optional Google OAuth variables if not present
  const hasGoogleClientId = lines.some(line => line.startsWith('GOOGLE_CLIENT_ID='));
  const hasGoogleClientSecret = lines.some(line => line.startsWith('GOOGLE_CLIENT_SECRET='));
  
  if (!hasGoogleClientId) {
    newLines.push('# GOOGLE_CLIENT_ID=your-google-client-id');
  }
  if (!hasGoogleClientSecret) {
    newLines.push('# GOOGLE_CLIENT_SECRET=your-google-client-secret');
  }

  // Write the updated file
  writeFileSync('.dev.vars', newLines.join('\n'));

  console.log('✅ Environment variables configured for better-auth!');
  console.log('\nAdded/updated variables:');
  console.log('- USE_BETTER_AUTH=true');
  if (!hasSecret) {
    console.log(`- BETTER_AUTH_SECRET=${secret.substring(0, 8)}...`);
  }
  console.log('- BETTER_AUTH_URL=http://localhost:8787');
  
  if (!hasGoogleClientId || !hasGoogleClientSecret) {
    console.log('\nOptional: Uncomment and fill in Google OAuth credentials if needed:');
    console.log('- GOOGLE_CLIENT_ID');
    console.log('- GOOGLE_CLIENT_SECRET');
  }

  console.log('\nNext steps:');
  console.log('1. Run: pnpm tsx scripts/generate-auth-schema.ts');
  console.log('2. Run: pnpm dev');
  console.log('3. Visit: http://localhost:8787/auth/signup');

} catch (error) {
  console.error('Error setting up environment:', error);
  process.exit(1);
}