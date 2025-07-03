import { Hono } from 'hono';
import { eq, ne, sql } from 'drizzle-orm';
import yaml from 'js-yaml';
import * as XLSX from 'xlsx';
import { createDb } from '../db';
import { churches, churchGatherings, affiliations, churchAffiliations, counties } from '../db/schema';
import { Layout } from '../components/Layout';
import { getUser } from '../middleware/better-auth';
import type { Bindings } from '../types';

type Variables = {
  user: any;
};

export const dataExportRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// JSON Export
dataExportRoutes.get('/churches.json', async (c) => {
  const db = createDb(c.env);

  const allChurches = await db
    .select({
      church: churches,
      county: counties,
    })
    .from(churches)
    .leftJoin(counties, eq(churches.countyId, counties.id))
    .where(ne(churches.status, 'Heretical'))
    .orderBy(churches.name)
    .all();

  const churchesWithDetails = await Promise.all(
    allChurches.map(async ({ church, county }) => {
      const gatherings = await db
        .select()
        .from(churchGatherings)
        .where(eq(churchGatherings.churchId, church.id))
        .all();

      const churchAffils = await db
        .select({
          affiliation: affiliations,
        })
        .from(churchAffiliations)
        .innerJoin(affiliations, eq(churchAffiliations.affiliationId, affiliations.id))
        .where(eq(churchAffiliations.churchId, church.id))
        .all();

      return {
        id: church.id,
        name: church.name,
        path: church.path,
        status: church.status,
        county: county ? { id: county.id, name: county.name, path: county.path } : null,
        affiliations: churchAffils.map((ca) => ({
          id: ca.affiliation.id,
          name: ca.affiliation.name,
          path: ca.affiliation.path,
        })),
        gatherings: gatherings.map((g) => ({
          time: g.time,
          notes: g.notes,
        })),
        address: church.gatheringAddress,
        coordinates: church.latitude && church.longitude ? { lat: church.latitude, lng: church.longitude } : null,
        contact: {
          phone: church.phone,
          email: church.email,
          website: church.website,
        },
        social: {
          facebook: church.facebook,
          instagram: church.instagram,
          youtube: church.youtube,
          spotify: church.spotify,
        },
        statementOfFaith: church.statementOfFaith,
        publicNotes: church.publicNotes,
        createdAt: church.createdAt,
        updatedAt: church.updatedAt,
      };
    })
  );

  return c.json(churchesWithDetails, 200, {
    'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
  });
});

// YAML Export
dataExportRoutes.get('/churches.yaml', async (c) => {
  const db = createDb(c.env);

  const allChurches = await db
    .select({
      church: churches,
      county: counties,
    })
    .from(churches)
    .leftJoin(counties, eq(churches.countyId, counties.id))
    .where(ne(churches.status, 'Heretical'))
    .orderBy(churches.name)
    .all();

  const churchesWithDetails = await Promise.all(
    allChurches.map(async ({ church, county }) => {
      const gatherings = await db
        .select()
        .from(churchGatherings)
        .where(eq(churchGatherings.churchId, church.id))
        .all();

      const churchAffils = await db
        .select({
          affiliation: affiliations,
        })
        .from(churchAffiliations)
        .innerJoin(affiliations, eq(churchAffiliations.affiliationId, affiliations.id))
        .where(eq(churchAffiliations.churchId, church.id))
        .all();

      // Remove null values for cleaner YAML
      const cleanObj: any = {
        id: church.id,
        name: church.name,
        path: church.path,
        status: church.status,
      };

      if (county) {
        cleanObj.county = { id: county.id, name: county.name, path: county.path };
      }

      if (churchAffils.length > 0) {
        cleanObj.affiliations = churchAffils.map((ca) => ({
          id: ca.affiliation.id,
          name: ca.affiliation.name,
          path: ca.affiliation.path,
        }));
      }

      if (gatherings.length > 0) {
        cleanObj.gatherings = gatherings
          .map((g) => {
            const gathering: any = { time: g.time };
            if (g.notes) gathering.notes = g.notes;
            return gathering;
          })
          .filter((g) => g.time); // Only include if time exists
      }

      if (church.gatheringAddress) cleanObj.address = church.gatheringAddress;
      if (church.latitude && church.longitude) {
        cleanObj.coordinates = { lat: church.latitude, lng: church.longitude };
      }

      const contact: any = {};
      if (church.phone) contact.phone = church.phone;
      if (church.email) contact.email = church.email;
      if (church.website) contact.website = church.website;
      if (Object.keys(contact).length > 0) cleanObj.contact = contact;

      const social: any = {};
      if (church.facebook) social.facebook = church.facebook;
      if (church.instagram) social.instagram = church.instagram;
      if (church.youtube) social.youtube = church.youtube;
      if (church.spotify) social.spotify = church.spotify;
      if (Object.keys(social).length > 0) cleanObj.social = social;

      if (church.statementOfFaith) cleanObj.statementOfFaith = church.statementOfFaith;
      if (church.publicNotes) cleanObj.publicNotes = church.publicNotes;
      if (church.createdAt) cleanObj.createdAt = church.createdAt;
      if (church.updatedAt) cleanObj.updatedAt = church.updatedAt;

      return cleanObj;
    })
  );

  const yamlContent = yaml.dump(churchesWithDetails, {
    sortKeys: false,
    lineWidth: -1,
    noRefs: true,
  });

  return c.text(yamlContent, 200, {
    'Content-Type': 'text/yaml',
    'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
  });
});

// CSV Export
dataExportRoutes.get('/churches.csv', async (c) => {
  const db = createDb(c.env);

  const allChurches = await db
    .select({
      church: churches,
      county: counties,
    })
    .from(churches)
    .leftJoin(counties, eq(churches.countyId, counties.id))
    .orderBy(churches.name)
    .all();

  const churchesWithDetails = await Promise.all(
    allChurches.map(async ({ church, county }) => {
      const gatherings = await db
        .select()
        .from(churchGatherings)
        .where(eq(churchGatherings.churchId, church.id))
        .all();

      const churchAffils = await db
        .select({
          affiliation: affiliations,
        })
        .from(churchAffiliations)
        .innerJoin(affiliations, eq(churchAffiliations.affiliationId, affiliations.id))
        .where(eq(churchAffiliations.churchId, church.id))
        .all();

      return {
        Name: church.name,
        Status: church.status,
        County: county?.name || '',
        Affiliations: churchAffils.map((ca) => ca.affiliation.name).join('; '),
        'Gathering Times': gatherings.map((g) => `${g.time}${g.notes ? ` (${g.notes})` : ''}`).join('; '),
        Address: church.gatheringAddress || '',
        Latitude: church.latitude || '',
        Longitude: church.longitude || '',
        Phone: church.phone || '',
        Email: church.email || '',
        Website: church.website || '',
        Facebook: church.facebook || '',
        Instagram: church.instagram || '',
        YouTube: church.youtube || '',
        Spotify: church.spotify || '',
        'Statement of Faith': church.statementOfFaith || '',
        'Public Notes': church.publicNotes || '',
      };
    })
  );

  // Create CSV content
  const headers = Object.keys(churchesWithDetails[0] || {});
  const csvRows = [
    headers.join(','),
    ...churchesWithDetails.map((church) =>
      headers
        .map((header) => {
          const value = String(church[header as keyof typeof church] || '');
          // Escape quotes and wrap in quotes if contains comma, newline, or quote
          if (value.includes(',') || value.includes('\n') || value.includes('"')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        })
        .join(',')
    ),
  ];

  return c.text(csvRows.join('\n'), 200, {
    'Content-Type': 'text/csv',
    'Content-Disposition': 'attachment; filename="churches.csv"',
    'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
  });
});

// Excel Export
dataExportRoutes.get('/churches.xlsx', async (c) => {
  const db = createDb(c.env);

  const allChurches = await db
    .select({
      church: churches,
      county: counties,
    })
    .from(churches)
    .leftJoin(counties, eq(churches.countyId, counties.id))
    .orderBy(churches.name)
    .all();

  const churchesWithDetails = await Promise.all(
    allChurches.map(async ({ church, county }) => {
      const gatherings = await db
        .select()
        .from(churchGatherings)
        .where(eq(churchGatherings.churchId, church.id))
        .all();

      const churchAffils = await db
        .select({
          affiliation: affiliations,
        })
        .from(churchAffiliations)
        .innerJoin(affiliations, eq(churchAffiliations.affiliationId, affiliations.id))
        .where(eq(churchAffiliations.churchId, church.id))
        .all();

      return {
        Name: church.name,
        Status: church.status,
        County: county?.name || '',
        Affiliations: churchAffils.map((ca) => ca.affiliation.name).join('; '),
        'Gathering Times': gatherings.map((g) => `${g.time}${g.notes ? ` (${g.notes})` : ''}`).join('; '),
        Address: church.gatheringAddress || '',
        Latitude: church.latitude || '',
        Longitude: church.longitude || '',
        Phone: church.phone || '',
        Email: church.email || '',
        Website: church.website || '',
        Facebook: church.facebook || '',
        Instagram: church.instagram || '',
        YouTube: church.youtube || '',
        Spotify: church.spotify || '',
        'Statement of Faith': church.statementOfFaith || '',
        'Public Notes': church.publicNotes || '',
      };
    })
  );

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(churchesWithDetails);

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Churches');

  // Generate buffer
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return c.body(buf, 200, {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': 'attachment; filename="churches.xlsx"',
    'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
  });
});

// Data Export Page
dataExportRoutes.get('/data', async (c) => {
  const user = await getUser(c);

  const content = (
    <Layout title="Data Export" user={user}>
      <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div class="mb-8">
          <h1 class="text-3xl font-bold text-gray-900">Data Export</h1>
          <p class="mt-2 text-gray-600">
            Download church data in various formats. Data is updated regularly and excludes churches marked as heretical.
          </p>
        </div>

        <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* JSON Export */}
          <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div class="mb-4">
              <svg class="h-12 w-12 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 class="mb-2 text-lg font-semibold text-gray-900">JSON Format</h3>
            <p class="mb-4 text-sm text-gray-600">
              Machine-readable format with complete data structure. Ideal for developers and data analysis.
            </p>
            <a
              href="/churches.json"
              class="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              download
            >
              <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              Download JSON
            </a>
          </div>

          {/* YAML Export */}
          <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div class="mb-4">
              <svg class="h-12 w-12 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 class="mb-2 text-lg font-semibold text-gray-900">YAML Format</h3>
            <p class="mb-4 text-sm text-gray-600">
              Human-readable format with clean structure. Perfect for configuration and documentation.
            </p>
            <a
              href="/churches.yaml"
              class="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              download
            >
              <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              Download YAML
            </a>
          </div>

          {/* CSV Export */}
          <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div class="mb-4">
              <svg class="h-12 w-12 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 class="mb-2 text-lg font-semibold text-gray-900">CSV Format</h3>
            <p class="mb-4 text-sm text-gray-600">
              Spreadsheet-compatible format. Opens directly in Excel, Google Sheets, and other applications.
            </p>
            <a
              href="/churches.csv"
              class="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              download
            >
              <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              Download CSV
            </a>
          </div>

          {/* Excel Export */}
          <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div class="mb-4">
              <svg class="h-12 w-12 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 class="mb-2 text-lg font-semibold text-gray-900">Excel Format</h3>
            <p class="mb-4 text-sm text-gray-600">
              Native Excel format with formatting preserved. Best for detailed spreadsheet analysis.
            </p>
            <a
              href="/churches.xlsx"
              class="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              download
            >
              <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              Download Excel
            </a>
          </div>
        </div>

        <div class="mt-12 rounded-lg bg-gray-50 p-6">
          <h2 class="mb-4 text-xl font-semibold text-gray-900">About the Data</h2>
          <div class="space-y-3 text-sm text-gray-600">
            <p>
              <strong>Update Frequency:</strong> Data is cached for 1 hour to ensure good performance while maintaining freshness.
            </p>
            <p>
              <strong>Data Quality:</strong> All church information is community-maintained and regularly reviewed by our team.
            </p>
            <p>
              <strong>Exclusions:</strong> Churches marked as heretical are excluded from all public data exports.
            </p>
            <p>
              <strong>Usage:</strong> This data is free to use for non-commercial purposes. Please attribute when sharing.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );

  return c.html(content);
});