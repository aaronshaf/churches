import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'better-sqlite', // For local development
  dbCredentials: {
    url: './.wrangler/state/v3/d1/miniflare-D1DatabaseObject/utahchurches.sqlite'
  }
} satisfies Config;