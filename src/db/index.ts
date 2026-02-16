import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import type { Context } from 'hono';
import type { Bindings } from '../types';
import * as schema from './schema';

// Global client instance to reuse connections
let dbClient: ReturnType<typeof createClient> | null = null;

export function createDb(env: Bindings) {
  // Reuse existing client if available
  if (!dbClient) {
    dbClient = createClient({
      url: env.TURSO_DATABASE_URL,
      authToken: env.TURSO_AUTH_TOKEN,
    });
  }

  return drizzle(dbClient, { schema });
}

export type DbType = ReturnType<typeof createDb>;

/**
 * Convenience function for creating database from Hono context
 */
export function createDbWithContext(
  honoContext: Context<{ Bindings: Bindings }> | { env: Bindings }
) {
  return createDb(honoContext.env);
}
