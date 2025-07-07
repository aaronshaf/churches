# Churches Directory Setup Guide

This guide walks you through setting up all the necessary services and configurations to run the Churches Directory application.

## Prerequisites

- Node.js 18+ installed
- bun 1.0+ installed (see [bun.sh](https://bun.sh) for installation)
- Git installed
- A domain name (optional, but recommended for production)

## 1. Cloudflare Account Setup

### Create Cloudflare Account
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/sign-up)
2. Create a free account
3. Verify your email address

### Install Wrangler CLI
```bash
npm install -g wrangler
```

### Authenticate Wrangler
```bash
wrangler login
```
This will open a browser window to authenticate with your Cloudflare account.

### Get Account ID
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select any domain (or add one)
3. On the right sidebar, find your Account ID
4. Copy this ID - you'll need it for `CLOUDFLARE_ACCOUNT_ID`

## 2. Turso Database Setup

### Create Turso Account
1. Go to [Turso](https://turso.tech)
2. Sign up for a free account
3. Install the Turso CLI:
   ```bash
   curl -sSfL https://get.tur.so/install.sh | bash
   ```

### Create Database
```bash
# Login to Turso
turso auth login

# Create a new database
turso db create churches-db

# Get the database URL
turso db show churches-db --url
# Save this URL for TURSO_DATABASE_URL

# Create an auth token
turso db tokens create churches-db
# Save this token for TURSO_AUTH_TOKEN
```

### Initialize Database Schema
```bash
# Clone the repository if you haven't already
git clone https://github.com/yourusername/churches.git
cd churches

# Install dependencies
bun install

# Push the schema to your database
bun run db:push

# Create better-auth tables
bun run better-auth:schema
```

## 3. Google Services Setup

### Google Maps API
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable these APIs:
   - Maps JavaScript API
   - Geocoding API
   - Places API
4. Go to "Credentials" → "Create Credentials" → "API Key"
5. Copy the API key for `GOOGLE_MAPS_API_KEY`
6. (Recommended) Restrict the API key:
   - Application restrictions: HTTP referrers
   - Add your domain(s): `https://yourdomain.com/*`
   - API restrictions: Select the APIs you enabled

### Google OAuth (for Authentication)
1. In the same Google Cloud project
2. Go to "APIs & Services" → "OAuth consent screen"
3. Configure consent screen:
   - User Type: External
   - App name: Your Churches Directory
   - User support email: Your email
   - Developer contact: Your email
4. Add scopes: email, profile, openid
5. Go to "Credentials" → "Create Credentials" → "OAuth client ID"
6. Application type: Web application
7. Add Authorized redirect URIs:
   - Development: `http://localhost:8787/auth/callback/google`
   - Production: `https://yourdomain.com/auth/callback/google`
8. Copy:
   - Client ID → `GOOGLE_CLIENT_ID`
   - Client Secret → `GOOGLE_CLIENT_SECRET`

## 4. Cloudflare Images Setup

### Enable Cloudflare Images
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select "Images" from the sidebar
3. Enable Cloudflare Images (requires payment method)
4. Note your Account Hash from the Images dashboard

### Create API Token for Images
1. Go to "My Profile" → "API Tokens"
2. Click "Create Token"
3. Use "Custom token" template
4. Configure:
   - Token name: Churches Images
   - Permissions: 
     - Account → Cloudflare Images → Edit
   - Account Resources: Include → Your account
5. Create token and copy it for `CLOUDFLARE_IMAGES_API_TOKEN`

## 5. OpenRouter Setup (for AI Features)

1. Go to [OpenRouter](https://openrouter.ai)
2. Create a free account
3. Go to [Keys](https://openrouter.ai/keys)
4. Create a new key
5. Copy the key for `OPENROUTER_API_KEY`

## 6. Environment Configuration

### Local Development (.dev.vars)
Create a `.dev.vars` file in the project root:

```bash
# Database
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token

# Google Services
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
GOOGLE_CLIENT_ID=your-oauth-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-oauth-client-secret

# Cloudflare
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_ACCOUNT_HASH=your-account-hash
CLOUDFLARE_IMAGES_API_TOKEN=your-images-api-token

# AI Features
OPENROUTER_API_KEY=your-openrouter-api-key

# Authentication
BETTER_AUTH_SECRET=generate-a-random-32-char-string-here
BETTER_AUTH_URL=http://localhost:8787
```

### Generate Better Auth Secret
```bash
# Generate a secure random string (32+ characters)
openssl rand -base64 32
```

### Production Secrets

You can set production secrets using either Wrangler CLI or Cloudflare Dashboard:

#### Option A: Using Wrangler CLI
```bash
# Set each secret
wrangler secret put TURSO_DATABASE_URL
wrangler secret put TURSO_AUTH_TOKEN
wrangler secret put GOOGLE_MAPS_API_KEY
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put CLOUDFLARE_ACCOUNT_ID
wrangler secret put CLOUDFLARE_ACCOUNT_HASH
wrangler secret put CLOUDFLARE_IMAGES_API_TOKEN
wrangler secret put OPENROUTER_API_KEY
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put BETTER_AUTH_URL
```

Enter each value when prompted.

#### Option B: Using Cloudflare Dashboard
1. Go to [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages)
2. Select your worker (after first deployment)
3. Go to "Settings" → "Variables"
4. Add each environment variable as an encrypted variable

## 7. Initial Deployment

```bash
# Deploy to Cloudflare Workers
bun run deploy
```

Note the deployment URL - this will be your application URL.

## 8. Post-Deployment Setup

### Update Better Auth URL
1. Update `BETTER_AUTH_URL` in production to your deployment URL:
   ```bash
   wrangler secret put BETTER_AUTH_URL
   # Enter: https://your-worker.workers.dev or your custom domain
   ```

### Update Google OAuth Redirect URI
1. Go back to Google Cloud Console
2. Edit your OAuth 2.0 Client ID
3. Add your production redirect URI:
   - `https://your-worker.workers.dev/auth/callback/google`
   - Or `https://yourdomain.com/auth/callback/google`

### Configure Site Settings
1. Visit your deployed application
2. Sign in with Google OAuth (first user becomes admin)
3. Go to `/admin/settings`
4. Configure:
   - Site Title
   - Site Domain
   - Site Region (e.g., "UT", "CA", etc.)
   - Front Page Title
   - Logo URL (optional)
   - Favicon URL (optional)

### Seed Initial Admin (Alternative)
If you need to manually create an admin user:
```bash
bun run db:seed
```

## 9. Custom Domain Setup (Optional)

### Add Custom Domain
1. Go to Cloudflare Dashboard → Workers & Pages
2. Select your worker
3. Go to "Custom Domains" tab
4. Add your domain

### Update Configuration
1. Update `BETTER_AUTH_URL` to use your custom domain
2. Update Google OAuth redirect URIs
3. Update site_domain in admin settings

## 10. Monitoring & Maintenance

### View Logs
```bash
wrangler tail
```

### Database Management
```bash
# View database in browser
bun run db:studio

# Generate migrations after schema changes
bun run db:generate

# Push schema changes
bun run db:push
```

### Update Dependencies
```bash
bun update
```

## Troubleshooting

### Common Issues

1. **Authentication not working**
   - Verify `BETTER_AUTH_URL` matches your deployment URL
   - Check Google OAuth redirect URIs include your domain
   - Ensure `BETTER_AUTH_SECRET` is the same in dev and production

2. **Database connection errors**
   - Verify Turso database is active
   - Check auth token hasn't expired
   - Ensure database URL includes `libsql://` protocol

3. **Images not uploading**
   - Verify Cloudflare Images is enabled on your account
   - Check API token has correct permissions
   - Ensure account hash is correct

4. **Map not loading**
   - Check Google Maps API key is valid
   - Verify required APIs are enabled in Google Cloud Console
   - Check for domain restrictions on API key

### Getting Help

- Check [CLAUDE.md](./CLAUDE.md) for development patterns
- Review error logs with `wrangler tail`
- Check Cloudflare Workers dashboard for metrics
- Open an issue on GitHub for bugs

## Security Checklist

- [ ] All secrets are set as encrypted environment variables
- [ ] Google OAuth is properly configured with correct redirect URIs
- [ ] API keys are restricted to your domain
- [ ] Database credentials are kept secure
- [ ] Better Auth secret is strong and unique
- [ ] No secrets are committed to git repository
- [ ] Production domain uses HTTPS

## Next Steps

1. Configure site settings in admin panel
2. Add counties for your region
3. Start adding churches
4. Customize pages (About, FAQ, etc.)
5. Set up regular database backups