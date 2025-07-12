# Environment Variables Documentation

This document describes all environment variables required by the Utah Churches application and how they are validated.

## Required Environment Variables

The application validates that all required environment variables are present at runtime and will display specific error messages indicating which variables are missing.

### Database Configuration
- Database is configured via D1 binding in wrangler.toml, no environment variables needed

### Authentication Configuration
- `BETTER_AUTH_SECRET` - Secret key for Better Auth sessions (minimum 32 characters)
- `BETTER_AUTH_URL` - Base URL for authentication (e.g., http://localhost:8787)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret

### Google Maps
- `GOOGLE_MAPS_API_KEY` - API key for Google Maps (required for the /map page)
- `GOOGLE_SSR_KEY` - Server-side API key for geocoding/address validation

## Optional Environment Variables

### Site Configuration
- `SITE_DOMAIN` - Domain for generating image URLs (e.g., localhost:8787 or utahchurches.com)

### R2 Storage (for image uploads)
- R2 bucket is configured via binding in wrangler.toml, no environment variables needed

## Environment Variable Validation

The application includes comprehensive environment variable validation:

1. **Database operations** - D1 database connection is handled via wrangler bindings
2. **Authentication flows** - Validates all auth-related variables before OAuth operations
3. **Map functionality** - Validates `GOOGLE_MAPS_API_KEY` when accessing the /map page
4. **Image uploads** - R2 bucket access is handled via wrangler bindings

## Error Handling

When required environment variables are missing:

1. **API Routes** - Return JSON error responses with specific missing variable names
2. **Web Pages** - Display user-friendly error pages with configuration instructions
3. **Console Logs** - Log detailed error information for debugging

## Development Setup

Create a `.dev.vars` file in the project root with all required variables:

```bash
GOOGLE_MAPS_API_KEY=your_maps_api_key
GOOGLE_SSR_KEY=your_server_side_maps_api_key
SITE_DOMAIN=localhost:8787
BETTER_AUTH_SECRET=your-secret-key-here-min-32-chars-long
BETTER_AUTH_URL=http://localhost:8787
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here

```

## Production Setup

Set production secrets using wrangler:

```bash
wrangler secret put GOOGLE_MAPS_API_KEY
wrangler secret put GOOGLE_SSR_KEY
wrangler secret put SITE_DOMAIN
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put BETTER_AUTH_URL
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET

```

## Diagnostic Endpoint

In development, you can check the status of environment variables:

```bash
curl http://localhost:8787/api/env-check
```

This endpoint is disabled in production for security reasons.