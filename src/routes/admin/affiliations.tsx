import { desc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { AffiliationForm } from '../../components/AffiliationForm';
import { Layout } from '../../components/Layout';
import { NotFound } from '../../components/NotFound';
import { createDbWithContext } from '../../db';
import { affiliations, churchAffiliations, churches, counties } from '../../db/schema';
import { requireAdminWithRedirect } from '../../middleware/redirect-auth';
import type { AuthenticatedVariables, Bindings } from '../../types';
import { cacheInvalidation } from '../../utils/cache-invalidation';
import { getNavbarPages } from '../../utils/pages';
import { getFaviconUrl, getLogoUrl } from '../../utils/settings';
import { affiliationSchema, parseFormBody, validateFormData } from '../../utils/validation';

type Variables = AuthenticatedVariables;

export const adminAffiliationsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Apply admin middleware to all routes
adminAffiliationsRoutes.use('*', requireAdminWithRedirect);

// List affiliations
adminAffiliationsRoutes.get('/', async (c) => {
  const db = createDbWithContext(c);
  const user = c.get('betterUser');
  const logoUrl = await getLogoUrl(c.env);
  const faviconUrl = await getFaviconUrl(c.env);
  const navbarPages = await getNavbarPages(c.env);

  const allAffiliations = await db.select().from(affiliations).orderBy(desc(affiliations.updatedAt)).all();

  const content = (
    <Layout title="Manage Affiliations" user={user} faviconUrl={faviconUrl} logoUrl={logoUrl} pages={navbarPages}>
      <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div class="sm:flex sm:items-center">
          <div class="sm:flex-auto">
            <h1 class="text-2xl font-semibold text-gray-900">Affiliations</h1>
            <p class="mt-2 text-sm text-gray-700">A list of all church affiliations and networks.</p>
          </div>
          <div class="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
            <a
              href="/admin/affiliations/new"
              class="block rounded-md bg-primary-600 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
            >
              Add affiliation
            </a>
          </div>
        </div>

        <div class="mt-8 flow-root">
          <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <table class="min-w-full divide-y divide-gray-300">
                <thead>
                  <tr>
                    <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">
                      Name
                    </th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Status
                    </th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Path
                    </th>
                    <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-0">
                      <span class="sr-only">Edit</span>
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  {allAffiliations.map((affiliation) => (
                    <tr key={affiliation.id}>
                      <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0">
                        {affiliation.path ? (
                          <a href={`/networks/${affiliation.path}`} class="text-primary-600 hover:text-primary-500">
                            {affiliation.name}
                          </a>
                        ) : (
                          affiliation.name
                        )}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        <span
                          class={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                            affiliation.status === 'Listed'
                              ? 'bg-green-50 text-green-700'
                              : affiliation.status === 'Unlisted'
                                ? 'bg-gray-50 text-gray-700'
                                : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {affiliation.status}
                        </span>
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{affiliation.path}</td>
                      <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                        <a
                          href={`/admin/affiliations/${affiliation.id}/edit`}
                          class="text-primary-600 hover:text-primary-900"
                        >
                          Edit<span class="sr-only">, {affiliation.name}</span>
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );

  return c.html(content);
});

// New affiliation form
adminAffiliationsRoutes.get('/new', async (c) => {
  const user = c.get('betterUser');
  const _logoUrl = await getLogoUrl(c.env);

  const content = (
    <Layout title="Add Affiliation" user={user}>
      <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div class="mb-8">
          <h1 class="text-2xl font-semibold text-gray-900">Add Affiliation</h1>
        </div>
        <AffiliationForm affiliation={undefined} action="/admin/affiliations" cancelUrl="/admin/affiliations" />
      </div>
    </Layout>
  );

  return c.html(content);
});

// New affiliation form
adminAffiliationsRoutes.get('/new', async (c) => {
  const user = c.get('betterUser');
  const logoUrl = await getLogoUrl(c.env);
  const faviconUrl = await getFaviconUrl(c.env);
  const navbarPages = await getNavbarPages(c.env);

  return c.html(
    <Layout
      title="Create Affiliation - Admin"
      user={user}
      logoUrl={logoUrl}
      faviconUrl={faviconUrl}
      pages={navbarPages}
    >
      <AffiliationForm action="/admin/affiliations" affiliation={undefined} isNew={true} />
    </Layout>
  );
});

// Create affiliation
adminAffiliationsRoutes.post('/', async (c) => {
  const db = createDbWithContext(c);
  const user = c.get('betterUser');
  const _logoUrl = await getLogoUrl(c.env);

  try {
    const body = await c.req.parseBody();
    const parsedBody = parseFormBody(body);
    const validationResult = validateFormData(affiliationSchema, parsedBody);

    if (!validationResult.success) {
      const logoUrl = await getLogoUrl(c.env);
      const faviconUrl = await getFaviconUrl(c.env);
      const navbarPages = await getNavbarPages(c.env);
      return c.html(
        <Layout
          title="Create Affiliation - Admin"
          user={user}
          logoUrl={logoUrl}
          faviconUrl={faviconUrl}
          pages={navbarPages}
        >
          <AffiliationForm
            action="/admin/affiliations"
            error={validationResult.message}
            affiliation={undefined}
            isNew={true}
          />
        </Layout>
      );
    }

    const validatedData = validationResult.data;

    const result = await db
      .insert(affiliations)
      .values({
        name: validatedData.name,
        path: validatedData.path,
        status: validatedData.status,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Invalidate cache for affiliation changes
    if (result[0]) {
      await cacheInvalidation.affiliation(c, result[0].id.toString());
    }

    return c.redirect('/admin/affiliations');
  } catch (error) {
    console.error('Error creating affiliation:', error);
    const faviconUrl = await getFaviconUrl(c.env);
    const logoUrl = await getLogoUrl(c.env);
    const navbarPages = await getNavbarPages(c.env);
    return c.html(
      <Layout title="Error" user={user} faviconUrl={faviconUrl} logoUrl={logoUrl} pages={navbarPages}>
        <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div class="rounded-md bg-red-50 p-4">
            <h3 class="text-sm font-medium text-red-800">Error creating affiliation</h3>
            <p class="mt-2 text-sm text-red-700">{error instanceof Error ? error.message : 'Unknown error'}</p>
            <a href="/admin/affiliations" class="mt-4 inline-block text-sm font-medium text-red-600 hover:text-red-500">
              ← Back to affiliations
            </a>
          </div>
        </div>
      </Layout>
    );
  }
});

// Edit affiliation form
adminAffiliationsRoutes.get('/:id/edit', async (c) => {
  const db = createDbWithContext(c);
  const user = c.get('betterUser');
  const logoUrl = await getLogoUrl(c.env);
  const faviconUrl = await getFaviconUrl(c.env);
  const navbarPages = await getNavbarPages(c.env);
  const id = Number(c.req.param('id'));

  const affiliation = await db.select().from(affiliations).where(eq(affiliations.id, id)).get();

  if (!affiliation) {
    return c.html(<NotFound />, 404);
  }

  // Get affiliated churches (simplified for form)
  const affiliatedChurches = (await db
    .select({
      id: churches.id,
      name: churches.name,
      status: churches.status,
      countyName: sql<string | null>`${counties.name}`.as('countyName'),
    })
    .from(churches)
    .innerJoin(churchAffiliations, eq(churches.id, churchAffiliations.churchId))
    .leftJoin(counties, eq(churches.countyId, counties.id))
    .where(eq(churchAffiliations.affiliationId, id))
    .orderBy(churches.name)
    .all()) as any[];

  // Get all churches for selection (simplified for form)
  const allChurches = (await db
    .select({
      id: churches.id,
      name: churches.name,
      status: churches.status,
      countyName: sql<string | null>`${counties.name}`.as('countyName'),
    })
    .from(churches)
    .leftJoin(counties, eq(churches.countyId, counties.id))
    .where(sql`${churches.status} IN ('Listed', 'Ready to list', 'Assess', 'Needs data', 'Unlisted')`)
    .orderBy(churches.name)
    .all()) as any[];

  const content = (
    <Layout
      title={`Edit ${affiliation.name}`}
      user={user}
      faviconUrl={faviconUrl}
      logoUrl={logoUrl}
      pages={navbarPages}
    >
      <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div class="mb-8">
          <h1 class="text-2xl font-semibold text-gray-900">Edit Affiliation</h1>
        </div>
        <AffiliationForm
          affiliation={affiliation}
          affiliatedChurches={affiliatedChurches}
          allChurches={allChurches}
          action={`/admin/affiliations/${id}`}
          cancelUrl="/admin/affiliations"
        />
      </div>
    </Layout>
  );

  return c.html(content);
});

// Update affiliation
adminAffiliationsRoutes.post('/:id', async (c) => {
  const db = createDbWithContext(c);
  const user = c.get('betterUser');
  const _logoUrl = await getLogoUrl(c.env);
  const id = Number(c.req.param('id'));

  try {
    // Use all: true to get multiple values for same-named fields (e.g., checkboxes)
    const body = await c.req.parseBody({ all: true });
    const parsedBody = parseFormBody(body);
    const validationResult = validateFormData(affiliationSchema, parsedBody);

    if (!validationResult.success) {
      const logoUrl = await getLogoUrl(c.env);
      const affiliation = await db.select().from(affiliations).where(eq(affiliations.id, id)).get();

      if (!affiliation) {
        return c.html(<NotFound />, 404);
      }

      // Re-fetch church data for error state
      const affiliatedChurches = (await db
        .select({
          id: churches.id,
          name: churches.name,
          status: churches.status,
          countyName: sql<string | null>`${counties.name}`.as('countyName'),
        })
        .from(churches)
        .innerJoin(churchAffiliations, eq(churches.id, churchAffiliations.churchId))
        .leftJoin(counties, eq(churches.countyId, counties.id))
        .where(eq(churchAffiliations.affiliationId, id))
        .orderBy(churches.name)
        .all()) as any[];

      const allChurches = (await db
        .select({
          id: churches.id,
          name: churches.name,
          status: churches.status,
          countyName: sql<string | null>`${counties.name}`.as('countyName'),
        })
        .from(churches)
        .leftJoin(counties, eq(churches.countyId, counties.id))
        .where(sql`${churches.status} IN ('Listed', 'Ready to list', 'Assess', 'Needs data', 'Unlisted')`)
        .orderBy(churches.name)
        .all()) as any[];

      const faviconUrl = await getFaviconUrl(c.env);
      const navbarPages = await getNavbarPages(c.env);
      return c.html(
        <Layout
          title={`Edit ${affiliation.name}`}
          user={user}
          logoUrl={logoUrl}
          faviconUrl={faviconUrl}
          pages={navbarPages}
        >
          <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div class="mb-8">
              <h1 class="text-2xl font-semibold text-gray-900">Edit Affiliation</h1>
            </div>
            <AffiliationForm
              affiliation={{ ...affiliation, ...parsedBody }}
              affiliatedChurches={affiliatedChurches}
              allChurches={allChurches}
              action={`/admin/affiliations/${id}`}
              cancelUrl="/admin/affiliations"
              error={validationResult.message}
            />
          </div>
        </Layout>
      );
    }

    const validatedData = validationResult.data;

    // Update affiliation details
    await db
      .update(affiliations)
      .set({
        name: validatedData.name,
        path: validatedData.path,
        status: validatedData.status,
        website: validatedData.website,
        publicNotes: validatedData.publicNotes,
        privateNotes: validatedData.privateNotes,
        updatedAt: new Date(),
      })
      .where(eq(affiliations.id, id));

    // Handle church relationships
    // When no checkboxes are selected, parsedBody.churches will be undefined
    // We need to treat this as an empty array (remove all churches)
    const selectedChurchIds = parsedBody.churches
      ? Array.isArray(parsedBody.churches)
        ? parsedBody.churches.map((id) => Number(id))
        : [Number(parsedBody.churches)]
      : []; // Empty array when no churches selected

    // Get current church affiliations
    const currentAffiliations = await db
      .select({ churchId: churchAffiliations.churchId })
      .from(churchAffiliations)
      .where(eq(churchAffiliations.affiliationId, id))
      .all();

    const currentChurchIds = currentAffiliations.map((ca) => ca.churchId);

    // Churches to add (selected but not currently affiliated)
    const churchesToAdd = selectedChurchIds.filter((churchId) => !currentChurchIds.includes(churchId));

    // Churches to remove (currently affiliated but not selected)
    const churchesToRemove = currentChurchIds.filter((churchId) => !selectedChurchIds.includes(churchId));

    // Add new church affiliations
    if (churchesToAdd.length > 0) {
      // Get max order for new entries

      const newAffiliations = churchesToAdd.map((churchId, index) => ({
        churchId,
        affiliationId: id,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      await db.insert(churchAffiliations).values(newAffiliations);
    }

    // Remove church affiliations
    if (churchesToRemove.length > 0) {
      await db
        .delete(churchAffiliations)
        .where(
          sql`${churchAffiliations.affiliationId} = ${id} AND ${churchAffiliations.churchId} IN (${churchesToRemove.join(',')})`
        );
    }

    // Invalidate cache for affiliation changes
    await cacheInvalidation.affiliation(c, id.toString());

    return c.redirect('/admin/affiliations');
  } catch (error) {
    console.error('Error updating affiliation:', error);
    const faviconUrl = await getFaviconUrl(c.env);
    const logoUrl = await getLogoUrl(c.env);
    const navbarPages = await getNavbarPages(c.env);
    return c.html(
      <Layout title="Error" user={user} faviconUrl={faviconUrl} logoUrl={logoUrl} pages={navbarPages}>
        <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div class="rounded-md bg-red-50 p-4">
            <h3 class="text-sm font-medium text-red-800">Error updating affiliation</h3>
            <p class="mt-2 text-sm text-red-700">{error instanceof Error ? error.message : 'Unknown error'}</p>
            <a href="/admin/affiliations" class="mt-4 inline-block text-sm font-medium text-red-600 hover:text-red-500">
              ← Back to affiliations
            </a>
          </div>
        </div>
      </Layout>
    );
  }
});

// Delete affiliation
adminAffiliationsRoutes.post('/:id/delete', async (c) => {
  const db = createDbWithContext(c);
  const id = Number(c.req.param('id'));

  // First delete all church affiliations
  await db.delete(churchAffiliations).where(eq(churchAffiliations.affiliationId, id));

  // Then delete the affiliation
  await db.delete(affiliations).where(eq(affiliations.id, id));

  // Invalidate cache for affiliation changes
  await cacheInvalidation.affiliation(c, id.toString());

  return c.redirect('/admin/affiliations');
});
