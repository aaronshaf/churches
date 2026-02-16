import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import type { MiddlewareHandler } from 'hono';
import { createDbWithContext } from '../db';
import { users } from '../db/auth-schema';
import { findActiveMcpTokenByRawToken, markMcpTokenUsed } from '../services/mcp-token-service';
import type { AuthVariables, Bindings, McpAuthIdentity, McpWriteRole } from '../types';
import { extractBearerToken } from '../utils/mcp-token';

function unauthorized(c: Parameters<MiddlewareHandler>[0]) {
  return c.json({ error: 'Unauthorized' }, 401);
}

function forbidden(c: Parameters<MiddlewareHandler>[0]) {
  return c.json({ error: 'Forbidden - MCP write access required' }, 403);
}

function isMcpWriteRole(role: string): role is McpWriteRole {
  return role === 'admin' || role === 'contributor';
}

type ResolveMcpAuthOptions = {
  required?: boolean;
  touchLastUsed?: boolean;
};

type ResolveMcpAuthResult = {
  identity: McpAuthIdentity | null;
  response?: Response;
};

export async function resolveMcpAuthIdentity(
  c: Parameters<MiddlewareHandler<{ Bindings: Bindings; Variables: AuthVariables }>>[0],
  options: ResolveMcpAuthOptions = {}
): Promise<ResolveMcpAuthResult> {
  const required = options.required ?? false;
  const touchLastUsed = options.touchLastUsed ?? false;

  const authorizationHeader = c.req.header('Authorization');
  if (!authorizationHeader) {
    if (required) {
      return { identity: null, response: unauthorized(c) };
    }
    return { identity: null };
  }

  const token = extractBearerToken(authorizationHeader);
  if (!token) {
    return { identity: null, response: unauthorized(c) };
  }

  const db = createDbWithContext(c);
  const tokenRecord = await findActiveMcpTokenByRawToken(db, token);
  if (!tokenRecord) {
    return { identity: null, response: unauthorized(c) };
  }

  const authDb = drizzle(c.env.DB, { schema: { users } });
  const user = await authDb
    .select({
      id: users.id,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, tokenRecord.userId))
    .get();

  if (!user) {
    return { identity: null, response: unauthorized(c) };
  }

  if (!isMcpWriteRole(user.role)) {
    return { identity: null, response: forbidden(c) };
  }

  if (touchLastUsed) {
    await markMcpTokenUsed(db, tokenRecord.id);
  }

  const identity: McpAuthIdentity = {
    tokenId: tokenRecord.id,
    userId: user.id,
    role: user.role,
    scope: tokenRecord.scope,
  };

  return { identity };
}

export const requireMcpWriteAuth: MiddlewareHandler<{ Bindings: Bindings; Variables: AuthVariables }> = async (
  c,
  next
) => {
  const result = await resolveMcpAuthIdentity(c, {
    required: true,
    touchLastUsed: true,
  });
  if (result.response) {
    return result.response;
  }

  if (!result.identity) {
    return unauthorized(c);
  }

  c.set('mcpAuth', result.identity);
  return await next();
};
