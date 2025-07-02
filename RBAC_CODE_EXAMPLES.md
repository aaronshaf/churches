# RBAC Implementation Code Examples

## 1. Setting Up Routes with Role-Based Access

### Main Application Setup

```typescript
// src/index.tsx
import { Hono } from 'hono';
import { clerkMiddleware } from './middleware/clerk-rbac';
import { adminMiddleware } from './middleware/auth';
import { contributorApp } from './routes/contributor';
import { adminUsersApp } from './routes/admin-users';

const app = new Hono<{ Bindings: Bindings }>();

// Apply Clerk middleware to all routes
app.use('*', clerkMiddleware());

// Public routes (no auth required)
app.get('/', homeHandler);
app.get('/churches/:path', churchDetailHandler);
app.get('/map', mapHandler);

// Contributor routes (requires authentication)
app.route('/contributor', contributorApp);

// Admin routes (requires admin role)
app.all('/admin/*', adminMiddleware);
app.route('/admin/users', adminUsersApp);
```

## 2. Checking User Roles in Components

### Example: Conditional Rendering Based on Role

```typescript
// In your church detail page
import { getCurrentUser } from '../middleware/clerk-rbac';
import { ChurchComments } from '../components/ChurchComments';

app.get('/churches/:path', async (c) => {
  const user = await getCurrentUser(c);
  const church = await getChurchByPath(c.req.param('path'));
  
  return c.html(
    <Layout user={user}>
      <div>
        <h1>{church.name}</h1>
        
        {/* Show edit button only for admins */}
        {user?.role === 'admin' && (
          <a href={`/admin/churches/${church.id}/edit`}>
            Edit Church
          </a>
        )}
        
        {/* Show suggest edit for contributors */}
        {user?.role === 'contributor' && (
          <button>Suggest Edit</button>
        )}
        
        {/* Comments section - visible to all, postable by authenticated users */}
        <ChurchComments 
          churchId={church.id}
          churchPath={church.path}
          comments={comments}
          user={user}
        />
      </div>
    </Layout>
  );
});
```

## 3. Managing Admin Users

### Via Clerk Dashboard

1. Log into Clerk Dashboard
2. Navigate to Users
3. Click on a user
4. Edit their publicMetadata:
```json
{
  "role": "admin",
  "approvedAt": "2024-01-15T10:00:00Z",
  "approvedBy": "admin-user-id"
}
```

### Via Admin Interface

```typescript
// Update user role endpoint
app.post('/admin/users/:userId/role', adminMiddleware, async (c) => {
  const currentUser = c.get('user');
  const userId = c.req.param('userId');
  const { newRole } = await c.req.json();
  
  // Update role using Clerk API
  const success = await updateUserRole(c, userId, newRole, currentUser.id);
  
  if (success) {
    return c.json({ success: true });
  } else {
    return c.json({ success: false }, 500);
  }
});
```

### Via CLI Script

```bash
# Run the migration script
pnpm tsx scripts/migrate-admins-to-clerk.ts
```

## 4. Implementing Contributor Features

### Church Suggestion Form

```typescript
// Contributor can suggest new churches
app.post('/contributor/suggest', requireContributor, async (c) => {
  const user = c.get('user');
  const formData = await c.req.formData();
  
  const suggestion = {
    userId: user.id,
    churchName: formData.get('churchName'),
    address: formData.get('address'),
    // ... other fields
    status: 'pending', // Requires admin approval
  };
  
  await db.insert(churchSuggestions).values(suggestion);
  return c.redirect('/contributor/dashboard?success=true');
});
```

### Comment System

```typescript
// Add comment to church
app.post('/churches/:id/comment', requireAuth, async (c) => {
  const user = c.get('user');
  const churchId = c.req.param('id');
  const { content, isPublic } = await c.req.json();
  
  const comment = {
    userId: user.id,
    churchId,
    content,
    isPublic,
    status: user.role === 'admin' ? 'approved' : 'pending',
  };
  
  await db.insert(comments).values(comment);
  return c.json({ success: true });
});
```

## 5. Security Best Practices

### Middleware Pattern

```typescript
// Always verify roles server-side
export const requireAdmin = async (c: Context, next: Next) => {
  const auth = getAuth(c);
  
  if (!auth?.userId) {
    return c.redirect('/login');
  }
  
  const user = await getUserWithRole(c, auth.userId);
  
  if (user?.role !== 'admin') {
    return c.html(
      <ForbiddenPage />,
      403
    );
  }
  
  c.set('user', user);
  await next();
};
```

### Rate Limiting

```typescript
import { rateLimiter } from 'hono-rate-limiter';

// Apply rate limiting to sensitive endpoints
app.use('/api/*', rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // limit each IP to 100 requests per windowMs
}));

// Stricter limits for admin endpoints
app.use('/admin/*', rateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 50,
}));
```

### Input Validation

```typescript
import { z } from 'zod';

const churchSuggestionSchema = z.object({
  churchName: z.string().min(1).max(200),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.literal('UT'),
  zip: z.string().regex(/^\d{5}$/).optional(),
  website: z.string().url().optional(),
  phone: z.string().regex(/^\d{3}-\d{3}-\d{4}$/).optional(),
  email: z.string().email().optional(),
  notes: z.string().max(1000).optional(),
});

// Validate input
app.post('/contributor/suggest', requireContributor, async (c) => {
  const formData = await c.req.formData();
  
  try {
    const validated = churchSuggestionSchema.parse({
      churchName: formData.get('churchName'),
      // ... other fields
    });
    
    // Process validated data
  } catch (error) {
    return c.json({ error: 'Invalid input' }, 400);
  }
});
```

## 6. Migration Path

### Step 1: Deploy RBAC Middleware
```typescript
// Keep both auth systems during migration
if (isClerkEnabled(c.env)) {
  // Use Clerk RBAC
  return clerkRequireAdmin(c, next);
} else {
  // Use legacy auth
  return legacyAdminAuth(c, next);
}
```

### Step 2: Migrate Existing Admins
```bash
# Set up environment
export CLERK_SECRET_KEY=your_key
export TURSO_DATABASE_URL=your_url
export TURSO_AUTH_TOKEN=your_token

# Run migration
pnpm tsx scripts/migrate-admins-to-clerk.ts
```

### Step 3: Enable Clerk
```bash
# Set in production
wrangler secret put ENABLE_CLERK
# Enter: true
```

### Step 4: Monitor and Clean Up
- Monitor for any auth issues
- Remove legacy auth code after successful migration
- Update documentation

## 7. Testing RBAC

### Unit Tests

```typescript
import { describe, it, expect } from 'vitest';
import { requireAdmin } from './middleware/clerk-rbac';

describe('RBAC Middleware', () => {
  it('should allow admin users', async () => {
    const mockContext = createMockContext({
      user: { id: '123', role: 'admin' }
    });
    
    await requireAdmin(mockContext, async () => {
      // Should reach here
      expect(true).toBe(true);
    });
  });
  
  it('should block non-admin users', async () => {
    const mockContext = createMockContext({
      user: { id: '123', role: 'contributor' }
    });
    
    const response = await requireAdmin(mockContext, async () => {
      // Should not reach here
    });
    
    expect(response.status).toBe(403);
  });
});
```

### Integration Tests

```typescript
describe('Church Suggestions', () => {
  it('contributors can suggest churches', async () => {
    const response = await app.request('/contributor/suggest', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer contributor-token'
      },
      body: new FormData({
        churchName: 'Test Church',
        city: 'Salt Lake City'
      })
    });
    
    expect(response.status).toBe(302); // Redirect on success
  });
  
  it('non-contributors cannot suggest churches', async () => {
    const response = await app.request('/contributor/suggest', {
      method: 'POST',
      // No auth header
      body: new FormData({
        churchName: 'Test Church'
      })
    });
    
    expect(response.status).toBe(302); // Redirect to login
  });
});
```

## Common Issues and Solutions

### Issue: Role not updating immediately
**Solution**: Clerk caches user data. Force refresh:
```typescript
await clerk.users.getUser(userId, { 
  skipCache: true 
});
```

### Issue: Legacy users can't log in
**Solution**: Provide migration path:
```typescript
// Check if user exists in Clerk
const clerkUsers = await clerk.users.getUserList({
  emailAddress: [email]
});

if (clerkUsers.length === 0) {
  // Create Clerk user from legacy data
  await clerk.users.createUser({
    emailAddress: [email],
    publicMetadata: { role: legacyUser.userType }
  });
}
```

### Issue: Performance with many role checks
**Solution**: Cache role data in JWT:
```typescript
// In Clerk dashboard, add to session claims:
{
  "role": "{{user.public_metadata.role}}"
}

// Access directly from auth object
const auth = getAuth(c);
const role = auth.sessionClaims?.role;
```