# MCP `/mcp` Implementation Issue Set

Date: 2026-02-16
Source decisions:
- `plans/mcp-endpoint-prd.md`
- `docs/adr/0001-mcp-endpoint-architecture.md`

## Suggested PR Sequence

1. Database + schema groundwork
2. MCP auth/token core
3. MCP read surface (tools/resources)
4. MCP write surface (create/update/delete/restore + audit)
5. Admin token UI
6. Soft-delete propagation across existing routes
7. Tests + hardening

## Issue 1: Add MCP database schema

## Scope

- Add `deleted_at` to:
  - `churches`
  - `counties`
  - `affiliations` (networks)
- Add `mcp_tokens` table.
- Add `mcp_write_audit` table.
- Add indexes for expected query paths:
  - `deleted_at`
  - token lookup and revocation
  - audit by entity/record/time

## Acceptance Criteria

- Drizzle schema updated in `src/db/schema.ts` and auth schema area if needed.
- Generated migration present in `drizzle/` and tracked in `drizzle/meta/`.
- Migration applies successfully with `bun run db:migrate`.
- Existing app startup and core routes still run.

## Issue 2: Build MCP token service (hash + verify + role binding)

## Scope

- Implement token generation, hashing, verification, revocation, last-used update.
- Enforce bearer parsing (`Authorization: Bearer <token>` only).
- Resolve token to owning user and current role (`admin`/`contributor`).
- Enforce role + token authorization model.

## Acceptance Criteria

- Invalid/missing bearer token paths return `401`.
- Valid token with non-eligible role returns `403`.
- Revoked tokens no longer authenticate.
- Token plaintext is never persisted; only hash stored.

## Issue 3: Create `/mcp` route scaffold with Streamable HTTP

## Scope

- Mount unversioned `/mcp` endpoint.
- Implement Streamable HTTP transport handler.
- Capability shaping:
  - unauthenticated: read-only tools/resources
  - authenticated admin/contributor: read + write tools/resources

## Acceptance Criteria

- `/mcp` endpoint responds with valid Streamable HTTP MCP behavior.
- No `/mcp/v1` endpoint introduced.
- No SSE compatibility path added.

## Issue 4: Implement MCP read resources/tools

## Scope

- Entities: churches, counties, networks (`affiliations`).
- Support both `id` and `path` addressing.
- Support `limit` + `offset` pagination.
- Default exclude soft-deleted records.
- Unauthenticated reads:
  - public-only visibility
  - field sets aligned to existing public API contracts
- Authenticated reads:
  - include non-public records
- `include_deleted`:
  - admin-only

## Acceptance Criteria

- Read list/get/search operations work for all 3 entities.
- Public and authenticated visibility rules are enforced.
- Contributor cannot use `include_deleted`; admin can.

## Issue 5: Implement MCP write tools

## Scope

- Single-record create/update/delete/restore for churches/counties/networks.
- Partial update support.
- Soft delete by setting `deleted_at`.
- Restore (admin-only) clears `deleted_at`.
- Optimistic concurrency via required `updated_at` (or equivalent version token).
- On version mismatch return `409 Conflict`.

## Acceptance Criteria

- Contributor/admin can create/update/delete.
- Contributor cannot restore; admin can restore.
- Missing or stale version results in `409`.
- No bulk write operations exist.

## Issue 6: Add MCP write audit logging

## Scope

- Log every MCP write to new audit table:
  - user id
  - token id
  - action
  - entity
  - record id
  - diff
  - timestamp
- Do not log reads.

## Acceptance Criteria

- Every successful write creates one audit row.
- Failed writes do not create false success entries.
- Audit rows are queryable for incident review.

## Issue 7: Build admin UI for MCP tokens

## Scope

- Add token management screen in admin UI.
- Contributors:
  - create/list/revoke own tokens
- Admins:
  - create/list/revoke own tokens
  - view/manage all users' token metadata
- Show plaintext token once at create time only.

## Acceptance Criteria

- Role-based visibility and actions enforced server-side.
- Plaintext token unavailable after creation response.
- Metadata includes name, created time, last used, revoked status.

## Issue 8: Propagate soft-delete filtering across app surfaces

## Scope

- Ensure default exclusion of `deleted_at` rows from:
  - website pages
  - public API routes
  - admin list pages
- Add admin-only views/queries where deleted rows are intentionally needed.

## Acceptance Criteria

- Soft-deleted records disappear by default from all standard surfaces.
- Existing behavior remains unchanged for non-deleted records.

## Issue 9: Test matrix and hardening

## Scope

- Unit/integration tests for:
  - auth matrix (unauth/contributor/admin)
  - visibility matrix (public vs non-public vs deleted)
  - token revocation behavior
  - concurrency `409` behavior
  - audit insertion on writes only
- Run:
  - `bun test`
  - `bun run typecheck`
  - `bun run check`

## Acceptance Criteria

- New tests pass locally.
- Existing test suite passes.
- No type or lint regressions.

## Issue 10: Docs and operator runbook

## Scope

- Update docs with:
  - MCP endpoint usage
  - bearer auth format
  - token admin workflow
  - soft delete/restore semantics
  - troubleshooting (`401`, `403`, `409`)
- Keep ADR/PRD references current.

## Acceptance Criteria

- Documentation is sufficient for admin/operator onboarding.
- Error handling and recovery paths are documented.

## Release Checklist

- All issues completed and merged in sequence.
- `db:migrate` executed in target environments.
- Admins have initial MCP tokens created.
- Smoke test from Claude/Codex MCP connection:
  - unauth read works
  - auth read works
  - auth write works
  - restore admin-only check works
