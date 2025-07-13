import type { Context, Next } from 'hono';
import i18next, { type TOptions } from 'i18next';
import { detectLanguageFromHeader, initI18n } from '../lib/i18n';

export async function i18nMiddleware(c: Context, next: Next) {
  // Detect language from Accept-Language header
  const acceptLanguage = c.req.header('Accept-Language');
  const language = detectLanguageFromHeader(acceptLanguage);

  // Initialize i18next for this request
  await initI18n(language);

  // Store language in context for use in components
  c.set('language', language);
  c.set('t', (key: string, options?: TOptions) => {
    return i18next.t(key, options);
  });

  await next();
}
