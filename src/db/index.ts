import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

/**
 * Convenience function for creating database from Hono context
 */
export function createDbWithContext(honoContext: any) {
  return createDb(honoContext.env.DB);
}
