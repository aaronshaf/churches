# ADR-0002: Cloudflare Images Variant Policy

Date: 2026-02-16
Status: Accepted
Deciders: Application team

## Context

The application serves church and site images through Cloudflare Images and needs consistent variant sizing for performance and predictable rendering.

## Decision

Use a fixed Cloudflare Images variant set:

- `favicon`: 64x64, fit `cover`, quality `85`
- `thumbnail`: 150x150, fit `cover`, quality `85`
- `small`: 300x300, fit `cover`, quality `85`
- `medium`: 600x600, fit `contain`, quality `85`
- `large`: 1200x1200, fit `contain`, quality `90`
- `public`: default variant for original image behavior

Favicon behavior:

- Accept JPG, PNG, and other Cloudflare-supported formats.
- Serve favicon via the `favicon` variant.
- Do not require ICO conversion.

Required environment variables:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_ACCOUNT_HASH`
- `CLOUDFLARE_IMAGES_API_TOKEN`

## Operational Setup

1. Open Cloudflare dashboard.
2. Go to Images > Variants.
3. Create/update variants using the policy above.

## Consequences

Positive:

- Predictable image sizes across UI surfaces.
- Better performance by avoiding oversized assets.
- Simpler frontend usage with stable variant names.

Tradeoffs:

- New use cases may need future variant additions.
- Variant drift in Cloudflare dashboard can break expectations if unmanaged.
