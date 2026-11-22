// Cómo se enseña en la página de un hanzi lo que trae su diccionario (Make Me a Hanzi): cómo se formó, su radical con el
// nombre que tiene en clase, sus piezas, la que le da el sonido y los títulos de sus familias. No trae listas oficiales,
// épocas de las lecturas, lecturas de nombres ni formas antiguas: la página no habla de eso.

import { tm } from '../../compartido/i18n';
import type { DiccionarioCaracteresLengua } from '../tipos';

export const DICCIONARIO_HANZI: DiccionarioCaracteresLengua = {
  formaciones: {
    pictograma: { nombre: tm('Pictograma'), ayuda: tm('Nace del dibujo de una cosa: 山, 木, 日.') },
    compuesto: { nombre: tm('Compuesto de ideas'), ayuda: tm('Junta piezas por lo que significan: 休 es una persona junto a un árbol, «descansar».') },
    fonosemantico: {
      nombre: tm('Fonosemántico'),
      ayuda: tm('Una pieza da el significado y otra el sonido: 妈 es 女, «mujer», con el sonido de 马 (mǎ). Así se formó la mayoría de los hanzi.'),
    },
  },
  radical: {
    nombre: tm('Radical'),
    ayuda: tm('La pieza por la que se ordena en los diccionarios (部首). Su nombre (偏旁) es el que se usa en clase para decir cómo se escribe.'),
  },
  titulos: {
    contienen: tm('Hanzi que lo llevan dentro'),
    contienenOtros: tm('Otros hanzi que lo llevan dentro'),
    parecidos: tm('Hanzi parecidos'),
    opuestos: tm('Hanzi opuestos'),
    sinonimos: tm('Hanzi de significado parecido'),
    homonimos: tm('Hanzi que se leen igual'),
  },
  homonimos: {
    mismo: { nombre: tm('Mismo tono'), ayuda: tm('Suenan igual: solo se distinguen por cómo se escriben.') },
    otro: { nombre: tm('Otro tono'), ayuda: tm('Se distinguen al oído por el tono.') },
  },
  instalar: tm('Instala el diccionario de hanzi para ver su radical, sus piezas, cómo se formó, la pieza que le da el sonido, su forma tradicional y los hanzi que se leen igual.'),
  credito: { nombre: 'Make Me a Hanzi', url: 'https://github.com/skishore/makemeahanzi', licencia: 'LGPL-3.0' },
};
