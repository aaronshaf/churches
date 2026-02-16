-- Add soft-delete columns for MCP-managed entities
ALTER TABLE `churches` ADD `deleted_at` integer;
ALTER TABLE `counties` ADD `deleted_at` integer;
ALTER TABLE `affiliations` ADD `deleted_at` integer;

-- Index soft-delete columns for default filtering paths
CREATE INDEX `idx_churches_deleted_at` ON `churches` (`deleted_at`);
CREATE INDEX `idx_counties_deleted_at` ON `counties` (`deleted_at`);
CREATE INDEX `idx_affiliations_deleted_at` ON `affiliations` (`deleted_at`);

-- Per-user MCP tokens (hash-only at rest)
CREATE TABLE `mcp_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`token_name` text NOT NULL,
	`token_hash` text NOT NULL,
	`scope` text DEFAULT 'broad' NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_used_at` integer,
	`revoked_at` integer
);

CREATE UNIQUE INDEX `mcp_tokens_token_hash_unique` ON `mcp_tokens` (`token_hash`);
CREATE INDEX `idx_mcp_tokens_user_id` ON `mcp_tokens` (`user_id`);
CREATE INDEX `idx_mcp_tokens_revoked_at` ON `mcp_tokens` (`revoked_at`);

-- Audit trail for MCP writes only
CREATE TABLE `mcp_write_audit` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`token_id` integer NOT NULL,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`record_id` integer NOT NULL,
	`diff` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`token_id`) REFERENCES `mcp_tokens`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX `idx_mcp_write_audit_token_id` ON `mcp_write_audit` (`token_id`);
CREATE INDEX `idx_mcp_write_audit_entity_record` ON `mcp_write_audit` (`entity`, `record_id`);
CREATE INDEX `idx_mcp_write_audit_created_at` ON `mcp_write_audit` (`created_at`);
