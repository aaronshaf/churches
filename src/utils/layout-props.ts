import { Context } from 'hono';
import { hasGoogleMapsApiKey } from './env-validation';
import { getFaviconUrl, getLogoUrl } from './settings';
import { getNavbarPages } from './pages';
import { getUser } from '../middleware/better-auth';

export async function getCommonLayoutProps(c: Context) {
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