import { desc, eq, like, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { ChurchForm } from '../../components/ChurchForm';
import { Layout } from '../../components/Layout';
import { NotFound } from '../../components/NotFound';
import { Toast } from '../../components/Toast';
import { createDbWithContext } from '../../db';
import {
  affiliations,
  churchAffiliations,
  churches,
  churchGatherings,
  churchImages,
  comments,
  counties,
} from '../../db/schema';
import { requireAdminWithRedirect } from '../../middleware/redirect-auth';
import type { AuthenticatedVariables, Bindings, ChurchStatus } from '../../types';
import { compareChurchData, createAuditComment } from '../../utils/audit-trail';
import { batchedInQuery, createInClause } from '../../utils/db-helpers';
import { deleteImage, uploadImage } from '../../utils/r2-images';
import { getLogoUrl } from '../../utils/settings';
import {
  churchWithGatheringsSchema,
  parseAffiliationsFromForm,
  parseFormBody,
  parseGatheringsFromForm,
  prepareChurchDataFromForm,
  validateFormData,
} from '../../utils/validation';
import { extractChurchDataFromWebsite } from '../../utils/website-extraction';

type Variables = AuthenticatedVariables;

export const adminChurchesRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Apply admin middleware to all routes
adminChurchesRoutes.use('*', requireAdminWithRedirect);

// List churches with search and filters
adminChurchesRoutes.get('/', async (c) => {
  const db = createDbWithContext(c);
  const user = c.get('betterUser');

  const search = c.req.query('search') || '';
  const countyId = c.req.query('county');
  const affiliationId = c.req.query('affiliation');
  const status = c.req.query('status');

  // Check for success message parameters
  const success = c.req.query('success');
  const churchName = c.req.query('churchName');
  const churchPath = c.req.query('churchPath');

  // Build base query
  const baseQuery = db
    .select({
      church: churches,
      county: counties,
    })
    .from(churches)
    .leftJoin(counties, eq(churches.countyId, counties.id));

  // Apply filters
  const conditions = [];
  if (search) {
    conditions.push(or(like(churches.name, `%${search}%`), like(churches.gatheringAddress, `%${search}%`)));
  }
  if (countyId) {
    conditions.push(eq(churches.countyId, Number(countyId)));
  }
  if (status) {
    conditions.push(eq(churches.status, status as ChurchStatus));
  }

  const query =
    conditions.length > 0
      ? baseQuery.where(conditions.reduce((acc, cond) => (acc ? sql`${acc} AND ${cond}` : cond), undefined)!)
      : baseQuery;

  const results = await query.orderBy(desc(churches.updatedAt)).all();

  // Get all church affiliations for the filtered churches
  const churchIds = results.map((r) => r.church.id);

  // Use batched query to avoid SQLite's "too many SQL variables" error
  const allChurchAffils = await batchedInQuery(
    churchIds,
    100, // Safe batch size well below SQLite's limit
    async (batchIds) =>
      db
        .select({
          churchId: churchAffiliations.churchId,
          affiliationId: churchAffiliations.affiliationId,
        })
        .from(churchAffiliations)
        .where(createInClause(churchAffiliations.churchId, batchIds))
        .all()
  );

  // Filter by affiliation if needed
  let filteredResults = results;
  if (affiliationId) {
    const affiliatedChurchIds = new Set(
      allChurchAffils.filter((ca) => ca.affiliationId === Number(affiliationId)).map((ca) => ca.churchId)
    );
    filteredResults = results.filter((r) => affiliatedChurchIds.has(r.church.id));
  }

  // Get all counties and affiliations for filters
  const [allCounties, allAffiliations] = await Promise.all([
    db.select().from(counties).orderBy(counties.name).all(),
    db.select().from(affiliations).orderBy(affiliations.name).all(),
  ]);

  // Prepare church data for client-side filtering
  const churchesData = filteredResults.map(({ church, county }) => ({
    id: church.id,
    name: church.name,
    path: church.path,
    status: church.status,
    countyId: church.countyId,
    countyName: county?.name || '',
    address: church.gatheringAddress || '',
    // For affiliation filtering, we need the affiliation IDs
    affiliationIds: allChurchAffils.filter((ca) => ca.churchId === church.id).map((ca) => ca.affiliationId),
  }));

  const content = (
    <Layout title="Manage Churches" user={user} currentPath="/admin/churches">
      {success && (
        <Toast
          message={success === 'created' ? 'Church created successfully!' : 'Church updated successfully!'}
          churchName={churchName}
          churchPath={churchPath}
          type="success"
        />
      )}
      <script
        dangerouslySetInnerHTML={{
          __html: `
          window.churchesData = ${JSON.stringify(churchesData)};
          window.allChurchAffiliations = ${JSON.stringify(allChurchAffils)};
        `,
        }}
      />
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
        <div class="mt-6">
          <div class="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
            <div class="px-4 py-6 sm:p-8">
              <div class="mb-4 flex items-center justify-between">
                <h3 class="text-base font-semibold leading-6 text-gray-900">Filters</h3>
                <div id="filter-loading" class="hidden">
                  <svg
                    class="animate-spin h-5 w-5 text-gray-400"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                </div>
              </div>
              <div class="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
                <form
                  method="get"
                  action="/admin/churches"
                  id="church-filters-form"
                  class="col-span-full grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-6"
                >
                  {/* Search field - spans 2 columns on desktop */}
                  <div class="sm:col-span-2">
                    <label for="search" class="block text-sm font-medium leading-6 text-gray-900">
                      Search
                    </label>
                    <div class="mt-2">
                      <div class="relative rounded-md shadow-sm">
                        <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <svg class="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path
                              fill-rule="evenodd"
                              d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                              clip-rule="evenodd"
                            />
                          </svg>
                        </div>
                        <input
                          type="text"
                          name="search"
                          id="search"
                          value={search}
                          placeholder="Search by name or address..."
                          class="block w-full rounded-md border-0 py-2 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                        />
                      </div>
                    </div>
                  </div>

                  {/* County select */}
                  <div class="sm:col-span-1">
                    <label for="county" class="block text-sm font-medium leading-6 text-gray-900">
                      County
                    </label>
                    <div class="mt-2">
                      <select
                        name="county"
                        id="county"
                        class="block w-full rounded-md border-0 py-2 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-primary-600 sm:text-sm sm:leading-6"
                      >
                        <option value="">All Counties</option>
                        {allCounties.map((county) => (
                          <option value={county.id} selected={countyId === String(county.id)}>
                            {county.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Affiliation select */}
                  <div class="sm:col-span-1">
                    <label for="affiliation" class="block text-sm font-medium leading-6 text-gray-900">
                      Affiliation
                    </label>
                    <div class="mt-2">
                      <select
                        name="affiliation"
                        id="affiliation"
                        class="block w-full rounded-md border-0 py-2 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-primary-600 sm:text-sm sm:leading-6"
                      >
                        <option value="">All Affiliations</option>
                        {allAffiliations.map((affiliation) => (
                          <option value={affiliation.id} selected={affiliationId === String(affiliation.id)}>
                            {affiliation.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Status select */}
                  <div class="sm:col-span-1">
                    <label for="status" class="block text-sm font-medium leading-6 text-gray-900">
                      Status
                    </label>
                    <div class="mt-2">
                      <select
                        name="status"
                        id="status"
                        class="block w-full rounded-md border-0 py-2 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-primary-600 sm:text-sm sm:leading-6"
                      >
                        <option value="">All Statuses</option>
                        <option value="Listed" selected={status === 'Listed'}>
                          Listed
                        </option>
                        <option value="Ready to list" selected={status === 'Ready to list'}>
                          Ready to list
                        </option>
                        <option value="Assess" selected={status === 'Assess'}>
                          Assess
                        </option>
                        <option value="Needs data" selected={status === 'Needs data'}>
                          Needs data
                        </option>
                        <option value="Unlisted" selected={status === 'Unlisted'}>
                          Unlisted
                        </option>
                        <option value="Heretical" selected={status === 'Heretical'}>
                          Heretical
                        </option>
                        <option value="Closed" selected={status === 'Closed'}>
                          Closed
                        </option>
                      </select>
                    </div>
                  </div>

                  {/* Clear filters link - only show if filters are active */}
                  {(search || countyId || affiliationId || status) && (
                    <div id="clear-filters-section" class="sm:col-span-6 mt-4 pt-4 border-t border-gray-200">
                      <div class="flex items-center justify-between">
                        <div class="flex items-center text-sm text-gray-600">
                          <svg class="mr-2 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                            />
                          </svg>
                          <span>
                            Filters active:{' '}
                            {[
                              search && 'Search',
                              countyId && 'County',
                              affiliationId && 'Affiliation',
                              status && 'Status',
                            ]
                              .filter(Boolean)
                              .join(', ')}
                          </span>
                        </div>
                        <a
                          href="/admin/churches"
                          class="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                        >
                          <svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                          Clear filters
                        </a>
                      </div>
                    </div>
                  )}
                </form>
              </div>
            </div>
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
                    <tr
                      key={church.id}
                      data-church-id={church.id}
                      data-church-name={church.name.toLowerCase()}
                      data-church-address={(church.gatheringAddress || '').toLowerCase()}
                      data-church-status={church.status || ''}
                      data-church-county={county?.name || ''}
                      data-church-county-id={church.countyId || ''}
                    >
                      <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium sm:pl-0">
                        <a
                          href={`/churches/${church.path}`}
                          class="text-primary-600 hover:text-primary-800 hover:underline"
                        >
                          {church.name}
                        </a>
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        <span
                          class={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                            church.status === 'Listed'
                              ? 'bg-green-50 text-green-700'
                              : church.status === 'Ready to list'
                                ? 'bg-blue-50 text-blue-700'
                                : church.status === 'Assess'
                                  ? 'bg-yellow-50 text-yellow-700'
                                  : church.status === 'Needs data'
                                    ? 'bg-orange-50 text-orange-700'
                                    : church.status === 'Unlisted'
                                      ? 'bg-gray-50 text-gray-700'
                                      : church.status === 'Heretical'
                                        ? 'bg-red-50 text-red-700'
                                        : church.status === 'Closed'
                                          ? 'bg-gray-50 text-gray-700'
                                          : 'bg-gray-50 text-gray-700'
                          }`}
                        >
                          {church.status}
                        </span>
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{county?.name || '-'}</td>
                      <td class="px-3 py-4 text-sm text-gray-500">{church.gatheringAddress || '-'}</td>
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

      <script
        dangerouslySetInnerHTML={{
          __html: `
        (function() {
          const searchInput = document.getElementById('search');
          const countySelect = document.getElementById('county');
          const affiliationSelect = document.getElementById('affiliation');
          const statusSelect = document.getElementById('status');
          const filterForm = document.getElementById('church-filters-form');
          const clearFiltersSection = document.getElementById('clear-filters-section');
          const tableBody = document.querySelector('tbody');
          const filterLoading = document.getElementById('filter-loading');
          
          if (!filterForm || !tableBody) return;

          // Store all church rows for filtering
          const allRows = Array.from(tableBody.querySelectorAll('tr[data-church-id]'));
          
          // Function to filter rows
          function filterRows() {
            const searchTerm = searchInput.value.toLowerCase();
            const selectedCounty = countySelect.value;
            const selectedStatus = statusSelect.value;
            
            let visibleCount = 0;
            
            allRows.forEach(row => {
              let visible = true;
              
              // Search filter (name or address)
              if (searchTerm) {
                const name = row.getAttribute('data-church-name') || '';
                const address = row.getAttribute('data-church-address') || '';
                if (!name.includes(searchTerm) && !address.includes(searchTerm)) {
                  visible = false;
                }
              }
              
              // County filter
              if (selectedCounty && row.getAttribute('data-church-county-id') !== selectedCounty) {
                visible = false;
              }
              
              // Status filter
              if (selectedStatus && row.getAttribute('data-church-status') !== selectedStatus) {
                visible = false;
              }
              
              // Show/hide row
              row.style.display = visible ? '' : 'none';
              if (visible) visibleCount++;
            });
            
            // Show/hide "no results" message
            let noResultsRow = tableBody.querySelector('.no-results');
            if (visibleCount === 0 && allRows.length > 0) {
              if (!noResultsRow) {
                noResultsRow = document.createElement('tr');
                noResultsRow.className = 'no-results';
                noResultsRow.innerHTML = '<td colspan="5" class="text-center py-12 text-sm text-gray-500">No churches found matching your criteria.</td>';
                tableBody.appendChild(noResultsRow);
              }
              noResultsRow.style.display = '';
            } else if (noResultsRow) {
              noResultsRow.style.display = 'none';
            }
            
            // Update URL without page reload
            updateURL();
            
            // Update clear filters visibility
            updateClearFiltersVisibility();
          }

          // Function to update URL
          function updateURL() {
            const params = new URLSearchParams();
            
            if (searchInput.value) params.append('search', searchInput.value);
            if (countySelect.value) params.append('county', countySelect.value);
            if (affiliationSelect.value) params.append('affiliation', affiliationSelect.value);
            if (statusSelect.value) params.append('status', statusSelect.value);
            
            const newUrl = params.toString() ? window.location.pathname + '?' + params.toString() : window.location.pathname;
            window.history.replaceState({}, '', newUrl);
          }

          // Function to update clear filters visibility
          function updateClearFiltersVisibility() {
            const hasFilters = searchInput.value || countySelect.value || affiliationSelect.value || statusSelect.value;
            if (clearFiltersSection) {
              clearFiltersSection.style.display = hasFilters ? 'block' : 'none';
            }
          }

          // Add event listeners for instant filtering
          searchInput.addEventListener('input', filterRows);
          countySelect.addEventListener('change', filterRows);
          statusSelect.addEventListener('change', filterRows);

          // Prevent form submission
          filterForm.addEventListener('submit', function(e) {
            e.preventDefault();
          });
          
          // Note: Affiliation filtering requires server-side logic due to many-to-many relationship
          // For now, affiliation filter will trigger a page reload
          affiliationSelect.addEventListener('change', function() {
            if (filterLoading) filterLoading.classList.remove('hidden');
            filterForm.submit();
          });
          
          // Initialize on page load
          updateClearFiltersVisibility();
        })();
        `,
        }}
      />
    </Layout>
  );

  return c.html(content);
});

// New church form
adminChurchesRoutes.get('/new', async (c) => {
  const db = createDbWithContext(c);
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
          church={undefined}
          gatherings={[]}
          churchAffiliations={[]}
          churchImages={[]}
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
  const db = createDbWithContext(c);
  const user = c.get('betterUser');
  const logoUrl = await getLogoUrl(c.env);

  try {
    const body = await c.req.parseBody({ all: true });
    const parsedBody = parseFormBody(body);

    // Parse gatherings and affiliations from form
    const gatherings = parseGatheringsFromForm(parsedBody);
    const formAffiliations = parseAffiliationsFromForm(parsedBody);

    // Structure data for validation
    const dataToValidate = {
      church: parsedBody,
      gatherings,
      affiliations: formAffiliations,
    };

    const validationResult = validateFormData(churchWithGatheringsSchema, dataToValidate);

    if (!validationResult.success) {
      console.error('Validation errors:', validationResult.errors);

      // Build detailed error message
      const errorMessages = [];
      for (const [field, errors] of Object.entries(validationResult.errors)) {
        if (errors && errors.length > 0) {
          const fieldName = field
            .replace(/^church\./, '')
            .replace(/([A-Z])/g, ' $1')
            .trim();
          errorMessages.push(`${fieldName}: ${errors.join(', ')}`);
        }
      }

      const detailedMessage = errorMessages.length > 0 ? errorMessages.join('; ') : validationResult.message;

      throw new Error(detailedMessage);
    }

    const {
      church: validatedChurchData,
      gatherings: validatedGatherings,
      affiliations: validatedAffiliations,
    } = validationResult.data;

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
      const affiliationsToInsert = validatedAffiliations.map((affiliationId, index) => ({
        churchId: church.id,
        affiliationId: Number(affiliationId),
      }));
      await db.insert(churchAffiliations).values(affiliationsToInsert);
    }

    // Handle image uploads for new church
    const newImages = body.newImages;
    if (newImages) {
      const files = Array.isArray(newImages) ? newImages : [newImages];
      const uploadedImages: { path: string }[] = [];

      for (const file of files) {
        if (file instanceof File && file.size > 0) {
          try {
            const result = await uploadImage(file, 'churches', c.env);
            uploadedImages.push({ path: result.path });
          } catch (error) {
            console.error('Error uploading image:', error);
            // Continue with the creation even if image upload fails
          }
        }
      }

      // Insert uploaded images
      if (uploadedImages.length > 0) {
        const imagesToInsert = uploadedImages.map((img, index) => ({
          churchId: church.id,
          imagePath: img.path,
          imageAlt: null,
          caption: null,
          isFeatured: index === 0, // First image is featured
          sortOrder: index,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

        await db.insert(churchImages).values(imagesToInsert);
      }
    }

    // Create audit trail comment
    try {
      const auditComment = createAuditComment(user.name || user.email, 'created church', []);

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

    // Redirect to the church page
    if (church.path) {
      return c.redirect(`/churches/${church.path}`);
    } else {
      // Fallback to admin list if no path
      const params = new URLSearchParams({
        success: 'created',
        churchName: church.name,
      });
      return c.redirect(`/admin/churches?${params.toString()}`);
    }
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
  const db = createDbWithContext(c);
  const user = c.get('betterUser');
  const logoUrl = await getLogoUrl(c.env);
  const id = Number(c.req.param('id'));

  // Check for success message parameters
  const success = c.req.query('success');
  const churchName = c.req.query('churchName');
  const churchPath = c.req.query('churchPath');

  const [church, gatherings, churchAffils, images, allCounties, allAffiliations] = await Promise.all([
    db.select().from(churches).where(eq(churches.id, id)).get(),
    db.select().from(churchGatherings).where(eq(churchGatherings.churchId, id)).all(),
    db.select().from(churchAffiliations).where(eq(churchAffiliations.churchId, id)).all(),
    db
      .select()
      .from(churchImages)
      .where(eq(churchImages.churchId, id))
      .orderBy(churchImages.sortOrder, churchImages.createdAt)
      .all(),
    db.select().from(counties).orderBy(counties.name).all(),
    db.select().from(affiliations).orderBy(affiliations.name).all(),
  ]);

  if (!church) {
    return c.html(<NotFound />, 404);
  }

  const content = (
    <Layout title={`Edit ${church.name}`} currentPath="/admin/churches" logoUrl={logoUrl} user={user}>
      {success && (
        <Toast message="Church updated successfully!" churchName={churchName} churchPath={churchPath} type="success" />
      )}
      <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div class="mb-8">
          <h1 class="text-2xl font-semibold text-gray-900">Edit Church</h1>
        </div>
        <ChurchForm
          church={church}
          gatherings={gatherings}
          churchAffiliations={churchAffils}
          churchImages={images}
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
  const db = createDbWithContext(c);
  const user = c.get('betterUser');
  const logoUrl = await getLogoUrl(c.env);
  const id = Number(c.req.param('id'));

  try {
    // Get old church data for audit trail
    const [oldChurch, oldGatherings, oldAffiliations] = await Promise.all([
      db.select().from(churches).where(eq(churches.id, id)).get(),
      db.select().from(churchGatherings).where(eq(churchGatherings.churchId, id)).all(),
      db
        .select({
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

    const body = await c.req.parseBody({ all: true });

    // Handle multiple image uploads
    const newImages = body.newImages;
    const uploadedImages: { path: string }[] = [];

    // Upload new images if any
    if (newImages) {
      const files = Array.isArray(newImages) ? newImages : [newImages];
      for (const file of files) {
        if (file instanceof File && file.size > 0) {
          try {
            const result = await uploadImage(file, 'churches', c.env);
            uploadedImages.push({ path: result.path });
          } catch (error) {
            console.error('Error uploading image:', error);
            // Continue with the update even if image upload fails
          }
        }
      }
    }

    // Handle existing image updates and removals
    const existingImages = await db.select().from(churchImages).where(eq(churchImages.churchId, id)).all();
    const imagesToRemove: string[] = [];
    const imageUpdates: Array<{ id: number; imageAlt?: string; caption?: string; isFeatured?: boolean }> = [];

    for (const image of existingImages) {
      // Check if image should be removed
      const removeKey = `removeImage_${image.id}`;
      if (body[removeKey] === 'true') {
        imagesToRemove.push(image.imagePath);
        await db.delete(churchImages).where(eq(churchImages.id, image.id));
        continue;
      }

      // Update image metadata
      const altKey = `imageAlt_${image.id}`;
      const captionKey = `imageCaption_${image.id}`;

      const updates: { imageAlt?: string | null; caption?: string | null } = {};
      if (typeof body[altKey] === 'string') {
        updates.imageAlt = body[altKey] || null;
      }
      if (typeof body[captionKey] === 'string') {
        updates.caption = body[captionKey] || null;
      }

      if (Object.keys(updates).length > 0) {
        await db.update(churchImages).set(updates).where(eq(churchImages.id, image.id));
      }
    }

    // Handle featured image selection
    const featuredImageId = body.featuredImageId;
    if (featuredImageId) {
      // Clear all featured flags first
      await db.update(churchImages).set({ isFeatured: false }).where(eq(churchImages.churchId, id));

      // Set the selected image as featured
      await db
        .update(churchImages)
        .set({ isFeatured: true })
        .where(eq(churchImages.id, Number(featuredImageId)));
    }

    // Remove deleted images from R2
    for (const imagePath of imagesToRemove) {
      await deleteImage(imagePath, c.env);
    }

    // Parse and validate form data
    const parsedBody = parseFormBody(body);

    // Parse gatherings and affiliations from form
    const gatherings = parseGatheringsFromForm(parsedBody);
    const formAffiliations = parseAffiliationsFromForm(parsedBody);

    // Structure data for validation
    const dataToValidate = {
      church: parsedBody,
      gatherings,
      affiliations: formAffiliations,
    };

    const validationResult = validateFormData(churchWithGatheringsSchema, dataToValidate);

    if (!validationResult.success) {
      console.error('Validation errors:', validationResult.errors);

      // Build detailed error message
      const errorMessages = [];
      for (const [field, errors] of Object.entries(validationResult.errors)) {
        if (errors && errors.length > 0) {
          const fieldName = field
            .replace(/^church\./, '')
            .replace(/([A-Z])/g, ' $1')
            .trim();
          errorMessages.push(`${fieldName}: ${errors.join(', ')}`);
        }
      }

      const detailedMessage = errorMessages.length > 0 ? errorMessages.join('; ') : validationResult.message;

      throw new Error(detailedMessage);
    }

    const {
      church: validatedChurchData,
      gatherings: validatedGatherings,
      affiliations: validatedAffiliations,
    } = validationResult.data;

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
      const affiliationsToInsert = validatedAffiliations.map((affiliationId, index) => ({
        churchId: id,
        affiliationId: Number(affiliationId),
      }));
      await db.insert(churchAffiliations).values(affiliationsToInsert);
    }

    // Insert new uploaded images
    if (uploadedImages.length > 0) {
      // Get current max sort order
      const existingImagesCount = await db
        .select({ count: sql`count(*)` })
        .from(churchImages)
        .where(eq(churchImages.churchId, id))
        .get();

      const sortOrder = (existingImagesCount?.count as number) || 0;

      // Check if this is the first image (should be featured)
      const hasExistingImages = sortOrder > 0;

      const imagesToInsert = uploadedImages.map((img, index) => ({
        churchId: id,
        imagePath: img.path,
        imageAlt: null,
        caption: null,
        isFeatured: !hasExistingImages && index === 0, // First image is featured if no existing images
        sortOrder: sortOrder + index,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      await db.insert(churchImages).values(imagesToInsert);
    }

    // Get new affiliations for audit trail
    const newAffiliations = validatedAffiliations
      ? await db
          .select({
            id: affiliations.id,
            name: affiliations.name,
            path: affiliations.path,
          })
          .from(affiliations)
          .where(sql`${affiliations.id} IN ${validatedAffiliations.map(Number)}`)
          .all()
      : [];

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
        const auditComment = createAuditComment(user.name || user.email, 'updated church data', changes);

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

    // Get the church name for the success message
    const updatedChurch = await db.select().from(churches).where(eq(churches.id, id)).get();

    // Check if this was a "save and continue" action
    if (body.continue === 'true') {
      // Redirect back to edit page with success message
      const params = new URLSearchParams({
        success: 'updated',
        churchName: updatedChurch?.name || 'Church',
        churchPath: updatedChurch?.path || '',
      });
      return c.redirect(`/admin/churches/${id}/edit?${params.toString()}`);
    }

    // Redirect to the church page
    if (updatedChurch?.path) {
      return c.redirect(`/churches/${updatedChurch.path}`);
    } else {
      // Fallback to admin list if no path
      const params = new URLSearchParams({
        success: 'updated',
        churchName: updatedChurch?.name || 'Church',
      });
      return c.redirect(`/admin/churches?${params.toString()}`);
    }
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
  const db = createDbWithContext(c);
  const id = Number(c.req.param('id'));

  // Get all church images before deleting
  const churchImagesList = await db.select().from(churchImages).where(eq(churchImages.churchId, id)).all();

  // Delete related data first
  await db.delete(churchGatherings).where(eq(churchGatherings.churchId, id));
  await db.delete(churchAffiliations).where(eq(churchAffiliations.churchId, id));
  await db.delete(comments).where(eq(comments.churchId, id));
  await db.delete(churchImages).where(eq(churchImages.churchId, id));

  // Delete church
  await db.delete(churches).where(eq(churches.id, id));

  // Delete images from R2 bucket
  for (const image of churchImagesList) {
    await deleteImage(image.imagePath, c.env);
  }

  return c.redirect('/admin/churches');
});

// Extract website data
adminChurchesRoutes.post('/:id/extract', async (c) => {
  const _user = c.get('betterUser');
  const _id = Number(c.req.param('id'));

  // Parse form data instead of JSON
  const body = await c.req.parseBody();
  const website = (body.websiteUrl || body.website || '') as string;

  if (!website) {
    return c.json({ error: 'Website URL is required' }, 400);
  }

  try {
    // Check if OpenRouter API key is available
    const { hasOpenRouterApiKey } = await import('../../utils/env-validation');
    if (!hasOpenRouterApiKey(c.env)) {
      return c.json(
        {
          error: 'AI extraction is not available',
          message:
            'The AI-powered website extraction feature requires an OpenRouter API key. Please configure OPENROUTER_API_KEY to enable this feature.',
        },
        503
      );
    }

    const extractedData = await extractChurchDataFromWebsite(website, c.env.OPENROUTER_API_KEY!);

    // All fields are always available for update
    const fields = {
      phone: true,
      email: true,
      address: true,
      serviceTimes: true,
      instagram: true,
      facebook: true,
      youtube: true,
      spotify: true,
      statementOfFaith: true,
    };

    return c.json({
      extracted: extractedData || {},
      fields: fields,
    });
  } catch (error) {
    console.error('Error extracting website data:', error);
    return c.json({ error: 'Failed to extract data from website' }, 500);
  }
});
