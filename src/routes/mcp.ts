import type { Context } from 'hono';
import { Hono } from 'hono';
import { createDbWithContext } from '../db';
import { resolveMcpAuthIdentity } from '../middleware/mcp-auth';
import {
  getChurchMcp,
  getCountyMcp,
  getNetworkMcp,
  listChurchesMcp,
  listCountiesMcp,
  listNetworksMcp,
  McpForbiddenError,
  McpNotFoundError,
} from '../services/mcp-read-service';
import {
  createChurchMcp,
  createCountyMcp,
  createNetworkMcp,
  deleteChurchMcp,
  deleteCountyMcp,
  deleteNetworkMcp,
  McpConflictError,
  McpValidationError,
  McpWriteForbiddenError,
  McpWriteNotFoundError,
  restoreChurchMcp,
  restoreCountyMcp,
  restoreNetworkMcp,
  updateChurchMcp,
  updateCountyMcp,
  updateNetworkMcp,
} from '../services/mcp-write-service';
import type { AuthVariables, Bindings, McpAuthIdentity } from '../types';

type JsonRpcId = number | string | null;

type JsonRpcRequest = {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method: string;
  params?: unknown;
};

type JsonRpcResponse = {
  jsonrpc: '2.0';
  id: JsonRpcId;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
};

type McpToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

const DEFAULT_PROTOCOL_VERSION = '2025-01-01';
const SERVER_INFO = {
  name: 'churches-mcp',
  version: '1.0.0',
};

const readTools: McpToolDefinition[] = [
  {
    name: 'churches_list',
    description: 'List churches with offset pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', minimum: 1, maximum: 200 },
        offset: { type: 'number', minimum: 0 },
        include_deleted: { type: 'boolean' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'churches_get',
    description: 'Get one church by id or path.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        path: { type: 'string' },
        include_deleted: { type: 'boolean' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'counties_list',
    description: 'List counties with offset pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', minimum: 1, maximum: 200 },
        offset: { type: 'number', minimum: 0 },
        include_deleted: { type: 'boolean' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'counties_get',
    description: 'Get one county by id or path.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        path: { type: 'string' },
        include_deleted: { type: 'boolean' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'networks_list',
    description: 'List networks with offset pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', minimum: 1, maximum: 200 },
        offset: { type: 'number', minimum: 0 },
        include_deleted: { type: 'boolean' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'networks_get',
    description: 'Get one network by id or path.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        path: { type: 'string' },
        include_deleted: { type: 'boolean' },
      },
      additionalProperties: false,
    },
  },
];

const writeTools: McpToolDefinition[] = [
  {
    name: 'churches_create',
    description: 'Create one church record (authenticated write tool).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: true },
  },
  {
    name: 'churches_update',
    description: 'Update one church record with optimistic concurrency (authenticated write tool).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: true },
  },
  {
    name: 'churches_delete',
    description: 'Soft delete one church record (authenticated write tool).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: true },
  },
  {
    name: 'churches_restore',
    description: 'Restore one soft-deleted church record (admin-only write tool).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: true },
  },
  {
    name: 'counties_create',
    description: 'Create one county record (authenticated write tool).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: true },
  },
  {
    name: 'counties_update',
    description: 'Update one county record with optimistic concurrency (authenticated write tool).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: true },
  },
  {
    name: 'counties_delete',
    description: 'Soft delete one county record (authenticated write tool).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: true },
  },
  {
    name: 'counties_restore',
    description: 'Restore one soft-deleted county record (admin-only write tool).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: true },
  },
  {
    name: 'networks_create',
    description: 'Create one network record (authenticated write tool).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: true },
  },
  {
    name: 'networks_update',
    description: 'Update one network record with optimistic concurrency (authenticated write tool).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: true },
  },
  {
    name: 'networks_delete',
    description: 'Soft delete one network record (authenticated write tool).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: true },
  },
  {
    name: 'networks_restore',
    description: 'Restore one soft-deleted network record (admin-only write tool).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: true },
  },
];

const mcpRoutes = new Hono<{ Bindings: Bindings; Variables: AuthVariables }>();
type McpContext = Context<{ Bindings: Bindings; Variables: AuthVariables }>;

function success(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    result,
  };
}

function error(id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      data,
    },
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  return (
    isObject(value) &&
    value.jsonrpc === '2.0' &&
    typeof value.method === 'string' &&
    (value.id === undefined || typeof value.id === 'string' || typeof value.id === 'number' || value.id === null)
  );
}

function readNumber(value: unknown, defaultValue: number, min: number, max: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return defaultValue;
  }
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function readBoolean(value: unknown, defaultValue: boolean): boolean {
  return typeof value === 'boolean' ? value : defaultValue;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readId(value: unknown): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return undefined;
  }
  if (value <= 0) {
    return undefined;
  }
  return Math.trunc(value);
}

function buildToolList(auth: McpAuthIdentity | null): McpToolDefinition[] {
  if (auth) {
    return [...readTools, ...writeTools];
  }
  return readTools;
}

function buildResourceList(auth: McpAuthIdentity | null) {
  const includeDeletedHint = auth?.role === 'admin' ? ' (supports include_deleted=true)' : '';

  return [
    {
      uri: 'churches://list',
      name: 'Churches',
      mimeType: 'application/json',
      description: `Church list resource${includeDeletedHint}.`,
    },
    {
      uri: 'counties://list',
      name: 'Counties',
      mimeType: 'application/json',
      description: `County list resource${includeDeletedHint}.`,
    },
    {
      uri: 'networks://list',
      name: 'Networks',
      mimeType: 'application/json',
      description: `Network list resource${includeDeletedHint}.`,
    },
  ];
}

function buildResourceTemplates() {
  return [
    {
      uriTemplate: 'churches://id/{id}',
      name: 'Church By ID',
      mimeType: 'application/json',
      description: 'Read a church by numeric id.',
    },
    {
      uriTemplate: 'churches://path/{path}',
      name: 'Church By Path',
      mimeType: 'application/json',
      description: 'Read a church by path slug.',
    },
    {
      uriTemplate: 'counties://id/{id}',
      name: 'County By ID',
      mimeType: 'application/json',
      description: 'Read a county by numeric id.',
    },
    {
      uriTemplate: 'counties://path/{path}',
      name: 'County By Path',
      mimeType: 'application/json',
      description: 'Read a county by path slug.',
    },
    {
      uriTemplate: 'networks://id/{id}',
      name: 'Network By ID',
      mimeType: 'application/json',
      description: 'Read a network by numeric id.',
    },
    {
      uriTemplate: 'networks://path/{path}',
      name: 'Network By Path',
      mimeType: 'application/json',
      description: 'Read a network by path slug.',
    },
  ];
}

function asToolResult(payload: unknown, isError = false) {
  return {
    isError,
    content: [
      {
        type: 'text',
        text: JSON.stringify(payload),
      },
    ],
  };
}

function ensureObjectParams(params: unknown): Record<string, unknown> {
  if (!isObject(params)) {
    return {};
  }
  return params;
}

async function handleToolsCall(c: McpContext, auth: McpAuthIdentity | null, params: unknown) {
  const db = createDbWithContext(c);
  const parsedParams = ensureObjectParams(params);
  const name = readString(parsedParams.name);
  const args = ensureObjectParams(parsedParams.arguments);

  if (!name) {
    throw new Error('tools/call requires a tool name');
  }

  const limit = readNumber(args.limit, 20, 1, 200);
  const offset = readNumber(args.offset, 0, 0, 1000000);
  const includeDeleted = readBoolean(args.include_deleted, false);
  const id = readId(args.id);
  const path = readString(args.path);
  const expectedUpdatedAt = args.updated_at ?? args.updatedAt;
  const writeIdentifier = { id, path };

  switch (name) {
    case 'churches_list': {
      const result = await listChurchesMcp(db, auth, { limit, offset, includeDeleted });
      return asToolResult(result);
    }
    case 'churches_get': {
      if (id === undefined && !path) {
        throw new Error('churches_get requires id or path');
      }
      const result = await getChurchMcp(db, auth, { id, path }, includeDeleted);
      return asToolResult(result);
    }
    case 'counties_list': {
      const result = await listCountiesMcp(db, auth, { limit, offset, includeDeleted });
      return asToolResult(result);
    }
    case 'counties_get': {
      if (id === undefined && !path) {
        throw new Error('counties_get requires id or path');
      }
      const result = await getCountyMcp(db, auth, { id, path }, includeDeleted);
      return asToolResult(result);
    }
    case 'networks_list': {
      const result = await listNetworksMcp(db, auth, { limit, offset, includeDeleted });
      return asToolResult(result);
    }
    case 'networks_get': {
      if (id === undefined && !path) {
        throw new Error('networks_get requires id or path');
      }
      const result = await getNetworkMcp(db, auth, { id, path }, includeDeleted);
      return asToolResult(result);
    }
    case 'churches_create': {
      if (!auth) {
        return asToolResult({ error: 'Authenticated MCP bearer token is required for write tools.' }, true);
      }
      const createInput = args.data ?? args;
      const result = await createChurchMcp(db, auth, createInput);
      return asToolResult(result);
    }
    case 'churches_update': {
      if (!auth) {
        return asToolResult({ error: 'Authenticated MCP bearer token is required for write tools.' }, true);
      }
      const patchInput = args.patch ?? args.data ?? args;
      const result = await updateChurchMcp(db, auth, writeIdentifier, expectedUpdatedAt, patchInput);
      return asToolResult(result);
    }
    case 'churches_delete': {
      if (!auth) {
        return asToolResult({ error: 'Authenticated MCP bearer token is required for write tools.' }, true);
      }
      const result = await deleteChurchMcp(db, auth, writeIdentifier, expectedUpdatedAt);
      return asToolResult(result);
    }
    case 'churches_restore': {
      if (!auth) {
        return asToolResult({ error: 'Authenticated MCP bearer token is required for write tools.' }, true);
      }
      const result = await restoreChurchMcp(db, auth, writeIdentifier, expectedUpdatedAt);
      return asToolResult(result);
    }
    case 'counties_create': {
      if (!auth) {
        return asToolResult({ error: 'Authenticated MCP bearer token is required for write tools.' }, true);
      }
      const createInput = args.data ?? args;
      const result = await createCountyMcp(db, auth, createInput);
      return asToolResult(result);
    }
    case 'counties_update': {
      if (!auth) {
        return asToolResult({ error: 'Authenticated MCP bearer token is required for write tools.' }, true);
      }
      const patchInput = args.patch ?? args.data ?? args;
      const result = await updateCountyMcp(db, auth, writeIdentifier, expectedUpdatedAt, patchInput);
      return asToolResult(result);
    }
    case 'counties_delete': {
      if (!auth) {
        return asToolResult({ error: 'Authenticated MCP bearer token is required for write tools.' }, true);
      }
      const result = await deleteCountyMcp(db, auth, writeIdentifier, expectedUpdatedAt);
      return asToolResult(result);
    }
    case 'counties_restore': {
      if (!auth) {
        return asToolResult({ error: 'Authenticated MCP bearer token is required for write tools.' }, true);
      }
      const result = await restoreCountyMcp(db, auth, writeIdentifier, expectedUpdatedAt);
      return asToolResult(result);
    }
    case 'networks_create': {
      if (!auth) {
        return asToolResult({ error: 'Authenticated MCP bearer token is required for write tools.' }, true);
      }
      const createInput = args.data ?? args;
      const result = await createNetworkMcp(db, auth, createInput);
      return asToolResult(result);
    }
    case 'networks_update': {
      if (!auth) {
        return asToolResult({ error: 'Authenticated MCP bearer token is required for write tools.' }, true);
      }
      const patchInput = args.patch ?? args.data ?? args;
      const result = await updateNetworkMcp(db, auth, writeIdentifier, expectedUpdatedAt, patchInput);
      return asToolResult(result);
    }
    case 'networks_delete': {
      if (!auth) {
        return asToolResult({ error: 'Authenticated MCP bearer token is required for write tools.' }, true);
      }
      const result = await deleteNetworkMcp(db, auth, writeIdentifier, expectedUpdatedAt);
      return asToolResult(result);
    }
    case 'networks_restore': {
      if (!auth) {
        return asToolResult({ error: 'Authenticated MCP bearer token is required for write tools.' }, true);
      }
      const result = await restoreNetworkMcp(db, auth, writeIdentifier, expectedUpdatedAt);
      return asToolResult(result);
    }
  }

  throw new Error(`Unknown tool: ${name}`);
}

async function handleResourceRead(c: McpContext, auth: McpAuthIdentity | null, params: unknown) {
  const db = createDbWithContext(c);
  const parsedParams = ensureObjectParams(params);
  const uri = readString(parsedParams.uri);
  if (!uri) {
    throw new Error('resources/read requires uri');
  }

  const parsedUrl = new URL(uri);
  const entity = parsedUrl.protocol.replace(':', '');
  const mode = parsedUrl.hostname;
  const includeDeleted = parsedUrl.searchParams.get('include_deleted') === 'true';
  const limit = readNumber(Number(parsedUrl.searchParams.get('limit')), 20, 1, 200);
  const offset = readNumber(Number(parsedUrl.searchParams.get('offset')), 0, 0, 1000000);

  let payload: unknown;
  if (entity === 'churches' && mode === 'list') {
    payload = await listChurchesMcp(db, auth, { limit, offset, includeDeleted });
  } else if (entity === 'counties' && mode === 'list') {
    payload = await listCountiesMcp(db, auth, { limit, offset, includeDeleted });
  } else if (entity === 'networks' && mode === 'list') {
    payload = await listNetworksMcp(db, auth, { limit, offset, includeDeleted });
  } else if (mode === 'id' || mode === 'path') {
    const key = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ''));
    if (!key) {
      throw new Error('resources/read id/path uri must contain a value');
    }

    if (entity === 'churches') {
      payload =
        mode === 'id'
          ? await getChurchMcp(db, auth, { id: readId(Number(key)) }, includeDeleted)
          : await getChurchMcp(db, auth, { path: key }, includeDeleted);
    } else if (entity === 'counties') {
      payload =
        mode === 'id'
          ? await getCountyMcp(db, auth, { id: readId(Number(key)) }, includeDeleted)
          : await getCountyMcp(db, auth, { path: key }, includeDeleted);
    } else if (entity === 'networks') {
      payload =
        mode === 'id'
          ? await getNetworkMcp(db, auth, { id: readId(Number(key)) }, includeDeleted)
          : await getNetworkMcp(db, auth, { path: key }, includeDeleted);
    } else {
      throw new Error(`Unsupported resource entity: ${entity}`);
    }
  } else {
    throw new Error(`Unsupported resource uri: ${uri}`);
  }

  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(payload),
      },
    ],
  };
}

async function handleRequest(
  c: McpContext,
  auth: McpAuthIdentity | null,
  request: JsonRpcRequest
): Promise<JsonRpcResponse | null> {
  const id = request.id ?? null;
  const isNotification = request.id === undefined;

  try {
    switch (request.method) {
      case 'initialize': {
        const params = ensureObjectParams(request.params);
        const requestedProtocolVersion = readString(params.protocolVersion);
        const protocolVersion = requestedProtocolVersion ?? DEFAULT_PROTOCOL_VERSION;

        if (isNotification) {
          return null;
        }

        return success(id, {
          protocolVersion,
          capabilities: {
            tools: {
              listChanged: false,
            },
            resources: {
              listChanged: false,
              subscribe: false,
            },
          },
          serverInfo: SERVER_INFO,
        });
      }
      case 'notifications/initialized': {
        if (isNotification) {
          return null;
        }
        return success(id, {});
      }
      case 'ping': {
        if (isNotification) {
          return null;
        }
        return success(id, {});
      }
      case 'tools/list': {
        if (isNotification) {
          return null;
        }
        return success(id, { tools: buildToolList(auth) });
      }
      case 'tools/call': {
        if (isNotification) {
          return null;
        }
        const result = await handleToolsCall(c, auth, request.params);
        return success(id, result);
      }
      case 'resources/list': {
        if (isNotification) {
          return null;
        }
        return success(id, { resources: buildResourceList(auth) });
      }
      case 'resources/templates/list': {
        if (isNotification) {
          return null;
        }
        return success(id, { resourceTemplates: buildResourceTemplates() });
      }
      case 'resources/read': {
        if (isNotification) {
          return null;
        }
        const result = await handleResourceRead(c, auth, request.params);
        return success(id, result);
      }
      default:
        if (isNotification) {
          return null;
        }
        return error(id, -32601, `Method not found: ${request.method}`);
    }
  } catch (err) {
    if (isNotification) {
      return null;
    }

    if (err instanceof McpForbiddenError) {
      return error(id, -32003, err.message);
    }

    if (err instanceof McpNotFoundError) {
      return error(id, -32004, err.message);
    }

    if (err instanceof McpWriteForbiddenError) {
      return error(id, -32003, err.message);
    }

    if (err instanceof McpWriteNotFoundError) {
      return error(id, -32004, err.message);
    }

    if (err instanceof McpConflictError) {
      return error(id, -32009, err.message, { statusCode: 409 });
    }

    if (err instanceof McpValidationError) {
      return error(id, -32602, err.message);
    }

    if (err instanceof Error) {
      return error(id, -32602, err.message);
    }

    return error(id, -32603, 'Internal MCP error');
  }
}

mcpRoutes.get('*', async (c) => {
  const authResolution = await resolveMcpAuthIdentity(c, {
    required: false,
    touchLastUsed: true,
  });
  if (authResolution.response) {
    return authResolution.response;
  }

  return c.json({
    endpoint: '/mcp',
    transport: 'streamable-http',
    authenticated: Boolean(authResolution.identity),
  });
});

mcpRoutes.post('*', async (c) => {
  const authResolution = await resolveMcpAuthIdentity(c, {
    required: false,
    touchLastUsed: true,
  });
  if (authResolution.response) {
    return authResolution.response;
  }
  const auth = authResolution.identity;

  let payload: unknown;
  try {
    payload = await c.req.json();
  } catch {
    return c.json(error(null, -32700, 'Parse error'), 400);
  }

  const requests = Array.isArray(payload) ? payload : [payload];
  if (requests.length === 0) {
    return c.json(error(null, -32600, 'Invalid Request'), 400);
  }

  const responses: JsonRpcResponse[] = [];
  for (const request of requests) {
    if (!isJsonRpcRequest(request)) {
      responses.push(error(null, -32600, 'Invalid Request'));
      continue;
    }

    const response = await handleRequest(c, auth, request);
    if (response) {
      responses.push(response);
    }
  }

  if (responses.length === 0) {
    return c.body(null, 202);
  }

  if (Array.isArray(payload)) {
    return c.json(responses);
  }

  const first = responses[0];
  if (
    first.error?.data &&
    typeof first.error.data === 'object' &&
    (first.error.data as { statusCode?: number }).statusCode === 409
  ) {
    return c.json(first, 409);
  }

  return c.json(first);
});

export { mcpRoutes };
