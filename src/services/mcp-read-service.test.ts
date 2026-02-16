import { describe, expect, test } from 'bun:test';
import { listChurchesMcp, McpForbiddenError } from './mcp-read-service';

function makeReadDb(options: { fullRows: Array<Record<string, unknown>>; publicRows: Array<Record<string, unknown>> }) {
  return {
    select(selection?: Record<string, unknown>) {
      const rows = selection ? options.publicRows : options.fullRows;
      return {
        from() {
          return this;
        },
        where() {
          return this;
        },
        limit() {
          return this;
        },
        offset() {
          return this;
        },
        async all() {
          return rows;
        },
      };
    },
  };
}

describe('mcp read service', () => {
  test('unauthenticated church list uses public shape', async () => {
    const db = makeReadDb({
      fullRows: [
        {
          id: 1,
          name: 'Private Church',
          path: 'private',
          status: 'Unlisted',
          privateNotes: 'secret',
        },
      ],
      publicRows: [
        {
          id: 2,
          name: 'Public Church',
          path: 'public',
          status: 'Listed',
          gatheringAddress: '123 Main',
          website: 'https://example.com',
        },
      ],
    });

    const result = await listChurchesMcp(db as any, null, {
      limit: 20,
      offset: 0,
      includeDeleted: false,
    });

    expect(result.items.length).toBe(1);
    expect(result.items[0].name).toBe('Public Church');
    expect('privateNotes' in result.items[0]).toBe(false);
  });

  test('authenticated church list includes non-public rows and fields', async () => {
    const db = makeReadDb({
      fullRows: [
        {
          id: 1,
          name: 'Private Church',
          path: 'private',
          status: 'Unlisted',
          privateNotes: 'secret',
        },
      ],
      publicRows: [],
    });

    const result = await listChurchesMcp(
      db as any,
      {
        userId: 'u1',
        tokenId: 1,
        role: 'contributor',
        scope: 'broad',
      },
      {
        limit: 20,
        offset: 0,
        includeDeleted: false,
      }
    );

    expect(result.items.length).toBe(1);
    expect(result.items[0].name).toBe('Private Church');
    expect((result.items[0] as any).privateNotes).toBe('secret');
  });

  test('non-admin include_deleted request is forbidden', async () => {
    const db = makeReadDb({ fullRows: [], publicRows: [] });

    await expect(
      listChurchesMcp(
        db as any,
        {
          userId: 'u1',
          tokenId: 1,
          role: 'contributor',
          scope: 'broad',
        },
        {
          limit: 20,
          offset: 0,
          includeDeleted: true,
        }
      )
    ).rejects.toBeInstanceOf(McpForbiddenError);
  });

  test('admin include_deleted request is allowed', async () => {
    const db = makeReadDb({
      fullRows: [
        {
          id: 7,
          name: 'Deleted Church',
          path: 'deleted',
          status: 'Listed',
          deletedAt: new Date('2024-02-01T00:00:00.000Z'),
        },
      ],
      publicRows: [],
    });

    const result = await listChurchesMcp(
      db as any,
      {
        userId: 'admin-1',
        tokenId: 2,
        role: 'admin',
        scope: 'broad',
      },
      {
        limit: 20,
        offset: 0,
        includeDeleted: true,
      }
    );

    expect(result.items.length).toBe(1);
    expect(result.items[0].name).toBe('Deleted Church');
    expect((result.items[0] as any).deletedAt).toBeDefined();
  });
});
