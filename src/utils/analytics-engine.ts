/**
 * Cloudflare Analytics Engine integration for database performance tracking
 */

interface DbMetric {
  operation: string;
  duration: number;
  route?: string;
  success: boolean;
  table?: string;
}

/**
 * Send database performance metrics to Cloudflare Analytics Engine
 */
export async function trackDbMetrics(
  analytics: AnalyticsEngineDataset | undefined,
  metrics: DbMetric[]
) {
  if (!analytics) {
    // Fallback to console logging if Analytics Engine not configured
    metrics.forEach(metric => {
      console.log(`🕐 DB: ${metric.operation} ${metric.table ? `(${metric.table})` : ''} - ${metric.duration.toFixed(2)}ms - ${metric.success ? 'SUCCESS' : 'FAILED'}`);
    });
    return;
  }

  try {
    // Send metrics to Analytics Engine
    metrics.forEach(metric => {
      analytics.writeDataPoint({
        blobs: [
          metric.operation,              // blob1: operation type (SELECT, INSERT, etc.)
          metric.table || 'unknown',     // blob2: table name
          metric.route || 'unknown',     // blob3: route
          metric.success ? 'success' : 'error' // blob4: status
        ],
        doubles: [
          metric.duration,               // double1: duration in milliseconds
        ],
        indexes: [
          metric.operation,              // Index for efficient querying by operation
          metric.table || 'unknown'      // Index for querying by table
        ]
      });
    });
  } catch (error) {
    console.error('Failed to write analytics:', error);
  }
}

/**
 * Track a database operation with automatic metrics collection
 */
export async function trackDbOperation<T>(
  analytics: AnalyticsEngineDataset | undefined,
  operation: () => Promise<T>,
  operationName: string,
  table?: string,
  route?: string
): Promise<T> {
  const start = performance.now();
  
  try {
    const result = await operation();
    const duration = performance.now() - start;
    
    // Track successful operation
    await trackDbMetrics(analytics, [{
      operation: operationName,
      duration,
      route,
      table,
      success: true
    }]);
    
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    
    // Track failed operation
    await trackDbMetrics(analytics, [{
      operation: operationName,
      duration,
      route,
      table,
      success: false
    }]);
    
    throw error;
  }
}

/**
 * Helper function to extract route from URL
 */
function extractRouteFromUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const urlObj = new URL(url);
    return urlObj.pathname;
  } catch {
    return undefined;
  }
}

/**
 * Create a tracked database instance that automatically measures all operations
 */
export function createAnalyticsTrackedDb(db: any, analytics: AnalyticsEngineDataset | undefined, context?: { route?: string; url?: string }) {
  // Extract route from URL if not provided
  const route = context?.route || extractRouteFromUrl(context?.url) || 'unknown';
  return new Proxy(db, {
    get(target, prop, receiver) {
      const originalMethod = Reflect.get(target, prop, receiver);
      
      // Track select operations
      if (prop === 'select') {
        return (...args: any[]) => {
          const query = originalMethod.apply(target, args);
          return new Proxy(query, {
            get(queryTarget, queryProp) {
              const queryMethod = Reflect.get(queryTarget, queryProp);
              
              if (queryProp === 'from') {
                return (...fromArgs: any[]) => {
                  const fromQuery = queryMethod.apply(queryTarget, fromArgs);
                  const tableName = fromArgs[0]?.['_']?.['name'] || 'unknown';
                  
                  return new Proxy(fromQuery, {
                    get(fromTarget, fromProp) {
                      const fromMethod = Reflect.get(fromTarget, fromProp);
                      
                      if (fromProp === 'all' || fromProp === 'get') {
                        return () => trackDbOperation(
                          analytics,
                          () => fromMethod.apply(fromTarget),
                          `SELECT`,
                          tableName,
                          route
                        );
                      }
                      
                      return fromMethod;
                    }
                  });
                };
              }
              
              return queryMethod;
            }
          });
        };
      }
      
      // Track insert operations
      if (prop === 'insert') {
        return (...args: any[]) => {
          const query = originalMethod.apply(target, args);
          const tableName = args[0]?.['_']?.['name'] || 'unknown';
          
          return new Proxy(query, {
            get(queryTarget, queryProp) {
              const queryMethod = Reflect.get(queryTarget, queryProp);
              
              if (queryProp === 'values') {
                return (...valuesArgs: any[]) => {
                  const valuesQuery = queryMethod.apply(queryTarget, valuesArgs);
                  
                  return new Proxy(valuesQuery, {
                    get(valuesTarget, valuesProp) {
                      const valuesMethod = Reflect.get(valuesTarget, valuesProp);
                      
                      if (valuesProp === 'run' || valuesProp === 'returning') {
                        return () => trackDbOperation(
                          analytics,
                          () => valuesMethod.apply(valuesTarget),
                          'INSERT',
                          tableName,
                          route
                        );
                      }
                      
                      return valuesMethod;
                    }
                  });
                };
              }
              
              return queryMethod;
            }
          });
        };
      }
      
      // Track update operations
      if (prop === 'update') {
        return (...args: any[]) => {
          const query = originalMethod.apply(target, args);
          const tableName = args[0]?.['_']?.['name'] || 'unknown';
          
          return new Proxy(query, {
            get(queryTarget, queryProp) {
              const queryMethod = Reflect.get(queryTarget, queryProp);
              
              if (queryProp === 'set') {
                return (...setArgs: any[]) => {
                  const setQuery = queryMethod.apply(queryTarget, setArgs);
                  
                  return new Proxy(setQuery, {
                    get(setTarget, setProp) {
                      const setMethod = Reflect.get(setTarget, setProp);
                      
                      if (setProp === 'run') {
                        return () => trackDbOperation(
                          analytics,
                          () => setMethod.apply(setTarget),
                          'UPDATE',
                          tableName,
                          route
                        );
                      }
                      
                      return setMethod;
                    }
                  });
                };
              }
              
              return queryMethod;
            }
          });
        };
      }
      
      // Track delete operations
      if (prop === 'delete') {
        return (...args: any[]) => {
          const query = originalMethod.apply(target, args);
          const tableName = args[0]?.['_']?.['name'] || 'unknown';
          
          return new Proxy(query, {
            get(queryTarget, queryProp) {
              const queryMethod = Reflect.get(queryTarget, queryProp);
              
              if (queryProp === 'run') {
                return () => trackDbOperation(
                  analytics,
                  () => queryMethod.apply(queryTarget),
                  'DELETE',
                  tableName,
                  route
                );
              }
              
              return queryMethod;
            }
          });
        };
      }
      
      return originalMethod;
    }
  });
}