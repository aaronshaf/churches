import { describe, expect, test } from 'bun:test';
import { McpConflictError, McpWriteForbiddenError, restoreChurchMcp, updateChurchMcp } from './mcp-write-service';

function makeWriteDb(currentRecord: Record<string, unknown>) {
  let auditInsertCalled = false;
  let nextUpdateResult: Record<string, unknown> = currentRecord;

  const db = {
    select() {
      return {
        from() {
          return this;
        },
        where() {
          return this;
        },
        async get() {
          return currentRecord;
        },
      };
    },
    update() {
      return {
        set() {
          return this;
        },
        where() {
          return this;
        },
        returning() {
          return [nextUpdateResult];
        },
      };
    },
    insert() {
      auditInsertCalled = true;
      return {
        values() {
          return this;
        },
        async run() {},
      };
    },
    getAuditInsertCalled() {
      return auditInsertCalled;
    },
    setNextUpdateResult(value: Record<string, unknown>) {
      nextUpdateResult = value;
    },
  };

  return db;
}

describe('mcp write service', () => {
  test('stale updated_at throws McpConflictError and does not write audit', async () => {
    const db = makeWriteDb({
      id: 1,
      name: 'Original',
      status: 'Listed',
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      deletedAt: null,
    });

    await expect(
      updateChurchMcp(
        db as any,
        {
          userId: 'u1',
          tokenId: 1,
          role: 'contributor',
          scope: 'broad',
        },
        { id: 1 },
        '2020-01-01T00:00:00.000Z',
        { name: 'Renamed' }
      )
    ).rejects.toBeInstanceOf(McpConflictError);

    expect(db.getAuditInsertCalled()).toBe(false);
  });

  test('restore is forbidden for contributor', async () => {
    const db = makeWriteDb({
      id: 1,
      name: 'Deleted Church',
      status: 'Listed',
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      deletedAt: new Date('2024-01-02T00:00:00.000Z'),
    });

    await expect(
      restoreChurchMcp(
        db as any,
        {
          userId: 'u1',
          tokenId: 1,
          role: 'contributor',
          scope: 'broad',
        },
        { id: 1 },
        '2024-01-01T00:00:00.000Z'
      )
    ).rejects.toBeInstanceOf(McpWriteForbiddenError);
  });

  test('successful update writes audit and returns updated record', async () => {
    const db = makeWriteDb({
      id: 3,
      name: 'Original Church',
      status: 'Listed',
      updatedAt: new Date('2024-03-01T00:00:00.000Z'),
      deletedAt: null,
    });

    db.setNextUpdateResult({
      id: 3,
      name: 'Updated Church',
      status: 'Listed',
      updatedAt: new Date('2024-03-02T00:00:00.000Z'),
      deletedAt: null,
    });

    const result = await updateChurchMcp(
      db as any,
      {
        userId: 'u2',
        tokenId: 9,
        role: 'contributor',
        scope: 'broad',
      },
      { id: 3 },
      '2024-03-01T00:00:00.000Z',
      { name: 'Updated Church' }
    );

    expect((result as any).name).toBe('Updated Church');
    expect(db.getAuditInsertCalled()).toBe(true);
  });

  test('admin restore succeeds and writes audit', async () => {
    const db = makeWriteDb({
      id: 4,
      name: 'Recoverable Church',
      status: 'Listed',
      updatedAt: new Date('2024-04-01T00:00:00.000Z'),
      deletedAt: new Date('2024-04-02T00:00:00.000Z'),
    });

    db.setNextUpdateResult({
      id: 4,
      name: 'Recoverable Church',
      status: 'Listed',
      updatedAt: new Date('2024-04-03T00:00:00.000Z'),
      deletedAt: null,
    });

    const restored = await restoreChurchMcp(
      db as any,
      {
        userId: 'admin-1',
        tokenId: 8,
        role: 'admin',
        scope: 'broad',
      },
      { id: 4 },
      '2024-04-01T00:00:00.000Z'
    );

    expect((restored as any).deletedAt).toBeNull();
    expect(db.getAuditInsertCalled()).toBe(true);
  });
});
