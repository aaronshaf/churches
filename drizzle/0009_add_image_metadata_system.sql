-- Add image metadata table
CREATE TABLE `images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`filename` text NOT NULL,
	`original_filename` text,
	`mime_type` text NOT NULL,
	`file_size` integer NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`blurhash` text NOT NULL,
	`alt_text` text,
	`caption` text,
	`uploaded_by` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Add new church images junction table (will replace existing church_images)
CREATE TABLE `church_images_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`church_id` integer NOT NULL,
	`image_id` integer NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`church_id`) REFERENCES `churches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE cascade
);

-- Create unique constraint on church_id and image_id
CREATE UNIQUE INDEX `idx_church_images_new_unique` ON `church_images_new` (`church_id`, `image_id`);

-- Add county images junction table
CREATE TABLE `county_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`county_id` integer NOT NULL,
	`image_id` integer NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`county_id`) REFERENCES `counties`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE cascade
);

-- Create unique constraint on county_id and image_id
CREATE UNIQUE INDEX `idx_county_images_unique` ON `county_images` (`county_id`, `image_id`);

-- Add affiliation images junction table
CREATE TABLE `affiliation_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`affiliation_id` integer NOT NULL,
	`image_id` integer NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`affiliation_id`) REFERENCES `affiliations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE cascade
);

-- Create unique constraint on affiliation_id and image_id
CREATE UNIQUE INDEX `idx_affiliation_images_unique` ON `affiliation_images` (`affiliation_id`, `image_id`);

-- Add site images table
CREATE TABLE `site_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`image_id` integer NOT NULL,
	`location` text NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE cascade
);

-- Create unique constraint on location and image_id
CREATE UNIQUE INDEX `idx_site_images_unique` ON `site_images` (`location`, `image_id`);