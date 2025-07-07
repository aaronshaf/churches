# Turso to Cloudflare D1 Migration Plan

## Executive Summary

This document outlines the complete migration from Turso SQLite to Cloudflare D1 for the Utah Churches application. The migration will preserve all existing data while transitioning to D1's serverless, globally distributed SQLite infrastructure.

## Migration Overview

### Current State
- **Database**: Turso SQLite (edge-distributed SQLite)
- **ORM**: Drizzle ORM with `@libsql/client`
- **Tables**: 10 main tables with comprehensive church data
- **Authentication**: Better-auth with database sessions
- **Data Size**: Estimated < 1GB (well within D1's 10GB limit)

### Target State
- **Database**: Cloudflare D1 (serverless SQLite)
- **ORM**: Drizzle ORM with `@cloudflare/d1` bindings
- **Same Schema**: No structural changes needed
- **Enhanced Features**: Global read replication (beta), built-in Time Travel backups

## Phase 1: Pre-Migration Preparation

### 1.1 Environment Setup (For You)

**Create D1 Database:**
```bash
# Create the D1 database
wrangler d1 create utahchurches-production

# Note the database_id from the output - you'll need this for wrangler.toml
```

**Update wrangler.toml:**
```toml
# Add to wrangler.toml
[[d1_databases]]
binding = "DB"
database_name = "utahchurches-production"
database_id = "your-database-id-here"
```

### 1.2 Create Development Database (For You)

```bash
# Create local development database
wrangler d1 create utahchurches-dev

# Add to wrangler.toml for development
[[d1_databases]]
binding = "DB"
database_name = "utahchurches-dev"
database_id = "your-dev-database-id-here"
```

### 1.3 Backup Current Data (For You)

```bash
# Export current Turso data to SQL dump
# This will require accessing your Turso database directly
# Method depends on your Turso setup - likely through their CLI or dashboard
```

## Phase 2: Code Migration

### 2.1 Update Dependencies (For Claude)

**package.json changes:**
```json
{
  "dependencies": {
    // Remove
    // "@libsql/client": "^0.15.9",
    
    // Keep existing
    "drizzle-orm": "^0.44.2",
    "better-auth": "^1.2.12"
  }
}
```

### 2.2 Update Database Client (For Claude)

**Current file: `src/db/index.ts`**
```typescript
// BEFORE (Turso)
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';

const client = createClient({
  url: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client);
```

**AFTER (D1):**
```typescript
// Update to D1
import { drizzle } from 'drizzle-orm/d1';

export const createDb = (d1: D1Database) => {
  return drizzle(d1);
};

// Usage in handlers
const db = createDb(c.env.DB);
```

### 2.3 Update Environment Variables (For You)

**Remove from .dev.vars:**
```bash
# Remove these
TURSO_DATABASE_URL=your_database_url
TURSO_AUTH_TOKEN=your_auth_token
```

**Remove from production secrets:**
```bash
# Remove these secrets
wrangler secret delete TURSO_DATABASE_URL
wrangler secret delete TURSO_AUTH_TOKEN
```

### 2.4 Update Handlers (For Claude)

**Update all route handlers to use D1 binding:**

Example pattern:
```typescript
// BEFORE
app.get('/api/churches', async (c) => {
  const churches = await db.select().from(churches);
  return c.json(churches);
});

// AFTER
app.get('/api/churches', async (c) => {
  const db = createDb(c.env.DB);
  const churches = await db.select().from(churches);
  return c.json(churches);
});
```

### 2.5 Update Better-Auth Configuration (For Claude)

**Update Better-Auth to use D1:**
```typescript
// In auth configuration
import { d1Adapter } from "better-auth/adapters/d1";

export const auth = betterAuth({
  database: d1Adapter(c.env.DB),
  // ... rest of config
});
```

## Phase 3: Schema Migration

### 3.1 Generate D1 Schema (For You)

```bash
# Generate the initial schema for D1
bun run db:generate

# Apply schema to D1 local
wrangler d1 execute utahchurches-dev --file=drizzle/[migration-file].sql

# Apply schema to D1 production
wrangler d1 execute utahchurches-production --file=drizzle/[migration-file].sql
```

### 3.2 Better-Auth Schema (For You)

```bash
# Generate Better-Auth tables in D1
bun run better-auth:schema

# Or manually create using their SQL
wrangler d1 execute utahchurches-production --file=auth-schema.sql
```

## Phase 4: Data Migration

### 4.1 Export Data from Turso (For You)

**Method 1: Direct Database Export**
```bash
# If you have direct access to Turso SQLite file
sqlite3 your-turso-db.sqlite3 .dump > turso-data.sql
```

**Method 2: Application-Level Export**
```bash
# Create a one-time export script
bun run tsx scripts/export-turso-data.ts
```

### 4.2 Clean Export Data (For You)

```bash
# Remove transaction statements and problematic commands
sed -i 's/BEGIN TRANSACTION;//g' turso-data.sql
sed -i 's/COMMIT;//g' turso-data.sql
sed -i '/PRAGMA foreign_keys=OFF;/d' turso-data.sql
```

### 4.3 Import Data to D1 (For You)

```bash
# Import to development first
wrangler d1 execute utahchurches-dev --file=turso-data.sql

# Verify data integrity
wrangler d1 execute utahchurches-dev --command="SELECT COUNT(*) FROM churches;"

# Import to production
wrangler d1 execute utahchurches-production --file=turso-data.sql
```

## Phase 5: Testing & Validation

### 5.1 Local Testing (For You)

```bash
# Test with local D1 database
wrangler dev --local

# Verify all functionality:
# - Church listings
# - Admin panel
# - Authentication
# - Data exports
# - Map functionality
```

### 5.2 Production Testing (For You)

```bash
# Deploy to staging/preview
wrangler deploy --name=utahchurches-staging

# Test against production D1 database
# Verify data integrity and functionality
```

## Phase 6: Deployment

### 6.1 Update Production Environment (For You)

```bash
# Deploy the updated code
bun run deploy

# Verify deployment
# Check all critical paths
```

### 6.2 Monitor Performance (For You)

```bash
# Enable D1 analytics in Cloudflare dashboard
# Monitor query performance
# Check for any errors or timeouts
```

## Phase 7: Post-Migration Optimization

### 7.1 Enable Global Read Replication (For You)

```bash
# Enable beta global read replication
# This will improve read performance globally
# Configure in Cloudflare dashboard
```

### 7.2 Set Up Time Travel Backups (For You)

```bash
# Configure backup retention (30 days by default)
# Test point-in-time recovery
# Document recovery procedures
```

## Migration Script Templates

### Export Script Template (For Claude to create)

```typescript
// scripts/export-turso-data.ts
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from '../src/db/schema';
import fs from 'fs';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const db = drizzle(client);

async function exportData() {
  // Export each table to SQL INSERT statements
  const tables = [
    'churches',
    'counties', 
    'affiliations',
    'church_affiliations',
    'church_gatherings',
    'pages',
    'settings',
    'church_images',
    'church_suggestions',
    'comments'
  ];

  let sqlOutput = '';
  
  for (const table of tables) {
    const data = await db.select().from(schema[table]);
    // Convert to INSERT statements
    // Write to file
  }
  
  fs.writeFileSync('turso-export.sql', sqlOutput);
}

exportData().catch(console.error);
```

### Validation Script Template (For Claude to create)

```typescript
// scripts/validate-migration.ts
import { createDb } from '../src/db/index';

async function validateMigration(d1: D1Database) {
  const db = createDb(d1);
  
  // Count records in each table
  const counts = {};
  
  // Validate data integrity
  // Check foreign key relationships
  // Verify critical data fields
  
  console.log('Migration validation results:', counts);
}
```

## Future Database Migrations with D1

### New Migration Workflow

**1. Schema Changes:**
```bash
# Edit src/db/schema.ts
# Generate migration
bun run db:generate

# Apply to local D1
wrangler d1 execute utahchurches-dev --file=drizzle/[new-migration].sql

# Test locally
wrangler dev --local

# Apply to production
wrangler d1 execute utahchurches-production --file=drizzle/[new-migration].sql
```

**2. Migration Best Practices:**
- Always test migrations locally first
- Use D1's atomic operations for complex migrations
- Consider foreign key constraints with `PRAGMA defer_foreign_keys = true`
- Leverage D1's Time Travel for rollback capabilities
- Monitor migration performance (D1 has 30-second timeout)

**3. Handling Large Migrations:**
- Split large migrations into smaller files
- Use batch operations for large data changes
- Consider temporary tables for complex transformations

## D1 Specific Considerations

### Advantages Over Turso
- **Built-in Backups**: 30-day Time Travel point-in-time recovery
- **Global Distribution**: Read replicas in every region (beta)
- **Serverless**: No connection management needed
- **Cost**: Usage-based pricing with generous free tier
- **Integration**: Native Cloudflare Workers integration

### Limitations to Consider
- **10GB Database Limit**: Cannot be increased (current data is well under this)
- **6 Concurrent Connections**: Per Worker invocation
- **30-Second Timeout**: For batch operations
- **No Transactions**: Currently not supported (matches current usage)
- **Single Writer**: Only one active copy for consistency

### Performance Optimizations
- **Query Optimization**: Index critical query paths
- **Batch Operations**: Group multiple operations when possible
- **Read Replicas**: Utilize global read replication for performance
- **Caching**: Consider implementing application-level caching

## Rollback Plan

### Emergency Rollback (For You)
```bash
# Revert to previous deployment
wrangler rollback

# Or redeploy previous version
git checkout previous-working-commit
bun run deploy
```

### Data Rollback (For You)
```bash
# Use D1 Time Travel to restore to previous state
# Access through Cloudflare dashboard
# Select restore point (up to 30 days ago)
```

## Success Metrics

### Migration Success Criteria
- [ ] All tables migrated with correct row counts
- [ ] All application functionality working
- [ ] Authentication system functional
- [ ] Data exports generating correctly
- [ ] Map functionality operational
- [ ] Admin panel fully functional
- [ ] Performance equal or better than Turso
- [ ] No data loss or corruption

### Performance Benchmarks
- [ ] Page load times ≤ current performance
- [ ] API response times ≤ current performance
- [ ] Database query times monitored
- [ ] Error rates < 0.1%

## Timeline Estimate

**Total Migration Time: 4-6 hours**

- **Phase 1-2**: Setup and code changes (2 hours)
- **Phase 3-4**: Schema and data migration (1-2 hours)
- **Phase 5**: Testing and validation (1-2 hours)
- **Phase 6**: Deployment and monitoring (30 minutes)

## Support and Resources

### Documentation
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [D1 Migration Guide](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
- [Drizzle ORM D1 Integration](https://orm.drizzle.team/docs/get-started-d1)

### Monitoring
- Cloudflare Workers Analytics
- D1 Analytics Dashboard
- Application performance monitoring

### Emergency Contacts
- Cloudflare Support (if needed)
- Development team lead
- Database administrator

---

**Note**: This migration plan assumes the current application architecture and data size. Adjustments may be needed based on actual data volume and specific requirements discovered during the migration process.