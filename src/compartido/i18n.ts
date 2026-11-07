// Idioma de la interfaz. El texto en español es la clave: si falta una traducción, se ve en español.
// Las tablas se cargan por separado: cada idioma pesa decenas de KB, y el content script corre en todas las páginas.

import { signal } from '@preact/signals-core';

export const IDIOMAS_INTERFAZ = [
  { id: 'es', nombre: 'Español', ingles: 'Spanish', bcp47: 'es', pregunta: '¿Qué idioma hablas?' },
  { id: 'en', nombre: 'English', ingles: 'English', bcp47: 'en', pregunta: 'What language do you speak?' },
  { id: 'de', nombre: 'Deutsch', ingles: 'German', bcp47: 'de', pregunta: 'Welche Sprache sprichst du?' },
  { id: 'zh', nombre: '简体中文', ingles: 'Simplified Chinese', bcp47: 'zh-CN', pregunta: '你说哪种语言？' },
  { id: 'ko', nombre: '한국어', ingles: 'Korean', bcp47: 'ko', pregunta: '어떤 언어를 사용하시나요?' },
  { id: 'ja', nombre: '日本語', ingles: 'Japanese', bcp47: 'ja', pregunta: '何語を話しますか？' },
] as const;

export type CodigoIdioma = (typeof IDIOMAS_INTERFAZ)[number]['id'];
export type PreferenciaIdioma = CodigoIdioma | 'auto';

const CODIGOS = IDIOMAS_INTERFAZ.map((i) => i.id) as readonly string[];

/** El idioma real a partir de lo elegido. En automático sigue al navegador, y si no lo hay, va en inglés. */
export function resolverIdioma(preferencia: string | undefined, navegador?: string): CodigoIdioma {
  if (preferencia && preferencia !== 'auto' && CODIGOS.includes(preferencia)) return preferencia as CodigoIdioma;
  const base = (navegador ?? (typeof navigator !== 'undefined' ? navigator.language : 'en')).toLowerCase().split('-')[0];
  return (CODIGOS.includes(base) ? base : 'en') as CodigoIdioma;
}

const tabla = signal<Record<string, string> | null>(null);
const idioma = signal<CodigoIdioma>('es');
const cargadas = new Map<CodigoIdioma, Record<string, string>>();

export const idiomaActual = () => idioma.value;
export const bcp47Actual = () => IDIOMAS_INTERFAZ.find((i) => i.id === idioma.value)?.bcp47 ?? 'es';

let ultimaPeticion = 0;

/** Trae la tabla del idioma. Si no se pudiera, la interfaz sigue en español: es molesto, pero no rompe nada. */
export async function fijarIdioma(preferencia: string | undefined): Promise<CodigoIdioma> {
  const id = resolverIdioma(preferencia);
  const peticion = ++ultimaPeticion;
  if (id === idioma.value && (id === 'es' || tabla.value)) return id;
  if (id !== 'es' && !cargadas.has(id)) {
    try {
      const r = await fetch(chrome.runtime.getURL(`idiomas/${id}.json`));
      cargadas.set(id, (await r.json()) as Record<string, string>);
    } catch (e) {
      console.warn('Kotonoha: no se cargó el idioma', id, e);
    }
  }
  // Mientras llegaba pudo pedirse otro: manda el último, aunque esta tabla tarde más en llegar.
  if (peticion !== ultimaPeticion) return idioma.value;
  tabla.value = id === 'es' ? null : (cargadas.get(id) ?? null);
  idioma.value = id;
  return id;
}

/**
 * Lenguas en las que Claude puede explicar y traducir. `valor` es lo que se guarda en los ajustes y entra en los
 * prompts en español: cambiarlo invalidaría las respuestas ya guardadas y se pagarían otra vez.
 */
export const LENGUAS = [
  { id: 'es', valor: 'español', nombre: tm('Español'), ingles: 'Spanish', explica: true, traduce: true },
  { id: 'en', valor: 'inglés', nombre: tm('Inglés'), ingles: 'English', explica: true, traduce: true },
  { id: 'de', valor: 'alemán', nombre: tm('Alemán'), ingles: 'German', explica: true, traduce: true },
  { id: 'zh', valor: 'chino simplificado', nombre: tm('Chino simplificado'), ingles: 'Simplified Chinese', explica: true, traduce: true },
  { id: 'ko', valor: 'coreano', nombre: tm('Coreano'), ingles: 'Korean', explica: true, traduce: true },
  { id: 'pt', valor: 'portugués', nombre: tm('Portugués'), ingles: 'Portuguese', explica: true, traduce: true },
  { id: 'fr', valor: 'francés', nombre: tm('Francés'), ingles: 'French', explica: true, traduce: true },
  { id: 'ja', valor: 'japonés', nombre: tm('Japonés'), ingles: 'Japanese', explica: true, traduce: true },
  // Para quien estudia la lengua en la que habla: en ella, solo tiene sentido explicar con palabras sencillas.
  { id: 'ja', valor: 'japonés sencillo', nombre: tm('Japonés sencillo'), ingles: 'simple Japanese', explica: true, traduce: false, sencilla: true },
  { id: 'en', valor: 'inglés sencillo', nombre: tm('Inglés sencillo'), ingles: 'simple English', explica: true, traduce: false, sencilla: true },
] as const;

const esSencilla = (l: (typeof LENGUAS)[number]) => 'sencilla' in l;

/** En qué lenguas se le puede explicar algo a quien estudia `objetivo`. */
export const lenguasExplicacion = (objetivo: string) => LENGUAS.filter((l) => l.explica && (l.id === objetivo) === esSencilla(l));

/** A qué lenguas puede traducir quien estudia `objetivo`: a esa misma no tiene sentido. */
export const lenguasTraduccion = (objetivo: string) => LENGUAS.filter((l) => l.traduce && l.id !== objetivo);

/**
 * Lo que conviene por omisión según el idioma que habla y la lengua que estudia. Si son la misma, explicaciones
 * sencillas en ella y traducción a otra: al inglés, o al español si es el inglés lo que estudia.
 */
export const lenguaDe = (idioma: CodigoIdioma, objetivo = 'ja') => {
  if (idioma === objetivo) {
    const sencilla = LENGUAS.find((l) => l.id === idioma && esSencilla(l)) ?? LENGUAS[1];
    const otra = idioma === 'en' ? LENGUAS[0] : LENGUAS[1];
    return { explicaciones: sencilla.valor, traducciones: otra.valor, secundaria: otra.id };
  }
  const propia = LENGUAS.find((l) => l.id === idioma && !esSencilla(l)) ?? LENGUAS[1];
  return { explicaciones: propia.valor, traducciones: propia.valor, secundaria: idioma };
};

/** Nombre en inglés de una lengua guardada, para los prompts en inglés. */
export const lenguaEnIngles = (valor: string) => LENGUAS.find((l) => l.valor === valor)?.ingles ?? valor;

/** Solo para las pruebas: usa una tabla ya en memoria. */
export function fijarTablaPrueba(id: CodigoIdioma, t: Record<string, string> | null) {
  tabla.value = t;
  idioma.value = id;
}

/**
 * Traduce un texto. Los valores sustituyen a {0}, {1}... en el orden en que se pasan.
 * Leer la tabla aquí hace que un componente que traduce se vuelva a pintar al cambiar de idioma.
 */
export function tr(fuente: string, ...valores: unknown[]): string {
  const texto = tabla.value?.[fuente] ?? fuente;
  if (!valores.length) return texto;
  return texto.replace(/\{(\d+)\}/g, (m, i) => {
    const v = valores[Number(i)];
    return v === undefined || v === null ? '' : String(v);
  });
}

/** Marca un texto de una tabla del módulo: aún no se puede traducir aquí, y se traduce con tr() al mostrarlo. */
export function tm(fuente: string): string {
  return fuente;
}

/** El número en el formato del idioma de la interfaz. */
export function numero(n: number, opciones?: Intl.NumberFormatOptions): string;
export function numero(n: number | null | undefined, opciones?: Intl.NumberFormatOptions): string | undefined;
export function numero(n: number | null | undefined, opciones?: Intl.NumberFormatOptions) {
  return n === null || n === undefined ? undefined : n.toLocaleString(bcp47Actual(), opciones);
}
