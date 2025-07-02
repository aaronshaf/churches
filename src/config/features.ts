// Feature flags for gradual migration
// Note: In Cloudflare Workers, we access env vars differently
export const isClerkEnabled = (env?: { USE_CLERK_AUTH?: string }) => {
  // Check if env is passed (from route context)
  if (env?.USE_CLERK_AUTH) {
    return env.USE_CLERK_AUTH === 'true';
  }
  // Fallback for build-time (won't work in Workers runtime)
  return false;
};