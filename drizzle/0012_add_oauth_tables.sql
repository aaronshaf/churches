-- OAuth 2.1 tables for MCP authentication

-- OAuth clients (pre-registered applications like Claude.ai)
CREATE TABLE `oauth_clients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` text NOT NULL,
	`client_secret` text,
	`client_name` text NOT NULL,
	`redirect_uris` text NOT NULL,
	`scope` text DEFAULT 'mcp:admin' NOT NULL,
	`grant_types` text DEFAULT 'authorization_code' NOT NULL,
	`response_types` text DEFAULT 'code' NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX `oauth_clients_client_id_unique` ON `oauth_clients` (`client_id`);

-- Authorization codes with PKCE support
CREATE TABLE `oauth_authorization_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`client_id` text NOT NULL,
	`user_id` text NOT NULL,
	`redirect_uri` text NOT NULL,
	`scope` text NOT NULL,
	`code_challenge` text NOT NULL,
	`code_challenge_method` text DEFAULT 'S256' NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `oauth_clients`(`client_id`) ON UPDATE no action ON DELETE no action
);

CREATE UNIQUE INDEX `oauth_authorization_codes_code_unique` ON `oauth_authorization_codes` (`code`);
CREATE INDEX `idx_oauth_auth_codes_client_id` ON `oauth_authorization_codes` (`client_id`);
CREATE INDEX `idx_oauth_auth_codes_user_id` ON `oauth_authorization_codes` (`user_id`);
CREATE INDEX `idx_oauth_auth_codes_expires_at` ON `oauth_authorization_codes` (`expires_at`);

-- Access tokens
CREATE TABLE `oauth_access_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`access_token` text NOT NULL,
	`client_id` text NOT NULL,
	`user_id` text NOT NULL,
	`scope` text NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `oauth_clients`(`client_id`) ON UPDATE no action ON DELETE no action
);

CREATE UNIQUE INDEX `oauth_access_tokens_access_token_unique` ON `oauth_access_tokens` (`access_token`);
CREATE INDEX `idx_oauth_access_tokens_client_id` ON `oauth_access_tokens` (`client_id`);
CREATE INDEX `idx_oauth_access_tokens_user_id` ON `oauth_access_tokens` (`user_id`);
CREATE INDEX `idx_oauth_access_tokens_expires_at` ON `oauth_access_tokens` (`expires_at`);
CREATE INDEX `idx_oauth_access_tokens_revoked_at` ON `oauth_access_tokens` (`revoked_at`);
