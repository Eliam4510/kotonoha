// Qué puede mover un equipo, para la bienvenida y «Tu equipo» en Ajustes. Con lo que el navegador dice de él (si hay
// WebGPU y qué gráfica es) y, si se ha probado, con lo que tardó el OCR en leer una página de muestra, se estima cuánto
// tardaría aquí cada pieza pesada de Kotonoha. Nada se apaga por esto: solo se recomienda. Las referencias se midieron
// en el equipo de quien hace Kotonoha (una Radeon RX 9060 XT); en otro, todo se escala con lo que tarde ahí el OCR.

/** Lo que el navegador dice del equipo, sin descargar ni medir nada. */
export interface SenalesEquipo {
  /** Si el navegador ofrece WebGPU con una gráfica de verdad. */
  webgpu: boolean;
  /** Si solo ofrece una gráfica de respaldo, hecha por programa: funciona, pero muy despacio. */
  respaldo: boolean;
  /** La gráfica como la nombra el navegador; vacío si no hay. */
  gpu: { fabricante: string; arquitectura: string; descripcion: string };
  nucleos: number;
  /** En GB, como lo dice el navegador: redondeado y con un tope de 8. */
  memoria: number | null;
  /** Lo que la extensión aún puede guardar, en bytes. */
  libre: number | null;
}

/** Lo medido con «Probar mi equipo»: el OCR leyendo una página de muestra, ya cargado. */
export interface PruebaEquipo {
  /** Milisegundos por página de muestra, con el modelo ya cargado (lo mejor de dos lecturas). */
  ocrMs: number;
  /** Si leyó bien la página: una gráfica que devuelve basura también cuenta como un problema. */
  correcto: boolean;
  dispositivo: 'webgpu' | 'wasm';
  fecha: number;
}

export type NivelEquipo = 'potente' | 'medio' | 'basico' | 'sin-medir';
export type PiezaPesada = 'voz' | 'letras' | 'ocr-libro' | 'ocr-manga' | 'practica' | 'habla';
export type EstadoPieza = 'bien' | 'lento' | 'muy-lento' | 'sin-medir';

export interface EstimacionPieza {
  pieza: PiezaPesada;
  estado: EstadoPieza;
  /** Lo que tardaría, en segundos: solo si se ha medido. */
  segundos?: number;
  /** Si sale de la prueba; si no, es lo probable para esa clase de equipo. */
  medido: boolean;
  /** Si sale de lo medido al usar Kotonoha, que vale más que la prueba: es este equipo haciendo eso mismo. */
  deUso?: boolean;
}

/**
 * Lo medido al usar Kotonoha, sin la prueba: la voz, por modelo, al transcribir un archivo o un video con el ayudante, y
 * el OCR, por modo, al leer páginas en el visor. Se queda en este equipo, como todo lo demás.
 */
export interface UsoEquipo {
  voz?: Partial<Record<string, MedidaVoz>>;
  ocr?: Partial<Record<'libro' | 'manga', MedidaOcr>>;
  /** Las voces de AivisHub al leer una frase, sin contar la primera tras cargarlas. */
  habla?: MedidaVoz;
}

export interface MedidaVoz {
  /** Segundos de audio por segundo de cálculo, sin contar los descansos entre trozos. */
  velocidad: number;
  dispositivo: string;
  fecha: number;
}

export interface MedidaOcr {
  /** Lo que tardaron las últimas páginas, en milisegundos: como mucho, `MUESTRAS_OCR`. */
  ms: number[];
  dispositivo: string;
  fecha: number;
}

/** Lo que tarda cada pieza en el equipo de referencia, en segundos, y hasta dónde va «bien» y hasta dónde «lento». */
export const PIEZAS: Record<PiezaPesada, { segundos: number; bien: number; lento: number; audioS?: number }> = {
  // 30 minutos de video con Haas-ja o Parakeet. Más de 30 minutos es más lento que el propio video.
  voz: { segundos: 60, bien: 600, lento: 1800, audioS: 1800 },
  // Una canción de 4 minutos con Whisper Turbo (5 minutos por cada 30 de audio).
  letras: { segundos: 40, bien: 120, lento: 480, audioS: 240 },
  // Una página de un libro, con el detector y el reconocedor de libros. Las siguientes se leen por adelantado mientras
  // se lee una, que lleva minutos: hasta 10 segundos casi no se nota.
  'ocr-libro': { segundos: 1, bien: 2.5, lento: 10 },
  // Una página de manga: globos y manga-ocr. También se leen por adelantado.
  'ocr-manga': { segundos: 1.6, bien: 4, lento: 20 },
  // Lo que se espera tras decir una frase, al dictar o al practicar el acento.
  practica: { segundos: 0.5, bien: 2, lento: 6 },
  // Una frase de 3 s con una voz de AivisHub: el BERT en el procesador y la voz en la gráfica (sin gráfica, unos 5,5 s).
  habla: { segundos: 0.6, bien: 2, lento: 6, audioS: 3 },
};

/**
 * Lo que tarda la página de muestra de la prueba en el equipo de referencia, en milisegundos: 278 ms con la Radeon RX
 * 9060 XT, medido el 2026-11-20 (con solo el procesador, un Ryzen 5 7600, 1843 ms).
 */
export const REFERENCIA_MUESTRA_MS = 280;

/** Lo que en el procesador no va: sus modelos pesan mucho más que el del OCR de libros, con el que se mide. */
const SOLO_CON_GRAFICA: PiezaPesada[] = ['voz', 'letras', 'ocr-manga', 'practica'];

/** Lo que pesan los modelos del OCR: los de libros y, para manga, el detector de globos y manga-ocr. */
export const OCR_LIBRO_MB = 25;
export const OCR_MANGA_MB = 178;

/** Una gráfica dedicada, por su nombre, cuando el navegador lo da (sin los «(TM)» y «(R)» de las marcas). */
const DEDICADA = /\b(RTX|GTX|Quadro|Radeon\s*(RX|Pro)|RX\s?\d{3,4}|Arc\s*[AB]\d{3})/i;
const sinMarcas = (t: string) => t.replace(/\((TM|R)\)/gi, ' ');

/** Cuántas veces más lento que el equipo de referencia, según la prueba. */
export const factorDe = (p: PruebaEquipo) => Math.max(0.25, p.ocrMs / REFERENCIA_MUESTRA_MS);

/**
 * La clase de equipo. Con la prueba, por lo que tardó el OCR; sin ella, solo lo seguro: sin WebGPU es básico, y una
 * gráfica de NVIDIA o una dedicada que se nombra es potente. Una AMD o una Intel puede ser integrada o dedicada, y el
 * navegador no siempre lo dice: entonces queda sin medir.
 */
export function nivelDe(s: SenalesEquipo, prueba?: PruebaEquipo | null): NivelEquipo {
  if (prueba) {
    if (!prueba.correcto || prueba.dispositivo === 'wasm') return 'basico';
    const f = factorDe(prueba);
    return f <= 2.5 ? 'potente' : f <= 8 ? 'medio' : 'basico';
  }
  if (!s.webgpu || s.respaldo) return 'basico';
  if (s.gpu.fabricante.toLowerCase() === 'nvidia' || DEDICADA.test(sinMarcas(s.gpu.descripcion))) return 'potente';
  return 'sin-medir';
}

const estadoPorTiempo = (p: PiezaPesada, segundos: number): EstadoPieza => (segundos <= PIEZAS[p].bien ? 'bien' : segundos <= PIEZAS[p].lento ? 'lento' : 'muy-lento');

/** Sin prueba, lo probable en cada clase de equipo. */
const PROBABLE: Record<Exclude<NivelEquipo, 'sin-medir'>, Record<PiezaPesada, EstadoPieza>> = {
  potente: { voz: 'bien', letras: 'bien', 'ocr-libro': 'bien', 'ocr-manga': 'bien', practica: 'bien', habla: 'bien' },
  medio: { voz: 'lento', letras: 'lento', 'ocr-libro': 'bien', 'ocr-manga': 'lento', practica: 'bien', habla: 'bien' },
  basico: { voz: 'muy-lento', letras: 'muy-lento', 'ocr-libro': 'lento', 'ocr-manga': 'muy-lento', practica: 'lento', habla: 'lento' },
};

/** Lo medido al usarlo y los modelos con los que se compara: el de la voz de la lengua y el de las canciones. */
export interface OpcionesUso {
  uso?: UsoEquipo | null;
  modeloVoz?: string;
  modeloLetras?: string;
}

/** La parte del tiempo que Whisper trabaja en automático cuando nadie usa el equipo: lo demás son descansos. */
const OCUPACION_REFERENCIA = 0.9;
/** Con menos páginas leídas, una sola lenta (la primera de un libro, con todo por cargar) pesaría demasiado. */
export const MINIMO_PAGINAS = 3;
export const MUESTRAS_OCR = 20;

export function mediana(xs: number[]): number {
  if (!xs.length) return 0;
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

/** Suma una página leída a lo medido. Si cambió dónde se lee, la gráfica o el procesador, lo de antes ya no vale. */
export function anotarOcr(previa: MedidaOcr | undefined, ms: number, dispositivo: string, fecha: number): MedidaOcr {
  const antes = previa && previa.dispositivo === dispositivo ? previa.ms : [];
  return { ms: [...antes, Math.round(ms)].slice(-MUESTRAS_OCR), dispositivo, fecha };
}

/** Lo que tarda una página aquí, en milisegundos, según lo medido al leer; null si aún no hay bastante. */
export const msPorPagina = (m: MedidaOcr | undefined): number | null => (m && m.ms.length >= MINIMO_PAGINAS ? mediana(m.ms) : null);

/** Lo que tardaría una pieza según lo medido al usarla, en segundos; undefined si no se ha medido. */
function segundosDeUso(pieza: PiezaPesada, o: OpcionesUso): number | undefined {
  if (!o.uso) return;
  if (pieza === 'voz' || pieza === 'letras') {
    const m = o.uso.voz?.[(pieza === 'voz' ? o.modeloVoz : o.modeloLetras) ?? ''];
    return m && m.velocidad > 0 ? (PIEZAS[pieza].audioS ?? 0) / m.velocidad / OCUPACION_REFERENCIA : undefined;
  }
  if (pieza === 'ocr-libro' || pieza === 'ocr-manga') {
    const ms = msPorPagina(o.uso.ocr?.[pieza === 'ocr-libro' ? 'libro' : 'manga']);
    return ms === null ? undefined : ms / 1000;
  }
  if (pieza === 'habla') {
    const m = o.uso.habla;
    return m && m.velocidad > 0 ? (PIEZAS.habla.audioS ?? 0) / m.velocidad : undefined;
  }
}

/**
 * Suma una frase leída con una voz de AivisHub a lo medido: segundos de habla por segundo de cálculo, suavizado para
 * que una frase rara no lo mueva de golpe. Si cambió dónde corre la voz (la gráfica o el procesador), empieza de nuevo.
 */
export function anotarHabla(previa: MedidaVoz | undefined, audioS: number, ms: number, dispositivo: string, fecha: number): MedidaVoz {
  const velocidad = audioS / Math.max(ms / 1000, 0.001);
  const media = previa && previa.dispositivo === dispositivo ? previa.velocidad * 0.7 + velocidad * 0.3 : velocidad;
  return { velocidad: Math.round(media * 100) / 100, dispositivo, fecha };
}

/**
 * Cuánto tardaría cada pieza aquí. Lo medido al usarla manda; si no, con la prueba, lo del equipo de referencia por lo
 * que aquí tarda el OCR. Los modelos de voz y el de manga pesan mucho más que el del OCR de libros, y en el procesador no
 * van: sin la gráfica, muy lentos.
 */
export function estimar(piezas: PiezaPesada[], s: SenalesEquipo, prueba?: PruebaEquipo | null, o: OpcionesUso = {}): EstimacionPieza[] {
  const nivel = nivelDe(s, prueba);
  return piezas.map((pieza) => {
    const deUso = segundosDeUso(pieza, o);
    if (deUso !== undefined) return { pieza, estado: estadoPorTiempo(pieza, deUso), segundos: deUso, medido: true, deUso: true };
    if (prueba?.correcto) {
      if (prueba.dispositivo === 'wasm' && SOLO_CON_GRAFICA.includes(pieza)) return { pieza, estado: 'muy-lento', medido: true };
      const segundos = PIEZAS[pieza].segundos * factorDe(prueba);
      return { pieza, estado: estadoPorTiempo(pieza, segundos), segundos, medido: true };
    }
    if (prueba && !prueba.correcto) return { pieza, estado: 'muy-lento', medido: true };
    return { pieza, estado: nivel === 'sin-medir' ? 'sin-medir' : PROBABLE[nivel][pieza], medido: false };
  });
}

/**
 * Cuántas páginas lee el OCR por delante de las que se ven: las de siempre mientras quepan en unos segundos de trabajo.
 * En un equipo en el que una página tarda mucho, menos: no se tiene la gráfica ocupada con páginas que quizá no se lean,
 * y la que se pide al pasar de página no espera detrás de ellas.
 */
const TRABAJO_POR_DELANTE_MS = 16000;
export function paginasPorDelante(porOmision: number, msPagina: number | null): number {
  if (!msPagina) return porOmision;
  return Math.max(1, Math.min(porOmision, Math.round(TRABAJO_POR_DELANTE_MS / msPagina)));
}

/** Si leer una página con el OCR va lento aquí: entonces se propone «Leer una zona». */
export const ocrLento = (modo: 'libro' | 'manga', msPagina: number) => estadoPorTiempo(modo === 'libro' ? 'ocr-libro' : 'ocr-manga', msPagina / 1000) !== 'bien';

/** Si no cabe un modelo de voz (1,3 GB y algo de margen): conviene liberar espacio antes. */
export const pocoEspacio = (s: SenalesEquipo) => s.libre !== null && s.libre < 2 * 1024 ** 3;

const FABRICANTES: Record<string, string> = { amd: 'AMD', nvidia: 'NVIDIA', intel: 'Intel', apple: 'Apple', qualcomm: 'Qualcomm', arm: 'Arm', microsoft: 'Microsoft' };
const SIGLAS: Record<string, string> = { rdna: 'RDNA', cdna: 'CDNA', gcn: 'GCN', xe: 'Xe', gen: 'Gen', lpg: 'LPG', hpg: 'HPG', hpc: 'HPC' };
const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * La gráfica, para enseñarla: la descripción, si el navegador la da (Chrome suele no darla), o el fabricante y la
 * arquitectura, que WebGPU da en minúsculas y con guiones: «amd» y «rdna-4» se leen «AMD RDNA 4».
 */
export function nombreDeGpu(g: SenalesEquipo['gpu']): string {
  if (g.descripcion.trim()) return g.descripcion.trim();
  const fabricante = FABRICANTES[g.fabricante.toLowerCase()] ?? capital(g.fabricante);
  const arquitectura = g.arquitectura
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((t) => SIGLAS[t.toLowerCase()] ?? (/\d/.test(t) ? t.toUpperCase() : capital(t)))
    .join(' ');
  return [fabricante, arquitectura].filter(Boolean).join(' ');
}

/** Si la página de muestra se leyó bien: lo leído se parece a lo escrito, sin contar espacios ni mayúsculas. */
export function lecturaCorrecta(leido: string, esperado: string): boolean {
  const limpio = (t: string) => t.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
  const a = [...limpio(leido)];
  const b = [...limpio(esperado)];
  if (!b.length) return false;
  // Distancia de edición, fila a fila: con menos de un 15 % de error, la gráfica calcula bien.
  let fila = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const nueva = [i];
    for (let j = 1; j <= b.length; j++) nueva[j] = Math.min(fila[j] + 1, nueva[j - 1] + 1, fila[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    fila = nueva;
  }
  return fila[b.length] / b.length < 0.15;
}
