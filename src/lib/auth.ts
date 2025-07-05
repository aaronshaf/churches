import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/auth-schema';
import { validateAuthEnvVars } from '../utils/env-validation';

export function createAuth(env: any) {
  // Validate required environment variables
  validateAuthEnvVars(env);

  const db = drizzle(env.DB, { schema });

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema,
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL || 'http://localhost:8787',

    // Session configuration
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // Update session if older than 1 day
      cookieName: 'session',
    },

    // User configuration with custom fields
    user: {
      additionalFields: {
        role: {
          type: 'string',
          defaultValue: 'user',
          required: true,
        },
      },
    },

    // OAuth providers - Google only for now
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID || '',
        clientSecret: env.GOOGLE_CLIENT_SECRET || '',
      },
    },
  });
}
