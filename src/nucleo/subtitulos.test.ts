import { describe, expect, it } from 'vitest';
import {
  analizarSubtitulos,
  aSrt,
  detectarFormato,
  esSoloAcotacion,
  lineaEn,
  normalizar,
  siguienteLinea,
} from './subtitulos';

describe('detectarFormato', () => {
  it('reconoce cada formato', () => {
    expect(detectarFormato('WEBVTT\n\n00:00.000 --> 00:01.000\nhola')).toBe('vtt');
    expect(detectarFormato('1\n00:00:01,000 --> 00:00:02,000\nhola')).toBe('srt');
    expect(detectarFormato('{"wireMagic":"pb3","events":[]}')).toBe('json3');
    expect(detectarFormato('<?xml version="1.0"?><tt xmlns="x"></tt>')).toBe('ttml');
    expect(detectarFormato('[Script Info]\nTitle: x')).toBe('ass');
    expect(detectarFormato('<timedtext format="3"></timedtext>')).toBe('srv3');
    expect(detectarFormato('cualquier cosa')).toBeNull();
  });
});

describe('WebVTT', () => {
  it('lee tiempos, etiquetas, rubí y entidades', () => {
    const vtt = `WEBVTT

1
00:00:01.000 --> 00:00:03.500 line:90%
<c.japanese>咲いた<ruby>花<rt>はな</rt></ruby>&lrm;</c>
&amp;泥

00:04.000 --> 00:05.000 line:10%
上の文字
`;
    const l = analizarSubtitulos(vtt);
    expect(l).toHaveLength(2);
    expect(l[0]).toMatchObject({ id: 0, inicio: 1000, fin: 3500, texto: '咲いた花\n&泥' });
    expect(l[0].arriba).toBeUndefined();
    expect(l[1]).toMatchObject({ inicio: 4000, fin: 5000, arriba: true });
  });
});

describe('SRT', () => {
  it('lee etiquetas y posición', () => {
    const srt = '﻿1\r\n00:00:01,000 --> 00:00:02,000\r\n<i>{\\an8}こんにちは</i>\r\n\r\n2\r\n00:00:03,000 --> 00:00:04,000\r\nさようなら\r\n';
    const l = analizarSubtitulos(srt);
    expect(l.map((x) => x.texto)).toEqual(['こんにちは', 'さようなら']);
    expect(l[0].arriba).toBe(true);
  });
});

describe('ASS', () => {
  it('respeta la columna de texto y quita las órdenes', () => {
    const ass = `[Script Info]
Title: x

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Comment: 0,0:00:00.00,0:00:01.00,Default,,0,0,0,,no
Dialogue: 0,0:00:01.50,0:00:03.00,Default,,0,0,0,,{\\an8}猫が,鳴いた\\N二行目
`;
    const l = analizarSubtitulos(ass);
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ inicio: 1500, fin: 3000, texto: '猫が,鳴いた\n二行目', arriba: true });
  });
});

describe('json3 de YouTube', () => {
  it('une segmentos y recorta el solape de los subtítulos automáticos', () => {
    const j = JSON.stringify({
      wireMagic: 'pb3',
      events: [
        { tStartMs: 0, dDurationMs: 5000, segs: [{ utf8: '起きる、' }, { utf8: '朝ご飯' }] },
        { tStartMs: 1000, dDurationMs: 100, aAppend: 1, segs: [{ utf8: '\n' }] },
        { tStartMs: 3000, dDurationMs: 2000, segs: [{ utf8: '歯を磨く' }] },
        { tStartMs: 6000, segs: [{ utf8: '\n' }] },
      ],
    });
    const l = analizarSubtitulos(j);
    expect(l).toHaveLength(2);
    expect(l[0]).toMatchObject({ inicio: 0, fin: 3000, texto: '起きる、朝ご飯' });
    expect(l[1]).toMatchObject({ inicio: 3000, fin: 5000, texto: '歯を磨く' });
  });
});

describe('TTML de Netflix', () => {
  it('convierte ticks, separa líneas y descarta el texto de rubí', () => {
    const ttml = `<?xml version="1.0" encoding="UTF-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttp="http://www.w3.org/ns/ttml#parameter" xmlns:tts="http://www.w3.org/ns/ttml#styling" ttp:tickRate="10000000" ttp:frameRate="24" ttp:frameRateMultiplier="1000 1001" xml:lang="ja">
<head><styling>
<style xml:id="base" tts:ruby="base"/>
<style xml:id="rt" tts:ruby="text"/>
</styling><layout>
<region xml:id="abajo" tts:displayAlign="after"/>
<region xml:id="arriba" tts:displayAlign="before"/>
</layout></head>
<body><div>
<p begin="10000000t" end="25000000t" region="abajo"><span style="base">食</span><span style="rt">た</span>べる<br/>赤と青&amp;の</p>
<p begin="00:00:04.000" end="00:00:05:12" region="arriba">看板</p>
</div></body></tt>`;
    const l = analizarSubtitulos(ttml);
    expect(l).toHaveLength(2);
    expect(l[0]).toMatchObject({ inicio: 1000, fin: 2500, texto: '食べる\n赤と青&の' });
    expect(l[0].arriba).toBeUndefined();
    expect(l[1].arriba).toBe(true);
    expect(l[1].fin).toBe(5501);
  });
});

describe('srv3', () => {
  it('lee los párrafos con sus segmentos', () => {
    const l = analizarSubtitulos('<timedtext format="3"><body><p t="100" d="900"><s>猫</s><s>だ</s></p></body></timedtext>');
    expect(l[0]).toMatchObject({ inicio: 100, fin: 1000, texto: '猫だ' });
  });
});

describe('normalizar', () => {
  it('une bloques simultáneos y repeticiones contiguas, ordena y descarta vacíos', () => {
    const l = normalizar([
      { inicio: 5000, fin: 6000, texto: '後' },
      { inicio: 0, fin: 1000, texto: 'あ' },
      { inicio: 0, fin: 1000, texto: 'い' },
      { inicio: 1000, fin: 2000, texto: '同じ' },
      { inicio: 2050, fin: 3000, texto: '同じ' },
      { inicio: 3100, fin: 3100, texto: 'duración cero' },
      { inicio: 4000, fin: 4500, texto: '  \n ' },
    ]);
    expect(l.map((x) => x.texto)).toEqual(['あ\nい', '同じ', '後']);
    expect(l[1].fin).toBe(3000);
    expect(l.map((x) => x.id)).toEqual([0, 1, 2]);
  });
});

describe('utilidades', () => {
  const lineas = normalizar([
    { inicio: 1000, fin: 2000, texto: 'a' },
    { inicio: 3000, fin: 4000, texto: 'b' },
  ]);

  it('encuentra la línea activa', () => {
    expect(lineaEn(lineas, 500)).toBe(-1);
    expect(lineaEn(lineas, 1000)).toBe(0);
    expect(lineaEn(lineas, 2000)).toBe(-1);
    expect(lineaEn(lineas, 3500)).toBe(1);
  });

  it('encuentra la línea siguiente', () => {
    expect(siguienteLinea(lineas, 0)).toBe(0);
    expect(siguienteLinea(lineas, 1500)).toBe(1);
    expect(siguienteLinea(lineas, 3500)).toBe(-1);
  });

  it('reconoce acotaciones', () => {
    expect(esSoloAcotacion('（笑）')).toBe(true);
    expect(esSoloAcotacion('♪〜')).toBe(true);
    expect(esSoloAcotacion('［拍手］\n（歓声）')).toBe(true);
    expect(esSoloAcotacion('（佐藤）おはよう')).toBe(false);
  });

  it('exporta a SRT', () => {
    expect(aSrt(lineas)).toContain('00:00:01,000 --> 00:00:02,000');
  });
});
