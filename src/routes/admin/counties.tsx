import { eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { CountyForm } from '../../components/CountyForm';
import { Layout } from '../../components/Layout';
import { Toast } from '../../components/Toast';
import { createDbWithContext } from '../../db';
import { churches, counties } from '../../db/schema';
import { requireAuth } from '../../middleware/better-auth';
import type { D1SessionVariables } from '../../middleware/d1-session';
import type { AuthVariables, Bindings } from '../../types';
import { trackActivity } from '../../utils/audit-trail';
import { invalidateCacheForPaths } from '../../utils/cache-invalidation';
import { getCommonLayoutProps } from '../../utils/layout-props';

type Variables = AuthVariables & D1SessionVariables;

export const adminCountiesRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Apply auth middleware to all routes
adminCountiesRoutes.use('*', requireAuth);

// Counties list page
adminCountiesRoutes.get('/admin/counties', async (c) => {
  const db = createDbWithContext(c);

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
      churchCount: sql<number>`(SELECT COUNT(*) FROM ${churches} WHERE ${churches.countyId} = ${counties.id})`.as(
        'church_count'
      ),
    })
    .from(counties)
    .orderBy(counties.name)
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
        </div>
      </div>
    </Layout>
  );
});

// New county page
adminCountiesRoutes.get('/admin/counties/new', async (c) => {
  const layoutProps = await getCommonLayoutProps(c);
  const { t } = layoutProps;

  return c.html(
    <Layout title={t('admin.addCounty')} {...layoutProps}>
      <div class="bg-white">
        <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 class="text-2xl font-bold text-gray-900 mb-6">{t('admin.addCounty')}</h1>
          <CountyForm county={null} {...layoutProps} />
        </div>
      </div>
    </Layout>
  );
});

// Create county
adminCountiesRoutes.post('/admin/counties/new', async (c) => {
  const db = createDbWithContext(c);
  const user = c.get('user');

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
    const result = await db
      .insert(counties)
      .values({
        name: name.trim(),
        path: path.trim().toLowerCase(),
        population: population ? parseInt(population, 10) : null,
      })
      .returning()
      .get();

    // Track activity
    await trackActivity(c, {
      action: 'create',
      entityType: 'county',
      entityId: result.id,
      details: `Created county: ${result.name}`,
    });

    // Invalidate caches
    await invalidateCacheForPaths(c, ['/']);

    return c.redirect('/admin/counties?success=created');
  } catch (error) {
    console.error('Error creating county:', error);
    return c.redirect('/admin/counties/new?error=create_failed');
  }
});

// Edit county page
adminCountiesRoutes.get('/admin/counties/:id/edit', async (c) => {
  const countyId = parseInt(c.req.param('id'), 10);
  const db = createDbWithContext(c);

  const layoutProps = await getCommonLayoutProps(c);
  const { t } = layoutProps;

  // Get the county
  const county = await db.select().from(counties).where(eq(counties.id, countyId)).get();

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

          <CountyForm county={county} {...layoutProps} />
        </div>
      </div>
    </Layout>
  );
});

// Update county
adminCountiesRoutes.post('/admin/counties/:id/edit', async (c) => {
  const countyId = parseInt(c.req.param('id'), 10);
  const db = createDbWithContext(c);
  const user = c.get('user');

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
    const result = await db
      .update(counties)
      .set({
        name: name.trim(),
        path: path.trim().toLowerCase(),
        population: population ? parseInt(population, 10) : null,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(counties.id, countyId))
      .returning()
      .get();

    // Track activity
    await trackActivity(c, {
      action: 'update',
      entityType: 'county',
      entityId: countyId,
      details: `Updated county: ${result.name}`,
    });

    // Invalidate caches
    await invalidateCacheForPaths(c, ['/', `/counties/${result.path}`]);

    return c.redirect(`/admin/counties/${countyId}/edit?success=updated`);
  } catch (error) {
    console.error('Error updating county:', error);
    return c.redirect(`/admin/counties/${countyId}/edit?error=update_failed`);
  }
});

// Delete county
adminCountiesRoutes.post('/admin/counties/:id/delete', async (c) => {
  const countyId = parseInt(c.req.param('id'), 10);
  const db = createDbWithContext(c);
  const user = c.get('user');

  try {
    // Get county details before deletion
    const county = await db.select().from(counties).where(eq(counties.id, countyId)).get();

    if (!county) {
      return c.redirect('/admin/counties?error=not_found');
    }

    // Check if county has churches
    const churchCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(churches)
      .where(eq(churches.countyId, countyId))
      .get();

    if (churchCount && churchCount.count > 0) {
      return c.redirect('/admin/counties?error=has_churches');
    }

    // Delete the county
    await db.delete(counties).where(eq(counties.id, countyId));

    // Track activity
    await trackActivity(c, {
      action: 'delete',
      entityType: 'county',
      entityId: countyId,
      details: `Deleted county: ${county.name}`,
    });

    // Invalidate caches
    await invalidateCacheForPaths(c, ['/', `/counties/${county.path}`]);

    return c.redirect('/admin/counties?success=deleted');
  } catch (error) {
    console.error('Error deleting county:', error);
    return c.redirect('/admin/counties?error=delete_failed');
  }
});
