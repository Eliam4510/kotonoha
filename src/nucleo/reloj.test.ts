import { describe, expect, it } from 'vitest';
import { AjusteReloj, descuentoTrasAnuncio, sobraDescuento } from './reloj';

/** Muestras cada `paso` ms de video desde `desde`, con el reproductor diciendo `jugador(video)`. */
function anotarSerie(r: AjusteReloj, desde: number, paso: number, n: number, jugador: (video: number) => number) {
  let cambios = 0;
  for (let i = 0; i < n; i++) {
    const video = desde + i * paso;
    if (r.anotar({ video, jugador: jugador(video) })) cambios++;
  }
  return cambios;
}

describe('AjusteReloj', () => {
  it('no corrige nada si el reproductor va con el video, aunque vaya unas décimas por detrás', () => {
    const r = new AjusteReloj();
    // Como un reproductor que solo se pone al día con cada timeupdate: entre 0 y 250 ms por detrás.
    anotarSerie(r, 60_000, 300, 12, (v) => v - ((v / 300) % 5) * 50);
    expect(r.correccion).toBe(0);
    expect(r.medido).toBe(true);
  });

  it('sigue al reproductor cuando el video va por delante, como tras un anuncio', () => {
    const r = new AjusteReloj();
    // Dos muestras no bastan, ni tres que cubren menos de un segundo de video.
    anotarSerie(r, 615_000, 250, 3, (v) => v - 15_000);
    expect(r.correccion).toBe(0);
    anotarSerie(r, 615_750, 250, 2, (v) => v - 15_000);
    expect(r.correccion).toBe(-15_000);
  });

  it('también cuando el video va por detrás', () => {
    const r = new AjusteReloj();
    anotarSerie(r, 2_000, 1000, 4, (v) => v + 1_480_000);
    expect(r.correccion).toBe(1_480_000);
  });

  it('no se fía de un reproductor que cuenta en otra unidad', () => {
    const r = new AjusteReloj();
    // En segundos en vez de milisegundos: la diferencia cambia tanto como avanza el video.
    anotarSerie(r, 600_000, 300, 6, (v) => v / 1000);
    anotarSerie(r, 601_800, 1000, 6, (v) => v / 1000);
    expect(r.correccion).toBe(0);
    expect(r.medido).toBe(false);
  });

  it('no cuenta las muestras con el video parado', () => {
    const r = new AjusteReloj();
    for (let i = 0; i < 10; i++) expect(r.anotar({ video: 600_000, jugador: 600 })).toBe(false);
    expect(r.correccion).toBe(0);
  });

  it('una lectura suelta fuera de sitio no mueve nada', () => {
    const r = new AjusteReloj();
    anotarSerie(r, 615_000, 300, 5, (v) => v - 15_000);
    expect(r.correccion).toBe(-15_000);
    // Por ejemplo, leída a mitad de un salto.
    r.anotar({ video: 616_600, jugador: 400_000 });
    expect(r.correccion).toBe(-15_000);
  });

  it('las décimas de vaivén no cambian una corrección puesta; otro anuncio, sí', () => {
    const r = new AjusteReloj();
    anotarSerie(r, 615_000, 300, 5, (v) => v - 15_000);
    expect(anotarSerie(r, 616_500, 300, 6, (v) => v - 15_150)).toBe(0);
    expect(r.correccion).toBe(-15_000);
    r.olvidarMuestras();
    anotarSerie(r, 700_000, 300, 5, (v) => v - 45_000);
    expect(r.correccion).toBe(-45_000);
  });

  it('cerca del umbral no parpadea, y se quita cuando vuelven a ir a la par', () => {
    const r = new AjusteReloj();
    anotarSerie(r, 10_000, 300, 5, (v) => v - 1200);
    expect(r.correccion).toBe(-1200);
    r.olvidarMuestras();
    anotarSerie(r, 20_000, 300, 5, (v) => v - 950);
    expect(r.correccion).toBe(-1200);
    r.olvidarMuestras();
    anotarSerie(r, 30_000, 300, 5, (v) => v - 100);
    expect(r.correccion).toBe(0);
  });

  it('al volver atrás empieza a medir de nuevo, y reiniciar lo borra todo', () => {
    const r = new AjusteReloj();
    anotarSerie(r, 615_000, 300, 5, (v) => v - 15_000);
    // Tras un salto atrás, las muestras de antes no se mezclan con las nuevas.
    anotarSerie(r, 100_000, 300, 2, (v) => v);
    expect(r.correccion).toBe(-15_000);
    anotarSerie(r, 100_600, 300, 3, (v) => v);
    expect(r.correccion).toBe(0);
    anotarSerie(r, 200_000, 300, 5, (v) => v - 15_000);
    r.reiniciar();
    expect(r.correccion).toBe(0);
    expect(r.medido).toBe(false);
  });

  it('una medida nueva tras olvidar las muestras cuenta aunque no cambie nada', () => {
    const r = new AjusteReloj();
    anotarSerie(r, 615_000, 300, 5, (v) => v - 16_200);
    const medidas = r.medidas;
    r.olvidarMuestras();
    expect(anotarSerie(r, 700_000, 300, 5, (v) => v - 16_200)).toBe(0);
    // Así se sabe que «Volver a sincronizar» midió de verdad, y no que repite lo de antes.
    expect(r.medidas).toBeGreaterThan(medidas);
  });
});

describe('descuentoTrasAnuncio', () => {
  const sinVolver = { volvioAtras: false };

  it('si el reloj del sitio descontó el anuncio, manda su medida', () => {
    expect(descuentoTrasAnuncio({ avance: 30_000, base: 0 }, { midio: true, correccion: -30_000, ...sinVolver })).toBeNull();
    // Aunque los bordes del anuncio se vean con algo de retraso y no cuadren al milisegundo.
    expect(descuentoTrasAnuncio({ avance: 31_400, base: 0 }, { midio: true, correccion: -30_000, ...sinVolver })).toBeNull();
  });

  it('si el reloj no se movió aunque el video corrió, se descuenta lo que corrió durante el anuncio', () => {
    expect(descuentoTrasAnuncio({ avance: 30_000, base: 0 }, { midio: true, correccion: 0, ...sinVolver })).toBe(-30_000);
    // Lo que ya medía su reloj (un anuncio del principio, por ejemplo) no se toca: el descuento va aparte.
    expect(descuentoTrasAnuncio({ avance: 15_200, base: -16_200 }, { midio: true, correccion: -16_200, ...sinVolver })).toBe(-15_200);
  });

  it('sin medida del reloj del sitio, también', () => {
    expect(descuentoTrasAnuncio({ avance: 20_000, base: 0 }, { midio: false, correccion: 0, ...sinVolver })).toBe(-20_000);
  });

  it('si el video volvió atrás al acabar, devolvió lo que corrió y no hay nada que descontar', () => {
    expect(descuentoTrasAnuncio({ avance: 16_200, base: 0 }, { midio: true, correccion: 0, volvioAtras: true })).toBeNull();
    expect(descuentoTrasAnuncio({ avance: 16_200, base: 0 }, { midio: false, correccion: 0, volvioAtras: true })).toBeNull();
  });

  it('un anuncio que no movió el video no cambia nada', () => {
    // Por ejemplo, un anuncio en otro <video>, con el del episodio quieto.
    expect(descuentoTrasAnuncio({ avance: 400, base: 0 }, { midio: false, correccion: 0, ...sinVolver })).toBeNull();
    expect(descuentoTrasAnuncio({ avance: 2_900, base: -5_000 }, { midio: true, correccion: -5_000, ...sinVolver })).toBeNull();
  });
});

describe('sobraDescuento', () => {
  it('sobra en cuanto su reloj mide otra cosa que cuando se puso: ya cuenta lo que corrió el video', () => {
    // Su medida llegó tarde tras el anuncio: el descuento se puso con 0 y ahora mide −5 s.
    expect(sobraDescuento(-5_000, 0)).toBe(true);
    expect(sobraDescuento(-21_200, -16_200)).toBe(true);
  });

  it('no sobra mientras su reloj siga diciendo lo mismo, con algo de vaivén', () => {
    expect(sobraDescuento(0, 0)).toBe(false);
    expect(sobraDescuento(-16_500, -16_200)).toBe(false);
  });
});
