// Cambiar de lengua a la vista: en Inicio, un selector con las tres; en la barra lateral, un menú con la actual. Cada
// lengua lleva una bandera pequeña para reconocerla de un vistazo y su nombre escrito en ella misma. Las banderas son
// dibujos: Windows no pinta los emoji de bandera, y en su lugar saldrían dos letras.

import { useEffect, useRef, useState } from 'preact/hooks';
import type { Ajustes } from '../compartido/ajustes';
import { tr } from '../compartido/i18n';
import { PAQUETES, paqueteDe } from '../lenguas';
import { Icono } from '../ui/iconos';
import { estudiarLengua } from '../ui/lengua';

/** El alto de las franjas de la bandera de Estados Unidos: trece en 20 unidades. */
const FRANJA = 20 / 13;

/** La bandera de una lengua: Japón, Estados Unidos (el inglés de Kotonoha se pronuncia así por omisión) y Alemania. */
export function Bandera({ id, t = 18 }: { id: string; t?: number }) {
  const props = { class: 'ap-bandera', width: t, height: Math.round((t * 2) / 3), viewBox: '0 0 30 20', 'aria-hidden': 'true' as const };
  if (id === 'ja') {
    return (
      <svg {...props}>
        <rect width="30" height="20" fill="#FFFFFF" />
        <circle cx="15" cy="10" r="6" fill="#BC002D" />
      </svg>
    );
  }
  if (id === 'de') {
    return (
      <svg {...props}>
        <rect width="30" height="6.67" fill="#000000" />
        <rect y="6.67" width="30" height="6.67" fill="#DD0000" />
        <rect y="13.33" width="30" height="6.67" fill="#FFCE00" />
      </svg>
    );
  }
  if (id === 'en') {
    return (
      <svg {...props}>
        <rect width="30" height="20" fill="#FFFFFF" />
        {Array.from({ length: 7 }, (_, i) => <rect key={i} y={i * 2 * FRANJA} width="30" height={FRANJA} fill="#B22234" />)}
        <rect width="12" height={7 * FRANJA} fill="#3C3B6E" />
      </svg>
    );
  }
  return <span class="ap-bandera ap-bandera-codigo" aria-hidden="true">{id.toUpperCase()}</span>;
}

function cambiar(a: Ajustes, id: string) {
  if (id !== a.idiomaObjetivo) estudiarLengua(a, id).catch(console.error);
}

/** En Inicio: las tres lenguas a la vista, con la actual marcada. */
export function SelectorLengua({ a }: { a: Ajustes }) {
  return (
    <div class="segmentado ap-lengua-segmentado" role="radiogroup" aria-label={tr('Idioma que estudias')}>
      {PAQUETES.map((p) => {
        const activa = p.id === a.idiomaObjetivo;
        return (
          <button key={p.id} role="radio" aria-checked={activa} class={activa ? 'activo' : ''} data-lengua={p.id} data-tip={tr(p.textos.nombre)} onClick={() => cambiar(a, p.id)}>
            <Bandera id={p.id} />
            <span lang={p.id}>{p.nombrePropio}</span>
          </button>
        );
      })}
    </div>
  );
}

/** En la barra lateral: la lengua actual, que abre el menú con las demás. Plegada, solo la bandera. */
export function MenuLengua({ a, compacta }: { a: Ajustes; compacta: boolean }) {
  const [abierto, fijarAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const actual = paqueteDe(a.idiomaObjetivo);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) fijarAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fijarAbierto(false);
    };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  return (
    // Esc se atiende también aquí: el oyente del documento llega después de pintar, y el foco suele estar en el menú.
    <div class="ap-lengua-menu" ref={raiz} onKeyDown={(e) => e.key === 'Escape' && abierto && fijarAbierto(false)}>
      <button
        class="ap-lengua-actual"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label={tr('Idioma que estudias: {0}', tr(actual.textos.nombre))}
        data-tip={compacta && !abierto ? tr('Idioma que estudias: {0}', tr(actual.textos.nombre)) : undefined}
        data-tip-lado={compacta ? 'der' : undefined}
        onClick={() => fijarAbierto(!abierto)}
      >
        <Bandera id={actual.id} t={20} />
        {!compacta && <span lang={actual.id}>{actual.nombrePropio}</span>}
        {!compacta && <Icono n="abajo" t={13} />}
      </button>
      {abierto && (
        <div class="ap-lengua-lista" role="menu" aria-label={tr('Idioma que estudias')}>
          {PAQUETES.map((p) => (
            <button
              key={p.id}
              role="menuitemradio"
              aria-checked={p.id === a.idiomaObjetivo}
              class={p.id === a.idiomaObjetivo ? 'activa' : ''}
              data-lengua={p.id}
              onClick={() => {
                fijarAbierto(false);
                cambiar(a, p.id);
              }}
            >
              <Bandera id={p.id} t={20} />
              <span class="ap-lengua-propio" lang={p.id}>{p.nombrePropio}</span>
              <span class="ap-lengua-nombre">{tr(p.textos.nombre)}</span>
              {p.id === a.idiomaObjetivo && <Icono n="ok" t={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
