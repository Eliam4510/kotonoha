import { describe, expect, it } from 'vitest';
import { diaLocal, diaMas, type FilaInmersion, pasoDeReloj, RACHA_MINIMA_S, resumirInmersion } from './inmersion';

const fila = (dia: string, segundos: number, fuente = 'yt:abc', tipo: FilaInmersion['tipo'] = 'video', titulo = 'Un video', actualizada = 0): FilaInmersion => ({ dia, tipo, fuente, titulo, segundos, actualizada });

describe('los días', () => {
  it('da el día local y cruza meses y años', () => {
    expect(diaLocal(new Date(2026, 10, 9, 0, 30))).toBe('2026-11-09');
    expect(diaMas('2026-03-01', -1)).toBe('2026-02-28');
    expect(diaMas('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('el resumen de la inmersión', () => {
  it('suma hoy, la semana y el total', () => {
    const r = resumirInmersion([fila('2026-11-09', 600), fila('2026-11-09', 300, 'libro:1', 'lectura'), fila('2026-11-05', 1200), fila('2026-10-01', 3600)], '2026-11-09');
    expect(r.hoy).toBe(900);
    expect(r.semana).toBe(2100);
    expect(r.total).toBe(5700);
    expect(r.dias.map((d) => d.dia)).toEqual(['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09']);
    expect(r.dias[2].segundos).toBe(1200);
  });

  it('cuenta la racha hasta hoy, o hasta ayer si hoy aún no llega al mínimo', () => {
    const dias = ['2026-11-06', '2026-11-07', '2026-11-08'].map((d) => fila(d, RACHA_MINIMA_S));
    expect(resumirInmersion(dias, '2026-11-09').racha).toBe(3);
    expect(resumirInmersion([...dias, fila('2026-11-09', 60)], '2026-11-09').racha).toBe(3);
    expect(resumirInmersion([...dias, fila('2026-11-09', RACHA_MINIMA_S)], '2026-11-09').racha).toBe(4);
    // Un día con poco rompe la racha.
    expect(resumirInmersion([fila('2026-11-06', RACHA_MINIMA_S), fila('2026-11-07', 30), fila('2026-11-08', RACHA_MINIMA_S)], '2026-11-09').racha).toBe(1);
    expect(resumirInmersion([fila('2026-11-07', RACHA_MINIMA_S)], '2026-11-09').racha).toBe(0);
  });

  it('dice lo que más se vio, con el título más reciente de cada fuente', () => {
    const r = resumirInmersion(
      [fila('2026-11-08', 100, 'a', 'video', 'Viejo', 1), fila('2026-11-09', 100, 'a', 'video', 'Nuevo', 2), fila('2026-11-09', 150, 'b', 'lectura', 'Libro'), fila('2026-11-09', 10, 'c')],
      '2026-11-09',
      2
    );
    expect(r.mas).toEqual([
      { tipo: 'video', fuente: 'a', titulo: 'Nuevo', segundos: 200 },
      { tipo: 'lectura', fuente: 'b', titulo: 'Libro', segundos: 150 },
    ]);
  });
});

describe('el reloj', () => {
  it('suma el tiempo entre tics, con un tope para un equipo que se durmió', () => {
    expect(pasoDeReloj(0, 15000, 20)).toBe(15);
    expect(pasoDeReloj(0, 3_600_000, 20)).toBe(20);
    expect(pasoDeReloj(1000, 0, 20)).toBe(0);
  });
});
