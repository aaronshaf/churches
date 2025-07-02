import { createDb } from '../src/db';
import { settings } from '../src/db/schema';
import { config } from 'dotenv';

config({ path: '.dev.vars' });

async function checkSettings() {
  const db = createDb({
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL!,
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN!,
  });

  const allSettings = await db.select().from(settings);
  console.log('All settings:', allSettings);
  
  // Check specifically for favicon_url and logo_url
  const faviconSetting = allSettings.find(s => s.key === 'favicon_url');
  const logoSetting = allSettings.find(s => s.key === 'logo_url');
  
  console.log('\nFavicon URL setting:', faviconSetting);
  console.log('Logo URL setting:', logoSetting);
}

checkSettings().catch(console.error);