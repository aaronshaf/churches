import i18next from 'i18next';

// Translation resources - using English text as keys for better DX
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
      'common.remove': 'Remove',
      'common.submit': 'Submit',
      'common.submitting': 'Submitting...',
      'common.created': 'Created',
      'common.name': 'Name',

      // Home page
      'home.findChurch': 'Find a Church Near You',
      'home.exploreMap': 'Explore map of evangelical churches',
      'home.browseByCounty': 'Browse by County',
      'home.sortBy': 'Sort by:',
      'home.population': 'Population',
      'home.name': 'Name',

      // Churches
      'church.status': 'Status',
      'church.website': 'Website',
      'church.phone': 'Phone',
      'church.address': 'Address',
      'church.gatherings': 'Gatherings',
      'church.language': 'Language',
      'church.affiliations': 'Affiliations',
      'church.notes': 'Notes',
      'church.email': 'Email',
      'church.gatheringAddress': 'Gathering Address',
      'church.statementOfFaith': 'Statement of Faith',
      'church.primaryLanguage': 'Primary Language',
      'church.publicNotes': 'Public Notes',
      'church.gatheringTimes': 'Gathering Times',
      'church.images': 'Images',
      'church.getDirections': 'Get Directions',
      'church.viewOnMap': 'View on Map',
      'church.updateSermons': 'Update Sermons',

      // Church Status
      'churchStatus.listed': 'Listed',
      'churchStatus.readyToList': 'Ready to list',
      'churchStatus.assess': 'Assess',
      'churchStatus.needsData': 'Needs data',
      'churchStatus.unlisted': 'Unlisted',
      'churchStatus.heretical': 'Heretical',
      'churchStatus.closed': 'Closed',

      // Church Form
      'churchForm.createNew': 'Create New Church',
      'churchForm.edit': 'Edit Church',
      'churchForm.churchName': 'Church Name',
      'churchForm.urlPath': 'URL Path',
      'churchForm.pathValidation': 'Only lowercase letters, numbers, and hyphens allowed',
      'churchForm.status': 'Church Status',
      'churchForm.county': 'County',
      'churchForm.selectCounty': 'Select county',
      'churchForm.basicInfo': 'Basic Information',
      'churchForm.contactInfo': 'Contact Information',
      'churchForm.website': 'Website',
      'churchForm.phone': 'Phone Number',
      'churchForm.email': 'Email Address',
      'churchForm.address': 'Address',
      'churchForm.gatheringInfo': 'Gathering Information',
      'churchForm.gatheringAddress': 'Gathering Address',
      'churchForm.statementOfFaith': 'Statement of Faith URL',
      'churchForm.primaryLanguage': 'Primary Language',
      'churchForm.socialMedia': 'Social Media',
      'churchForm.facebook': 'Facebook Page',
      'churchForm.instagram': 'Instagram Handle',
      'churchForm.youtube': 'YouTube Channel',
      'churchForm.spotify': 'Spotify Podcast',
      'churchForm.affiliations': 'Affiliations',
      'churchForm.images': 'Church Images',
      'churchForm.uploadImages': 'Upload Images',
      'churchForm.publicNotes': 'Public Notes',
      'churchForm.privateNotes': 'Private Notes',
      'churchForm.gatheringTimes': 'Gathering Times',
      'churchForm.addGathering': 'Add Gathering',
      'churchForm.save': 'Save Church',
      'churchForm.cancel': 'Cancel',

      // County pages
      'county.churchesIn': 'Churches in {{county}}',
      'county.totalChurches': '{{count}} churches',

      // Admin
      'admin.dashboard': 'Admin Dashboard',
      'admin.completeSetup': 'Complete your site setup',
      'admin.configureNow': 'Configure now →',
      'admin.createChurch': 'Create Church',
      'admin.manageCounties': 'Manage Counties',
      'admin.addNewCounty': 'Add New County',
      'admin.managePages': 'Manage Pages',

      // Admin Churches
      'adminChurches.title': 'Manage Churches',
      'adminChurches.search': 'Search',
      'adminChurches.searchPlaceholder': 'Search by name or address...',
      'adminChurches.county': 'County',
      'adminChurches.allCounties': 'All Counties',
      'adminChurches.status': 'Status',
      'adminChurches.allStatuses': 'All Statuses',
      'adminChurches.affiliation': 'Affiliation',
      'adminChurches.allAffiliations': 'All Affiliations',
      'adminChurches.clearFilters': 'Clear Filters',
      'adminChurches.addChurch': 'Add Church',
      'adminChurches.noResults': 'No churches found matching your filters',
      'adminChurches.updateSuccess': 'Church updated successfully!',

      // Authentication
      'auth.signInRequired': 'Sign In Required',
      'auth.signInToContinue': 'Sign In to Continue',
      'auth.signInTitle': 'Sign In - Utah Churches',
      'auth.signInDescription': 'Sign in to manage your churches',
      'auth.signIn': 'Sign In',
      'auth.signInWithGoogle': 'Sign in with Google',
      'auth.securePrivate': 'Secure & Private',
      'auth.securityDescription': 'Your data is protected with industry-standard security',
      'auth.trustedByLeaders': 'Trusted by Church Leaders',
      'auth.trustedDescription': 'Join hundreds of church administrators',
      'auth.quickSetup': 'Quick Setup',
      'auth.quickSetupDescription': 'Get started in minutes',

      // Data Export
      'dataExport.title': 'Download Church Data',
      'dataExport.description': 'Export data for {{count}} evangelical churches in various formats',
      'dataExport.excelFormat': 'Excel Format',
      'dataExport.excelDescription': 'Multi-sheet workbook with churches, counties, and affiliations',
      'dataExport.downloadXlsx': 'Download XLSX',
      'dataExport.csvFormat': 'CSV Format',
      'dataExport.csvDescription': 'Spreadsheet-compatible format with church details',
      'dataExport.downloadCsv': 'Download CSV',
      'dataExport.jsonFormat': 'JSON Format',
      'dataExport.jsonDescription': 'Programmer-friendly format with complete data',
      'dataExport.downloadJson': 'Download JSON',
      'dataExport.yamlFormat': 'YAML Format',
      'dataExport.yamlDescription': 'Human-readable format with clean data',
      'dataExport.downloadYaml': 'Download YAML',
      'dataExport.usageInfo': 'Usage Information',
      'dataExport.formatNotes': 'Data Format Notes',

      // Feedback
      'feedback.title': 'Submit Feedback',
      'feedback.submitChurchSuggestion': 'Submit Church Suggestion',
      'feedback.generalPlaceholder': 'Share your thoughts about Utah Churches...',
      'feedback.churchPlaceholder': 'Provide information about this church...',
      'feedback.submit': 'Submit Feedback',
      'feedback.submitSuggestion': 'Submit Suggestion',

      // Footer
      'footer.dataExport': 'Data Export',
      'footer.edit': 'Edit',
      'footer.browseCounties': 'Browse Churches by County',
      'footer.browseNetworks': 'Browse by Network',
      'footer.submitFeedback': 'Submit Feedback',
      'footer.suggestChurch': 'Suggest a Church',

      // Navbar
      'navbar.siteTitle': 'Utah Churches',
      'navbar.searchAriaLabel': 'Search churches, counties, and networks',
      'navbar.toggleMenu': 'Toggle navigation menu',
      'navbar.toggleMainMenu': 'Toggle main menu',
      'navbar.manageChurches': 'Manage Churches',
      'navbar.manageUsers': 'Manage Users',

      // Error Messages
      'error.pageNotFound': 'Page Not Found',
      'error.pageNotFoundDescription': "The page you're looking for doesn't exist",
      'error.serverError': 'Server Error',
      'error.serverErrorDescription': 'Something went wrong on our end',
      'error.databaseError': 'Database Error',
      'error.databaseErrorDescription': 'Unable to connect to the database',
      'error.goHome': 'Go Home',
      'error.tryAgain': 'Try Again',
      'error.contactSupport': 'Contact Support',

      // Validation
      'validation.required': 'This field is required',
      'validation.invalidEmail': 'Invalid email format',
      'validation.invalidUrl': 'Invalid URL format',
      'validation.invalidPhone': 'Invalid phone number format',
      'validation.passwordLength': 'Password must be at least 8 characters',
      'validation.passwordMismatch': 'Passwords do not match',
      'validation.pathFormat': 'Only lowercase letters, numbers, and hyphens allowed',

      // Toast Messages
      'toast.success': 'Success!',
      'toast.error': 'Error!',
      'toast.warning': 'Warning!',
      'toast.info': 'Info',
      'toast.viewChurch': 'View Church',
      'toast.dismiss': 'Dismiss',

      // Direct English-as-key translations
      'Browse by County': 'Browse by County',
      'Find a Church Near You': 'Find a Church Near You',
      'Explore map of evangelical churches': 'Explore map of evangelical churches',
      'Sort by:': 'Sort by:',
      Population: 'Population',
      Name: 'Name',
      'Complete your site setup': 'Complete your site setup',
      'Configure now →': 'Configure now →',
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
      'common.remove': 'Eliminar',
      'common.submit': 'Enviar',
      'common.submitting': 'Enviando...',
      'common.created': 'Creado',
      'common.name': 'Nombre',

      // Home page
      'home.findChurch': 'Encuentra una Iglesia Cerca de Ti',
      'home.exploreMap': 'Explora el mapa de iglesias evangélicas',
      'home.browseByCounty': 'Navegar por Condado',
      'home.sortBy': 'Ordenar por:',
      'home.population': 'Población',
      'home.name': 'Nombre',

      // Churches
      'church.status': 'Estado',
      'church.website': 'Sitio Web',
      'church.phone': 'Teléfono',
      'church.address': 'Dirección',
      'church.gatherings': 'Reuniones',
      'church.language': 'Idioma',
      'church.affiliations': 'Afiliaciones',
      'church.notes': 'Notas',
      'church.email': 'Correo Electrónico',
      'church.gatheringAddress': 'Dirección de Reunión',
      'church.statementOfFaith': 'Declaración de Fe',
      'church.primaryLanguage': 'Idioma Principal',
      'church.publicNotes': 'Notas Públicas',
      'church.gatheringTimes': 'Horarios de Reunión',
      'church.images': 'Imágenes',
      'church.getDirections': 'Obtener Direcciones',
      'church.viewOnMap': 'Ver en el Mapa',
      'church.updateSermons': 'Actualizar Sermones',

      // Church Status
      'churchStatus.listed': 'Listada',
      'churchStatus.readyToList': 'Lista para listar',
      'churchStatus.assess': 'Evaluar',
      'churchStatus.needsData': 'Necesita datos',
      'churchStatus.unlisted': 'No listada',
      'churchStatus.heretical': 'Herética',
      'churchStatus.closed': 'Cerrada',

      // Church Form
      'churchForm.createNew': 'Crear Nueva Iglesia',
      'churchForm.edit': 'Editar Iglesia',
      'churchForm.churchName': 'Nombre de la Iglesia',
      'churchForm.urlPath': 'Ruta URL',
      'churchForm.pathValidation': 'Solo se permiten letras minúsculas, números y guiones',
      'churchForm.status': 'Estado de la Iglesia',
      'churchForm.county': 'Condado',
      'churchForm.selectCounty': 'Seleccionar condado',
      'churchForm.basicInfo': 'Información Básica',
      'churchForm.contactInfo': 'Información de Contacto',
      'churchForm.website': 'Sitio Web',
      'churchForm.phone': 'Número de Teléfono',
      'churchForm.email': 'Dirección de Correo',
      'churchForm.address': 'Dirección',
      'churchForm.gatheringInfo': 'Información de Reunión',
      'churchForm.gatheringAddress': 'Dirección de Reunión',
      'churchForm.statementOfFaith': 'URL de Declaración de Fe',
      'churchForm.primaryLanguage': 'Idioma Principal',
      'churchForm.socialMedia': 'Redes Sociales',
      'churchForm.facebook': 'Página de Facebook',
      'churchForm.instagram': 'Usuario de Instagram',
      'churchForm.youtube': 'Canal de YouTube',
      'churchForm.spotify': 'Podcast de Spotify',
      'churchForm.affiliations': 'Afiliaciones',
      'churchForm.images': 'Imágenes de la Iglesia',
      'churchForm.uploadImages': 'Subir Imágenes',
      'churchForm.publicNotes': 'Notas Públicas',
      'churchForm.privateNotes': 'Notas Privadas',
      'churchForm.gatheringTimes': 'Horarios de Reunión',
      'churchForm.addGathering': 'Agregar Reunión',
      'churchForm.save': 'Guardar Iglesia',
      'churchForm.cancel': 'Cancelar',

      // County pages
      'county.churchesIn': 'Iglesias en {{county}}',
      'county.totalChurches': '{{count}} iglesias',

      // Admin
      'admin.dashboard': 'Panel de Administración',
      'admin.completeSetup': 'Completa la configuración de tu sitio',
      'admin.configureNow': 'Configurar ahora →',
      'admin.createChurch': 'Crear Iglesia',
      'admin.manageCounties': 'Gestionar Condados',
      'admin.addNewCounty': 'Agregar Nuevo Condado',
      'admin.managePages': 'Gestionar Páginas',

      // Admin Churches
      'adminChurches.title': 'Gestionar Iglesias',
      'adminChurches.search': 'Buscar',
      'adminChurches.searchPlaceholder': 'Buscar por nombre o dirección...',
      'adminChurches.county': 'Condado',
      'adminChurches.allCounties': 'Todos los Condados',
      'adminChurches.status': 'Estado',
      'adminChurches.allStatuses': 'Todos los Estados',
      'adminChurches.affiliation': 'Afiliación',
      'adminChurches.allAffiliations': 'Todas las Afiliaciones',
      'adminChurches.clearFilters': 'Limpiar Filtros',
      'adminChurches.addChurch': 'Agregar Iglesia',
      'adminChurches.noResults': 'No se encontraron iglesias que coincidan con tus filtros',
      'adminChurches.updateSuccess': '¡Iglesia actualizada exitosamente!',

      // Authentication
      'auth.signInRequired': 'Inicio de Sesión Requerido',
      'auth.signInToContinue': 'Iniciar Sesión para Continuar',
      'auth.signInTitle': 'Iniciar Sesión - Iglesias de Utah',
      'auth.signInDescription': 'Inicia sesión para gestionar tus iglesias',
      'auth.signIn': 'Iniciar Sesión',
      'auth.signInWithGoogle': 'Iniciar sesión con Google',
      'auth.securePrivate': 'Seguro y Privado',
      'auth.securityDescription': 'Tus datos están protegidos con seguridad estándar de la industria',
      'auth.trustedByLeaders': 'Confiado por Líderes de Iglesias',
      'auth.trustedDescription': 'Únete a cientos de administradores de iglesias',
      'auth.quickSetup': 'Configuración Rápida',
      'auth.quickSetupDescription': 'Comienza en minutos',

      // Data Export
      'dataExport.title': 'Descargar Datos de Iglesias',
      'dataExport.description': 'Exportar datos de {{count}} iglesias evangélicas en varios formatos',
      'dataExport.excelFormat': 'Formato Excel',
      'dataExport.excelDescription': 'Libro de trabajo multi-hoja con iglesias, condados y afiliaciones',
      'dataExport.downloadXlsx': 'Descargar XLSX',
      'dataExport.csvFormat': 'Formato CSV',
      'dataExport.csvDescription': 'Formato compatible con hojas de cálculo con detalles de iglesias',
      'dataExport.downloadCsv': 'Descargar CSV',
      'dataExport.jsonFormat': 'Formato JSON',
      'dataExport.jsonDescription': 'Formato amigable para programadores con datos completos',
      'dataExport.downloadJson': 'Descargar JSON',
      'dataExport.yamlFormat': 'Formato YAML',
      'dataExport.yamlDescription': 'Formato legible por humanos con datos limpios',
      'dataExport.downloadYaml': 'Descargar YAML',
      'dataExport.usageInfo': 'Información de Uso',
      'dataExport.formatNotes': 'Notas de Formato',

      // Feedback
      'feedback.title': 'Enviar Comentarios',
      'feedback.submitChurchSuggestion': 'Enviar Sugerencia de Iglesia',
      'feedback.generalPlaceholder': 'Comparte tus pensamientos sobre Iglesias de Utah...',
      'feedback.churchPlaceholder': 'Proporciona información sobre esta iglesia...',
      'feedback.submit': 'Enviar Comentarios',
      'feedback.submitSuggestion': 'Enviar Sugerencia',

      // Footer
      'footer.dataExport': 'Exportar Datos',
      'footer.edit': 'Editar',
      'footer.browseCounties': 'Navegar Iglesias por Condado',
      'footer.browseNetworks': 'Navegar por Red',
      'footer.submitFeedback': 'Enviar Comentarios',
      'footer.suggestChurch': 'Sugerir una Iglesia',

      // Navbar
      'navbar.siteTitle': 'Iglesias de Utah',
      'navbar.searchAriaLabel': 'Buscar iglesias, condados y redes',
      'navbar.toggleMenu': 'Alternar menú de navegación',
      'navbar.toggleMainMenu': 'Alternar menú principal',
      'navbar.manageChurches': 'Gestionar Iglesias',
      'navbar.manageUsers': 'Gestionar Usuarios',

      // Error Messages
      'error.pageNotFound': 'Página No Encontrada',
      'error.pageNotFoundDescription': 'La página que buscas no existe',
      'error.serverError': 'Error del Servidor',
      'error.serverErrorDescription': 'Algo salió mal de nuestro lado',
      'error.databaseError': 'Error de Base de Datos',
      'error.databaseErrorDescription': 'No se puede conectar a la base de datos',
      'error.goHome': 'Ir al Inicio',
      'error.tryAgain': 'Intentar de Nuevo',
      'error.contactSupport': 'Contactar Soporte',

      // Validation
      'validation.required': 'Este campo es requerido',
      'validation.invalidEmail': 'Formato de correo inválido',
      'validation.invalidUrl': 'Formato de URL inválido',
      'validation.invalidPhone': 'Formato de número de teléfono inválido',
      'validation.passwordLength': 'La contraseña debe tener al menos 8 caracteres',
      'validation.passwordMismatch': 'Las contraseñas no coinciden',
      'validation.pathFormat': 'Solo se permiten letras minúsculas, números y guiones',

      // Toast Messages
      'toast.success': '¡Éxito!',
      'toast.error': '¡Error!',
      'toast.warning': '¡Advertencia!',
      'toast.info': 'Información',
      'toast.viewChurch': 'Ver Iglesia',
      'toast.dismiss': 'Descartar',

      // Direct English-as-key translations
      'Browse by County': 'Navegar por Condado',
      'Find a Church Near You': 'Encuentra una Iglesia Cerca de Ti',
      'Explore map of evangelical churches': 'Explora el mapa de iglesias evangélicas',
      'Sort by:': 'Ordenar por:',
      Population: 'Población',
      Name: 'Nombre',
      'Complete your site setup': 'Completa la configuración de tu sitio',
      'Configure now →': 'Configurar ahora →',
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
      // Allow using English text as keys with auto-fallback
      returnNull: false,
      returnEmptyString: false,
      keySeparator: false, // Allow periods in keys
      nsSeparator: false, // Disable namespace separator
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
