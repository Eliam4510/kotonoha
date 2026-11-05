// Manifiesto MV3 de la extensión. Se genera en código para poder comentar cada permiso.

// Sitios donde el adaptador corre desde el arranque de la página, antes que el reproductor.
export const SITIOS_VIDEO = [
  '*://*.youtube.com/*',
  '*://*.netflix.com/*',
  '*://*.disneyplus.com/*',
  '*://*.viki.com/*',
  '*://*.iq.com/*',
  '*://*.bilibili.com/*',
  '*://*.crunchyroll.com/*',
  '*://*.primevideo.com/*',
];

export const manifiesto = {
  manifest_version: 3,
  name: 'Kotonoha',
  version: '0.2.4',
  description: 'Subtítulos interactivos, diccionario, tarjetas y explicaciones con Claude para aprender japonés.',
  minimum_chrome_version: '120',
  icons: { 16: 'icono16.png', 32: 'icono32.png', 48: 'icono48.png', 128: 'icono128.png' },
  action: { default_popup: 'popup.html', default_title: 'Kotonoha' },
  background: { service_worker: 'fondo.js' },
  permissions: [
    'storage',
    'offscreen', // Motor: tokenizador, base de datos, Claude y grabación
    'tabCapture', // Audio de la frase para las tarjetas
    'activeTab', // Requisito de tabCapture: se concede con el icono o un comando
    'scripting',
    'tabs',
    'contextMenus',
    'idle', // Saber si estás usando el equipo: Whisper va más suave mientras lo usas
    'alarms', // Copia de desarrollo: comprobar si hay una compilación nueva y recargarse
    'nativeMessaging', // Ayudante local: descarga el audio de un video con yt-dlp para transcribirlo
    'clipboardRead',
    'clipboardWrite',
    'unlimitedStorage', // Los diccionarios ocupan cientos de MB en IndexedDB
  ],
  host_permissions: ['<all_urls>'], // captureVisibleTab, descargas de diccionarios, Anki en 127.0.0.1 y API de Claude
  content_scripts: [
    {
      matches: SITIOS_VIDEO,
      js: ['pagina.js'],
      run_at: 'document_start',
      world: 'MAIN',
      all_frames: false,
    },
    {
      matches: ['<all_urls>'],
      js: ['contenido.js'],
      run_at: 'document_idle',
      all_frames: false,
    },
  ],
  commands: {
    _execute_action: {},
    'crear-tarjeta': {
      description: 'Crear tarjeta de la frase actual',
      suggested_key: { default: 'Alt+Q' },
    },
    'alternar-captura': {
      description: 'Permitir captura de imagen y audio en esta sesión',
      suggested_key: { default: 'Alt+R' },
    },
    'abrir-app': {
      description: 'Abrir la ventana de Kotonoha',
      suggested_key: { default: 'Alt+Shift+W' },
    },
  },
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
  },
  web_accessible_resources: [{ matches: ['<all_urls>'], resources: ['fuentes/*'] }],
};
