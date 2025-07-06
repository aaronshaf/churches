import type { Column, SQL } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

/**
 * Executes a query with a batched IN clause to avoid SQLite's "too many SQL variables" error.
 * SQLite has a limit of approximately 999 variables per query.
 *
 * @param ids - Array of IDs to use in the IN clause
 * @param batchSize - Maximum number of IDs per batch (default: 100, safe margin below SQLite limit)
 * @param queryBuilder - Function that builds and executes the query for a batch of IDs
 * @returns Combined results from all batches
 */
export async function batchedInQuery<T, ID>(
  ids: ID[],
  batchSize: number = 100,
  queryBuilder: (batchIds: ID[]) => Promise<T[]>
): Promise<T[]> {
  if (ids.length === 0) {
    return [];
  }

  const results: T[] = [];

  // Process in batches
  for (let i = 0; i < ids.length; i += batchSize) {
    const batchIds = ids.slice(i, i + batchSize);
    const batchResults = await queryBuilder(batchIds);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Creates a SQL IN clause expression with the given IDs.
 * This is a helper for use within the batchedInQuery queryBuilder function.
 *
 * @param column - The column to compare against
 * @param ids - Array of IDs to include in the IN clause
 * @returns SQL expression for the IN clause
 */
export function createInClause<T>(column: Column, ids: T[]): SQL {
  return sql`${column} IN (${sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `
  )})`;
}
