-- Create church_suggestions table for contributor suggestions
CREATE TABLE IF NOT EXISTS church_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  church_name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT DEFAULT 'UT',
  zip TEXT,
  website TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by TEXT,
  reviewed_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Create comments table for church comments
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  church_id INTEGER REFERENCES churches(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_public INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by TEXT,
  reviewed_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Add indices for performance
CREATE INDEX IF NOT EXISTS idx_church_suggestions_user_id ON church_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_church_suggestions_status ON church_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_church_id ON comments(church_id);
CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(status);