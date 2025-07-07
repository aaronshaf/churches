import { describe, expect, test } from 'bun:test';

// Helper function to format lastmod date (copied from seo.ts for testing)
function formatLastmod(updatedAt: Date | number | null, createdAt: Date | number | null): string | null {
  const lastMod = updatedAt || createdAt;
  if (!lastMod) return null;
  
  // Check if timestamp is already in milliseconds (very large number) or seconds
  const timestamp = typeof lastMod === 'number' 
    ? (lastMod > 10000000000 ? lastMod : lastMod * 1000)
    : lastMod.getTime();
  
  const date = new Date(timestamp);
  
  // Only include lastmod if it's a valid date between 2020 and 2030
  if (date.getFullYear() >= 2020 && date.getFullYear() <= 2030) {
    return date.toISOString();
  }
  
  return null;
}

describe('formatLastmod', () => {
  test('returns null for null inputs', () => {
    expect(formatLastmod(null, null)).toBeNull();
  });

  test('returns null for undefined updatedAt and null createdAt', () => {
    // Test with undefined by using a variable that could be Date | number | null | undefined
    const undefinedDate: Date | number | null = undefined as unknown as null;
    expect(formatLastmod(undefinedDate, null)).toBeNull();
  });

  test('uses updatedAt when available', () => {
    const updated = new Date('2024-01-15T10:30:00Z');
    const created = new Date('2023-12-01T08:00:00Z');
    expect(formatLastmod(updated, created)).toBe('2024-01-15T10:30:00.000Z');
  });

  test('falls back to createdAt when updatedAt is null', () => {
    const created = new Date('2023-12-01T08:00:00Z');
    expect(formatLastmod(null, created)).toBe('2023-12-01T08:00:00.000Z');
  });

  test('handles Unix timestamp in seconds', () => {
    const secondsTimestamp = 1704067200; // 2024-01-01 00:00:00 UTC
    expect(formatLastmod(secondsTimestamp, null)).toBe('2024-01-01T00:00:00.000Z');
  });

  test('handles Unix timestamp in milliseconds', () => {
    const millisecondsTimestamp = 1704067200000; // 2024-01-01 00:00:00 UTC
    expect(formatLastmod(millisecondsTimestamp, null)).toBe('2024-01-01T00:00:00.000Z');
  });

  test('returns null for dates before 2020', () => {
    const oldDate = new Date('2019-12-31T23:59:59Z');
    expect(formatLastmod(oldDate, null)).toBeNull();
  });

  test('returns null for dates after 2030', () => {
    const futureDate = new Date('2031-01-01T00:00:00Z');
    expect(formatLastmod(futureDate, null)).toBeNull();
  });

  test('returns valid ISO string for date in 2020', () => {
    const date2020 = new Date('2020-01-01T00:00:00Z');
    expect(formatLastmod(date2020, null)).toBe('2020-01-01T00:00:00.000Z');
  });

  test('returns valid ISO string for date in 2030', () => {
    const date2030 = new Date('2030-12-31T23:59:59Z');
    expect(formatLastmod(date2030, null)).toBe('2030-12-31T23:59:59.000Z');
  });

  test('handles very large timestamps correctly', () => {
    const veryLargeTimestamp = 20000000000; // Would be year 2603 if treated as seconds
    // Should be treated as milliseconds (1970 + 20 billion ms = ~1970)
    expect(formatLastmod(veryLargeTimestamp, null)).toBeNull(); // Out of valid range
  });

  test('prefers updatedAt even if createdAt is more recent', () => {
    const updated = new Date('2024-01-01T00:00:00Z');
    const created = new Date('2024-02-01T00:00:00Z'); // More recent
    expect(formatLastmod(updated, created)).toBe('2024-01-01T00:00:00.000Z');
  });
});