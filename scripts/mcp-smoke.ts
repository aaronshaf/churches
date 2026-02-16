#!/usr/bin/env bun

type JsonRpcRequest = {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
};

type JsonRpcError = {
  code: number;
  message: string;
  data?: unknown;
};

type JsonRpcResponse = {
  jsonrpc: '2.0';
  id: number | null;
  result?: unknown;
  error?: JsonRpcError;
};

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function pass(message: string) {
  console.log(`PASS: ${message}`);
}

function assert(condition: unknown, message: string) {
  if (!condition) {
    fail(message);
  }
}

function parseToolPayload(response: JsonRpcResponse): Record<string, unknown> {
  if (!response.result || typeof response.result !== 'object') {
    fail('Missing JSON-RPC result payload');
  }

  const result = response.result as {
    content?: Array<{ text?: string }>;
  };

  if (!result.content || !Array.isArray(result.content) || !result.content[0]?.text) {
    fail('Tool call result missing content text');
  }

  try {
    return JSON.parse(result.content[0].text) as Record<string, unknown>;
  } catch {
    fail('Tool call returned non-JSON content text');
  }
}

async function rpcCall(
  baseUrl: string,
  request: JsonRpcRequest,
  token?: string
): Promise<{ status: number; body: JsonRpcResponse }> {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(request),
  });

  const body = (await response.json()) as JsonRpcResponse;
  return { status: response.status, body };
}

function makeIdGenerator() {
  let id = 1;
  return () => id++;
}

async function main() {
  const baseUrl = (process.env.MCP_BASE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');
  const contributorToken = process.env.MCP_CONTRIBUTOR_TOKEN;
  const adminToken = process.env.MCP_ADMIN_TOKEN;
  const writeToken = contributorToken ?? adminToken;
  const writeActorLabel = contributorToken ? 'contributor' : adminToken ? 'admin' : 'none';
  const enableWrites = process.env.MCP_ENABLE_WRITES === 'true';
  const nextId = makeIdGenerator();

  console.log(`MCP smoke target: ${baseUrl}`);
  console.log(`Writes enabled: ${enableWrites ? 'yes' : 'no'}`);

  const health = await fetch(`${baseUrl}/mcp`);
  assert(health.status === 200, 'GET /mcp must return 200');
  const healthJson = (await health.json()) as { endpoint?: string; transport?: string };
  assert(healthJson.endpoint === '/mcp', 'GET /mcp endpoint must be /mcp');
  assert(healthJson.transport === 'streamable-http', 'GET /mcp transport must be streamable-http');
  pass('GET /mcp health');

  const unauthTools = await rpcCall(
    baseUrl,
    {
      jsonrpc: '2.0',
      id: nextId(),
      method: 'tools/list',
    },
    undefined
  );
  assert(unauthTools.status === 200, 'Unauth tools/list should return HTTP 200');
  const unauthToolList = ((unauthTools.body.result as { tools?: Array<{ name: string }> })?.tools || []).map(
    (tool) => tool.name
  );
  assert(unauthToolList.includes('churches_list'), 'Unauth tools/list should include read tools');
  assert(!unauthToolList.includes('churches_create'), 'Unauth tools/list should not include write tools');
  pass('Unauthenticated tools/list capabilities');

  const unauthList = await rpcCall(baseUrl, {
    jsonrpc: '2.0',
    id: nextId(),
    method: 'tools/call',
    params: {
      name: 'churches_list',
      arguments: {
        limit: 5,
        offset: 0,
      },
    },
  });
  assert(unauthList.status === 200, 'Unauth churches_list should return HTTP 200');
  assert(!unauthList.body.error, 'Unauth churches_list should not return JSON-RPC error');
  parseToolPayload(unauthList.body);
  pass('Unauthenticated churches_list call');

  if (contributorToken) {
    const contributorTools = await rpcCall(
      baseUrl,
      {
        jsonrpc: '2.0',
        id: nextId(),
        method: 'tools/list',
      },
      contributorToken
    );
    assert(contributorTools.status === 200, 'Contributor tools/list should return HTTP 200');
    const contributorToolList = (
      (contributorTools.body.result as { tools?: Array<{ name: string }> })?.tools || []
    ).map((tool) => tool.name);
    assert(contributorToolList.includes('churches_create'), 'Contributor tools/list should include write tools');
    pass('Contributor tools/list includes write tools');

    const contributorIncludeDeleted = await rpcCall(
      baseUrl,
      {
        jsonrpc: '2.0',
        id: nextId(),
        method: 'tools/call',
        params: {
          name: 'churches_list',
          arguments: {
            include_deleted: true,
            limit: 5,
            offset: 0,
          },
        },
      },
      contributorToken
    );
    assert(contributorIncludeDeleted.status === 200, 'Contributor include_deleted request should return HTTP 200');
    if (!contributorIncludeDeleted.body.error) {
      fail(
        'Contributor include_deleted was allowed. This token appears to have admin privileges; use a contributor-owned token for MCP_CONTRIBUTOR_TOKEN.'
      );
    }
    assert(
      contributorIncludeDeleted.body.error.code === -32003,
      `Contributor include_deleted must return forbidden JSON-RPC code -32003 (got ${contributorIncludeDeleted.body.error.code}: ${contributorIncludeDeleted.body.error.message})`
    );
    pass('Contributor include_deleted forbidden check');
  } else {
    console.log('SKIP: Contributor checks (MCP_CONTRIBUTOR_TOKEN not set)');
  }

  if (adminToken) {
    const adminIncludeDeleted = await rpcCall(
      baseUrl,
      {
        jsonrpc: '2.0',
        id: nextId(),
        method: 'tools/call',
        params: {
          name: 'churches_list',
          arguments: {
            include_deleted: true,
            limit: 5,
            offset: 0,
          },
        },
      },
      adminToken
    );
    assert(adminIncludeDeleted.status === 200, 'Admin include_deleted request should return HTTP 200');
    assert(!adminIncludeDeleted.body.error, 'Admin include_deleted should not return JSON-RPC error');
    parseToolPayload(adminIncludeDeleted.body);
    pass('Admin include_deleted allowed check');
  } else {
    console.log('SKIP: Admin include_deleted check (MCP_ADMIN_TOKEN not set)');
  }

  if (!enableWrites) {
    console.log('SKIP: Write checks (set MCP_ENABLE_WRITES=true to run create/update/delete/restore smoke checks)');
    console.log('DONE');
    return;
  }

  if (!writeToken) {
    fail('Writes enabled but no write token is set. Provide MCP_CONTRIBUTOR_TOKEN or MCP_ADMIN_TOKEN.');
  }

  console.log(`Write actor: ${writeActorLabel}`);

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const countyName = `MCP Smoke County ${suffix}`;
  const countyPath = `mcp-smoke-county-${suffix}`;

  const createCounty = await rpcCall(
    baseUrl,
    {
      jsonrpc: '2.0',
      id: nextId(),
      method: 'tools/call',
      params: {
        name: 'counties_create',
        arguments: {
          data: {
            name: countyName,
            path: countyPath,
            description: 'Temporary smoke-test county',
            population: 1,
          },
        },
      },
    },
    writeToken
  );
  assert(createCounty.status === 200, 'counties_create should return HTTP 200');
  assert(!createCounty.body.error, 'counties_create should not return JSON-RPC error');
  const createdCounty = parseToolPayload(createCounty.body);
  const countyId = Number(createdCounty.id);
  const countyUpdatedAt = createdCounty.updatedAt as string | undefined;
  assert(Number.isFinite(countyId), 'counties_create should return numeric id');
  assert(Boolean(countyUpdatedAt), 'counties_create should return updatedAt');
  pass('counties_create write smoke');

  const staleUpdate = await rpcCall(
    baseUrl,
    {
      jsonrpc: '2.0',
      id: nextId(),
      method: 'tools/call',
      params: {
        name: 'counties_update',
        arguments: {
          id: countyId,
          updated_at: '2020-01-01T00:00:00.000Z',
          patch: {
            description: 'stale update should conflict',
          },
        },
      },
    },
    writeToken
  );
  assert(staleUpdate.status === 409, 'Stale counties_update should return HTTP 409');
  assert(staleUpdate.body.error?.code === -32009, 'Stale counties_update should return JSON-RPC conflict -32009');
  pass('counties_update stale version conflict (409)');

  const validUpdate = await rpcCall(
    baseUrl,
    {
      jsonrpc: '2.0',
      id: nextId(),
      method: 'tools/call',
      params: {
        name: 'counties_update',
        arguments: {
          id: countyId,
          updated_at: countyUpdatedAt,
          patch: {
            description: 'Smoke test updated description',
          },
        },
      },
    },
    writeToken
  );
  assert(validUpdate.status === 200, 'Valid counties_update should return HTTP 200');
  assert(!validUpdate.body.error, 'Valid counties_update should not return JSON-RPC error');
  const updatedCounty = parseToolPayload(validUpdate.body);
  const updatedUpdatedAt = updatedCounty.updatedAt as string | undefined;
  assert(Boolean(updatedUpdatedAt), 'counties_update should return updatedAt');
  pass('counties_update happy path');

  const deleteCounty = await rpcCall(
    baseUrl,
    {
      jsonrpc: '2.0',
      id: nextId(),
      method: 'tools/call',
      params: {
        name: 'counties_delete',
        arguments: {
          id: countyId,
          updated_at: updatedUpdatedAt,
        },
      },
    },
    writeToken
  );
  assert(deleteCounty.status === 200, 'counties_delete should return HTTP 200');
  assert(!deleteCounty.body.error, 'counties_delete should not return JSON-RPC error');
  const deletedCounty = parseToolPayload(deleteCounty.body);
  const deletedUpdatedAt = deletedCounty.updatedAt as string | undefined;
  pass('counties_delete happy path');

  if (adminToken) {
    assert(Boolean(deletedUpdatedAt), 'counties_delete should return updatedAt for restore flow');

    const restoreCounty = await rpcCall(
      baseUrl,
      {
        jsonrpc: '2.0',
        id: nextId(),
        method: 'tools/call',
        params: {
          name: 'counties_restore',
          arguments: {
            id: countyId,
            updated_at: deletedUpdatedAt,
          },
        },
      },
      adminToken
    );
    assert(restoreCounty.status === 200, 'counties_restore should return HTTP 200');
    assert(!restoreCounty.body.error, 'counties_restore should not return JSON-RPC error');
    const restoredCounty = parseToolPayload(restoreCounty.body);
    const restoredUpdatedAt = restoredCounty.updatedAt as string | undefined;
    pass('counties_restore admin-only path');

    // Cleanup: delete again so smoke data is not left as active content.
    const cleanupDelete = await rpcCall(
      baseUrl,
      {
        jsonrpc: '2.0',
        id: nextId(),
        method: 'tools/call',
        params: {
          name: 'counties_delete',
          arguments: {
            id: countyId,
            updated_at: restoredUpdatedAt,
          },
        },
      },
      writeToken
    );
    assert(cleanupDelete.status === 200, 'Cleanup counties_delete should return HTTP 200');
    assert(!cleanupDelete.body.error, 'Cleanup counties_delete should not return JSON-RPC error');
    pass('Cleanup delete after restore');
  } else {
    console.log('SKIP: Restore flow (MCP_ADMIN_TOKEN not set). Created county remains soft-deleted.');
  }

  console.log('DONE');
}

await main();
