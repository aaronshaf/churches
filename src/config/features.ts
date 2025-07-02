// Feature flags for gradual migration
export const features = {
  // Set to true to enable Clerk authentication
  // Set to false to use the existing session-based auth
  useClerkAuth: process.env.USE_CLERK_AUTH === 'true' || false,
};

export const isClerkEnabled = () => features.useClerkAuth;