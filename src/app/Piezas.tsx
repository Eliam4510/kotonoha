// Piezas que comparten las pantallas de la app.

import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { tr } from '../compartido/i18n';
import { Icono, type NombreIcono } from '../ui/iconos';

export function Cabecera({ titulo, sub, children }: { titulo: string; sub?: ComponentChildren; children?: ComponentChildren }) {
  return (
    <header class="ap-cabecera">
      <div class="ap-cabecera-texto">
        <h1>{titulo}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div class="ap-cabecera-acciones">{children}</div>}
    </header>
  );
}

/** Estado vacío: un icono, una frase y, si tiene sentido, una acción para salir de él. */
export function Vacio({ icono, titulo, children, ia }: { icono: NombreIcono; titulo: string; children?: ComponentChildren; ia?: boolean }) {
  return (
    <div class="vacio ap-vacio">
      <span class={`hoja-icono ${ia ? 'ia' : ''}`}>
        <Icono n={icono} t={24} />
      </span>
      <h3>{titulo}</h3>
      {children}
    </div>
  );
}

export function Mensaje({ error, children }: { error?: boolean; children: ComponentChildren }) {
  return (
    <p class={`ap-mensaje ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>
      <Icono n={error ? 'aviso' : 'check'} t={16} />
      <span>{children}</span>
    </p>
  );
}

/** Cuánto espera la confirmación de un borrado antes de volver a como estaba. */
const ESPERA_CONFIRMAR_MS = 4500;
/** Un doble clic no confirma: la segunda pulsación tiene que ser otra. */
const PAUSA_DOBLE_CLIC_MS = 350;

/**
 * Un botón para lo que se borra y no vuelve. La primera pulsación solo pregunta, en el mismo sitio; la segunda lo
 * hace. Si no se confirma en unos segundos, o el foco se va a otra parte, vuelve a como estaba.
 */
export function BotonBorrar({ etiqueta, texto, clase = 'btn chico fantasma', t = 14, consejo, lado, alBorrar }: {
  /** El nombre del botón para quien no lo ve. */
  etiqueta: string;
  /** Lo que lleva escrito junto al icono; sin esto, solo el icono. */
  texto?: string;
  clase?: string;
  t?: number;
  consejo?: string;
  lado?: 'izq';
  alBorrar: () => unknown;
}) {
  const [armado, fijarArmado] = useState(0);
  useEffect(() => {
    if (!armado) return;
    const id = setTimeout(() => fijarArmado(0), ESPERA_CONFIRMAR_MS);
    return () => clearTimeout(id);
  }, [armado]);
  if (armado) {
    return (
      <button
        class="btn chico peligro confirmar-borrado"
        aria-label={`${etiqueta}: ${tr('Confirmar')}`}
        onBlur={() => fijarArmado(0)}
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return;
          e.stopPropagation();
          fijarArmado(0);
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (performance.now() - armado < PAUSA_DOBLE_CLIC_MS) return;
          fijarArmado(0);
          alBorrar();
        }}
      >
        <Icono n="basura" t={t} /> {tr('Confirmar')}
      </button>
    );
  }
  return (
    <button class={clase} aria-label={etiqueta} data-tip={consejo} data-tip-lado={lado} onClick={(e) => { e.stopPropagation(); fijarArmado(performance.now()); }}>
      <Icono n="basura" t={t} />{texto ? ` ${texto}` : null}
    </button>
  );
}

export function Interruptor({ on, alCambiar, etiqueta }: { on: boolean; alCambiar: (v: boolean) => void; etiqueta: string }) {
  return <button class={`interruptor ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={etiqueta} onClick={() => alCambiar(!on)} />;
}

/** Anillo de progreso: comprensión de un texto o avance de una tarea. */
export function Anillo({ valor, t = 34, grosor = 4 }: { valor: number; t?: number; grosor?: number }) {
  const r = (t - grosor) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, valor));
  return (
    <svg class="ap-anillo" width={t} height={t} viewBox={`0 0 ${t} ${t}`} aria-hidden="true">
      <circle cx={t / 2} cy={t / 2} r={r} fill="none" stroke-width={grosor} class="pista" />
      <circle cx={t / 2} cy={t / 2} r={r} fill="none" stroke-width={grosor} class="valor" stroke-linecap="round" stroke-dasharray={c} stroke-dashoffset={c * (1 - v / 100)} transform={`rotate(-90 ${t / 2} ${t / 2})`} />
    </svg>
  );
}
