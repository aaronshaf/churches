import type { MiddlewareHandler } from 'hono';
import { createAuth } from '../lib/auth';
import type { AuthVariables, Bindings, McpAuthIdentity, McpWriteRole } from '../types';

function unauthorized(c: Parameters<MiddlewareHandler>[0], authUrl: string) {
  return c.json(
    {
      error: 'Unauthorized',
      message: 'Authentication required. Please sign in.',
      authUrl,
    },
    401
  );
}

function forbidden(c: Parameters<MiddlewareHandler>[0]) {
  return c.json(
    {
      error: 'Forbidden',
      message: 'Admin or contributor role required for MCP write access.',
    },
    403
  );
}

function isMcpWriteRole(role: string): role is McpWriteRole {
  return role === 'admin' || role === 'contributor';
}

type ResolveMcpSessionAuthOptions = {
  required?: boolean;
};

type ResolveMcpSessionAuthResult = {
  identity: McpAuthIdentity | null;
  sessionId: string | null;
  response?: Response;
};

/**
 * Resolve MCP session-based authentication using Better Auth sessions.
 * Used for /mcp/admin endpoint.
 */
export async function resolveMcpSessionAuth(
  c: Parameters<MiddlewareHandler<{ Bindings: Bindings; Variables: AuthVariables }>>[0],
  options: ResolveMcpSessionAuthOptions = {}
): Promise<ResolveMcpSessionAuthResult> {
  const required = options.required ?? false;

  // Create auth instance and get session
  const auth = createAuth(c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    if (required) {
      // Construct auth URL for OAuth popup
      const baseUrl = c.env.BETTER_AUTH_URL || `https://${c.env.SITE_DOMAIN}`;
      const authUrl = `${baseUrl}/auth/signin`;
      return { identity: null, sessionId: null, response: unauthorized(c, authUrl) };
    }
    return { identity: null, sessionId: null };
  }

  const user = session.user;
  if (!user || !user.id) {
    return { identity: null, sessionId: null, response: unauthorized(c, '/auth/signin') };
  }

  const userRole = user.role || 'user';
  if (!isMcpWriteRole(userRole)) {
    return { identity: null, sessionId: session.session.id, response: forbidden(c) };
  }

  const identity: McpAuthIdentity = {
    sessionId: session.session.id,
    userId: user.id,
    role: userRole,
    scope: 'broad', // Session-based auth has broad scope
  };

  return { identity, sessionId: session.session.id };
}

/**
 * Middleware to require valid session-based authentication for /mcp/admin endpoint.
 */
export const requireMcpSessionAuth: MiddlewareHandler<{ Bindings: Bindings; Variables: AuthVariables }> = async (
  c,
  next
) => {
  const result = await resolveMcpSessionAuth(c, { required: true });

  if (result.response) {
    return result.response;
  }

  if (!result.identity) {
    const baseUrl = c.env.BETTER_AUTH_URL || `https://${c.env.SITE_DOMAIN}`;
    const authUrl = `${baseUrl}/auth/signin`;
    return unauthorized(c, authUrl);
  }

  c.set('mcpAuth', result.identity);
  return await next();
};
