# GitHub Actions Workflows

This directory contains automated workflows for CI/CD and maintenance tasks.

## Workflows

### 1. CI (`ci.yml`)
**Triggers:** On push to main, on pull requests
**Purpose:** Ensures code quality and builds successfully

**Jobs:**
- **Lint & Type Check**: Runs Biome linting/formatting checks and TypeScript type checking
- **Build**: Builds the application including CSS compilation and Wrangler dry-run
- **Security Check**: Audits dependencies and scans for hardcoded secrets

### 2. PR Check (`pr-check.yml`)
**Triggers:** On pull request events
**Purpose:** Validates pull requests before merge

**Checks:**
- PR title validation
- Merge conflict detection
- Large file warnings
- CLAUDE.md update reminders for significant changes

### 3. Deploy (`deploy.yml`)
**Triggers:** On push to main (after CI passes), manual trigger
**Purpose:** Deploys to Cloudflare Workers

**Requirements:**
- `CLOUDFLARE_API_TOKEN` secret must be set in repository settings
- Only runs on main branch
- Creates deployment summary on success

### 4. Dependency Check (`dependency-check.yml`)
**Triggers:** Weekly (Mondays at 9 AM UTC), manual trigger
**Purpose:** Monitors dependency updates and security

**Reports:**
- Outdated production dependencies
- Outdated development dependencies
- Security audit results
- Wrangler version status

## Required Secrets

To use these workflows, configure the following secrets in your repository settings:

1. **CLOUDFLARE_API_TOKEN** (Required for deployment)
   - Go to Cloudflare Dashboard → My Profile → API Tokens
   - Create token with "Edit Cloudflare Workers" permission
   - Add as repository secret

## Local Testing

You can test the CI checks locally:

```bash
# Run all CI checks
pnpm run ci

# Individual checks
pnpm run check      # Biome lint/format
pnpm run typecheck  # TypeScript check
pnpm run build      # Build test
```

## Workflow Status Badges

Add these to your README.md:

```markdown
[![CI](https://github.com/yourusername/churches/actions/workflows/ci.yml/badge.svg)](https://github.com/yourusername/churches/actions/workflows/ci.yml)
[![Deploy](https://github.com/yourusername/churches/actions/workflows/deploy.yml/badge.svg)](https://github.com/yourusername/churches/actions/workflows/deploy.yml)
```

## Troubleshooting

### Build Failures
- Check that all environment variables are properly mocked in CI
- Ensure pnpm-lock.yaml is up to date
- Verify TypeScript errors with `pnpm run typecheck`

### Deploy Failures
- Verify CLOUDFLARE_API_TOKEN is set correctly
- Check wrangler.toml configuration
- Ensure all required secrets are configured in Cloudflare

### Security Warnings
- Review pnpm audit output
- Update dependencies with security patches
- Never commit secrets to the repository