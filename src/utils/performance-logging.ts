/**
 * Performance logging utilities optimized for Cloudflare Workers
 * Works with Cloudflare's built-in analytics and logging
 */

interface PerformanceMetric {
  operation: string;
  duration: number;
  route?: string;
  success: boolean;
  timestamp: number;
}

/**
 * Log database performance metrics to console (picked up by Cloudflare)
 */
export function logDbPerformance(metric: PerformanceMetric) {
  // Structured logging for Cloudflare analytics
  console.log(JSON.stringify({
    type: 'db_performance',
    operation: metric.operation,
    duration_ms: Math.round(metric.duration),
    route: metric.route,
    success: metric.success,
    timestamp: metric.timestamp,
    // Add some categorization for easier filtering
    performance_category: 
      metric.duration < 50 ? 'fast' :
      metric.duration < 200 ? 'normal' :
      metric.duration < 500 ? 'slow' : 'very_slow'
  }));
}

/**
 * Wrapper that logs to Cloudflare and measures timing
 */
export async function measureAndLog<T>(
  operation: () => Promise<T>,
  operationName: string,
  route?: string
): Promise<T> {
  const start = performance.now();
  const timestamp = Date.now();
  
  try {
    const result = await operation();
    const duration = performance.now() - start;
    
    logDbPerformance({
      operation: operationName,
      duration,
      route,
      success: true,
      timestamp
    });
    
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    
    logDbPerformance({
      operation: operationName,
      duration,
      route,
      success: false,
      timestamp
    });
    
    // Also log the error for debugging
    console.error(JSON.stringify({
      type: 'db_error',
      operation: operationName,
      duration_ms: Math.round(duration),
      route,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp
    }));
    
    throw error;
  }
}

/**
 * Add timing headers to responses for external monitoring
 */
export function addTimingHeaders(response: Response, timings: Record<string, number>): Response {
  // Add Server-Timing header for browser dev tools
  const serverTiming = Object.entries(timings)
    .map(([name, duration]) => `${name};dur=${duration.toFixed(2)}`)
    .join(', ');
    
  if (serverTiming) {
    response.headers.set('Server-Timing', serverTiming);
  }
  
  // Add custom header for total DB time
  const totalDbTime = Object.values(timings).reduce((sum, time) => sum + time, 0);
  response.headers.set('X-DB-Time', totalDbTime.toFixed(2));
  
  return response;
}