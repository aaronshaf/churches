import type { Context } from 'hono';
import { getUser } from '../middleware/better-auth';
import { hasGoogleMapsApiKey } from './env-validation';
import { getNavbarPages } from './pages';
import { getFaviconUrl, getLogoUrl } from './settings';

export async function getCommonLayoutProps(c: Context): Promise<{
  faviconUrl: string | undefined;
  logoUrl: string | undefined;
  pages: Array<{ id: number; title: string; path: string; navbarOrder: number | null }>;
  user: any;
  showMap: boolean;
}> {
  const [faviconUrl, logoUrl, navbarPages, user] = await Promise.all([
    getFaviconUrl(c.env),
    getLogoUrl(c.env),
    getNavbarPages(c.env),
    getUser(c),
  ]);

  const showMap = hasGoogleMapsApiKey(c.env);

  return {
    faviconUrl,
    logoUrl,
    pages: navbarPages,
    user,
    showMap,
  };
}
