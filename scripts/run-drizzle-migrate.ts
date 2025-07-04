import { spawn } from 'child_process';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .dev.vars
config({ path: resolve(process.cwd(), '.dev.vars') });

// Check if required environment variables are present
if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error('❌ Missing required environment variables:');
  console.error('   TURSO_DATABASE_URL:', process.env.TURSO_DATABASE_URL ? '✓' : '✗');
  console.error('   TURSO_AUTH_TOKEN:', process.env.TURSO_AUTH_TOKEN ? '✓' : '✗');
  console.error('\nMake sure your .dev.vars file is properly configured.');
  process.exit(1);
}

console.log('🔄 Running Drizzle migration...');

// Run drizzle-kit migrate with the loaded environment
const child = spawn('drizzle-kit', ['migrate'], {
  stdio: 'inherit',
  env: { ...process.env },
  shell: true
});

child.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Migration completed successfully!');
  } else {
    console.log('❌ Migration failed with exit code:', code);
    process.exit(code);
  }
});

child.on('error', (error) => {
  console.error('❌ Failed to start migration process:', error.message);
  process.exit(1);
});