/**
 * OAuth 2.1 endpoints for MCP authentication
 * Implements RFC 9728 (Protected Resource Metadata) and RFC 7636 (PKCE)
 */

import { Hono } from 'hono';
import { createDbWithContext } from '../db';
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

  console.log('[OAuth Authorize] Request received', {
    response_type,
    client_id: client_id || 'anonymous',
    redirect_uri,
    scope,
    has_code_challenge: !!code_challenge,
    code_challenge_method,
  });

  // Validate required parameters
  if (!response_type || response_type !== 'code') {
    console.log('[OAuth Authorize] ERROR: Invalid response_type', { response_type });
    return c.json({ error: 'unsupported_response_type', error_description: 'Only "code" is supported' }, 400);
  }

  // client_id is optional - default to 'anonymous' if not provided
  const effectiveClientId = client_id || 'anonymous';

  if (!redirect_uri) {
    console.log('[OAuth Authorize] ERROR: Missing redirect_uri');
    return c.json({ error: 'invalid_request', error_description: 'redirect_uri is required' }, 400);
  }

  if (!code_challenge) {
    console.log('[OAuth Authorize] ERROR: Missing code_challenge');
    return c.json({ error: 'invalid_request', error_description: 'code_challenge is required (PKCE)' }, 400);
  }

  if (!code_challenge_method || (code_challenge_method !== 'S256' && code_challenge_method !== 'plain')) {
    console.log('[OAuth Authorize] ERROR: Invalid code_challenge_method', { code_challenge_method });
    return c.json({ error: 'invalid_request', error_description: 'code_challenge_method must be S256 or plain' }, 400);
  }

  const db = createDbWithContext(c);

  // Check if user is already authenticated via session cookie
  const { getUser } = await import('../middleware/better-auth');
  const user = await getUser(c);

  if (!user?.id) {
    console.log('[OAuth Authorize] User not authenticated, redirecting to Google OAuth');
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

    console.log('[OAuth Authorize] Redirecting to Google OAuth', { googleAuthUrl: googleAuthUrl.substring(0, 80) + '...' });
    return c.redirect(googleAuthUrl);
  }

  console.log('[OAuth Authorize] User authenticated', { userId: user.id, role: user.role || 'user' });

  // User is authenticated - check role
  const userRole = user.role || 'user';
  if (userRole !== 'admin' && userRole !== 'contributor') {
    console.log('[OAuth Authorize] ERROR: Insufficient role', { userId: user.id, role: userRole });
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
    console.log('[OAuth Authorize] Creating authorization code', { userId: user.id, clientId: effectiveClientId });
    const { code } = await createAuthorizationCode(db, {
      clientId: effectiveClientId,
      userId: user.id,
      redirectUri: redirect_uri,
      scope: scope || 'mcp:admin',
      codeChallenge: code_challenge,
      codeChallengeMethod: code_challenge_method as 'S256' | 'plain',
    });

    console.log('[OAuth Authorize] Authorization code created, redirecting to client', {
      code: code.substring(0, 8) + '...',
      redirect_uri
    });

    // Redirect back to client with code
    const successUrl = new URL(redirect_uri);
    successUrl.searchParams.set('code', code);
    if (state) {
      successUrl.searchParams.set('state', state);
    }

    return c.redirect(successUrl.toString());
  } catch (error) {
    console.error('[OAuth Authorize] ERROR: Failed to create authorization code', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: user.id,
    });
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
  console.log('[OAuth Callback] Request received');

  const stateParam = c.req.query('state');
  if (!stateParam) {
    console.log('[OAuth Callback] ERROR: Missing state parameter');
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
    console.log('[OAuth Callback] Decoded state', {
      client_id: oauthParams.client_id || 'anonymous',
      redirect_uri: oauthParams.redirect_uri,
      scope: oauthParams.scope,
    });
  } catch {
    console.log('[OAuth Callback] ERROR: Invalid state parameter');
    return c.text('Invalid state parameter', 400);
  }

  // Check session cookie
  const { getUser } = await import('../middleware/better-auth');
  const user = await getUser(c);

  if (!user?.id) {
    console.log('[OAuth Callback] ERROR: No authenticated user after Google OAuth');
    const errorUrl = new URL(oauthParams.redirect_uri);
    errorUrl.searchParams.set('error', 'access_denied');
    errorUrl.searchParams.set('error_description', 'Authentication failed');
    if (oauthParams.state) {
      errorUrl.searchParams.set('state', oauthParams.state);
    }
    return c.redirect(errorUrl.toString());
  }

  console.log('[OAuth Callback] User authenticated', { userId: user.id, role: user.role || 'user' });

  // Check user role
  const userRole = user.role || 'user';
  if (userRole !== 'admin' && userRole !== 'contributor') {
    console.log('[OAuth Callback] ERROR: Insufficient role', { userId: user.id, role: userRole });
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
    console.log('[OAuth Callback] Creating authorization code', { userId: user.id, clientId: effectiveClientId });

    const { code } = await createAuthorizationCode(db, {
      clientId: effectiveClientId,
      userId: user.id,
      redirectUri: oauthParams.redirect_uri,
      scope: oauthParams.scope,
      codeChallenge: oauthParams.code_challenge,
      codeChallengeMethod: oauthParams.code_challenge_method as 'S256' | 'plain',
    });

    console.log('[OAuth Callback] Authorization code created, redirecting to client', {
      code: code.substring(0, 8) + '...',
      redirect_uri: oauthParams.redirect_uri,
    });

    // Redirect back to client with code
    const successUrl = new URL(oauthParams.redirect_uri);
    successUrl.searchParams.set('code', code);
    if (oauthParams.state) {
      successUrl.searchParams.set('state', oauthParams.state);
    }

    return c.redirect(successUrl.toString());
  } catch (error) {
    console.error('[OAuth Callback] ERROR: Failed to create authorization code', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: user.id,
    });
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
