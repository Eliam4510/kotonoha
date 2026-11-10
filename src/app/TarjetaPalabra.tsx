// Una palabra en una lista del diccionario, como tarjeta: la lectura encima de la palabra, lo que significa debajo, y de
// un vistazo si es de uso común y si ya la conoces. Al pulsarla se busca.

import type { Ajustes } from '../compartido/ajustes';
import type { EstadoPalabra } from '../compartido/tipos';
import { numero, tr } from '../compartido/i18n';
import type { EntradaBreve } from '../nucleo/explorar';
import { ConFurigana, NOMBRE_ESTADO } from '../ui/Ficha';
import { Icono } from '../ui/iconos';
import { lengua } from '../ui/lengua';
import { navegar } from './estadoApp';

/** Lo que hace falta para enseñar una palabra en una lista. */
export interface PalabraBreve {
  termino: string;
  lectura: string;
  glosa?: string;
  comun?: boolean;
  estado?: EstadoPalabra;
}

export const buscarPalabra = (t: string) => navegar(`diccionario?q=${encodeURIComponent(t)}`);

/** El tamaño y la letra de lo escrito en la lengua en las páginas del diccionario, como variables de CSS. */
export function estiloDiccionario(ajustes: Ajustes): Record<string, string | number> {
  const paquete = lengua.value;
  const letra = ajustes.diccionarioLetra === 'redondeada' ? undefined : paquete.letras?.[ajustes.diccionarioLetra] ?? paquete.letras?.gotica;
  return { '--escala-dic': ajustes.diccionarioTamano / 100, ...(letra ? { '--letra-lengua': letra } : {}) };
}

export function TarjetaPalabra({ e, activa, alElegir }: { e: PalabraBreve; activa?: boolean; alElegir?: () => void }) {
  const paquete = lengua.value;
  const conLectura = paquete.lectura.distingue && !!e.lectura && e.lectura !== e.termino;
  const estado = e.estado && e.estado !== 'desconocida' ? e.estado : undefined;
  // Una palabra larga se escribe más pequeña: partida en dos renglones, la tarjeta crece y descuadra la fila. Solo donde
  // cada carácter ocupa un cuadro entero; con alfabeto caben muchas más letras.
  const largo = paquete.lectura.distingue ? [...e.termino].length : 0;
  return (
    <button class={`dic-tarjeta ${activa ? 'activa' : ''} ${estado ? `est-${estado}` : ''}`} aria-current={activa ? 'true' : undefined} onClick={alElegir ?? (() => buscarPalabra(e.termino))}>
      <span class={`dic-tarjeta-palabra ${largo >= 8 ? 'muy-larga' : largo >= 6 ? 'larga' : ''}`} lang={paquete.id}>{conLectura ? <ConFurigana texto={e.termino} lectura={e.lectura} /> : e.termino}</span>
      {e.glosa && <span class="dic-tarjeta-glosa">{e.glosa}</span>}
      {(e.comun || estado) && (
        <span class="dic-tarjeta-marcas">
          {estado && <span class={`dic-marca-estado ${estado}`} data-tip={tr(NOMBRE_ESTADO[estado])} aria-label={tr(NOMBRE_ESTADO[estado])} />}
          {e.comun && <span class="dic-marca-comun" data-tip={tr('De uso común')} aria-label={tr('De uso común')}><Icono n="estrella" t={12} /></span>}
        </span>
      )}
    </button>
  );
}

/** Una sección del diccionario con su lista de palabras en tarjetas. Sin palabras, no se enseña. */
export function SeccionTarjetas({ titulo, ayuda, xs, total, alVerMas, cargando }: {
  titulo: string;
  ayuda?: string;
  xs: EntradaBreve[] | PalabraBreve[] | null;
  /** Cuántas hay en total, si son más de las que se enseñan. */
  total?: number;
  alVerMas?: () => void;
  cargando?: boolean;
}) {
  if (!xs?.length && !cargando) return null;
  return (
    <section class="dic-seccion" aria-label={titulo}>
      <h3 class="dic-seccion-titulo">
        {titulo}
        {total !== undefined && total > 0 && <span class="dic-cuenta num">{numero(total)}</span>}
      </h3>
      {ayuda && <p class="ayuda dic-seccion-ayuda">{ayuda}</p>}
      {cargando && !xs?.length ? (
        <div class="dic-tarjetas">{[0, 1, 2].map((i) => <span key={i} class="esqueleto dic-tarjeta-esqueleto" />)}</div>
      ) : (
        <div class="dic-tarjetas">{xs!.map((e) => <TarjetaPalabra key={`${e.termino}|${e.lectura}`} e={e} />)}</div>
      )}
      {alVerMas && total !== undefined && xs && total > xs.length && (
        <button class="btn fantasma chico ver-mas" onClick={alVerMas}>{tr('Ver más ({0})', numero(total - xs.length))} <Icono n="abajo" t={12} /></button>
      )}
    </section>
  );
}
