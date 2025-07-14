import type { D1Database } from '@cloudflare/workers-types';
import { drizzle } from 'drizzle-orm/d1';
import type { Context } from 'hono';
import type { Bindings } from '../types';
import * as schema from './schema';

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type DbType = ReturnType<typeof createDb>;

/**
 * Convenience function for creating database from Hono context
 */
export function createDbWithContext(honoContext: { env: Bindings }) {
  return createDb(honoContext.env.DB);
}
