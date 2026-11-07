// La biblioteca de diccionarios abiertos del alemán: los de Wiktionary preparados por el proyecto wiktionary-to-yomitan,
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
  'details-entry-Grammar',
  'summary-entry',
  'extra-info',
  'synonyms',
  'antonyms',
]);

const BASE = 'https://huggingface.co/datasets/daxida/wty-release/resolve/main/latest/dict';
const LICENCIA = 'CC BY-SA 4.0 (Wiktionary, kaikki.org)';

const traducciones = (idioma: string, titulo: string, codigo = idioma): FuenteBiblioteca => ({
  id: `wty-de-${idioma}-gloss`,
  titulo,
  descripcion: tm('Traducciones breves, de las tablas de Wiktionary.'),
  tipo: 'terminos',
  idioma,
  url: `${BASE}/de/${codigo}/wty-de-${codigo}-gloss.zip`,
  formato: 'yomitan',
  recomendado: true,
  licencia: LICENCIA,
});

const definiciones = (idioma: string, titulo: string): FuenteBiblioteca => ({
  id: `wty-de-${idioma}`,
  titulo,
  descripcion: tm('Definiciones de Wiktionary.'),
  tipo: 'terminos',
  idioma,
  url: `${BASE}/de/${idioma}/wty-de-${idioma}.zip`,
  formato: 'yomitan',
  recomendado: true,
  licencia: LICENCIA,
});

// Las definiciones van antes: el primero que tenga la palabra da la traducción bajo ella. El de definiciones en inglés
// se propone a todos, porque es el que sabe de qué palabra sale cada forma: ging de gehen, Häuser de Haus.
export const FUENTES: FuenteBiblioteca[] = [
  definiciones('es', tm('Alemán–español')),
  traducciones('es', tm('Traducciones al español')),
  {
    ...definiciones('en', tm('Alemán–inglés')),
    descripcion: tm('Definiciones en inglés, de Wiktionary, y las formas conjugadas y declinadas de cada palabra: con ellas se sabe que «ging» es de «gehen». Descarga unos 17 MB.'),
  },
  // Con las definiciones en inglés ya instaladas sobra para quien no habla inglés: solo se propone a quien sí.
  { ...traducciones('en', tm('Traducciones al inglés')), recomendado: false },
  definiciones('zh', tm('Alemán–chino')),
  traducciones('zh', tm('Traducciones al chino')),
  definiciones('ko', tm('Alemán–coreano')),
  traducciones('ko', tm('Traducciones al coreano')),
  definiciones('ja', tm('Alemán–japonés')),
  traducciones('ja', tm('Traducciones al japonés')),
  // Solo se instala por sí solo a quien tiene la interfaz en alemán: para los demás sería un respaldo demasiado grande.
  {
    ...definiciones('de', tm('Alemán–alemán')),
    descripcion: tm('Definiciones en alemán, de Wiktionary. Es el más grande: descarga unos 55 MB.'),
  },
  {
    id: 'wty-de-ipa',
    titulo: tm('Pronunciación (IPA)'),
    descripcion: tm('Cómo se pronuncia cada palabra en alemán, de Wiktionary.'),
    tipo: 'acento',
    url: `${BASE}/all/de/wty-de-ipa.zip`,
    formato: 'yomitan',
    recomendado: true,
    licencia: LICENCIA,
  },
  {
    id: 'frecuencia-subtitulos-de',
    titulo: tm('Frecuencia OpenSubtitles'),
    descripcion: tm('Posición de cada palabra según subtítulos de películas y series.'),
    tipo: 'frecuencia',
    url: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/de/de_50k.txt',
    formato: 'lista',
    recomendado: true,
    licencia: 'CC BY-SA 4.0 (FrequencyWords)',
  },
];
