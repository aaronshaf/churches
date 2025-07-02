import 'dotenv/config';

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

if (!CLERK_SECRET_KEY) {
  console.error('CLERK_SECRET_KEY is required');
  process.exit(1);
}

async function listUsers() {
  try {
    const response = await fetch('https://api.clerk.com/v1/users', {
      headers: {
        Authorization: `Bearer ${CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    console.log('Clerk Users:');
    console.log('===========');
    
    for (const user of data) {
      console.log(`ID: ${user.id}`);
      console.log(`Email: ${user.email_addresses?.[0]?.email_address || 'No email'}`);
      console.log(`Role: ${user.public_metadata?.role || 'user'}`);
      console.log(`Created: ${new Date(user.created_at).toISOString()}`);
      console.log('---');
    }
    
    console.log(`Total users: ${data.length}`);
  } catch (error) {
    console.error('Error listing users:', error);
  }
}

listUsers();