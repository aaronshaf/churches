# ADR-0001: MCP Endpoint Architecture and Authorization Model

Date: 2026-02-16
Status: Accepted
Deciders: Application team

Related documents:
- `docs/prd/0001-mcp-endpoint.md`
- `plans/mcp-implementation-issue-set.md`

## Context

The project needs MCP integration so Claude/Codex clients can manage church directory data directly. Existing admin workflows are browser-centric, and current auth flows are cookie-oriented. MCP clients need explicit, programmatic auth and predictable write safety.

Target entities in v1:

- churches
- counties
- networks (logical name; backed by `affiliations`)

## Decision

1. MCP endpoint and transport
- Use a single unversioned endpoint: `/mcp`.
- Use MCP Streamable HTTP transport only.

2. Capability exposure model
- Expose both MCP tools and resources.
- Allow unauthenticated MCP connections for read-only tools/resources.
- Authenticated connections expose read + write capabilities.

3. Authentication and authorization
- Use `Authorization: Bearer <token>` for authenticated MCP operations.
- Do not support Better Auth session-cookie fallback on `/mcp`.
- Enforce authorization with both:
  - valid token
  - current user role check (`admin` or `contributor`)
- Keep v1 scope model broad (`mcp:write`-equivalent broad write capability).

4. Token lifecycle and ownership
- Per-user tokens with multiple active tokens allowed.
- Tokens are non-expiring until revoked.
- Store only hashed token values.
- Show plaintext token once at creation.
- Contributor users manage their own tokens.
- Admin users manage all tokens and can view all token metadata (not plaintext).

5. Data mutation policy
- Contributors and admins can create, update, delete.
- Updates are partial updates.
- Writes are immediate (no moderation queue).
- Writes are single-record only (no bulk in v1).

6. Soft delete and restore policy
- Use `deleted_at` timestamp for soft delete.
- Soft-deleted records are excluded by default across MCP, site, public API, and admin lists.
- Only admins can view deleted records (`include_deleted`) and perform restore.

7. Read visibility model
- Unauthenticated reads return only publicly visible fields/data.
- Public MCP read schemas reuse existing public API field sets.
- Authenticated admin/contributor reads may include non-public records.

8. Concurrency and conflict behavior
- Require `updated_at`/version match on update/delete/restore.
- On mismatch, return `409 Conflict` and require client retry flow.

9. Observability and audit
- Create a new dedicated audit table for MCP writes.
- Log writes only, not reads.
- Persist: user id, token id, action, entity, record id, diff, timestamp.

10. Rollout profile
- Enable in local, staging, and production.
- No v1 rate limiting.
- No v1 dry-run mode.

## Consequences

Positive:

- MCP clients get a predictable standard auth mechanism.
- Strong auditability via token-linked write logs.
- Reduced accidental data loss through soft delete + restore.
- Safer writes with optimistic concurrency and explicit conflicts.

Negative:

- Additional schema and admin UI complexity (token + audit + deleted state).
- Broad token scope reduces least-privilege precision in v1.
- No rate limiting in v1 increases abuse risk if tokens leak.

## Alternatives Considered

- Versioned endpoint (`/mcp/v1`): rejected for v1 simplicity; may revisit later.
- SSE support in addition to Streamable HTTP: rejected; Streamable HTTP only.
- Cookie/session auth fallback: rejected to avoid dual auth paths and CSRF/session ambiguity.
- Token-only authorization without role check: rejected due to stale privilege risk.
- Hard delete: rejected in favor of recoverability.
- Granular scopes (entity or action-level): rejected for v1 delivery speed.

## Follow-up Work

- Add schema migrations for:
  - `deleted_at` on churches/counties/affiliations
  - MCP token tables
  - MCP write audit table
- Implement bearer-token auth middleware for `/mcp`.
- Implement MCP tools/resources and role-based capability surfacing.
- Update existing list/read paths to hide soft-deleted rows by default.
- Add integration tests for auth matrix, visibility matrix, and `409` conflicts.
