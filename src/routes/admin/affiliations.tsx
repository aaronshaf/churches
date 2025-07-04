import { Hono } from 'hono';
import { desc, eq } from 'drizzle-orm';
import { createDb, createDbWithContext } from '../../db';
import { affiliations, churchAffiliations } from '../../db/schema';
import { Layout } from '../../components/Layout';
import { AffiliationForm } from '../../components/AffiliationForm';
import { NotFound } from '../../components/NotFound';
import { requireAdminWithRedirect } from '../../middleware/redirect-auth';
import {
  affiliationSchema,
  parseFormBody,
  validateFormData,
} from '../../utils/validation';
import { getLogoUrl } from '../../utils/settings';
import type { Bindings } from '../../types';

type Variables = {
  user: any;
};

export const adminAffiliationsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Apply admin middleware to all routes
adminAffiliationsRoutes.use('*', requireAdminWithRedirect);

// List affiliations
adminAffiliationsRoutes.get('/', async (c) => {
  const db = createDbWithContext(c);
  const user = c.get('betterUser');
  const logoUrl = await getLogoUrl(c.env);

  const allAffiliations = await db
    .select()
    .from(affiliations)
    .orderBy(desc(affiliations.updatedAt))
    .all();

  const content = (
    <Layout title="Manage Affiliations" user={user}>
      <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div class="sm:flex sm:items-center">
          <div class="sm:flex-auto">
            <h1 class="text-2xl font-semibold text-gray-900">Affiliations</h1>
            <p class="mt-2 text-sm text-gray-700">
              A list of all church affiliations and networks.
            </p>
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
                        {affiliation.name}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        <span class={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                          affiliation.status === 'Listed' ? 'bg-green-50 text-green-700' :
                          affiliation.status === 'Unlisted' ? 'bg-gray-50 text-gray-700' :
                          'bg-red-50 text-red-700'
                        }`}>
                          {affiliation.status}
                        </span>
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {affiliation.path}
                      </td>
                      <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                        <a href={`/admin/affiliations/${affiliation.id}/edit`} class="text-primary-600 hover:text-primary-900">
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
  const logoUrl = await getLogoUrl(c.env);

  const content = (
    <Layout title="Add Affiliation" user={user}>
      <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div class="mb-8">
          <h1 class="text-2xl font-semibold text-gray-900">Add Affiliation</h1>
        </div>
        <AffiliationForm
          affiliation={null}
          action="/admin/affiliations"
          cancelUrl="/admin/affiliations"
        />
      </div>
    </Layout>
  );

  return c.html(content);
});

// Create affiliation
adminAffiliationsRoutes.post('/', async (c) => {
  const db = createDbWithContext(c);
  const user = c.get('betterUser');
  const logoUrl = await getLogoUrl(c.env);

  try {
    const body = await c.req.parseBody();
    const parsedBody = parseFormBody(body);
    const validatedData = await validateFormData(affiliationSchema, parsedBody);

    await db.insert(affiliations).values({
      name: validatedData.name,
      path: validatedData.path,
      status: validatedData.status,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return c.redirect('/admin/affiliations');
  } catch (error) {
    console.error('Error creating affiliation:', error);
    return c.html(
      <Layout title="Error" user={user}>
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
  const id = Number(c.req.param('id'));

  const affiliation = await db.select().from(affiliations).where(eq(affiliations.id, id)).get();

  if (!affiliation) {
    return c.html(<NotFound />, 404);
  }

  const content = (
    <Layout title={`Edit ${affiliation.name}`} user={user}>
      <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div class="mb-8">
          <h1 class="text-2xl font-semibold text-gray-900">Edit Affiliation</h1>
        </div>
        <AffiliationForm
          affiliation={affiliation}
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
  const logoUrl = await getLogoUrl(c.env);
  const id = Number(c.req.param('id'));

  try {
    const body = await c.req.parseBody();
    const parsedBody = parseFormBody(body);
    const validatedData = await validateFormData(affiliationSchema, parsedBody);

    await db.update(affiliations).set({
      name: validatedData.name,
      path: validatedData.path,
      status: validatedData.status,
      updatedAt: new Date(),
    }).where(eq(affiliations.id, id));

    return c.redirect('/admin/affiliations');
  } catch (error) {
    console.error('Error updating affiliation:', error);
    return c.html(
      <Layout title="Error" user={user}>
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

  return c.redirect('/admin/affiliations');
});