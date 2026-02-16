import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import type { DbType } from '../db';
import { affiliations, churches, churchAffiliations, counties, mcpWriteAudit } from '../db/schema';
import type { McpAuthIdentity } from '../types';
import { compareObjects } from '../utils/audit-trail';

export class McpValidationError extends Error {}
export class McpConflictError extends Error {}
export class McpWriteNotFoundError extends Error {}
export class McpWriteForbiddenError extends Error {}

type EntityIdentifier = {
  id?: number;
  path?: string;
};

type ChurchMutableFields = Partial<Omit<typeof churches.$inferInsert, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>>;
type CountyMutableFields = Partial<Omit<typeof counties.$inferInsert, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>>;
type NetworkMutableFields = Partial<
  Omit<typeof affiliations.$inferInsert, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
>;

const churchMutableKeys = [
  'name',
  'path',
  'status',
  'privateNotes',
  'publicNotes',
  'lastUpdated',
  'gatheringAddress',
  'mailingAddress',
  'latitude',
  'longitude',
  'countyId',
  'website',
  'statementOfFaith',
  'phone',
  'email',
  'facebook',
  'instagram',
  'youtube',
  'spotify',
  'language',
  'imagePath',
  'imageAlt',
] as const;

const countyMutableKeys = ['name', 'path', 'description', 'population', 'imagePath', 'imageAlt'] as const;
const networkMutableKeys = ['name', 'path', 'status', 'website', 'privateNotes', 'publicNotes'] as const;

function ensureObject(input: unknown, message: string): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new McpValidationError(message);
  }
  return input as Record<string, unknown>;
}

function parseExpectedUpdatedAt(input: unknown): Date {
  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    return input;
  }

  if (typeof input === 'number' && Number.isFinite(input)) {
    const normalized = input < 1_000_000_000_000 ? input * 1000 : input;
    const date = new Date(normalized);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  if (typeof input === 'string') {
    const date = new Date(input);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  throw new McpValidationError('updated_at is required and must be a valid date');
}

function assertVersionMatch(currentUpdatedAt: Date, expectedUpdatedAt: Date) {
  if (currentUpdatedAt.getTime() !== expectedUpdatedAt.getTime()) {
    throw new McpConflictError('Version mismatch: updated_at does not match current record version');
  }
}

function pickMutableFields<T extends Record<string, unknown>>(
  source: Record<string, unknown>,
  keys: readonly string[]
): Partial<T> {
  const picked: Record<string, unknown> = {};
  for (const key of keys) {
    if (Object.hasOwn(source, key)) {
      picked[key] = source[key];
    }
  }
  return picked as Partial<T>;
}

function assertIdentifier(identifier: EntityIdentifier) {
  if (identifier.id === undefined && identifier.path === undefined) {
    throw new McpValidationError('Either id or path is required');
  }
}

async function insertWriteAudit(
  db: DbType,
  auth: McpAuthIdentity,
  action: string,
  entity: 'churches' | 'counties' | 'networks' | 'church_affiliations',
  recordId: number,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
) {
  const changes = compareObjects(before, after);
  await db
    .insert(mcpWriteAudit)
    .values({
      userId: auth.userId,
      tokenId: auth.tokenId ?? null, // Null for session-based auth
      sessionId: auth.sessionId ?? null, // Null for token-based auth
      action,
      entity,
      recordId,
      diff: changes.length > 0 ? JSON.stringify(changes) : null,
    })
    .run();
}

async function getChurchForWrite(db: DbType, identifier: EntityIdentifier, includeDeleted: boolean) {
  assertIdentifier(identifier);
  const identifierFilter =
    identifier.id !== undefined ? eq(churches.id, identifier.id) : eq(churches.path, identifier.path!);
  const where = includeDeleted ? identifierFilter : and(identifierFilter, isNull(churches.deletedAt));
  const row = await db.select().from(churches).where(where).get();
  if (!row) {
    throw new McpWriteNotFoundError('Church not found');
  }
  return row;
}

async function getCountyForWrite(db: DbType, identifier: EntityIdentifier, includeDeleted: boolean) {
  assertIdentifier(identifier);
  const identifierFilter =
    identifier.id !== undefined ? eq(counties.id, identifier.id) : eq(counties.path, identifier.path!);
  const where = includeDeleted ? identifierFilter : and(identifierFilter, isNull(counties.deletedAt));
  const row = await db.select().from(counties).where(where).get();
  if (!row) {
    throw new McpWriteNotFoundError('County not found');
  }
  return row;
}

async function getNetworkForWrite(db: DbType, identifier: EntityIdentifier, includeDeleted: boolean) {
  assertIdentifier(identifier);
  const identifierFilter =
    identifier.id !== undefined ? eq(affiliations.id, identifier.id) : eq(affiliations.path, identifier.path!);
  const where = includeDeleted ? identifierFilter : and(identifierFilter, isNull(affiliations.deletedAt));
  const row = await db.select().from(affiliations).where(where).get();
  if (!row) {
    throw new McpWriteNotFoundError('Network not found');
  }
  return row;
}

export async function createChurchMcp(db: DbType, auth: McpAuthIdentity, input: unknown) {
  const rawData = ensureObject(input, 'churches_create requires a data object');
  const values = pickMutableFields<ChurchMutableFields>(rawData, churchMutableKeys);
  if (typeof values.name !== 'string' || values.name.trim().length === 0) {
    throw new McpValidationError('churches_create requires name');
  }
  const now = new Date();
  const insertValues: typeof churches.$inferInsert = {
    ...values,
    name: values.name.trim(),
    createdAt: now,
    updatedAt: now,
  };

  const [created] = await db.insert(churches).values(insertValues).returning();
  await insertWriteAudit(db, auth, 'create', 'churches', created.id, null, created as Record<string, unknown>);
  return created;
}

export async function updateChurchMcp(
  db: DbType,
  auth: McpAuthIdentity,
  identifier: EntityIdentifier,
  expectedUpdatedAtInput: unknown,
  patchInput: unknown
) {
  const current = await getChurchForWrite(db, identifier, false);
  const expectedUpdatedAt = parseExpectedUpdatedAt(expectedUpdatedAtInput);
  assertVersionMatch(current.updatedAt, expectedUpdatedAt);

  const patch = ensureObject(patchInput, 'churches_update requires a patch object');
  const updateFields = pickMutableFields<ChurchMutableFields>(patch, churchMutableKeys);
  if (Object.keys(updateFields).length === 0) {
    throw new McpValidationError('churches_update patch must include at least one mutable field');
  }

  const [updated] = await db
    .update(churches)
    .set({ ...updateFields, updatedAt: new Date() })
    .where(eq(churches.id, current.id))
    .returning();

  await insertWriteAudit(
    db,
    auth,
    'update',
    'churches',
    current.id,
    current as Record<string, unknown>,
    updated as Record<string, unknown>
  );
  return updated;
}

export async function deleteChurchMcp(
  db: DbType,
  auth: McpAuthIdentity,
  identifier: EntityIdentifier,
  expectedUpdatedAtInput: unknown
) {
  const current = await getChurchForWrite(db, identifier, false);
  const expectedUpdatedAt = parseExpectedUpdatedAt(expectedUpdatedAtInput);
  assertVersionMatch(current.updatedAt, expectedUpdatedAt);

  const [deleted] = await db
    .update(churches)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(churches.id, current.id), isNull(churches.deletedAt)))
    .returning();

  await insertWriteAudit(
    db,
    auth,
    'delete',
    'churches',
    current.id,
    current as Record<string, unknown>,
    deleted as Record<string, unknown>
  );
  return deleted;
}

export async function restoreChurchMcp(
  db: DbType,
  auth: McpAuthIdentity,
  identifier: EntityIdentifier,
  expectedUpdatedAtInput: unknown
) {
  if (auth.role !== 'admin') {
    throw new McpWriteForbiddenError('Only admins can restore deleted churches');
  }

  const row = await getChurchForWrite(db, identifier, true);
  if (!row.deletedAt) {
    throw new McpValidationError('Church is not deleted');
  }

  const expectedUpdatedAt = parseExpectedUpdatedAt(expectedUpdatedAtInput);
  assertVersionMatch(row.updatedAt, expectedUpdatedAt);

  const [restored] = await db
    .update(churches)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(and(eq(churches.id, row.id), isNotNull(churches.deletedAt)))
    .returning();

  await insertWriteAudit(
    db,
    auth,
    'restore',
    'churches',
    row.id,
    row as Record<string, unknown>,
    restored as Record<string, unknown>
  );
  return restored;
}

export async function createCountyMcp(db: DbType, auth: McpAuthIdentity, input: unknown) {
  const rawData = ensureObject(input, 'counties_create requires a data object');
  const values = pickMutableFields<CountyMutableFields>(rawData, countyMutableKeys);
  if (typeof values.name !== 'string' || values.name.trim().length === 0) {
    throw new McpValidationError('counties_create requires name');
  }
  const now = new Date();
  const insertValues: typeof counties.$inferInsert = {
    ...values,
    name: values.name.trim(),
    createdAt: now,
    updatedAt: now,
  };

  const [created] = await db.insert(counties).values(insertValues).returning();
  await insertWriteAudit(db, auth, 'create', 'counties', created.id, null, created as Record<string, unknown>);
  return created;
}

export async function updateCountyMcp(
  db: DbType,
  auth: McpAuthIdentity,
  identifier: EntityIdentifier,
  expectedUpdatedAtInput: unknown,
  patchInput: unknown
) {
  const current = await getCountyForWrite(db, identifier, false);
  const expectedUpdatedAt = parseExpectedUpdatedAt(expectedUpdatedAtInput);
  assertVersionMatch(current.updatedAt, expectedUpdatedAt);

  const patch = ensureObject(patchInput, 'counties_update requires a patch object');
  const updateFields = pickMutableFields<CountyMutableFields>(patch, countyMutableKeys);
  if (Object.keys(updateFields).length === 0) {
    throw new McpValidationError('counties_update patch must include at least one mutable field');
  }

  const [updated] = await db
    .update(counties)
    .set({ ...updateFields, updatedAt: new Date() })
    .where(eq(counties.id, current.id))
    .returning();

  await insertWriteAudit(
    db,
    auth,
    'update',
    'counties',
    current.id,
    current as Record<string, unknown>,
    updated as Record<string, unknown>
  );
  return updated;
}

export async function deleteCountyMcp(
  db: DbType,
  auth: McpAuthIdentity,
  identifier: EntityIdentifier,
  expectedUpdatedAtInput: unknown
) {
  const current = await getCountyForWrite(db, identifier, false);
  const expectedUpdatedAt = parseExpectedUpdatedAt(expectedUpdatedAtInput);
  assertVersionMatch(current.updatedAt, expectedUpdatedAt);

  const [deleted] = await db
    .update(counties)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(counties.id, current.id), isNull(counties.deletedAt)))
    .returning();

  await insertWriteAudit(
    db,
    auth,
    'delete',
    'counties',
    current.id,
    current as Record<string, unknown>,
    deleted as Record<string, unknown>
  );
  return deleted;
}

export async function restoreCountyMcp(
  db: DbType,
  auth: McpAuthIdentity,
  identifier: EntityIdentifier,
  expectedUpdatedAtInput: unknown
) {
  if (auth.role !== 'admin') {
    throw new McpWriteForbiddenError('Only admins can restore deleted counties');
  }

  const row = await getCountyForWrite(db, identifier, true);
  if (!row.deletedAt) {
    throw new McpValidationError('County is not deleted');
  }

  const expectedUpdatedAt = parseExpectedUpdatedAt(expectedUpdatedAtInput);
  assertVersionMatch(row.updatedAt, expectedUpdatedAt);

  const [restored] = await db
    .update(counties)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(and(eq(counties.id, row.id), isNotNull(counties.deletedAt)))
    .returning();

  await insertWriteAudit(
    db,
    auth,
    'restore',
    'counties',
    row.id,
    row as Record<string, unknown>,
    restored as Record<string, unknown>
  );
  return restored;
}

export async function createNetworkMcp(db: DbType, auth: McpAuthIdentity, input: unknown) {
  const rawData = ensureObject(input, 'networks_create requires a data object');
  const values = pickMutableFields<NetworkMutableFields>(rawData, networkMutableKeys);
  if (typeof values.name !== 'string' || values.name.trim().length === 0) {
    throw new McpValidationError('networks_create requires name');
  }
  const now = new Date();
  const insertValues: typeof affiliations.$inferInsert = {
    ...values,
    name: values.name.trim(),
    createdAt: now,
    updatedAt: now,
  };

  const [created] = await db.insert(affiliations).values(insertValues).returning();
  await insertWriteAudit(db, auth, 'create', 'networks', created.id, null, created as Record<string, unknown>);
  return created;
}

export async function updateNetworkMcp(
  db: DbType,
  auth: McpAuthIdentity,
  identifier: EntityIdentifier,
  expectedUpdatedAtInput: unknown,
  patchInput: unknown
) {
  const current = await getNetworkForWrite(db, identifier, false);
  const expectedUpdatedAt = parseExpectedUpdatedAt(expectedUpdatedAtInput);
  assertVersionMatch(current.updatedAt, expectedUpdatedAt);

  const patch = ensureObject(patchInput, 'networks_update requires a patch object');
  const updateFields = pickMutableFields<NetworkMutableFields>(patch, networkMutableKeys);
  if (Object.keys(updateFields).length === 0) {
    throw new McpValidationError('networks_update patch must include at least one mutable field');
  }

  const [updated] = await db
    .update(affiliations)
    .set({ ...updateFields, updatedAt: new Date() })
    .where(eq(affiliations.id, current.id))
    .returning();

  await insertWriteAudit(
    db,
    auth,
    'update',
    'networks',
    current.id,
    current as Record<string, unknown>,
    updated as Record<string, unknown>
  );
  return updated;
}

export async function deleteNetworkMcp(
  db: DbType,
  auth: McpAuthIdentity,
  identifier: EntityIdentifier,
  expectedUpdatedAtInput: unknown
) {
  const current = await getNetworkForWrite(db, identifier, false);
  const expectedUpdatedAt = parseExpectedUpdatedAt(expectedUpdatedAtInput);
  assertVersionMatch(current.updatedAt, expectedUpdatedAt);

  const [deleted] = await db
    .update(affiliations)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(affiliations.id, current.id), isNull(affiliations.deletedAt)))
    .returning();

  await insertWriteAudit(
    db,
    auth,
    'delete',
    'networks',
    current.id,
    current as Record<string, unknown>,
    deleted as Record<string, unknown>
  );
  return deleted;
}

export async function restoreNetworkMcp(
  db: DbType,
  auth: McpAuthIdentity,
  identifier: EntityIdentifier,
  expectedUpdatedAtInput: unknown
) {
  if (auth.role !== 'admin') {
    throw new McpWriteForbiddenError('Only admins can restore deleted networks');
  }

  const row = await getNetworkForWrite(db, identifier, true);
  if (!row.deletedAt) {
    throw new McpValidationError('Network is not deleted');
  }

  const expectedUpdatedAt = parseExpectedUpdatedAt(expectedUpdatedAtInput);
  assertVersionMatch(row.updatedAt, expectedUpdatedAt);

  const [restored] = await db
    .update(affiliations)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(and(eq(affiliations.id, row.id), isNotNull(affiliations.deletedAt)))
    .returning();

  await insertWriteAudit(
    db,
    auth,
    'restore',
    'networks',
    row.id,
    row as Record<string, unknown>,
    restored as Record<string, unknown>
  );
  return restored;
}

export async function listChurchAffiliationsMcp(db: DbType, _auth: McpAuthIdentity | null, identifier: EntityIdentifier) {
  const church = await getChurchForWrite(db, identifier, false);

  const result = await db
    .select({
      id: affiliations.id,
      name: affiliations.name,
      path: affiliations.path,
      status: affiliations.status,
    })
    .from(churchAffiliations)
    .innerJoin(affiliations, eq(churchAffiliations.affiliationId, affiliations.id))
    .where(and(eq(churchAffiliations.churchId, church.id), isNull(affiliations.deletedAt)))
    .all();

  return result;
}

export async function setChurchAffiliationsMcp(
  db: DbType,
  auth: McpAuthIdentity,
  identifier: EntityIdentifier,
  expectedUpdatedAtInput: unknown,
  affiliationIdsInput: unknown
) {
  const church = await getChurchForWrite(db, identifier, false);
  const expectedUpdatedAt = parseExpectedUpdatedAt(expectedUpdatedAtInput);
  assertVersionMatch(church.updatedAt, expectedUpdatedAt);

  // Validate and parse affiliation IDs
  if (!Array.isArray(affiliationIdsInput)) {
    throw new McpValidationError('affiliation_ids must be an array');
  }
  const affiliationIds = affiliationIdsInput.map((id) => {
    if (typeof id !== 'number' || id <= 0 || !Number.isInteger(id)) {
      throw new McpValidationError('affiliation_ids must contain positive integers');
    }
    return id;
  });

  // Get current affiliations
  const currentAffiliations = await db
    .select({ affiliationId: churchAffiliations.affiliationId })
    .from(churchAffiliations)
    .where(eq(churchAffiliations.churchId, church.id))
    .all();

  const currentIds = currentAffiliations.map((ca) => ca.affiliationId);

  // Calculate changes
  const toAdd = affiliationIds.filter((id) => !currentIds.includes(id));
  const toRemove = currentIds.filter((id) => !affiliationIds.includes(id));

  // Execute changes
  if (toAdd.length > 0) {
    const newAffiliations = toAdd.map((affiliationId) => ({
      churchId: church.id,
      affiliationId,
    }));
    await db.insert(churchAffiliations).values(newAffiliations).run();
  }

  if (toRemove.length > 0) {
    await db
      .delete(churchAffiliations)
      .where(and(eq(churchAffiliations.churchId, church.id), inArray(churchAffiliations.affiliationId, toRemove)))
      .run();
  }

  // Update church timestamp (version bump)
  await db.update(churches).set({ updatedAt: new Date() }).where(eq(churches.id, church.id)).run();

  // Write audit log with before/after affiliation IDs
  await insertWriteAudit(
    db,
    auth,
    'set_affiliations',
    'church_affiliations',
    church.id,
    { affiliations: currentIds },
    { affiliations: affiliationIds }
  );

  return {
    churchId: church.id,
    added: toAdd,
    removed: toRemove,
    current: affiliationIds,
  };
}

export async function addChurchAffiliationMcp(
  db: DbType,
  auth: McpAuthIdentity,
  identifier: EntityIdentifier,
  expectedUpdatedAtInput: unknown,
  affiliationIdInput: unknown
) {
  if (typeof affiliationIdInput !== 'number' || affiliationIdInput <= 0 || !Number.isInteger(affiliationIdInput)) {
    throw new McpValidationError('affiliation_id must be a positive integer');
  }

  const affiliationId = affiliationIdInput;

  // Get current affiliations
  const current = await listChurchAffiliationsMcp(db, auth, identifier);
  const currentIds = current.map((a) => a.id);

  // Add new ID if not present (idempotent)
  const newIds = currentIds.includes(affiliationId) ? currentIds : [...currentIds, affiliationId];

  // Use set operation
  const result = await setChurchAffiliationsMcp(db, auth, identifier, expectedUpdatedAtInput, newIds);

  return {
    churchId: result.churchId,
    affiliationId,
    wasAdded: result.added.includes(affiliationId),
    current: result.current,
  };
}

export async function removeChurchAffiliationMcp(
  db: DbType,
  auth: McpAuthIdentity,
  identifier: EntityIdentifier,
  expectedUpdatedAtInput: unknown,
  affiliationIdInput: unknown
) {
  if (typeof affiliationIdInput !== 'number' || affiliationIdInput <= 0 || !Number.isInteger(affiliationIdInput)) {
    throw new McpValidationError('affiliation_id must be a positive integer');
  }

  const affiliationId = affiliationIdInput;

  // Get current affiliations
  const current = await listChurchAffiliationsMcp(db, auth, identifier);
  const currentIds = current.map((a) => a.id);

  // Remove ID if present (idempotent)
  const newIds = currentIds.filter((id) => id !== affiliationId);

  // Use set operation
  const result = await setChurchAffiliationsMcp(db, auth, identifier, expectedUpdatedAtInput, newIds);

  return {
    churchId: result.churchId,
    affiliationId,
    wasRemoved: result.removed.includes(affiliationId),
    current: result.current,
  };
}
