-- Add sermon tracking fields to churches table
ALTER TABLE `churches` ADD `last_sermon_extracted_at` integer;
ALTER TABLE `churches` ADD `last_sermon_video_id` text;
ALTER TABLE `churches` ADD `sermon_count` integer DEFAULT 0;

-- Create sermons table
CREATE TABLE `sermons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`church_id` integer NOT NULL,
	`video_id` text NOT NULL,
	`youtube_title` text NOT NULL,
	`ai_generated_title` text,
	`main_bible_passage` text,
	`video_url` text NOT NULL,
	`duration_seconds` integer,
	`published_at` integer NOT NULL,
	`transcript_text` text,
	`processed_at` integer DEFAULT CURRENT_TIMESTAMP,
	`processed_by` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`church_id`) REFERENCES `churches`(`id`) ON UPDATE no action ON DELETE no action
);

-- Create unique index on video_id
CREATE UNIQUE INDEX `sermons_video_id_unique` ON `sermons` (`video_id`);

-- Create indexes for performance
CREATE INDEX `idx_sermons_church_id` ON `sermons` (`church_id`);
CREATE INDEX `idx_sermons_published_at` ON `sermons` (`published_at`);