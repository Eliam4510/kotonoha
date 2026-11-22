import { describe, expect, it } from 'vitest';
import { type Apunte, enOrdenDeRepaso, estadisticas, estadoDe, nuevasQuedan, type TarjetaParaOrden } from './memoria';

const H = 3600_000;
const D = 24 * H;
// Un mediodía local: los días no cambian por la zona horaria del equipo que pasa las pruebas.
const AHORA = new Date(2026, 10, 22, 12).getTime();
const t = (id: string, o: Partial<TarjetaParaOrden> & { estado?: number; reps?: number }): TarjetaParaOrden => ({
  id,
  creada: o.creada ?? 0,
  vence: o.vence ?? AHORA,
  suspendida: o.suspendida,
  fsrs: { state: o.estado ?? 0, reps: o.reps ?? (o.estado ? 3 : 0) },
});

describe('la Memoria', () => {
  it('distingue nuevas, en aprendizaje, en repaso y suspendidas', () => {
    expect([t('a', {}), t('b', { estado: 1 }), t('c', { estado: 2 }), t('d', { estado: 3 }), t('e', { estado: 2, suspendida: true })].map(estadoDe)).toEqual([
      'nueva', 'aprendiendo', 'repaso', 'aprendiendo', 'suspendida',
    ]);
  });

  it('las nuevas del día se gastan al estrenarlas, una vez por tarjeta', () => {
    const hoy = [
      { tarjeta: 'a', estadoPrevio: 0 },
      { tarjeta: 'a', estadoPrevio: 1 },
      { tarjeta: 'b', estadoPrevio: 0 },
      { tarjeta: 'c', estadoPrevio: 2 },
    ];
    expect(nuevasQuedan(20, hoy)).toBe(18);
    expect(nuevasQuedan(1, hoy)).toBe(0);
  });

  it('primero lo que ya se aprende, por vencimiento; después las nuevas que quedan, por llegada; nada suspendido ni futuro', () => {
    const l = [
      t('nueva-2', { creada: 2 }),
      t('repaso-tarde', { estado: 2, vence: AHORA - H }),
      t('nueva-1', { creada: 1 }),
      t('aprende', { estado: 1, vence: AHORA - 3 * H }),
      t('suspendida', { estado: 2, vence: AHORA - D, suspendida: true }),
      t('mañana', { estado: 2, vence: AHORA + D }),
      t('nueva-3', { creada: 3 }),
    ];
    expect(enOrdenDeRepaso(l, AHORA, 2).map((x) => x.id)).toEqual(['aprende', 'repaso-tarde', 'nueva-1', 'nueva-2']);
    expect(enOrdenDeRepaso(l, AHORA, 0).map((x) => x.id)).toEqual(['aprende', 'repaso-tarde']);
    expect(enOrdenDeRepaso(l, AHORA, 5, 3).map((x) => x.id)).toEqual(['aprende', 'repaso-tarde', 'nueva-1']);
  });

  it('cuenta los repasos por día, los aciertos, la retención de las de repaso y la racha', () => {
    const a = (dias: number, nota: Apunte['nota'], estadoPrevio = 2): Apunte => ({ tarjeta: 'x', fecha: AHORA - dias * D, nota, estadoPrevio });
    const apuntes = [a(0, 3), a(0, 1), a(1, 4), a(2, 3, 0), a(4, 2)];
    const e = estadisticas(apuntes, [], AHORA, 7);
    expect(e.porDia.map((d) => d.repasos)).toEqual([0, 0, 1, 0, 1, 1, 2]);
    expect(e.hoy).toEqual({ repasos: 2, aciertos: 1 });
    // De repaso: hoy 3 y 1, hace un día 4, hace cuatro 2. La nueva de hace dos días no cuenta.
    expect(e.retencion).toBeCloseTo(3 / 4);
    expect(e.racha).toBe(3);
  });

  it('la racha sigue viva si hoy aún no se ha repasado, y sin datos no hay retención', () => {
    const e = estadisticas([{ tarjeta: 'x', fecha: AHORA - D, nota: 3, estadoPrevio: 0 }], [], AHORA, 3);
    expect(e.racha).toBe(1);
    expect(e.retencion).toBeNull();
    expect(estadisticas([], [], AHORA).racha).toBe(0);
  });

  it('lo que vence en los próximos días, con lo atrasado en hoy y sin las suspendidas', () => {
    const l = [t('a', { estado: 2, vence: AHORA - 2 * D }), t('b', { estado: 2, vence: AHORA + D }), t('c', { estado: 2, vence: AHORA + D + H }), t('d', { estado: 2, vence: AHORA + D, suspendida: true }), t('e', {})];
    const e = estadisticas([], l, AHORA, 1, 3);
    expect(e.vencen.map((x) => x.tarjetas)).toEqual([2, 2, 0]);
    expect(e.porEstado).toEqual({ nueva: 1, aprendiendo: 0, repaso: 3, suspendida: 1 });
  });
});
