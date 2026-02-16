import { desc, eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { Layout } from '../../components/Layout';
import { createDbWithContext } from '../../db';
import { users } from '../../db/auth-schema';
import { mcpTokens } from '../../db/schema';
import { requireContributorWithRedirect } from '../../middleware/redirect-auth';
import { createMcpToken, revokeMcpToken } from '../../services/mcp-token-service';
import type { AuthVariables, BetterAuthUser, Bindings } from '../../types';
import { getCommonLayoutProps } from '../../utils/layout-props';

export const adminMcpTokensRoutes = new Hono<{ Bindings: Bindings; Variables: AuthVariables }>();
type AdminMcpContext = Context<{ Bindings: Bindings; Variables: AuthVariables }>;

adminMcpTokensRoutes.use('*', requireContributorWithRedirect);

function formatDateOrDash(value: unknown): string {
  if (!value) return '-';

  const date =
    value instanceof Date ? value : typeof value === 'number' || typeof value === 'string' ? new Date(value) : null;

  if (!date || Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toISOString();
}

async function loadTokenPageData(c: AdminMcpContext, currentUser: BetterAuthUser) {
  const db = createDbWithContext(c);
  const authDb = drizzle(c.env.DB, { schema: { users } });
  const isAdmin = currentUser.role === 'admin';

  const tokens = await db
    .select({
      id: mcpTokens.id,
      userId: mcpTokens.userId,
      tokenName: mcpTokens.tokenName,
      scope: mcpTokens.scope,
      createdAt: mcpTokens.createdAt,
      lastUsedAt: mcpTokens.lastUsedAt,
      revokedAt: mcpTokens.revokedAt,
    })
    .from(mcpTokens)
    .where(isAdmin ? undefined : eq(mcpTokens.userId, currentUser.id))
    .orderBy(desc(mcpTokens.createdAt))
    .all();

  const tokenUserIds = Array.from(new Set(tokens.map((token) => token.userId)));
  const tokenUsers =
    tokenUserIds.length > 0
      ? await authDb
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
          })
          .from(users)
          .where(inArray(users.id, tokenUserIds))
          .all()
      : [];
  const usersById = new Map(tokenUsers.map((user) => [user.id, user]));

  const manageableUsers = isAdmin
    ? await authDb
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
        })
        .from(users)
        .where(inArray(users.role, ['admin', 'contributor']))
        .all()
    : [];

  return { tokens, usersById, manageableUsers, isAdmin };
}

adminMcpTokensRoutes.get('/', async (c) => {
  const currentUser = c.get('betterUser');
  if (!currentUser) {
    return c.redirect('/auth/signin');
  }
  const layoutProps = await getCommonLayoutProps(c);
  const { tokens, usersById, manageableUsers, isAdmin } = await loadTokenPageData(c, currentUser);
  const success = c.req.query('success');
  const error = c.req.query('error');

  return c.html(
    <Layout title="MCP Tokens" currentPath="/admin/mcp-tokens" {...layoutProps}>
      <div class="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div class="mb-6">
          <h1 class="text-2xl font-bold text-gray-900">MCP Tokens</h1>
          <p class="mt-1 text-sm text-gray-600">
            Use bearer tokens for `/mcp` access. Plaintext tokens are shown only once at creation.
          </p>
        </div>

        {success && (
          <div class="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-800">
            {success === 'revoked' ? 'Token revoked.' : 'Token created.'}
          </div>
        )}
        {error && <div class="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">Action failed: {error}</div>}

        <div class="mb-8 rounded-lg border border-gray-200 bg-white p-6">
          <h2 class="text-lg font-semibold text-gray-900">Create Token</h2>
          <form method="post" action="/admin/mcp-tokens/new" class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label class="block text-sm font-medium text-gray-700">Token Name</label>
              <input
                type="text"
                name="tokenName"
                required
                class="mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
                placeholder="Claude Desktop"
              />
            </div>
            {isAdmin ? (
              <div>
                <label class="block text-sm font-medium text-gray-700">Owner</label>
                <select
                  name="userId"
                  class="mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
                >
                  {manageableUsers.map((user) => (
                    <option value={user.id}>{`${user.name || user.email} (${user.role})`}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label class="block text-sm font-medium text-gray-700">Owner</label>
                <input
                  type="text"
                  value={`${currentUser.name || currentUser.email} (self)`}
                  disabled
                  class="mt-1 block w-full rounded-md border-gray-200 bg-gray-100 text-sm text-gray-600"
                />
              </div>
            )}
            <div class="flex items-end">
              <button
                type="submit"
                class="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500"
              >
                Create Token
              </button>
            </div>
          </form>
        </div>

        <div class="rounded-lg border border-gray-200 bg-white p-6">
          <h2 class="text-lg font-semibold text-gray-900">Existing Tokens</h2>
          {tokens.length === 0 ? (
            <p class="mt-3 text-sm text-gray-600">No tokens yet.</p>
          ) : (
            <div class="mt-4 overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200 text-sm">
                <thead>
                  <tr class="text-left text-gray-600">
                    <th class="py-2 pr-4 font-medium">Name</th>
                    <th class="py-2 pr-4 font-medium">Owner</th>
                    <th class="py-2 pr-4 font-medium">Scope</th>
                    <th class="py-2 pr-4 font-medium">Created</th>
                    <th class="py-2 pr-4 font-medium">Last Used</th>
                    <th class="py-2 pr-4 font-medium">Status</th>
                    <th class="py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  {tokens.map((token) => {
                    const owner = usersById.get(token.userId);
                    return (
                      <tr>
                        <td class="py-2 pr-4 text-gray-900">{token.tokenName}</td>
                        <td class="py-2 pr-4 text-gray-700">{owner ? owner.name || owner.email : token.userId}</td>
                        <td class="py-2 pr-4 text-gray-700">{token.scope}</td>
                        <td class="py-2 pr-4 text-gray-700">{formatDateOrDash(token.createdAt)}</td>
                        <td class="py-2 pr-4 text-gray-700">{formatDateOrDash(token.lastUsedAt)}</td>
                        <td class="py-2 pr-4">
                          {token.revokedAt ? (
                            <span class="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">Revoked</span>
                          ) : (
                            <span class="rounded bg-green-100 px-2 py-1 text-xs text-green-700">Active</span>
                          )}
                        </td>
                        <td class="py-2">
                          {!token.revokedAt ? (
                            <form method="post" action={`/admin/mcp-tokens/${token.id}/revoke`}>
                              <button
                                type="submit"
                                class="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                              >
                                Revoke
                              </button>
                            </form>
                          ) : (
                            <span class="text-xs text-gray-500">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
});

adminMcpTokensRoutes.post('/new', async (c) => {
  const currentUser = c.get('betterUser');
  if (!currentUser) {
    return c.redirect('/auth/signin');
  }
  const isAdmin = currentUser.role === 'admin';

  try {
    const formData = await c.req.formData();
    const tokenName = String(formData.get('tokenName') || '').trim();
    if (!tokenName) {
      return c.redirect('/admin/mcp-tokens?error=missing-token-name');
    }

    const requestedUserId = String(formData.get('userId') || '').trim();
    const targetUserId = isAdmin && requestedUserId ? requestedUserId : currentUser.id;
    const db = createDbWithContext(c);
    const createdToken = await createMcpToken(db, {
      userId: targetUserId,
      tokenName,
      scope: 'broad',
    });

    const layoutProps = await getCommonLayoutProps(c);
    const { tokens, usersById, manageableUsers, isAdmin: isCurrentAdmin } = await loadTokenPageData(c, currentUser);

    return c.html(
      <Layout title="MCP Tokens" currentPath="/admin/mcp-tokens" {...layoutProps}>
        <div class="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <div class="mb-6 rounded-md bg-yellow-50 p-4 text-sm text-yellow-800">
            <p class="font-semibold">Copy this token now. It will not be shown again.</p>
            <code class="mt-2 block overflow-x-auto rounded bg-yellow-100 px-3 py-2 font-mono text-xs text-yellow-900">
              {createdToken.plaintextToken}
            </code>
          </div>
          <a href="/admin/mcp-tokens" class="text-sm font-medium text-primary-600 hover:text-primary-500">
            Continue to token list →
          </a>

          <div class="mt-8 rounded-lg border border-gray-200 bg-white p-6">
            <h2 class="text-lg font-semibold text-gray-900">Existing Tokens</h2>
            {tokens.length === 0 ? (
              <p class="mt-3 text-sm text-gray-600">No tokens yet.</p>
            ) : (
              <div class="mt-4 overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200 text-sm">
                  <thead>
                    <tr class="text-left text-gray-600">
                      <th class="py-2 pr-4 font-medium">Name</th>
                      <th class="py-2 pr-4 font-medium">Owner</th>
                      <th class="py-2 pr-4 font-medium">Scope</th>
                      <th class="py-2 pr-4 font-medium">Created</th>
                      <th class="py-2 pr-4 font-medium">Last Used</th>
                      <th class="py-2 pr-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    {tokens.map((token) => {
                      const owner = usersById.get(token.userId);
                      return (
                        <tr>
                          <td class="py-2 pr-4 text-gray-900">{token.tokenName}</td>
                          <td class="py-2 pr-4 text-gray-700">{owner ? owner.name || owner.email : token.userId}</td>
                          <td class="py-2 pr-4 text-gray-700">{token.scope}</td>
                          <td class="py-2 pr-4 text-gray-700">{formatDateOrDash(token.createdAt)}</td>
                          <td class="py-2 pr-4 text-gray-700">{formatDateOrDash(token.lastUsedAt)}</td>
                          <td class="py-2 pr-4">
                            {token.revokedAt ? (
                              <span class="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">Revoked</span>
                            ) : (
                              <span class="rounded bg-green-100 px-2 py-1 text-xs text-green-700">Active</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {isCurrentAdmin && manageableUsers.length > 0 && (
            <p class="mt-4 text-xs text-gray-500">
              Admins can create/revoke tokens for all admin and contributor users.
            </p>
          )}
        </div>
      </Layout>
    );
  } catch (error) {
    console.error('Error creating MCP token:', error);
    return c.redirect('/admin/mcp-tokens?error=create-failed');
  }
});

adminMcpTokensRoutes.post('/:tokenId/revoke', async (c) => {
  const currentUser = c.get('betterUser');
  if (!currentUser) {
    return c.redirect('/auth/signin');
  }
  const tokenId = Number(c.req.param('tokenId'));

  if (Number.isNaN(tokenId) || tokenId <= 0) {
    return c.redirect('/admin/mcp-tokens?error=invalid-token-id');
  }

  try {
    const db = createDbWithContext(c);
    const token = await db
      .select({
        id: mcpTokens.id,
        userId: mcpTokens.userId,
        revokedAt: mcpTokens.revokedAt,
      })
      .from(mcpTokens)
      .where(eq(mcpTokens.id, tokenId))
      .get();

    if (!token) {
      return c.redirect('/admin/mcp-tokens?error=token-not-found');
    }

    const isAdmin = currentUser.role === 'admin';
    if (!isAdmin && token.userId !== currentUser.id) {
      return c.redirect('/admin/mcp-tokens?error=forbidden');
    }

    if (!token.revokedAt) {
      await revokeMcpToken(db, tokenId);
    }

    return c.redirect('/admin/mcp-tokens?success=revoked');
  } catch (error) {
    console.error('Error revoking MCP token:', error);
    return c.redirect('/admin/mcp-tokens?error=revoke-failed');
  }
});
