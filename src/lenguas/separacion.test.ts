// Que lo propio de una lengua siga en su paquete: si algo nuevo escribe japonés fuera de él, esta prueba lo señala
// antes de que estorbe a las demás lenguas. El inglés no se puede buscar así: comparte alfabeto con el código.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(import.meta.dirname, '..');

function archivos(carpeta: string): string[] {
  return readdirSync(carpeta, { withFileTypes: true }).flatMap((e) => {
    const ruta = join(carpeta, e.name);
    if (e.isDirectory()) return e.name === 'japones' || e.name === 'ingles' ? [] : archivos(ruta);
    return /\.tsx?$/.test(e.name) && !/\.test\.|\.d\.ts$|-datos\.ts$/.test(e.name) ? [ruta] : [];
  });
}

/** Las líneas de código, sin comentarios: un ejemplo en japonés dentro de un comentario no molesta a nadie. */
function lineasDeCodigo(ruta: string): { n: number; texto: string }[] {
  return readFileSync(ruta, 'utf8')
    .split(/\r?\n/)
    .map((l, i) => ({ n: i + 1, texto: l.replace(/\/\/ .*$/, '') }))
    .filter((l) => !/^\s*(\/\*|\*)/.test(l.texto));
}

const buscar = (patron: RegExp, permitidos: Record<string, RegExp>) =>
  archivos(SRC).flatMap((ruta) => {
    const nombre = relative(SRC, ruta).replace(/\\/g, '/');
    return lineasDeCodigo(ruta)
      .filter((l) => patron.test(l.texto) && !permitidos[nombre]?.test(l.texto))
      .map((l) => `${nombre}:${l.n}: ${l.texto.trim().slice(0, 100)}`);
  });

describe('lo japonés está en su paquete', () => {
  it('no hay texto japonés en el resto del programa', () => {
    const encontrados = buscar(/[぀-ヿ一-鿿]/, {
      // El nombre del programa y de dónde viene: es japonés se estudie lo que se estudie.
      'ui/marca.tsx': /言の葉/,
      'app/Pantallas.tsx': /<blockquote lang=\{LENGUA_DE_LA_MARCA\}>/,
      // Los idiomas de la interfaz, cada uno escrito en sí mismo.
      'compartido/i18n.ts': /nombre: '(简体中文|日本語)'/,
      // Una palabra para comprobar que Claude responde, sea cual sea la lengua.
      'motor/ia.ts': /接続/,
    });
    expect(encontrados).toEqual([]);
  });

  it('ninguna frase de la interfaz nombra el japonés o su escritura fuera del paquete', () => {
    const encontrados = buscar(/\bt[rm]\('[^']*(jap[oó]n|kanji|furigana|\bkana\b|hiragana|r[oō]maji|JLPT)/i, {
      // La tabla de idiomas de las pistas, y los idiomas en que Claude puede explicar: los nombra a todos.
      'contenido/controlador.ts': /tr\('Japonés'\), es: tr\('Español'\)/,
      'compartido/i18n.ts': /tm\('Japonés( sencillo)?'\)/,
      // Sobre el nombre del programa.
      'app/Pantallas.tsx': /tr\('La poesía de Japón/,
    });
    expect(encontrados).toEqual([]);
  });

  it('los módulos del japonés solo se importan desde su registro', () => {
    expect(buscar(/from '[^']*lenguas\/(japones|ingles)/, {})).toEqual([]);
  });
});
