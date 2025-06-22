-- Add path column to churches table
ALTER TABLE churches ADD COLUMN path TEXT;

-- Create unique index on path
CREATE UNIQUE INDEX idx_churches_path ON churches(path) WHERE path IS NOT NULL;