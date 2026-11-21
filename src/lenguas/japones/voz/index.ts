// La voz neuronal del japonés, en la parte que corre en el motor: el diccionario de yomi, que se baja al instalar las
// voces, y el paso de un texto a lo que lee la voz (entrada.ts).

import type { VozIntegradaLengua } from '../../tipos';
import { analizarVoz, entradaVoz } from './entrada';
import { JtdDictionary } from './yomi/dict/dictionary';

let diccionario: JtdDictionary | null = null;

export const VOZ_INTEGRADA: VozIntegradaLengua = {
  // naist-jdic (BSD-3) en el formato de yomi, fijado a una revisión de su repositorio.
  diccionario: {
    url: 'https://huggingface.co/datasets/hdae/yomi-dict/resolve/ab847217c833593c3aec9875b9bfa6ff9789dc29/naist-jdic.jtd.gz',
    sha256: '3471c891d60edefa5d9402e68091ba58373d6ddbf61682c71bd680f7566d98ba',
    bytes: 6701992,
  },
  // Sube con cada cambio de reglas o de normalización: las frases ya guardadas se vuelven a leer.
  version: 1,
  cargar(datos) {
    diccionario = JtdDictionary.load(datos.slice().buffer as ArrayBuffer);
  },
  listo: () => diccionario !== null,
  analizar(texto) {
    if (!diccionario) throw new Error('El diccionario de la voz no está cargado');
    return analizarVoz(diccionario, texto);
  },
  entrada: entradaVoz,
};
