import type { LibSQLDatabase } from 'drizzle-orm/libsql';

/**
 * Database timing utilities for measuring Turso performance
 */

export interface DbTimingStats {
  query: string;
  duration: number;
  timestamp: Date;
  route?: string;
  error?: string;
}

// In-memory storage for timing stats (consider Redis for production)
const timingStats: DbTimingStats[] = [];

/**
 * Wrapper for database operations that measures execution time
 */
export async function timedDbCall<T>(
  operation: () => Promise<T>,
  queryDescription: string,
  route?: string
): Promise<T> {
  const start = performance.now();
  
  try {
    const result = await operation();
    const duration = performance.now() - start;
    
    // Log the timing
    const stat: DbTimingStats = {
      query: queryDescription,
      duration,
      timestamp: new Date(),
      route
    };
    
    timingStats.push(stat);
    
    // Always log to console for debugging
    console.log(`🕐 DB: ${queryDescription} - ${duration.toFixed(2)}ms`);
    
    // Keep only last 1000 entries to prevent memory bloat
    if (timingStats.length > 1000) {
      timingStats.splice(0, timingStats.length - 1000);
    }
    
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    
    const stat: DbTimingStats = {
      query: queryDescription,
      duration,
      timestamp: new Date(),
      route,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    
    timingStats.push(stat);
    
    console.error(`❌ DB Error: ${queryDescription} - ${duration.toFixed(2)}ms - ${stat.error}`);
    
    throw error;
  }
}

/**
 * Get timing statistics
 */
export function getTimingStats(): DbTimingStats[] {
  return [...timingStats];
}

/**
 * Get timing summary
 */
export function getTimingSummary() {
  if (timingStats.length === 0) {
    return { count: 0, avgDuration: 0, minDuration: 0, maxDuration: 0, errorCount: 0 };
  }
  
  const successfulCalls = timingStats.filter(stat => !stat.error);
  const durations = successfulCalls.map(stat => stat.duration);
  
  return {
    count: timingStats.length,
    successCount: successfulCalls.length,
    errorCount: timingStats.filter(stat => stat.error).length,
    avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
    minDuration: Math.min(...durations),
    maxDuration: Math.max(...durations),
    p95Duration: durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)] || 0
  };
}

/**
 * Clear timing statistics
 */
export function clearTimingStats() {
  timingStats.length = 0;
}

/**
 * Enhanced database wrapper with automatic timing
 */
export function createTimedDb(db: LibSQLDatabase<any>) {
  return {
    ...db,
    
    // Override select operations
    select: (...args: any[]) => {
      const query = db.select(...args);
      return {
        ...query,
        
        // Wrap common query methods
        from: (...fromArgs: any[]) => {
          const fromQuery = query.from(...fromArgs);
          return {
            ...fromQuery,
            
            all: () => timedDbCall(
              () => fromQuery.all(),
              `SELECT FROM ${fromArgs[0]?.['_']['name'] || 'unknown'}`
            ),
            
            get: () => timedDbCall(
              () => fromQuery.get(),
              `SELECT FROM ${fromArgs[0]?.['_']['name'] || 'unknown'} (single)`
            )
          };
        }
      };
    },
    
    // Override insert operations
    insert: (...args: any[]) => {
      const query = db.insert(...args);
      return {
        ...query,
        
        values: (...valuesArgs: any[]) => {
          const valuesQuery = query.values(...valuesArgs);
          return {
            ...valuesQuery,
            
            run: () => timedDbCall(
              () => valuesQuery.run(),
              `INSERT INTO ${args[0]?.['_']['name'] || 'unknown'}`
            )
          };
        }
      };
    },
    
    // Override update operations
    update: (...args: any[]) => {
      const query = db.update(...args);
      return {
        ...query,
        
        set: (...setArgs: any[]) => {
          const setQuery = query.set(...setArgs);
          return {
            ...setQuery,
            
            run: () => timedDbCall(
              () => setQuery.run(),
              `UPDATE ${args[0]?.['_']['name'] || 'unknown'}`
            )
          };
        }
      };
    },
    
    // Override delete operations
    delete: (...args: any[]) => {
      const query = db.delete(...args);
      return {
        ...query,
        
        run: () => timedDbCall(
          () => query.run(),
          `DELETE FROM ${args[0]?.['_']['name'] || 'unknown'}`
        )
      };
    }
  };
}