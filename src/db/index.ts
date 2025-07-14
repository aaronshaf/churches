import type { D1Database, D1DatabaseSession } from '@cloudflare/workers-types';
import { drizzle } from 'drizzle-orm/d1';
import type { Context } from 'hono';
import type { D1SessionVariables } from '../middleware/d1-session';
import type { Bindings } from '../types';
import * as schema from './schema';

export function createDb(d1: D1Database | D1DatabaseSession) {
  // D1DatabaseSession is compatible with D1Database for Drizzle
  return drizzle(d1 as D1Database, { schema });
}

export type DbType = ReturnType<typeof createDb>;

/**
 * Convenience function for creating database from Hono context
 * Prefers D1 session if available for read replication benefits
 */
export function createDbWithContext(
  honoContext: Context<{ Bindings: Bindings; Variables?: D1SessionVariables }> | { env: Bindings }
) {
  // If it's a full Hono context with potential session
  if ('get' in honoContext && typeof honoContext.get === 'function') {
    try {
      const dbSession = (honoContext as Context<{ Bindings: Bindings; Variables: D1SessionVariables }>).get(
        'dbSession'
      );
      if (dbSession) {
        return createDb(dbSession);
      }
    } catch {
      // Fall through to regular DB
    }
  }

  // Fallback to regular DB
  return createDb(honoContext.env.DB);
}
