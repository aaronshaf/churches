CREATE TABLE `affiliations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer DEFAULT '"2025-06-19T22:52:07.827Z"' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `affiliations_name_unique` ON `affiliations` (`name`);--> statement-breakpoint
CREATE TABLE `church_affiliations` (
	`church_id` integer NOT NULL,
	`affiliation_id` integer NOT NULL,
	`order` integer NOT NULL,
	PRIMARY KEY(`church_id`, `affiliation_id`),
	FOREIGN KEY (`church_id`) REFERENCES `churches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`affiliation_id`) REFERENCES `affiliations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `churches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`status` text,
	`notes` text,
	`last_updated` integer,
	`gathering_address` text,
	`latitude` real,
	`longitude` real,
	`county` text,
	`service_times` text,
	`website` text,
	`statement_of_faith` text,
	`phone` text,
	`email` text,
	`facebook` text,
	`instagram` text,
	`youtube` text,
	`spotify` text,
	`created_at` integer DEFAULT '"2025-06-19T22:52:07.827Z"' NOT NULL,
	`updated_at` integer DEFAULT '"2025-06-19T22:52:07.827Z"' NOT NULL
);
