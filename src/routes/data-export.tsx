import { eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import yaml from 'js-yaml';
import * as XLSX from 'xlsx';
import { ErrorPage } from '../components/ErrorPage';
import { Layout } from '../components/Layout';
import { createDbWithContext } from '../db';
import { affiliations, churchAffiliations, churches, counties } from '../db/schema';
import { getUser } from '../middleware/better-auth';
import type { AuthVariables, Bindings } from '../types';
import { batchedInQuery, createInClause } from '../utils/db-helpers';
import { getNavbarPages } from '../utils/pages';
import { getFaviconUrl, getLogoUrl } from '../utils/settings';

type Variables = AuthVariables;

export const dataExportRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// JSON Export
dataExportRoutes.get('/churches.json', async (c) => {
  const db = createDbWithContext(c);

  // Get all churches with 'Listed' or 'Unlisted' status
  const allChurches = await db
    .select({
      id: churches.id,
      name: churches.name,
      path: churches.path,
      status: churches.status,
      lastUpdated: churches.lastUpdated,
      gatheringAddress: churches.gatheringAddress,
      latitude: churches.latitude,
      longitude: churches.longitude,
      county: counties.name,
      website: churches.website,
      statementOfFaith: churches.statementOfFaith,
      phone: churches.phone,
      email: churches.email,
      facebook: churches.facebook,
      instagram: churches.instagram,
      youtube: churches.youtube,
      spotify: churches.spotify,
      language: churches.language,
      notes: churches.publicNotes,
    })
    .from(churches)
    .leftJoin(counties, eq(churches.countyId, counties.id))
    .where(sql`${churches.status} IN ('Listed', 'Unlisted')`)
    .orderBy(churches.name)
    .all();

  // Get affiliations for each church
  const churchIds = allChurches.map((c) => c.id);
  let churchAffiliationData: Array<{
    churchId: number;
    affiliationId: number;
    affiliationName: string | null;
    affiliationWebsite: string | null;
    affiliationPublicNotes: string | null;
    order: number | null;
  }> = [];

  if (churchIds.length > 0) {
    churchAffiliationData = await batchedInQuery(churchIds, 100, async (batchIds) => {
      return await db
        .select({
          churchId: churchAffiliations.churchId,
          affiliationId: churchAffiliations.affiliationId,
          affiliationName: affiliations.name,
          affiliationWebsite: affiliations.website,
          affiliationPublicNotes: affiliations.publicNotes,
          order: churchAffiliations.order,
        })
        .from(churchAffiliations)
        .innerJoin(affiliations, eq(churchAffiliations.affiliationId, affiliations.id))
        .where(createInClause(churchAffiliations.churchId, batchIds))
        .orderBy(churchAffiliations.churchId, churchAffiliations.order)
        .all();
    });
  }

  // Group affiliations by church
  const affiliationsByChurch = churchAffiliationData.reduce(
    (acc, item) => {
      if (!acc[item.churchId]) {
        acc[item.churchId] = [];
      }
      acc[item.churchId].push({
        id: item.affiliationId,
        name: item.affiliationName,
        website: item.affiliationWebsite,
        notes: item.affiliationPublicNotes,
      });
      return acc;
    },
    {} as Record<
      number,
      Array<{
        id: number;
        name: string | null;
        website: string | null;
        notes: string | null;
      }>
    >
  );

  // Combine church data with affiliations
  const churchesWithAffiliations = allChurches.map((church) => ({
    ...church,
    affiliations: affiliationsByChurch[church.id] || [],
  }));

  return c.json({
    total: churchesWithAffiliations.length,
    churches: churchesWithAffiliations,
  });
});

// YAML Export
dataExportRoutes.get('/churches.yaml', async (c) => {
  const db = createDbWithContext(c);

  // Get all churches with 'Listed' or 'Unlisted' status
  const allChurches = await db
    .select({
      id: churches.id,
      name: churches.name,
      path: churches.path,
      status: churches.status,
      lastUpdated: churches.lastUpdated,
      gatheringAddress: churches.gatheringAddress,
      latitude: churches.latitude,
      longitude: churches.longitude,
      county: counties.name,
      website: churches.website,
      statementOfFaith: churches.statementOfFaith,
      phone: churches.phone,
      email: churches.email,
      facebook: churches.facebook,
      instagram: churches.instagram,
      youtube: churches.youtube,
      spotify: churches.spotify,
      language: churches.language,
      notes: churches.publicNotes,
    })
    .from(churches)
    .leftJoin(counties, eq(churches.countyId, counties.id))
    .where(sql`${churches.status} IN ('Listed', 'Unlisted')`)
    .orderBy(churches.name)
    .all();

  // Get affiliations for each church
  const churchIds = allChurches.map((c) => c.id);
  let churchAffiliationData: Array<{
    churchId: number;
    affiliationId: number;
    affiliationName: string | null;
    affiliationWebsite: string | null;
    affiliationPublicNotes: string | null;
    order: number | null;
  }> = [];

  if (churchIds.length > 0) {
    churchAffiliationData = await batchedInQuery(churchIds, 100, async (batchIds) => {
      return await db
        .select({
          churchId: churchAffiliations.churchId,
          affiliationId: churchAffiliations.affiliationId,
          affiliationName: affiliations.name,
          affiliationWebsite: affiliations.website,
          affiliationPublicNotes: affiliations.publicNotes,
          order: churchAffiliations.order,
        })
        .from(churchAffiliations)
        .innerJoin(affiliations, eq(churchAffiliations.affiliationId, affiliations.id))
        .where(createInClause(churchAffiliations.churchId, batchIds))
        .orderBy(churchAffiliations.churchId, churchAffiliations.order)
        .all();
    });
  }

  // Group affiliations by church
  const affiliationsByChurch = churchAffiliationData.reduce(
    (acc, item) => {
      if (!acc[item.churchId]) {
        acc[item.churchId] = [];
      }
      const affiliation: {
        id: number;
        name: string | null;
        website?: string;
        notes?: string;
      } = {
        id: item.affiliationId,
        name: item.affiliationName,
      };
      if (item.affiliationWebsite) affiliation.website = item.affiliationWebsite;
      if (item.affiliationPublicNotes) affiliation.notes = item.affiliationPublicNotes;
      acc[item.churchId].push(affiliation);
      return acc;
    },
    {} as Record<
      number,
      Array<{
        id: number;
        name: string | null;
        website?: string;
        notes?: string;
      }>
    >
  );

  // Helper function to remove null values from objects
  const removeNulls = (obj: Record<string, unknown>): Record<string, unknown> => {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null && value !== undefined) {
        cleaned[key] = value;
      }
    }
    return cleaned;
  };

  // Combine church data with affiliations and remove nulls
  const churchesWithAffiliations = allChurches.map((church) => {
    const cleanChurch = removeNulls(church);
    cleanChurch.affiliations = affiliationsByChurch[church.id] || [];
    return cleanChurch;
  });

  const yamlData = yaml.dump({
    total: churchesWithAffiliations.length,
    churches: churchesWithAffiliations,
  });

  return c.text(yamlData, 200, {
    'Content-Type': 'text/yaml',
  });
});

// CSV Export
dataExportRoutes.get('/churches.csv', async (c) => {
  const db = createDbWithContext(c);

  // Get all churches with 'Listed' or 'Unlisted' status
  const allChurches = await db
    .select({
      id: churches.id,
      name: churches.name,
      path: churches.path,
      status: churches.status,
      lastUpdated: churches.lastUpdated,
      gatheringAddress: churches.gatheringAddress,
      latitude: churches.latitude,
      longitude: churches.longitude,
      county: counties.name,
      website: churches.website,
      statementOfFaith: churches.statementOfFaith,
      phone: churches.phone,
      email: churches.email,
      facebook: churches.facebook,
      instagram: churches.instagram,
      youtube: churches.youtube,
      spotify: churches.spotify,
      language: churches.language,
      notes: churches.publicNotes,
    })
    .from(churches)
    .leftJoin(counties, eq(churches.countyId, counties.id))
    .where(sql`${churches.status} IN ('Listed', 'Unlisted')`)
    .orderBy(churches.name)
    .all();

  // Get affiliations for each church
  const churchIds = allChurches.map((c) => c.id);
  let churchAffiliationData: Array<{
    churchId: number;
    affiliationId: number;
    affiliationName: string | null;
    affiliationWebsite: string | null;
    affiliationPublicNotes: string | null;
    order: number | null;
  }> = [];

  if (churchIds.length > 0) {
    churchAffiliationData = await batchedInQuery(churchIds, 100, async (batchIds) => {
      return await db
        .select({
          churchId: churchAffiliations.churchId,
          affiliationId: churchAffiliations.affiliationId,
          affiliationName: affiliations.name,
          affiliationWebsite: affiliations.website,
          affiliationPublicNotes: affiliations.publicNotes,
          order: churchAffiliations.order,
        })
        .from(churchAffiliations)
        .innerJoin(affiliations, eq(churchAffiliations.affiliationId, affiliations.id))
        .where(createInClause(churchAffiliations.churchId, batchIds))
        .orderBy(churchAffiliations.churchId, churchAffiliations.order)
        .all();
    });
  }

  // Group affiliations by church
  const affiliationsByChurch = churchAffiliationData.reduce(
    (acc, item) => {
      if (!acc[item.churchId]) {
        acc[item.churchId] = [];
      }
      acc[item.churchId].push(item.affiliationName || '');
      return acc;
    },
    {} as Record<number, string[]>
  );

  // Helper function to escape CSV values
  const escapeCSV = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Create CSV header
  const headers = [
    'Name',
    'Status',
    'Address',
    'County',
    'Website',
    'Phone',
    'Email',
    'Affiliations',
    'Notes',
    'Last Updated',
  ];

  // Create CSV rows
  const rows = allChurches.map((church) => {
    const affiliations = affiliationsByChurch[church.id]?.join('; ') || '';
    return [
      church.name,
      church.status || '',
      church.gatheringAddress || '',
      church.county || '',
      church.website || '',
      church.phone || '',
      church.email || '',
      affiliations,
      church.notes || '',
      church.lastUpdated ? new Date(church.lastUpdated).toISOString().split('T')[0] : '',
    ].map(escapeCSV);
  });

  // Combine header and rows
  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

  return c.text(csvContent, 200, {
    'Content-Type': 'text/csv',
    'Content-Disposition': 'attachment; filename="churches.csv"',
  });
});

// Excel Export
dataExportRoutes.get('/churches.xlsx', async (c) => {
  const db = createDbWithContext(c);

  // Get all churches with 'Listed' or 'Unlisted' status
  const allChurches = await db
    .select({
      id: churches.id,
      name: churches.name,
      path: churches.path,
      status: churches.status,
      lastUpdated: churches.lastUpdated,
      gatheringAddress: churches.gatheringAddress,
      latitude: churches.latitude,
      longitude: churches.longitude,
      county: counties.name,
      website: churches.website,
      statementOfFaith: churches.statementOfFaith,
      phone: churches.phone,
      email: churches.email,
      facebook: churches.facebook,
      instagram: churches.instagram,
      youtube: churches.youtube,
      spotify: churches.spotify,
      language: churches.language,
      notes: churches.publicNotes,
    })
    .from(churches)
    .leftJoin(counties, eq(churches.countyId, counties.id))
    .where(sql`${churches.status} IN ('Listed', 'Unlisted')`)
    .orderBy(churches.name)
    .all();

  // Get all counties
  const allCounties = await db
    .select({
      name: counties.name,
      path: counties.path,
      description: counties.description,
      population: counties.population,
    })
    .from(counties)
    .orderBy(counties.name)
    .all();

  // Get all listed affiliations
  const allAffiliations = await db
    .select({
      name: affiliations.name,
      status: affiliations.status,
      website: affiliations.website,
      publicNotes: affiliations.publicNotes,
    })
    .from(affiliations)
    .where(eq(affiliations.status, 'Listed'))
    .orderBy(affiliations.name)
    .all();

  // Get affiliations for each church
  const churchIds = allChurches.map((c) => c.id);
  let churchAffiliationData: Array<{
    churchId: number;
    affiliationId: number;
    affiliationName: string | null;
    affiliationWebsite: string | null;
    affiliationPublicNotes: string | null;
    order: number | null;
  }> = [];

  if (churchIds.length > 0) {
    churchAffiliationData = await batchedInQuery(churchIds, 100, async (batchIds) => {
      return await db
        .select({
          churchId: churchAffiliations.churchId,
          affiliationId: churchAffiliations.affiliationId,
          affiliationName: affiliations.name,
          affiliationWebsite: affiliations.website,
          affiliationPublicNotes: affiliations.publicNotes,
          order: churchAffiliations.order,
        })
        .from(churchAffiliations)
        .innerJoin(affiliations, eq(churchAffiliations.affiliationId, affiliations.id))
        .where(createInClause(churchAffiliations.churchId, batchIds))
        .orderBy(churchAffiliations.churchId, churchAffiliations.order)
        .all();
    });
  }

  // Group affiliations by church
  const affiliationsByChurch = churchAffiliationData.reduce(
    (acc, item) => {
      if (!acc[item.churchId]) {
        acc[item.churchId] = [];
      }
      acc[item.churchId].push(item.affiliationName || '');
      return acc;
    },
    {} as Record<number, string[]>
  );

  // Prepare church data for Excel
  const churchData = allChurches.map((church) => ({
    Name: church.name,
    Status: church.status || '',
    Address: church.gatheringAddress || '',
    County: church.county || '',
    Website: church.website || '',
    Phone: church.phone || '',
    Email: church.email || '',
    Affiliations: affiliationsByChurch[church.id]?.join('; ') || '',
    Facebook: church.facebook || '',
    Instagram: church.instagram || '',
    YouTube: church.youtube || '',
    Spotify: church.spotify || '',
    Notes: church.notes || '',
    'Last Updated': church.lastUpdated ? new Date(church.lastUpdated).toISOString().split('T')[0] : '',
  }));

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Add Churches sheet
  const churchesWs = XLSX.utils.json_to_sheet(churchData);

  // Set column widths for Churches sheet
  churchesWs['!cols'] = [
    { wch: 40 }, // Name
    { wch: 12 }, // Status
    { wch: 50 }, // Address
    { wch: 20 }, // County
    { wch: 35 }, // Website
    { wch: 15 }, // Phone
    { wch: 30 }, // Email
    { wch: 40 }, // Affiliations
    { wch: 25 }, // Facebook
    { wch: 25 }, // Instagram
    { wch: 25 }, // YouTube
    { wch: 25 }, // Spotify
    { wch: 50 }, // Notes
    { wch: 12 }, // Last Updated
  ];

  // Apply header styling
  const range = XLSX.utils.decode_range(churchesWs['!ref'] || 'A1');
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const address = `${XLSX.utils.encode_col(C)}1`;
    if (!churchesWs[address]) continue;
    churchesWs[address].s = {
      font: { bold: true },
      fill: { fgColor: { rgb: '2563EB' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    };
  }

  XLSX.utils.book_append_sheet(wb, churchesWs, 'Churches');

  // Add Counties sheet
  const countiesWs = XLSX.utils.json_to_sheet(allCounties);

  // Set column widths for Counties sheet
  countiesWs['!cols'] = [
    { wch: 20 }, // name
    { wch: 20 }, // path
    { wch: 50 }, // description
    { wch: 12 }, // population
  ];

  XLSX.utils.book_append_sheet(wb, countiesWs, 'Counties');

  // Add Affiliations sheet
  const affiliationsWs = XLSX.utils.json_to_sheet(allAffiliations);

  // Set column widths for Affiliations sheet
  affiliationsWs['!cols'] = [
    { wch: 40 }, // name
    { wch: 12 }, // status
    { wch: 35 }, // website
    { wch: 50 }, // publicNotes
  ];

  XLSX.utils.book_append_sheet(wb, affiliationsWs, 'Affiliations');

  // Generate buffer
  const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

  return c.body(xlsxBuffer, 200, {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': 'attachment; filename="churches.xlsx"',
  });
});

// Data Export Page
dataExportRoutes.get('/data', async (c) => {
  try {
    const db = createDbWithContext(c);

    // Check for admin user
    const user = await getUser(c);

    // Get count of churches with 'Listed' or 'Unlisted' status
    const churchCount = await db
      .select({
        count: sql<number>`COUNT(*)`.as('count'),
      })
      .from(churches)
      .where(sql`${churches.status} IN ('Listed', 'Unlisted')`)
      .get();

    // Get favicon URL
    const faviconUrl = await getFaviconUrl(c.env);

    // Get logo URL
    const logoUrl = await getLogoUrl(c.env);

    // Get navbar pages
    const navbarPages = await getNavbarPages(c.env);

    return c.html(
      <Layout
        title="Download Data"
        currentPath="/data"
        user={user}
        faviconUrl={faviconUrl}
        logoUrl={logoUrl}
        pages={navbarPages}
      >
        <div class="bg-gray-50">
          <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div class="bg-white rounded-lg shadow-lg overflow-hidden">
              <div class="px-6 py-8 sm:p-10">
                <h1 class="text-3xl font-bold text-gray-900 mb-2">Download Church Data</h1>
                <p class="text-lg text-gray-600 mb-8">
                  Export data for {churchCount?.count || 0} evangelical churches in various formats
                </p>

                <div class="grid gap-4 grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto">
                  {/* XLSX Download */}
                  <a
                    href="/churches.xlsx"
                    class="relative group bg-white p-5 rounded-lg border-2 border-gray-200 hover:border-primary-500 transition-colors"
                  >
                    <div class="flex flex-col items-center text-center">
                      <div class="rounded-lg inline-flex p-3 bg-orange-50 text-orange-700 group-hover:bg-orange-100 mb-3">
                        <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <h3 class="text-base font-semibold text-gray-900 mb-1">Excel Format</h3>
                      <p class="text-xs text-gray-600 mb-3">
                        Multi-sheet workbook with churches, counties, and affiliations
                      </p>
                      <span class="inline-flex items-center text-sm font-medium text-primary-600 group-hover:text-primary-500">
                        Download XLSX
                        <svg class="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                      </span>
                    </div>
                  </a>

                  {/* CSV Download */}
                  <a
                    href="/churches.csv"
                    class="relative group bg-white p-5 rounded-lg border-2 border-gray-200 hover:border-primary-500 transition-colors"
                  >
                    <div class="flex flex-col items-center text-center">
                      <div class="rounded-lg inline-flex p-3 bg-green-50 text-green-700 group-hover:bg-green-100 mb-3">
                        <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <h3 class="text-base font-semibold text-gray-900 mb-1">CSV Format</h3>
                      <p class="text-xs text-gray-600 mb-3">Spreadsheet-compatible format with church details</p>
                      <span class="inline-flex items-center text-sm font-medium text-primary-600 group-hover:text-primary-500">
                        Download CSV
                        <svg class="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                      </span>
                    </div>
                  </a>

                  {/* JSON Download */}
                  <a
                    href="/churches.json"
                    class="relative group bg-white p-5 rounded-lg border-2 border-gray-200 hover:border-primary-500 transition-colors"
                  >
                    <div class="flex flex-col items-center text-center">
                      <div class="rounded-lg inline-flex p-3 bg-blue-50 text-blue-700 group-hover:bg-blue-100 mb-3">
                        <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
                          />
                        </svg>
                      </div>
                      <h3 class="text-base font-semibold text-gray-900 mb-1">JSON Format</h3>
                      <p class="text-xs text-gray-600 mb-3">Programmer-friendly format with complete data</p>
                      <span class="inline-flex items-center text-sm font-medium text-primary-600 group-hover:text-primary-500">
                        Download JSON
                        <svg class="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                      </span>
                    </div>
                  </a>

                  {/* YAML Download */}
                  <a
                    href="/churches.yaml"
                    class="relative group bg-white p-5 rounded-lg border-2 border-gray-200 hover:border-primary-500 transition-colors"
                  >
                    <div class="flex flex-col items-center text-center">
                      <div class="rounded-lg inline-flex p-3 bg-purple-50 text-purple-700 group-hover:bg-purple-100 mb-3">
                        <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                          />
                        </svg>
                      </div>
                      <h3 class="text-base font-semibold text-gray-900 mb-1">YAML Format</h3>
                      <p class="text-xs text-gray-600 mb-3">Readable format for documentation and LLMs</p>
                      <span class="inline-flex items-center text-sm font-medium text-primary-600 group-hover:text-primary-500">
                        Download YAML
                        <svg class="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                      </span>
                    </div>
                  </a>
                </div>

                {/* MCP Server Section */}
                <div class="mt-10">
                  <h2 class="text-2xl font-bold text-gray-900 mb-4">Bot Integration (MCP)</h2>
                  <p class="text-gray-600 mb-6">
                    Integrate our church data into your AI assistants and bots using the standardized Model Context
                    Protocol.
                  </p>

                  <div class="space-y-6">
                    <div>
                      <h3 class="text-base font-semibold text-gray-900 mb-3">Available MCP Tools</h3>
                      <ul class="text-sm text-gray-600 space-y-2">
                        <li class="flex items-start">
                          <span class="text-primary-600 mr-2">•</span>
                          <span>
                            <code class="bg-gray-100 px-1 py-0.5 rounded text-xs">church_search</code> - Search churches
                            with filters for status, county, and affiliation
                          </span>
                        </li>
                        <li class="flex items-start">
                          <span class="text-primary-600 mr-2">•</span>
                          <span>
                            <code class="bg-gray-100 px-1 py-0.5 rounded text-xs">county_browser</code> - Browse
                            churches by county with statistics
                          </span>
                        </li>
                        <li class="flex items-start">
                          <span class="text-primary-600 mr-2">•</span>
                          <span>
                            <code class="bg-gray-100 px-1 py-0.5 rounded text-xs">network_explorer</code> - Explore
                            church networks and affiliations
                          </span>
                        </li>
                        <li class="flex items-start">
                          <span class="text-primary-600 mr-2">•</span>
                          <span>
                            <code class="bg-gray-100 px-1 py-0.5 rounded text-xs">church_details</code> - Get
                            comprehensive information about a specific church
                          </span>
                        </li>
                      </ul>
                    </div>

                    <div>
                      <h3 class="text-base font-semibold text-gray-900 mb-3">MCP Endpoints</h3>
                      <div class="bg-gray-50 rounded border border-gray-200 p-3 font-mono text-xs">
                        <div class="text-gray-700">GET https://utahchurches.org/mcp/tools</div>
                        <div class="text-gray-700">POST https://utahchurches.org/mcp/tools/call</div>
                      </div>
                    </div>

                    <div>
                      <h3 class="text-base font-semibold text-gray-900 mb-3">REST API Endpoints</h3>
                      <div class="bg-gray-50 rounded border border-gray-200 p-3 font-mono text-xs space-y-1">
                        <div class="text-gray-700">GET /api/churches/search?q=&lt;query&gt;</div>
                        <div class="text-gray-700">GET /api/counties</div>
                        <div class="text-gray-700">GET /api/networks</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  } catch (error) {
    console.error('Error loading data page:', error);
    return c.html(
      <Layout title="Error">
        <ErrorPage error={(error as Error)?.message || 'Failed to load data'} statusCode={500} />
      </Layout>,
      500
    );
  }
});
