import { describe, expect, test } from 'bun:test';
import { extractBearerToken, generateMcpToken, hashMcpToken } from './mcp-token';

describe('mcp token utilities', () => {
  test('generateMcpToken creates prefixed random token', () => {
    const token = generateMcpToken();
    expect(token.startsWith('mcp_')).toBe(true);
    expect(token.length).toBeGreaterThan(20);
  });

  test('hashMcpToken is deterministic', async () => {
    const token = 'mcp_test_token';
    const hashA = await hashMcpToken(token);
    const hashB = await hashMcpToken(token);
    expect(hashA).toBe(hashB);
    expect(hashA.length).toBe(64);
  });

  test('extractBearerToken validates bearer format', () => {
    expect(extractBearerToken(undefined)).toBeNull();
    expect(extractBearerToken('')).toBeNull();
    expect(extractBearerToken('Token abc')).toBeNull();
    expect(extractBearerToken('Bearer')).toBeNull();
    expect(extractBearerToken('Bearer abc def')).toBeNull();
    expect(extractBearerToken('Bearer abc123')).toBe('abc123');
    expect(extractBearerToken('bearer abc123')).toBe('abc123');
  });
});
