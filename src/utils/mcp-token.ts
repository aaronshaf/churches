const TOKEN_PREFIX = 'mcp_';
const TOKEN_BYTE_LENGTH = 32;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function generateMcpToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTE_LENGTH);
  crypto.getRandomValues(bytes);
  return `${TOKEN_PREFIX}${bytesToHex(bytes)}`;
}

export async function hashMcpToken(token: string): Promise<string> {
  const input = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', input);
  return bytesToHex(new Uint8Array(digest));
}

export function extractBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token, ...extra] = authorizationHeader.trim().split(/\s+/);
  if (!scheme || !token || extra.length > 0) {
    return null;
  }

  if (scheme.toLowerCase() !== 'bearer') {
    return null;
  }

  return token;
}
