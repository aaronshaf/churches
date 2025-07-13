import type { Context } from 'hono';
import type { SupportedLanguage } from '../lib/i18n';
import { getUser } from '../middleware/better-auth';
import type { AuthVariables, BetterAuthUser } from '../types';
import { hasGoogleMapsApiKey } from './env-validation';
import { getNavbarPages } from './pages';
import { getFaviconUrl, getLogoUrl, getSiteTitle } from './settings';

export async function getCommonLayoutProps(c: Context<{ Bindings: any; Variables: AuthVariables }, any, any>): Promise<{
  faviconUrl: string | undefined;
  logoUrl: string | undefined;
  siteTitle: string;
  pages: Array<{ id: number; title: string; path: string; navbarOrder: number | null }>;
  user: BetterAuthUser | null;
  showMap: boolean;
  language: SupportedLanguage;
  t: (key: string, options?: object) => string;
}> {
  const [faviconUrl, logoUrl, siteTitle, navbarPages, user] = await Promise.all([
    getFaviconUrl(c.env),
    getLogoUrl(c.env),
    getSiteTitle(c.env),
    getNavbarPages(c.env),
    getUser(c),
  ]);

  const showMap = hasGoogleMapsApiKey(c.env);

  // Get language and translation function from context (set by i18n middleware)
  const language = (c.get('language') as SupportedLanguage) || 'en';
  const t = c.get('t') || ((key: string) => key);

  return {
    faviconUrl,
    logoUrl,
    siteTitle,
    pages: navbarPages,
    user,
    showMap,
    language,
    t,
  };
}
