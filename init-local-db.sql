-- Create drizzle migrations tracking table
CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL
);

-- Mark the comprehensive schema as applied
INSERT INTO __drizzle_migrations (hash, created_at) VALUES 
    ('0000_wide_cerise', strftime('%s', 'now') * 1000),
    ('0001_cute_forgotten_one', strftime('%s', 'now') * 1000);
EOF < /dev/null