import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fijarIdioma, fijarTablaPrueba, IDIOMAS_INTERFAZ, idiomaActual, numero, resolverIdioma, tr } from './i18n';
// @ts-expect-error: herramienta de Node, sin tipos.
import { IDIOMAS, leerTabla, revisar, textosDelCodigo } from '../../herramientas/idiomas.mjs';

describe('resolverIdioma', () => {
  it('respeta lo elegido', () => {
    expect(resolverIdioma('de', 'ja-JP')).toBe('de');
  });

  it('en automático sigue al navegador', () => {
    expect(resolverIdioma('auto', 'ko-KR')).toBe('ko');
    expect(resolverIdioma('auto', 'zh-TW')).toBe('zh');
    expect(resolverIdioma(undefined, 'es-MX')).toBe('es');
  });

  it('con un idioma que no tiene, va en inglés', () => {
    expect(resolverIdioma('auto', 'fr-FR')).toBe('en');
    expect(resolverIdioma('klingon', 'pt-BR')).toBe('en');
  });
});

describe('tr', () => {
  afterEach(() => fijarTablaPrueba('es', null));

  it('sin traducción, se ve el original', () => {
    fijarTablaPrueba('de', {});
    expect(tr('Hola')).toBe('Hola');
  });

  it('sustituye los valores, aunque el idioma los ponga en otro orden', () => {
    fijarTablaPrueba('ko', { '{0} de {1} líneas': '{1}줄 중 {0}줄' });
    expect(tr('{0} de {1} líneas', 3, 10)).toBe('10줄 중 3줄');
  });

  it('formatea los números según el idioma', () => {
    fijarTablaPrueba('de', {});
    expect(numero(1234.5)).toBe('1.234,5');
    fijarTablaPrueba('en', {});
    expect(numero(1234.5)).toBe('1,234.5');
    expect(numero(null)).toBeUndefined();
  });
});

describe('fijarIdioma', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    fijarTablaPrueba('es', null);
  });

  it('si se piden dos seguidos, manda el último aunque el primero tarde más', async () => {
    const respuestas = new Map<string, (t: Record<string, string>) => void>();
    vi.stubGlobal('chrome', { runtime: { getURL: (p: string) => p } });
    vi.stubGlobal('fetch', (url: string) => new Promise((ok) => {
      respuestas.set(url, (t) => ok({ json: async () => t }));
    }));
    const lento = fijarIdioma('ja');
    const rapido = fijarIdioma('de');
    await vi.waitFor(() => expect(respuestas.size).toBe(2));
    respuestas.get('idiomas/de.json')!({ Hola: 'Hallo' });
    await rapido;
    expect(idiomaActual()).toBe('de');
    respuestas.get('idiomas/ja.json')!({ Hola: 'こんにちは' });
    await lento;
    expect(idiomaActual()).toBe('de');
    expect(tr('Hola')).toBe('Hallo');
  });
});

describe('tablas de traducción', () => {
  const textos = textosDelCodigo() as string[];

  it('hay muchos textos, para saber que la búsqueda funciona', () => {
    expect(textos.length).toBeGreaterThan(1000);
  });

  it('están todos los idiomas de la interfaz', () => {
    expect([...IDIOMAS].sort()).toEqual(IDIOMAS_INTERFAZ.map((i) => i.id).filter((id) => id !== 'es').sort());
  });

  for (const id of IDIOMAS as string[]) {
    describe(id, () => {
      const r = revisar(textos, leerTabla(id));

      it('tiene todos los textos', () => {
        expect(r.faltan).toEqual([]);
      });

      it('conserva los valores que se sustituyen', () => {
        expect(r.marcasMal).toEqual([]);
      });

      it('no guarda textos que ya no existen', () => {
        expect(r.sobran).toEqual([]);
      });

      it('no tiene traducciones vacías', () => {
        const tabla = leerTabla(id) as Record<string, string>;
        expect(Object.entries(tabla).filter(([, v]) => !v.trim()).map(([k]) => k)).toEqual([]);
      });
    });
  }

  it('el archivo de cada idioma es JSON válido y en UTF-8', () => {
    for (const id of IDIOMAS as string[]) {
      const crudo = readFileSync(join(import.meta.dirname, '..', '..', 'idiomas', `${id}.json`), 'utf8');
      expect(() => JSON.parse(crudo)).not.toThrow();
      expect(crudo.includes('�')).toBe(false);
    }
  });
});
