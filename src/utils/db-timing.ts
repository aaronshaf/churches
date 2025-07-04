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
  try {
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
          const tableName = fromArgs[0]?.name || fromArgs[0]?.['_']?.['name'] || 'unknown';
          
          // Create a proxy to handle all chained methods
          return new Proxy(fromQuery, {
            get(target, prop) {
              const originalMethod = Reflect.get(target, prop);
              
              // For terminal methods (all, get), wrap with timing
              if (prop === 'all') {
                return () => timedDbCall(
                  () => originalMethod.apply(target),
                  `SELECT FROM ${tableName}`
                );
              }
              
              if (prop === 'get') {
                return () => timedDbCall(
                  () => originalMethod.apply(target),
                  `SELECT FROM ${tableName} (single)`
                );
              }
              
              // For chaining methods (where, orderBy, etc.), return a proxy
              if (typeof originalMethod === 'function') {
                return (...args: any[]) => {
                  const result = originalMethod.apply(target, args);
                  // Continue proxying the chain
                  return new Proxy(result, this);
                };
              }
              
              return originalMethod;
            }
          });
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
              `INSERT INTO ${args[0]?.name || args[0]?.['_']?.['name'] || 'unknown'}`
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
              `UPDATE ${args[0]?.name || args[0]?.['_']?.['name'] || 'unknown'}`
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
          `DELETE FROM ${args[0]?.name || args[0]?.['_']?.['name'] || 'unknown'}`
        )
      };
    }
  };
  } catch (error) {
    console.error('Error creating timed database:', error);
    // Return original db if wrapping fails
    return db;
  }
}