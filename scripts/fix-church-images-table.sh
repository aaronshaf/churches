#!/bin/bash

echo "Fixing church_images table structure..."

# Drop the old table
echo "Dropping old church_images table..."
pnpm wrangler d1 execute utahchurches-production --command="DROP TABLE IF EXISTS church_images"

# Apply the correct migration
echo "Creating new church_images table with correct structure..."
pnpm wrangler d1 execute utahchurches-production --file=drizzle/0008_add_church_images_table.sql

echo "Done! The church_images table should now have the correct structure."