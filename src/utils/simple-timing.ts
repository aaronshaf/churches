/**
 * Simple manual timing utilities for measuring specific database operations
 */

export async function timeDbOperation<T>(
  operation: () => Promise<T>,
  label: string
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  
  try {
    const result = await operation();
    const duration = performance.now() - start;
    
    console.log(`🕐 ${label}: ${duration.toFixed(2)}ms`);
    
    return { result, duration };
  } catch (error) {
    const duration = performance.now() - start;
    console.error(`❌ ${label} failed after ${duration.toFixed(2)}ms:`, error);
    throw error;
  }
}

// Usage example:
/*
const { result: churches, duration } = await timeDbOperation(
  () => db.select().from(churches).all(),
  'Fetch all churches'
);

if (duration > 500) {
  console.warn(`Slow query detected: ${duration}ms`);
}
*/