-- Create counties table
CREATE TABLE IF NOT EXISTS counties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  population INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Insert Utah counties
INSERT INTO counties (name, description, population) VALUES
  ('Beaver', 'Beaver County', 7072),
  ('Box Elder', 'Box Elder County', 57666),
  ('Cache', 'Cache County', 133154),
  ('Carbon', 'Carbon County', 20412),
  ('Daggett', 'Daggett County', 935),
  ('Davis', 'Davis County', 362679),
  ('Duchesne', 'Duchesne County', 19596),
  ('Emery', 'Emery County', 9825),
  ('Garfield', 'Garfield County', 5083),
  ('Grand', 'Grand County', 9669),
  ('Iron', 'Iron County', 57289),
  ('Juab', 'Juab County', 11786),
  ('Kane', 'Kane County', 7667),
  ('Millard', 'Millard County', 12975),
  ('Morgan', 'Morgan County', 12295),
  ('Piute', 'Piute County', 1438),
  ('Rich', 'Rich County', 2510),
  ('Salt Lake', 'Salt Lake County', 1185238),
  ('San Juan', 'San Juan County', 14518),
  ('Sanpete', 'Sanpete County', 28437),
  ('Sevier', 'Sevier County', 21522),
  ('Summit', 'Summit County', 42357),
  ('Tooele', 'Tooele County', 72698),
  ('Uintah', 'Uintah County', 35620),
  ('Utah', 'Utah County', 659399),
  ('Wasatch', 'Wasatch County', 34788),
  ('Washington', 'Washington County', 180279),
  ('Wayne', 'Wayne County', 2486),
  ('Weber', 'Weber County', 262223);

-- Add county_id column to churches table
ALTER TABLE churches ADD COLUMN county_id INTEGER REFERENCES counties(id);

-- Migrate existing county data
UPDATE churches 
SET county_id = (SELECT id FROM counties WHERE LOWER(counties.name) = LOWER(churches.county))
WHERE county IS NOT NULL;

-- Note: After verifying the migration, you can drop the old county column
-- ALTER TABLE churches DROP COLUMN county;