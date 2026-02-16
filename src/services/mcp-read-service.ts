import { and, eq, isNull, type SQL } from 'drizzle-orm';
import type { DbType } from '../db';
import { affiliations, churches, counties } from '../db/schema';
import type { McpAuthIdentity } from '../types';

export class McpForbiddenError extends Error {}
export class McpNotFoundError extends Error {}

type EntityIdentifier = {
  id?: number;
  path?: string;
};

type ListQuery = {
  limit: number;
  offset: number;
  includeDeleted: boolean;
};

function combineWhere(filters: Array<SQL<unknown> | undefined>): SQL<unknown> | undefined {
  const activeFilters = filters.filter((filter): filter is SQL<unknown> => filter !== undefined);
  if (activeFilters.length === 0) {
    return undefined;
  }
  if (activeFilters.length === 1) {
    return activeFilters[0];
  }
  return and(...activeFilters);
}

function assertIncludeDeletedAccess(auth: McpAuthIdentity | null, includeDeleted: boolean) {
  if (includeDeleted && auth?.role !== 'admin') {
    throw new McpForbiddenError('Only admins can include deleted records');
  }
}

function canReadNonPublic(auth: McpAuthIdentity | null): boolean {
  return Boolean(auth);
}

function getBaseVisibilityFilters(
  auth: McpAuthIdentity | null,
  includeDeleted: boolean
): {
  includeNonPublic: boolean;
  includeDeleted: boolean;
} {
  assertIncludeDeletedAccess(auth, includeDeleted);
  return {
    includeNonPublic: canReadNonPublic(auth),
    includeDeleted,
  };
}

export async function listChurchesMcp(db: DbType, auth: McpAuthIdentity | null, query: ListQuery) {
  const { includeDeleted, includeNonPublic } = getBaseVisibilityFilters(auth, query.includeDeleted);
  const where = combineWhere([
    includeDeleted ? undefined : isNull(churches.deletedAt),
    includeNonPublic ? undefined : eq(churches.status, 'Listed'),
  ]);

  if (includeNonPublic) {
    const items = await db.select().from(churches).where(where).limit(query.limit).offset(query.offset).all();
    return { items, limit: query.limit, offset: query.offset };
  }

  const items = await db
    .select({
      id: churches.id,
      name: churches.name,
      path: churches.path,
      status: churches.status,
      gatheringAddress: churches.gatheringAddress,
      website: churches.website,
    })
    .from(churches)
    .where(where)
    .limit(query.limit)
    .offset(query.offset)
    .all();

  return { items, limit: query.limit, offset: query.offset };
}

export async function getChurchMcp(
  db: DbType,
  auth: McpAuthIdentity | null,
  identifier: EntityIdentifier,
  includeDeleted: boolean
) {
  const identifierFilter =
    identifier.id !== undefined
      ? eq(churches.id, identifier.id)
      : identifier.path !== undefined
        ? eq(churches.path, identifier.path)
        : undefined;
  if (!identifierFilter) {
    throw new Error('Either id or path is required');
  }

  const { includeDeleted: allowDeleted, includeNonPublic } = getBaseVisibilityFilters(auth, includeDeleted);
  const where = combineWhere([
    identifierFilter,
    allowDeleted ? undefined : isNull(churches.deletedAt),
    includeNonPublic ? undefined : eq(churches.status, 'Listed'),
  ]);

  if (includeNonPublic) {
    const item = await db.select().from(churches).where(where).get();
    if (!item) {
      throw new McpNotFoundError('Church not found');
    }
    return item;
  }

  const item = await db
    .select({
      id: churches.id,
      name: churches.name,
      path: churches.path,
      status: churches.status,
      gatheringAddress: churches.gatheringAddress,
      website: churches.website,
    })
    .from(churches)
    .where(where)
    .get();

  if (!item) {
    throw new McpNotFoundError('Church not found');
  }

  return item;
}

export async function listCountiesMcp(db: DbType, auth: McpAuthIdentity | null, query: ListQuery) {
  const { includeDeleted, includeNonPublic } = getBaseVisibilityFilters(auth, query.includeDeleted);
  const where = combineWhere([includeDeleted ? undefined : isNull(counties.deletedAt)]);

  if (includeNonPublic) {
    const items = await db.select().from(counties).where(where).limit(query.limit).offset(query.offset).all();
    return { items, limit: query.limit, offset: query.offset };
  }

  const items = await db
    .select({
      id: counties.id,
      name: counties.name,
      path: counties.path,
      description: counties.description,
      population: counties.population,
    })
    .from(counties)
    .where(where)
    .limit(query.limit)
    .offset(query.offset)
    .all();

  return { items, limit: query.limit, offset: query.offset };
}

export async function getCountyMcp(
  db: DbType,
  auth: McpAuthIdentity | null,
  identifier: EntityIdentifier,
  includeDeleted: boolean
) {
  const identifierFilter =
    identifier.id !== undefined
      ? eq(counties.id, identifier.id)
      : identifier.path !== undefined
        ? eq(counties.path, identifier.path)
        : undefined;
  if (!identifierFilter) {
    throw new Error('Either id or path is required');
  }

  const { includeDeleted: allowDeleted, includeNonPublic } = getBaseVisibilityFilters(auth, includeDeleted);
  const where = combineWhere([identifierFilter, allowDeleted ? undefined : isNull(counties.deletedAt)]);

  if (includeNonPublic) {
    const item = await db.select().from(counties).where(where).get();
    if (!item) {
      throw new McpNotFoundError('County not found');
    }
    return item;
  }

  const item = await db
    .select({
      id: counties.id,
      name: counties.name,
      path: counties.path,
      description: counties.description,
      population: counties.population,
    })
    .from(counties)
    .where(where)
    .get();

  if (!item) {
    throw new McpNotFoundError('County not found');
  }

  return item;
}

export async function listNetworksMcp(db: DbType, auth: McpAuthIdentity | null, query: ListQuery) {
  const { includeDeleted, includeNonPublic } = getBaseVisibilityFilters(auth, query.includeDeleted);
  const where = combineWhere([
    includeDeleted ? undefined : isNull(affiliations.deletedAt),
    includeNonPublic ? undefined : eq(affiliations.status, 'Listed'),
  ]);

  if (includeNonPublic) {
    const items = await db.select().from(affiliations).where(where).limit(query.limit).offset(query.offset).all();
    return { items, limit: query.limit, offset: query.offset };
  }

  const items = await db
    .select({
      id: affiliations.id,
      name: affiliations.name,
      path: affiliations.path,
      status: affiliations.status,
      website: affiliations.website,
      publicNotes: affiliations.publicNotes,
    })
    .from(affiliations)
    .where(where)
    .limit(query.limit)
    .offset(query.offset)
    .all();

  return { items, limit: query.limit, offset: query.offset };
}

export async function getNetworkMcp(
  db: DbType,
  auth: McpAuthIdentity | null,
  identifier: EntityIdentifier,
  includeDeleted: boolean
) {
  const identifierFilter =
    identifier.id !== undefined
      ? eq(affiliations.id, identifier.id)
      : identifier.path !== undefined
        ? eq(affiliations.path, identifier.path)
        : undefined;
  if (!identifierFilter) {
    throw new Error('Either id or path is required');
  }

  const { includeDeleted: allowDeleted, includeNonPublic } = getBaseVisibilityFilters(auth, includeDeleted);
  const where = combineWhere([
    identifierFilter,
    allowDeleted ? undefined : isNull(affiliations.deletedAt),
    includeNonPublic ? undefined : eq(affiliations.status, 'Listed'),
  ]);

  if (includeNonPublic) {
    const item = await db.select().from(affiliations).where(where).get();
    if (!item) {
      throw new McpNotFoundError('Network not found');
    }
    return item;
  }

  const item = await db
    .select({
      id: affiliations.id,
      name: affiliations.name,
      path: affiliations.path,
      status: affiliations.status,
      website: affiliations.website,
      publicNotes: affiliations.publicNotes,
    })
    .from(affiliations)
    .where(where)
    .get();

  if (!item) {
    throw new McpNotFoundError('Network not found');
  }

  return item;
}
