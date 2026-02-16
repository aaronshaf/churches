# ADR-0001: MCP Endpoint Architecture and Authorization Model

Date: 2026-02-16 (Revised)
Status: Accepted
Deciders: Application team

Related documents:
- `plans/mcp-endpoint-prd.md`
- `plans/mcp-implementation-issue-set.md`

## Context

The project needs MCP integration so Claude.ai and other MCP clients can access church directory data. Two distinct use cases emerged:

1. **Public access**: Anyone should be able to query church data via MCP (read-only)
2. **Admin access**: Authenticated admins should manage data via MCP with full Claude.ai integration

Initial design used bearer tokens for authentication, but this creates friction for interactive use (Claude.ai custom connectors) where users must manually generate and paste tokens. Better Auth already provides Google OAuth, making session-based authentication the superior choice for interactive workflows.

Target entities in v1:
- churches
- counties
- networks (logical name; backed by `affiliations`)

## Decision

### 1. Dual-Endpoint Architecture

**Public Endpoint: `/mcp`**
- Read-only access to public church data
- No authentication required
- Works with any MCP client
- Exposes only public fields (matches existing public API contracts)

**Admin Endpoint: `/mcp/admin`**
- Full read/write access for authenticated users
- Session-based authentication via Better Auth (existing Google OAuth)
- Works seamlessly with Claude.ai's browser OAuth popup flow
- Exposes non-public fields and admin-only operations (restore deleted records)

### 2. Transport
- Use MCP Streamable HTTP transport only for both endpoints
- No SSE fallback in v1

### 3. Authentication Strategy

**Public endpoint (`/mcp`)**: No authentication
- Enforces read-only at code level
- Only exposes public data

**Admin endpoint (`/mcp/admin`)**: Session-based authentication
- Reuses existing Better Auth infrastructure (Google OAuth)
- Session validation on every request
- Role-based authorization (admin/contributor roles required)
- OAuth flow:
  1. First request without session → `401 Unauthorized` with auth redirect
  2. MCP client (e.g., Claude.ai) opens browser popup → `/auth/signin`
  3. User clicks "Sign in with Google" → Better Auth OAuth flow
  4. Session cookie is set on successful auth
  5. Browser closes, MCP client stores session cookie
  6. Subsequent requests include session cookie → authenticated access

**Key benefit**: No manual token generation required - users sign in once via familiar Google OAuth

### 4. Bearer Token Support (Secondary)

- Keep `mcp_tokens` table for programmatic API access
- May deprecate if session-based auth proves sufficient
- Primary use case: CI/CD systems, external integrations

### 5. Capability Exposure Model

**Public endpoint (`/mcp`)**:
- Read-only tools and resources
- Public entities: churches, counties, networks
- Pagination support via `limit` and `offset`
- Addressing by `id` or `path`

**Admin endpoint (`/mcp/admin`)**:
- Full read/write tools and resources
- Create, update, delete, restore operations
- Include deleted records via `include_deleted` flag (admin-only)
- Write audit logging

### 6. Data Mutation Policy (`/mcp/admin` only)
- Contributors and admins can create, update, delete
- Partial updates supported
- Writes are immediate (no moderation queue)
- Single-record operations only (no bulk in v1)

### 7. Soft Delete and Restore Policy
- Use `deleted_at` timestamp for soft delete
- Soft-deleted records excluded by default across:
  - MCP endpoints
  - Website pages
  - Public API
  - Admin lists
- Admin-only restore clears `deleted_at`
- Only admins can view deleted records via `include_deleted` parameter

### 8. Read Visibility Model

**Public endpoint**:
- Only publicly visible, non-deleted records
- Field sets match existing public API contracts

**Admin endpoint**:
- Contributors: All non-deleted records and non-public fields
- Admins: Optionally include deleted records via `include_deleted` flag

### 9. Concurrency and Conflict Behavior
- Require `updated_at` match on update/delete/restore
- Return `409 Conflict` on version mismatch
- Client must fetch fresh data and retry

### 10. Observability and Audit (`/mcp/admin` only)
- Table: `mcp_write_audit`
- Log writes only (not reads)
- Persist: user_id, session_id, action, entity, record_id, diff, timestamp
- **Note**: Uses `session_id` instead of `token_id` for session-based auth

### 11. Security Requirements

**Public endpoint**:
- No authentication = read-only enforcement at code level
- Only expose public data
- No rate limiting (v1)

**Admin endpoint**:
- Session validation on every request
- Role-based authorization (admin/contributor)
- Session cookies are `HttpOnly`, `Secure`, `SameSite=Lax`
- Reuse Better Auth's existing security measures

### 12. Rollout Profile
- Enable in local, staging, and production
- No v1 rate limiting
- No v1 dry-run mode
- No bulk write operations

## Consequences

### Positive

- **Seamless Claude.ai integration**: Browser OAuth popup flow eliminates manual token management
- **Reuses existing auth**: No new OAuth app registration or token management UI needed
- **Public access**: Anyone can query church data without friction
- **Strong auditability**: Session-linked write logs track all changes
- **Reduced data loss**: Soft delete + admin restore functionality
- **Safer writes**: Optimistic concurrency with explicit conflicts
- **Familiar UX**: Users already understand "Sign in with Google"

### Negative

- **Dual endpoint complexity**: Must maintain two endpoints with different capability sets
- **Session management**: Adds session validation overhead to every admin request
- **Limited programmatic access**: Bearer tokens remain as secondary option for automation
- **No rate limiting**: Increases abuse risk if sessions are compromised (v1)

## Alternatives Considered

### Single Endpoint with Optional Auth
**Rejected**: Confusing capability model - unclear what operations are available before authentication

### Bearer Token Primary Authentication
**Rejected**: Poor UX for interactive use (Claude.ai). Users must:
1. Navigate to admin panel
2. Generate token
3. Copy token
4. Paste into Claude.ai
This creates significant friction vs. one-click OAuth

### Cookie/Session Auth Only (No Bearer Tokens)
**Considered**: May implement in future if programmatic access isn't needed. Keeping bearer tokens as safety valve for now.

### Versioned Endpoints (`/mcp/v1`)
**Rejected**: Unnecessary complexity for v1. May revisit if breaking changes needed.

### SSE Transport Support
**Rejected**: Streamable HTTP sufficient for current use cases

### Hard Delete
**Rejected**: Soft delete provides recoverability and audit trail

### Granular Scopes (Entity/Action-Level)
**Rejected**: Broad `admin`/`contributor` roles sufficient for v1. May add scopes if needed.

## Migration from Bearer Tokens

- Existing bearer token implementation can remain for programmatic access
- Primary interactive workflow switches to session-based auth
- Users no longer need to manually manage tokens for Claude.ai usage
- May sunset bearer tokens entirely if session-based auth proves sufficient

## Claude.ai Integration

### Public Connector
```
Name: Utah Churches (Public)
URL: https://utahchurches.com/mcp
Auth: None
```

### Admin Connector
```
Name: Utah Churches (Admin)
URL: https://utahchurches.com/mcp/admin
Auth: Browser-based OAuth flow (Better Auth handles automatically)
```

## Follow-up Work

- ✅ Schema migrations (complete):
  - `deleted_at` on churches/counties/affiliations
  - MCP token tables
  - MCP write audit table

- **New work**:
  - Refactor `/mcp` to be read-only (remove auth logic)
  - Create `/mcp/admin` endpoint with session auth middleware
  - Add Better Auth session validation for `/mcp/admin` requests
  - Update audit logging to use `session_id` instead of `token_id`
  - Implement role-based capability surfacing (public vs admin tools/resources)
  - Update existing list/read paths to hide soft-deleted rows by default
  - Test Claude.ai OAuth popup flow with custom connector
  - Add integration tests for:
    - Public endpoint is truly read-only
    - Admin endpoint requires valid session
    - OAuth popup flow works in Claude.ai
    - Audit log captures session-based writes
    - Concurrency conflict handling (`409` responses)
    - Soft delete visibility across all surfaces
