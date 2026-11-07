// Teclas que funcionan con cualquier distribución e idioma de teclado.

const SIGNOS: Record<string, string> = { Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Backquote: '`', Backslash: '\\', Comma: ',', Period: '.', Slash: '/', Space: ' ' };

interface EventoTecla {
  key: string;
  code: string;
}

/**
 * La tecla como letra latina. Con el teclado en coreano, en ruso o en kana, `key` da ㅂ, й o た, y los atajos no
 * responderían nunca: en esos casos se usa la posición física, que `code` da como si fuera un teclado QWERTY.
 */
export function teclaLatina(e: EventoTecla): string {
  const { key, code } = e;
  if (key.length === 1 && key >= ' ' && key <= '~') return key.toLowerCase();
  if (key.length > 1 && key !== 'Process' && key !== 'Unidentified' && key !== 'Dead') return key;
  if (/^Key[A-Z]$/.test(code)) return code[3].toLowerCase();
  if (/^Digit\d$/.test(code)) return code[5];
  if (/^Numpad\d$/.test(code)) return code[6];
  return SIGNOS[code] ?? key;
}

export interface Combinacion {
  k: string;
  alt: boolean;
  shift: boolean;
  ctrl: boolean;
}

/** Una combinación como texto, para guardarla y compararla: «alt+shift+m». */
export function textoCombinacion({ k, alt, shift, ctrl }: Combinacion): string {
  return [ctrl && 'ctrl', alt && 'alt', shift && 'shift', k.toLowerCase()].filter(Boolean).join('+');
}

export function leerCombinacion(texto: string): Combinacion {
  const partes = texto.split('+');
  // El signo más también es una tecla: «alt++» termina en dos partes vacías.
  const k = texto.endsWith('+') ? '+' : (partes[partes.length - 1] ?? '');
  return { k: k.length === 1 ? k : k.replace(/^arrow(.)/, (_, c: string) => `Arrow${c.toUpperCase()}`).replace(/^escape$/, 'Escape'), alt: partes.includes('alt'), shift: partes.includes('shift'), ctrl: partes.includes('ctrl') };
}

/** Cómo se enseña una combinación: «Alt + Shift + M». */
export function mostrarCombinacion(texto: string): string {
  const c = leerCombinacion(texto);
  const nombre = c.k.startsWith('Arrow') ? ({ ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' } as Record<string, string>)[c.k] : c.k.length === 1 ? c.k.toUpperCase() : c.k;
  return [c.ctrl && 'Ctrl', c.alt && 'Alt', c.shift && 'Shift', nombre].filter(Boolean).join(' + ');
}
