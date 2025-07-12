#!/bin/bash

# Script to apply all pending migrations to production D1 database

echo "🔄 Applying all migrations to production database..."
echo ""
echo "This will apply any missing migrations to production."
echo ""

# List of migration files in order
migrations=(
  "0000_wide_cerise.sql"
  "0001_cloudy_wild_pack.sql"
  "0002_add_performance_indices.sql"
  "0003_add_language_field.sql"
  "0004_add_mailing_address.sql"
  "0005_optimize_query_performance.sql"
  "0007_add_r2_image_fields.sql"
  "0008_add_church_images_table.sql"
)

# Apply each migration
for migration in "${migrations[@]}"; do
  echo "📋 Applying migration: $migration"
  if wrangler d1 execute utahchurches-production --file="drizzle/$migration"; then
    echo "✅ Successfully applied: $migration"
  else
    echo "⚠️  Migration may have already been applied or failed: $migration"
  fi
  echo ""
done

echo "✅ All migrations processed!"
echo ""
echo "You can verify the tables by running:"
echo "wrangler d1 execute utahchurches-production --command=\"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name\""