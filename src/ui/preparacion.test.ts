import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearPreparacion } from './preparacion';

// Sin navegador: un fotograma es un temporizador de 16 ms.
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => setTimeout(() => f(performance.now()), 16));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const diferida = <T,>() => {
  let ok!: (v: T) => void;
  let mal!: (e: unknown) => void;
  const p = new Promise<T>((a, b) => {
    ok = a;
    mal = b;
  });
  return { p, ok, mal };
};

describe('crearPreparacion', () => {
  it('sin nada que esperar, está lista tras dos fotogramas', async () => {
    const listo = vi.fn();
    const p = crearPreparacion(listo);
    p.comprobar();
    await vi.advanceTimersByTimeAsync(20);
    expect(listo).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(40);
    expect(listo).toHaveBeenCalledTimes(1);
  });

  it('espera a lo registrado, aunque falle', async () => {
    const listo = vi.fn();
    const p = crearPreparacion(listo);
    const a = diferida<number>();
    const b = diferida<number>();
    p.esperar(a.p);
    p.esperar(b.p).catch(() => {});
    p.comprobar();
    await vi.advanceTimersByTimeAsync(100);
    a.ok(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(listo).not.toHaveBeenCalled();
    b.mal(new Error('no'));
    await vi.advanceTimersByTimeAsync(100);
    expect(listo).toHaveBeenCalledTimes(1);
  });

  it('lo que se registra justo al acabar otra carga también cuenta', async () => {
    const listo = vi.fn();
    const p = crearPreparacion(listo);
    const a = diferida<number>();
    const b = diferida<number>();
    p.esperar(a.p).then(() => {
      // Como un componente que se monta al llegar el dato y pide lo suyo en su efecto, un fotograma después.
      setTimeout(() => p.esperar(b.p), 20);
    });
    p.comprobar();
    a.ok(1);
    await vi.advanceTimersByTimeAsync(200);
    expect(listo).not.toHaveBeenCalled();
    b.ok(2);
    await vi.advanceTimersByTimeAsync(100);
    expect(listo).toHaveBeenCalledTimes(1);
  });

  it('acabar a la fuerza avisa una vez, y luego esperar ya no retiene nada', async () => {
    const listo = vi.fn();
    const p = crearPreparacion(listo);
    p.esperar(diferida<number>().p);
    p.acabar();
    p.acabar();
    expect(listo).toHaveBeenCalledTimes(1);
    const c = diferida<number>();
    expect(p.esperar(c.p)).toBe(c.p);
    p.comprobar();
    await vi.advanceTimersByTimeAsync(100);
    expect(listo).toHaveBeenCalledTimes(1);
  });
});
