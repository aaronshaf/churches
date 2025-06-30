-- Merge duplicate affiliations and make paths unique

-- 1. First, update church affiliations to point to the correct affiliation
-- Move churches from ID 60 (IFCA with space) to ID 29 (IFCA without space)
UPDATE church_affiliations 
SET affiliation_id = 29 
WHERE affiliation_id = 60;

-- Move churches from ID 42 (Potter's House unused) to ID 61 (Potter's House with churches)
UPDATE church_affiliations 
SET affiliation_id = 61 
WHERE affiliation_id = 42;

-- 2. Delete the duplicate affiliations
DELETE FROM affiliations WHERE id IN (60, 42);

-- 3. Update the name of ID 29 to remove any trailing spaces (just in case)
UPDATE affiliations 
SET name = TRIM(name) 
WHERE id = 29;

-- 4. Fix the path for Potter's House to use the apostrophe version
UPDATE affiliations 
SET path = 'potters-house-christian-fellowship'
WHERE id = 61;

-- 5. Now create new table with UNIQUE constraint on path
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

-- 6. Copy all data from old table to new table
INSERT INTO affiliations_new (id, name, path, status, website, private_notes, public_notes, created_at, updated_at)
SELECT id, name, path, status, website, private_notes, public_notes, created_at, updated_at
FROM affiliations;

-- 7. Handle foreign keys
PRAGMA foreign_keys=OFF;

-- 8. Drop old table
DROP TABLE affiliations;

-- 9. Rename new table to affiliations
ALTER TABLE affiliations_new RENAME TO affiliations;

-- 10. Re-enable foreign keys
PRAGMA foreign_keys=ON;