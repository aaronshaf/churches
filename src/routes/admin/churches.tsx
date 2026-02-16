import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { ChurchForm } from '../../components/ChurchForm';
import { Layout } from '../../components/Layout';
import { NotFound } from '../../components/NotFound';
import { createDbWithContext } from '../../db';
import { affiliations, churchAffiliations, churches, churchGatherings, counties } from '../../db/schema';
import type { D1SessionVariables } from '../../middleware/d1-session';
import { requireAdminWithRedirect } from '../../middleware/redirect-auth';
import type { AuthenticatedVariables, Bindings } from '../../types';
import { getLogoUrl } from '../../utils/settings';
import { listChurches } from './churches/list';

type Variables = AuthenticatedVariables & D1SessionVariables;

export const adminChurchesRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Apply admin middleware to all routes
adminChurchesRoutes.use('*', requireAdminWithRedirect);

// List churches with search and filters
adminChurchesRoutes.get('/', listChurches);

// New church form
adminChurchesRoutes.get('/new', async (c) => {
  const db = createDbWithContext(c);
  const user = c.get('betterUser');

  // Get all counties for dropdown
  const allCounties = await db.select().from(counties).where(isNull(counties.deletedAt)).orderBy(counties.name).all();

  // Get all affiliations for checkboxes
  const allAffiliations = await db
    .select()
    .from(affiliations)
    .where(isNull(affiliations.deletedAt))
    .orderBy(affiliations.name)
    .all();

  const logoUrl = await getLogoUrl(c.env);

  return c.html(
    <Layout
      title="Create New Church"
      faviconUrl={undefined}
      logoUrl={logoUrl}
      pages={[]}
      currentPath={c.req.path}
      user={user}
    >
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ChurchForm
          action="/admin/churches"
          counties={allCounties}
          affiliations={allAffiliations}
          isNew={true}
          cancelUrl="/admin/churches"
          r2Domain={c.env.R2_DOMAIN}
          domain={c.env.SITE_DOMAIN || 'localhost'}
        />
      </div>
    </Layout>
  );
});

// Create church - simplified version
adminChurchesRoutes.post('/', async (c) => {
  // This would contain the create logic
  // For now, redirect to list
  return c.redirect('/admin/churches');
});

// Edit church form
adminChurchesRoutes.get('/:id/edit', async (c) => {
  const db = createDbWithContext(c);
  const user = c.get('betterUser');
  const churchId = parseInt(c.req.param('id'));

  if (Number.isNaN(churchId)) {
    return c.html(<NotFound />, 404);
  }

  // Get church data
  const church = await db
    .select()
    .from(churches)
    .where(and(eq(churches.id, churchId), isNull(churches.deletedAt)))
    .get();

  if (!church) {
    return c.html(<NotFound />, 404);
  }

  // Get related data
  const [gatherings, churchAffiliationData, allCounties, allAffiliations] = await Promise.all([
    db.select().from(churchGatherings).where(eq(churchGatherings.churchId, churchId)).all(),
    db.select().from(churchAffiliations).where(eq(churchAffiliations.churchId, churchId)).all(),
    db.select().from(counties).where(isNull(counties.deletedAt)).orderBy(counties.name).all(),
    db.select().from(affiliations).where(isNull(affiliations.deletedAt)).orderBy(affiliations.name).all(),
  ]);

  const logoUrl = await getLogoUrl(c.env);

  return c.html(
    <Layout
      title={`Edit ${church.name}`}
      faviconUrl={undefined}
      logoUrl={logoUrl}
      pages={[]}
      currentPath={c.req.path}
      user={user}
    >
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ChurchForm
          action={`/admin/churches/${churchId}`}
          church={church}
          gatherings={gatherings}
          churchAffiliations={churchAffiliationData}
          counties={allCounties}
          affiliations={allAffiliations}
          isNew={false}
          cancelUrl="/admin/churches"
          r2Domain={c.env.R2_DOMAIN}
          domain={c.env.SITE_DOMAIN || 'localhost'}
        />
      </div>
    </Layout>
  );
});

// Update church - simplified version
adminChurchesRoutes.post('/:id', async (c) => {
  // This would contain the update logic
  // For now, redirect to list
  return c.redirect('/admin/churches');
});

// Delete church - simplified version
adminChurchesRoutes.post('/:id/delete', async (c) => {
  const db = createDbWithContext(c);
  const churchId = parseInt(c.req.param('id'));

  if (Number.isNaN(churchId)) {
    return c.redirect('/admin/churches?error=invalid_id');
  }

  try {
    const church = await db
      .select()
      .from(churches)
      .where(and(eq(churches.id, churchId), isNull(churches.deletedAt)))
      .get();

    if (!church) {
      return c.redirect('/admin/churches?error=not_found');
    }

    await db
      .update(churches)
      .set({
        deletedAt: sql`CURRENT_TIMESTAMP`,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(and(eq(churches.id, churchId), isNull(churches.deletedAt)));

    return c.redirect('/admin/churches?success=deleted');
  } catch (error) {
    console.error('Error deleting church:', error);
    return c.redirect('/admin/churches?error=delete_failed');
  }
});

// Restore church
adminChurchesRoutes.post('/:id/restore', async (c) => {
  const db = createDbWithContext(c);
  const churchId = parseInt(c.req.param('id'));

  if (Number.isNaN(churchId)) {
    return c.redirect('/admin/churches?error=invalid_id');
  }

  try {
    const deletedChurch = await db
      .select()
      .from(churches)
      .where(and(eq(churches.id, churchId), isNotNull(churches.deletedAt)))
      .get();

    if (!deletedChurch) {
      return c.redirect('/admin/churches?error=not_found_deleted');
    }

    await db
      .update(churches)
      .set({
        deletedAt: null,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(and(eq(churches.id, churchId), isNotNull(churches.deletedAt)));

    return c.redirect('/admin/churches?success=restored');
  } catch (error) {
    console.error('Error restoring church:', error);
    return c.redirect('/admin/churches?error=restore_failed');
  }
});

// Extract website data - simplified version
adminChurchesRoutes.post('/:id/extract', async (c) => {
  // This would contain the extraction logic
  // For now, return empty response
  return c.json({ extracted: {}, fields: {} });
});
