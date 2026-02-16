/**
 * OAuth 2.1 endpoints for MCP authentication
 * Implements RFC 9728 (Protected Resource Metadata) and RFC 7636 (PKCE)
 */

import { Hono } from 'hono';
import { createDbWithContext } from '../db';
import { createAuth } from '../lib/auth';
import {
  createAuthorizationCode,
  exchangeCodeForToken,
} from '../services/oauth-service';
import type { AuthVariables, Bindings } from '../types';

const oauthRoutes = new Hono<{ Bindings: Bindings; Variables: AuthVariables }>();

/**
 * RFC 9728: Protected Resource Metadata
 * Returns metadata about the OAuth-protected resource (MCP endpoint)
 */
oauthRoutes.get('/.well-known/oauth-protected-resource', async (c) => {
  const baseUrl = c.env.BETTER_AUTH_URL || `https://${c.env.SITE_DOMAIN}`;

  return c.json({
    resource: `${baseUrl}/mcp/admin`,
    authorization_servers: [baseUrl],
    bearer_methods_supported: ['header'],
    resource_documentation: `${baseUrl}/docs/mcp-oauth`,
  });
});

/**
 * RFC 8414: Authorization Server Metadata
 * Returns metadata about the OAuth authorization server
 */
oauthRoutes.get('/.well-known/oauth-authorization-server', async (c) => {
  const baseUrl = c.env.BETTER_AUTH_URL || `https://${c.env.SITE_DOMAIN}`;

  return c.json({
    issuer: `${baseUrl}/oauth`,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    token_endpoint_auth_methods_supported: ['none'], // Public clients with PKCE
    grant_types_supported: ['authorization_code'],
    response_types_supported: ['code'],
    code_challenge_methods_supported: ['S256', 'plain'],
    scopes_supported: ['mcp:admin'],
    service_documentation: `${baseUrl}/docs/mcp-oauth`,
  });
});

/**
 * Authorization endpoint - initiates OAuth flow
 * Redirects to Better Auth Google OAuth, then back to callback
 */
oauthRoutes.get('/oauth/authorize', async (c) => {
  const params = c.req.query();
  const {
    response_type,
    client_id,
    redirect_uri,
    scope,
    state,
    code_challenge,
    code_challenge_method,
  } = params;

  // Validate required parameters
  if (!response_type || response_type !== 'code') {
    return c.json({ error: 'unsupported_response_type', error_description: 'Only "code" is supported' }, 400);
  }

  // client_id is optional - default to 'anonymous' if not provided
  const effectiveClientId = client_id || 'anonymous';

  if (!redirect_uri) {
    return c.json({ error: 'invalid_request', error_description: 'redirect_uri is required' }, 400);
  }

  if (!code_challenge) {
    return c.json({ error: 'invalid_request', error_description: 'code_challenge is required (PKCE)' }, 400);
  }

  if (!code_challenge_method || (code_challenge_method !== 'S256' && code_challenge_method !== 'plain')) {
    return c.json({ error: 'invalid_request', error_description: 'code_challenge_method must be S256 or plain' }, 400);
  }

  const db = createDbWithContext(c);

  // Check if user is already authenticated via Better Auth session
  const auth = createAuth(c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session?.user?.id) {
    // User not authenticated - redirect to Google OAuth
    // Store OAuth params in a temporary state for callback
    const oauthState = btoa(
      JSON.stringify({
        client_id: effectiveClientId,
        redirect_uri,
        scope: scope || 'mcp:admin',
        state,
        code_challenge,
        code_challenge_method,
      })
    );

    // Redirect to custom Google OAuth with our callback (encode state in redirect URL)
    const baseUrl = c.env.BETTER_AUTH_URL || `https://${c.env.SITE_DOMAIN}`;
    const callbackUrl = `${baseUrl}/oauth/callback?state=${encodeURIComponent(oauthState)}`;
    const googleAuthUrl = `${baseUrl}/auth/google?redirect=${encodeURIComponent(callbackUrl)}`;

    return c.redirect(googleAuthUrl);
  }

  // User is authenticated - check role
  const userRole = session.user.role || 'user';
  if (userRole !== 'admin' && userRole !== 'contributor') {
    // Build error redirect
    const errorUrl = new URL(redirect_uri);
    errorUrl.searchParams.set('error', 'access_denied');
    errorUrl.searchParams.set('error_description', 'Admin or contributor role required');
    if (state) {
      errorUrl.searchParams.set('state', state);
    }
    return c.redirect(errorUrl.toString());
  }

  // User has required role - create authorization code
  try {
    const { code } = await createAuthorizationCode(db, {
      clientId: effectiveClientId,
      userId: session.user.id,
      redirectUri: redirect_uri,
      scope: scope || 'mcp:admin',
      codeChallenge: code_challenge,
      codeChallengeMethod: code_challenge_method as 'S256' | 'plain',
    });

    // Redirect back to client with code
    const successUrl = new URL(redirect_uri);
    successUrl.searchParams.set('code', code);
    if (state) {
      successUrl.searchParams.set('state', state);
    }

    return c.redirect(successUrl.toString());
  } catch (error) {
    const errorUrl = new URL(redirect_uri);
    errorUrl.searchParams.set('error', 'server_error');
    errorUrl.searchParams.set('error_description', error instanceof Error ? error.message : 'Unknown error');
    if (state) {
      errorUrl.searchParams.set('state', state);
    }
    return c.redirect(errorUrl.toString());
  }
});

/**
 * OAuth callback - handles redirect from Better Auth Google OAuth
 */
oauthRoutes.get('/oauth/callback', async (c) => {
  const stateParam = c.req.query('state');
  if (!stateParam) {
    return c.text('Missing state parameter', 400);
  }

  let oauthParams: {
    client_id: string;
    redirect_uri: string;
    scope: string;
    state?: string;
    code_challenge: string;
    code_challenge_method: string;
  };

  try {
    oauthParams = JSON.parse(atob(stateParam));
  } catch {
    return c.text('Invalid state parameter', 400);
  }

  // Check Better Auth session
  const auth = createAuth(c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session?.user?.id) {
    const errorUrl = new URL(oauthParams.redirect_uri);
    errorUrl.searchParams.set('error', 'access_denied');
    errorUrl.searchParams.set('error_description', 'Authentication failed');
    if (oauthParams.state) {
      errorUrl.searchParams.set('state', oauthParams.state);
    }
    return c.redirect(errorUrl.toString());
  }

  // Check user role
  const userRole = session.user.role || 'user';
  if (userRole !== 'admin' && userRole !== 'contributor') {
    const errorUrl = new URL(oauthParams.redirect_uri);
    errorUrl.searchParams.set('error', 'access_denied');
    errorUrl.searchParams.set('error_description', 'Admin or contributor role required');
    if (oauthParams.state) {
      errorUrl.searchParams.set('state', oauthParams.state);
    }
    return c.redirect(errorUrl.toString());
  }

  // Create authorization code
  const db = createDbWithContext(c);
  try {
    const effectiveClientId = oauthParams.client_id || 'anonymous';
    const { code } = await createAuthorizationCode(db, {
      clientId: effectiveClientId,
      userId: session.user.id,
      redirectUri: oauthParams.redirect_uri,
      scope: oauthParams.scope,
      codeChallenge: oauthParams.code_challenge,
      codeChallengeMethod: oauthParams.code_challenge_method as 'S256' | 'plain',
    });

    // Redirect back to client with code
    const successUrl = new URL(oauthParams.redirect_uri);
    successUrl.searchParams.set('code', code);
    if (oauthParams.state) {
      successUrl.searchParams.set('state', oauthParams.state);
    }

    return c.redirect(successUrl.toString());
  } catch (error) {
    const errorUrl = new URL(oauthParams.redirect_uri);
    errorUrl.searchParams.set('error', 'server_error');
    errorUrl.searchParams.set('error_description', error instanceof Error ? error.message : 'Unknown error');
    if (oauthParams.state) {
      errorUrl.searchParams.set('state', oauthParams.state);
    }
    return c.redirect(errorUrl.toString());
  }
});

/**
 * Token endpoint - exchanges authorization code for access token
 */
oauthRoutes.post('/oauth/token', async (c) => {
  const body = await c.req.parseBody();
  const { grant_type, code, redirect_uri, client_id, code_verifier } = body;

  // Validate required parameters
  if (grant_type !== 'authorization_code') {
    return c.json({ error: 'unsupported_grant_type', error_description: 'Only authorization_code is supported' }, 400);
  }

  if (!code || typeof code !== 'string') {
    return c.json({ error: 'invalid_request', error_description: 'code is required' }, 400);
  }

  if (!redirect_uri || typeof redirect_uri !== 'string') {
    return c.json({ error: 'invalid_request', error_description: 'redirect_uri is required' }, 400);
  }

  if (!code_verifier || typeof code_verifier !== 'string') {
    return c.json({ error: 'invalid_request', error_description: 'code_verifier is required (PKCE)' }, 400);
  }

  // client_id is optional - default to 'anonymous' if not provided
  const effectiveClientId = (typeof client_id === 'string' ? client_id : null) || 'anonymous';

  // Exchange code for token
  const db = createDbWithContext(c);
  try {
    console.log('[OAuth Token] Exchanging code for token, clientId:', effectiveClientId);
    const token = await exchangeCodeForToken(db, {
      code,
      clientId: effectiveClientId,
      redirectUri: redirect_uri,
      codeVerifier: code_verifier,
    });

    if (!token) {
      console.log('[OAuth Token] Exchange failed - no token returned');
      return c.json({ error: 'invalid_grant', error_description: 'Invalid authorization code' }, 400);
    }

    console.log('[OAuth Token] Token issued successfully');
    return c.json({
      access_token: token.accessToken,
      token_type: token.tokenType,
      expires_in: token.expiresIn,
      scope: token.scope,
    });
  } catch (error) {
    console.error('[OAuth Token] Exchange error:', error);
    return c.json({
      error: 'invalid_grant',
      error_description: error instanceof Error ? error.message : 'Token exchange failed',
    }, 400);
  }
});

export { oauthRoutes };
