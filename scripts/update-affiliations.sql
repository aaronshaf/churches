-- Add new columns to affiliations table
ALTER TABLE affiliations ADD COLUMN website TEXT;
ALTER TABLE affiliations ADD COLUMN private_notes TEXT;
ALTER TABLE affiliations ADD COLUMN public_notes TEXT;
ALTER TABLE affiliations ADD COLUMN updated_at INTEGER;