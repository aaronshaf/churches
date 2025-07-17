import i18next from 'i18next';
import { adminTranslations } from './i18n/admin';
import { churchTranslations } from './i18n/church';
import { commonTranslations } from './i18n/common';
import { navigationTranslations } from './i18n/navigation';
import { pagesTranslations } from './i18n/pages';

// Supported languages
export const SUPPORTED_LANGUAGES = ['en', 'es'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// Translation resources - using English text as keys for better DX
const resources = {
  en: {
    translation: {
      ...navigationTranslations,
      ...commonTranslations,
      ...churchTranslations,
      ...adminTranslations,
      ...pagesTranslations,
    },
  },
  es: {
    translation: {
      // Spanish translations would go here
      // For now, fallback to English
      ...navigationTranslations,
      ...commonTranslations,
      ...churchTranslations,
      ...adminTranslations,
      ...pagesTranslations,
    },
  },
};

// Initialize i18next
i18next.init({
  lng: 'en',
  fallbackLng: 'en',
  resources,
  interpolation: {
    escapeValue: false, // React already escapes values
  },
  // Development settings
  debug: false,

  // Namespace settings
  defaultNS: 'translation',
  ns: ['translation'],

  // Key separator settings
  keySeparator: '.',
  nsSeparator: ':',

  // Return details for missing keys in development
  saveMissing: false,
  missingKeyHandler: (lng, ns, key, fallbackValue) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`Missing translation: ${key}`);
    }
  },

  // Pluralization rules
  pluralSeparator: '_',
  contextSeparator: '_',
});

// Helper function to get translation with fallback
export function t(key: string, options?: any): string {
  return i18next.t(key, options);
}

// Helper function to change language
export function changeLanguage(lng: SupportedLanguage): Promise<any> {
  return i18next.changeLanguage(lng);
}

// Helper function to get current language
export function getCurrentLanguage(): SupportedLanguage {
  return i18next.language as SupportedLanguage;
}

// Helper function to get all supported languages
export function getSupportedLanguages(): readonly SupportedLanguage[] {
  return SUPPORTED_LANGUAGES;
}

// Helper function to check if a language is supported
export function isLanguageSupported(lng: string): lng is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(lng as SupportedLanguage);
}

// Helper function to get language from Accept-Language header
export function getLanguageFromHeader(acceptLanguage: string): SupportedLanguage {
  if (!acceptLanguage) return 'en';

  // Parse Accept-Language header
  const languages = acceptLanguage
    .split(',')
    .map((lang) => {
      const [code, qualityStr] = lang.trim().split(';q=');
      const quality = qualityStr ? parseFloat(qualityStr) : 1.0;
      return {
        code: code.toLowerCase().split('-')[0], // Get primary language code
        quality: isNaN(quality) ? 1.0 : quality,
      };
    })
    .sort((a, b) => b.quality - a.quality);

  // Find the first supported language in the user's preferences
  for (const lang of languages) {
    if (SUPPORTED_LANGUAGES.includes(lang.code as SupportedLanguage)) {
      return lang.code as SupportedLanguage;
    }
  }

  return 'en';
}

export default i18next;
