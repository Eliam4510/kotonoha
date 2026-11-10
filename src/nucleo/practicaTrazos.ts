// Corregir un trazo escrito a mano: se compara con el que toca, sobre el mismo lienzo de 109 × 109 de los archivos de
// trazos. Cuenta que empiece y acabe donde debe, que vaya en la misma dirección, que tenga la misma forma (aunque esté
// algo girado o sea más pequeño) y que no sea mucho más corto. Si no encaja, se mira si va al revés o si es otro de los
// que faltan, para decir qué ha fallado y no solo que ha fallado.

export interface Punto {
  x: number;
  y: number;
}

const distancia = (a: Punto, b: Punto) => Math.hypot(a.x - b.x, a.y - b.y);

function longitud(ps: Punto[]): number {
  let l = 0;
  for (let i = 1; i < ps.length; i++) l += distancia(ps[i - 1], ps[i]);
  return l;
}

/** Los puntos de un trazado SVG, cada `paso` unidades más o menos: órdenes M, L, H, V, C, S, Q, T y Z. */
export function puntosDeTrazado(d: string, paso = 1): Punto[] {
  const fichas = d.match(/[MmLlHhVvCcSsQqTtZz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) ?? [];
  const salida: Punto[] = [];
  let i = 0;
  let orden = '';
  let actual: Punto = { x: 0, y: 0 };
  let inicio: Punto = { x: 0, y: 0 };
  // El último punto de control, para reflejarlo en S y T.
  let control: Punto | null = null;
  const numero = () => Number(fichas[i++]);
  const hayNumero = () => i < fichas.length && !/^[A-Za-z]$/.test(fichas[i]);

  const curva = (p1: Punto, p2: Punto, p3: Punto) => {
    const aprox = distancia(actual, p1) + distancia(p1, p2) + distancia(p2, p3);
    const n = Math.max(4, Math.ceil(aprox / paso));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const u = 1 - t;
      salida.push({
        x: u * u * u * actual.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
        y: u * u * u * actual.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
      });
    }
    actual = p3;
  };
  const recta = (p: Punto) => {
    const n = Math.max(1, Math.ceil(distancia(actual, p) / paso));
    for (let k = 1; k <= n; k++) salida.push({ x: actual.x + ((p.x - actual.x) * k) / n, y: actual.y + ((p.y - actual.y) * k) / n });
    actual = p;
  };

  while (i < fichas.length) {
    if (/^[A-Za-z]$/.test(fichas[i])) orden = fichas[i++];
    else if (!orden) {
      i++;
      continue;
    }
    const rel = orden === orden.toLowerCase();
    const base = (p: Punto) => (rel ? { x: actual.x + p.x, y: actual.y + p.y } : p);
    const par = () => base({ x: numero(), y: numero() });
    switch (orden.toUpperCase()) {
      case 'M': {
        actual = par();
        inicio = actual;
        salida.push(actual);
        control = null;
        // Los pares que siguen a una M son rectas.
        orden = rel ? 'l' : 'L';
        break;
      }
      case 'L':
        recta(par());
        control = null;
        break;
      case 'H':
        recta({ x: rel ? actual.x + numero() : numero(), y: actual.y });
        control = null;
        break;
      case 'V':
        recta({ x: actual.x, y: rel ? actual.y + numero() : numero() });
        control = null;
        break;
      case 'C': {
        const p1 = par();
        const p2 = par();
        const p3 = par();
        curva(p1, p2, p3);
        control = p2;
        break;
      }
      case 'S': {
        const p1 = control ? { x: 2 * actual.x - control.x, y: 2 * actual.y - control.y } : actual;
        const p2 = par();
        const p3 = par();
        curva(p1, p2, p3);
        control = p2;
        break;
      }
      case 'Q':
      case 'T': {
        // Una cuadrática es una cúbica con los dos controles a dos tercios del suyo.
        const q: Punto = orden.toUpperCase() === 'Q' ? par() : control ? { x: 2 * actual.x - control.x, y: 2 * actual.y - control.y } : actual;
        const fin = par();
        const de = actual;
        curva({ x: de.x + (2 / 3) * (q.x - de.x), y: de.y + (2 / 3) * (q.y - de.y) }, { x: fin.x + (2 / 3) * (q.x - fin.x), y: fin.y + (2 / 3) * (q.y - fin.y) }, fin);
        control = q;
        break;
      }
      case 'Z':
        recta(inicio);
        control = null;
        if (!hayNumero()) orden = '';
        break;
      default:
        i++;
    }
    // Si siguen números sin letra, repiten la misma orden: así se escriben varias curvas seguidas.
  }
  return salida;
}

/** El mismo recorrido con `n` puntos repartidos por igual a lo largo. */
export function remuestrear(ps: Punto[], n: number): Punto[] {
  if (!ps.length) return [];
  if (ps.length === 1 || n < 2) return Array.from({ length: Math.max(1, n) }, () => ({ ...ps[0] }));
  const total = longitud(ps);
  if (!total) return Array.from({ length: n }, () => ({ ...ps[0] }));
  const salida: Punto[] = [{ ...ps[0] }];
  const tramo = total / (n - 1);
  let pendiente = tramo;
  for (let i = 1; i < ps.length; i++) {
    let a = ps[i - 1];
    const b = ps[i];
    let d = distancia(a, b);
    while (d >= pendiente && salida.length < n - 1) {
      const t = pendiente / d;
      a = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      salida.push(a);
      d -= pendiente;
      pendiente = tramo;
    }
    pendiente -= d;
  }
  while (salida.length < n) salida.push({ ...ps[ps.length - 1] });
  return salida;
}

/** Centrado en su media y a escala de sus extremos: así solo queda la forma, no dónde está ni cuánto mide. */
function normalizar(ps: Punto[]): Punto[] | null {
  const xs = remuestrear(ps, 30);
  const media = { x: xs.reduce((s, p) => s + p.x, 0) / xs.length, y: xs.reduce((s, p) => s + p.y, 0) / xs.length };
  const centrado = xs.map((p) => ({ x: p.x - media.x, y: p.y - media.y }));
  const a = centrado[0];
  const b = centrado[centrado.length - 1];
  const escala = Math.sqrt((a.x * a.x + a.y * a.y + b.x * b.x + b.y * b.y) / 2);
  if (escala < 0.5) return null;
  return centrado.map((p) => ({ x: p.x / escala, y: p.y / escala }));
}

/** La distancia de Fréchet discreta: lo más que hay que separarse para recorrer las dos a la vez sin volver atrás. */
function frechet(a: Punto[], b: Punto[]): number {
  const m: number[][] = a.map(() => new Array<number>(b.length).fill(0));
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      const d = distancia(a[i], b[j]);
      if (!i && !j) m[i][j] = d;
      else if (!i) m[i][j] = Math.max(m[i][j - 1], d);
      else if (!j) m[i][j] = Math.max(m[i - 1][j], d);
      else m[i][j] = Math.max(Math.min(m[i - 1][j], m[i - 1][j - 1], m[i][j - 1]), d);
    }
  }
  return m[a.length - 1][b.length - 1];
}

const GIROS = [Math.PI / 16, Math.PI / 32, 0, -Math.PI / 32, -Math.PI / 16];

const girar = (ps: Punto[], a: number) => ps.map((p) => ({ x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) }));

function mismaForma(dibujado: Punto[], trazo: Punto[], tolerancia: number): boolean {
  const a = normalizar(dibujado);
  const b = normalizar(trazo);
  // Un punto, como el de ten (丶) hecho con un toque: no tiene forma que comparar.
  if (!a || !b) return true;
  return Math.min(...GIROS.map((g) => frechet(girar(a, g), b))) <= 0.4 * tolerancia;
}

/** Si los tramos del dibujo van, de media, hacia donde va alguno del trazo. */
function mismaDireccion(dibujado: Punto[], trazo: Punto[]): boolean {
  const vectores = (ps: Punto[]) => ps.slice(1).map((p, i) => ({ x: p.x - ps[i].x, y: p.y - ps[i].y })).filter((v) => v.x || v.y);
  // Tramos de unas cuatro unidades: más cortos, y lo que se mediría sería el temblor de la mano.
  const tramos = (ps: Punto[]) => Math.max(2, Math.min(12, Math.round(longitud(ps) / 4) + 1));
  const del = vectores(remuestrear(dibujado, tramos(dibujado)));
  const del2 = vectores(remuestrear(trazo, tramos(trazo)));
  if (!del.length || !del2.length) return true;
  const coseno = (u: Punto, v: Punto) => (u.x * v.x + u.y * v.y) / (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y));
  const media = del.reduce((s, u) => s + Math.max(...del2.map((v) => coseno(u, v))), 0) / del.length;
  return media > 0;
}

/** Lo lejos que queda, de media, cada punto del dibujo del trazo. */
function distanciaMedia(dibujado: Punto[], trazo: Punto[]): number {
  const muestra = remuestrear(dibujado, 24);
  return muestra.reduce((s, p) => s + Math.min(...trazo.map((q) => distancia(p, q))), 0) / muestra.length;
}

/** Lo que se tolera, en unidades del lienzo de 109: medias distancias al trazo y a sus extremos. */
const DISTANCIA_MEDIA = 37;
const EXTREMOS = 27;
/** Lo que se le suma a cada longitud antes de compararlas, para que un punto no tenga que medir exacto. */
const HOLGURA_LONGITUD = 2.7;
/** Por debajo de esto, un trazo es un punto o una rayita: no tiene forma que comparar, solo hacia dónde va. */
const TRAZO_CORTO = 14;

/** Qué referencias hay al escribir: el carácter de fondo, los trazos ya hechos o nada. Con más, se pide ir más cerca. */
type Cerca = 'fondo' | 'referencias' | 'nada';
const CERCA_DEL_TRAZO: Record<Cerca, number> = { fondo: 0.35, referencias: 0.5, nada: 1 };
const CERCA_DE_LOS_EXTREMOS: Record<Cerca, number> = { fondo: 0.5, referencias: 0.75, nada: 1 };

interface Encaje {
  acierto: boolean;
  media: number;
}

const ultimo = (ps: Punto[]) => ps[ps.length - 1];

/** Lo que se tuerce el dibujo respecto al trazo, de punta a punta, en radianes: de 0 a π. */
function giro(dibujado: Punto[], trazo: Punto[]): number {
  const rumbo = (ps: Punto[]) => Math.atan2(ultimo(ps).y - ps[0].y, ultimo(ps).x - ps[0].x);
  const g = Math.abs(rumbo(dibujado) - rumbo(trazo));
  return g > Math.PI ? 2 * Math.PI - g : g;
}

/** Lo más que se puede torcer de punta a punta: una horizontal hecha en diagonal no es la horizontal. */
const GIRO_MAXIMO = (25 * Math.PI) / 180;
/** En un trazo corto la mano tuerce más sin que se note: solo cuenta que vaya hacia el mismo lado. */
const GIRO_MAXIMO_CORTO = (70 * Math.PI) / 180;

function bienOrientado(dibujado: Punto[], trazo: Punto[], tolerancia: number): boolean {
  // En un trazo casi cerrado, de punta a punta no dice nada.
  if (distancia(trazo[0], ultimo(trazo)) < 10 || distancia(dibujado[0], ultimo(dibujado)) < 5) return true;
  return giro(dibujado, trazo) <= GIRO_MAXIMO * tolerancia;
}

function encaja(dibujado: Punto[], trazo: Punto[], tolerancia: number, cerca: Cerca): Encaje {
  const media = distanciaMedia(dibujado, trazo);
  // Con el carácter de fondo se puede pedir que vaya encima; con algún trazo ya hecho, al menos cerca.
  if (media > DISTANCIA_MEDIA * CERCA_DEL_TRAZO[cerca] * tolerancia) return { acierto: false, media };
  const tope = EXTREMOS * CERCA_DE_LOS_EXTREMOS[cerca] * tolerancia;
  const largoDibujo = longitud(dibujado);
  const largoTrazo = longitud(trazo);
  const medida =
    distancia(dibujado[0], trazo[0]) <= tope &&
    distancia(ultimo(dibujado), ultimo(trazo)) <= tope &&
    (tolerancia * (largoDibujo + HOLGURA_LONGITUD)) / (largoTrazo + HOLGURA_LONGITUD) >= 0.35 &&
    // Un garabato que pasa por encima no es el trazo, aunque empiece y acabe cerca.
    largoDibujo <= (largoTrazo * 2.5 + 8) * tolerancia;
  if (!medida) return { acierto: false, media };
  if (largoTrazo < TRAZO_CORTO) {
    // Un punto hecho con un toque no tiene dirección; con algo de recorrido, tiene que ir hacia el mismo lado.
    const acierto = distancia(dibujado[0], ultimo(dibujado)) < 1.5 || giro(dibujado, trazo) <= GIRO_MAXIMO_CORTO * tolerancia;
    return { acierto, media };
  }
  // En un trazo que no llega a largo, el mismo temblor deforma más: a su forma se le da algo de manga.
  const manga = largoTrazo < 30 ? 1 + (30 - largoTrazo) / 32 : 1;
  return { acierto: bienOrientado(dibujado, trazo, tolerancia) && mismaDireccion(dibujado, trazo) && mismaForma(dibujado, trazo, tolerancia * manga), media };
}

export interface VeredictoTrazo {
  acierto: boolean;
  /** Si no acierta: va al revés, es otro de los que faltan, o no se parece. */
  motivo?: 'reves' | 'otro' | 'forma';
  /** El trazo que se ha hecho en su lugar, contando desde 0. */
  otro?: number;
}

export interface OpcionesTrazo {
  /** 1 es lo normal; más, más permisivo. */
  tolerancia?: number;
  /** Si se ve el carácter de fondo para calcarlo. */
  conFondo?: boolean;
}

/**
 * Los puntos del dibujo que aportan algo: los que están a menos de una unidad del anterior solo traen el temblor de la
 * mano y estropean las direcciones. El último se conserva siempre: es donde acaba el trazo.
 */
function sinTemblor(ps: Punto[]): Punto[] {
  if (ps.length < 3) return ps;
  const salida = [ps[0]];
  for (let i = 1; i < ps.length - 1; i++) if (distancia(ps[i], ultimo(salida)) >= 1) salida.push(ps[i]);
  salida.push(ultimo(ps));
  return salida;
}

/**
 * Compara lo dibujado con el trazo que toca (`trazos[toca]`). Si encaja, pero se parece todavía más a uno posterior,
 * se le exige más: dibujar el 3 cuando toca el 2 no vale aunque caigan cerca.
 */
export function evaluarTrazo(dibujado: Punto[], trazos: Punto[][], toca: number, opciones: OpcionesTrazo = {}): VeredictoTrazo {
  const tolerancia = opciones.tolerancia ?? 1;
  const cerca: Cerca = opciones.conFondo ? 'fondo' : toca > 0 ? 'referencias' : 'nada';
  const ps = sinTemblor(dibujado);
  const trazo = trazos[toca];
  if (ps.length < 2 || !trazo?.length) return { acierto: false, motivo: 'forma' };
  const propio = encaja(ps, trazo, tolerancia, cerca);
  let mejor: { i: number; media: number } | null = null;
  for (let i = toca + 1; i < trazos.length; i++) {
    const otro = encaja(ps, trazos[i], tolerancia, cerca);
    if (otro.acierto && otro.media < (mejor?.media ?? Infinity)) mejor = { i, media: otro.media };
  }
  if (propio.acierto) {
    if (!mejor || mejor.media >= propio.media) return { acierto: true };
    // Entre 0,3 y 0,6 de lo normal, según cuánto mejor encaja el otro.
    const ajuste = (0.6 * (mejor.media + propio.media)) / (2 * propio.media);
    if (encaja(ps, trazo, tolerancia * ajuste, cerca).acierto) return { acierto: true };
    return { acierto: false, motivo: 'otro', otro: mejor.i };
  }
  if (encaja([...ps].reverse(), trazo, tolerancia, cerca).acierto) return { acierto: false, motivo: 'reves' };
  if (mejor) return { acierto: false, motivo: 'otro', otro: mejor.i };
  return { acierto: false, motivo: 'forma' };
}
