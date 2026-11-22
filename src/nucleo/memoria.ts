// La Memoria, el repaso espaciado propio, sin base de datos: qué toca hoy y en qué orden, cuántas nuevas quedan, y lo que
// cuentan los repasos hechos (por día, aciertos, racha y lo que vence). Se prueba en Node.

import { diaLocal, diaMas } from './inmersion';

/** Los estados de FSRS: 0 nueva, 1 aprendiendo, 2 repaso, 3 reaprendiendo. */
export type EstadoMemoria = 'nueva' | 'aprendiendo' | 'repaso' | 'suspendida';

export interface TarjetaParaOrden {
  id: string;
  creada: number;
  vence: number;
  suspendida?: boolean;
  fsrs: { state?: number; reps?: number };
}

/** Un repaso hecho: cuándo, con qué nota y en qué estado estaba la tarjeta antes. */
export interface Apunte {
  tarjeta: string;
  fecha: number;
  nota: 1 | 2 | 3 | 4;
  /** El estado FSRS de antes: 0 si era nueva. */
  estadoPrevio: number;
}

export function estadoDe(t: Pick<TarjetaParaOrden, 'suspendida' | 'fsrs'>): EstadoMemoria {
  if (t.suspendida) return 'suspendida';
  const s = t.fsrs.state ?? 0;
  if (s === 0 || (t.fsrs.reps ?? 0) === 0) return 'nueva';
  return s === 2 ? 'repaso' : 'aprendiendo';
}

/** Las nuevas que se pueden ver aún hoy: las del día menos las que ya se estrenaron hoy. */
export function nuevasQuedan(nuevasDia: number, apuntesHoy: Pick<Apunte, 'estadoPrevio' | 'tarjeta'>[]): number {
  const estrenadas = new Set(apuntesHoy.filter((a) => a.estadoPrevio === 0).map((a) => a.tarjeta)).size;
  return Math.max(0, nuevasDia - estrenadas);
}

/**
 * Lo que toca repasar ahora, en orden: primero lo que ya se aprende (lo que vence antes, antes), luego las nuevas, por
 * cómo llegaron, hasta las que quedan para hoy. Las suspendidas no salen.
 */
export function enOrdenDeRepaso<T extends TarjetaParaOrden>(tarjetas: T[], ahora: number, nuevas: number, limite = Infinity): T[] {
  const vivas = tarjetas.filter((t) => !t.suspendida && t.vence <= ahora);
  const viejas = vivas.filter((t) => estadoDe(t) !== 'nueva').sort((a, b) => a.vence - b.vence);
  const nuevasHoy = vivas
    .filter((t) => estadoDe(t) === 'nueva')
    .sort((a, b) => a.creada - b.creada)
    .slice(0, nuevas);
  return [...viejas, ...nuevasHoy].slice(0, limite);
}

export interface Estadisticas {
  /** Los últimos días, del más antiguo a hoy: cuántos repasos y cuántos acertados. */
  porDia: { dia: string; repasos: number; aciertos: number }[];
  /** Los próximos días, de hoy en adelante: cuántas tarjetas vencen (las de hoy incluyen las atrasadas). */
  vencen: { dia: string; tarjetas: number }[];
  /** De las que estaban en repaso, las que no fueron «Otra vez», en los últimos 30 días. Null sin datos. */
  retencion: number | null;
  /** Días seguidos con algún repaso, hasta hoy (o hasta ayer, si hoy aún no se ha repasado). */
  racha: number;
  hoy: { repasos: number; aciertos: number };
  porEstado: Record<EstadoMemoria, number>;
}

export function estadisticas(apuntes: Apunte[], tarjetas: TarjetaParaOrden[], ahora: number, dias = 30, futuro = 14): Estadisticas {
  const hoy = diaLocal(ahora);
  const porDiaMapa = new Map<string, { repasos: number; aciertos: number }>();
  for (const a of apuntes) {
    const d = diaLocal(a.fecha);
    const x = porDiaMapa.get(d) ?? { repasos: 0, aciertos: 0 };
    x.repasos++;
    if (a.nota > 1) x.aciertos++;
    porDiaMapa.set(d, x);
  }
  const porDia = Array.from({ length: dias }, (_, i) => {
    const dia = diaMas(hoy, i - dias + 1);
    return { dia, ...(porDiaMapa.get(dia) ?? { repasos: 0, aciertos: 0 }) };
  });

  const vencenMapa = new Map<string, number>();
  for (const t of tarjetas) {
    if (t.suspendida) continue;
    const d = t.vence <= ahora ? hoy : diaLocal(t.vence);
    vencenMapa.set(d, (vencenMapa.get(d) ?? 0) + 1);
  }
  const vencen = Array.from({ length: futuro }, (_, i) => {
    const dia = diaMas(hoy, i);
    return { dia, tarjetas: vencenMapa.get(dia) ?? 0 };
  });

  const desde = diaMas(hoy, -29);
  const deRepaso = apuntes.filter((a) => a.estadoPrevio === 2 && diaLocal(a.fecha) >= desde);
  const retencion = deRepaso.length ? deRepaso.filter((a) => a.nota > 1).length / deRepaso.length : null;

  let racha = 0;
  let d = porDiaMapa.has(hoy) ? hoy : diaMas(hoy, -1);
  while (porDiaMapa.has(d)) {
    racha++;
    d = diaMas(d, -1);
  }

  const porEstado: Record<EstadoMemoria, number> = { nueva: 0, aprendiendo: 0, repaso: 0, suspendida: 0 };
  for (const t of tarjetas) porEstado[estadoDe(t)]++;

  return { porDia, vencen, retencion, racha, hoy: porDiaMapa.get(hoy) ?? { repasos: 0, aciertos: 0 }, porEstado };
}
