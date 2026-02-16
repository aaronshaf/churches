# MCP OAuth 2.1 Setup Guide

This guide explains how to configure OAuth 2.1 authentication for the MCP admin endpoint, enabling Claude.ai integration.

## Architecture Overview

The MCP system now supports dual authentication:

1. **OAuth 2.1 with PKCE** - For Claude.ai custom connectors (recommended)
2. **Session-based auth** - For browser-based access (fallback)

The `/mcp/admin` endpoint tries OAuth Bearer token authentication first, then falls back to Better Auth session cookies.

## OAuth Endpoints

### Discovery Endpoints (RFC 9728 & RFC 8414)

- `/.well-known/oauth-protected-resource` - Protected Resource Metadata
- `/.well-known/oauth-authorization-server` - Authorization Server Metadata

### OAuth Flow Endpoints

- `/oauth/authorize` - Authorization endpoint (initiates OAuth flow)
- `/oauth/callback` - Callback from Better Auth Google OAuth
- `/oauth/token` - Token exchange endpoint (code for access token)

## Database Tables

Three new tables support OAuth:

1. **oauth_clients** - OAuth client metadata (optional, not enforced)
2. **oauth_authorization_codes** - Short-lived codes with PKCE
3. **oauth_access_tokens** - Bearer tokens for API access

**Note:** Client registration is optional. The OAuth flow accepts any `client_id` and relies on PKCE for security.

## Quick Setup (2 Steps)

### 1. Apply Database Migrations

**Production:**
```bash
wrangler d1 execute DB --remote --file=drizzle/0011_add_session_id_to_audit.sql
wrangler d1 execute DB --remote --file=drizzle/0012_add_oauth_tables.sql
```

**Local (development):**
```bash
wrangler d1 execute DB --local --file=drizzle/0011_add_session_id_to_audit.sql
wrangler d1 execute DB --local --file=drizzle/0012_add_oauth_tables.sql
```

### 2. Configure Claude.ai Custom Connector

In Claude.ai, create a new MCP Custom Connector with these settings:

**Basic Settings:**
- Name: `Utah Churches MCP`
- MCP Endpoint: `https://your-domain.com/mcp/admin`

**Authentication:**
- Type: `OAuth 2.1`
- Authorization URL: `https://your-domain.com/oauth/authorize`
- Token URL: `https://your-domain.com/oauth/token`
- Client ID: `claude-ai-mcp`
- Client Secret: *(leave empty)*
- Scopes: `mcp:admin`
- Use PKCE: `Yes (S256)`

### 4. Test the Integration

1. In Claude.ai, try to use the MCP connector
2. You should be redirected to sign in with Google
3. After authentication, you'll be redirected back to Claude.ai
4. The connector should now work with all 18 MCP tools

## OAuth Flow Diagram

```
Claude.ai                 Your Server              Better Auth (Google)
    |                          |                           |
    |  1. /mcp/admin          |                           |
    |----------------------->[401 WWW-Authenticate]       |
    |                          |                           |
    |  2. GET /oauth/authorize?client_id=...&code_challenge=... |
    |------------------------->|                           |
    |                          |  3. Redirect to Google    |
    |                          |-------------------------->|
    |                          |                           |
    |  4. User signs in with Google                       |
    |<---------------------------------------------------------|
    |                          |                           |
    |  5. GET /oauth/callback?state=...                   |
    |------------------------->|                           |
    |                          |  6. Create auth code      |
    |                          |  with PKCE challenge      |
    |  7. Redirect with code   |                           |
    |<-------------------------|                           |
    |                          |                           |
    |  8. POST /oauth/token    |                           |
    |     code_verifier=...    |                           |
    |------------------------->|  9. Validate PKCE         |
    |                          |  10. Issue access token   |
    |  11. {access_token}      |                           |
    |<-------------------------|                           |
    |                          |                           |
    |  12. POST /mcp/admin     |                           |
    |     Authorization: Bearer <token>                    |
    |------------------------->|  13. Validate token       |
    |  14. MCP response        |                           |
    |<-------------------------|                           |
```

## Security Features

### PKCE (Proof Key for Code Exchange)

All authorization codes require PKCE:
- Client generates `code_verifier` (random string, 43-128 chars)
- Client sends SHA-256 hash as `code_challenge` during authorization
- Client sends original `code_verifier` during token exchange
- Server validates the challenge matches the verifier

### Token Expiration

- Authorization codes: 10 minutes
- Access tokens: 1 hour
- Both are validated on every request

### Role-Based Access

Only users with `admin` or `contributor` roles can:
- Authorize OAuth applications
- Receive access tokens
- Use MCP write tools

## Troubleshooting

### "Invalid code_challenge"

The PKCE code challenge format is invalid. It must be a 43-128 character base64url string.

### "Invalid code_verifier"

The PKCE code verifier doesn't match the challenge. Ensure the client is using the correct verifier.

### "Access token expired"

Access tokens expire after 1 hour. The client should request a new token using a fresh authorization code.

## API Reference

### Authorization Request

```
GET /oauth/authorize?
  response_type=code&
  client_id=claude-ai-mcp&
  redirect_uri=https://claude.ai/oauth/callback&
  scope=mcp:admin&
  state=random-state&
  code_challenge=abc123...&
  code_challenge_method=S256
```

### Token Request

```
POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
code=auth-code-here&
redirect_uri=https://claude.ai/oauth/callback&
client_id=claude-ai-mcp&
code_verifier=original-verifier-here
```

### Token Response

```json
{
  "access_token": "token-here",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "mcp:admin"
}
```

### Authenticated MCP Request

```
POST /mcp/admin
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}
```

## Implementation Files

- `src/db/schema.ts` - OAuth table schemas
- `src/utils/oauth.ts` - PKCE validation utilities
- `src/services/oauth-service.ts` - OAuth business logic
- `src/routes/oauth.ts` - OAuth endpoints
- `src/middleware/mcp-oauth-auth.ts` - Bearer token validation
- `src/middleware/mcp-unified-auth.ts` - Unified OAuth + session auth
- `src/routes/mcp-admin.ts` - MCP endpoint (uses unified auth)
- `drizzle/0012_add_oauth_tables.sql` - OAuth migration
