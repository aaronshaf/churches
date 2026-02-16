# PRD: MCP Endpoint (`/mcp`) for Churches Data Administration

Date: 2026-02-16
Status: Approved for implementation planning
Owner: Application team

Related implementation checklist:
- `plans/mcp-implementation-issue-set.md`

## Summary

Build an MCP endpoint at `/mcp` so Claude/Codex clients can read and administer churches data over MCP Streamable HTTP transport.

## Problem

Current administration workflows are browser-first. Users need reliable, authenticated MCP access to manage churches data from AI clients (Claude/Codex) with clear auditability and safe write controls.

## Goals

- Expose MCP at `/mcp` using Streamable HTTP transport.
- Support MCP reads and writes for:
  - churches
  - counties
  - networks (backed by `affiliations` table)
- Allow public read access (no auth) for public data.
- Require authenticated bearer tokens for all authenticated MCP operations.
- Support contributor and admin write workflows.
- Add soft-delete semantics with admin-only restore.
- Add write audit logging in a dedicated table.

## Non-goals (v1)

- No SSE transport fallback.
- No endpoint versioning (`/mcp/v1` is out of scope).
- No dry-run/validate-only write mode.
- No bulk write operations.
- No rate limiting.
- No token expiry enforcement.
- No granular scope model beyond broad write scope.

## Users

- Unauthenticated MCP clients: read public data only.
- Authenticated contributor MCP clients: read public/non-public data, create/update/delete.
- Authenticated admin MCP clients: contributor permissions plus deleted-record visibility and restore.
- Admin UI users: token management with visibility over token metadata.

## Functional Requirements

## Endpoint and Transport

- Endpoint path is exactly `/mcp`.
- Transport is MCP Streamable HTTP only.
- `/mcp` is enabled in local, staging, and production.

## MCP Capabilities

- Expose both MCP `tools` and `resources`.
- Unauthenticated clients can connect and see read-only tools/resources.
- Authenticated admin/contributor clients can access both read and write capabilities.
- Record addressing supports both `id` and `path`.

## Read Access and Shape

- Unauthenticated reads are allowed.
- Unauthenticated reads must return only publicly visible, non-deleted records and fields.
- Read field sets must reuse existing public API output contracts for:
  - `/api/churches`
  - `/api/counties`
  - `/api/networks` (from affiliations)
- Authenticated admin/contributor reads may include non-public records.
- Soft-deleted records are excluded by default.
- `include_deleted` flag exists but only admins can use it.
- List reads support offset pagination (`limit`, `offset`).

## Write Access and Auth

- All authenticated MCP operations require `Authorization: Bearer <token>`.
- Session-cookie fallback is not supported on `/mcp`.
- Write authorization requires both:
  - valid token
  - current user role check (`admin` or `contributor`)
- Contributors can create/update/delete and can edit all fields.
- Writes are immediate (no moderation queue).
- Writes are single-record only.

## Token Model

- Per-user tokens.
- Broad write scope in v1.
- Multiple active tokens per user (no max cap).
- Non-expiring until revoked.
- Store token hash only; plaintext token shown once at creation.
- Token management in admin UI:
  - contributors manage own tokens
  - admins manage all users' tokens
- Admin visibility:
  - admins can see token metadata across users (never plaintext)

## Data Lifecycle and Concurrency

- Soft delete uses `deleted_at` timestamp.
- Soft-deleted records disappear by default across:
  - MCP reads
  - website pages
  - public API
  - admin lists
- Restore operation exists in v1 and is admin-only.
- Updates/deletes/restores require optimistic concurrency check using `updated_at` (or version equivalent).
- Concurrency mismatch returns `409 Conflict`.
- Updates are partial updates.

## Audit Requirements

- Create a new audit table for MCP writes.
- Log writes only (not reads).
- Each audit entry includes:
  - user id
  - token id
  - action
  - entity
  - record id
  - diff
  - timestamp

## Data/Schema Requirements

- Ensure `updated_at` is consistently present and used for concurrency checks on:
  - churches
  - counties
  - networks (`affiliations`)
- Add `deleted_at` support for:
  - churches
  - counties
  - networks (`affiliations`)
- Add MCP token storage table(s) and MCP write audit table.

## Security Requirements

- Reject missing/invalid bearer token for authenticated MCP operations.
- Enforce role checks from current user role, not token scope alone.
- Hash tokens at rest.
- Expose no plaintext token after initial creation response.

## Success Criteria

- Claude/Codex MCP clients can connect to `/mcp` and perform supported operations.
- Public clients can read public data with no auth.
- Authenticated admin/contributor clients can perform writes according to role.
- Deletes are soft deletes and hidden by default across product surfaces.
- Restore works for admins only.
- Every MCP write is auditable in the new audit table.
- Concurrency conflicts consistently return `409`.

## Validation and Testing

Smoke script:

- Command: `bun run mcp:smoke`
- Environment variables:
  - `MCP_BASE_URL` (default: `http://127.0.0.1:8787`)
  - `MCP_CONTRIBUTOR_TOKEN` (optional; enables contributor auth checks)
  - `MCP_ADMIN_TOKEN` (optional; enables admin checks)
  - `MCP_ENABLE_WRITES=true` (optional; enables create/update/delete/restore checks)
- Safety:
  - writes are disabled by default
  - with writes enabled, the script creates temporary county data and validates conflict/delete/restore flows
  - if no contributor token exists yet, write checks use `MCP_ADMIN_TOKEN` as the write actor

Claude Code MCP setup:

```bash
claude mcp add --transport http churches_admin http://localhost:56087/mcp \
  --header "Authorization: Bearer mcp_YOUR_ADMIN_TOKEN"
claude mcp add --transport http churches_read http://localhost:56087/mcp
claude mcp list
```

Claude Code verification prompts:

1. `Use churches_read. Call tools/list and print tool names.`
2. `Use churches_admin. Call tools/list and print tool names.`
3. `Use churches_read. Call churches_list with {"limit":3,"offset":0}.`
4. `Use churches_read. Call churches_list with {"limit":3,"offset":0,"include_deleted":true}.`
5. `Use churches_admin. Call churches_list with {"limit":3,"offset":0,"include_deleted":true}.`
6. `Use churches_read. Call counties_create with {"data":{"name":"MCP test","path":"mcp-test"}}.`
7. `Use churches_admin. Create a temporary county, then delete it.`

Expected outcomes:

- `churches_read` exposes read tools only.
- `churches_admin` exposes read + write tools.
- `include_deleted=true` is forbidden for read-only mode and allowed for admin mode.
- Writes fail on read-only mode and succeed on admin mode.

Token handling:

- plaintext tokens are shown once at creation and treated as secrets
- any token exposed in terminal/chat logs must be revoked and replaced

## Delivery Plan (High-level)

1. Schema migrations:
   - `deleted_at` columns
   - MCP token tables
   - MCP write audit table
2. MCP auth layer:
   - bearer token parsing
   - token hash verification
   - role + token authorization
3. MCP server surface:
   - tools/resources for churches, counties, networks
   - pagination, id/path addressing
4. Write workflows:
   - partial update, soft delete, restore
   - optimistic concurrency checks with `409`
5. Admin UI:
   - token create/list/revoke
   - admin visibility and contributor self-management
6. Global filtering:
   - default hide soft-deleted rows across website/API/admin lists
7. Validation and tests:
   - auth matrix
   - visibility matrix
   - audit log coverage
   - concurrency conflict handling
