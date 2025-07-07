# Database Migrations Guide

This document explains how to manage database migrations for the Utah Churches project using Cloudflare D1 and Drizzle ORM.

## Overview

We use a simple dev/production setup with D1 databases:
- **Local Development**: SQLite database in `.wrangler/state/v3/d1/`
- **Production**: Cloudflare D1 (remote)

## Migration Workflow

### 1. Creating Schema Changes

```bash
# Edit the schema
vim src/db/schema.ts

# Generate migration SQL
bun run db:generate

# This creates a new file like: drizzle/0005_your_migration.sql
```

### 2. Applying Migrations Locally

```bash
# Apply to local D1 database
npx wrangler d1 execute utahchurches-production --local --file=./drizzle/0005_your_migration.sql

# Test your changes locally
bun run dev
```

### 3. Applying Migrations to Production

```bash
# Apply to production D1 database
npx wrangler d1 execute utahchurches-production --remote --file=./drizzle/0005_your_migration.sql

# Verify it worked
npx wrangler d1 execute utahchurches-production --remote --command="SELECT name FROM sqlite_master WHERE type='table';"
```

## Migration History

Track which migrations have been applied:

| Migration File | Local | Production | Date | Description |
|---------------|-------|------------|------|-------------|
| 0000_sleepy_piledriver.sql | ✅ | ✅ | 2025-01-04 | Initial schema |
| 0001_cloudy_wild_pack.sql | ✅ | ✅ | 2025-01-04 | Add church fields |
| 0002_add_performance_indices.sql | ✅ | ✅ | 2025-01-04 | Add database indices |
| 0003_add_language_field.sql | ✅ | ✅ | 2025-01-05 | Add language column |
| 0004_add_mailing_address.sql | ✅ | ✅ | 2025-01-05 | Add mailing_address column |

## Setting Up From Scratch

For new developers or fresh deployments:

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/churches.git
cd churches

# 2. Install dependencies
bun install

# 3. Create your D1 databases
wrangler d1 create utahchurches-production
wrangler d1 create utahchurches-preview

# 4. Update wrangler.toml with your database IDs
# Edit the database_id and preview_database_id fields

# 5. Apply all migrations in order
for file in drizzle/*.sql; do
  echo "Applying $file..."
  npx wrangler d1 execute utahchurches-production --local --file="$file"
  npx wrangler d1 execute utahchurches-production --remote --file="$file"
done

# 6. Set up environment variables
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your credentials

# 7. Run the development server
bun run dev
```

## Best Practices

1. **Always test migrations locally first**
2. **Back up production data before major migrations**
3. **Apply migrations in order** - don't skip migration files
4. **Commit migration files to git** immediately after creating them
5. **Document what each migration does** in this file

## Troubleshooting

### "no such column" errors
- The production database is missing a column that exists in your schema
- Apply the relevant migration file to production

### "table already exists" errors
- You're trying to apply a migration that's already been applied
- Check the migration history above

### Local/production mismatch
- Run all migrations on both local and production to sync them
- Use the "Setting Up From Scratch" steps if needed

## Emergency Rollback

D1 doesn't support automatic rollbacks, but you can:

1. Write a reverse migration manually
2. Restore from a D1 backup (if enabled)
3. Recreate the database from migrations (data loss warning!)

## Questions?

- Check D1 docs: https://developers.cloudflare.com/d1/
- Check Drizzle docs: https://orm.drizzle.team/docs/overview