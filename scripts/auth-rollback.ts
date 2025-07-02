import { readFileSync, writeFileSync } from 'fs';
import { config } from 'dotenv';

config({ path: '.dev.vars' });

console.log('🔄 Authentication System Rollback Tool');
console.log('======================================\n');

const currentSystem = process.env.USE_BETTER_AUTH === 'true' ? 'better-auth' : 'clerk';

console.log(`Current System: ${currentSystem}`);
console.log(`Target System: ${currentSystem === 'clerk' ? 'better-auth' : 'clerk'}\n`);

const action = process.argv[2];

if (!action || !['switch', 'rollback', 'status'].includes(action)) {
  console.log('Usage:');
  console.log('  pnpm auth:rollback status    # Show current status');
  console.log('  pnpm auth:rollback switch    # Switch to other system');
  console.log('  pnpm auth:rollback rollback  # Rollback to Clerk (safe fallback)');
  process.exit(1);
}

if (action === 'status') {
  console.log('🔍 Current Configuration:');
  console.log(`Active System: ${currentSystem}`);
  console.log(`USE_BETTER_AUTH: ${process.env.USE_BETTER_AUTH || 'not set (defaults to Clerk)'}`);
  
  if (currentSystem === 'clerk') {
    console.log(`CLERK_PUBLISHABLE_KEY: ${process.env.CLERK_PUBLISHABLE_KEY ? 'set' : 'not set'}`);
    console.log(`CLERK_SECRET_KEY: ${process.env.CLERK_SECRET_KEY ? 'set' : 'not set'}`);
  } else {
    console.log(`BETTER_AUTH_SECRET: ${process.env.BETTER_AUTH_SECRET ? 'set' : 'not set'}`);
    console.log(`BETTER_AUTH_URL: ${process.env.BETTER_AUTH_URL || 'not set'}`);
    console.log(`GOOGLE_CLIENT_ID: ${process.env.GOOGLE_CLIENT_ID ? 'set' : 'not set'}`);
    console.log(`GOOGLE_CLIENT_SECRET: ${process.env.GOOGLE_CLIENT_SECRET ? 'set' : 'not set'}`);
  }
  
  console.log('\n📋 Next Steps:');
  if (currentSystem === 'clerk') {
    console.log('- To test better-auth: pnpm auth:rollback switch');
    console.log('- To monitor: pnpm auth:validate');
  } else {
    console.log('- To rollback to Clerk: pnpm auth:rollback rollback');
    console.log('- To monitor: pnpm auth:validate');
  }
  
  process.exit(0);
}

try {
  // Read .dev.vars file
  let envContent = readFileSync('.dev.vars', 'utf8');
  const lines = envContent.split('\n');
  
  let updatedLines = lines.map(line => {
    if (line.startsWith('USE_BETTER_AUTH=')) {
      if (action === 'rollback') {
        return 'USE_BETTER_AUTH=false';
      } else if (action === 'switch') {
        const currentValue = line.split('=')[1];
        const newValue = currentValue === 'true' ? 'false' : 'true';
        return `USE_BETTER_AUTH=${newValue}`;
      }
    }
    return line;
  });
  
  // If USE_BETTER_AUTH doesn't exist, add it
  if (!lines.some(line => line.startsWith('USE_BETTER_AUTH='))) {
    if (action === 'switch') {
      updatedLines.push('USE_BETTER_AUTH=true');
    } else if (action === 'rollback') {
      updatedLines.push('USE_BETTER_AUTH=false');
    }
  }
  
  // Write updated file
  writeFileSync('.dev.vars', updatedLines.join('\n'));
  
  const newSystem = action === 'rollback' ? 'clerk' : 
                   (currentSystem === 'clerk' ? 'better-auth' : 'clerk');
  
  console.log(`✅ Successfully switched to: ${newSystem}`);
  
  if (newSystem === 'better-auth') {
    console.log('\n⚠️ Better-Auth Requirements:');
    console.log('- Ensure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set');
    console.log('- Run: pnpm better-auth:schema (if not done)');
    console.log('- Restart: pnpm dev');
    console.log('- Test: http://localhost:8787/auth/signin');
  } else {
    console.log('\n⚠️ Clerk Requirements:');
    console.log('- Ensure CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY are set');
    console.log('- Restart: pnpm dev');
    console.log('- Test: http://localhost:8787/login');
  }
  
  console.log('\n📊 Monitoring:');
  console.log('- Visit: http://localhost:8787/admin/monitoring');
  console.log('- Run: pnpm auth:validate');
  
} catch (error) {
  console.error('❌ Error updating configuration:', error.message);
  process.exit(1);
}