-- Add new columns for private and public notes
ALTER TABLE churches ADD COLUMN private_notes TEXT;
ALTER TABLE churches ADD COLUMN public_notes TEXT;

-- Copy existing notes data to private_notes (assuming existing notes were private)
UPDATE churches SET private_notes = notes WHERE notes IS NOT NULL;

-- Drop the old notes column
ALTER TABLE churches DROP COLUMN notes;