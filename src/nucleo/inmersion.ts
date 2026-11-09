// Las horas de inmersión: el tiempo que se escucha y se lee la lengua que se estudia, por día y por fuente (un video, un
// libro, el Portapapeles). Aquí van las cuentas que no dependen de dónde se guarda: el día local, los totales, la racha
// y lo que más se ha visto.

export type TipoInmersion = 'video' | 'lectura';

export interface FilaInmersion {
  /** El día, en la hora local de quien estudia: AAAA-MM-DD. */
  dia: string;
  tipo: TipoInmersion;
  /** De dónde: el identificador del video, del libro o de la página. */
  fuente: string;
  titulo: string;
  segundos: number;
  actualizada: number;
}

export interface FuenteInmersion {
  tipo: TipoInmersion;
  fuente: string;
  titulo: string;
  segundos: number;
}

export interface ResumenInmersion {
  hoy: number;
  /** Los últimos siete días, hoy incluido. */
  semana: number;
  total: number;
  /** Días seguidos con al menos RACHA_MINIMA_S, hasta hoy, o hasta ayer si hoy aún no llega. */
  racha: number;
  /** Los últimos siete días, del más antiguo a hoy. */
  dias: { dia: string; segundos: number }[];
  /** Lo que más tiempo se ha visto o leído, de más a menos. */
  mas: FuenteInmersion[];
}

/** Un día cuenta para la racha con cinco minutos: abrir un video un momento no basta. */
export const RACHA_MINIMA_S = 5 * 60;

/** El día de un instante, en la hora local. */
export function diaLocal(t: number | Date): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** El día anterior o posterior a otro, en el calendario local. */
export function diaMas(dia: string, dias: number): string {
  const [a, m, d] = dia.split('-').map(Number);
  return diaLocal(new Date(a, m - 1, d + dias, 12));
}

export function resumirInmersion(filas: FilaInmersion[], hoy: string, cuantas = 3): ResumenInmersion {
  const porDia = new Map<string, number>();
  const porFuente = new Map<string, FuenteInmersion & { ultima: number }>();
  let total = 0;
  for (const f of filas) {
    total += f.segundos;
    porDia.set(f.dia, (porDia.get(f.dia) ?? 0) + f.segundos);
    const clave = `${f.tipo}\u0000${f.fuente}`;
    const previa = porFuente.get(clave);
    if (!previa) porFuente.set(clave, { tipo: f.tipo, fuente: f.fuente, titulo: f.titulo, segundos: f.segundos, ultima: f.actualizada });
    else {
      previa.segundos += f.segundos;
      // El título más reciente: un video puede cambiar de nombre.
      if (f.titulo && f.actualizada >= previa.ultima) {
        previa.titulo = f.titulo;
        previa.ultima = f.actualizada;
      }
    }
  }
  const dias = Array.from({ length: 7 }, (_, i) => {
    const dia = diaMas(hoy, i - 6);
    return { dia, segundos: porDia.get(dia) ?? 0 };
  });
  let racha = 0;
  let dia = (porDia.get(hoy) ?? 0) >= RACHA_MINIMA_S ? hoy : diaMas(hoy, -1);
  while ((porDia.get(dia) ?? 0) >= RACHA_MINIMA_S) {
    racha++;
    dia = diaMas(dia, -1);
  }
  return {
    hoy: porDia.get(hoy) ?? 0,
    semana: dias.reduce((s, d) => s + d.segundos, 0),
    total,
    racha,
    dias,
    mas: [...porFuente.values()]
      .sort((a, b) => b.segundos - a.segundos)
      .slice(0, cuantas)
      .map(({ tipo, fuente, titulo, segundos }) => ({ tipo, fuente, titulo, segundos })),
  };
}

/** Lo que suma un tic del reloj: el tiempo desde el anterior, pero no más del tope (un equipo dormido no cuenta). */
export const pasoDeReloj = (desdeMs: number, hastaMs: number, topeS: number): number => Math.max(0, Math.min((hastaMs - desdeMs) / 1000, topeS));
