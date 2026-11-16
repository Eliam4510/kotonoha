import { describe, expect, it } from 'vitest';
import { AjusteReloj, correccionTrasAnuncio } from './reloj';

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

  it('fijar pone una corrección que no sale de las muestras', () => {
    const r = new AjusteReloj();
    r.fijar(-30_000.4);
    expect(r.correccion).toBe(-30_000);
    expect(r.medido).toBe(true);
  });
});

describe('correccionTrasAnuncio', () => {
  it('si el reloj del sitio descontó el anuncio, manda su medida', () => {
    expect(correccionTrasAnuncio({ avance: 30_000, correccionAntes: 0 }, { midio: true, correccion: -30_000 })).toBeNull();
    // Aunque los bordes del anuncio se vean con algo de retraso y no cuadren al milisegundo.
    expect(correccionTrasAnuncio({ avance: 31_400, correccionAntes: 0 }, { midio: true, correccion: -30_000 })).toBeNull();
  });

  it('si el reloj no se movió aunque el video corrió, se corrige por lo que corrió durante el anuncio', () => {
    expect(correccionTrasAnuncio({ avance: 30_000, correccionAntes: 0 }, { midio: true, correccion: 0 })).toBe(-30_000);
    // Y se suma a lo que ya llevaba por otros anuncios.
    expect(correccionTrasAnuncio({ avance: 15_200, correccionAntes: -30_000 }, { midio: true, correccion: -30_000 })).toBe(-45_200);
  });

  it('sin medida del reloj del sitio, también', () => {
    expect(correccionTrasAnuncio({ avance: 20_000, correccionAntes: 0 }, { midio: false, correccion: 0 })).toBe(-20_000);
  });

  it('un anuncio que no movió el video no cambia nada', () => {
    // Por ejemplo, un anuncio en otro <video>, con el del episodio quieto.
    expect(correccionTrasAnuncio({ avance: 400, correccionAntes: 0 }, { midio: false, correccion: 0 })).toBeNull();
    expect(correccionTrasAnuncio({ avance: 2_900, correccionAntes: -5_000 }, { midio: true, correccion: -5_000 })).toBeNull();
  });
});
