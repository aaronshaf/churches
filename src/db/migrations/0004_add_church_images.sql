-- Add image fields to churches table
ALTER TABLE `churches` ADD COLUMN `image_id` text;
ALTER TABLE `churches` ADD COLUMN `image_url` text;