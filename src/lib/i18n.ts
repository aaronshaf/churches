import i18next from 'i18next';

// Translation resources
const resources = {
  en: {
    translation: {
      // Navigation
      'nav.home': 'Home',
      'nav.map': 'Map',
      'nav.networks': 'Networks',
      'nav.data': 'Data',
      'nav.admin': 'Admin',
      'nav.signin': 'Sign In',
      'nav.signout': 'Sign Out',

      // Search
      'search.placeholder': 'Search churches, counties, or networks...',
      'search.loading': 'Loading search data...',
      'search.noResults': 'No results found',
      'search.typeToSearch': 'Type to search churches, counties, and networks',

      // Common
      'common.loading': 'Loading...',
      'common.error': 'Error',
      'common.save': 'Save',
      'common.cancel': 'Cancel',
      'common.edit': 'Edit',
      'common.delete': 'Delete',
      'common.back': 'Back',
      'common.next': 'Next',
      'common.previous': 'Previous',

      // Churches
      'church.status': 'Status',
      'church.website': 'Website',
      'church.phone': 'Phone',
      'church.address': 'Address',
      'church.gatherings': 'Gatherings',
      'church.language': 'Language',
      'church.affiliations': 'Affiliations',
      'church.notes': 'Notes',

      // County pages
      'county.churchesIn': 'Churches in {{county}}',
      'county.totalChurches': '{{count}} churches',

      // Footer
      'footer.dataExport': 'Data Export',
      'footer.edit': 'Edit',
    },
  },
  es: {
    translation: {
      // Navigation
      'nav.home': 'Inicio',
      'nav.map': 'Mapa',
      'nav.networks': 'Redes',
      'nav.data': 'Datos',
      'nav.admin': 'Admin',
      'nav.signin': 'Iniciar Sesión',
      'nav.signout': 'Cerrar Sesión',

      // Search
      'search.placeholder': 'Buscar iglesias, condados o redes...',
      'search.loading': 'Cargando datos de búsqueda...',
      'search.noResults': 'No se encontraron resultados',
      'search.typeToSearch': 'Escribe para buscar iglesias, condados y redes',

      // Common
      'common.loading': 'Cargando...',
      'common.error': 'Error',
      'common.save': 'Guardar',
      'common.cancel': 'Cancelar',
      'common.edit': 'Editar',
      'common.delete': 'Eliminar',
      'common.back': 'Atrás',
      'common.next': 'Siguiente',
      'common.previous': 'Anterior',

      // Churches
      'church.status': 'Estado',
      'church.website': 'Sitio Web',
      'church.phone': 'Teléfono',
      'church.address': 'Dirección',
      'church.gatherings': 'Reuniones',
      'church.language': 'Idioma',
      'church.affiliations': 'Afiliaciones',
      'church.notes': 'Notas',

      // County pages
      'county.churchesIn': 'Iglesias en {{county}}',
      'county.totalChurches': '{{count}} iglesias',

      // Footer
      'footer.dataExport': 'Exportar Datos',
      'footer.edit': 'Editar',
    },
  },
};

// Initialize i18next
export function initI18n(language = 'en') {
  return i18next.init({
    lng: language,
    fallbackLng: 'en',
    resources,
    interpolation: {
      escapeValue: false, // React already does escaping
    },
  });
}

// Supported languages - top 20 for church/religious websites
export const SUPPORTED_LANGUAGES = [
  'en', // English - Primary
  'es', // Spanish - Large Hispanic population
  'pt', // Portuguese - Brazilian communities
  'fr', // French - International churches
  'de', // German - German-speaking communities
  'it', // Italian - Catholic communities
  'nl', // Dutch - Reformed churches
  'ru', // Russian - Eastern European immigrants
  'ko', // Korean - Strong Korean Christian communities
  'zh', // Chinese - Mandarin/Traditional Chinese
  'ja', // Japanese - Japanese communities
  'vi', // Vietnamese - Large Vietnamese Christian population
  'tl', // Tagalog/Filipino - Filipino communities
  'hi', // Hindi - Indian communities
  'ar', // Arabic - Middle Eastern Christians
  'pl', // Polish - Polish Catholic communities
  'uk', // Ukrainian - Ukrainian communities
  'ro', // Romanian - Romanian Orthodox
  'hu', // Hungarian - Hungarian communities
  'sr', // Serbian - Serbian Orthodox
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// Helper function to detect language from Accept-Language header
export function detectLanguageFromHeader(acceptLanguage?: string): SupportedLanguage {
  console.log('🌍 Accept-Language header:', acceptLanguage);

  if (!acceptLanguage) {
    console.log('🌍 No Accept-Language header, defaulting to English');
    return 'en';
  }

  const languages = acceptLanguage
    .split(',')
    .map((lang) => {
      const [code, q = 'q=1'] = lang.trim().split(';');
      return {
        code: code.split('-')[0].toLowerCase(), // Get just the language code (es from es-MX)
        quality: parseFloat(q.split('=')[1] || '1'),
      };
    })
    .sort((a, b) => b.quality - a.quality);

  console.log('🌍 Parsed languages:', languages);

  // Find the first supported language in the user's preferences
  for (const lang of languages) {
    if (SUPPORTED_LANGUAGES.includes(lang.code as SupportedLanguage)) {
      console.log('🌍 Detected supported language:', lang.code);
      return lang.code as SupportedLanguage;
    }
  }

  console.log('🌍 No supported language found, defaulting to English');
  return 'en';
}

export default i18next;
