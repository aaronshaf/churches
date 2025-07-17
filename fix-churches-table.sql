-- Create the churches table with proper syntax
CREATE TABLE churches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  path TEXT UNIQUE,
  status TEXT CHECK (status IN ('Listed', 'Ready to list', 'Assess', 'Needs data', 'Unlisted', 'Heretical', 'Closed')),
  private_notes TEXT,
  public_notes TEXT,
  last_updated INTEGER,
  gathering_address TEXT,
  latitude REAL,
  longitude REAL,
  county_id INTEGER REFERENCES counties(id),
  website TEXT,
  statement_of_faith TEXT,
  phone TEXT,
  email TEXT,
  facebook TEXT,
  instagram TEXT,
  youtube TEXT,
  spotify TEXT,
  language TEXT NOT NULL DEFAULT 'English',
  image_id TEXT,
  image_url TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  mailing_address TEXT,
  image_path TEXT,
  image_alt TEXT
);

-- Create the church_affiliations junction table
CREATE TABLE IF NOT EXISTS church_affiliations (
  church_id INTEGER NOT NULL,
  affiliation_id INTEGER NOT NULL,
  PRIMARY KEY (church_id, affiliation_id),
  FOREIGN KEY (church_id) REFERENCES churches(id),
  FOREIGN KEY (affiliation_id) REFERENCES affiliations(id)
);

-- Create indexes on the churches table
CREATE INDEX IF NOT EXISTS idx_churches_status ON churches(status);
CREATE INDEX IF NOT EXISTS idx_churches_county_id ON churches(county_id);
CREATE INDEX IF NOT EXISTS idx_churches_language ON churches(language);