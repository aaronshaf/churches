-- Add language field to churches table
ALTER TABLE churches ADD COLUMN language TEXT NOT NULL DEFAULT 'English';

-- Add index for language field for efficient searching
CREATE INDEX IF NOT EXISTS idx_churches_language ON churches(language);