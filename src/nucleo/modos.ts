// Modos de reproducción: cuándo pausar, qué ocultar y cómo saltar las escenas sin diálogo. Lógica pura.

import type { ConfigModo, ModoSalto, ObjetivoFrase, Velo } from '../compartido/ajustes';

export interface LineaModo {
  inicio: number;
  fin: number;
  clases: ReadonlySet<ObjetivoFrase>;
}

export type AccionModo =
  | { tipo: 'pausar'; indice: number; momento: 'antes' | 'despues' }
  | { tipo: 'rebobinar'; indice: number; ms: number };

/** Margen para que el video se detenga a tiempo: pausar tarda unos fotogramas. */
const MARGEN_ANTES = 80;
const MARGEN_DESPUES = 60;
/** Un salto mayor que esto no es reproducción normal: es que el usuario movió el video. */
const SALTO_MS = 1500;

export class MotorModos {
  private ultimoMs = -1;
  private pausadaAntes = -1;
  private pausadaDespues = -1;
  private rebobinada = -1;
  private autoEnLinea = new Map<number, number>();

  constructor(
    private config: ConfigModo,
    private lineas: LineaModo[],
    private desfase = 0
  ) {}

  actualizar(config: ConfigModo, lineas: LineaModo[], desfase: number) {
    this.config = config;
    this.lineas = lineas;
    this.desfase = desfase;
  }

  reiniciar() {
    this.ultimoMs = -1;
    this.pausadaAntes = -1;
    this.pausadaDespues = -1;
    this.rebobinada = -1;
    this.autoEnLinea.clear();
  }

  pausasAutomaticas(indice: number): number {
    return this.autoEnLinea.get(indice) ?? 0;
  }

  private aplica(i: number): boolean {
    const l = this.lineas[i];
    return !!l && this.config.objetivosPausa.some((o) => l.clases.has(o));
  }

  private anotarAuto(i: number) {
    this.autoEnLinea.set(i, (this.autoEnLinea.get(i) ?? 0) + 1);
  }

  /** Se llama en cada avance del video mientras se reproduce. */
  alAvanzar(ms: number): AccionModo | null {
    const { disparador } = this.config;
    const previo = this.ultimoMs;
    this.ultimoMs = ms;
    if (disparador === 'ninguno' || !this.lineas.length) return null;

    // Tras un salto manual se olvidan las pausas hechas, para que el modo vuelva a actuar.
    if (previo >= 0 && Math.abs(ms - previo) > SALTO_MS) {
      this.pausadaAntes = -1;
      this.pausadaDespues = -1;
      this.rebobinada = -1;
      this.autoEnLinea.clear();
    }

    const antes = disparador === 'antes' || disparador === 'antesYDespues';
    const despues = disparador === 'despues' || disparador === 'antesYDespues' || disparador === 'rebobinar';

    // Busca alrededor del instante: las líneas son pocas y están ordenadas.
    let bajo = 0;
    let alto = this.lineas.length - 1;
    while (bajo < alto) {
      const m = (bajo + alto) >> 1;
      if (this.lineas[m].fin + 400 < ms) bajo = m + 1;
      else alto = m;
    }

    for (let i = bajo; i < Math.min(bajo + 3, this.lineas.length); i++) {
      const l = this.lineas[i];
      if (antes && this.pausadaAntes !== i && this.aplica(i)) {
        const objetivo = l.inicio - MARGEN_ANTES + this.desfase;
        if (ms >= objetivo && ms < l.inicio + 300) {
          this.pausadaAntes = i;
          this.anotarAuto(i);
          return { tipo: 'pausar', indice: i, momento: 'antes' };
        }
      }
      if (despues && this.pausadaDespues !== i && this.aplica(i)) {
        const objetivo = l.fin - MARGEN_DESPUES + this.desfase;
        if (ms >= objetivo && ms < l.fin + 400) {
          this.pausadaDespues = i;
          this.anotarAuto(i);
          if (disparador === 'rebobinar') {
            if (this.rebobinada === i) continue;
            this.rebobinada = i;
            return { tipo: 'rebobinar', indice: i, ms: l.inicio };
          }
          return { tipo: 'pausar', indice: i, momento: 'despues' };
        }
      }
    }
    return null;
  }
}

export type TipoPausa = 'manual' | 'auto' | null;

export interface ContextoVelo {
  pausado: boolean;
  tipoPausa: TipoPausa;
  autoEnLinea: number;
  /** Ya hubo una pausa automática en esta línea y el video sigue reproduciéndose. */
  clases: ReadonlySet<ObjetivoFrase>;
  encima: boolean;
}

export type Visibilidad = 'visible' | 'difuminada' | 'oculta';

export function visibilidadVelo(v: Velo, c: ContextoVelo): Visibilidad {
  if (v.modo === 'no') return 'visible';
  if (v.revelarAlPasar && c.encima) return 'visible';
  if (v.revelarPorEstado.some((e) => c.clases.has(e))) return 'visible';
  for (const r of v.revelarEnPausa) {
    if (r === 'cualquiera' && c.pausado) return 'visible';
    if (r === 'manual' && c.pausado && c.tipoPausa === 'manual') return 'visible';
    if (r === 'auto' && c.pausado && c.tipoPausa === 'auto') return 'visible';
    if (r === 'primeraAuto' && c.pausado && c.tipoPausa === 'auto' && c.autoEnLinea >= 1) return 'visible';
    if (r === 'primeraAutoYDurante' && c.autoEnLinea >= 1) return 'visible';
    if (r === 'segundaAuto' && c.pausado && c.tipoPausa === 'auto' && c.autoEnLinea >= 2) return 'visible';
  }
  return v.modo === 'difuminar' ? 'difuminada' : 'oculta';
}

/** Tiempo de espera de una pausa dinámica: lo que tardarías en leer la línea. */
export function duracionPausaDinamica(palabras: number, palabrasPorSegundo: number, minimoSegundos: number): number {
  const s = palabras / Math.max(palabrasPorSegundo, 0.5);
  return Math.max(s, minimoSegundos) * 1000;
}

export type AccionSalto = { tipo: 'velocidad'; valor: number } | { tipo: 'saltar'; ms: number } | { tipo: 'restaurar' } | null;

/** Margen antes de la siguiente línea para volver a velocidad normal y oír su inicio. */
const MARGEN_SALTO = 600;
/** Un hueco menor que esto no merece acelerarse. */
const HUECO_MINIMO = 2500;

export function decidirSalto(modo: ModoSalto, ms: number, inicios: { inicio: number; fin: number }[], acelerando: boolean): AccionSalto {
  if (modo === 'no' || !inicios.length) return acelerando ? { tipo: 'restaurar' } : null;
  let i = 0;
  while (i < inicios.length && inicios[i].fin <= ms) i++;
  const siguiente = inicios[i];
  const dentro = !!siguiente && ms >= siguiente.inicio;
  if (dentro) return acelerando ? { tipo: 'restaurar' } : null;
  const hueco = siguiente ? siguiente.inicio - ms : Infinity;
  if (hueco === Infinity) return acelerando ? { tipo: 'restaurar' } : null;
  if (hueco <= MARGEN_SALTO) return acelerando ? { tipo: 'restaurar' } : null;
  if (!acelerando && hueco < HUECO_MINIMO) return null;
  if (modo === 'saltar') return { tipo: 'saltar', ms: siguiente.inicio - MARGEN_SALTO };
  return acelerando ? null : { tipo: 'velocidad', valor: Number(modo) };
}
