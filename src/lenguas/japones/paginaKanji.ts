// Cómo se enseña en la página de un kanji lo que trae el diccionario de kanji: en qué lista oficial está, de qué época
// viene cada on'yomi, cómo se formó, sus lecturas fuera de la lista y las de nombres, y los títulos de sus familias.

import { tm } from '../../compartido/i18n';
import type { DiccionarioCaracteresLengua } from '../tipos';

const LISTAS: Record<string, { nombre: string; ayuda: string }> = {
  joyo: { nombre: tm('Jōyō · secundaria'), ayuda: tm('Está en la lista oficial de uso común (常用漢字); en Japón se aprende en la secundaria.') },
  jinmeiyo: { nombre: tm('Jinmeiyō'), ayuda: tm('No es de uso común, pero se admite en nombres de persona (人名用漢字).') },
  'jinmeiyo-antigua': { nombre: tm('Jinmeiyō · forma antigua'), ayuda: tm('Forma antigua de un kanji de uso común, admitida en nombres de persona.') },
  hyogai: { nombre: tm('Fuera de las listas'), ayuda: tm('No está en las listas oficiales (表外漢字): se ve en nombres y en textos antiguos o especializados.') },
  'hyogai-antigua': { nombre: tm('Forma antigua, fuera de las listas'), ayuda: tm('Forma de antes de la reforma de 1946 que ya no está en ninguna lista oficial.') },
};

export const DICCIONARIO_KANJI: DiccionarioCaracteresLengua = {
  lista: (valor) => {
    const curso = /^kyoiku-(\d)$/.exec(valor);
    if (curso) return { nombre: tm('Jōyō · {0}.º de primaria'), ayuda: tm('Está en la lista oficial de uso común (常用漢字) y en Japón se aprende en ese curso de primaria.'), dato: Number(curso[1]) };
    return LISTAS[valor];
  },
  examen: {
    nombre: tm('Kanken'),
    ayuda: tm('El nivel del examen de kanji (漢字検定) en que entra: del 10, el más fácil, al 1.'),
    nivel: (valor) => `${valor.replace('pre-', '準')}級`,
  },
  origenes: {
    呉: { nombre: tm('Go-on'), ayuda: tm('La lectura más antigua: llegó entre los siglos V y VI del sur de China. Abunda en palabras budistas y de uso diario.') },
    漢: { nombre: tm('Kan-on'), ayuda: tm('Llegó en los siglos VII y VIII con la pronunciación de la capital de los Tang. Es la más común en las palabras cultas.') },
    唐: { nombre: tm('Tō-on'), ayuda: tm('Llegó a partir del siglo X, sobre todo con el budismo zen. Se oye en pocas palabras, como 行灯 (あんどん) o 椅子 (いす).') },
    慣: { nombre: tm('Kan’yō-on'), ayuda: tm('Una lectura que se asentó por el uso aunque no siga las reglas de las demás.') },
  },
  formaciones: {
    pictograma: { nombre: tm('Pictograma'), ayuda: tm('Nace del dibujo de una cosa: 山, 木, 日.') },
    indicativo: { nombre: tm('Indicativo'), ayuda: tm('Señala con trazos una idea que no se puede dibujar: 上, 下, 本.') },
    compuesto: { nombre: tm('Compuesto de ideas'), ayuda: tm('Junta piezas por lo que significan: 休 es una persona junto a un árbol, «descansar».') },
    fonosemantico: { nombre: tm('Fonosemántico'), ayuda: tm('Una pieza da el significado y otra el sonido. Así se formaron la mayoría de los kanji.') },
  },
  otras: { nombre: tm('Otras'), ayuda: tm('Lecturas que no están en la lista oficial: se ven en nombres, en palabras antiguas o en textos especializados.') },
  nombres: { nombre: tm('En nombres'), ayuda: tm('Lecturas que solo se usan en nombres de persona (名乗り).') },
  radical: { nombre: tm('Radical'), ayuda: tm('La pieza por la que se ordena en los diccionarios de papel. Su nombre es el que se usa en clase para decir cómo se escribe.') },
  antiguas: tm('Así se escribía antes de la reforma de 1946 (旧字体). Aún se ve en nombres, en textos antiguos y en algunos rótulos.'),
  titulos: {
    contienen: tm('Kanji que lo llevan dentro'),
    contienenOtros: tm('Otros kanji que lo llevan dentro'),
    parecidos: tm('Kanji parecidos'),
    opuestos: tm('Kanji opuestos'),
    sinonimos: tm('Kanji de significado parecido'),
    homonimos: tm('Kanji que se leen igual'),
  },
  instalar: tm('Instala el diccionario de kanji para ver todas sus lecturas, también las raras y las de nombres, sus formas antiguas, su radical, su familia y los kanji que se le parecen.'),
  credito: { nombre: 'Kanjium · KANJIDIC (EDRDG)', url: 'https://github.com/mifunetoshiro/kanjium', licencia: 'CC BY-SA 4.0' },
};
