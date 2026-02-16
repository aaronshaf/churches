/**
 * OAuth 2.1 Service for MCP Authentication
 * Handles authorization codes, access tokens, and PKCE validation
 */

import { eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { oauthAccessTokens, oauthAuthorizationCodes, oauthClients } from '../db/schema';
import {
  generateAccessToken,
  generateAuthorizationCode,
  validateCodeChallengeFormat,
  validatePKCE,
  validateRedirectUri,
} from '../utils/oauth';

type OAuthDb = DrizzleD1Database<typeof schema>;

/**
 * Get OAuth client by client_id
 */
export async function getOAuthClient(db: OAuthDb, clientId: string) {
  const [client] = await db.select().from(oauthClients).where(eq(oauthClients.clientId, clientId)).limit(1).all();

  if (!client) {
    return null;
  }

  return {
    ...client,
    redirectUris: JSON.parse(client.redirectUris) as string[],
    grantTypes: JSON.parse(client.grantTypes) as string[],
    responseTypes: JSON.parse(client.responseTypes) as string[],
  };
}

/**
 * Create authorization code with PKCE
 */
export async function createAuthorizationCode(
  db: OAuthDb,
  params: {
    clientId: string;
    userId: string;
    redirectUri: string;
    scope: string;
    codeChallenge: string;
    codeChallengeMethod: 'S256' | 'plain';
  }
): Promise<{ code: string; expiresAt: Date }> {
  const client = await getOAuthClient(db, params.clientId);
  if (!client) {
    throw new Error('Invalid client_id');
  }

  // Validate redirect URI
  if (!validateRedirectUri(params.redirectUri, client.redirectUris)) {
    throw new Error('Invalid redirect_uri');
  }

  // Validate code challenge format
  if (!validateCodeChallengeFormat(params.codeChallenge)) {
    throw new Error('Invalid code_challenge format');
  }

  // Generate authorization code (expires in 10 minutes)
  const code = generateAuthorizationCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await db
    .insert(oauthAuthorizationCodes)
    .values({
      code,
      clientId: params.clientId,
      userId: params.userId,
      redirectUri: params.redirectUri,
      scope: params.scope,
      codeChallenge: params.codeChallenge,
      codeChallengeMethod: params.codeChallengeMethod,
      expiresAt,
    })
    .run();

  return { code, expiresAt };
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  db: OAuthDb,
  params: {
    code: string;
    clientId: string;
    redirectUri: string;
    codeVerifier: string;
  }
): Promise<{
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  scope: string;
} | null> {
  // Find authorization code
  const [authCode] = await db
    .select()
    .from(oauthAuthorizationCodes)
    .where(eq(oauthAuthorizationCodes.code, params.code))
    .limit(1)
    .all();

  if (!authCode) {
    throw new Error('Invalid authorization code');
  }

  // Check if code has been used
  if (authCode.usedAt) {
    throw new Error('Authorization code already used');
  }

  // Check if code is expired
  const now = new Date();
  if (authCode.expiresAt < now) {
    throw new Error('Authorization code expired');
  }

  // Validate client_id matches
  if (authCode.clientId !== params.clientId) {
    throw new Error('client_id mismatch');
  }

  // Validate redirect_uri matches
  if (authCode.redirectUri !== params.redirectUri) {
    throw new Error('redirect_uri mismatch');
  }

  // Validate PKCE code_verifier
  const pkceValid = await validatePKCE(
    params.codeVerifier,
    authCode.codeChallenge,
    authCode.codeChallengeMethod as 'S256' | 'plain'
  );

  if (!pkceValid) {
    throw new Error('Invalid code_verifier');
  }

  // Mark code as used
  await db
    .update(oauthAuthorizationCodes)
    .set({ usedAt: new Date() })
    .where(eq(oauthAuthorizationCodes.code, params.code))
    .run();

  // Generate access token (expires in 1 hour)
  const accessToken = generateAccessToken();
  const expiresIn = 3600; // 1 hour
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  await db
    .insert(oauthAccessTokens)
    .values({
      accessToken,
      clientId: params.clientId,
      userId: authCode.userId,
      scope: authCode.scope,
      expiresAt,
    })
    .run();

  return {
    accessToken,
    tokenType: 'Bearer',
    expiresIn,
    scope: authCode.scope,
  };
}

/**
 * Validate access token and return user info
 */
export async function validateAccessToken(
  db: OAuthDb,
  accessToken: string
): Promise<{
  userId: string;
  clientId: string;
  scope: string;
} | null> {
  const [token] = await db
    .select()
    .from(oauthAccessTokens)
    .where(eq(oauthAccessTokens.accessToken, accessToken))
    .limit(1)
    .all();

  if (!token) {
    return null;
  }

  // Check if token is revoked
  if (token.revokedAt) {
    return null;
  }

  // Check if token is expired
  const now = new Date();
  if (token.expiresAt < now) {
    return null;
  }

  return {
    userId: token.userId,
    clientId: token.clientId,
    scope: token.scope,
  };
}

/**
 * Revoke access token
 */
export async function revokeAccessToken(db: OAuthDb, accessToken: string): Promise<boolean> {
  await db
    .update(oauthAccessTokens)
    .set({ revokedAt: new Date() })
    .where(eq(oauthAccessTokens.accessToken, accessToken))
    .run();

  return true;
}
