// Las voces integradas de cada lengua (las de AivisHub): aparte de los motores de lengua, porque su parte de texto pesa
// (yomi, unos 85 KB) y solo la usa el motor. La ventana y el lector, que cargan los motores de lengua, no la llevan.
// La lengua que las tenga lo dice en su paquete con `vocesIntegradas`.

import { VOZ_INTEGRADA as JAPONES } from './japones/voz';
import type { VozIntegradaLengua } from './tipos';

const VOCES: Partial<Record<string, VozIntegradaLengua>> = { ja: JAPONES };

/** La parte de texto de las voces integradas de una lengua, si las tiene. */
export const vozIntegradaDe = (lengua: string): VozIntegradaLengua | undefined => VOCES[lengua.split('-')[0]];
