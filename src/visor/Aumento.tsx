// La página aumentada (nucleo/aumento.ts), pintada sobre la imagen: cada palabra subrayada por su estado, como en los
// subtítulos; su furigana encima (o a su derecha, en vertical), salvo donde el libro ya lo trae impreso; la gramática de
// cada frase, con una línea de puntos; y la traducción de la frase abierta, como un subtítulo bajo ella. Todo en fracciones
// de la página, como las demás capas: sigue al zoom sin volver a calcular nada. No recibe toques: el texto sigue debajo.

import { useEffect, useRef, useState } from 'preact/hooks';
import type { ModoLectura } from '../compartido/ajustes';
import { tr } from '../compartido/i18n';
import { flujoMotor, motor } from '../compartido/rpc';
import type { ContextoIA, PalabraToken } from '../compartido/tipos';
import type { GramaticaEnPagina, PalabraEnPagina } from '../nucleo/aumento';
import { envolvente } from '../nucleo/seleccion';
import type { Caja } from '../nucleo/ocr';
import { Icono } from '../ui/iconos';
import { formatoLectura, lengua } from '../ui/lengua';

const pct = (v: number) => `${(v * 100).toFixed(3)}%`;
const enCaja = (c: Caja) => ({ left: pct(c.x0), top: pct(c.y0), width: pct(c.x1 - c.x0), height: pct(c.y1 - c.y0) });

/** Cuánto mide el furigana: algo menos de la mitad del grueso del renglón, sin bajar de lo legible. */
const tamanoRubi = (grueso: number) => Math.min(28, Math.max(7, grueso * 0.42));

export interface AjustesAumento {
  furigana: ModoLectura;
  estado: boolean;
  gramatica: boolean;
}

/** Si una palabra lleva su lectura encima, según el modo: todas, las nuevas o la que está bajo el ratón. */
export function conLectura(modo: ModoLectura, t: PalabraToken, encima: boolean): boolean {
  return modo === 'todas' || (modo === 'desconocidas' && t.estado === 'desconocida') || (modo === 'alPasar' && encima);
}

export function CapaAumento({ palabras, tokens, a, ancho, alto, encima, gramatica }: {
  palabras: PalabraEnPagina[];
  tokens: PalabraToken[];
  a: AjustesAumento;
  /** El tamaño de la página en la pantalla, en píxeles: para el tamaño del furigana. */
  ancho: number;
  alto: number;
  /** La palabra bajo el ratón, para el furigana al pasar. */
  encima: number;
  gramatica: GramaticaEnPagina[];
}) {
  return (
    <div class="vs-aumento" aria-hidden="true">
      {a.gramatica &&
        gramatica.map((g, i) =>
          g.cajas.map((c, j) => <span key={`g${i}-${j}`} class={`vs-gram ${g.vertical ? 'v' : ''}`} style={enCaja(c)} />)
        )}
      {palabras.map((w, k) => {
        const t = tokens[w.token];
        if (!t) return null;
        const subrayar = a.estado && (t.estado === 'desconocida' || t.estado === 'aprendiendo' || t.rastreada);
        const leer = conLectura(a.furigana, t, k === encima);
        return [
          ...(subrayar ? w.cajas.map((c, i) => <span key={`s${k}-${i}`} class={`vs-sub est-${t.estado} ${t.rastreada ? 'rastreada' : ''} ${w.vertical ? 'v' : ''}`} style={enCaja(c)} />) : []),
          ...(leer
            ? w.lecturas.map((l, i) => {
                const c = l.cajas[0];
                if (!c || l.impreso) return null;
                const fs = tamanoRubi(w.vertical ? (c.x1 - c.x0) * ancho : (c.y1 - c.y0) * alto);
                const estilo = w.vertical
                  ? { top: pct(c.y0), height: pct(c.y1 - c.y0), left: `calc(${pct(c.x1)} + 1px)`, width: `${fs * 1.1}px`, fontSize: `${fs}px` }
                  : { left: pct(c.x0), width: pct(c.x1 - c.x0), top: `calc(${pct(c.y0)} - ${fs * 1.12}px)`, height: `${fs * 1.1}px`, fontSize: `${fs}px` };
                return (
                  <span key={`r${k}-${i}`} class={`vs-rubi ${w.vertical ? 'v' : ''}`} style={estilo}>
                    {lengua.value.lectura.visible(l.lectura, formatoLectura.value)}
                  </span>
                );
              })
            : []),
        ];
      })}
    </div>
  );
}

/** La frase que se lee en voz alta, marcada en la página. */
export function FraseLeida({ cajas }: { cajas: Caja[] }) {
  return (
    <div class="vs-aumento" aria-hidden="true">
      {cajas.map((c, i) => (
        <span key={i} class="vs-leyendo" style={enCaja(c)} />
      ))}
    </div>
  );
}

/**
 * La traducción de la frase abierta, como un subtítulo bajo ella. Lo ya traducido se lee de lo guardado, sin gastar; lo
 * nuevo solo se pide a Claude al pulsar «Traducir», aquí o en la ventana. Si debajo no cabe, va encima de la frase.
 */
export function SubtituloFrase({ cajas, contexto, pedida, alPedir, alto }: { cajas: Caja[]; contexto: ContextoIA; pedida: number; alPedir: () => void; alto: number }) {
  const [texto, fijarTexto] = useState('');
  const [estado, fijarEstado] = useState<'buscando' | 'nada' | 'pidiendo' | 'listo' | 'error'>('buscando');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let vivo = true;
    fijarTexto('');
    fijarEstado('buscando');
    motor
      .traduccionGuardada(contexto.frase ?? '')
      .then((t) => {
        if (!vivo) return;
        if (t) {
          fijarTexto(t.trim());
          fijarEstado('listo');
        } else fijarEstado('nada');
      })
      .catch(() => vivo && fijarEstado('nada'));
    return () => {
      vivo = false;
    };
  }, [contexto.frase]);
  useEffect(() => {
    if (!pedida) return;
    let vivo = true;
    fijarEstado((e) => (e === 'listo' ? e : 'pidiendo'));
    // La misma petición que la de la ventana: si las dos la piden, Claude contesta una vez.
    const f = flujoMotor('traducir', [contexto, false], (t) => vivo && fijarTexto(t.trim()));
    f.then((t) => {
      if (!vivo) return;
      fijarTexto(t.trim());
      fijarEstado('listo');
    }).catch(() => vivo && fijarEstado('error'));
    return () => {
      vivo = false;
      f.cancelar();
    };
  }, [pedida]);
  const env = envolvente(cajas);
  const ultima = cajas[cajas.length - 1];
  if (!env || !ultima || estado === 'buscando') return null;
  const grueso = (ultima.y1 - ultima.y0) * alto;
  const fs = Math.min(20, Math.max(12, grueso * 0.6));
  // Debajo de la frase; si no cabe al pie de la página, encima.
  const abajo = env.y1 < 0.86;
  const ancho = Math.max(env.x1 - env.x0, 0.36);
  const izquierda = Math.min(Math.max(0.02, env.x0 + (env.x1 - env.x0) / 2 - ancho / 2), 0.98 - ancho);
  const estilo = { left: pct(izquierda), width: pct(ancho), fontSize: `${fs}px`, ...(abajo ? { top: `calc(${pct(env.y1)} + 4px)` } : { bottom: `calc(${pct(1 - env.y0)} + 4px)` }) };
  const parar = (e: Event) => e.stopPropagation();
  return (
    <div ref={ref} class={`vs-subtitulo ${estado}`} style={estilo} lang="" onPointerDown={parar} onClick={parar} role="note" aria-label={tr('Traducción')}>
      {estado === 'nada' ? (
        <button type="button" class="vs-subtitulo-pedir" onClick={alPedir}>
          <Icono n="traducir" t={14} /> {tr('Traducir')}
        </button>
      ) : estado === 'error' ? (
        <span class="vs-subtitulo-error">{tr('No se pudo traducir. Prueba con «Traducir» en la ventana.')}</span>
      ) : (
        <span>{texto || '…'}</span>
      )}
    </div>
  );
}
