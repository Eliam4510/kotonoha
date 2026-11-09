// Que dos piezas distintas no usen la misma clase sin saberlo: la segunda regla se mezcla con la primera y una de las dos
// se ve rota (pasó con la barrita del Cuaderno y la barra de selección de Palabras, las dos «.ap-seleccion»). Un mismo
// selector escrito dos veces en el nivel superior de una hoja de estilos es la señal.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(import.meta.dirname, '..');

/** Las que completan a propósito la misma regla más abajo, junto a lo que añaden. */
const PERMITIDAS = new Set([
  "ui/estilos.css .kk-raiz[data-tema='claro']",
  'ui/ficha.css .estado',
  'visor/visor.css .vs-pagina',
  'visor/visor.css .vs-miniatura-hoja',
]);

function hojas(carpeta: string): string[] {
  return readdirSync(carpeta, { withFileTypes: true }).flatMap((e) => {
    const ruta = join(carpeta, e.name);
    if (e.isDirectory()) return hojas(ruta);
    return e.name.endsWith('.css') ? [ruta] : [];
  });
}

/** Los selectores de las reglas del nivel superior, sin las de dentro de @media y compañía. */
function selectores(css: string): string[] {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const salida: string[] = [];
  let profundidad = 0;
  let trozo = '';
  for (const c of limpio) {
    if (c === '{') {
      if (profundidad === 0) salida.push(trozo.trim());
      profundidad++;
      trozo = '';
    } else if (c === '}') {
      profundidad--;
      trozo = '';
    } else if (profundidad === 0) {
      trozo += c;
    }
  }
  return salida.filter((s) => s && !s.startsWith('@'));
}

describe('hojas de estilo', () => {
  it('ningún selector se define dos veces en la misma hoja', () => {
    const repetidos: string[] = [];
    for (const ruta of hojas(SRC)) {
      const nombre = relative(SRC, ruta).replace(/\\/g, '/');
      const vistos = new Set<string>();
      for (const s of selectores(readFileSync(ruta, 'utf8'))) {
        if (vistos.has(s) && !PERMITIDAS.has(`${nombre} ${s}`)) repetidos.push(`${nombre}: ${s}`);
        vistos.add(s);
      }
    }
    expect(repetidos).toEqual([]);
  });
});
