# Clerk Authentication Migration Guide

This guide documents the process of migrating from the custom authentication system to Clerk.

## Prerequisites

1. Create a Clerk account at https://dashboard.clerk.com
2. Create a new application in Clerk
3. Obtain your API keys from the Clerk dashboard

## Environment Variables

Add these to your `.dev.vars` file:

```
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
USE_CLERK_AUTH=false  # Set to true when ready to switch
```

## Migration Steps

### Step 1: Export Existing Users

Run the export script to prepare users for Clerk import:

```bash
pnpm db:export-users-for-clerk
```

This will create two files:
- `clerk-user-import.json` - Users formatted for Clerk import
- `user-id-mapping.json` - Mapping of original IDs to preserve relationships

### Step 2: Import Users to Clerk

1. Go to Clerk Dashboard > Users > Import
2. Upload the `clerk-user-import.json` file
3. Configure import settings:
   - Enable "Send password reset email" for all users
   - Map fields appropriately

### Step 3: Update User Metadata

After import, you'll need to update each user's public metadata to include:
- `userType`: 'admin' or 'contributor'
- `originalId`: The original database ID

This can be done via Clerk's API or dashboard.

### Step 4: Enable Clerk Authentication

1. Set `USE_CLERK_AUTH=true` in your `.dev.vars`
2. Deploy the application
3. Test authentication flow

### Step 5: Update Database References

Once Clerk is working, update database references:
1. Add `clerkUserId` column to relevant tables
2. Update foreign key references
3. Remove old authentication tables (users, sessions)

## Feature Flag

The application uses a feature flag to switch between auth systems:

```typescript
// src/config/features.ts
export const features = {
  useClerkAuth: process.env.USE_CLERK_AUTH === 'true' || false,
};
```

## Testing Checklist

- [ ] User can sign in via Clerk
- [ ] Admin role is properly enforced
- [ ] Contributor role has correct permissions
- [ ] Session persistence works
- [ ] Logout functionality works
- [ ] Protected routes redirect properly
- [ ] User data displays correctly

## Rollback Plan

If issues arise:
1. Set `USE_CLERK_AUTH=false`
2. Redeploy
3. Users can continue using old auth system

## Benefits of Clerk

- Managed authentication service
- Built-in security features
- Multi-factor authentication
- Social login providers
- Magic links
- Detailed audit logs
- GDPR compliance
- SOC 2 compliance