import { and, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { CountyForm } from '../../components/CountyForm';
import { Layout } from '../../components/Layout';
import { createDbWithContext } from '../../db';
import { churches, counties } from '../../db/schema';
import { getUser, requireAuthBetter } from '../../middleware/better-auth';
import type { D1SessionVariables } from '../../middleware/d1-session';
import type { AuthVariables, Bindings } from '../../types';
import { getCommonLayoutProps } from '../../utils/layout-props';

type Variables = AuthVariables & D1SessionVariables;

export const adminCountiesRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Apply auth middleware to all routes
adminCountiesRoutes.use('*', requireAuthBetter);

// Counties list page
adminCountiesRoutes.get('/', async (c) => {
  const db = createDbWithContext(c);
  const success = c.req.query('success');
  const error = c.req.query('error');

  // Get common layout props (includes user, i18n, favicon, etc.)
  const layoutProps = await getCommonLayoutProps(c);
  const { t } = layoutProps;

  // Get all counties with church counts
  const countiesData = await db
    .select({
      id: counties.id,
      name: counties.name,
      path: counties.path,
      population: counties.population,
      deletedAt: counties.deletedAt,
      churchCount:
        sql<number>`(SELECT COUNT(*) FROM ${churches} WHERE ${churches.countyId} = ${counties.id} AND ${churches.deletedAt} IS NULL)`.as(
          'church_count'
        ),
    })
    .from(counties)
    .where(isNull(counties.deletedAt))
    .orderBy(counties.name)
    .all();

  const deletedCounties = await db
    .select({
      id: counties.id,
      name: counties.name,
      path: counties.path,
      deletedAt: counties.deletedAt,
    })
    .from(counties)
    .where(isNotNull(counties.deletedAt))
    .orderBy(desc(counties.deletedAt))
    .all();

  return c.html(
    <Layout title={t('admin.counties')} {...layoutProps}>
      <div class="bg-white">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div class="flex justify-between items-center mb-6">
            <h1 class="text-2xl font-bold text-gray-900">{t('admin.counties')}</h1>
            <a
              href="/admin/counties/new"
              class="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 transition-colors"
            >
              {t('admin.addCounty')}
            </a>
          </div>

          {success && (
            <div class="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-green-700">
              {success === 'created' && 'County created successfully.'}
              {success === 'deleted' && 'County deleted successfully.'}
              {success === 'restored' && 'County restored successfully.'}
            </div>
          )}

          {error && (
            <div class="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              {error === 'has_churches' && 'Cannot delete county while it still has active churches.'}
              {error === 'not_found' && 'County not found.'}
              {error === 'not_found_deleted' && 'Deleted county not found.'}
              {error === 'forbidden' && 'Only admins can restore counties.'}
              {error === 'restore_failed' && 'Failed to restore county.'}
              {error === 'delete_failed' && 'Failed to delete county.'}
            </div>
          )}

          <div class="bg-white shadow overflow-hidden sm:rounded-md">
            <ul class="divide-y divide-gray-200">
              {countiesData.map((county) => (
                <li>
                  <a href={`/admin/counties/${county.id}/edit`} class="block hover:bg-gray-50 px-4 py-4 sm:px-6">
                    <div class="flex items-center justify-between">
                      <div class="flex-1">
                        <p class="text-sm font-medium text-primary-600 truncate">{county.name}</p>
                        <p class="mt-1 text-sm text-gray-500">
                          {county.churchCount} {county.churchCount === 1 ? 'church' : 'churches'}
                          {county.population && ` • Population: ${county.population.toLocaleString()}`}
                        </p>
                      </div>
                      <div class="ml-2 flex-shrink-0">
                        <svg class="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fill-rule="evenodd"
                            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                            clip-rule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {deletedCounties.length > 0 && (
            <div class="mt-8 rounded-md border border-gray-200 bg-gray-50 p-4">
              <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-700">Deleted Counties</h2>
              <ul class="mt-3 divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
                {deletedCounties.map((county) => (
                  <li class="flex items-center justify-between px-4 py-3">
                    <div>
                      <p class="text-sm font-medium text-gray-900">{county.name}</p>
                      <p class="text-xs text-gray-500">
                        Deleted: {county.deletedAt ? county.deletedAt.toISOString() : 'unknown'}
                      </p>
                    </div>
                    <form method="post" action={`/admin/counties/${county.id}/restore`}>
                      <button
                        type="submit"
                        class="rounded-md border border-green-300 bg-white px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50"
                      >
                        Restore
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
});

// New county page
adminCountiesRoutes.get('/new', async (c) => {
  const layoutProps = await getCommonLayoutProps(c);
  const { t } = layoutProps;

  return c.html(
    <Layout title={t('admin.addCounty')} {...layoutProps}>
      <div class="bg-white">
        <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 class="text-2xl font-bold text-gray-900 mb-6">{t('admin.addCounty')}</h1>
          <CountyForm action="/admin/counties/new" county={undefined} {...layoutProps} />
        </div>
      </div>
    </Layout>
  );
});

// Create county
adminCountiesRoutes.post('/new', async (c) => {
  const db = createDbWithContext(c);
  const _user = await getUser(c);

  try {
    const formData = await c.req.formData();
    const name = formData.get('name') as string;
    const path = formData.get('path') as string;
    const population = formData.get('population') as string;

    // Validate required fields
    if (!name || !path) {
      return c.redirect('/admin/counties/new?error=missing_fields');
    }

    // Create the county
    const _result = await db
      .insert(counties)
      .values({
        name: name.trim(),
        path: path.trim().toLowerCase(),
        population: population ? parseInt(population, 10) : null,
      })
      .returning()
      .get();

    // TODO: Add activity tracking when audit trail is implemented

    return c.redirect('/admin/counties?success=created');
  } catch (error) {
    console.error('Error creating county:', error);
    return c.redirect('/admin/counties/new?error=create_failed');
  }
});

// Edit county page
adminCountiesRoutes.get('/:id/edit', async (c) => {
  const countyId = parseInt(c.req.param('id'), 10);
  const db = createDbWithContext(c);

  const layoutProps = await getCommonLayoutProps(c);

  // Get the county
  const county = await db
    .select()
    .from(counties)
    .where(and(eq(counties.id, countyId), isNull(counties.deletedAt)))
    .get();

  if (!county) {
    return c.html(
      <Layout title="County Not Found" {...layoutProps}>
        <div class="text-center py-12">
          <h2 class="text-2xl font-bold text-gray-900">County Not Found</h2>
          <p class="mt-2 text-gray-600">The county you're looking for doesn't exist.</p>
          <a href="/admin/counties" class="mt-4 inline-block text-primary-600 hover:text-primary-500">
            Back to Counties
          </a>
        </div>
      </Layout>,
      404
    );
  }

  const error = c.req.query('error');
  const success = c.req.query('success');

  return c.html(
    <Layout title={`Edit ${county.name}`} {...layoutProps}>
      <div class="bg-white">
        <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 class="text-2xl font-bold text-gray-900 mb-6">Edit {county.name}</h1>

          {error && (
            <div class="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
              {error === 'missing_fields' && 'Please fill in all required fields.'}
              {error === 'update_failed' && 'Failed to update county. Please try again.'}
            </div>
          )}

          {success && (
            <div class="mb-4 bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded">
              County updated successfully!
            </div>
          )}

          <CountyForm action={`/admin/counties/${countyId}/edit`} county={county} {...layoutProps} />
        </div>
      </div>
    </Layout>
  );
});

// Update county
adminCountiesRoutes.post('/:id/edit', async (c) => {
  const countyId = parseInt(c.req.param('id'), 10);
  const db = createDbWithContext(c);
  const _user = await getUser(c);

  try {
    const formData = await c.req.formData();
    const name = formData.get('name') as string;
    const path = formData.get('path') as string;
    const population = formData.get('population') as string;

    // Validate required fields
    if (!name || !path) {
      return c.redirect(`/admin/counties/${countyId}/edit?error=missing_fields`);
    }

    // Update the county
    const _result = await db
      .update(counties)
      .set({
        name: name.trim(),
        path: path.trim().toLowerCase(),
        population: population ? parseInt(population, 10) : null,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(and(eq(counties.id, countyId), isNull(counties.deletedAt)))
      .returning()
      .get();

    // TODO: Add activity tracking when audit trail is implemented

    return c.redirect(`/admin/counties/${countyId}/edit?success=updated`);
  } catch (error) {
    console.error('Error updating county:', error);
    return c.redirect(`/admin/counties/${countyId}/edit?error=update_failed`);
  }
});

// Delete county
adminCountiesRoutes.post('/:id/delete', async (c) => {
  const countyId = parseInt(c.req.param('id'), 10);
  const db = createDbWithContext(c);
  const _user = await getUser(c);

  try {
    // Get county details before deletion
    const county = await db
      .select()
      .from(counties)
      .where(and(eq(counties.id, countyId), isNull(counties.deletedAt)))
      .get();

    if (!county) {
      return c.redirect('/admin/counties?error=not_found');
    }

    // Check if county has churches
    const churchCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(churches)
      .where(and(eq(churches.countyId, countyId), isNull(churches.deletedAt)))
      .get();

    if (churchCount && churchCount.count > 0) {
      return c.redirect('/admin/counties?error=has_churches');
    }

    // Soft-delete the county
    await db
      .update(counties)
      .set({
        deletedAt: sql`CURRENT_TIMESTAMP`,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(and(eq(counties.id, countyId), isNull(counties.deletedAt)));

    // TODO: Add activity tracking when audit trail is implemented

    return c.redirect('/admin/counties?success=deleted');
  } catch (error) {
    console.error('Error deleting county:', error);
    return c.redirect('/admin/counties?error=delete_failed');
  }
});

// Restore county (admin-only)
adminCountiesRoutes.post('/:id/restore', async (c) => {
  const countyId = parseInt(c.req.param('id'), 10);
  const db = createDbWithContext(c);
  const user = c.get('betterUser');

  if (user?.role !== 'admin') {
    return c.redirect('/admin/counties?error=forbidden');
  }

  try {
    const county = await db
      .select()
      .from(counties)
      .where(and(eq(counties.id, countyId), isNotNull(counties.deletedAt)))
      .get();

    if (!county) {
      return c.redirect('/admin/counties?error=not_found_deleted');
    }

    await db
      .update(counties)
      .set({
        deletedAt: null,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(and(eq(counties.id, countyId), isNotNull(counties.deletedAt)));

    return c.redirect('/admin/counties?success=restored');
  } catch (error) {
    console.error('Error restoring county:', error);
    return c.redirect('/admin/counties?error=restore_failed');
  }
});
