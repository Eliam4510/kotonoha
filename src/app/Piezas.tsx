// Piezas que comparten las pantallas de la app.

import type { ComponentChildren } from 'preact';
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
