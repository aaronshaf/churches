#!/bin/bash

echo "🚀 Initializing local D1 database..."

# Step 1: Clean up existing database
echo "🧹 Cleaning up existing database..."
rm -rf .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*
echo "✅ Cleaned up existing database files"

# Step 2: Extract schema only (no data) from production backup
echo "📖 Extracting schema from production backup..."

# Extract only CREATE TABLE, CREATE INDEX statements
grep -E '^(CREATE TABLE|CREATE INDEX|CREATE UNIQUE INDEX)' prod-schema-backup.sql > schema-only.sql

# Add semicolons where needed
sed -i '' 's/);$/);/g' schema-only.sql
sed -i '' 's/^\(CREATE.*INDEX.*\)$/\1;/g' schema-only.sql

# Step 3: Create the migrations table first
echo "🏗️  Creating migrations table..."
cat > temp-migrations.sql << 'EOF'
CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL
);
EOF

bun run wrangler d1 execute DB --local --file=temp-migrations.sql
rm temp-migrations.sql

# Step 4: Apply the schema
echo "🏗️  Applying database schema..."
bun run wrangler d1 execute DB --local --file=schema-only.sql

# Step 5: Mark migrations as applied
echo "📝 Marking migrations as applied..."
cat > temp-mark-migrations.sql << EOF
INSERT INTO __drizzle_migrations (hash, created_at) VALUES 
    ('0000_comprehensive_schema', $(date +%s)000),
    ('0001_auth_schema', $(date +%s)000)
ON CONFLICT(hash) DO NOTHING;
EOF

bun run wrangler d1 execute DB --local --file=temp-mark-migrations.sql
rm temp-mark-migrations.sql

# Step 6: Verify
echo "🔍 Verifying database setup..."
cat > temp-verify.sql << 'EOF'
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
EOF

bun run wrangler d1 execute DB --local --file=temp-verify.sql
rm temp-verify.sql

echo "✨ Local D1 database initialized successfully!"
echo "You can now run 'bun run dev' to start the development server."