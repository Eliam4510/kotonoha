// Interpreta el informe de ffmpeg sobre un archivo de video: qué pistas de audio y subtítulos trae.

export interface PistaMedio {
  /** Posición entre las pistas de su mismo tipo: es el N de `-map 0:a:N`. */
  indice: number;
  idioma: string;
  titulo: string;
  codec: string;
  predeterminada: boolean;
  /** Subtítulos dibujados como imagen (PGS, DVD): no contienen texto que se pueda leer. */
  imagen?: boolean;
}

export interface InformeMedio {
  duracionS: number | null;
  audio: PistaMedio[];
  subtitulos: PistaMedio[];
}

const SUBTITULOS_IMAGEN = /^(hdmv_pgs_subtitle|pgssub|dvd_subtitle|dvb_subtitle|xsub)/;

const IDIOMAS: Record<string, string> = { jpn: 'ja', ja: 'ja', spa: 'es', es: 'es', eng: 'en', en: 'en', kor: 'ko', ko: 'ko', zho: 'zh', chi: 'zh', zh: 'zh', por: 'pt', fre: 'fr', fra: 'fr', ger: 'de', deu: 'de' };

export const idiomaCorto = (c: string) => IDIOMAS[c.toLowerCase()] ?? c.toLowerCase();

export function analizarInformeFfmpeg(informe: string): InformeMedio {
  const salida: InformeMedio = { duracionS: null, audio: [], subtitulos: [] };
  const lineas = informe.split(/\r?\n/);
  const duracion = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(informe);
  if (duracion) salida.duracionS = +duracion[1] * 3600 + +duracion[2] * 60 + +duracion[3];

  for (let i = 0; i < lineas.length; i++) {
    const m = /Stream #\d+:\d+(?:\[[^\]]*\])?(?:\(([^)]*)\))?(?:\[[^\]]*\])?:\s*(Audio|Subtitle):\s*([^\s,(]+)(.*)/.exec(lineas[i]);
    if (!m) continue;
    const [, idioma, tipo, codec, resto] = m;
    // El título aparece en el bloque de metadatos justo debajo de la pista.
    let titulo = '';
    for (let j = i + 1; j < lineas.length && !/Stream #/.test(lineas[j]); j++) {
      const t = /^\s+title\s*:\s*(.+)$/.exec(lineas[j]);
      if (t) {
        titulo = t[1].trim();
        break;
      }
    }
    const lista = tipo === 'Audio' ? salida.audio : salida.subtitulos;
    lista.push({
      indice: lista.length,
      idioma: idiomaCorto(idioma ?? 'und'),
      titulo,
      codec,
      predeterminada: /\(default\)/.test(resto),
      ...(tipo === 'Subtitle' && SUBTITULOS_IMAGEN.test(codec) ? { imagen: true } : {}),
    });
  }
  return salida;
}

/** Cómo extraer una pista de audio para reproducirla: sin recodificar si el navegador la entiende. */
export function formatoExtraccionAudio(codec: string): { args: string[]; extension: string; tipo: string } {
  if (codec === 'aac') return { args: ['-c:a', 'copy'], extension: 'm4a', tipo: 'audio/mp4' };
  if (codec === 'opus' || codec === 'vorbis') return { args: ['-c:a', 'copy'], extension: 'webm', tipo: 'audio/webm' };
  if (codec === 'mp3') return { args: ['-c:a', 'copy'], extension: 'mp3', tipo: 'audio/mpeg' };
  if (codec === 'flac') return { args: ['-c:a', 'copy'], extension: 'flac', tipo: 'audio/flac' };
  return { args: ['-c:a', 'aac', '-b:a', '192k'], extension: 'm4a', tipo: 'audio/mp4' };
}

/** Por debajo de esto no hay sonido (unos -70 dB): es el silencio digital de una pestaña muda o de un video parado. */
export const UMBRAL_SILENCIO = 3e-4;

/** Qué parte de una grabación tiene sonido. Null si está muda de principio a fin. */
export function tramoConSonido(canales: Float32Array[], umbral = UMBRAL_SILENCIO): { inicio: number; fin: number } | null {
  let inicio = -1;
  let fin = -1;
  for (const c of canales) {
    for (let i = 0; i < c.length; i++) {
      if (Math.abs(c[i]) > umbral) {
        if (inicio < 0 || i < inicio) inicio = i;
        break;
      }
    }
    for (let i = c.length - 1; i >= 0; i--) {
      if (Math.abs(c[i]) > umbral) {
        if (i + 1 > fin) fin = i + 1;
        break;
      }
    }
  }
  return inicio < 0 ? null : { inicio, fin };
}

/** Si una imagen RGBA es negra casi por completo: lo que entrega el navegador de un fotograma protegido con DRM. */
export function imagenNegra(rgba: Uint8ClampedArray | Uint8Array, umbral = 12, proporcion = 0.995): boolean {
  const total = Math.floor(rgba.length / 4);
  if (!total) return false;
  let negros = 0;
  for (let i = 0; i < total; i++) {
    if (rgba[i * 4] <= umbral && rgba[i * 4 + 1] <= umbral && rgba[i * 4 + 2] <= umbral) negros++;
  }
  return negros / total >= proporcion;
}
