import { describe, expect, it } from 'vitest';
import { analizarInformeFfmpeg, formatoExtraccionAudio, idiomaCorto, imagenNegra, tramoConSonido } from './medios';

const INFORME = `Input #0, matroska,webm, from '/m/pelicula.mkv':
  Metadata:
    title           : Película
  Duration: 01:42:07.50, start: 0.000000, bitrate: 2500 kb/s
  Stream #0:0: Video: h264 (High), yuv420p(progressive), 1920x1080, 23.98 fps (default)
  Stream #0:1(jpn): Audio: aac (LC), 48000 Hz, stereo, fltp (default)
    Metadata:
      title           : 日本語 2.0
  Stream #0:2(eng): Audio: opus, 48000 Hz, 5.1, fltp
    Metadata:
      title           : Doblaje
  Stream #0:3(jpn): Subtitle: subrip (default)
    Metadata:
      title           : 字幕
  Stream #0:4(spa): Subtitle: ass
  Stream #0:5(eng): Subtitle: hdmv_pgs_subtitle (pgssub)
    Metadata:
      title           : PGS`;

describe('informe de ffmpeg', () => {
  const r = analizarInformeFfmpeg(INFORME);

  it('lee la duración', () => {
    expect(r.duracionS).toBeCloseTo(6127.5);
  });

  it('numera las pistas de cada tipo por separado', () => {
    expect(r.audio.map((p) => p.indice)).toEqual([0, 1]);
    expect(r.subtitulos.map((p) => p.indice)).toEqual([0, 1, 2]);
  });

  it('lee idioma, códec, título y pista predeterminada', () => {
    expect(r.audio[0]).toMatchObject({ idioma: 'ja', codec: 'aac', titulo: '日本語 2.0', predeterminada: true });
    expect(r.audio[1]).toMatchObject({ idioma: 'en', codec: 'opus', titulo: 'Doblaje', predeterminada: false });
    expect(r.subtitulos[0]).toMatchObject({ idioma: 'ja', codec: 'subrip', titulo: '字幕', predeterminada: true });
    expect(r.subtitulos[1]).toMatchObject({ idioma: 'es', codec: 'ass', titulo: '' });
  });

  it('marca los subtítulos que son imágenes', () => {
    expect(r.subtitulos[2].imagen).toBe(true);
    expect(r.subtitulos[0].imagen).toBeUndefined();
  });

  it('un título no se atribuye a la pista siguiente', () => {
    expect(r.subtitulos[1].titulo).toBe('');
  });

  it('acepta archivos sin pistas de interés ni idioma', () => {
    const v = analizarInformeFfmpeg('  Stream #0:0: Video: vp9\n  Stream #0:1: Audio: vorbis, 44100 Hz');
    expect(v.duracionS).toBeNull();
    expect(v.audio[0].idioma).toBe('und');
    expect(v.subtitulos).toEqual([]);
  });
});

describe('extracción de audio', () => {
  it('copia lo que el navegador entiende y recodifica el resto', () => {
    expect(formatoExtraccionAudio('aac').args).toEqual(['-c:a', 'copy']);
    expect(formatoExtraccionAudio('opus').extension).toBe('webm');
    expect(formatoExtraccionAudio('ac3').args).toContain('aac');
  });
});

it('normaliza los códigos de idioma', () => {
  expect(idiomaCorto('JPN')).toBe('ja');
  expect(idiomaCorto('xyz')).toBe('xyz');
});

describe('tramoConSonido', () => {
  it('quita el silencio digital de los extremos', () => {
    const c = new Float32Array(100);
    c[30] = 0.2;
    c[69] = -0.1;
    expect(tramoConSonido([c])).toEqual({ inicio: 30, fin: 70 });
  });

  it('una grabación muda no tiene tramo', () => {
    expect(tramoConSonido([new Float32Array(100)])).toBeNull();
    expect(tramoConSonido([new Float32Array(100).fill(1e-4)])).toBeNull();
  });

  it('el ruido de fondo de una película no cuenta como silencio', () => {
    expect(tramoConSonido([new Float32Array(10).fill(1e-3)])).toEqual({ inicio: 0, fin: 10 });
  });

  it('mira todos los canales', () => {
    const izq = new Float32Array(50);
    const der = new Float32Array(50);
    izq[40] = 0.5;
    der[10] = 0.5;
    expect(tramoConSonido([izq, der])).toEqual({ inicio: 10, fin: 41 });
  });
});

describe('imagenNegra', () => {
  const imagen = (r: number, g: number, b: number, n = 100) => {
    const d = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n; i++) d.set([r, g, b, 255], i * 4);
    return d;
  };

  it('reconoce un fotograma protegido', () => {
    expect(imagenNegra(imagen(0, 0, 0))).toBe(true);
    expect(imagenNegra(imagen(6, 8, 5))).toBe(true);
  });

  it('una imagen con contenido no es negra', () => {
    expect(imagenNegra(imagen(40, 60, 90))).toBe(false);
  });

  it('una escena oscura con algo de luz tampoco', () => {
    const d = imagen(0, 0, 0);
    d.set([200, 200, 200, 255], 0);
    d.set([200, 200, 200, 255], 4);
    expect(imagenNegra(d)).toBe(false);
  });
});
