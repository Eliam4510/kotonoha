// El analizador con su modelo, empaquetado aparte: pesa varios megas y solo hace falta si se estudia inglés.

import winkNLP from 'wink-nlp';
import modelo from 'wink-eng-lite-web-model';

globalThis.kkWink = winkNLP(modelo) as unknown as typeof globalThis.kkWink;
