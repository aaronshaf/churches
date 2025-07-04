import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';
import { validateDatabaseEnvVars } from '../utils/env-validation';
import { createTimedDb } from '../utils/db-timing';
import { createAnalyticsTrackedDb } from '../utils/analytics-engine';

export function createDb(env: { TURSO_DATABASE_URL: string; TURSO_AUTH_TOKEN: string; utahchurches_analytics?: AnalyticsEngineDataset }, enableTiming = true, context?: { route?: string; url?: string }) {
  // Validate required environment variables
  validateDatabaseEnvVars(env);
  
  const client = createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });

  const db = drizzle(client, { schema });
  
  // Use Analytics Engine tracking if available, WITH in-memory timing for current session
  if (enableTiming) {
    if (env.utahchurches_analytics) {
      console.log('🚀 Using Analytics Engine + in-memory tracked database');
      // First wrap with timing (for current session stats)
      const timedDb = createTimedDb(db);
      // Then wrap with Analytics Engine (for long-term storage)
      return createAnalyticsTrackedDb(timedDb, env.utahchurches_analytics, context);
    } else {
      console.log('⏱️ Using timed database only (no Analytics Engine)');
      return createTimedDb(db);
    }
  }
  
  console.log('⚠️ Database timing disabled');
  return db;
}

/**
 * Convenience function for creating database with automatic route extraction from Hono context
 */
export function createDbWithContext(honoContext: any, enableTiming = true) {
  const env = honoContext.env;
  const url = honoContext.req?.url;
  return createDb(env, enableTiming, { url });
}
