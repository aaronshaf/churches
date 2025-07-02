import { config } from 'dotenv';

config({ path: '.dev.vars' });

console.log('📝 Better-Auth Admin User Setup Instructions');
console.log('==========================================\n');

console.log('Better-auth handles user registration through its own API.');
console.log('To create an admin user:\n');

console.log('1. Make sure USE_BETTER_AUTH=true is set in your environment');
console.log('2. Start the development server: pnpm dev');
console.log('3. Navigate to: http://localhost:8787/auth/signup');
console.log('4. Register your first user (they will automatically become admin)');
console.log('\nAlternatively, you can use the API directly:\n');

console.log('POST http://localhost:8787/auth/signup');
console.log('Content-Type: application/json');
console.log('');
console.log('{');
console.log('  "email": "admin@example.com",');
console.log('  "password": "your-secure-password",');
console.log('  "name": "Admin User"');
console.log('}');
console.log('\nThe first user registered will automatically be assigned the admin role.');