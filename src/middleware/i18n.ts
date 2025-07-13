import type { Context, Next } from 'hono';
import { detectLanguageFromHeader, initI18n } from '../lib/i18n';

export async function i18nMiddleware(c: Context, next: Next) {
  // Detect language from Accept-Language header
  const acceptLanguage = c.req.header('Accept-Language');
  const detectedLanguage = detectLanguageFromHeader(acceptLanguage);

  // Debug logging (remove in production)
  console.log('Accept-Language:', acceptLanguage);
  console.log('Detected language:', detectedLanguage);

  // Allow override via query parameter (?lang=es)
  const queryLang = c.req.query('lang') as 'en' | 'es' | undefined;
  const language = queryLang && ['en', 'es'].includes(queryLang) ? queryLang : detectedLanguage;

  console.log('Final language:', language);

  // Initialize i18next for this request
  await initI18n(language);

  // Store language in context for use in components
  c.set('language', language);
  c.set('t', (key: string, options?: object) => {
    const i18next = require('i18next').default;
    return i18next.t(key, options);
  });

  await next();
}
