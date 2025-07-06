import { eq, like, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDbWithContext } from '../db';
import { affiliations, churches, comments, counties } from '../db/schema';
import { requireAdminBetter } from '../middleware/better-auth';
import type { Bindings } from '../types';

export const apiRoutes = new Hono<{ Bindings: Bindings }>();

// Search churches
apiRoutes.get('/churches/search', async (c) => {
  const db = createDbWithContext(c);
  const query = c.req.query('q') || '';
  const limit = Number(c.req.query('limit')) || 10;

  if (!query || query.length < 2) {
    return c.json({ churches: [] });
  }

  const searchResults = await db
    .select({
      id: churches.id,
      name: churches.name,
      path: churches.path,
      status: churches.status,
      countyName: counties.name,
    })
    .from(churches)
    .leftJoin(counties, eq(churches.countyId, counties.id))
    .where(sql`${churches.name} LIKE ${'%' + query + '%'} COLLATE NOCASE`)
    .orderBy(
      sql`CASE 
        WHEN ${churches.name} LIKE ${query + '%'} COLLATE NOCASE THEN 1 
        WHEN ${churches.name} LIKE ${'%' + query + '%'} COLLATE NOCASE THEN 2 
        ELSE 3 
      END`,
      churches.name
    )
    .limit(limit)
    .all();

  return c.json({ churches: searchResults });
});

// Get all churches
apiRoutes.get('/churches', async (c) => {
  const db = createDbWithContext(c);
  const limit = Number(c.req.query('limit')) || 20;
  const offset = Number(c.req.query('offset')) || 0;

  const allChurches = await db
    .select({
      id: churches.id,
      name: churches.name,
      path: churches.path,
      status: churches.status,
      gatheringAddress: churches.gatheringAddress,
      website: churches.website,
    })
    .from(churches)
    .limit(limit)
    .offset(offset)
    .all();

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

// Delete comment (admin only)
apiRoutes.post('/comments/:id/delete', requireAdminBetter, async (c) => {
  const db = createDbWithContext(c);
  const commentId = Number(c.req.param('id'));

  try {
    // Check if comment exists
    const comment = await db.select().from(comments).where(eq(comments.id, commentId)).get();

    if (!comment) {
      return c.json({ error: 'Comment not found' }, 404);
    }

    // Delete the comment
    await db.delete(comments).where(eq(comments.id, commentId)).run();

    // Redirect back to the referring page or admin dashboard
    const referer = c.req.header('referer');
    if (referer) {
      return c.redirect(referer);
    }
    return c.redirect('/admin');
  } catch (error) {
    console.error('Error deleting comment:', error);
    return c.json({ error: 'Failed to delete comment' }, 500);
  }
});

// Get all counties
apiRoutes.get('/counties', async (c) => {
  const db = createDbWithContext(c);

  const allCounties = await db
    .select({
      id: counties.id,
      name: counties.name,
      path: counties.path,
      description: counties.description,
      population: counties.population,
    })
    .from(counties)
    .orderBy(counties.name)
    .all();

  return c.json(allCounties);
});

// Get all networks/affiliations
apiRoutes.get('/networks', async (c) => {
  const db = createDbWithContext(c);

  const allNetworks = await db
    .select({
      id: affiliations.id,
      name: affiliations.name,
      path: affiliations.path,
      status: affiliations.status,
      website: affiliations.website,
      publicNotes: affiliations.publicNotes,
    })
    .from(affiliations)
    .where(eq(affiliations.status, 'Listed'))
    .orderBy(affiliations.name)
    .all();

  return c.json(allNetworks);
});
