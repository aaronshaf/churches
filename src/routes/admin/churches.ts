import { Hono } from 'hono';
import { desc, eq, like, or, sql } from 'drizzle-orm';
import { createDb } from '../../db';
import {
  churches,
  churchGatherings,
  affiliations,
  churchAffiliations,
  counties,
  churchImages,
  comments,
} from '../../db/schema';
import { users } from '../../db/auth-schema';
import { Layout } from '../../components/Layout';
import { ChurchForm } from '../../components/ChurchForm';
import { NotFound } from '../../components/NotFound';
import { requireAdminWithRedirect } from '../../middleware/redirect-auth';
import { getLogoUrl } from '../../utils/settings';
import {
  churchWithGatheringsSchema,
  parseFormBody,
  parseGatheringsFromForm,
  parseAffiliationsFromForm,
  prepareChurchDataFromForm,
  validateFormData,
} from '../../utils/validation';
import { extractChurchDataFromWebsite } from '../../utils/website-extraction';
import { compareChurchData, createAuditComment } from '../../utils/audit-trail';
import {
  uploadToCloudflareImages,
  deleteFromCloudflareImages,
  getCloudflareImageUrl,
  IMAGE_VARIANTS,
} from '../../utils/cloudflare-images';
import type { Bindings } from '../../types';

type Variables = {
  user: any;
};

export const adminChurchesRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Apply admin middleware to all routes
adminChurchesRoutes.use('*', requireAdminWithRedirect);

// List churches with search and filters
adminChurchesRoutes.get('/', async (c) => {
  const db = createDb(c.env);
  const user = c.get('betterUser');

  const search = c.req.query('search') || '';
  const countyId = c.req.query('county');
  const affiliationId = c.req.query('affiliation');
  const status = c.req.query('status');

  // Build query
  let query = db
    .select({
      church: churches,
      county: counties,
    })
    .from(churches)
    .leftJoin(counties, eq(churches.countyId, counties.id));

  // Apply filters
  const conditions = [];
  if (search) {
    conditions.push(
      or(
        like(churches.name, `%${search}%`),
        like(churches.gatheringAddress, `%${search}%`)
      )
    );
  }
  if (countyId) {
    conditions.push(eq(churches.countyId, Number(countyId)));
  }
  if (status) {
    conditions.push(eq(churches.status, status as any));
  }

  if (conditions.length > 0) {
    query = query.where(sql`${conditions.reduce((acc, cond) => (acc ? sql`${acc} AND ${cond}` : cond), null)}`);
  }

  const results = await query.orderBy(desc(churches.updatedAt)).all();

  // Get affiliations for each church if filtering by affiliation
  let filteredResults = results;
  if (affiliationId) {
    const churchIds = results.map(r => r.church.id);
    const churchAffils = await db
      .select({ churchId: churchAffiliations.churchId })
      .from(churchAffiliations)
      .where(sql`${churchAffiliations.churchId} IN ${churchIds} AND ${churchAffiliations.affiliationId} = ${Number(affiliationId)}`)
      .all();
    
    const affiliatedChurchIds = new Set(churchAffils.map(ca => ca.churchId));
    filteredResults = results.filter(r => affiliatedChurchIds.has(r.church.id));
  }

  // Get all counties and affiliations for filters
  const [allCounties, allAffiliations] = await Promise.all([
    db.select().from(counties).orderBy(counties.name).all(),
    db.select().from(affiliations).orderBy(affiliations.name).all(),
  ]);

  const content = (
    <Layout title="Manage Churches" currentPath="/admin/churches" logoUrl={logoUrl} user={user}>
      <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div class="sm:flex sm:items-center">
          <div class="sm:flex-auto">
            <h1 class="text-2xl font-semibold text-gray-900">Churches</h1>
            <p class="mt-2 text-sm text-gray-700">
              A list of all churches including their name, status, county, and address.
            </p>
          </div>
          <div class="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
            <a
              href="/admin/churches/new"
              class="block rounded-md bg-primary-600 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
            >
              Add church
            </a>
          </div>
        </div>

        {/* Filters */}
        <div class="mt-6 bg-white shadow sm:rounded-lg">
          <div class="px-4 py-5 sm:p-6">
            <form method="GET" action="/admin/churches" class="space-y-4 sm:flex sm:space-x-4 sm:space-y-0">
              <div class="flex-1">
                <label for="search" class="sr-only">Search</label>
                <input
                  type="text"
                  name="search"
                  id="search"
                  value={search}
                  placeholder="Search churches..."
                  class="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
              </div>
              <div>
                <label for="county" class="sr-only">County</label>
                <select
                  name="county"
                  id="county"
                  class="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                >
                  <option value="">All Counties</option>
                  {allCounties.map(county => (
                    <option value={county.id} selected={countyId === String(county.id)}>
                      {county.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label for="affiliation" class="sr-only">Affiliation</label>
                <select
                  name="affiliation"
                  id="affiliation"
                  class="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                >
                  <option value="">All Affiliations</option>
                  {allAffiliations.map(affiliation => (
                    <option value={affiliation.id} selected={affiliationId === String(affiliation.id)}>
                      {affiliation.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label for="status" class="sr-only">Status</label>
                <select
                  name="status"
                  id="status"
                  class="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                >
                  <option value="">All Statuses</option>
                  <option value="Listed" selected={status === 'Listed'}>Listed</option>
                  <option value="Ready to list" selected={status === 'Ready to list'}>Ready to list</option>
                  <option value="Assess" selected={status === 'Assess'}>Assess</option>
                  <option value="Needs data" selected={status === 'Needs data'}>Needs data</option>
                  <option value="Unlisted" selected={status === 'Unlisted'}>Unlisted</option>
                  <option value="Heretical" selected={status === 'Heretical'}>Heretical</option>
                  <option value="Closed" selected={status === 'Closed'}>Closed</option>
                </select>
              </div>
              <button
                type="submit"
                class="inline-flex items-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
              >
                Filter
              </button>
            </form>
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
                      County
                    </th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Address
                    </th>
                    <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-0">
                      <span class="sr-only">Edit</span>
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  {filteredResults.map(({ church, county }) => (
                    <tr key={church.id}>
                      <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0">
                        {church.name}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        <span class={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                          church.status === 'Listed' ? 'bg-green-50 text-green-700' :
                          church.status === 'Ready to list' ? 'bg-blue-50 text-blue-700' :
                          church.status === 'Assess' ? 'bg-yellow-50 text-yellow-700' :
                          church.status === 'Needs data' ? 'bg-orange-50 text-orange-700' :
                          church.status === 'Unlisted' ? 'bg-gray-50 text-gray-700' :
                          church.status === 'Heretical' ? 'bg-red-50 text-red-700' :
                          church.status === 'Closed' ? 'bg-gray-50 text-gray-700' :
                          'bg-gray-50 text-gray-700'
                        }`}>
                          {church.status}
                        </span>
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {county?.name || '-'}
                      </td>
                      <td class="px-3 py-4 text-sm text-gray-500">
                        {church.gatheringAddress || '-'}
                      </td>
                      <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                        <a href={`/admin/churches/${church.id}/edit`} class="text-primary-600 hover:text-primary-900">
                          Edit<span class="sr-only">, {church.name}</span>
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredResults.length === 0 && (
                <div class="text-center py-12">
                  <p class="text-sm text-gray-500">No churches found matching your criteria.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );

  return c.html(content);
});

// New church form
adminChurchesRoutes.get('/new', async (c) => {
  const db = createDb(c.env);
  const user = c.get('betterUser');
  const logoUrl = await getLogoUrl(c.env);

  const [allCounties, allAffiliations] = await Promise.all([
    db.select().from(counties).orderBy(counties.name).all(),
    db.select().from(affiliations).orderBy(affiliations.name).all(),
  ]);

  const content = (
    <Layout title="Add Church" currentPath="/admin/churches" logoUrl={logoUrl} user={user}>
      <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div class="mb-8">
          <h1 class="text-2xl font-semibold text-gray-900">Add Church</h1>
        </div>
        <ChurchForm
          church={null}
          gatherings={[]}
          churchAffiliations={[]}
          images={[]}
          counties={allCounties}
          affiliations={allAffiliations}
          action="/admin/churches"
          cancelUrl="/admin/churches"
        />
      </div>
    </Layout>
  );

  return c.html(content);
});

// Create church
adminChurchesRoutes.post('/', async (c) => {
  const db = createDb(c.env);
  const user = c.get('betterUser');
  const logoUrl = await getLogoUrl(c.env);

  try {
    const body = await c.req.parseBody();
    const parsedBody = parseFormBody(body);

    // Validate church data
    const validatedData = await validateFormData(parsedBody, churchWithGatheringsSchema);
    const { gatherings: validatedGatherings, affiliations: validatedAffiliations, ...validatedChurchData } = validatedData;

    // Prepare church data for insertion
    const churchData = prepareChurchDataFromForm(validatedChurchData);

    // Insert church
    const result = await db.insert(churches).values(churchData).returning();
    const church = result[0];

    // Insert gatherings
    if (validatedGatherings && validatedGatherings.length > 0) {
      const gatheringsToInsert = validatedGatherings.map((g) => ({
        churchId: church.id,
        time: g.time,
        notes: g.notes || null,
      }));
      await db.insert(churchGatherings).values(gatheringsToInsert);
    }

    // Insert affiliations
    if (validatedAffiliations && validatedAffiliations.length > 0) {
      const affiliationsToInsert = validatedAffiliations.map((affiliationId) => ({
        churchId: church.id,
        affiliationId: Number(affiliationId),
      }));
      await db.insert(churchAffiliations).values(affiliationsToInsert);
    }

    // Create audit trail comment
    try {
      const auditComment = createAuditComment(
        user.name || user.email,
        'created church',
        []
      );
      
      await db.insert(comments).values({
        userId: user.id,
        churchId: church.id,
        content: auditComment,
        type: 'system',
        metadata: JSON.stringify({ action: 'create' }),
        isPublic: false,
        status: 'approved',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Failed to create audit trail:', error);
    }

    return c.redirect('/admin/churches');
  } catch (error) {
    console.error('Error creating church:', error);
    return c.html(
      <Layout title="Error" currentPath="/admin/churches" logoUrl={logoUrl} user={user}>
        <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div class="rounded-md bg-red-50 p-4">
            <h3 class="text-sm font-medium text-red-800">Error creating church</h3>
            <p class="mt-2 text-sm text-red-700">{error instanceof Error ? error.message : 'Unknown error'}</p>
            <a href="/admin/churches" class="mt-4 inline-block text-sm font-medium text-red-600 hover:text-red-500">
              ← Back to churches
            </a>
          </div>
        </div>
      </Layout>
    );
  }
});

// Edit church form
adminChurchesRoutes.get('/:id/edit', async (c) => {
  const db = createDb(c.env);
  const user = c.get('betterUser');
  const logoUrl = await getLogoUrl(c.env);
  const id = Number(c.req.param('id'));

  const [church, gatherings, churchAffils, images, allCounties, allAffiliations] = await Promise.all([
    db.select().from(churches).where(eq(churches.id, id)).get(),
    db.select().from(churchGatherings).where(eq(churchGatherings.churchId, id)).all(),
    db.select().from(churchAffiliations).where(eq(churchAffiliations.churchId, id)).all(),
    db.select().from(churchImages).where(eq(churchImages.churchId, id)).all(),
    db.select().from(counties).orderBy(counties.name).all(),
    db.select().from(affiliations).orderBy(affiliations.name).all(),
  ]);

  if (!church) {
    return c.html(<NotFound />, 404);
  }

  const content = (
    <Layout title={`Edit ${church.name}`} currentPath="/admin/churches" logoUrl={logoUrl} user={user}>
      <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div class="mb-8">
          <h1 class="text-2xl font-semibold text-gray-900">Edit Church</h1>
        </div>
        <ChurchForm
          church={church}
          gatherings={gatherings}
          churchAffiliations={churchAffils}
          images={images}
          counties={allCounties}
          affiliations={allAffiliations}
          action={`/admin/churches/${id}`}
          cancelUrl="/admin/churches"
        />
      </div>
    </Layout>
  );

  return c.html(content);
});

// Update church (includes image upload)
adminChurchesRoutes.post('/:id', async (c) => {
  const db = createDb(c.env);
  const user = c.get('betterUser');
  const logoUrl = await getLogoUrl(c.env);
  const id = Number(c.req.param('id'));

  try {
    // Get old church data for audit trail
    const [oldChurch, oldGatherings, oldAffiliations] = await Promise.all([
      db.select().from(churches).where(eq(churches.id, id)).get(),
      db.select().from(churchGatherings).where(eq(churchGatherings.churchId, id)).all(),
      db.select({
        id: affiliations.id,
        name: affiliations.name,
        path: affiliations.path,
      })
      .from(churchAffiliations)
      .innerJoin(affiliations, eq(churchAffiliations.affiliationId, affiliations.id))
      .where(eq(churchAffiliations.churchId, id))
      .all(),
    ]);

    if (!oldChurch) {
      return c.html(<NotFound />, 404);
    }

    const body = await c.req.parseBody();
    
    // Handle image upload if present
    if (body.image && body.image instanceof File && body.image.size > 0) {
      try {
        const imageId = await uploadToCloudflareImages(c.env, body.image, `church-${id}`);
        
        // Save image record
        await db.insert(churchImages).values({
          churchId: id,
          cloudflareId: imageId,
          createdAt: new Date(),
        });
      } catch (error) {
        console.error('Error uploading image:', error);
      }
    }

    // Handle image deletion
    const deleteImageId = body.deleteImage;
    if (deleteImageId) {
      const imageToDelete = await db
        .select()
        .from(churchImages)
        .where(eq(churchImages.id, Number(deleteImageId)))
        .get();
      
      if (imageToDelete) {
        await deleteFromCloudflareImages(c.env, imageToDelete.cloudflareId);
        await db.delete(churchImages).where(eq(churchImages.id, Number(deleteImageId)));
      }
    }

    // Parse and validate form data
    const parsedBody = parseFormBody(body);
    const validatedData = await validateFormData(parsedBody, churchWithGatheringsSchema);
    const { gatherings: validatedGatherings, affiliations: validatedAffiliations, ...validatedChurchData } = validatedData;

    // Prepare church data for update
    const churchData = prepareChurchDataFromForm(validatedChurchData);

    // Update church
    await db.update(churches).set(churchData).where(eq(churches.id, id));

    // Update gatherings
    await db.delete(churchGatherings).where(eq(churchGatherings.churchId, id));
    if (validatedGatherings && validatedGatherings.length > 0) {
      const gatheringsToInsert = validatedGatherings.map((g) => ({
        churchId: id,
        time: g.time,
        notes: g.notes || null,
      }));
      await db.insert(churchGatherings).values(gatheringsToInsert);
    }

    // Update affiliations
    await db.delete(churchAffiliations).where(eq(churchAffiliations.churchId, id));
    if (validatedAffiliations && validatedAffiliations.length > 0) {
      const affiliationsToInsert = validatedAffiliations.map((affiliationId) => ({
        churchId: id,
        affiliationId: Number(affiliationId),
      }));
      await db.insert(churchAffiliations).values(affiliationsToInsert);
    }

    // Get new affiliations for audit trail
    const newAffiliations = validatedAffiliations ? await db
      .select({
        id: affiliations.id,
        name: affiliations.name,
        path: affiliations.path,
      })
      .from(affiliations)
      .where(sql`${affiliations.id} IN ${validatedAffiliations.map(Number)}`)
      .all() : [];

    // Create audit trail comment
    try {
      const changes = compareChurchData(
        oldChurch,
        validatedChurchData,
        oldGatherings,
        validatedGatherings,
        oldAffiliations,
        newAffiliations
      );
      
      if (changes.length > 0) {
        const auditComment = createAuditComment(
          user.name || user.email,
          'updated church data',
          changes
        );
        
        await db.insert(comments).values({
          userId: user.id,
          churchId: id,
          content: auditComment,
          type: 'system',
          metadata: JSON.stringify({ changes }),
          isPublic: false,
          status: 'approved',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    } catch (error) {
      console.error('Failed to create audit trail:', error);
    }

    return c.redirect('/admin/churches');
  } catch (error) {
    console.error('Error updating church:', error);
    return c.html(
      <Layout title="Error" currentPath="/admin/churches" logoUrl={logoUrl} user={user}>
        <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div class="rounded-md bg-red-50 p-4">
            <h3 class="text-sm font-medium text-red-800">Error updating church</h3>
            <p class="mt-2 text-sm text-red-700">{error instanceof Error ? error.message : 'Unknown error'}</p>
            <a href="/admin/churches" class="mt-4 inline-block text-sm font-medium text-red-600 hover:text-red-500">
              ← Back to churches
            </a>
          </div>
        </div>
      </Layout>
    );
  }
});

// Delete church
adminChurchesRoutes.post('/:id/delete', async (c) => {
  const db = createDb(c.env);
  const id = Number(c.req.param('id'));

  // Delete related data first
  await db.delete(churchGatherings).where(eq(churchGatherings.churchId, id));
  await db.delete(churchAffiliations).where(eq(churchAffiliations.churchId, id));
  await db.delete(comments).where(eq(comments.churchId, id));
  
  // Delete images
  const images = await db.select().from(churchImages).where(eq(churchImages.churchId, id)).all();
  for (const image of images) {
    await deleteFromCloudflareImages(c.env, image.cloudflareId);
  }
  await db.delete(churchImages).where(eq(churchImages.churchId, id));

  // Delete church
  await db.delete(churches).where(eq(churches.id, id));

  return c.redirect('/admin/churches');
});

// Extract website data
adminChurchesRoutes.post('/:id/extract', async (c) => {
  const user = c.get('betterUser');
  const id = Number(c.req.param('id'));
  const { website } = await c.req.json();

  if (!website) {
    return c.json({ error: 'Website URL is required' }, 400);
  }

  try {
    const extractedData = await extractChurchDataFromWebsite(c.env, website);
    return c.json(extractedData);
  } catch (error) {
    console.error('Error extracting website data:', error);
    return c.json({ error: 'Failed to extract data from website' }, 500);
  }
});