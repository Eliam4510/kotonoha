// Genera src/ui/iconos-datos.ts con los iconos de Phosphor (duotono) que el código usa de verdad.
// El content script corre en todas las páginas: solo se empaquetan los iconos necesarios.
// Para usar un icono nuevo basta con añadirlo aquí y escribir <Icono n="nombre" />.
// Se ejecuta en cada compilación; también a mano con: node herramientas/iconos.mjs

import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = join(RAIZ, 'src', 'ui', 'iconos-datos.ts');
const ASSETS = join(RAIZ, 'node_modules', '@phosphor-icons', 'core', 'assets', 'duotone');

// Nombre en el código → icono de Phosphor.
export const CATALOGO = {
  // Navegación y marca
  inicio: 'house-simple',
  buscar: 'magnifying-glass',
  diccionario: 'book-bookmark',
  lector: 'article',
  portapapeles: 'clipboard-text',
  libro: 'book-open-text',
  biblioteca: 'books',
  // El visor de la Biblioteca
  'pantalla-completa': 'arrows-out',
  'salir-pantalla': 'arrows-in',
  'una-pagina': 'file',
  'doble-pagina': 'book-open',
  continua: 'rows',
  'ajustar-ancho': 'arrows-out-line-horizontal',
  'ajustar-pagina': 'corners-out',
  acercar: 'magnifying-glass-plus',
  alejar: 'magnifying-glass-minus',
  miniaturas: 'squares-four',
  indice: 'list-numbers',
  primera: 'caret-line-left',
  ultima: 'caret-line-right',
  invertir: 'circle-half',
  sentido: 'arrows-left-right',
  'texto-vertical': 'text-columns',
  video: 'monitor-play',
  pelicula: 'film-strip',
  claqueta: 'film-slate',
  television: 'television-simple',
  tarjetas: 'cards',
  memoria: 'brain',
  palabras: 'text-aa',
  gramatica: 'tree-structure',
  ajustes: 'gear-six',
  controles: 'sliders-horizontal',
  hoja: 'leaf',
  brote: 'plant',
  arbol: 'tree',
  flor: 'flower-lotus',
  pergamino: 'scroll',
  periodico: 'newspaper',
  musica: 'music-notes',
  // Claude
  ia: 'sparkle',
  robot: 'sparkle',
  chat: 'chat-teardrop-text',
  charla: 'chats-circle',
  varita: 'magic-wand',
  // Reproductor
  reproducir: 'play',
  pausa: 'pause',
  detener: 'stop',
  anterior: 'skip-back',
  siguiente: 'skip-forward',
  atras: 'rewind',
  adelante: 'fast-forward',
  repetir: 'repeat',
  velocidad: 'gauge',
  ritmo: 'metronome',
  aleatorio: 'shuffle',
  subtitulos: 'subtitles',
  'subtitulos-no': 'subtitles-slash',
  cc: 'closed-captioning',
  ojo: 'eye',
  'ojo-no': 'eye-slash',
  panel: 'sidebar-simple',
  teclado: 'keyboard',
  traducir: 'translate',
  comando: 'command',
  // Audio e imagen
  altavoz: 'speaker-high',
  silencio: 'speaker-slash',
  microfono: 'microphone',
  voz: 'microphone-stage',
  oido: 'ear',
  ondas: 'waveform',
  musica: 'music-notes',
  camara: 'camera',
  imagen: 'image',
  // Acciones
  rayo: 'lightning',
  enviar: 'paper-plane-tilt',
  mas: 'plus',
  menos: 'minus',
  cerrar: 'x',
  ok: 'check',
  check: 'check-circle',
  copiar: 'copy',
  basura: 'trash',
  lapiz: 'pencil-simple',
  'nota-lapiz': 'note-pencil',
  // El editor del Cuaderno
  cuaderno: 'notebook',
  vinetas: 'list-bullets',
  'lista-numerada': 'list-numbers',
  negrita: 'text-b',
  sangria: 'text-indent',
  deshacer: 'arrow-counter-clockwise',
  rehacer: 'arrow-clockwise',
  compartir: 'share-network',
  nota: 'note',
  resaltar: 'highlighter',
  subrayar: 'text-underline',
  guardar: 'floppy-disk',
  subir: 'upload-simple',
  descargar: 'download-simple',
  exportar: 'export',
  recargar: 'arrow-clockwise',
  reiniciar: 'arrow-counter-clockwise',
  trazos: 'pen-nib',
  dividir: 'columns',
  sincronizar: 'arrows-clockwise',
  historial: 'clock-counter-clockwise',
  intercambiar: 'arrows-left-right',
  externo: 'arrow-square-out',
  enlace: 'link-simple',
  filtro: 'funnel-simple',
  ordenar: 'sort-ascending',
  marcador: 'bookmark-simple',
  etiqueta: 'tag',
  tijeras: 'scissors',
  escoba: 'broom',
  arrastrar: 'dots-six-vertical',
  menu: 'dots-three',
  'menu-v': 'dots-three-vertical',
  cursor: 'cursor-click',
  mano: 'hand-tap',
  apuntar: 'crosshair-simple',
  // Flechas
  flecha: 'arrow-right',
  'flecha-izq': 'arrow-left',
  'flecha-arriba': 'arrow-up',
  'flecha-abajo': 'arrow-down',
  abajo: 'caret-down',
  arriba: 'caret-up',
  izquierda: 'caret-left',
  derecha: 'caret-right',
  // Estado y aprendizaje
  huella: 'footprints',
  sello: 'seal-check',
  info: 'info',
  aviso: 'warning-circle',
  advertencia: 'warning',
  error: 'x-circle',
  pregunta: 'question',
  bombilla: 'lightbulb',
  espera: 'hourglass-medium',
  reloj: 'clock',
  calendario: 'calendar-blank',
  estrella: 'star',
  corazon: 'heart',
  fuego: 'fire',
  medalla: 'medal',
  trofeo: 'trophy',
  corona: 'crown-simple',
  bandera: 'flag',
  cohete: 'rocket-launch',
  objetivo: 'target',
  nivel: 'graduation-cap',
  grafico: 'chart-bar',
  rosca: 'chart-donut',
  tendencia: 'trend-up',
  porcentaje: 'percent',
  // Configuración y sistema
  candado: 'lock-simple',
  abierto: 'lock-simple-open',
  clave: 'key',
  conectado: 'plugs-connected',
  enchufe: 'plug',
  usuario: 'user-circle',
  mundo: 'globe-hemisphere-east',
  sol: 'sun',
  luna: 'moon',
  monitor: 'monitor',
  paleta: 'palette',
  regla: 'ruler',
  texto: 'text-t',
  archivo: 'file-text',
  'archivo-subir': 'file-arrow-up',
  carpeta: 'folder-open',
  frases: 'quotes',
  lista: 'list',
  'lista-puntos': 'list-bullets',
  cuadricula: 'squares-four',
  pila: 'stack',
  mapa: 'map-trifold',
  brujula: 'compass',
  montanas: 'mountains',
  fijar: 'push-pin',
  'fijar-no': 'push-pin-slash',
};

const SIN_CAPA = new Set(['cerrar', 'mas', 'menos', 'ok', 'abajo', 'arriba', 'izquierda', 'derecha', 'flecha', 'flecha-izq', 'flecha-arriba', 'flecha-abajo']);

function recorrer(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const r = join(dir, e.name);
    return e.isDirectory() ? recorrer(r) : [r];
  });
}

export function generarIconos() {
  const fuentes = recorrer(join(RAIZ, 'src'))
    .filter((f) => /\.(ts|tsx)$/.test(f) && f !== SALIDA)
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');
  // Cualquier cadena del código que coincida con un nombre cuenta como uso: cubre también listas de datos.
  const usados = Object.keys(CATALOGO).filter((n) => new RegExp(`['"\`]${n}['"\`]`).test(fuentes));

  const faltan = [];
  const filas = [];
  for (const n of usados) {
    const archivo = join(ASSETS, `${CATALOGO[n]}-duotone.svg`);
    if (!existsSync(archivo)) {
      faltan.push(`${n} → ${CATALOGO[n]}`);
      continue;
    }
    let svg = readFileSync(archivo, 'utf8');
    // En los signos sencillos (cerrar, más, flechas) la capa suave es solo una mancha detrás del trazo.
    if (SIN_CAPA.has(n)) svg = svg.replace(/<[a-z]+[^>]* opacity="0\.2"[^>]*\/>/g, '');
    const interior = svg
      .replace(/^<svg[^>]*>/, '')
      .replace(/<\/svg>\s*$/, '')
      // La capa suave se marca con una clase para poder teñirla desde CSS.
      .replace(/ opacity="0\.2"/g, ' class="d"');
    filas.push(`  ${JSON.stringify(n)}: ${JSON.stringify(interior)},`);
  }
  if (faltan.length) throw new Error(`Iconos que no existen en Phosphor: ${faltan.join(', ')}`);

  const contenido = `// Generado por herramientas/iconos.mjs a partir de Phosphor Icons (MIT). No editar a mano.\n\nexport const ICONOS = {\n${filas.join('\n')}\n} as const;\n\nexport type NombreIcono = keyof typeof ICONOS;\n`;
  if (!existsSync(SALIDA) || readFileSync(SALIDA, 'utf8') !== contenido) {
    // Escritura atómica: varias compilaciones pueden correr a la vez.
    const temporal = `${SALIDA}.${process.pid}.tmp`;
    writeFileSync(temporal, contenido);
    renameSync(temporal, SALIDA);
  }
  return usados.length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Iconos generados: ${generarIconos()}`);
}
