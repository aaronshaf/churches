-- Drop the old county text column from churches table
-- Run this after verifying that all data has been migrated to county_id

ALTER TABLE churches DROP COLUMN county;