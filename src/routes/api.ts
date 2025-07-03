import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { createDb } from '../db';
import { churches } from '../db/schema';
import type { Bindings } from '../types';

export const apiRoutes = new Hono<{ Bindings: Bindings }>();

// Get all churches
apiRoutes.get('/churches', async (c) => {
  const db = createDb(c.env);
  const allChurches = await db.select().from(churches).all();
  return c.json(allChurches);
});

// Get single church
apiRoutes.get('/churches/:id', async (c) => {
  const db = createDb(c.env);
  const id = Number.parseInt(c.req.param('id'));
  
  if (Number.isNaN(id)) {
    return c.json({ error: 'Invalid church ID' }, 400);
  }
  
  const church = await db.select().from(churches).where(eq(churches.id, id)).get();
  
  if (!church) {
    return c.json({ error: 'Church not found' }, 404);
  }
  
  return c.json(church);
});