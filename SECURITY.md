# Security Guidelines

This document outlines security practices for the Utah Churches project.

## Sensitive Data Protection

### ✅ What's Already Protected

- **Environment Variables**: All secrets use environment variables (`.env`, `.dev.vars`)
- **API Keys**: Google Maps, Auth secrets, etc. are in environment variables
- **Database Credentials**: No hardcoded database credentials in code

### 🚨 Configuration Files

#### wrangler.toml
- **DO NOT** commit your actual `wrangler.toml` with real database IDs
- Use `wrangler.example.toml` as a template
- Copy `wrangler.example.toml` to `wrangler.toml` and fill in your values
- `wrangler.toml` is gitignored to prevent accidental commits

#### Required Setup
```bash
# Copy the example file
cp wrangler.example.toml wrangler.toml

# Edit with your actual values
# - database_id: Your D1 database ID
# - preview_database_id: Your preview database ID  
# - bucket_name: Your R2 bucket name
```

### Environment Variables

Set these secrets using wrangler (never commit these values):

```bash
wrangler secret put GOOGLE_MAPS_API_KEY
wrangler secret put GOOGLE_SSR_KEY
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put BETTER_AUTH_URL
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
```

Optional environment variables:
```bash
wrangler secret put R2_IMAGE_DOMAIN  # Override default image domain
wrangler secret put OPENROUTER_API_KEY  # For AI features
```

### Local Development

Create `.dev.vars` file (gitignored) with your development values:
```
GOOGLE_MAPS_API_KEY=your_key_here
GOOGLE_SSR_KEY=your_key_here
BETTER_AUTH_SECRET=your_secret_here
BETTER_AUTH_URL=http://localhost:8787
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
```

## Database Security

- Database names in scripts are for convenience but should be configurable
- Database IDs are never committed to the repository
- Use environment-specific configurations

## Image Security

- R2 bucket names are configurable via environment
- Image domains can be overridden via `R2_IMAGE_DOMAIN` environment variable
- No hardcoded bucket IDs in the codebase

## Best Practices

1. **Never commit secrets** - Use environment variables
2. **Template config files** - Provide examples, not real values  
3. **Environment-specific configs** - Different values for dev/staging/prod
4. **Regular audits** - Review commits for accidental secret exposure
5. **Rotate secrets** - Periodically update API keys and secrets

## Emergency Response

If you accidentally commit sensitive data:

1. **Immediately rotate the compromised secrets**
2. **Remove the sensitive data from git history**:
   ```bash
   git filter-branch --force --index-filter \
     'git rm --cached --ignore-unmatch path/to/sensitive/file' \
     --prune-empty --tag-name-filter cat -- --all
   ```
3. **Update all deployments** with new secrets
4. **Force push** the cleaned history (⚠️ coordinate with team)