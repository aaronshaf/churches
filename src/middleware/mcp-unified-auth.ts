import type { MiddlewareHandler } from 'hono';
import { createAuth } from '../lib/auth';
import { resolveMcpOAuthAuth } from './mcp-oauth-auth';
import type { AuthVariables, Bindings, McpAuthIdentity } from '../types';

/**
 * Unified MCP authentication resolver that supports both OAuth Bearer tokens and sessions.
 * Tries OAuth Bearer token first, then falls back to session-based auth.
 * Used for /mcp/admin endpoint to support both Claude.ai (OAuth) and browser clients (session).
 */
export async function resolveMcpUnifiedAuth(
  c: Parameters<MiddlewareHandler<{ Bindings: Bindings; Variables: AuthVariables }>>[0],
  options: { required?: boolean } = {}
): Promise<{
  identity: McpAuthIdentity | null;
  sessionId: string | null;
  response?: Response;
}> {
  const required = options.required ?? false;

  // Try OAuth Bearer token auth first
  const oauthAuth = await resolveMcpOAuthAuth(c, { required: false });

  if (oauthAuth.identity) {
    // OAuth Bearer token auth succeeded
    return { identity: oauthAuth.identity, sessionId: null };
  }

  // Try session-based auth as fallback
  const auth = createAuth(c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (session?.user?.id) {
    const userRole = session.user.role || 'user';

    // Check if user has write access
    if (userRole === 'admin' || userRole === 'contributor') {
      const identity: McpAuthIdentity = {
        sessionId: session.session.id,
        userId: session.user.id,
        role: userRole,
        scope: 'mcp:admin',
      };
      return { identity, sessionId: session.session.id };
    }

    // User authenticated but doesn't have required role
    if (required) {
      return {
        identity: null,
        sessionId: session.session.id,
        response: c.json(
          {
            error: 'Forbidden',
            message: 'Admin or contributor role required for MCP write access.',
          },
          403
        ),
      };
    }
  }

  // No authentication found
  if (required) {
    // Return 401 with WWW-Authenticate header for OAuth discovery
    const baseUrl = c.env.BETTER_AUTH_URL || `https://${c.env.SITE_DOMAIN}`;
    const wwwAuthenticate = `Bearer realm="mcp", resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`;

    return {
      identity: null,
      sessionId: null,
      response: new Response(
        JSON.stringify({
          error: 'Unauthorized',
          message: 'Authentication required. Use OAuth Bearer token or sign in.',
          authUrl: `${baseUrl}/oauth/authorize`,
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'WWW-Authenticate': wwwAuthenticate,
          },
        }
      ),
    };
  }

  return { identity: null, sessionId: null };
}
