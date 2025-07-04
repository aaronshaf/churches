# Environment Variables Documentation

This document describes all environment variables required by the Utah Churches application and how they are validated.

## Required Environment Variables

The application validates that all required environment variables are present at runtime and will display specific error messages indicating which variables are missing.

### Database Configuration
- `TURSO_DATABASE_URL` - The URL for your Turso database
- `TURSO_AUTH_TOKEN` - Authentication token for Turso database access

### Authentication Configuration
- `BETTER_AUTH_SECRET` - Secret key for Better Auth sessions (minimum 32 characters)
- `BETTER_AUTH_URL` - Base URL for authentication (e.g., http://localhost:8787)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret

### Google Maps
- `GOOGLE_MAPS_API_KEY` - API key for Google Maps (required for the /map page)

## Optional Environment Variables

### Cloudflare Images (for image uploads)
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
- `CLOUDFLARE_IMAGES_API_TOKEN` - API token for Cloudflare Images
- `CLOUDFLARE_ACCOUNT_HASH` - Account hash for image delivery URLs

Note: If Cloudflare Images variables are not set, image upload functionality will not work and will show appropriate error messages.

## Environment Variable Validation

The application includes comprehensive environment variable validation:

1. **Database operations** - Validates `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` before any database connection
2. **Authentication flows** - Validates all auth-related variables before OAuth operations
3. **Map functionality** - Validates `GOOGLE_MAPS_API_KEY` when accessing the /map page
4. **Image uploads** - Validates Cloudflare variables when attempting to upload images

## Error Handling

When required environment variables are missing:

1. **API Routes** - Return JSON error responses with specific missing variable names
2. **Web Pages** - Display user-friendly error pages with configuration instructions
3. **Console Logs** - Log detailed error information for debugging

## Development Setup

Create a `.dev.vars` file in the project root with all required variables:

```bash
TURSO_DATABASE_URL=your_database_url
TURSO_AUTH_TOKEN=your_auth_token
GOOGLE_MAPS_API_KEY=your_maps_api_key
BETTER_AUTH_SECRET=your-secret-key-here-min-32-chars-long
BETTER_AUTH_URL=http://localhost:8787
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here

# Optional - for image uploads
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_IMAGES_API_TOKEN=your-api-token
CLOUDFLARE_ACCOUNT_HASH=your-account-hash
```

## Production Setup

Set production secrets using wrangler:

```bash
wrangler secret put TURSO_DATABASE_URL
wrangler secret put TURSO_AUTH_TOKEN
wrangler secret put GOOGLE_MAPS_API_KEY
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put BETTER_AUTH_URL
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET

# Optional - for image uploads
wrangler secret put CLOUDFLARE_ACCOUNT_ID
wrangler secret put CLOUDFLARE_IMAGES_API_TOKEN
wrangler secret put CLOUDFLARE_ACCOUNT_HASH
```

## Diagnostic Endpoint

In development, you can check the status of environment variables:

```bash
curl http://localhost:8787/api/env-check
```

This endpoint is disabled in production for security reasons.