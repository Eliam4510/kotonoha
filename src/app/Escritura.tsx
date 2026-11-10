// Practicar la escritura de un carácter: se escribe con el ratón, el lápiz o el dedo, trazo a trazo, y cada trazo se
// corrige al soltar (nucleo/practicaTrazos). Calcando, con el carácter de fondo y el sitio donde empieza cada trazo, o de
// memoria, sobre la cuadrícula vacía. Si un trazo falla dos veces, se enseña cómo va; la pista también se puede pedir.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { tr } from '../compartido/i18n';
import { evaluarTrazo, type Punto, puntosDeTrazado } from '../nucleo/practicaTrazos';
import type { DatosTrazos } from '../nucleo/trazos';
import { Icono } from '../ui/iconos';

export type ModoEscritura = 'calcar' | 'memoria';

/** Los fallos seguidos en un mismo trazo antes de enseñarlo. */
const FALLOS_PARA_PISTA = 2;

const trazado = (ps: Punto[]) => ps.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');

interface Aviso {
  texto: string;
  tipo: 'fallo' | 'pista';
}

export function PracticaEscritura({ caracter, datos, modo, alCambiarModo }: { caracter: string; datos: DatosTrazos; modo: ModoEscritura; alCambiarModo: (m: ModoEscritura) => void }) {
  const total = datos.trazos.length;
  const puntos = useMemo(() => datos.trazos.map((d) => puntosDeTrazado(d)), [datos]);
  const [hechos, fijarHechos] = useState(0);
  const [fallos, fijarFallos] = useState<number[]>(() => datos.trazos.map(() => 0));
  const [pistas, fijarPistas] = useState<number[]>([]);
  // Cambia cada vez que se pide la pista, para que la animación vuelva a empezar.
  const [pista, fijarPista] = useState(0);
  const [aviso, fijarAviso] = useState<Aviso | null>(null);
  const [tinta, fijarTinta] = useState<Punto[] | null>(null);
  const [fallido, fijarFallido] = useState<{ d: string; n: number } | null>(null);
  const lienzo = useRef<SVGSVGElement>(null);
  const trazando = useRef<Punto[] | null>(null);
  const terminado = hechos >= total;

  const empezar = () => {
    fijarHechos(0);
    fijarFallos(datos.trazos.map(() => 0));
    fijarPistas([]);
    fijarPista(0);
    fijarAviso(null);
    fijarFallido(null);
  };
  useEffect(empezar, [datos, modo]);

  // El trazo fallido se queda un momento en rojo y se borra.
  useEffect(() => {
    if (!fallido) return;
    const t = setTimeout(() => fijarFallido(null), 900);
    return () => clearTimeout(t);
  }, [fallido]);

  const enLienzo = (e: PointerEvent): Punto => {
    const r = lienzo.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 109, y: ((e.clientY - r.top) / r.height) * 109 };
  };

  /** Enseña cómo va el trazo que toca: se dibuja solo, una y otra vez, desde su punto de inicio. */
  const mostrarPista = () => {
    fijarPista((n) => n + 1);
    if (!pistas.includes(hechos)) fijarPistas([...pistas, hechos]);
  };

  const corregir = (ps: Punto[]) => {
    // Un toque sin mover no es un trazo: puede ser un clic para enfocar.
    if (ps.length < 2) return;
    const v = evaluarTrazo(ps, puntos, hechos, { conFondo: modo === 'calcar' });
    if (v.acierto) {
      fijarHechos(hechos + 1);
      fijarPista(0);
      fijarAviso(null);
      return;
    }
    const n = fallos[hechos] + 1;
    fijarFallos(fallos.map((x, i) => (i === hechos ? n : x)));
    fijarFallido({ d: trazado(ps), n: Date.now() });
    // Al segundo fallo en el mismo trazo se enseña cómo va, además de decir qué ha fallado.
    const conPista = n >= FALLOS_PARA_PISTA;
    if (conPista) mostrarPista();
    const texto =
      v.motivo === 'reves'
        ? tr('Va al revés: el trazo {0} empieza por el otro extremo.', hechos + 1)
        : v.motivo === 'otro' && v.otro !== undefined
          ? tr('Ese es el trazo {0}. Ahora toca el {1}.', v.otro + 1, hechos + 1)
          : conPista
            ? tr('Ese no es el trazo {0}. Mira cómo va y pruébalo otra vez.', hechos + 1)
            : tr('Ese no es el trazo {0}. Prueba otra vez.', hechos + 1);
    fijarAviso({ tipo: 'fallo', texto });
  };

  const alBajar = (e: PointerEvent) => {
    if (terminado || e.button > 0) return;
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    trazando.current = [enLienzo(e)];
    fijarTinta(trazando.current);
  };
  const alMover = (e: PointerEvent) => {
    if (!trazando.current) return;
    // Los movimientos intermedios que el navegador agrupa: sin ellos, un trazo rápido sale a picos.
    const eventos = e.getCoalescedEvents?.() ?? [];
    for (const x of eventos.length ? eventos : [e]) trazando.current.push(enLienzo(x));
    fijarTinta([...trazando.current]);
  };
  const alSoltar = () => {
    const ps = trazando.current;
    trazando.current = null;
    fijarTinta(null);
    if (ps) corregir(ps);
  };

  const deshacer = () => {
    if (!hechos) return;
    fijarHechos(hechos - 1);
    fijarAviso(null);
    fijarPista(0);
  };

  const conFallos = fallos.map((n, i) => (n || pistas.includes(i) ? i + 1 : 0)).filter(Boolean);
  const inicio = !terminado ? datos.numeros[hechos] : undefined;
  const comienzo = !terminado ? puntos[hechos]?.[0] : undefined;

  return (
    <div class="escritura">
      <div class="segmentado escritura-modo" role="radiogroup" aria-label={tr('Cómo practicar')}>
        <button role="radio" aria-checked={modo === 'calcar'} class={modo === 'calcar' ? 'activo' : ''} onClick={() => alCambiarModo('calcar')}>{tr('Calcando')}</button>
        <button role="radio" aria-checked={modo === 'memoria'} class={modo === 'memoria' ? 'activo' : ''} onClick={() => alCambiarModo('memoria')}>{tr('De memoria')}</button>
      </div>
      <svg
        ref={lienzo}
        class={`escritura-lienzo ${terminado ? 'terminado' : ''}`}
        viewBox="0 0 109 109"
        role="img"
        aria-label={tr('Escribe {0} trazo a trazo con el ratón, el lápiz o el dedo', caracter)}
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
      >
        <path class="trazo-guia" d="M54.5 3V106M3 54.5H106" />
        {modo === 'calcar' && datos.trazos.map((d, i) => <path key={`f${i}`} class="trazo-fondo" d={d} />)}
        {datos.trazos.slice(0, hechos).map((d, i) => <path key={`h${i}`} class={`trazo-hecho ${terminado ? '' : 'escritura-hecho'}`} d={d} />)}
        {pista > 0 && !terminado && <path key={`p${hechos}-${pista}`} class="trazo-dibujando escritura-pista" pathLength={1} d={datos.trazos[hechos]} />}
        {(modo === 'calcar' || pista > 0) && comienzo && (
          <g class="escritura-inicio">
            <circle cx={comienzo.x} cy={comienzo.y} r={2.6} />
            {modo === 'calcar' && inicio && <text class="trazo-numero" x={inicio.x} y={inicio.y}>{hechos + 1}</text>}
          </g>
        )}
        {fallido && <path key={fallido.n} class="escritura-fallo" d={fallido.d} />}
        {tinta && <path class="escritura-tinta" d={trazado(tinta)} />}
      </svg>

      <p class={`escritura-aviso ${terminado ? 'aviso-hecho' : aviso ? `aviso-${aviso.tipo}` : ''}`} role="status" aria-live="polite">
        {terminado
          ? conFallos.length
            ? tr('Hecho. Repasa los trazos {0}.', conFallos.join(', '))
            : tr('¡Perfecto! Sin ningún fallo.')
          : (aviso?.texto ?? (hechos ? tr('Trazo {0} de {1}', hechos + 1, total) : modo === 'calcar' ? tr('Escribe encima, empezando por el trazo 1.') : tr('Escribe {0} de memoria, en su orden.', caracter)))}
      </p>

      <div class="escritura-controles">
        {terminado ? (
          <>
            <button class="btn chico" onClick={empezar}><Icono n="reiniciar" t={14} /> {tr('Otra vez')}</button>
            {modo === 'calcar' && <button class="btn chico primario" onClick={() => alCambiarModo('memoria')}><Icono n="lapiz" t={14} /> {tr('Ahora de memoria')}</button>}
          </>
        ) : (
          <>
            <button class="btn chico" onClick={() => { mostrarPista(); fijarAviso({ tipo: 'pista', texto: tr('Así va el trazo {0}: empieza en el punto.', hechos + 1) }); }}><Icono n="ojo" t={14} /> {tr('Pista')}</button>
            <button class="btn-icono chico" aria-label={tr('Deshacer el último trazo')} data-tip={tr('Deshacer el último trazo')} disabled={!hechos} onClick={deshacer}><Icono n="deshacer" t={15} /></button>
            <button class="btn-icono chico" aria-label={tr('Borrar y empezar de nuevo')} data-tip={tr('Borrar y empezar de nuevo')} disabled={!hechos && !aviso} onClick={empezar}><Icono n="goma" t={15} /></button>
          </>
        )}
      </div>
    </div>
  );
}
