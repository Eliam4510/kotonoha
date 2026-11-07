// Cómo se escribe el furigana. Una señal: la ficha se usa en sitios muy distintos y no todos le pasan los ajustes.

import { signal } from '@preact/signals';
import type { FormatoLectura } from '../nucleo/tokens';

export const formatoLectura = signal<FormatoLectura>('hiragana');
