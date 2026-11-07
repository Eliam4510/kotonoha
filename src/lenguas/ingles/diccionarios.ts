// La biblioteca de diccionarios abiertos del inglés: los de Wiktionary preparados por el proyecto wiktionary-to-yomitan,
// y una lista de frecuencia hecha con subtítulos de películas y series.

import { tm } from '../../compartido/i18n';
import type { FuenteBiblioteca } from '../../compartido/tipos';

/** En los diccionarios de Wiktionary, la etimología, los enlaces y las palabras relacionadas no son la definición. */
export const SECCIONES_OMITIDAS: ReadonlySet<string> = new Set([
  'preamble',
  'backlink',
  'tags',
  'related-words',
  'sense-label',
  'details-entry-examples',
  'details-entry-Etymology',
  'summary-entry',
  'extra-info',
  'synonyms',
  'antonyms',
]);

const BASE = 'https://huggingface.co/datasets/daxida/wty-release/resolve/main/latest/dict';
const LICENCIA = 'CC BY-SA 4.0 (Wiktionary, kaikki.org)';

// Las tablas de traducción de Wiktionary llaman al chino por su variedad: el archivo con todas ellas es el de mandarín.
const traducciones = (idioma: string, titulo: string, codigo = idioma): FuenteBiblioteca => ({
  id: `wty-en-${idioma}-gloss`,
  titulo,
  descripcion: tm('Traducciones breves, de las tablas de Wiktionary. Incluye verbos con partícula.'),
  tipo: 'terminos',
  idioma,
  url: `${BASE}/en/${codigo}/wty-en-${codigo}-gloss.zip`,
  formato: 'yomitan',
  recomendado: true,
  licencia: LICENCIA,
});

const definiciones = (idioma: string, titulo: string): FuenteBiblioteca => ({
  id: `wty-en-${idioma}`,
  titulo,
  descripcion: tm('Definiciones de Wiktionary.'),
  tipo: 'terminos',
  idioma,
  url: `${BASE}/en/${idioma}/wty-en-${idioma}.zip`,
  formato: 'yomitan',
  recomendado: true,
  licencia: LICENCIA,
});

// Las definiciones van antes: el primero que tenga la palabra da la traducción bajo ella, y sus primeros sentidos suelen
// ser los más comunes. Las tablas de traducción cubren lo que les falta, sobre todo los verbos con partícula.
export const FUENTES: FuenteBiblioteca[] = [
  definiciones('es', tm('Inglés–español')),
  traducciones('es', tm('Traducciones al español')),
  definiciones('de', tm('Inglés–alemán')),
  traducciones('de', tm('Traducciones al alemán')),
  definiciones('zh', tm('Inglés–chino')),
  traducciones('zh', tm('Traducciones al chino'), 'cmn'),
  definiciones('ko', tm('Inglés–coreano')),
  traducciones('ko', tm('Traducciones al coreano')),
  definiciones('ja', tm('Inglés–japonés')),
  traducciones('ja', tm('Traducciones al japonés')),
  // Solo se instala por sí solo a quien tiene la interfaz en inglés: para los demás sería un respaldo demasiado grande.
  {
    ...definiciones('en', tm('Inglés–inglés')),
    descripcion: tm('Definiciones en inglés, de Wiktionary. Es el más grande: descarga unos 110 MB y ocupa unos 220 MB.'),
    recomendado: false,
  },
  {
    id: 'wty-en-ipa',
    titulo: tm('Pronunciación (IPA)'),
    descripcion: tm('Cómo se pronuncia cada palabra en inglés americano y británico, de Wiktionary.'),
    tipo: 'acento',
    url: `${BASE}/all/en/wty-en-ipa.zip`,
    formato: 'yomitan',
    recomendado: true,
    licencia: LICENCIA,
  },
  {
    id: 'frecuencia-subtitulos',
    titulo: tm('Frecuencia OpenSubtitles'),
    descripcion: tm('Posición de cada palabra según subtítulos de películas y series.'),
    tipo: 'frecuencia',
    url: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt',
    formato: 'lista',
    recomendado: true,
    licencia: 'CC BY-SA 4.0 (FrequencyWords)',
  },
];
