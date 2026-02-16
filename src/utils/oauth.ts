/**
 * OAuth 2.1 utility functions for MCP authentication
 * Implements PKCE (RFC 7636) validation and token generation
 */

/**
 * Generate a cryptographically secure random string
 */
export function generateRandomString(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate authorization code (43-character base64url string)
 */
export function generateAuthorizationCode(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64url(array);
}

/**
 * Generate access token (43-character base64url string)
 */
export function generateAccessToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64url(array);
}

/**
 * Convert Uint8Array to base64url encoding
 */
function base64url(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * SHA-256 hash function
 */
async function sha256(plain: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hash);
}

/**
 * Validate PKCE code verifier against code challenge
 * @param codeVerifier - The code_verifier from token request
 * @param codeChallenge - The code_challenge from authorization request
 * @param method - The code_challenge_method (S256 or plain)
 * @returns true if valid, false otherwise
 */
export async function validatePKCE(
  codeVerifier: string,
  codeChallenge: string,
  method: 'S256' | 'plain'
): Promise<boolean> {
  if (method === 'plain') {
    return codeVerifier === codeChallenge;
  }

  if (method === 'S256') {
    const hash = await sha256(codeVerifier);
    const computed = base64url(hash);
    return computed === codeChallenge;
  }

  return false;
}

/**
 * Validate authorization code format (43-128 characters, base64url)
 */
export function validateAuthorizationCodeFormat(code: string): boolean {
  return /^[A-Za-z0-9_-]{43,128}$/.test(code);
}

/**
 * Validate code verifier format per RFC 7636
 * Must be 43-128 characters, [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
 */
export function validateCodeVerifierFormat(verifier: string): boolean {
  return /^[A-Za-z0-9._~-]{43,128}$/.test(verifier);
}

/**
 * Validate code challenge format (43-128 characters, base64url)
 */
export function validateCodeChallengeFormat(challenge: string): boolean {
  return /^[A-Za-z0-9_-]{43,128}$/.test(challenge);
}

/**
 * Validate redirect URI matches one of the registered URIs
 */
export function validateRedirectUri(requestedUri: string, registeredUris: string[]): boolean {
  return registeredUris.includes(requestedUri);
}
