-- Fix duplicate/similar paths before adding UNIQUE constraint

-- 1. First, let's check which affiliations have the problematic names
-- ID 60 has "IFCA International " with trailing space
UPDATE affiliations 
SET path = 'ifca-international-2'
WHERE id = 60;

-- ID 61 has "Potter's House Christian Fellowship" but different path
UPDATE affiliations 
SET path = 'potters-house-christian-fellowship-2'  
WHERE id = 61;

-- 2. Now we can safely add the UNIQUE constraint
-- First drop the table and recreate it with the constraint (SQLite limitation)
-- We'll do this by creating a new table, copying data, and renaming

-- Create new affiliations table with UNIQUE constraint on path
CREATE TABLE affiliations_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  path TEXT UNIQUE,
  status TEXT DEFAULT 'Listed',
  website TEXT,
  private_notes TEXT,
  public_notes TEXT,
  created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
  updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
);

-- Copy all data from old table to new table
INSERT INTO affiliations_new (id, name, path, status, website, private_notes, public_notes, created_at, updated_at)
SELECT id, name, path, status, website, private_notes, public_notes, created_at, updated_at
FROM affiliations;

-- Update church_affiliations foreign key references (temporary disable)
PRAGMA foreign_keys=OFF;

-- Drop old table
DROP TABLE affiliations;

-- Rename new table to affiliations
ALTER TABLE affiliations_new RENAME TO affiliations;

-- Re-enable foreign keys
PRAGMA foreign_keys=ON;