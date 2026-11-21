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
export type PiezaPesada = 'voz' | 'letras' | 'ocr-libro' | 'ocr-manga' | 'practica';
export type EstadoPieza = 'bien' | 'lento' | 'muy-lento' | 'sin-medir';

export interface EstimacionPieza {
  pieza: PiezaPesada;
  estado: EstadoPieza;
  /** Lo que tardaría, en segundos: solo si se ha medido. */
  segundos?: number;
  /** Si sale de la prueba; si no, es lo probable para esa clase de equipo. */
  medido: boolean;
}

/** Lo que tarda cada pieza en el equipo de referencia, en segundos, y hasta dónde va «bien» y hasta dónde «lento». */
export const PIEZAS: Record<PiezaPesada, { segundos: number; bien: number; lento: number }> = {
  // 30 minutos de video con Haas-ja o Parakeet. Más de 30 minutos es más lento que el propio video.
  voz: { segundos: 60, bien: 600, lento: 1800 },
  // Una canción de 4 minutos con Whisper Turbo (5 minutos por cada 30 de audio).
  letras: { segundos: 40, bien: 120, lento: 480 },
  // Una página de un libro, con el detector y el reconocedor de libros. Las siguientes se leen por adelantado mientras
  // se lee una, que lleva minutos: hasta 10 segundos casi no se nota.
  'ocr-libro': { segundos: 1, bien: 2.5, lento: 10 },
  // Una página de manga: globos y manga-ocr. También se leen por adelantado.
  'ocr-manga': { segundos: 1.6, bien: 4, lento: 20 },
  // Lo que se espera tras decir una frase, al dictar o al practicar el acento.
  practica: { segundos: 0.5, bien: 2, lento: 6 },
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
  potente: { voz: 'bien', letras: 'bien', 'ocr-libro': 'bien', 'ocr-manga': 'bien', practica: 'bien' },
  medio: { voz: 'lento', letras: 'lento', 'ocr-libro': 'bien', 'ocr-manga': 'lento', practica: 'bien' },
  basico: { voz: 'muy-lento', letras: 'muy-lento', 'ocr-libro': 'lento', 'ocr-manga': 'muy-lento', practica: 'lento' },
};

/**
 * Cuánto tardaría cada pieza aquí. Con la prueba, lo del equipo de referencia por lo que aquí tarda el OCR. Los modelos
 * de voz y el de manga pesan mucho más que el del OCR de libros, y en el procesador no van: sin la gráfica, muy lentos.
 */
export function estimar(piezas: PiezaPesada[], s: SenalesEquipo, prueba?: PruebaEquipo | null): EstimacionPieza[] {
  const nivel = nivelDe(s, prueba);
  return piezas.map((pieza) => {
    if (prueba?.correcto) {
      if (prueba.dispositivo === 'wasm' && SOLO_CON_GRAFICA.includes(pieza)) return { pieza, estado: 'muy-lento', medido: true };
      const segundos = PIEZAS[pieza].segundos * factorDe(prueba);
      return { pieza, estado: estadoPorTiempo(pieza, segundos), segundos, medido: true };
    }
    if (prueba && !prueba.correcto) return { pieza, estado: 'muy-lento', medido: true };
    return { pieza, estado: nivel === 'sin-medir' ? 'sin-medir' : PROBABLE[nivel][pieza], medido: false };
  });
}

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
