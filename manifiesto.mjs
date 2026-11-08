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

/** Lo que el navegador muestra fuera de la extensión: su ficha y la página de atajos. Va en _locales, una carpeta por idioma. */
export const MENSAJES = {
  es: {
    descripcion: 'Subtítulos interactivos, diccionario, tarjetas y explicaciones con Claude para aprender japonés e inglés.',
    crearTarjeta: 'Crear tarjeta de la frase actual',
    alternarCaptura: 'Permitir captura de imagen y audio en esta sesión',
    abrirApp: 'Abrir la ventana de Kotonoha',
  },
  en: {
    descripcion: 'Interactive subtitles, a dictionary, flashcards and Claude explanations to learn Japanese and English from real video and text.',
    crearTarjeta: 'Create a card from the current sentence',
    alternarCaptura: 'Allow image and audio capture for this session',
    abrirApp: 'Open the Kotonoha window',
  },
  de: {
    descripcion: 'Interaktive Untertitel, Wörterbuch, Karten und Claude-Erklärungen, um Japanisch und Englisch mit echten Videos und Texten zu lernen.',
    crearTarjeta: 'Karte aus dem aktuellen Satz erstellen',
    alternarCaptura: 'Bild- und Audioaufnahme für diese Sitzung erlauben',
    abrirApp: 'Kotonoha-Fenster öffnen',
  },
  zh_CN: {
    descripcion: '交互式字幕、词典、卡片和 Claude 讲解，通过真实的视频和文章学日语和英语。',
    crearTarjeta: '用当前句子创建卡片',
    alternarCaptura: '允许本次会话捕获图像和音频',
    abrirApp: '打开 Kotonoha 窗口',
  },
  ko: {
    descripcion: '대화형 자막, 사전, 카드, Claude 설명으로 실제 영상과 글에서 일본어와 영어를 배워요.',
    crearTarjeta: '현재 문장으로 카드 만들기',
    alternarCaptura: '이번 세션에서 이미지와 오디오 캡처 허용',
    abrirApp: 'Kotonoha 창 열기',
  },
  ja: {
    descripcion: 'インタラクティブな字幕、辞書、カード、Claude の解説で、本物の動画や文章から日本語と英語を学べます。',
    crearTarjeta: '現在の文からカードを作成',
    alternarCaptura: 'このセッションで画像と音声のキャプチャを許可',
    abrirApp: 'Kotonoha のウィンドウを開く',
  },
};

export const manifiesto = {
  manifest_version: 3,
  name: 'Kotonoha',
  version: '0.9.3',
  default_locale: 'en',
  description: '__MSG_descripcion__',
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
      description: '__MSG_crearTarjeta__',
      suggested_key: { default: 'Alt+Q' },
    },
    'alternar-captura': {
      description: '__MSG_alternarCaptura__',
      suggested_key: { default: 'Alt+Shift+M' },
    },
    'abrir-app': {
      description: '__MSG_abrirApp__',
      suggested_key: { default: 'Alt+Shift+K' },
    },
  },
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
  },
  web_accessible_resources: [{ matches: ['<all_urls>'], resources: ['fuentes/*', 'idiomas/*'] }],
};
