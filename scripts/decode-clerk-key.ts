#!/usr/bin/env node

const key = process.argv[2];
if (!key) {
  console.log('Usage: pnpm tsx scripts/decode-clerk-key.ts <publishable_key>');
  process.exit(1);
}

try {
  const keyParts = key.split('_');
  if (keyParts.length >= 3) {
    const base64Part = keyParts.slice(2).join('_');
    console.log('Base64 part:', base64Part);
    
    const decoded = Buffer.from(base64Part, 'base64').toString('utf-8');
    console.log('Decoded domain:', decoded);
    
    const cleanDomain = decoded.endsWith('$') ? decoded.slice(0, -1) : decoded;
    console.log('Clean domain:', cleanDomain);
  }
} catch (error) {
  console.error('Error decoding:', error);
}