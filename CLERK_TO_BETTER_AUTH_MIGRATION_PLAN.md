# Comprehensive Migration Plan: Clerk to Better-Auth

## Executive Summary

This document outlines a detailed plan for migrating the Utah Churches application from Clerk to Better-Auth. The migration will maintain all existing functionality while providing better control, reduced costs, and improved performance.

## Current State Analysis

### Clerk Implementation Overview
- **Authentication Provider**: Clerk (third-party SaaS)
- **Package**: `@hono/clerk-auth` (v3.0.1)
- **Framework**: Hono on Cloudflare Workers
- **Database**: Turso (SQLite at the edge)
- **ORM**: Drizzle ORM

### Current Features
1. **Authentication Methods**:
   - Email/password login
   - OAuth providers (configured in Clerk dashboard)
   - JWT-based session management

2. **Authorization**:
   - Three roles: `admin`, `contributor`, `user`
   - Role-based middleware (requireAdmin, requireContributor)
   - Roles stored in Clerk's publicMetadata

3. **User Management**:
   - Admin UI for role assignment
   - Bulk user updates
   - Audit trail for role changes

## Better-Auth Architecture

### Key Advantages
1. **Self-hosted**: Full control over auth data
2. **Database-driven**: Users stored in your Turso database
3. **Type-safe**: Full TypeScript support with inferred types
4. **Edge-compatible**: Works with Cloudflare Workers
5. **Cost-effective**: No per-user pricing

### Technical Stack
- **Package**: `better-auth` + `better-auth-cloudflare` (for CF Workers support)
- **Database Adapter**: `drizzle-adapter` for Better-Auth
- **Session Storage**: Database sessions (no external dependencies)

## Migration Strategy

### Phase 1: Setup and Preparation (Week 1)

#### 1.1 Install Dependencies
```bash
pnpm add better-auth better-auth-cloudflare
pnpm add -D @better-auth/cli
```

#### 1.2 Create Auth Schema
```typescript
// src/db/auth-schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).default(false),
  name: text('name'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  // Custom fields
  role: text('role', { enum: ['admin', 'contributor', 'user'] }).default('user').notNull(),
  clerkId: text('clerk_id').unique(), // For migration tracking
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => users.id),
});

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => users.id),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const verificationTokens = sqliteTable('verification_tokens', {
  id: text('id').primaryKey(),
  token: text('token').notNull(),
  identifier: text('identifier').notNull(), // email
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
```

#### 1.3 Create Auth Configuration
```typescript
// src/lib/auth.ts
import { betterAuth } from "better-auth";
import { withCloudflare } from "better-auth-cloudflare";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../db/auth-schema";

export function createAuth(env: any, cf?: any) {
  const db = drizzle(createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  }), { schema });

  return betterAuth({
    ...withCloudflare({
      autoDetectIpAddress: true,
      geolocationTracking: true,
      cf: cf || {},
    }),
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema,
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL || "http://localhost:8787",
    
    // Email/Password configuration
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false, // Start without verification
    },
    
    // Session configuration
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // Update session if older than 1 day
      cookieName: "utah-churches-session",
    },
    
    // User configuration with custom fields
    user: {
      additionalFields: {
        role: {
          type: "string",
          defaultValue: "user",
          required: true,
        },
        clerkId: {
          type: "string",
          required: false,
        },
      },
    },
    
    // OAuth providers (configure as needed)
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },
  });
}
```

### Phase 2: Parallel Implementation (Week 2-3)

#### 2.1 Create New Middleware
```typescript
// src/middleware/better-auth.ts
import { createAuth } from "../lib/auth";
import type { Context, MiddlewareHandler } from "hono";

export const betterAuthMiddleware: MiddlewareHandler = async (c, next) => {
  const auth = createAuth(c.env, c.req.raw.cf);
  c.set("auth", auth);
  await next();
};

export const requireAuthBetter: MiddlewareHandler = async (c, next) => {
  const auth = c.get("auth");
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  
  if (!session?.user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  c.set("user", session.user);
  c.set("session", session.session);
  await next();
};

export const requireAdminBetter: MiddlewareHandler = async (c, next) => {
  await requireAuthBetter(c, next);
  const user = c.get("user");
  
  if (user?.role !== "admin") {
    return c.json({ error: "Forbidden" }, 403);
  }
  
  await next();
};
```

#### 2.2 Create Migration Script
```typescript
// scripts/migrate-users-from-clerk.ts
import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../src/db/auth-schema";
import { nanoid } from "nanoid";

config({ path: ".dev.vars" });

async function migrateUsers() {
  // 1. Fetch all users from Clerk
  const clerkUsers = await fetchAllClerkUsers();
  
  // 2. Connect to database
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });
  const db = drizzle(client, { schema });
  
  // 3. Migrate each user
  for (const clerkUser of clerkUsers) {
    const role = clerkUser.publicMetadata?.role || "user";
    
    await db.insert(schema.users).values({
      id: nanoid(),
      email: clerkUser.emailAddresses[0].emailAddress,
      emailVerified: true,
      name: `${clerkUser.firstName} ${clerkUser.lastName}`.trim() || null,
      role,
      clerkId: clerkUser.id,
      createdAt: new Date(clerkUser.createdAt),
      updatedAt: new Date(clerkUser.updatedAt),
    }).onConflictDoNothing();
  }
  
  console.log(`Migrated ${clerkUsers.length} users`);
}

async function fetchAllClerkUsers() {
  const users = [];
  let offset = 0;
  const limit = 100;
  
  while (true) {
    const response = await fetch(
      `https://api.clerk.com/v1/users?limit=${limit}&offset=${offset}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        },
      }
    );
    
    const data = await response.json();
    users.push(...data);
    
    if (data.length < limit) break;
    offset += limit;
  }
  
  return users;
}
```

### Phase 3: Feature Parity Implementation (Week 3-4)

#### 3.1 Update Authentication Components
```tsx
// src/components/BetterAuthLogin.tsx
export const BetterAuthLogin: FC<{ auth: any }> = ({ auth }) => {
  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    
    const { data, error } = await auth.signIn.email({
      email: formData.get("email"),
      password: formData.get("password"),
    });
    
    if (error) {
      console.error("Login error:", error);
      return;
    }
    
    // Redirect based on role
    if (data.user.role === "admin") {
      window.location.href = "/admin";
    } else {
      window.location.href = "/";
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  );
};
```

#### 3.2 Client-Side Auth Hook
```typescript
// src/lib/auth-client.ts
import { createAuthClient } from "better-auth/client";

export const authClient = createAuthClient({
  baseURL: window.location.origin,
});

// Use in components
const { data: session } = await authClient.useSession();
```

### Phase 4: Testing and Rollout (Week 4-5)

#### 4.1 Feature Flag Implementation
```typescript
// src/index.tsx
const USE_BETTER_AUTH = c.env.USE_BETTER_AUTH === "true";

// Conditional middleware
app.use("*", USE_BETTER_AUTH ? betterAuthMiddleware : clerkMiddleware());
```

#### 4.2 Testing Checklist
- [ ] User registration with email/password
- [ ] User login/logout
- [ ] Session persistence
- [ ] Role-based access control
- [ ] Admin user management
- [ ] OAuth login (if applicable)
- [ ] Password reset flow
- [ ] Session expiry and refresh

### Phase 5: Migration Completion (Week 6)

#### 5.1 Data Verification
```typescript
// scripts/verify-migration.ts
// Compare user counts and roles between Clerk and Better-Auth
```

#### 5.2 Cleanup Tasks
1. Remove Clerk dependencies
2. Remove Clerk environment variables
3. Update documentation
4. Remove migration scripts
5. Remove `clerkId` field from users table

## Risk Mitigation

### 1. Rollback Strategy
- Keep Clerk active during migration
- Use feature flags for gradual rollout
- Maintain user mapping via `clerkId` field

### 2. Data Integrity
- Run migration in test environment first
- Verify all users migrated correctly
- Test all auth flows before switching

### 3. Session Continuity
- Implement grace period where both auth systems work
- Prompt users to re-login after migration

## Cost Analysis

### Current (Clerk)
- $25/month base + $0.02 per MAU
- Estimated: $50-100/month for growth

### Future (Better-Auth)
- $0/month (self-hosted)
- Only infrastructure costs (already paying for database)

## Timeline Summary

- **Week 1**: Setup and preparation
- **Week 2-3**: Parallel implementation
- **Week 3-4**: Feature parity
- **Week 4-5**: Testing and gradual rollout
- **Week 6**: Complete migration and cleanup

## Success Criteria

1. All users successfully migrated
2. No authentication downtime
3. All features working as before
4. Improved performance (no external API calls)
5. Reduced monthly costs
6. Full control over auth data

## Additional Considerations

### Edge Cases
1. Users with OAuth-only accounts
2. Users with unverified emails
3. Active sessions during migration
4. Password reset tokens in flight

### Performance Improvements
1. Local auth reduces latency
2. No external API calls for user data
3. Database queries optimized for edge

### Future Enhancements
1. Two-factor authentication
2. Passkey support
3. Custom OAuth providers
4. Advanced session management