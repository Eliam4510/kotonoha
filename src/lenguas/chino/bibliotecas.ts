// pinyin-pro y las tablas de OpenCC, empaquetados aparte (chino.js): pesan cientos de kilobytes y solo hacen falta si se
// estudia chino. Las demás lenguas no los cargan nunca. Lo deja todo en globalThis.kkChino, como wink.ts con el inglés.

import { OutputFormat, pinyin, segment } from 'pinyin-pro';
import { Converter } from 'opencc-js/t2cn';
import { fijarBibliotecas } from './analizador';

fijarBibliotecas({
  // La sílaba de cada carácter, leída en su frase, con el tono de diccionario: el sandhi de 一 y 不 se enseña aparte.
  pinyin: (texto) => pinyin(texto, { type: 'array', toneSandhi: false }),
  pinyinDeCaracter: (caracter) => pinyin(caracter, { toneSandhi: false }),
  segmentar: (texto) => segment(texto, { format: OutputFormat.ZhSegment }),
  // De tradicionales a simplificados, carácter a carácter (las variantes de Taiwán incluidas), sin cambiar palabras: 計程車
  // queda 计程车 y no se vuelve 出租车, que sería otra palabra.
  simplificar: Converter({ from: 'tw', to: 'cn' }),
});
