-- Add path column to counties table
ALTER TABLE counties ADD COLUMN path TEXT;

-- Create unique index on path
CREATE UNIQUE INDEX idx_counties_path ON counties(path) WHERE path IS NOT NULL;

-- Generate default paths from county names (lowercase, replace spaces with hyphens)
UPDATE counties 
SET path = LOWER(REPLACE(REPLACE(name, ' ', '-'), '.', ''))
WHERE path IS NULL;