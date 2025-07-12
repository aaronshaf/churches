#!/bin/bash

# Script to apply the church_images migration to production D1 database

echo "🔄 Applying church_images migration to production database..."
echo ""
echo "This will create the church_images table in production."
echo ""

# Apply the specific migration file
echo "📋 Applying migration: 0008_add_church_images_table.sql"
wrangler d1 execute utahchurches-production --file=drizzle/0008_add_church_images_table.sql

echo ""
echo "✅ Migration complete!"
echo ""
echo "You can verify the table exists by running:"
echo "wrangler d1 execute utahchurches-production --command=\"SELECT name FROM sqlite_master WHERE type='table' AND name='church_images'\""