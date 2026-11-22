import { describe, expect, it } from 'vitest';
import { coincide, esZonaDeMusica, idDeVideo, idiomaDeBilibili, tituloDePagina, urlDeVideo, videoDeUrl, vttDeBilibili } from './bilibili';

describe('las lenguas de Bilibili', () => {
  it('las de su IA llevan «ai-» delante: se quita, y la pista queda como automática', () => {
    expect(idiomaDeBilibili('ai-zh')).toEqual({ idioma: 'zh', automatica: true });
    expect(idiomaDeBilibili('ai-ja')).toEqual({ idioma: 'ja', automatica: true });
    expect(idiomaDeBilibili('zh-CN')).toEqual({ idioma: 'zh-cn', automatica: false });
    expect(idiomaDeBilibili('zh-Hant')).toEqual({ idioma: 'zh-hant', automatica: false });
    expect(idiomaDeBilibili('en_US')).toEqual({ idioma: 'en-us', automatica: false });
  });
});

describe('sus subtítulos', () => {
  const json = JSON.stringify({
    font_size: 0.4,
    lang: 'zh',
    body: [
      { from: 0.34, to: 1.7, sid: 1, location: 2, content: '出俊对阵', music: 0 },
      { from: 2.7, to: 6.14, sid: 2, location: 2, content: '  我们今天去银行 ', music: 0 },
      { from: 7, to: 7, sid: 3, location: 2, content: 'vacía, sin duración', music: 0 },
      { from: 8, to: 9.5, sid: 4, location: 2, content: '   ', music: 1 },
      { from: 3725.25, to: 3726, sid: 5, location: 2, content: '一小时后', music: 0 },
    ],
  });

  it('el JSON de su CDN pasa a WebVTT, sin las líneas vacías ni las que no duran nada', () => {
    expect(vttDeBilibili(json)).toBe(
      'WEBVTT\n\n00:00:00.340 --> 00:00:01.700\n出俊对阵\n\n00:00:02.700 --> 00:00:06.140\n我们今天去银行\n\n01:02:05.250 --> 01:02:06.000\n一小时后\n'
    );
  });

  it('lo que no es su JSON queda tal cual', () => {
    const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nhola\n';
    expect(vttDeBilibili(vtt)).toBe(vtt);
    expect(vttDeBilibili('{"body": roto')).toBe('{"body": roto');
    expect(vttDeBilibili('{"body": "no es una lista"}')).toBe('{"body": "no es una lista"}');
  });
});

describe('el nombre de cada video', () => {
  it('sin lo que añade la página para seguirla, y con la parte desde la segunda', () => {
    expect(videoDeUrl('https://www.bilibili.com/video/BV1vwyizXE7N/?spm_id_from=333.1007&vd_source=4bdf')).toEqual({ bvid: 'BV1vwyizXE7N', p: 1 });
    expect(videoDeUrl('https://www.bilibili.com/es/video/BV1vwyizXE7N/?p=3')).toEqual({ bvid: 'BV1vwyizXE7N', p: 3 });
    expect(videoDeUrl('https://www.bilibili.com/list/ml1234?bvid=BV1vwyizXE7N&oid=1')).toEqual({ bvid: 'BV1vwyizXE7N', p: 1 });
    expect(videoDeUrl('https://www.bilibili.com/bangumi/play/ep779775?from_spmid=666')).toEqual({ episodeId: 779775 });
    expect(videoDeUrl('https://www.bilibili.com/bangumi/play/ss46089')).toBeNull();
    expect(videoDeUrl('https://www.bilibili.com/')).toBeNull();
    expect(idDeVideo({ bvid: 'BV1vwyizXE7N', p: 1 })).toBe('BV1vwyizXE7N');
    expect(idDeVideo({ bvid: 'BV1vwyizXE7N', p: 2 })).toBe('BV1vwyizXE7N?p=2');
    expect(idDeVideo({ bvid: 'BV18j411i7iu', episodeId: 779775 })).toBe('ep779775');
    expect(idDeVideo({})).toBeNull();
  });

  it('y su dirección limpia', () => {
    expect(urlDeVideo('BV1vwyizXE7N?p=2')).toBe('https://www.bilibili.com/video/BV1vwyizXE7N?p=2');
    expect(urlDeVideo('ep779775')).toBe('https://www.bilibili.com/bangumi/play/ep779775');
  });

  it('tras cambiar de parte, el reproductor no vale hasta que está en la de la dirección', () => {
    expect(coincide({ bvid: 'BV1vwyizXE7N', p: 1 }, { bvid: 'BV1vwyizXE7N', p: 2 })).toBe(false);
    expect(coincide({ bvid: 'BV1vwyizXE7N', p: 2 }, { bvid: 'BV1vwyizXE7N', p: 2 })).toBe(true);
    expect(coincide({ bvid: 'BV18j411i7iu', episodeId: 779776 }, { episodeId: 779775 })).toBe(false);
    expect(coincide({ bvid: 'BV18j411i7iu', episodeId: 779775 }, { episodeId: 779775 })).toBe(true);
    // Sin nada en la dirección (una página especial), vale lo que diga.
    expect(coincide({ bvid: 'BV1vwyizXE7N' }, null)).toBe(true);
  });
});

describe('el título y la zona', () => {
  it('el título de la página, sin lo que añade Bilibili', () => {
    expect(tituloDePagina('楚钧：和Knight线下solo一局！_哔哩哔哩_bilibili')).toBe('楚钧：和Knight线下solo一局！');
    expect(tituloDePagina('葬送的芙莉莲-番剧-全集-高清正版在线观看-bilibili-哔哩哔哩')).toBe('葬送的芙莉莲');
  });

  it('las zonas de música, para transcribir con el modelo de las canciones', () => {
    expect(esZonaDeMusica(31)).toBe(true);
    expect(esZonaDeMusica(171)).toBe(false);
    expect(esZonaDeMusica(undefined)).toBe(false);
  });
});
