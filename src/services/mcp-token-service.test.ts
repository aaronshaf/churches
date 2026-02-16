import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { mcpTokens } from '../db/schema';
import { createMcpToken, findActiveMcpTokenByRawToken, markMcpTokenUsed, revokeMcpToken } from './mcp-token-service';

function setupDb() {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE mcp_tokens (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      user_id text NOT NULL,
      token_name text NOT NULL,
      token_hash text NOT NULL UNIQUE,
      scope text NOT NULL DEFAULT 'broad',
      created_at integer NOT NULL DEFAULT (unixepoch()),
      last_used_at integer,
      revoked_at integer
    );
  `);

  const db = drizzle(sqlite, { schema: { mcpTokens } });
  return { sqlite, db };
}

describe('mcp token service', () => {
  test('create + find active token works', async () => {
    const { sqlite, db } = setupDb();
    try {
      const created = await createMcpToken(db as any, {
        userId: 'user-1',
        tokenName: 'CLI',
        scope: 'broad',
      });

      expect(created.plaintextToken.startsWith('mcp_')).toBe(true);

      const active = await findActiveMcpTokenByRawToken(db as any, created.plaintextToken);
      expect(active?.id).toBe(created.tokenId);
      expect(active?.userId).toBe('user-1');
      expect(active?.revokedAt).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  test('revoked token no longer authenticates', async () => {
    const { sqlite, db } = setupDb();
    try {
      const created = await createMcpToken(db as any, {
        userId: 'user-2',
        tokenName: 'Claude',
        scope: 'broad',
      });

      await revokeMcpToken(db as any, created.tokenId);

      const activeAfterRevoke = await findActiveMcpTokenByRawToken(db as any, created.plaintextToken);
      expect(activeAfterRevoke).toBeUndefined();

      const row = await db.select().from(mcpTokens).where(eq(mcpTokens.id, created.tokenId)).get();
      expect(row?.revokedAt).toBeInstanceOf(Date);
    } finally {
      sqlite.close();
    }
  });

  test('markMcpTokenUsed updates lastUsedAt', async () => {
    const { sqlite, db } = setupDb();
    try {
      const created = await createMcpToken(db as any, {
        userId: 'user-3',
        tokenName: 'Codex',
        scope: 'broad',
      });

      const before = await db.select().from(mcpTokens).where(eq(mcpTokens.id, created.tokenId)).get();
      expect(before?.lastUsedAt).toBeNull();

      await markMcpTokenUsed(db as any, created.tokenId);

      const after = await db.select().from(mcpTokens).where(eq(mcpTokens.id, created.tokenId)).get();
      expect(after?.lastUsedAt).toBeInstanceOf(Date);
    } finally {
      sqlite.close();
    }
  });
});
