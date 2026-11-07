// Lo que se le exige a cualquier paquete de lengua, y que el japonés siga diciendo lo mismo de siempre.

import { describe, expect, it } from 'vitest';
import { AJUSTES_INICIALES, completarAjustes } from '../compartido/ajustes';
import { PAQUETE_INICIAL, paqueteDe } from '.';
import { JAPONES } from './japones';
import { motorDe } from './motor';
import type { TareaPrompt } from './tipos';

const PAQUETES = [JAPONES];
const TAREAS: TareaPrompt[] = ['explicar', 'desglosar', 'traducir', 'generar', 'historia', 'preguntar', 'gramatica'];

describe('registro de lenguas', () => {
  it('encuentra una lengua por su código, con o sin región', () => {
    expect(paqueteDe('ja')).toBe(JAPONES);
    expect(paqueteDe('ja-JP')).toBe(JAPONES);
  });

  it('un código desconocido no deja el programa sin lengua', () => {
    expect(paqueteDe('xx')).toBe(PAQUETE_INICIAL);
    expect(paqueteDe('constructor')).toBe(PAQUETE_INICIAL);
    expect(paqueteDe('')).toBe(PAQUETE_INICIAL);
    expect(motorDe('xx')).toBe(motorDe(PAQUETE_INICIAL.id));
  });
});

describe.each(PAQUETES.map((p) => [p.id, p] as const))('paquete %s', (id, p) => {
  it('no deja ningún texto vacío', () => {
    for (const [clave, texto] of Object.entries(p.textos)) expect(texto.trim(), clave).not.toBe('');
  });

  it('sus lecturas iniciales existen', () => {
    const formatos = p.lectura.formatos.map((f) => f.id);
    expect(formatos).toContain(p.lectura.formatoInicial);
    if (p.lectura.formatoSencillo) expect(formatos).toContain(p.lectura.formatoSencillo.id);
  });

  it('sus niveles van de menos a más vocabulario, y el inicial es uno de ellos', () => {
    const palabras = p.niveles.flatMap((n) => n.palabras ?? []);
    expect(palabras.length).toBeGreaterThan(0);
    expect([...palabras].sort((a, b) => a - b)).toEqual(palabras);
    expect(p.niveles.map((n) => n.valor)).toContain(p.nivelInicial);
  });

  it('sus voces son de la lengua, y las iniciales están en la lista', () => {
    for (const v of p.voces) expect(v.id.startsWith(`${p.bcp47}-`), v.id).toBe(true);
    for (const v of p.vocesIniciales) expect(p.voces.map((x) => x.id)).toContain(v);
  });

  it('los signos de frase cortan donde dicen', () => {
    for (const c of p.escritura.frase.cortes.filter((x) => x !== '\n')) expect(p.escritura.frase.fin.test(c), c).toBe(true);
  });

  it('su parte del motor está completa', () => {
    const m = motorDe(id);
    for (const t of TAREAS) {
      expect(m.prompts.base[t].sistema, t).toBeTruthy();
      expect(m.prompts.base[t].usuario, t).toBeTruthy();
    }
    // matchAll exige la marca g: sin ella, partir una frase larga fallaría al primer subtítulo.
    expect(m.transcripcion.reglas.corteSinPuntuacion.global).toBe(true);
    expect(m.transcripcion.idioma).toBeTruthy();
    const ids = m.diccionarios.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(m.diccionarios.some((d) => d.tipo === 'terminos' && d.recomendado)).toBe(true);
  });

  it('si enseña trazos, tiene de dónde sacarlos y a quién dar crédito', () => {
    expect(!!p.trazos).toBe(!!motorDe(id).trazos);
    if (p.trazos) expect(p.trazos.credito.licencia).toBeTruthy();
  });
});

describe('el japonés sigue igual', () => {
  it('quien acaba de instalar empieza con lo de siempre', () => {
    const a = completarAjustes(undefined);
    expect(a.idiomaObjetivo).toBe('ja');
    expect(a.nivel).toBe('JLPT N3');
    expect(a.formatoLectura).toBe('hiragana');
    expect(a.vocesFrase).toEqual(['ja-JP-MasaruMultilingualNeural', 'ja-JP-NanamiNeural']);
    expect(AJUSTES_INICIALES.idiomaObjetivo).toBe(JAPONES.id);
  });

  it('el saludo depende de la hora y lleva el nombre', () => {
    expect(JAPONES.saludo(8, '')).toBe('おはようございます');
    expect(JAPONES.saludo(4, '')).toBe('こんばんは');
    expect(JAPONES.saludo(11, '')).toBe('こんにちは');
    expect(JAPONES.saludo(17, 'Ana')).toBe('こんにちは、Anaさん');
    expect(JAPONES.saludo(18, 'Ana')).toBe('こんばんは、Anaさん');
  });

  it('el nivel se enseña sin el JLPT, y lo demás tal cual', () => {
    expect(JAPONES.nombreNivel('JLPT N3')).toBe('N3');
    expect(JAPONES.nombreNivel('nativo')).toBe('nativo');
  });

  it('las lecturas se pueden buscar solo si son kana', () => {
    expect(JAPONES.lectura.esSoloLectura('たべる')).toBe(true);
    expect(JAPONES.lectura.esSoloLectura('タベル')).toBe(true);
    expect(JAPONES.lectura.esSoloLectura('コーヒー')).toBe(true);
    expect(JAPONES.lectura.esSoloLectura('食べる')).toBe(false);
    expect(JAPONES.lectura.esSoloLectura('abc')).toBe(false);
  });

  it('el rōmaji es más estrecho que el kana', () => {
    expect(JAPONES.lectura.anchoCaracter('romaji')).toBe(0.55);
    expect(JAPONES.lectura.anchoCaracter('hiragana')).toBe(1);
    expect(JAPONES.lectura.anchoCaracter('katakana')).toBe(1);
  });

  it('una selección corta sin signos es una palabra, no una frase', () => {
    expect(JAPONES.escritura.pareceFrase('食べる')).toBe(false);
    expect(JAPONES.escritura.pareceFrase('食べた。')).toBe(true);
    expect(JAPONES.escritura.pareceFrase('今日は天気がとてもいいので公園へ')).toBe(true);
  });

  it('el enlace a JapanDict abre justo la acepción de JMdict', () => {
    const japandict = JAPONES.enlaces.find((e) => e.nombre === 'JapanDict')!;
    const entrada = (dic: string, seq?: number) => ({ dic, dicTitulo: dic, termino: '猫', lectura: 'ねこ', glosas: [], tags: [], seq });
    expect(japandict.url('猫', [entrada('otro', 7), entrada('jmdict-es', 1467640)])).toBe('https://www.japandict.com/%E7%8C%AB#entry-1467640');
    expect(japandict.url('猫', [entrada('otro', 7)])).toBe('https://www.japandict.com/%E7%8C%AB');
  });

  it('las portadas de la biblioteca se escriben en vertical', () => {
    expect(JAPONES.escritura.portadaVertical).toBe(true);
  });
});
