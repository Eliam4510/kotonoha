// Leer en voz alta en el visor, siguiendo la frase: lee las frases de la página una a una, con la voz de las frases (la
// local o la de Azure) o la del navegador, marca en la página la que suena y, al acabar la página, pasa a la siguiente y
// sigue en cuanto tiene su texto (el OCR puede estar leyéndola). Se pausa, se sigue y se para.

import { useEffect, useRef, useState } from 'preact/hooks';
import { type Ajustes, hayVozSintetica } from '../compartido/ajustes';
import { motor } from '../compartido/rpc';
import type { FraseEnPagina } from '../nucleo/aumento';
import { decirConNavegador } from '../ui/vozNavegador';

/** Por dónde va la lectura: la página, la frase de esa página y cuántas tiene. */
export interface EstadoVoz {
  pagina: number;
  frase: number;
  total: number;
  pausada: boolean;
}

/** Cuánto se espera a que una página tenga texto (el OCR la está leyendo) antes de dejarlo. */
const ESPERA_TEXTO_MS = 30000;

export function useVozAlta(o: { frasesDe: (n: number) => FraseEnPagina[]; total: number; irA: (n: number) => void; ajustes: Ajustes }) {
  const [voz, fijarVoz] = useState<EstadoVoz | null>(null);
  // Lo de cada pintado, para el bucle, que dura más que un pintado.
  const actual = useRef(o);
  actual.current = o;
  const turno = useRef(0);
  const audio = useRef<HTMLAudioElement | null>(null);

  const callar = () => {
    audio.current?.pause();
    audio.current = null;
    speechSynthesis.cancel();
  };

  const decir = async (texto: string, mio: number): Promise<void> => {
    const a = actual.current.ajustes;
    if (hayVozSintetica(a)) {
      const datos = await motor.vozFrase(texto, a.vocesFrase[0]).catch(() => null);
      if (mio !== turno.current) return;
      if (datos) {
        await new Promise<void>((ok) => {
          const el = new Audio(`data:audio/mpeg;base64,${datos}`);
          audio.current = el;
          el.onended = () => ok();
          el.onerror = () => ok();
          el.onpause = () => ok();
          el.play().catch(() => ok());
        });
        return;
      }
    }
    await decirConNavegador(texto);
  };

  /** Lee desde una frase de una página hasta el final del libro, o hasta que se pause o se pare. */
  const empezar = async (pagina: number, frase = 0) => {
    callar();
    const mio = ++turno.current;
    let n = pagina;
    let i = frase;
    while (mio === turno.current && n < actual.current.total) {
      let frases = actual.current.frasesDe(n);
      if (!frases.length) {
        // Una página que aún no tiene texto: se espera un poco a que lo traiga el OCR.
        const limite = Date.now() + ESPERA_TEXTO_MS;
        while (mio === turno.current && !frases.length && Date.now() < limite) {
          await new Promise((ok) => setTimeout(ok, 300));
          frases = actual.current.frasesDe(n);
        }
        if (!frases.length) break;
      }
      if (i >= frases.length) {
        if (n + 1 >= actual.current.total) break;
        n++;
        i = 0;
        actual.current.irA(n);
        continue;
      }
      fijarVoz({ pagina: n, frase: i, total: frases.length, pausada: false });
      await decir(frases[i].frase, mio);
      if (mio !== turno.current) return;
      i++;
    }
    if (mio === turno.current) fijarVoz(null);
  };

  const pausar = () => {
    turno.current++;
    callar();
    fijarVoz((v) => (v ? { ...v, pausada: true } : v));
  };
  const seguir = () => {
    if (voz) empezar(voz.pagina, voz.frase).catch(console.error);
  };
  const parar = () => {
    turno.current++;
    callar();
    fijarVoz(null);
  };
  useEffect(() => () => parar(), []);

  return { voz, empezar: (n: number, i = 0) => empezar(n, i).catch(console.error), pausar, seguir, parar };
}
