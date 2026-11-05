import { describe, expect, it } from 'vitest';
import { agruparRegistro, claveDia, claveMes, costeDe, diasDelMes, dolares, type FilaConsumo, precioDe, resumirConsumo, tokensLegibles, totalTokens } from './precios';

const uso = (u: Partial<FilaConsumo> = {}) => ({ entrada: 0, salida: 0, cacheEscritura5m: 0, cacheEscritura1h: 0, cacheLectura: 0, ...u });

function fila(t: number, tarea: string, modelo: string, u: Partial<FilaConsumo> = {}): FilaConsumo {
  const datos = uso(u);
  return { ...datos, t, dia: claveDia(t), mes: claveMes(t), tarea, modelo, coste: costeDe(modelo, datos), titulo: u.titulo };
}

describe('coste de una petición', () => {
  it('cobra la entrada y la salida a su precio', () => {
    expect(costeDe('claude-sonnet-5-5', uso({ entrada: 1_000_000 }))).toBeCloseTo(2);
    expect(costeDe('claude-sonnet-5-5', uso({ salida: 1_000_000 }))).toBeCloseTo(10);
    expect(costeDe('claude-opus-5-5', uso({ salida: 1_000_000 }))).toBeCloseTo(20);
    expect(costeDe('claude-haiku-5-5', uso({ entrada: 1_000_000 }))).toBeCloseTo(0.1);
  });

  it('distingue lo escrito en caché y lo leído de ella', () => {
    expect(costeDe('claude-sonnet-5-5', uso({ cacheEscritura5m: 1_000_000 }))).toBeCloseTo(2.5);
    expect(costeDe('claude-sonnet-5-5', uso({ cacheEscritura1h: 1_000_000 }))).toBeCloseTo(4);
    expect(costeDe('claude-sonnet-5-5', uso({ cacheLectura: 1_000_000 }))).toBeCloseTo(0.2);
  });

  it('reconoce el modelo aunque la API le añada la fecha', () => {
    expect(precioDe('claude-sonnet-5-5-20260901').nombre).toBe('Sonnet 5.5');
  });

  it('un modelo desconocido se calcula como Sonnet y se muestra con su nombre', () => {
    expect(precioDe('claude-nuevo').nombre).toBe('claude-nuevo');
    expect(precioDe('claude-nuevo').entrada).toBe(2);
  });
});

describe('resumen del mes', () => {
  const dia5 = new Date(2026, 10, 5, 12).getTime();
  const dia6 = new Date(2026, 10, 6, 12).getTime();
  const octubre = new Date(2026, 9, 30, 12).getTime();
  const filas = [
    fila(dia5, 'sentido', 'claude-sonnet-5-5', { entrada: 1000, salida: 100 }),
    fila(dia5, 'analisis', 'claude-sonnet-5-5', { entrada: 4000, salida: 3000 }),
    fila(dia6, 'profundo', 'claude-opus-5-5', { entrada: 1000, salida: 500 }),
    fila(octubre, 'sentido', 'claude-sonnet-5-5', { entrada: 9000 }),
  ];
  const r = resumirConsumo(filas, '2026-11');

  it('solo cuenta las peticiones de ese mes', () => {
    expect(r.peticiones).toBe(3);
    expect(r.entrada).toBe(6000);
  });

  it('el total es la suma de sus partes', () => {
    expect(r.porModelo.reduce((n, g) => n + g.coste, 0)).toBeCloseTo(r.coste);
    expect(r.porTarea.reduce((n, g) => n + g.coste, 0)).toBeCloseTo(r.coste);
    expect(r.porDia.reduce((n, d) => n + d.coste, 0)).toBeCloseTo(r.coste);
  });

  it('ordena de mayor a menor gasto', () => {
    expect(r.porTarea[0].clave).toBe('analisis');
    expect(r.porTarea[0].nombre).toBe('Revisión de lecturas y gramática');
  });

  it('tiene una columna por cada día del mes, también los días sin gasto', () => {
    expect(r.porDia).toHaveLength(30);
    expect(r.porDia[0].coste).toBe(0);
    expect(r.porDia[4].porModelo['Sonnet 5.5']).toBeGreaterThan(0);
    expect(r.porDia[5].porModelo['Opus 5.5']).toBeGreaterThan(0);
  });

  it('sabe cuántos días tiene cada mes', () => {
    expect(diasDelMes('2026-02')).toHaveLength(28);
    expect(diasDelMes('2028-02')).toHaveLength(29);
    expect(diasDelMes('2026-12').at(-1)).toBe('2026-12-31');
  });
});

describe('registro de gastos', () => {
  const base = new Date(2026, 10, 5, 12).getTime();

  it('une las peticiones seguidas de un mismo trabajo', () => {
    const g = agruparRegistro([
      fila(base, 'subtitulos', 'claude-sonnet-5-5', { entrada: 1000, titulo: 'Video' }),
      fila(base + 1000, 'subtitulos', 'claude-sonnet-5-5', { entrada: 1000, titulo: 'Video' }),
      fila(base + 2000, 'subtitulos', 'claude-sonnet-5-5', { entrada: 1000, titulo: 'Video' }),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].peticiones).toBe(3);
    expect(g[0].tokens).toBe(3000);
    expect(g[0].inicio).toBe(base);
  });

  it('separa trabajos distintos, videos distintos y tiempos lejanos', () => {
    const g = agruparRegistro([
      fila(base, 'subtitulos', 'claude-sonnet-5-5', { titulo: 'A' }),
      fila(base + 1000, 'analisis', 'claude-sonnet-5-5', { titulo: 'A' }),
      fila(base + 2000, 'analisis', 'claude-sonnet-5-5', { titulo: 'B' }),
      fila(base + 3_600_000, 'analisis', 'claude-sonnet-5-5', { titulo: 'B' }),
    ]);
    expect(g).toHaveLength(4);
    expect(g[0].inicio).toBe(base + 3_600_000);
  });
});

describe('cifras legibles', () => {
  it('abrevia los tokens', () => {
    expect(tokensLegibles(950)).toBe('950');
    expect(tokensLegibles(1234)).toBe('1.2 K');
    expect(tokensLegibles(45_000)).toBe('45 K');
    expect(tokensLegibles(3_450_000)).toBe('3.5 M');
    expect(totalTokens(uso({ entrada: 1, salida: 2, cacheLectura: 3 }))).toBe(6);
  });

  it('muestra los centavos, y más decimales si no llega a uno', () => {
    expect(dolares(0)).toBe('USD 0');
    expect(dolares(0.0034)).toBe('USD 0.0034');
    expect(dolares(0.42)).toBe('USD 0.42');
    expect(dolares(12.5)).toBe('USD 12.50');
  });
});
