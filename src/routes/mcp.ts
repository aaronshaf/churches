import { and, eq, like, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createDbWithContext } from '../db';
import { affiliations, churchAffiliations, churches, counties } from '../db/schema';
import type { Bindings } from '../types';

export const mcpRoutes = new Hono<{ Bindings: Bindings }>();

// Enable CORS for MCP clients
mcpRoutes.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  })
);

// MCP Protocol: List available tools
mcpRoutes.get('/tools', (c) => {
  return c.json({
    tools: [
      {
        name: 'church_search',
        description: 'Search for churches in Utah with comprehensive filters including status, county, and affiliation',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query for church name or keywords',
            },
            county: {
              type: 'string',
              description: 'Filter by county name (e.g., "Salt Lake", "Utah")',
            },
            status: {
              type: 'string',
              description: 'Filter by church status',
              enum: ['Listed', 'Ready to list', 'Assess', 'Needs data', 'Unlisted', 'Heretical', 'Closed'],
            },
            affiliation: {
              type: 'string',
              description: 'Filter by church network/affiliation name',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (default: 20)',
              minimum: 1,
              maximum: 100,
            },
          },
        },
      },
      {
        name: 'county_browser',
        description: 'Browse churches by Utah county with population and church count statistics',
        inputSchema: {
          type: 'object',
          properties: {
            county: {
              type: 'string',
              description: 'County name or path (e.g., "Salt Lake" or "salt-lake")',
            },
            include_churches: {
              type: 'boolean',
              description: 'Include list of churches in the county (default: true)',
            },
          },
        },
      },
      {
        name: 'network_explorer',
        description: 'Explore church networks and affiliations with their member churches',
        inputSchema: {
          type: 'object',
          properties: {
            network: {
              type: 'string',
              description: 'Network/affiliation name or path',
            },
            include_churches: {
              type: 'boolean',
              description: 'Include list of churches in the network (default: true)',
            },
            status_filter: {
              type: 'string',
              description: 'Filter networks by status',
              enum: ['Listed', 'Unlisted', 'Heretical'],
            },
          },
        },
      },
      {
        name: 'church_details',
        description:
          'Get comprehensive information about a specific church including location, contacts, and affiliations',
        inputSchema: {
          type: 'object',
          properties: {
            identifier: {
              type: 'string',
              description: 'Church ID, name, or URL path',
            },
          },
          required: ['identifier'],
        },
      },
    ],
  });
});

// MCP Protocol: Call a specific tool
mcpRoutes.post('/tools/call', async (c) => {
  const body = await c.req.json();
  const { name, arguments: args } = body;

  switch (name) {
    case 'church_search':
      return await handleChurchSearch(c, args);
    case 'county_browser':
      return await handleCountyBrowser(c, args);
    case 'network_explorer':
      return await handleNetworkExplorer(c, args);
    case 'church_details':
      return await handleChurchDetails(c, args);
    default:
      return c.json({ error: 'Unknown tool' }, 400);
  }
});

// Tool Implementations

async function handleChurchSearch(c: any, args: any) {
  const db = createDbWithContext(c);
  const { query = '', county, status, affiliation, limit = 20 } = args;

  const churchQuery = db
    .select({
      id: churches.id,
      name: churches.name,
      path: churches.path,
      status: churches.status,
      gatheringAddress: churches.gatheringAddress,
      website: churches.website,
      phone: churches.phone,
      email: churches.email,
      latitude: churches.latitude,
      longitude: churches.longitude,
      countyName: counties.name,
      notes: churches.publicNotes,
    })
    .from(churches)
    .leftJoin(counties, eq(churches.countyId, counties.id));

  const conditions = [];

  // Text search
  if (query && query.length >= 2) {
    conditions.push(sql`${churches.name} LIKE ${'%' + query + '%'} COLLATE NOCASE`);
  }

  // County filter
  if (county) {
    conditions.push(sql`${counties.name} LIKE ${'%' + county + '%'} COLLATE NOCASE`);
  }

  // Status filter
  if (status) {
    conditions.push(eq(churches.status, status));
  }

  // Build WHERE clause
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  let results = await churchQuery
    .where(whereClause)
    .orderBy(
      query && query.length >= 2
        ? sql`CASE 
            WHEN ${churches.name} LIKE ${query + '%'} COLLATE NOCASE THEN 1 
            WHEN ${churches.name} LIKE ${'%' + query + '%'} COLLATE NOCASE THEN 2 
            ELSE 3 
          END`
        : churches.name
    )
    .limit(Math.min(limit, 100))
    .all();

  // Affiliation filter (post-query due to many-to-many relationship)
  if (affiliation) {
    const churchIds = results.map((c) => c.id);
    if (churchIds.length > 0) {
      const affiliatedChurches = await db
        .select({ churchId: churchAffiliations.churchId })
        .from(churchAffiliations)
        .leftJoin(affiliations, eq(churchAffiliations.affiliationId, affiliations.id))
        .where(
          sql`${churchAffiliations.churchId} IN (${churchIds.join(',')}) AND ${affiliations.name} LIKE ${'%' + affiliation + '%'} COLLATE NOCASE`
        )
        .all();

      const affiliatedChurchIds = new Set(affiliatedChurches.map((ac) => ac.churchId));
      results = results.filter((c) => affiliatedChurchIds.has(c.id));
    }
  }

  return c.json({
    content: [
      {
        type: 'text',
        text: `Found ${results.length} church(es) matching your criteria:\n\n${results
          .map(
            (church) =>
              `**${church.name}** (${church.status})\n` +
              `County: ${church.countyName || 'Unknown'}\n` +
              `Address: ${church.gatheringAddress || 'Not specified'}\n` +
              `Website: ${church.website || 'None'}\n` +
              `Contact: ${church.phone || church.email || 'None'}\n` +
              (church.notes ? `Notes: ${church.notes}\n` : '') +
              `---`
          )
          .join('\n\n')}`,
      },
    ],
  });
}

async function handleCountyBrowser(c: any, args: any) {
  const db = createDbWithContext(c);
  const { county, include_churches = true } = args;

  if (county) {
    // Get specific county with church count
    const countyData = await db
      .select({
        id: counties.id,
        name: counties.name,
        path: counties.path,
        description: counties.description,
        population: counties.population,
        churchCount: sql<number>`COUNT(${churches.id})`.as('churchCount'),
      })
      .from(counties)
      .leftJoin(churches, eq(counties.id, churches.countyId))
      .where(
        sql`${counties.name} LIKE ${'%' + county + '%'} COLLATE NOCASE OR ${counties.path} LIKE ${'%' + county + '%'} COLLATE NOCASE`
      )
      .groupBy(counties.id)
      .get();

    if (!countyData) {
      return c.json({ error: 'County not found' }, 404);
    }

    let response =
      `**${countyData.name} County**\n\n` +
      `Population: ${countyData.population?.toLocaleString() || 'Unknown'}\n` +
      `Churches: ${countyData.churchCount}\n`;

    if (countyData.description) {
      response += `Description: ${countyData.description}\n`;
    }

    if (include_churches && countyData.churchCount > 0) {
      const countyChurches = await db
        .select({
          name: churches.name,
          path: churches.path,
          status: churches.status,
          gatheringAddress: churches.gatheringAddress,
          website: churches.website,
        })
        .from(churches)
        .where(eq(churches.countyId, countyData.id))
        .orderBy(churches.name)
        .all();

      response += `\n**Churches in ${countyData.name} County:**\n\n`;
      response += countyChurches
        .map(
          (church) =>
            `• **${church.name}** (${church.status})\n` +
            `  Address: ${church.gatheringAddress || 'Not specified'}\n` +
            `  Website: ${church.website || 'None'}`
        )
        .join('\n\n');
    }

    return c.json({
      content: [{ type: 'text', text: response }],
    });
  } else {
    // List all counties with church counts
    const allCounties = await db
      .select({
        name: counties.name,
        path: counties.path,
        population: counties.population,
        churchCount: sql<number>`COUNT(${churches.id})`.as('churchCount'),
      })
      .from(counties)
      .leftJoin(churches, eq(counties.id, churches.countyId))
      .groupBy(counties.id)
      .orderBy(counties.name)
      .all();

    const response = `**Utah Counties with Churches**\n\n${allCounties
      .map(
        (county) =>
          `**${county.name} County**\n` +
          `Population: ${county.population?.toLocaleString() || 'Unknown'}\n` +
          `Churches: ${county.churchCount}`
      )
      .join('\n\n')}`;

    return c.json({
      content: [{ type: 'text', text: response }],
    });
  }
}

async function handleNetworkExplorer(c: any, args: any) {
  const db = createDbWithContext(c);
  const { network, include_churches = true, status_filter } = args;

  if (network) {
    // Get specific network
    const networkQuery = db
      .select({
        id: affiliations.id,
        name: affiliations.name,
        path: affiliations.path,
        status: affiliations.status,
        website: affiliations.website,
        publicNotes: affiliations.publicNotes,
        churchCount: sql<number>`COUNT(${churchAffiliations.churchId})`.as('churchCount'),
      })
      .from(affiliations)
      .leftJoin(churchAffiliations, eq(affiliations.id, churchAffiliations.affiliationId))
      .where(
        sql`${affiliations.name} LIKE ${'%' + network + '%'} COLLATE NOCASE OR ${affiliations.path} LIKE ${'%' + network + '%'} COLLATE NOCASE`
      )
      .groupBy(affiliations.id);

    const networkData = await networkQuery.get();

    if (!networkData) {
      return c.json({ error: 'Network not found' }, 404);
    }

    let response =
      `**${networkData.name}** (${networkData.status})\n\n` + `Member Churches: ${networkData.churchCount}\n`;

    if (networkData.website) {
      response += `Website: ${networkData.website}\n`;
    }

    if (networkData.publicNotes) {
      response += `Notes: ${networkData.publicNotes}\n`;
    }

    if (include_churches && networkData.churchCount > 0) {
      const networkChurches = await db
        .select({
          name: churches.name,
          path: churches.path,
          status: churches.status,
          gatheringAddress: churches.gatheringAddress,
          website: churches.website,
          countyName: counties.name,
        })
        .from(churchAffiliations)
        .leftJoin(churches, eq(churchAffiliations.churchId, churches.id))
        .leftJoin(counties, eq(churches.countyId, counties.id))
        .where(eq(churchAffiliations.affiliationId, networkData.id))
        .orderBy(churches.name)
        .all();

      response += `\n**Member Churches:**\n\n`;
      response += networkChurches
        .map(
          (church) =>
            `• **${church.name}** (${church.status})\n` +
            `  County: ${church.countyName || 'Unknown'}\n` +
            `  Address: ${church.gatheringAddress || 'Not specified'}\n` +
            `  Website: ${church.website || 'None'}`
        )
        .join('\n\n');
    }

    return c.json({
      content: [{ type: 'text', text: response }],
    });
  } else {
    // List all networks with church counts
    const networkQueryBase = db
      .select({
        name: affiliations.name,
        path: affiliations.path,
        status: affiliations.status,
        website: affiliations.website,
        churchCount: sql<number>`COUNT(${churchAffiliations.churchId})`.as('churchCount'),
      })
      .from(affiliations)
      .leftJoin(churchAffiliations, eq(affiliations.id, churchAffiliations.affiliationId));

    const allNetworks = await (status_filter
      ? networkQueryBase.where(eq(affiliations.status, status_filter))
      : networkQueryBase
    )
      .groupBy(affiliations.id)
      .orderBy(affiliations.name)
      .all();

    const response = `**Church Networks & Affiliations**\n\n${allNetworks
      .map(
        (network) =>
          `**${network.name}** (${network.status})\n` +
          `Member Churches: ${network.churchCount}\n` +
          `Website: ${network.website || 'None'}`
      )
      .join('\n\n')}`;

    return c.json({
      content: [{ type: 'text', text: response }],
    });
  }
}

async function handleChurchDetails(c: any, args: any) {
  const db = createDbWithContext(c);
  const { identifier } = args;

  if (!identifier) {
    return c.json({ error: 'Church identifier is required' }, 400);
  }

  // Try to find church by ID, name, or path
  const church = await db
    .select({
      id: churches.id,
      name: churches.name,
      path: churches.path,
      status: churches.status,
      gatheringAddress: churches.gatheringAddress,
      latitude: churches.latitude,
      longitude: churches.longitude,
      website: churches.website,
      statementOfFaith: churches.statementOfFaith,
      phone: churches.phone,
      email: churches.email,
      facebook: churches.facebook,
      instagram: churches.instagram,
      youtube: churches.youtube,
      spotify: churches.spotify,
      language: churches.language,
      publicNotes: churches.publicNotes,
      countyName: counties.name,
      lastUpdated: churches.updatedAt,
    })
    .from(churches)
    .leftJoin(counties, eq(churches.countyId, counties.id))
    .where(
      sql`${churches.id} = ${Number(identifier) || 0} OR ${churches.name} LIKE ${'%' + identifier + '%'} COLLATE NOCASE OR ${churches.path} = ${identifier}`
    )
    .get();

  if (!church) {
    return c.json({ error: 'Church not found' }, 404);
  }

  // Get affiliations
  const churchAffiliationsData = await db
    .select({
      name: affiliations.name,
      website: affiliations.website,
      status: affiliations.status,
    })
    .from(churchAffiliations)
    .leftJoin(affiliations, eq(churchAffiliations.affiliationId, affiliations.id))
    .where(eq(churchAffiliations.churchId, church.id))
    .all();

  let response =
    `**${church.name}**\n\n` + `Status: ${church.status}\n` + `County: ${church.countyName || 'Unknown'}\n`;

  if (church.gatheringAddress) {
    response += `Address: ${church.gatheringAddress}\n`;
  }

  if (church.latitude && church.longitude) {
    response += `Coordinates: ${church.latitude}, ${church.longitude}\n`;
  }

  response += '\n**Contact Information:**\n';
  if (church.website) response += `Website: ${church.website}\n`;
  if (church.phone) response += `Phone: ${church.phone}\n`;
  if (church.email) response += `Email: ${church.email}\n`;
  if (church.statementOfFaith) response += `Statement of Faith: ${church.statementOfFaith}\n`;

  if (church.facebook || church.instagram || church.youtube || church.spotify) {
    response += '\n**Social Media:**\n';
    if (church.facebook) response += `Facebook: ${church.facebook}\n`;
    if (church.instagram) response += `Instagram: ${church.instagram}\n`;
    if (church.youtube) response += `YouTube: ${church.youtube}\n`;
    if (church.spotify) response += `Spotify: ${church.spotify}\n`;
  }

  if (churchAffiliationsData.length > 0) {
    response += '\n**Networks & Affiliations:**\n';
    response += churchAffiliationsData
      .map((aff) => `• ${aff.name} (${aff.status})${aff.website ? ` - ${aff.website}` : ''}`)
      .join('\n');
  }

  if (church.language) {
    response += `\n**Language:** ${church.language}\n`;
  }

  if (church.publicNotes) {
    response += `\n**Notes:** ${church.publicNotes}\n`;
  }

  if (church.lastUpdated) {
    const date =
      typeof church.lastUpdated === 'number' ? new Date(church.lastUpdated * 1000) : new Date(church.lastUpdated);
    response += `\n*Last updated: ${date.toLocaleDateString()}*`;
  }

  return c.json({
    content: [{ type: 'text', text: response }],
  });
}
