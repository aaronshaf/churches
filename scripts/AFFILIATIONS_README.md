# Seeding Affiliations

To seed the affiliations into your database:

1. Make sure you have your Turso database credentials set as environment variables:
   ```bash
   export TURSO_DATABASE_URL="your-database-url"
   export TURSO_AUTH_TOKEN="your-auth-token"
   ```

2. Run the seeding script:
   ```bash
   pnpm db:seed-affiliations
   ```

3. The script will:
   - Check if each affiliation already exists
   - Update existing affiliations with new website URLs
   - Add new affiliations that don't exist yet

## Alternative: Using SQL directly

You can also use the `seed-affiliations.sql` file directly with your database client:

```bash
turso db shell [your-database-name] < scripts/seed-affiliations.sql
```

## Cleanup

After running the script, you can delete:
- `scripts/seed-affiliations.sql`
- `scripts/seed-affiliations.ts`
- This README file