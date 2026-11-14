// Preparar una vista sin enseñarla. Mientras se ve la de antes, la nueva carga lo suyo a escondidas y, cuando ya lo
// tiene todo, se cambia de una vez. Sin esto, al pasar de una palabra a otra en el diccionario se veía la anterior, luego
// la página vacía con esqueletos y luego la nueva llegando a trozos, con la página saltando de alto en cada uno.
//
//   <Preparar alListo={…}>…</Preparar>  envuelve la vista; alListo se llama una sola vez, cuando ya no espera nada o
//                                       cuando pasa el tope, para que algo lento no la deje sin enseñarse.
//   const esperar = useEsperar();       dentro, en un componente: esperar(motor.algo()) hace que la vista lo espere.
//
// Fuera de una preparación, o con la vista ya enseñada, esperar no hace nada: los componentes funcionan igual en
// cualquier otro sitio.

import { type ComponentChildren, createContext } from 'preact';
import { useContext, useEffect, useState } from 'preact/hooks';

export type Esperar = <T>(p: Promise<T>) => Promise<T>;

const Contexto = createContext<Esperar | null>(null);
const sinPreparacion: Esperar = (p) => p;

/** Para los componentes: registra una de las primeras cargas, que la vista espera antes de enseñarse. */
export function useEsperar(): Esperar {
  return useContext(Contexto) ?? sinPreparacion;
}

/** Tras el fotograma siguiente, cuando Preact ya ha corrido los efectos de lo que acaba de pintar. */
const trasFotograma = (f: () => void) => requestAnimationFrame(() => setTimeout(f, 0));

/** El tope por omisión: con más espera, enseñar lo que hay y dejar que lo demás llegue con su esqueleto. */
export const TOPE_PREPARACION_MS = 1500;

interface Preparacion {
  esperar: Esperar;
  comprobar: () => void;
  acabar: () => void;
}

/** La cuenta de lo que falta. `avisar` se lee al acabar: así siempre es la última que se pasó. */
export function crearPreparacion(avisar: () => void): Preparacion {
  let pendientes = 0;
  let vuelta = 0;
  let listo = false;
  const acabar = () => {
    if (listo) return;
    listo = true;
    avisar();
  };
  // Dos fotogramas sin nada nuevo: lo que se monta al llegar una carga registra la suya en su efecto, un poco después.
  const comprobar = () => {
    const v = vuelta;
    trasFotograma(() =>
      trasFotograma(() => {
        if (!listo && pendientes === 0 && vuelta === v) acabar();
      })
    );
  };
  const esperar: Esperar = (p) => {
    if (listo) return p;
    pendientes++;
    vuelta++;
    const fin = () => {
      pendientes--;
      vuelta++;
      if (pendientes === 0) comprobar();
    };
    p.then(fin, fin);
    return p;
  };
  return { esperar, comprobar, acabar };
}

export function Preparar({ alListo, tope = TOPE_PREPARACION_MS, children }: { alListo: () => void; tope?: number; children: ComponentChildren }) {
  const [aviso] = useState(() => ({ actual: alListo }));
  aviso.actual = alListo;
  // Dentro de otra preparación (el diccionario dentro de una pantalla que se prepara), la de fuera espera a esta.
  const exterior = useContext(Contexto);
  const [p] = useState(() => {
    let avisarFuera = () => {};
    if (exterior) void exterior(new Promise<void>((ok) => (avisarFuera = ok)));
    return crearPreparacion(() => {
      avisarFuera();
      aviso.actual();
    });
  });
  useEffect(() => {
    // Los efectos de dentro ya corrieron: si nadie registró nada, la vista está lista.
    p.comprobar();
    const t = setTimeout(p.acabar, tope);
    return () => clearTimeout(t);
  }, []);
  return <Contexto.Provider value={p.esperar}>{children}</Contexto.Provider>;
}

/**
 * Cambia lo que se ve con un fundido corto, si el navegador sabe hacerlo y no se ha pedido menos movimiento. `cambio`
 * pone el estado nuevo; `despues`, ya pintado el nuevo, ajusta lo que dependa de él (el desplazamiento) antes de que se
 * vea.
 */
export function conFundido(cambio: () => void, despues?: () => void) {
  const doc = document as Document & { startViewTransition?: (f: () => Promise<void>) => unknown };
  const sinMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Preact pinta en una microtarea: tras un setTimeout ya está en la página.
  const pintado = () => new Promise<void>((ok) => setTimeout(() => {
    despues?.();
    ok();
  }, 0));
  if (!doc.startViewTransition || sinMovimiento) {
    cambio();
    void pintado();
    return;
  }
  doc.startViewTransition(() => {
    cambio();
    return pintado();
  });
}
