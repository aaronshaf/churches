import { config } from 'dotenv';

config({ path: '.dev.vars' });

console.log('🔍 Auth Systems Validation Guide');
console.log('=================================\n');

console.log('This script helps validate both Clerk and better-auth systems work correctly.\n');

const useClerk = process.env.USE_BETTER_AUTH !== 'true';
const useBetterAuth = process.env.USE_BETTER_AUTH === 'true';

console.log(`Current Configuration: ${useClerk ? 'Clerk' : 'Better-Auth'}\n`);

if (useClerk) {
  console.log('🟢 TESTING CLERK AUTHENTICATION');
  console.log('===============================\n');
  
  console.log('Environment Check:');
  console.log(`✓ USE_BETTER_AUTH: ${process.env.USE_BETTER_AUTH || 'not set (defaults to Clerk)'}`);
  console.log(`${process.env.CLERK_PUBLISHABLE_KEY ? '✓' : '❌'} CLERK_PUBLISHABLE_KEY: ${process.env.CLERK_PUBLISHABLE_KEY ? 'set' : 'not set'}`);
  console.log(`${process.env.CLERK_SECRET_KEY ? '✓' : '❌'} CLERK_SECRET_KEY: ${process.env.CLERK_SECRET_KEY ? 'set' : 'not set'}\n`);
  
  console.log('Manual Test Checklist:');
  console.log('□ 1. Visit: http://localhost:8787/login');
  console.log('□ 2. Should show Clerk login component');
  console.log('□ 3. Login with Clerk account');
  console.log('□ 4. Verify user menu appears in footer');
  console.log('□ 5. Check admin access (if admin user)');
  console.log('□ 6. Visit: http://localhost:8787/admin/users');
  console.log('□ 7. Verify user management works');
  console.log('□ 8. Logout via footer menu');
  
} else {
  console.log('🔵 TESTING BETTER-AUTH (GOOGLE OAUTH)');
  console.log('====================================\n');
  
  console.log('Environment Check:');
  console.log(`✓ USE_BETTER_AUTH: ${process.env.USE_BETTER_AUTH}`);
  console.log(`${process.env.BETTER_AUTH_SECRET ? '✓' : '❌'} BETTER_AUTH_SECRET: ${process.env.BETTER_AUTH_SECRET ? 'set' : 'not set'}`);
  console.log(`${process.env.BETTER_AUTH_URL ? '✓' : '❌'} BETTER_AUTH_URL: ${process.env.BETTER_AUTH_URL || 'not set (will default)'}`);
  console.log(`${process.env.GOOGLE_CLIENT_ID ? '✓' : '❌'} GOOGLE_CLIENT_ID: ${process.env.GOOGLE_CLIENT_ID ? 'set' : 'REQUIRED'}`);
  console.log(`${process.env.GOOGLE_CLIENT_SECRET ? '✓' : '❌'} GOOGLE_CLIENT_SECRET: ${process.env.GOOGLE_CLIENT_SECRET ? 'set' : 'REQUIRED'}\n`);
  
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.log('❌ Missing required Google OAuth credentials!\n');
    console.log('Setup Google OAuth:');
    console.log('1. Go to: https://console.cloud.google.com/apis/credentials');
    console.log('2. Create OAuth 2.0 Client ID');
    console.log('3. Add authorized redirect URI: http://localhost:8787/auth/callback/google');
    console.log('4. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .dev.vars\n');
    process.exit(1);
  }
  
  console.log('Database Schema Check:');
  console.log('□ Run: pnpm better-auth:schema (if not done yet)\n');
  
  console.log('Manual Test Checklist:');
  console.log('□ 1. Visit: http://localhost:8787/login');
  console.log('□ 2. Should redirect to: /auth/signin');
  console.log('□ 3. Should show "Continue with Google" button');
  console.log('□ 4. Click Google OAuth button');
  console.log('□ 5. Complete Google OAuth flow');
  console.log('□ 6. Should redirect back to app');
  console.log('□ 7. First user should become admin automatically');
  console.log('□ 8. Verify user menu appears in footer (initials avatar)');
  console.log('□ 9. Check admin access works');
  console.log('□ 10. Visit: http://localhost:8787/admin/users');
  console.log('□ 11. Verify user management works with better-auth');
  console.log('□ 12. Test logout via footer menu');
}

console.log('\n🔄 SWITCHING BETWEEN SYSTEMS');
console.log('============================\n');

console.log('To test the other system:');
if (useClerk) {
  console.log('1. Set USE_BETTER_AUTH=true in .dev.vars');
  console.log('2. Ensure Google OAuth credentials are set');
  console.log('3. Run: pnpm better-auth:schema');
  console.log('4. Restart: pnpm dev');
  console.log('5. Test better-auth flow');
} else {
  console.log('1. Set USE_BETTER_AUTH=false (or remove) in .dev.vars');
  console.log('2. Ensure Clerk credentials are set');
  console.log('3. Restart: pnpm dev');
  console.log('4. Test Clerk flow');
}

console.log('\n✅ SUCCESS CRITERIA');
console.log('==================\n');
console.log('Both auth systems should provide:');
console.log('□ User login/logout');
console.log('□ Role-based access control');
console.log('□ Admin user management');
console.log('□ Session persistence');
console.log('□ Proper redirects after login');
console.log('□ User menu in footer');
console.log('□ Protected admin routes');

console.log('\n📝 NOTES');
console.log('========\n');
console.log('- Clerk: External SaaS, JWT-based, supports multiple providers');
console.log('- Better-auth: Self-hosted, database sessions, Google OAuth only');
console.log('- Both systems support the same role structure (admin, contributor, user)');
console.log('- Migration preserves all existing functionality');
console.log('- Feature flag allows safe testing and rollback');