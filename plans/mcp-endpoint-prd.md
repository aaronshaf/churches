# PRD: MCP Endpoints for Churches Data Administration

Date: 2026-02-16
Status: Revised (v2 - Session-based auth)
Owner: Application team

Related documents:
- `docs/adr/0001-mcp-endpoint-architecture.md`
- `plans/mcp-implementation-issue-set.md`

## Summary

Build two MCP endpoints using Streamable HTTP transport:
- `/mcp` - Public read-only access to church data (no authentication)
- `/mcp/admin` - Full read/write access using existing Better Auth session authentication

## Problem

Current administration workflows are browser-first. Users need:
1. **Public access**: Anyone should be able to query church data via MCP (read-only)
2. **Admin access**: Authenticated admins should manage data via MCP with full Claude.ai integration
3. **Simple auth**: Reuse existing Google OAuth (Better Auth) instead of managing bearer tokens

## Goals

### Public Endpoint (`/mcp`)
- Read-only access to public church data
- No authentication required
- Works with any MCP client
- Entities: churches, counties, networks (affiliations)

### Admin Endpoint (`/mcp/admin`)
- Full read/write access for admins and contributors
- Session-based authentication via Better Auth (existing Google OAuth)
- Works seamlessly with Claude.ai's custom connector (browser OAuth popup)
- Write audit logging
- Soft-delete with admin-only restore

## Non-goals (v1)

- No SSE transport fallback
- No endpoint versioning (`/mcp/v1`, `/mcp/v2`)
- No dry-run/validate-only write mode
- No bulk write operations
- No rate limiting
- No bearer token requirement (session-based only)

## Users

### Public MCP Users (`/mcp`)
- Anyone with an MCP client
- Read public church/county/network data
- No authentication needed
- Typical use: Browse Utah churches via Claude.ai

### Admin MCP Users (`/mcp/admin`)
- Authenticated admin/contributor users
- Sign in once via Google OAuth (Better Auth)
- Session persists across requests (cookie-based)
- Full read/write access
- Typical use: Manage church directory via Claude.ai with "Sign in with Google" flow

## Functional Requirements

## Endpoints and Transport

### `/mcp` - Public Read-Only
- **Path**: Exactly `/mcp`
- **Transport**: MCP Streamable HTTP only
- **Authentication**: None required
- **Capabilities**: Read-only tools and resources

### `/mcp/admin` - Session-Authenticated Admin
- **Path**: Exactly `/mcp/admin`
- **Transport**: MCP Streamable HTTP only
- **Authentication**: Better Auth session (Google OAuth)
- **Capabilities**: Full read/write tools and resources

## Authentication Flow (`/mcp/admin`)

1. **First request** without session → Return `401 Unauthorized` with auth redirect
2. **MCP client** (e.g., Claude.ai) opens browser popup → `/auth/signin`
3. **User clicks** "Sign in with Google" → Better Auth OAuth flow
4. **Session cookie** is set on successful auth
5. **Browser closes**, MCP client stores session cookie
6. **Subsequent requests** include session cookie → authenticated access

**Key benefit**: Reuses existing Better Auth infrastructure, no new OAuth app registration needed!

## MCP Capabilities

### Public Endpoint (`/mcp`)
- **Expose**: Read-only tools and resources
- **Entities**: churches, counties, networks
- **Data shape**: Public fields only (matches `/api/churches`, `/api/counties`, `/api/networks`)
- **Pagination**: Support `limit` and `offset`
- **Addressing**: Support both `id` and `path`

### Admin Endpoint (`/mcp/admin`)
- **Expose**: Full read/write tools and resources
- **Read**: Include non-public fields and optionally deleted records (`include_deleted` for admins)
- **Write**: Create, update, delete, restore (admin-only)
- **Audit**: Log all writes to `mcp_write_audit` table

## Read Access and Shape

### Public (`/mcp`)
- Only publicly visible, non-deleted records
- Field sets match existing public API contracts
- Soft-deleted records always excluded

### Admin (`/mcp/admin`)
- **Contributors**: See all non-deleted records and non-public fields
- **Admins**: Optionally include deleted records via `include_deleted` flag
- Support pagination (`limit`, `offset`)
- Addressing by `id` or `path`

## Write Access and Authorization (`/mcp/admin`)

- **Authentication**: Better Auth session cookie required
- **Authorization**: User must have `admin` or `contributor` role
- **Session validation**:
  - If no session → 401 with auth URL
  - If session but wrong role → 403 Forbidden
- **Writes**: Immediate (no moderation queue)
- **Scope**: Single-record only (no bulk operations)

## Data Lifecycle and Concurrency

- **Soft delete**: Set `deleted_at` timestamp
- **Visibility**: Soft-deleted records hidden by default across:
  - MCP endpoints
  - Website pages
  - Public API
  - Admin lists
- **Restore**: Admin-only operation, clears `deleted_at`
- **Concurrency**: Require `updated_at` match on update/delete/restore
- **Conflicts**: Return `409 Conflict` on version mismatch
- **Updates**: Partial updates supported

## Audit Requirements (`/mcp/admin` only)

- **Table**: `mcp_write_audit`
- **Log**: Writes only (not reads)
- **Fields**:
  - `user_id` (from session)
  - `session_id` (Better Auth session ID)
  - `action` (create/update/delete/restore)
  - `entity` (churches/counties/networks)
  - `record_id`
  - `diff` (before/after changes)
  - `created_at`

## Security Requirements

### Public Endpoint (`/mcp`)
- No authentication = read-only enforcement at code level
- Only expose public data
- No rate limiting (v1)

### Admin Endpoint (`/mcp/admin`)
- Session validation on every request
- Role-based authorization (admin/contributor)
- Session cookies are `HttpOnly`, `Secure`, `SameSite=Lax`
- Reuse Better Auth's existing security measures

## Success Criteria

- ✅ Public users can read church data via `/mcp` with no auth
- ✅ Admin users can sign in once via Google and manage data via `/mcp/admin`
- ✅ Claude.ai custom connector works with both endpoints:
  - `/mcp` - just URL, no auth needed
  - `/mcp/admin` - OAuth popup flow, session-based
- ✅ Soft deletes work across all surfaces
- ✅ Admin restore functionality works
- ✅ All writes are auditable
- ✅ Concurrency conflicts return `409`

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

## Delivery Plan

1. ✅ Schema migrations (already complete):
   - `deleted_at` columns
   - `mcp_write_audit` table

2. **New work**:
   - Refactor `/mcp` to be read-only (remove auth)
   - Create `/mcp/admin` endpoint with session auth
   - Add Better Auth session middleware
   - Update audit logging to use session ID instead of token ID
   - Test Claude.ai OAuth popup flow

3. Validation and tests:
   - Public endpoint is truly read-only
   - Admin endpoint requires valid session
   - OAuth popup flow works in Claude.ai
   - Audit log captures session-based writes
   - Concurrency conflict handling

## Migration from Bearer Tokens

- **Keep** `mcp_tokens` table for programmatic access (API clients)
- **Primary method**: Session-based auth for interactive use (Claude.ai)
- **Deprecate**: Manual token creation for most users
- **Future**: May sunset bearer tokens entirely if session-based works well
