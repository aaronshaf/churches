/**
 * OAuth Bearer token authentication middleware for MCP admin endpoint
 */

import { eq } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import { createDbWithContext } from '../db';
import { oauthAccessTokens } from '../db/schema';
import type { AuthVariables, Bindings, McpAuthIdentity } from '../types';

type ResolveMcpOAuthAuthOptions = {
  required?: boolean;
};

type ResolveMcpOAuthAuthResult = {
  identity: McpAuthIdentity | null;
  response?: Response;
};

/**
 * Resolve OAuth Bearer token authentication
 */
export async function resolveMcpOAuthAuth(
  c: Parameters<MiddlewareHandler<{ Bindings: Bindings; Variables: AuthVariables }>>[0],
  options: ResolveMcpOAuthAuthOptions = {}
): Promise<ResolveMcpOAuthAuthResult> {
  const required = options.required ?? false;

  // Extract Bearer token from Authorization header
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    if (required) {
      return {
        identity: null,
        response: c.json(
          {
            error: 'Unauthorized',
            message: 'Bearer token required',
          },
          401
        ),
      };
    }
    return { identity: null };
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  // Validate token
  const db = createDbWithContext(c);
  const [tokenRecord] = await db
    .select()
    .from(oauthAccessTokens)
    .where(eq(oauthAccessTokens.accessToken, token))
    .limit(1)
    .all();

  if (!tokenRecord) {
    if (required) {
      return {
        identity: null,
        response: c.json(
          {
            error: 'Unauthorized',
            message: 'Invalid access token',
          },
          401
        ),
      };
    }
    return { identity: null };
  }

  // Check if token is revoked
  if (tokenRecord.revokedAt) {
    if (required) {
      return {
        identity: null,
        response: c.json(
          {
            error: 'Unauthorized',
            message: 'Access token has been revoked',
          },
          401
        ),
      };
    }
    return { identity: null };
  }

  // Check if token is expired
  const now = new Date();
  if (tokenRecord.expiresAt < now) {
    if (required) {
      return {
        identity: null,
        response: c.json(
          {
            error: 'Unauthorized',
            message: 'Access token has expired',
          },
          401
        ),
      };
    }
    return { identity: null };
  }

  // Token is valid - need to get user role from Better Auth
  // For now, we'll assume OAuth tokens have admin/contributor role since we check during authorization
  // TODO: Store role in token or fetch from users table
  const identity: McpAuthIdentity = {
    tokenId: undefined,
    sessionId: undefined,
    userId: tokenRecord.userId,
    role: 'admin', // OAuth tokens are issued to admin/contributor users only
    scope: tokenRecord.scope,
  };

  return { identity };
}

/**
 * Middleware to require valid OAuth Bearer token authentication
 */
export const requireMcpOAuthAuth: MiddlewareHandler<{ Bindings: Bindings; Variables: AuthVariables }> = async (
  c,
  next
) => {
  const result = await resolveMcpOAuthAuth(c, { required: true });

  if (result.response) {
    return result.response;
  }

  if (!result.identity) {
    return c.json(
      {
        error: 'Unauthorized',
        message: 'OAuth authentication required',
      },
      401
    );
  }

  c.set('mcpAuth', result.identity);
  return await next();
};
