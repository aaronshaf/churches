-- Add image fields to pages table
ALTER TABLE `pages` ADD COLUMN `featured_image_id` text;
ALTER TABLE `pages` ADD COLUMN `featured_image_url` text;