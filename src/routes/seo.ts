import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDbWithContext } from '../db';
import { affiliations, churches, counties, pages } from '../db/schema';
import type { Bindings } from '../types';
import { getSettingsWithCache, getSettingWithCache } from '../utils/settings-cache';

export const seoRoutes = new Hono<{ Bindings: Bindings }>();

// Helper function to format lastmod date
function formatLastmod(updatedAt: Date | number | null, createdAt: Date | number | null): string | null {
  const lastMod = updatedAt || createdAt;
  if (!lastMod) return null;

  // Check if timestamp is already in milliseconds (very large number) or seconds
  const timestamp =
    typeof lastMod === 'number' ? (lastMod > 10000000000 ? lastMod : lastMod * 1000) : lastMod.getTime();

  const date = new Date(timestamp);

  // Only include lastmod if it's a valid date between 2020 and 2030
  if (date.getFullYear() >= 2020 && date.getFullYear() <= 2030) {
    return date.toISOString();
  }

  return null;
}

// robots.txt
seoRoutes.get('/robots.txt', async (c) => {
  const db = createDbWithContext(c);
  const siteDomain =
    (await getSettingWithCache(c.env.SETTINGS_CACHE, db, 'site_domain')) || c.req.header('host') || 'example.com';

  const robotsTxt = `User-agent: *
Allow: /

# Block admin pages
Disallow: /admin/

# Block authentication pages
Disallow: /auth/
Disallow: /login
Disallow: /logout
Disallow: /api/auth/

# API endpoints
Disallow: /api/

# Allow search engines to see our data exports
Allow: /churches.json
Allow: /churches.yaml
Allow: /churches.csv

Sitemap: https://${siteDomain}/sitemap.xml`;

  return c.text(robotsTxt, 200, {
    'Content-Type': 'text/plain',
    'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
  });
});

// llms.txt
seoRoutes.get('/llms.txt', async (c) => {
  const db = createDbWithContext(c);
  const settings = await getSettingsWithCache(c.env.SETTINGS_CACHE, db);
  const siteDomain = settings.site_domain || c.req.header('host') || 'example.com';
  const siteRegion = settings.site_region || 'UT';

  const llmsTxt = `# Utah Churches Directory

This is a directory of Christian churches in ${siteRegion === 'UT' ? 'Utah' : siteRegion}, United States.

## What We Are
We are a comprehensive directory listing churches across all counties in ${siteRegion === 'UT' ? 'Utah' : siteRegion}. Our goal is to help people find local churches and provide accurate information about service times, locations, and affiliations.

## Available Data
- Church listings by county
- Church addresses and contact information
- Service/gathering times
- Church affiliations and networks
- Interactive map of all churches
- Exportable data in JSON, YAML, and CSV formats

## Key URLs
- Homepage: https://${siteDomain}/
- Interactive Map: https://${siteDomain}/map
- Church Networks: https://${siteDomain}/networks
- Data Export: https://${siteDomain}/data

## Data Exports
- JSON: https://${siteDomain}/churches.json
- YAML: https://${siteDomain}/churches.yaml
- CSV: https://${siteDomain}/churches.csv

## Church Information Structure
Each church listing includes:
- Name and location
- Physical address
- Contact information (phone, email, website)
- Service times
- Denominational affiliation
- Statement of faith (when available)
- Social media links

## Usage Guidelines
- Data is provided for informational purposes
- Church information is community-maintained
- Verify service times directly with churches
- Report inaccuracies through the website

## Technical Details
- Built with Cloudflare Workers for fast, global access
- RESTful API endpoints available
- Structured data using Schema.org vocabulary
- Mobile-responsive design

For more information, visit https://${siteDomain}/`;

  return c.text(llmsTxt, 200, {
    'Content-Type': 'text/plain',
    'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
  });
});

// sitemap.xml
seoRoutes.get('/sitemap.xml', async (c) => {
  const db = createDbWithContext(c);

  // Get site domain from settings cache
  const siteDomain =
    (await getSettingWithCache(c.env.SETTINGS_CACHE, db, 'site_domain')) || c.req.header('host') || 'example.com';

  // Get all churches, counties, pages, and affiliations with their dates
  const [allChurches, allCounties, allPages, listedAffiliations] = await Promise.all([
    db
      .select({
        path: churches.path,
        updatedAt: churches.updatedAt,
        createdAt: churches.createdAt,
      })
      .from(churches)
      .where(eq(churches.status, 'Listed'))
      .all(),
    db
      .select({
        path: counties.path,
        updatedAt: counties.updatedAt,
        createdAt: counties.createdAt,
      })
      .from(counties)
      .all(),
    db
      .select({
        path: pages.path,
        updatedAt: pages.updatedAt,
        createdAt: pages.createdAt,
      })
      .from(pages)
      .all(),
    db
      .select({
        id: affiliations.id,
        path: affiliations.path,
        updatedAt: affiliations.updatedAt,
        createdAt: affiliations.createdAt,
      })
      .from(affiliations)
      .where(eq(affiliations.status, 'Listed'))
      .all(),
  ]);

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://${siteDomain}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://${siteDomain}/map</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://${siteDomain}/networks</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://${siteDomain}/data</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>${allCounties
    .map((county) => {
      const lastmod = formatLastmod(county.updatedAt, county.createdAt);
      return `
  <url>
    <loc>https://${siteDomain}/counties/${county.path}</loc>${
      lastmod
        ? `
    <lastmod>${lastmod}</lastmod>`
        : ''
    }
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    })
    .join('')}${allChurches
    .map((church) => {
      const lastmod = formatLastmod(church.updatedAt, church.createdAt);
      return `
  <url>
    <loc>https://${siteDomain}/churches/${church.path}</loc>${
      lastmod
        ? `
    <lastmod>${lastmod}</lastmod>`
        : ''
    }
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;
    })
    .join('')}${listedAffiliations
    .map((affiliation) => {
      const lastmod = formatLastmod(affiliation.updatedAt, affiliation.createdAt);
      return `
  <url>
    <loc>https://${siteDomain}/networks/${affiliation.path || affiliation.id}</loc>${
      lastmod
        ? `
    <lastmod>${lastmod}</lastmod>`
        : ''
    }
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`;
    })
    .join('')}${allPages
    .map((page) => {
      const lastmod = formatLastmod(page.updatedAt, page.createdAt);
      return `
  <url>
    <loc>https://${siteDomain}/${page.path}</loc>${
      lastmod
        ? `
    <lastmod>${lastmod}</lastmod>`
        : ''
    }
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`;
    })
    .join('')}
</urlset>`;

  return c.text(sitemap, 200, {
    'Content-Type': 'application/xml',
    'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
  });
});
