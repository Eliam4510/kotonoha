// La biblioteca de diccionarios abiertos del japonés.

import { tm } from '../../compartido/i18n';
import type { FuenteBiblioteca } from '../../compartido/tipos';
import type { DatosDiccionarios } from '../tipos';

export const FUENTES: FuenteBiblioteca[] = [
  {
    id: 'jmdict-es',
    titulo: tm('JMdict en español'),
    descripcion: tm('Definiciones en español del proyecto JMdict (EDRDG). Cobertura parcial.'),
    tipo: 'terminos',
    idioma: 'es',
    url: 'https://github.com/yomidevs/jmdict-yomitan/releases/latest/download/JMdict_spanish.zip',
    formato: 'yomitan',
    recomendado: true,
    licencia: 'CC BY-SA 4.0 (EDRDG)',
  },
  {
    id: 'jmdict-en',
    titulo: tm('JMdict en inglés'),
    descripcion: tm('El diccionario abierto más completo de japonés.'),
    tipo: 'terminos',
    idioma: 'en',
    url: 'https://github.com/yomidevs/jmdict-yomitan/releases/latest/download/JMdict_english.zip',
    formato: 'yomitan',
    recomendado: true,
    licencia: 'CC BY-SA 4.0 (EDRDG)',
  },
  {
    id: 'jmdict-de',
    titulo: tm('JMdict en alemán'),
    descripcion: tm('Definiciones en alemán del proyecto JMdict (EDRDG). Cobertura parcial.'),
    tipo: 'terminos',
    idioma: 'de',
    url: 'https://github.com/yomidevs/jmdict-yomitan/releases/latest/download/JMdict_german.zip',
    formato: 'yomitan',
    recomendado: false,
    licencia: 'CC BY-SA 4.0 (EDRDG)',
  },
  {
    id: 'kanjium-acento',
    titulo: tm('Acento tonal (Kanjium)'),
    descripcion: tm('Patrones de acento para colorear palabras y dibujar su curva tonal.'),
    tipo: 'acento',
    url: 'https://raw.githubusercontent.com/mifunetoshiro/kanjium/master/data/source_files/raw/accents.txt',
    formato: 'kanjium',
    recomendado: true,
    licencia: 'CC BY-SA 4.0',
  },
  {
    id: 'jpdb-frecuencia',
    titulo: tm('Frecuencia JPDB'),
    descripcion: tm('Posición de cada palabra según anime, series, novelas y juegos.'),
    tipo: 'frecuencia',
    url: 'https://github.com/Kuuuube/yomitan-dictionaries/raw/main/dictionaries/JPDB_v2.2_Frequency_Kana_2024-10-13.zip',
    formato: 'yomitan',
    recomendado: true,
    licencia: 'Uso libre (Kuuuube/yomitan-dictionaries)',
  },
  {
    id: 'jmnedict',
    titulo: tm('Nombres propios (JMnedict)'),
    descripcion: tm('Nombres de personas y lugares con sus lecturas.'),
    tipo: 'terminos',
    idioma: 'en',
    url: 'https://github.com/yomidevs/jmdict-yomitan/releases/latest/download/JMnedict.zip',
    formato: 'yomitan',
    recomendado: false,
    licencia: 'CC BY-SA 4.0 (EDRDG)',
  },
];

/**
 * Las primeras versiones guardaban a veces el rango de la forma en kana, mucho peor que el real:
 * 食べる salía con 13390 en vez de 184, y eso falseaba comprensión y frases recomendadas.
 */
export async function diccionariosPorReparar(datos: DatosDiccionarios): Promise<string[]> {
  if (!(await datos.diccionarios.get('jpdb-frecuencia'))) return [];
  const muestra = await datos.frecuencias.get(['jpdb-frecuencia', '食べる', 'たべる']);
  // Si falta, es que una reparación anterior se cortó a medias: hay que terminarla.
  return muestra && muestra.rango < 5000 ? [] : ['jpdb-frecuencia'];
}
