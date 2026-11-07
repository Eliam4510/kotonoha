// Detección de puntos gramaticales con reglas, común a todas las lenguas: lo que cambia son las reglas.

import type { PuntoGramatica } from './tipos';

export interface ReglaGramatica {
  patron: string;
  nivel: string;
  significado: string;
  re: RegExp;
}

export function aplicarReglas(REGLAS: ReglaGramatica[], texto: string): PuntoGramatica[] {
  const halladas: (PuntoGramatica & { desde: number; hasta: number })[] = [];
  for (const r of REGLAS) {
    const m = r.re.exec(texto);
    if (!m) continue;
    halladas.push({
      patron: r.patron,
      nivel: r.nivel,
      fragmento: m[0],
      significado: r.significado,
      fuente: 'regla',
      desde: m.index,
      hasta: m.index + m[0].length,
    });
  }
  halladas.sort((a, b) => b.hasta - b.desde - (a.hasta - a.desde));
  const salida: typeof halladas = [];
  for (const h of halladas) {
    const contenida = salida.some((s) => h.desde >= s.desde && h.hasta <= s.hasta && s.patron !== h.patron);
    if (!contenida && !salida.some((s) => s.patron === h.patron)) salida.push(h);
  }
  return salida.sort((a, b) => a.desde - b.desde).map(({ desde: _d, hasta: _h, ...p }) => p);
}
