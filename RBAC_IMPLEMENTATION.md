# Role-Based Access Control (RBAC) Implementation Guide

## Overview

This document outlines a comprehensive solution for implementing role-based access control in the Utah Churches application using Clerk authentication.

## Requirements

1. **Public Access**: Anyone can sign up/login via Clerk
2. **Contributor Role**: Regular users can only add comments or suggest churches
3. **Admin Role**: Only approved admins can access /admin routes and edit content
4. **Migration**: Existing admin users need to be migrated
5. **Management**: Admin list needs to be manageable

## Implementation Options

### Option 1: Clerk publicMetadata (Recommended)

**Description**: Store role information in Clerk's `publicMetadata` field, which is accessible from both frontend and backend.

**Pros**:
- Centralized user management in Clerk dashboard
- No database changes required
- Easy to scale with additional roles
- Works seamlessly with Clerk's SDK
- Metadata accessible in JWT without additional API calls

**Cons**:
- Requires Clerk API calls to update roles
- Role updates require webhook setup for real-time sync
- Limited to Clerk's metadata size limits (8KB)

### Option 2: Database Role Table

**Description**: Create a separate `user_roles` table in your database linked by Clerk user ID.

**Pros**:
- Full control over role structure
- Can store complex permission sets
- Easy to query and join with other data
- No external API calls for role checks

**Cons**:
- Requires database migrations
- Need to sync with Clerk user creation
- Additional complexity in middleware
- Potential sync issues between Clerk and database

### Option 3: Clerk Private Metadata + Backend API

**Description**: Use Clerk's `privateMetadata` for sensitive role data, only accessible server-side.

**Pros**:
- More secure than publicMetadata
- Hidden from client-side code
- Still centralized in Clerk

**Cons**:
- Requires server-side API call for every role check
- Higher latency than publicMetadata
- More complex client-side implementation

### Option 4: Hybrid Approach

**Description**: Use Clerk publicMetadata for basic roles, database for detailed permissions.

**Pros**:
- Fast role checks (publicMetadata)
- Detailed permissions when needed (database)
- Best of both worlds

**Cons**:
- Most complex to implement
- Two sources of truth
- Requires careful synchronization

## Recommended Implementation (Option 1)

We'll implement Option 1 using Clerk's publicMetadata for the following reasons:
- Simplest to implement and maintain
- No database changes required
- Clerk handles all the authentication complexity
- Easy to manage through Clerk dashboard or API

## Implementation Details

### 1. Role Structure

```typescript
type UserRole = 'admin' | 'contributor';

interface ClerkPublicMetadata {
  role: UserRole;
  // Additional metadata can be added here
  approvedAt?: string;
  approvedBy?: string;
}
```

### 2. Middleware Implementation

The middleware will check the user's role from Clerk's publicMetadata and enforce access control.

### 3. Admin Management

Admins can be managed through:
- Clerk Dashboard (manual)
- Custom admin interface using Clerk Backend API
- CLI tool for bulk operations

### 4. Migration Strategy

1. List all existing admin users from the database
2. Update their Clerk profiles with admin role
3. Optionally maintain database for audit trail

## Security Considerations

1. **Role Verification**: Always verify roles server-side
2. **Principle of Least Privilege**: Default to 'contributor' role
3. **Audit Trail**: Log all role changes
4. **Rate Limiting**: Implement rate limiting on sensitive endpoints
5. **CORS**: Ensure proper CORS configuration

## Next Steps

1. Update Clerk middleware to check publicMetadata
2. Create admin management interface
3. Migrate existing admin users
4. Update all admin routes to use new middleware
5. Add contributor-specific features (comments, suggestions)
6. Document the new authentication flow