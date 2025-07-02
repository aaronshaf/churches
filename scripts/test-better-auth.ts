import { config } from 'dotenv';

config({ path: '.dev.vars' });

console.log('🧪 Better-Auth Testing Guide');
console.log('============================\n');

console.log('To test the better-auth implementation:\n');

console.log('1. Set up environment variables in .dev.vars:');
console.log('   USE_BETTER_AUTH=true');
console.log('   BETTER_AUTH_SECRET=your-random-secret-key');
console.log('   BETTER_AUTH_URL=http://localhost:8787');
console.log('   (Optional) GOOGLE_CLIENT_ID=your-google-client-id');
console.log('   (Optional) GOOGLE_CLIENT_SECRET=your-google-client-secret\n');

console.log('2. Generate the auth schema:');
console.log('   pnpm tsx scripts/generate-auth-schema.ts\n');

console.log('3. Start the development server:');
console.log('   pnpm dev\n');

console.log('4. Test the auth flows:\n');

console.log('   Registration via Google OAuth (first user becomes admin):');
console.log('   - Visit: http://localhost:8787/auth/signin');
console.log('   - Click "Continue with Google"');
console.log('   - Complete Google OAuth flow');
console.log('   - Should redirect to /admin (first user auto-promoted)\n');

console.log('   Login via Google OAuth:');
console.log('   - Visit: http://localhost:8787/login');
console.log('   - Should redirect to /auth/signin');
console.log('   - Click "Continue with Google"\n');

console.log('   Admin functionality:');
console.log('   - Visit: http://localhost:8787/admin');
console.log('   - Visit: http://localhost:8787/admin/users');
console.log('   - All admin routes should work\n');

console.log('   Logout:');
console.log('   - Visit: http://localhost:8787/logout');
console.log('   - Should redirect to /auth/signout and then home\n');

console.log('5. Verify better-auth is working correctly:');
console.log('   - Check /admin/users for user management interface');
console.log('   - Verify role-based access control is working');
console.log('   - Test session persistence across browser restarts\n');

console.log('Current environment check:');
console.log(`USE_BETTER_AUTH: ${process.env.USE_BETTER_AUTH || 'not set'}`);
console.log(`BETTER_AUTH_SECRET: ${process.env.BETTER_AUTH_SECRET ? 'set' : 'not set'}`);
console.log(`BETTER_AUTH_URL: ${process.env.BETTER_AUTH_URL || 'not set'}`);
console.log(`GOOGLE_CLIENT_ID: ${process.env.GOOGLE_CLIENT_ID ? 'set' : 'not set'}`);
console.log(`GOOGLE_CLIENT_SECRET: ${process.env.GOOGLE_CLIENT_SECRET ? 'set' : 'not set'}`);
console.log(`TURSO_DATABASE_URL: ${process.env.TURSO_DATABASE_URL ? 'set' : 'not set'}`);
console.log(`TURSO_AUTH_TOKEN: ${process.env.TURSO_AUTH_TOKEN ? 'set' : 'not set'}`);