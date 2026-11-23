import { describe, expect, it } from 'vitest';
import { emparejar, enOrden, esCancionPorArchivo, haTerminado, lineaEn, partesDeSubtitulo, puntoDeReanudar, reloj, tipoDeArchivo, velocidadVecina } from './reproductor';

const a = (...nombres: string[]) => nombres.map((nombre) => ({ nombre }));
const casados = (r: ReturnType<typeof emparejar<{ nombre: string }, { nombre: string }>>) =>
  Object.fromEntries([...r.porMedio].map(([m, s]) => [m.nombre, s.map((x) => x.nombre)]));

describe('el reproductor de archivos', () => {
  it('distingue videos, audios y subtítulos por su extensión', () => {
    expect(['ep.MKV', 'podcast.mp3', 'libro.m4b', 'ep.ja.srt', 'notas.txt', 'sin-extension'].map(tipoDeArchivo)).toEqual([
      'video', 'audio', 'audio', 'subtitulos', null, null,
    ]);
  });

  it('lee el idioma del nombre de unos subtítulos y lo quita para casarlos', () => {
    expect(partesDeSubtitulo('Capítulo 01.ja.srt')).toEqual({ base: 'Capítulo 01', idioma: 'ja' });
    expect(partesDeSubtitulo('Capítulo 01.jpn.forced.ass')).toEqual({ base: 'Capítulo 01', idioma: 'ja' });
    expect(partesDeSubtitulo('Movie.en-US.vtt')).toEqual({ base: 'Movie', idioma: 'en' });
    expect(partesDeSubtitulo('Serie.zh-Hans.srt')).toEqual({ base: 'Serie', idioma: 'zh' });
    expect(partesDeSubtitulo('Serie.Español.srt')).toEqual({ base: 'Serie', idioma: 'es' });
    // Un punto que no es de idioma se queda en el nombre.
    expect(partesDeSubtitulo('Dr.Stone 05.srt')).toEqual({ base: 'Dr.Stone 05', idioma: null });
    expect(partesDeSubtitulo('ep.final.srt')).toEqual({ base: 'ep.final', idioma: null });
  });

  it('casa cada subtítulo con su video, también con otro final y en otra caja', () => {
    const r = emparejar(
      a('Show S01E01 [1080p].mkv', 'Show S01E02 [1080p].mkv', 'show s01e10.mkv'),
      a('Show S01E01.ja.srt', 'Show S01E01.es.srt', 'SHOW S01E10.ja.srt', 'otra cosa.srt')
    );
    expect(casados(r)).toEqual({
      'Show S01E01 [1080p].mkv': ['Show S01E01.ja.srt', 'Show S01E01.es.srt'],
      'show s01e10.mkv': ['SHOW S01E10.ja.srt'],
    });
    expect(r.sueltos.map((s) => s.nombre)).toEqual(['otra cosa.srt']);
  });

  it('no casa por un principio que comparten varios, ni por tres letras', () => {
    const r = emparejar(a('Ep 1.mp4', 'Ep 10.mp4'), a('Ep.ja.srt', 'Ep 1.ja.srt'));
    expect(casados(r)).toEqual({ 'Ep 1.mp4': ['Ep 1.ja.srt'] });
    expect(r.sueltos.map((s) => s.nombre)).toEqual(['Ep.ja.srt']);
  });

  it('con un solo video, todos los subtítulos son suyos', () => {
    expect(casados(emparejar(a('pelicula.mp4'), a('subs.srt')))).toEqual({ 'pelicula.mp4': ['subs.srt'] });
  });

  it('ordena los capítulos por su número, no letra a letra', () => {
    expect(enOrden(a('Ep 10.mkv', 'Ep 2.mkv', 'Ep 1.mkv')).map((x) => x.nombre)).toEqual(['Ep 1.mkv', 'Ep 2.mkv', 'Ep 10.mkv']);
  });

  it('sigue unos segundos antes de donde se dejó, salvo al principio o al final', () => {
    expect(puntoDeReanudar(600, 1440)).toBe(597);
    expect(puntoDeReanudar(10, 1440)).toBeNull();
    expect(puntoDeReanudar(1420, 1440)).toBeNull();
    expect(puntoDeReanudar(50, 0)).toBeNull();
    expect(haTerminado(1411, 1440)).toBe(true);
    expect(haTerminado(1400, 1440)).toBe(false);
    // En algo corto, solo los últimos segundos.
    expect(haTerminado(40, 60)).toBe(false);
    expect(haTerminado(57.5, 60)).toBe(true);
  });

  it('cambia de velocidad paso a paso, sin salirse', () => {
    expect(velocidadVecina(1, 1)).toBe(1.1);
    expect(velocidadVecina(1, -1)).toBe(0.9);
    expect(velocidadVecina(1.3, -1)).toBe(1.25);
    expect(velocidadVecina(2, 1)).toBe(2);
    expect(velocidadVecina(0.5, -1)).toBe(0.5);
  });

  it('escribe el tiempo como un reloj', () => {
    expect([0, 75, 600, 3725, Number.NaN, -3].map(reloj)).toEqual(['0:00', '1:15', '10:00', '1:02:05', '0:00', '0:00']);
  });

  it('encuentra la línea de un momento, y la anterior en un hueco corto', () => {
    const l = [
      { inicio: 1000, fin: 3000, texto: 'a' },
      { inicio: 3500, fin: 6000, texto: 'b' },
      { inicio: 20000, fin: 22000, texto: 'c' },
    ];
    expect([0, 1000, 2999, 3200, 5000, 7000, 10000, 21000].map((ms) => lineaEn(l, ms)?.texto ?? null)).toEqual([
      null, 'a', 'a', 'a', 'b', 'b', null, 'c',
    ]);
  });
});

describe('esCancionPorArchivo', () => {
  it('un audio suelto es una canción, salvo un audiolibro; un video o unos subtítulos no', () => {
    expect(esCancionPorArchivo('01. Readymade.flac')).toBe(true);
    expect(esCancionPorArchivo('夜に駆ける.MP3')).toBe(true);
    expect(esCancionPorArchivo('Kokoro.m4b')).toBe(false);
    expect(esCancionPorArchivo('episodio.mkv')).toBe(false);
    expect(esCancionPorArchivo('01. Readymade.lrc')).toBe(false);
  });

  it('acepta letras LRC como subtítulos', () => {
    expect(tipoDeArchivo('01. Readymade.lrc')).toBe('subtitulos');
  });
});
