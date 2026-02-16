/**
 * Seed OAuth client for Claude.ai MCP integration
 * NOTE: Client registration is OPTIONAL - the OAuth flow accepts any client_id
 * This script is for reference only if you want to track registered clients
 *
 * Run with: bun tsx scripts/seed-oauth-client.ts
 */

import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { oauthClients } from '../src/db/schema';

// This would normally come from wrangler.toml or environment
// For local dev, we'll use a placeholder
const CLAUDE_AI_CLIENT_ID = 'claude-ai-mcp';

async function seedOAuthClient() {
  // Note: This script is for reference only
  // Client registration is OPTIONAL - not required for OAuth to work
  // The OAuth flow accepts any client_id and relies on PKCE for security

  console.log('OAuth Client Seed Script (OPTIONAL)');
  console.log('====================================');
  console.log('\nNOTE: Client registration is optional and not enforced.');
  console.log('The OAuth flow accepts any client_id - this is just for tracking.');
  console.log('\nIf you want to register Claude.ai in the database, use wrangler D1 execute:');
  console.log('\n  wrangler d1 execute utahchurches --command "');
  console.log("    INSERT INTO oauth_clients (");
  console.log("      client_id, client_secret, client_name,");
  console.log("      redirect_uris, scope, grant_types, response_types");
  console.log("    ) VALUES (");
  console.log(`      '${CLAUDE_AI_CLIENT_ID}',`);
  console.log("      NULL,");
  console.log("      'Claude.ai MCP Integration',");
  console.log("      '[\"https://claude.ai/oauth/callback\"]',");
  console.log("      'mcp:admin',");
  console.log("      '[\"authorization_code\"]',");
  console.log("      '[\"code\"]'");
  console.log("    ) ON CONFLICT(client_id) DO NOTHING;");
  console.log('  "');
  console.log('\n');
  console.log('Client Configuration:');
  console.log('--------------------');
  console.log(`Client ID: ${CLAUDE_AI_CLIENT_ID}`);
  console.log('Client Secret: (null - public client with PKCE)');
  console.log('Redirect URIs: https://claude.ai/oauth/callback');
  console.log('Scopes: mcp:admin');
  console.log('Grant Types: authorization_code');
  console.log('Response Types: code');
  console.log('PKCE: Required (S256 or plain)');
  console.log('\n');
  console.log('Claude.ai MCP Custom Connector Configuration:');
  console.log('---------------------------------------------');
  console.log('Name: Utah Churches MCP');
  console.log('Authentication Type: OAuth 2.1');
  console.log('Authorization URL: https://your-domain.com/oauth/authorize');
  console.log('Token URL: https://your-domain.com/oauth/token');
  console.log(`Client ID: ${CLAUDE_AI_CLIENT_ID}`);
  console.log('Client Secret: (leave empty)');
  console.log('Scopes: mcp:admin');
  console.log('Use PKCE: Yes (S256)');
  console.log('\n');
}

seedOAuthClient().catch(console.error);
