import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDbWithContext } from '../db';
import { churches, comments } from '../db/schema';
import { requireAdminBetter } from '../middleware/better-auth';
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
