import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { createDb, createDbWithContext } from '../db';
import { churches } from '../db/schema';
import type { Bindings } from '../types';

export const apiRoutes = new Hono<{ Bindings: Bindings }>();

// Get all churches
apiRoutes.get('/churches', async (c) => {
  const db = createDbWithContext(c);
  const limit = Number(c.req.query('limit')) || 20;
  const offset = Number(c.req.query('offset')) || 0;

  const allChurches = await db.select().from(churches).limit(limit).offset(offset);

  return c.json({
    churches: allChurches,
    limit,
    offset,
  });
});

// Get single church
apiRoutes.get('/churches/:id', async (c) => {
  const db = createDbWithContext(c);
  const id = c.req.param('id');

  const church = await db
    .select()
    .from(churches)
    .where(eq(churches.id, Number(id)))
    .get();

  if (!church) {
    return c.json({ error: 'Church not found' }, 404);
  }

  return c.json(church);
});