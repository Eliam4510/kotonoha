// La biblioteca de diccionarios abiertos del chino: CC-CEDICT, el diccionario abierto del mandarín con el pinyin de cada
// palabra, en la versión para Yomitan que se publica cada día; las traducciones breves de Wiktionary a otros idiomas, y
// una lista de frecuencia hecha con subtítulos de películas y series.

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

const WTY = 'https://huggingface.co/datasets/daxida/wty-release/resolve/main/latest/dict';
const LICENCIA_WTY = 'CC BY-SA 4.0 (Wiktionary, kaikki.org)';

const glosas = (idioma: string, titulo: string): FuenteBiblioteca => ({
  id: `wty-zh-${idioma}-gloss`,
  titulo,
  descripcion: tm('Traducciones breves, de las tablas de Wiktionary.'),
  tipo: 'terminos',
  idioma,
  url: `${WTY}/zh/${idioma}/wty-zh-${idioma}-gloss.zip`,
  formato: 'yomitan',
  recomendado: true,
  licencia: LICENCIA_WTY,
});

const definiciones = (idioma: string, titulo: string): FuenteBiblioteca => ({
  id: `wty-zh-${idioma}`,
  titulo,
  descripcion: tm('Definiciones de Wiktionary.'),
  tipo: 'terminos',
  idioma,
  url: `${WTY}/zh/${idioma}/wty-zh-${idioma}.zip`,
  formato: 'yomitan',
  recomendado: true,
  licencia: LICENCIA_WTY,
});

// Lo del idioma de cada cual va antes: el primero que tenga la palabra da la traducción bajo ella, y si no la tiene, la
// da CC-CEDICT, que se propone a todos. En español, Wiktionary solo trae traducciones breves.
export const FUENTES: FuenteBiblioteca[] = [
  glosas('es', tm('Traducciones al español')),
  {
    id: 'cc-cedict',
    titulo: tm('CC-CEDICT (chino–inglés)'),
    descripcion: tm('El diccionario abierto del chino, con el pinyin de cada palabra y sus formas simplificada y tradicional. Define en inglés y se publica cada día. Descarga unos 8 MB.'),
    tipo: 'terminos',
    idioma: 'en',
    url: 'https://github.com/MarvNC/cc-cedict-yomitan/releases/latest/download/CC-CEDICT.zip',
    formato: 'yomitan',
    recomendado: true,
    licencia: 'CC BY-SA 4.0 (CC-CEDICT, MDBG)',
  },
  definiciones('de', tm('Chino–alemán')),
  glosas('de', tm('Traducciones al alemán')),
  definiciones('ja', tm('Chino–japonés')),
  glosas('ja', tm('Traducciones al japonés')),
  definiciones('ko', tm('Chino–coreano')),
  glosas('ko', tm('Traducciones al coreano')),
  {
    id: 'frecuencia-subtitulos-zh',
    titulo: tm('Frecuencia OpenSubtitles'),
    descripcion: tm('Posición de cada palabra según subtítulos de películas y series. También sirve para partir bien el texto en palabras.'),
    tipo: 'frecuencia',
    url: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/zh_cn/zh_cn_50k.txt',
    formato: 'lista',
    recomendado: true,
    licencia: 'CC BY-SA 4.0 (FrequencyWords)',
  },
];
