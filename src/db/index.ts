import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { validateDatabaseEnvVars } from '../utils/env-validation';
import * as schema from './schema';

export function createDb(env: { TURSO_DATABASE_URL: string; TURSO_AUTH_TOKEN: string }) {
  // Validate required environment variables
  validateDatabaseEnvVars(env);

  const client = createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });

  return drizzle(client, { schema });
}

/**
 * Convenience function for creating database from Hono context
 */
export function createDbWithContext(honoContext: any) {
  return createDb(honoContext.env);
}
