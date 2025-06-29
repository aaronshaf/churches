-- Create church_images table for multiple images per church
CREATE TABLE IF NOT EXISTS church_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  church_id INTEGER NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  image_id TEXT NOT NULL,
  image_url TEXT NOT NULL,
  caption TEXT,
  display_order INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
  updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
);

-- Create index for faster lookups
CREATE INDEX idx_church_images_church_id ON church_images(church_id);
CREATE INDEX idx_church_images_display_order ON church_images(display_order);