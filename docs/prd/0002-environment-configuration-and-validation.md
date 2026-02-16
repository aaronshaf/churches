# PRD-0002: Environment Configuration and Validation

Date: 2026-02-16
Status: Active
Owner: Application team

## Summary

Define required runtime configuration for the app and enforce clear validation behavior when configuration is missing.

## Problem

The app depends on multiple secrets and external services. Missing values can cause partial failures and unclear runtime behavior.

## Goals

- Define required and optional environment variables.
- Ensure missing required variables fail with actionable errors.
- Keep behavior consistent across API and page routes.
- Provide a safe local diagnostic path.

## Non-goals

- Secret rotation automation.
- Production diagnostic endpoint exposure.

## Required Runtime Configuration

- `BETTER_AUTH_SECRET` (min 32 chars)
- `BETTER_AUTH_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_MAPS_API_KEY`
- `GOOGLE_SSR_KEY`

Bindings (not env vars):

- `DB` (D1)
- `IMAGES_BUCKET` (R2)
- `SETTINGS_CACHE` (KV)

## Optional Runtime Configuration

- `SITE_DOMAIN`

## Functional Requirements

- Validate required config before dependent operations execute.
- API routes return JSON errors naming missing variables.
- HTML routes render user-facing configuration errors.
- Console logs include enough detail for debugging.
- Diagnostic endpoint is available in development only:
  - `GET /api/env-check`
- Diagnostic endpoint is not available in production.

## Setup Requirements

Local `.dev.vars` must include required variables:

```bash
GOOGLE_MAPS_API_KEY=your_maps_api_key
GOOGLE_SSR_KEY=your_server_side_maps_api_key
SITE_DOMAIN=localhost:8787
BETTER_AUTH_SECRET=your-secret-key-here-min-32-chars-long
BETTER_AUTH_URL=http://localhost:8787
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
```

Production secrets are managed with Wrangler:

```bash
wrangler secret put GOOGLE_MAPS_API_KEY
wrangler secret put GOOGLE_SSR_KEY
wrangler secret put SITE_DOMAIN
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put BETTER_AUTH_URL
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
```

## Success Criteria

- Missing required config is surfaced clearly in API and HTML paths.
- Local setup is reproducible with `.dev.vars`.
- Production has no env-related startup/runtime failures after deploy.
