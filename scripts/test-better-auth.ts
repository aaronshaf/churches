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

console.log('   Registration (first user becomes admin):');
console.log('   - Visit: http://localhost:8787/auth/signup');
console.log('   - Create an account');
console.log('   - Should redirect to /admin\n');

console.log('   Login:');
console.log('   - Visit: http://localhost:8787/login');
console.log('   - Should redirect to /auth/signin');
console.log('   - Login with your credentials\n');

console.log('   Admin functionality:');
console.log('   - Visit: http://localhost:8787/admin');
console.log('   - Visit: http://localhost:8787/admin/users');
console.log('   - All admin routes should work\n');

console.log('   Logout:');
console.log('   - Visit: http://localhost:8787/logout');
console.log('   - Should redirect to /auth/signout and then home\n');

console.log('5. Switch back to Clerk (for comparison):');
console.log('   - Set USE_BETTER_AUTH=false or remove the variable');
console.log('   - Restart the server');
console.log('   - All Clerk functionality should still work\n');

console.log('Current environment check:');
console.log(`USE_BETTER_AUTH: ${process.env.USE_BETTER_AUTH || 'not set'}`);
console.log(`BETTER_AUTH_SECRET: ${process.env.BETTER_AUTH_SECRET ? 'set' : 'not set'}`);
console.log(`BETTER_AUTH_URL: ${process.env.BETTER_AUTH_URL || 'not set'}`);
console.log(`TURSO_DATABASE_URL: ${process.env.TURSO_DATABASE_URL ? 'set' : 'not set'}`);
console.log(`TURSO_AUTH_TOKEN: ${process.env.TURSO_AUTH_TOKEN ? 'set' : 'not set'}`);