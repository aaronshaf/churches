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
  
  // Use Analytics Engine tracking if available, otherwise fall back to console timing
  if (enableTiming) {
    if (env.utahchurches_analytics) {
      console.log('🚀 Using Analytics Engine tracked database');
      return createAnalyticsTrackedDb(db, env.utahchurches_analytics, context);
    } else {
      console.log('⏱️ Using timed database (no Analytics Engine)');
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
