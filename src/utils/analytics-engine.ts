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
  // Always log to console for debugging
  metrics.forEach(metric => {
    console.log(`📊 Analytics: ${metric.operation} ${metric.table ? `(${metric.table})` : ''} - ${metric.duration.toFixed(2)}ms - Route: ${metric.route || 'unknown'} - ${metric.success ? 'SUCCESS' : 'FAILED'}`);
  });

  if (!analytics) {
    console.log('⚠️ Analytics Engine not configured - data only logged to console');
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
 * Query Analytics Engine for database performance metrics
 */
export async function queryDbMetrics(
  analytics: AnalyticsEngineDataset | undefined,
  options: {
    since?: Date;
    until?: Date;
    limit?: number;
    operation?: string;
    route?: string;
  } = {}
) {
  if (!analytics) {
    return { data: [], success: false, error: 'Analytics Engine not configured' };
  }

  try {
    const {
      since = new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      until = new Date(),
      limit = 1000,
      operation,
      route
    } = options;

    // Build the SQL query
    let query = `
      SELECT 
        blob1 as operation,
        blob2 as table_name,
        blob3 as route,
        blob4 as status,
        double1 as duration,
        timestamp
      FROM utahchurches_events
      WHERE timestamp >= ? AND timestamp <= ?
    `;
    
    const params = [since.toISOString(), until.toISOString()];
    
    if (operation) {
      query += ` AND blob1 = ?`;
      params.push(operation);
    }
    
    if (route) {
      query += ` AND blob3 = ?`;
      params.push(route);
    }
    
    query += ` ORDER BY timestamp DESC LIMIT ?`;
    params.push(limit.toString());

    // Execute the query
    const result = await analytics.query(query, params);
    
    return {
      data: result,
      success: true,
      error: null
    };
  } catch (error) {
    console.error('Failed to query Analytics Engine:', error);
    return {
      data: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get analytics summary for the dashboard
 */
export async function getAnalyticsSummary(analytics: AnalyticsEngineDataset | undefined, hours = 24) {
  if (!analytics) {
    return null;
  }

  try {
    // Check if query method exists (only available in production)
    if (typeof analytics.query !== 'function') {
      console.log('Analytics Engine queries not available in local development');
      return null;
    }

    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const until = new Date();

    // Get summary statistics
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_queries,
        AVG(double1) as avg_duration,
        MIN(double1) as min_duration,
        MAX(double1) as max_duration,
        SUM(CASE WHEN blob4 = 'error' THEN 1 ELSE 0 END) as error_count,
        SUM(CASE WHEN blob4 = 'success' THEN 1 ELSE 0 END) as success_count
      FROM utahchurches_events
      WHERE timestamp >= ? AND timestamp <= ?
    `;

    const summaryResult = await analytics.query(summaryQuery, [since.toISOString(), until.toISOString()]);
    
    // Get per-route statistics
    const routeQuery = `
      SELECT 
        blob3 as route,
        COUNT(*) as count,
        AVG(double1) as avg_duration,
        MIN(double1) as min_duration,
        MAX(double1) as max_duration,
        SUM(CASE WHEN blob4 = 'error' THEN 1 ELSE 0 END) as errors
      FROM utahchurches_events
      WHERE timestamp >= ? AND timestamp <= ?
      GROUP BY blob3
      ORDER BY count DESC
      LIMIT 20
    `;

    const routeResult = await analytics.query(routeQuery, [since.toISOString(), until.toISOString()]);

    // Get per-operation statistics
    const operationQuery = `
      SELECT 
        blob1 as operation,
        COUNT(*) as count,
        AVG(double1) as avg_duration
      FROM utahchurches_events
      WHERE timestamp >= ? AND timestamp <= ?
      GROUP BY blob1
      ORDER BY count DESC
    `;

    const operationResult = await analytics.query(operationQuery, [since.toISOString(), until.toISOString()]);

    const summary = summaryResult[0] || {};
    
    // Calculate P95
    const p95Query = `
      SELECT double1 as duration
      FROM utahchurches_events
      WHERE timestamp >= ? AND timestamp <= ? AND blob4 = 'success'
      ORDER BY double1 DESC
      LIMIT 1 OFFSET ?
    `;
    
    const totalSuccess = summary.success_count || 0;
    const p95Offset = Math.floor(totalSuccess * 0.05);
    const p95Result = await analytics.query(p95Query, [since.toISOString(), until.toISOString(), p95Offset.toString()]);
    const p95Duration = p95Result[0]?.duration || 0;

    return {
      summary: {
        ...summary,
        p95_duration: p95Duration
      },
      byRoute: routeResult,
      byOperation: operationResult,
      timeRange: { since, until, hours }
    };
  } catch (error) {
    console.error('Failed to get analytics summary:', error);
    return null;
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