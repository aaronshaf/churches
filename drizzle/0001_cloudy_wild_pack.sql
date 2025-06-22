CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT '"2025-06-20T03:43:57.329Z"' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`user_type` text DEFAULT 'contributor' NOT NULL,
	`created_at` integer DEFAULT '"2025-06-20T03:43:57.329Z"' NOT NULL,
	`updated_at` integer DEFAULT '"2025-06-20T03:43:57.329Z"' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
DROP INDEX "affiliations_name_unique";--> statement-breakpoint
DROP INDEX "users_email_unique";--> statement-breakpoint
DROP INDEX "users_username_unique";--> statement-breakpoint
ALTER TABLE `affiliations` ALTER COLUMN "created_at" TO "created_at" integer NOT NULL DEFAULT '"2025-06-20T03:43:57.329Z"';--> statement-breakpoint
CREATE UNIQUE INDEX `affiliations_name_unique` ON `affiliations` (`name`);--> statement-breakpoint
ALTER TABLE `churches` ALTER COLUMN "created_at" TO "created_at" integer NOT NULL DEFAULT '"2025-06-20T03:43:57.329Z"';--> statement-breakpoint
ALTER TABLE `churches` ALTER COLUMN "updated_at" TO "updated_at" integer NOT NULL DEFAULT '"2025-06-20T03:43:57.329Z"';