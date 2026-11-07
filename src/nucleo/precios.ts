// Lo que cuesta cada petición a Claude, a partir de los tokens que la API dice haber usado.
// Precios en dólares por millón de tokens.

import { tm } from '../compartido/i18n';
export interface UsoTokens {
  entrada: number;
  salida: number;
  cacheEscritura5m: number;
  cacheEscritura1h: number;
  cacheLectura: number;
}

export interface PrecioModelo {
  nombre: string;
  entrada: number;
  salida: number;
  escritura5m: number;
  escritura1h: number;
  lectura: number;
}

const PRECIOS: Record<string, PrecioModelo> = {
  'claude-sonnet-5-5': { nombre: 'Sonnet 5.5', entrada: 2, salida: 10, escritura5m: 2.5, escritura1h: 4, lectura: 0.2 },
  'claude-opus-5-5': { nombre: 'Opus 5.5', entrada: 4, salida: 20, escritura5m: 5, escritura1h: 8, lectura: 0.2 },
  'claude-haiku-5-5': { nombre: 'Haiku 5.5', entrada: 0.1, salida: 0.5, escritura5m: 0.125, escritura1h: 0.2, lectura: 0.01 },
};

/** La API puede responder con el nombre del modelo y su fecha: basta con el principio. */
export function precioDe(modelo: string): PrecioModelo {
  const clave = Object.keys(PRECIOS).find((k) => modelo.startsWith(k));
  return clave ? PRECIOS[clave] : { ...PRECIOS['claude-sonnet-5-5'], nombre: modelo };
}

export const nombreModelo = (modelo: string) => precioDe(modelo).nombre;

export function costeDe(modelo: string, u: UsoTokens): number {
  const p = precioDe(modelo);
  return (u.entrada * p.entrada + u.salida * p.salida + u.cacheEscritura5m * p.escritura5m + u.cacheEscritura1h * p.escritura1h + u.cacheLectura * p.lectura) / 1e6;
}

export const totalTokens = (u: UsoTokens) => u.entrada + u.salida + u.cacheEscritura5m + u.cacheEscritura1h + u.cacheLectura;

// ---------- Registro ----------

export interface FilaConsumo extends UsoTokens {
  id?: number;
  /** Instante de la petición, en milisegundos. */
  t: number;
  /** Día y mes locales, para agrupar sin depender de la zona horaria al consultar. */
  dia: string;
  mes: string;
  tarea: string;
  modelo: string;
  coste: number;
  titulo?: string;
}

const dos = (n: number) => String(n).padStart(2, '0');
export const claveDia = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
};
export const claveMes = (t: number) => claveDia(t).slice(0, 7);

export const NOMBRE_TAREA: Record<string, string> = {
  explicar: tm('Explicación de una palabra'),
  desglosar: tm('Desglose de una frase'),
  traducir: tm('Traducción de una frase'),
  generar: tm('Texto para una tarjeta'),
  subtitulos: tm('Traducción de subtítulos'),
  historia: tm('Relato'),
  preguntar: tm('Pregunta libre'),
  sentido: tm('Significado en la frase'),
  analisis: tm('Revisión de lecturas y gramática'),
  corregir: tm('Corrección de subtítulos'),
  letra: tm('Ajuste de letras'),
  profundo: tm('Análisis a fondo'),
  conexion: tm('Prueba de conexión'),
};

export interface GrupoConsumo extends UsoTokens {
  clave: string;
  nombre: string;
  coste: number;
  peticiones: number;
}

export interface DiaConsumo {
  dia: string;
  coste: number;
  porModelo: Record<string, number>;
}

export interface ResumenConsumo extends UsoTokens {
  mes: string;
  coste: number;
  peticiones: number;
  porModelo: GrupoConsumo[];
  porTarea: GrupoConsumo[];
  porDia: DiaConsumo[];
}

const usoVacio = (): UsoTokens => ({ entrada: 0, salida: 0, cacheEscritura5m: 0, cacheEscritura1h: 0, cacheLectura: 0 });

function sumarUso(a: UsoTokens, b: UsoTokens) {
  a.entrada += b.entrada;
  a.salida += b.salida;
  a.cacheEscritura5m += b.cacheEscritura5m;
  a.cacheEscritura1h += b.cacheEscritura1h;
  a.cacheLectura += b.cacheLectura;
}

function agrupar(filas: FilaConsumo[], clave: (f: FilaConsumo) => string, nombre: (c: string) => string): GrupoConsumo[] {
  const grupos = new Map<string, GrupoConsumo>();
  for (const f of filas) {
    const c = clave(f);
    let g = grupos.get(c);
    if (!g) {
      g = { clave: c, nombre: nombre(c), coste: 0, peticiones: 0, ...usoVacio() };
      grupos.set(c, g);
    }
    g.coste += f.coste;
    g.peticiones++;
    sumarUso(g, f);
  }
  return [...grupos.values()].sort((a, b) => b.coste - a.coste);
}

/** Días que tiene un mes dado como 2026-11. */
export function diasDelMes(mes: string): string[] {
  const [a, m] = mes.split('-').map(Number);
  const total = new Date(a, m, 0).getDate();
  return Array.from({ length: total }, (_, i) => `${mes}-${dos(i + 1)}`);
}

export function resumirConsumo(filas: FilaConsumo[], mes: string): ResumenConsumo {
  const delMes = filas.filter((f) => f.mes === mes);
  const total = usoVacio();
  let coste = 0;
  const dias = new Map<string, DiaConsumo>(diasDelMes(mes).map((d) => [d, { dia: d, coste: 0, porModelo: {} }]));
  for (const f of delMes) {
    sumarUso(total, f);
    coste += f.coste;
    const d = dias.get(f.dia);
    if (d) {
      d.coste += f.coste;
      d.porModelo[nombreModelo(f.modelo)] = (d.porModelo[nombreModelo(f.modelo)] ?? 0) + f.coste;
    }
  }
  return {
    mes,
    coste,
    peticiones: delMes.length,
    ...total,
    porModelo: agrupar(delMes, (f) => nombreModelo(f.modelo), (c) => c),
    porTarea: agrupar(delMes, (f) => f.tarea, (c) => NOMBRE_TAREA[c] ?? c),
    porDia: [...dias.values()],
  };
}

export interface EntradaRegistro {
  inicio: number;
  tarea: string;
  titulo?: string;
  modelos: string[];
  peticiones: number;
  tokens: number;
  coste: number;
}

/** Una traducción son varias peticiones seguidas: en el registro se ven como una sola línea. */
export function agruparRegistro(filas: FilaConsumo[], ventanaMs = 10 * 60 * 1000): EntradaRegistro[] {
  const orden = [...filas].sort((a, b) => b.t - a.t);
  const salida: EntradaRegistro[] = [];
  for (const f of orden) {
    const ultima = salida[salida.length - 1];
    const modelo = nombreModelo(f.modelo);
    if (ultima && ultima.tarea === f.tarea && ultima.titulo === f.titulo && ultima.inicio - f.t <= ventanaMs) {
      ultima.inicio = f.t;
      ultima.peticiones++;
      ultima.tokens += totalTokens(f);
      ultima.coste += f.coste;
      if (!ultima.modelos.includes(modelo)) ultima.modelos.push(modelo);
    } else {
      salida.push({ inicio: f.t, tarea: f.tarea, titulo: f.titulo, modelos: [modelo], peticiones: 1, tokens: totalTokens(f), coste: f.coste });
    }
  }
  return salida;
}

/** Cifras legibles: 1 234 → 1.2 K, 3 450 000 → 3.5 M. */
export function tokensLegibles(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)} M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)} K`;
  return String(n);
}

/** Dólares con los decimales que hagan falta: una petición suele costar menos de un centavo. */
export function dolares(n: number): string {
  if (n === 0) return 'USD 0';
  if (n < 0.01) return `USD ${n.toFixed(4)}`;
  return `USD ${n.toFixed(2)}`;
}
