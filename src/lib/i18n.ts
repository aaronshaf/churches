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
  pt: {
    translation: {
      // Navigation
      'nav.home': 'Início',
      'nav.map': 'Mapa',
      'nav.networks': 'Redes',
      'nav.data': 'Dados',
      'nav.admin': 'Admin',
      'nav.signin': 'Entrar',
      'nav.signout': 'Sair',

      // Search
      'search.placeholder': 'Pesquisar igrejas, condados ou redes...',
      'search.loading': 'Carregando dados de pesquisa...',
      'search.noResults': 'Nenhum resultado encontrado',
      'search.typeToSearch': 'Digite para pesquisar igrejas, condados e redes',

      // Common
      'common.loading': 'Carregando...',
      'common.error': 'Erro',
      'common.save': 'Salvar',
      'common.cancel': 'Cancelar',
      'common.edit': 'Editar',
      'common.delete': 'Excluir',
      'common.back': 'Voltar',
      'common.next': 'Próximo',
      'common.previous': 'Anterior',

      // Churches
      'church.status': 'Estado',
      'church.website': 'Site',
      'church.phone': 'Telefone',
      'church.address': 'Endereço',
      'church.gatherings': 'Reuniões',
      'church.language': 'Idioma',
      'church.affiliations': 'Afiliações',
      'church.notes': 'Notas',

      // County pages
      'county.churchesIn': 'Igrejas em {{county}}',
      'county.totalChurches': '{{count}} igrejas',

      // Footer
      'footer.dataExport': 'Exportar Dados',
      'footer.edit': 'Editar',
    },
  },
  fr: {
    translation: {
      // Navigation
      'nav.home': 'Accueil',
      'nav.map': 'Carte',
      'nav.networks': 'Réseaux',
      'nav.data': 'Données',
      'nav.admin': 'Admin',
      'nav.signin': 'Connexion',
      'nav.signout': 'Déconnexion',

      // Search
      'search.placeholder': 'Rechercher églises, comtés ou réseaux...',
      'search.loading': 'Chargement des données de recherche...',
      'search.noResults': 'Aucun résultat trouvé',
      'search.typeToSearch': 'Tapez pour rechercher églises, comtés et réseaux',

      // Common
      'common.loading': 'Chargement...',
      'common.error': 'Erreur',
      'common.save': 'Enregistrer',
      'common.cancel': 'Annuler',
      'common.edit': 'Modifier',
      'common.delete': 'Supprimer',
      'common.back': 'Retour',
      'common.next': 'Suivant',
      'common.previous': 'Précédent',

      // Churches
      'church.status': 'Statut',
      'church.website': 'Site Web',
      'church.phone': 'Téléphone',
      'church.address': 'Adresse',
      'church.gatherings': 'Rassemblements',
      'church.language': 'Langue',
      'church.affiliations': 'Affiliations',
      'church.notes': 'Notes',

      // County pages
      'county.churchesIn': 'Églises à {{county}}',
      'county.totalChurches': '{{count}} églises',

      // Footer
      'footer.dataExport': 'Exporter les Données',
      'footer.edit': 'Modifier',
    },
  },
  de: {
    translation: {
      // Navigation
      'nav.home': 'Startseite',
      'nav.map': 'Karte',
      'nav.networks': 'Netzwerke',
      'nav.data': 'Daten',
      'nav.admin': 'Admin',
      'nav.signin': 'Anmelden',
      'nav.signout': 'Abmelden',

      // Search
      'search.placeholder': 'Kirchen, Landkreise oder Netzwerke suchen...',
      'search.loading': 'Suchdaten werden geladen...',
      'search.noResults': 'Keine Ergebnisse gefunden',
      'search.typeToSearch': 'Tippen Sie, um Kirchen, Landkreise und Netzwerke zu suchen',

      // Common
      'common.loading': 'Laden...',
      'common.error': 'Fehler',
      'common.save': 'Speichern',
      'common.cancel': 'Abbrechen',
      'common.edit': 'Bearbeiten',
      'common.delete': 'Löschen',
      'common.back': 'Zurück',
      'common.next': 'Weiter',
      'common.previous': 'Zurück',

      // Churches
      'church.status': 'Status',
      'church.website': 'Webseite',
      'church.phone': 'Telefon',
      'church.address': 'Adresse',
      'church.gatherings': 'Versammlungen',
      'church.language': 'Sprache',
      'church.affiliations': 'Zugehörigkeiten',
      'church.notes': 'Notizen',

      // County pages
      'county.churchesIn': 'Kirchen in {{county}}',
      'county.totalChurches': '{{count}} Kirchen',

      // Footer
      'footer.dataExport': 'Daten Exportieren',
      'footer.edit': 'Bearbeiten',
    },
  },
  ko: {
    translation: {
      // Navigation
      'nav.home': '홈',
      'nav.map': '지도',
      'nav.networks': '네트워크',
      'nav.data': '데이터',
      'nav.admin': '관리자',
      'nav.signin': '로그인',
      'nav.signout': '로그아웃',

      // Search
      'search.placeholder': '교회, 카운티 또는 네트워크 검색...',
      'search.loading': '검색 데이터 로딩 중...',
      'search.noResults': '결과를 찾을 수 없습니다',
      'search.typeToSearch': '교회, 카운티 및 네트워크를 검색하려면 입력하세요',

      // Common
      'common.loading': '로딩 중...',
      'common.error': '오류',
      'common.save': '저장',
      'common.cancel': '취소',
      'common.edit': '편집',
      'common.delete': '삭제',
      'common.back': '뒤로',
      'common.next': '다음',
      'common.previous': '이전',

      // Churches
      'church.status': '상태',
      'church.website': '웹사이트',
      'church.phone': '전화',
      'church.address': '주소',
      'church.gatherings': '모임',
      'church.language': '언어',
      'church.affiliations': '소속',
      'church.notes': '노트',

      // County pages
      'county.churchesIn': '{{county}}의 교회들',
      'county.totalChurches': '{{count}}개의 교회',

      // Footer
      'footer.dataExport': '데이터 내보내기',
      'footer.edit': '편집',
    },
  },
  zh: {
    translation: {
      // Navigation
      'nav.home': '首页',
      'nav.map': '地图',
      'nav.networks': '网络',
      'nav.data': '数据',
      'nav.admin': '管理员',
      'nav.signin': '登录',
      'nav.signout': '登出',

      // Search
      'search.placeholder': '搜索教会、县或网络...',
      'search.loading': '正在加载搜索数据...',
      'search.noResults': '未找到结果',
      'search.typeToSearch': '输入以搜索教会、县和网络',

      // Common
      'common.loading': '加载中...',
      'common.error': '错误',
      'common.save': '保存',
      'common.cancel': '取消',
      'common.edit': '编辑',
      'common.delete': '删除',
      'common.back': '返回',
      'common.next': '下一个',
      'common.previous': '上一个',

      // Churches
      'church.status': '状态',
      'church.website': '网站',
      'church.phone': '电话',
      'church.address': '地址',
      'church.gatherings': '聚会',
      'church.language': '语言',
      'church.affiliations': '隶属关系',
      'church.notes': '备注',

      // County pages
      'county.churchesIn': '{{county}}的教会',
      'county.totalChurches': '{{count}}个教会',

      // Footer
      'footer.dataExport': '导出数据',
      'footer.edit': '编辑',
    },
  },
};

// Initialize i18next
let isInitialized = false;

export async function initI18n(language = 'en') {
  if (!isInitialized) {
    await i18next.init({
      lng: language,
      fallbackLng: 'en',
      resources,
      interpolation: {
        escapeValue: false, // React already does escaping
      },
    });
    isInitialized = true;
  } else {
    await i18next.changeLanguage(language);
  }
  return i18next;
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
  if (!acceptLanguage) {
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

  // Find the first supported language in the user's preferences
  for (const lang of languages) {
    if (SUPPORTED_LANGUAGES.includes(lang.code as SupportedLanguage)) {
      return lang.code as SupportedLanguage;
    }
  }

  return 'en';
}

export default i18next;
