// Clerk configuration
export const CLERK_CONFIG = {
  // Frontend API URL
  frontendApi: 'https://clerk.utahchurches.com',
  
  // Backend API URL
  backendApi: 'https://api.clerk.com',
  
  // JWKS endpoint for token verification
  jwksUrl: 'https://clerk.utahchurches.com/.well-known/jwks.json',
  
  // Issuer for JWT validation
  issuer: 'https://clerk.utahchurches.com',
  
  // Redirect URLs
  signInUrl: '/login',
  signUpUrl: '/login', // Same as sign in for now
  afterSignInUrl: '/admin',
  afterSignUpUrl: '/admin',
  afterSignOutUrl: '/',
};

// Helper to get Clerk domain from publishable key
export function getClerkDomain(publishableKey: string): string {
  const match = publishableKey.match(/pk_(?:test|live)_(.+)\$/);
  return match ? match[1] : 'clerk.utahchurches.com';
}