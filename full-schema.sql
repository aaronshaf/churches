CREATE TABLE `church_gatherings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`church_id` integer NOT NULL,
	`time` text NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT '"2025-07-05T18:15:10.616Z"' NOT NULL,
	`updated_at` integer DEFAULT '"2025-07-05T18:15:10.616Z"' NOT NULL,
	FOREIGN KEY (`church_id`) REFERENCES `churches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `church_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`church_id` integer NOT NULL,
	`image_id` text NOT NULL,
	`image_url` text NOT NULL,
	`caption` text,
	`display_order` integer DEFAULT 0,
	`created_at` integer DEFAULT '"2025-07-05T18:15:10.616Z"' NOT NULL,
	`updated_at` integer DEFAULT '"2025-07-05T18:15:10.616Z"' NOT NULL,
	FOREIGN KEY (`church_id`) REFERENCES `churches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `church_suggestions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`church_name` text NOT NULL,
	`denomination` text,
	`address` text,
	`city` text,
	`state` text DEFAULT 'UT',
	`zip` text,
	`website` text,
	`phone` text,
	`email` text,
	`service_times` text,
	`statement_of_faith` text,
	`facebook` text,
	`instagram` text,
	`youtube` text,
	`spotify` text,
	`notes` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewed_by` text,
	`reviewed_at` integer,
	`created_at` integer DEFAULT '"2025-07-05T18:15:10.616Z"' NOT NULL,
	`updated_at` integer DEFAULT '"2025-07-05T18:15:10.616Z"' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`church_id` integer,
	`content` text NOT NULL,
	`type` text DEFAULT 'user' NOT NULL,
	`metadata` text,
	`is_public` integer DEFAULT false,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewed_by` text,
	`reviewed_at` integer,
	`created_at` integer DEFAULT '"2025-07-05T18:15:10.616Z"' NOT NULL,
	`updated_at` integer DEFAULT '"2025-07-05T18:15:10.616Z"' NOT NULL,
	FOREIGN KEY (`church_id`) REFERENCES `churches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `counties` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`path` text,
	`description` text,
	`population` integer,
	`created_at` integer DEFAULT '"2025-07-05T18:15:10.616Z"' NOT NULL,
	`updated_at` integer DEFAULT '"2025-07-05T18:15:10.616Z"' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `counties_name_unique` ON `counties` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `counties_path_unique` ON `counties` (`path`);--> statement-breakpoint
CREATE TABLE `pages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`path` text NOT NULL,
	`content` text,
	`featured_image_id` text,
	`featured_image_url` text,
	`navbar_order` integer,
	`created_at` integer DEFAULT '"2025-07-05T18:15:10.616Z"' NOT NULL,
	`updated_at` integer DEFAULT '"2025-07-05T18:15:10.616Z"' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pages_path_unique` ON `pages` (`path`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`value` text,
	`created_at` integer DEFAULT '"2025-07-05T18:15:10.616Z"' NOT NULL,
	`updated_at` integer DEFAULT '"2025-07-05T18:15:10.616Z"' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settings_key_unique` ON `settings` (`key`);--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
DROP INDEX "affiliations_name_unique";--> statement-breakpoint
DROP INDEX "affiliations_path_unique";--> statement-breakpoint
DROP INDEX "churches_path_unique";--> statement-breakpoint
DROP INDEX "counties_name_unique";--> statement-breakpoint
DROP INDEX "counties_path_unique";--> statement-breakpoint
DROP INDEX "pages_path_unique";--> statement-breakpoint
DROP INDEX "settings_key_unique";--> statement-breakpoint
ALTER TABLE `affiliations` ALTER COLUMN "created_at" TO "created_at" integer NOT NULL DEFAULT '"2025-07-05T18:15:10.616Z"';--> statement-breakpoint
CREATE UNIQUE INDEX `affiliations_name_unique` ON `affiliations` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `affiliations_path_unique` ON `affiliations` (`path`);--> statement-breakpoint
CREATE UNIQUE INDEX `churches_path_unique` ON `churches` (`path`);--> statement-breakpoint
ALTER TABLE `affiliations` ADD `path` text;--> statement-breakpoint
ALTER TABLE `affiliations` ADD `status` text DEFAULT 'Listed';--> statement-breakpoint
ALTER TABLE `affiliations` ADD `website` text;--> statement-breakpoint
ALTER TABLE `affiliations` ADD `private_notes` text;--> statement-breakpoint
ALTER TABLE `affiliations` ADD `public_notes` text;--> statement-breakpoint
ALTER TABLE `affiliations` ADD `updated_at` integer DEFAULT '"2025-07-05T18:15:10.616Z"' NOT NULL;--> statement-breakpoint
ALTER TABLE `affiliations` DROP COLUMN `description`;--> statement-breakpoint
ALTER TABLE `churches` ALTER COLUMN "created_at" TO "created_at" integer NOT NULL DEFAULT '"2025-07-05T18:15:10.616Z"';--> statement-breakpoint
ALTER TABLE `churches` ALTER COLUMN "updated_at" TO "updated_at" integer NOT NULL DEFAULT '"2025-07-05T18:15:10.616Z"';--> statement-breakpoint
ALTER TABLE `churches` ADD `path` text;--> statement-breakpoint
ALTER TABLE `churches` ADD `private_notes` text;--> statement-breakpoint
ALTER TABLE `churches` ADD `public_notes` text;--> statement-breakpoint
ALTER TABLE `churches` ADD `county_id` integer REFERENCES counties(id);--> statement-breakpoint
ALTER TABLE `churches` ADD `language` text DEFAULT 'English' NOT NULL;--> statement-breakpoint
ALTER TABLE `churches` ADD `image_id` text;--> statement-breakpoint
ALTER TABLE `churches` ADD `image_url` text;--> statement-breakpoint
ALTER TABLE `churches` DROP COLUMN `notes`;--> statement-breakpoint
ALTER TABLE `churches` DROP COLUMN `county`;--> statement-breakpoint
ALTER TABLE `churches` DROP COLUMN `service_times`;CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false,
	`name` text,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`role` text DEFAULT 'user' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `verification_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`identifier` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
