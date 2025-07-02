# Clerk Local Development Setup

## Known Issues

### Redirect URLs for localhost

When developing locally with Clerk, you'll encounter issues with redirect URLs because Clerk requires all redirect URLs to be explicitly allowed in their dashboard.

#### Problem
- Login from `http://localhost:8787/` tries to redirect back to `http://localhost:8787/admin`
- Logout tries to redirect to `http://localhost:8787/`
- Clerk returns 404 because these localhost URLs aren't configured as allowed redirect URLs

#### Solutions

1. **Configure Clerk Dashboard (Recommended)**
   - Go to your Clerk Dashboard
   - Navigate to "Paths" or "URLs & Redirects" 
   - Add these allowed redirect URLs:
     - `http://localhost:8787/*`
     - `http://localhost:8787/admin`
     - `http://localhost:8787/`
   
2. **Use Production URL for Testing**
   - Deploy your changes to production
   - Test authentication flows using the production URL
   
3. **Temporary Local Development Mode**
   - Set `USE_CLERK_AUTH=false` in `.dev.vars` to use legacy auth during development
   - Set `USE_CLERK_AUTH=true` only when testing Clerk integration

4. **Use ngrok or similar tunneling service**
   - Run `ngrok http 8787`
   - Add the ngrok URL to Clerk's allowed redirects
   - Use the ngrok URL for testing

## Current Implementation

The logout flow uses a client-side approach:
- `/logout` renders a page with JavaScript that loads Clerk SDK
- The SDK handles the sign-out process
- User is redirected to home page after sign-out

The login flow:
- For localhost, redirects to Clerk without a return URL
- For production, includes the full redirect URL
- After login, Clerk redirects to its default post-login URL (configured in dashboard)

## TODO
- Add localhost URLs to Clerk dashboard allowed redirects
- Or implement a development-specific authentication flow
- Consider using Clerk's development instances for local testing