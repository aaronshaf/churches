-- Add R2 image fields to churches table
ALTER TABLE churches ADD COLUMN image_path TEXT;
ALTER TABLE churches ADD COLUMN image_alt TEXT;

-- Add R2 image fields to counties table  
ALTER TABLE counties ADD COLUMN image_path TEXT;
ALTER TABLE counties ADD COLUMN image_alt TEXT;

-- Add R2 image fields to pages table
ALTER TABLE pages ADD COLUMN featured_image_path TEXT;
ALTER TABLE pages ADD COLUMN featured_image_alt TEXT;

-- Add site logo and favicon settings
INSERT INTO settings (key, value) VALUES 
  ('site_logo_path', NULL),
  ('site_favicon_path', NULL)
ON CONFLICT (key) DO NOTHING;