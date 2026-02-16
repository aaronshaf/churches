import { and, eq, isNull } from 'drizzle-orm';
import type { DbType } from '../db';
import { mcpTokens } from '../db/schema';
import { generateMcpToken, hashMcpToken } from '../utils/mcp-token';

type CreateMcpTokenInput = {
  userId: string;
  tokenName: string;
  scope?: string;
};

export async function createMcpToken(db: DbType, input: CreateMcpTokenInput) {
  const plaintextToken = generateMcpToken();
  const tokenHash = await hashMcpToken(plaintextToken);

  await db
    .insert(mcpTokens)
    .values({
      userId: input.userId,
      tokenName: input.tokenName,
      tokenHash,
      scope: input.scope ?? 'broad',
      // Avoid relying on SQLite CURRENT_TIMESTAMP defaults for integer timestamp columns.
      createdAt: new Date(),
    })
    .run();

  const tokenRecord = await db
    .select({
      id: mcpTokens.id,
      userId: mcpTokens.userId,
      tokenName: mcpTokens.tokenName,
      scope: mcpTokens.scope,
      createdAt: mcpTokens.createdAt,
    })
    .from(mcpTokens)
    .where(eq(mcpTokens.tokenHash, tokenHash))
    .get();

  if (!tokenRecord) {
    throw new Error('Failed to create MCP token record');
  }

  return {
    tokenId: tokenRecord.id,
    userId: tokenRecord.userId,
    tokenName: tokenRecord.tokenName,
    scope: tokenRecord.scope,
    createdAt: tokenRecord.createdAt,
    plaintextToken,
  };
}

export async function findActiveMcpTokenByRawToken(db: DbType, rawToken: string) {
  const tokenHash = await hashMcpToken(rawToken);

  return await db
    .select({
      id: mcpTokens.id,
      userId: mcpTokens.userId,
      scope: mcpTokens.scope,
      revokedAt: mcpTokens.revokedAt,
    })
    .from(mcpTokens)
    .where(and(eq(mcpTokens.tokenHash, tokenHash), isNull(mcpTokens.revokedAt)))
    .get();
}

export async function markMcpTokenUsed(db: DbType, tokenId: number) {
  await db.update(mcpTokens).set({ lastUsedAt: new Date() }).where(eq(mcpTokens.id, tokenId)).run();
}

export async function revokeMcpToken(db: DbType, tokenId: number) {
  await db
    .update(mcpTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(mcpTokens.id, tokenId), isNull(mcpTokens.revokedAt)))
    .run();
}
