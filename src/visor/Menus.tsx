// Los menús del visor y lo que sale del mismo registro de órdenes (comandos.ts): la barra de menús con nombre, el menú
// contextual, la paleta de acciones (Ctrl+K) y la lista de atajos («?»). Todo se maneja también con el teclado, como los
// menús de un programa de escritorio: flechas, Intro, Esc y, en la barra, de un menú al de al lado.

import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { tr } from '../compartido/i18n';
import { Icono, type NombreIcono } from '../ui/iconos';
import { buscarOrdenes, type Comando, type EntradaMenu, entradasDe, type IdMenu, MENUS, mostrarAtajo } from './comandos';

const ITEMS = ':scope > [role^="menuitem"]:not([aria-disabled="true"]), :scope > .vs-menu-grupo-sub > [role^="menuitem"]';

const FLECHAS: Record<string, NombreIcono> = { '←': 'flecha-izq', '→': 'flecha', '↑': 'flecha-arriba', '↓': 'flecha-abajo' };

/** Un atajo con sus flechas dibujadas: en la letra de la interfaz, «→» es una raya con una punta que apenas se ve. */
export function Atajo({ texto }: { texto: string }) {
  return <>{texto.split(/([←→↑↓])/).map((t, i) => (FLECHAS[t] ? <Icono key={i} n={FLECHAS[t]} t={12} clase="vs-tecla-flecha" /> : t))}</>;
}

/** Mueve el foco entre las órdenes de un menú, sin entrar en sus submenús. */
function enfocar(menu: HTMLElement | null, cual: 'primera' | 'ultima' | 1 | -1) {
  if (!menu) return;
  const items = [...menu.querySelectorAll<HTMLElement>(ITEMS)];
  if (!items.length) return;
  const i = items.indexOf(document.activeElement as HTMLElement);
  const n = cual === 'primera' ? 0 : cual === 'ultima' ? items.length - 1 : i < 0 ? (cual === 1 ? 0 : items.length - 1) : (i + cual + items.length) % items.length;
  items[n].focus();
}

function Orden({ c, alElegir }: { c: Comando; alElegir: (c: Comando) => void }) {
  const rol = c.tipo === 'casilla' ? 'menuitemcheckbox' : c.tipo === 'opcion' ? 'menuitemradio' : 'menuitem';
  return (
    <button
      type="button"
      role={rol}
      tabIndex={-1}
      class="vs-menu-orden"
      data-orden={c.id}
      aria-checked={c.tipo ? !!c.marcada : undefined}
      aria-disabled={c.deshabilitada || undefined}
      onClick={() => alElegir(c)}
      onMouseEnter={(e) => e.currentTarget.focus({ preventScroll: true })}
    >
      <span class="vs-menu-marca" aria-hidden="true">
        {c.tipo === 'casilla' && c.marcada ? <Icono n="check" t={14} /> : c.tipo === 'opcion' && c.marcada ? <span class="vs-menu-punto" /> : c.icono ? <Icono n={c.icono} t={15} /> : null}
      </span>
      <span class="vs-menu-texto">
        <span class="vs-menu-etiqueta">{c.etiqueta}</span>
        {c.deshabilitada && c.ayuda && <small class="vs-menu-porque">{c.ayuda}</small>}
      </span>
      {c.atajo && (
        <kbd class="vs-menu-atajo">
          <Atajo texto={mostrarAtajo(c.atajo)} />
        </kbd>
      )}
    </button>
  );
}

/**
 * Una lista de órdenes: la de un menú de la barra, la del menú contextual o la del zoom. Los submenús se abren con un clic
 * o con la flecha derecha, a un lado, y por dentro no tienen otros.
 */
export function ListaMenu({ entradas, etiqueta, alCerrar, alLado, clase = '', estilo, enfocarPrimera = false }: {
  entradas: EntradaMenu[];
  etiqueta: string;
  /** Con devolverFoco, el foco vuelve a quien abrió el menú: se cerró con Esc, no con un clic en otra parte. */
  alCerrar: (devolverFoco: boolean) => void;
  /** Las flechas a los lados, fuera de un submenú: al menú de al lado, en la barra. */
  alLado?: (paso: -1 | 1) => void;
  clase?: string;
  estilo?: Record<string, string | number>;
  enfocarPrimera?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [sub, fijarSub] = useState<{ nombre: string; teclado: boolean } | null>(null);
  useLayoutEffect(() => {
    if (enfocarPrimera) enfocar(ref.current, 'primera');
    else ref.current?.focus({ preventScroll: true });
  }, []);
  const elegir = (c: Comando) => {
    if (c.deshabilitada) return;
    alCerrar(false);
    c.ejecutar();
  };
  const tecla = (e: KeyboardEvent) => {
    const enSub = (e.target as HTMLElement).closest('.vs-submenu');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
      const menu = (enSub as HTMLElement | null) ?? ref.current;
      enfocar(menu, e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : e.key === 'Home' ? 'primera' : 'ultima');
    } else if (e.key === 'ArrowRight' && !enSub) {
      const nombre = (e.target as HTMLElement).closest<HTMLElement>('[data-submenu]')?.dataset.submenu;
      if (nombre) fijarSub({ nombre, teclado: true });
      else if (alLado) alLado(1);
      else return;
    } else if (e.key === 'ArrowLeft') {
      if (enSub) {
        const nombre = sub?.nombre;
        fijarSub(null);
        ref.current?.querySelector<HTMLElement>(`[data-submenu="${CSS.escape(nombre ?? '')}"]`)?.focus();
      } else if (alLado) alLado(-1);
      else return;
    } else if (e.key === 'Escape') {
      if (enSub) {
        const nombre = sub?.nombre;
        fijarSub(null);
        ref.current?.querySelector<HTMLElement>(`[data-submenu="${CSS.escape(nombre ?? '')}"]`)?.focus();
      } else alCerrar(true);
    } else if (e.key === 'Tab') {
      alCerrar(false);
      return;
    } else return;
    e.preventDefault();
    e.stopPropagation();
  };
  return (
    <div ref={ref} role="menu" aria-label={etiqueta} tabIndex={-1} class={`vs-menu ${clase}`} style={estilo} onKeyDown={tecla}>
      {entradas.map((x, i) =>
        x.tipo === 'raya' ? (
          <div key={`r${i}`} role="separator" class="vs-menu-raya" />
        ) : x.tipo === 'orden' ? (
          <Orden key={x.orden.id} c={x.orden} alElegir={elegir} />
        ) : (
          <div key={x.nombre} class="vs-menu-grupo-sub">
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              aria-haspopup="menu"
              aria-expanded={sub?.nombre === x.nombre}
              class={`vs-menu-orden vs-menu-con-sub ${sub?.nombre === x.nombre ? 'abierto' : ''}`}
              data-submenu={x.nombre}
              onClick={() => fijarSub(sub?.nombre === x.nombre ? null : { nombre: x.nombre, teclado: false })}
              onMouseEnter={(e) => e.currentTarget.focus({ preventScroll: true })}
            >
              <span class="vs-menu-marca" aria-hidden="true" />
              <span class="vs-menu-texto">
                <span class="vs-menu-etiqueta">{x.nombre}</span>
                <small class="vs-menu-valor">{x.ordenes.find((o) => o.tipo === 'opcion' && o.marcada)?.etiqueta ?? ''}</small>
              </span>
              <Icono n="derecha" t={13} />
            </button>
            {sub?.nombre === x.nombre && <Submenu ordenes={x.ordenes} nombre={x.nombre} teclado={sub.teclado} alElegir={elegir} />}
          </div>
        )
      )}
    </div>
  );
}

function Submenu({ ordenes, nombre, teclado, alElegir }: { ordenes: Comando[]; nombre: string; teclado: boolean; alElegir: (c: Comando) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  // A la derecha de su orden; si no cabe, a la izquierda. Y nunca por debajo de la ventana.
  const [lado, fijarLado] = useState<{ izquierda: boolean; subir: number }>({ izquierda: false, subir: 0 });
  useLayoutEffect(() => {
    const r = ref.current?.getBoundingClientRect();
    if (r) fijarLado({ izquierda: r.right > window.innerWidth - 8, subir: Math.max(0, r.bottom - (window.innerHeight - 8)) });
    if (teclado) enfocar(ref.current, 'primera');
  }, []);
  return (
    <div ref={ref} role="menu" aria-label={nombre} class={`vs-menu vs-submenu ${lado.izquierda ? 'izquierda' : ''}`} style={{ marginTop: `${-lado.subir}px` }}>
      {ordenes.map((c) => (
        <Orden key={c.id} c={c} alElegir={alElegir} />
      ))}
    </div>
  );
}

/** Cierra lo abierto con un clic fuera de lo que lo contiene. */
export function useClicFuera(abierto: boolean, contenedores: () => (Element | null)[], alCerrar: () => void) {
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!contenedores().some((c) => c?.contains(t))) alCerrar();
    };
    window.addEventListener('pointerdown', fuera, true);
    return () => window.removeEventListener('pointerdown', fuera, true);
  }, [abierto]);
}

/**
 * La barra de menús con nombre. Un clic abre un menú; con uno abierto, pasar a otro nombre lo abre, como en el
 * escritorio. Con el teclado: Intro o flecha abajo abren, y las flechas a los lados van al menú de al lado.
 */
export function BarraMenus({ ordenes, abierto, alAbrir }: { ordenes: Comando[]; abierto: { menu: IdMenu; teclado: boolean } | null; alAbrir: (m: { menu: IdMenu; teclado: boolean } | null) => void }) {
  const ref = useRef<HTMLElement>(null);
  useClicFuera(!!abierto, () => [ref.current], () => alAbrir(null));
  const visibles = MENUS.filter((m) => ordenes.some((o) => o.menu === m.id));
  const lado = (paso: -1 | 1) => {
    if (!abierto) return;
    const i = visibles.findIndex((m) => m.id === abierto.menu);
    alAbrir({ menu: visibles[(i + paso + visibles.length) % visibles.length].id, teclado: true });
  };
  const cerrar = (devolverFoco: boolean) => {
    const m = abierto?.menu;
    alAbrir(null);
    if (devolverFoco && m) ref.current?.querySelector<HTMLElement>(`[data-menu="${m}"]`)?.focus();
  };
  return (
    <nav ref={ref} class="vs-menus" role="menubar" aria-label={tr('Menús')}>
      {visibles.map((m) => (
        <div key={m.id} class="vs-menus-uno">
          <button
            type="button"
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={abierto?.menu === m.id}
            class={`vs-menus-nombre ${abierto?.menu === m.id ? 'abierto' : ''}`}
            data-menu={m.id}
            onClick={(e) => alAbrir(abierto?.menu === m.id ? null : { menu: m.id, teclado: e.detail === 0 })}
            onMouseEnter={() => abierto && abierto.menu !== m.id && alAbrir({ menu: m.id, teclado: false })}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') alAbrir({ menu: m.id, teclado: true });
              else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                const i = visibles.findIndex((x) => x.id === m.id);
                const otro = visibles[(i + (e.key === 'ArrowRight' ? 1 : -1) + visibles.length) % visibles.length];
                ref.current?.querySelector<HTMLElement>(`[data-menu="${otro.id}"]`)?.focus();
              } else return;
              e.preventDefault();
            }}
          >
            {tr(m.nombre)}
          </button>
          {abierto?.menu === m.id && <ListaMenu key={m.id} entradas={entradasDe(ordenes, m.id)} etiqueta={tr(m.nombre)} alCerrar={cerrar} alLado={lado} enfocarPrimera={abierto.teclado} />}
        </div>
      ))}
    </nav>
  );
}

/** Un menú suelto, junto al puntero: el contextual. Se queda dentro de la ventana. */
export function MenuFlotante({ x, y, ordenes, etiqueta, alCerrar }: { x: number; y: number; ordenes: Comando[]; etiqueta: string; alCerrar: () => void }) {
  const caja = useRef<HTMLDivElement>(null);
  const [sitio, fijarSitio] = useState({ left: x, top: y });
  useLayoutEffect(() => {
    const r = caja.current?.firstElementChild?.getBoundingClientRect();
    if (!r) return;
    fijarSitio({ left: Math.max(8, Math.min(x, window.innerWidth - r.width - 8)), top: Math.max(8, Math.min(y, window.innerHeight - r.height - 8)) });
  }, [x, y]);
  useClicFuera(true, () => [caja.current], alCerrar);
  useEffect(() => {
    const fuera = () => alCerrar();
    window.addEventListener('blur', fuera);
    window.addEventListener('resize', fuera);
    return () => {
      window.removeEventListener('blur', fuera);
      window.removeEventListener('resize', fuera);
    };
  }, []);
  // Las órdenes del contextual van por grupos, como en un menú de la barra.
  const entradas = useMemo(() => entradasDe(ordenes.map((o) => ({ ...o, menu: 'ver' as const })), 'ver'), [ordenes]);
  return (
    <div ref={caja} class="vs-contextual" style={{ left: `${sitio.left}px`, top: `${sitio.top}px` }}>
      <ListaMenu entradas={entradas} etiqueta={etiqueta} alCerrar={alCerrar} enfocarPrimera={false} />
    </div>
  );
}

/** Un diálogo sobre el visor: la paleta y los atajos. Esc o un clic fuera lo cierran. */
function Dialogo({ etiqueta, clase, alCerrar, children }: { etiqueta: string; clase: string; alCerrar: () => void; children: ComponentChildren }) {
  return (
    <div
      class="vs-velo"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) alCerrar();
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        e.stopPropagation();
        alCerrar();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={etiqueta} class={`vs-dialogo ${clase}`}>
        {children}
      </div>
    </div>
  );
}

/**
 * La paleta de acciones: se escribe lo que se quiere hacer y se encuentra la orden, esté en el menú que esté. Un número
 * lleva a esa página. Las flechas eligen e Intro ejecuta.
 */
export function Paleta({ ordenes, total, alIrA, alCerrar }: { ordenes: Comando[]; total: number; alIrA: (n: number) => void; alCerrar: () => void }) {
  const [consulta, fijarConsulta] = useState('');
  const [elegida, fijarElegida] = useState(0);
  const campo = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  useLayoutEffect(() => campo.current?.focus(), []);
  const nombreMenu = (m: IdMenu) => tr(MENUS.find((x) => x.id === m)?.nombre ?? m);
  const numero = /^\s*\d+\s*$/.test(consulta) ? parseInt(consulta, 10) : NaN;
  const irA: Comando | null =
    numero >= 1 && numero <= total ? { id: 'ir-a', etiqueta: tr('Ir a la página {0}', numero), menu: 'ir', grupo: 'ir', icono: 'siguiente', ejecutar: () => alIrA(numero - 1) } : null;
  const halladas = useMemo(() => [...(irA ? [irA] : []), ...buscarOrdenes(ordenes, consulta, nombreMenu)], [ordenes, consulta]);
  useEffect(() => fijarElegida(0), [consulta]);
  useEffect(() => {
    lista.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [elegida]);
  const ejecutar = (c: Comando | undefined) => {
    if (!c || c.deshabilitada) return;
    alCerrar();
    c.ejecutar();
  };
  return (
    <Dialogo etiqueta={tr('Buscar una acción')} clase="vs-paleta" alCerrar={alCerrar}>
      <div class="vs-paleta-campo">
        <Icono n="comando" t={17} />
        <input
          ref={campo}
          class="campo"
          role="combobox"
          aria-expanded="true"
          aria-controls="vs-paleta-lista"
          aria-activedescendant={halladas[elegida] ? `vs-paleta-${halladas[elegida].id}` : undefined}
          placeholder={tr('Busca una acción o escribe un número de página')}
          value={consulta}
          onInput={(e) => fijarConsulta(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') fijarElegida((i) => Math.min(halladas.length - 1, i + 1));
            else if (e.key === 'ArrowUp') fijarElegida((i) => Math.max(0, i - 1));
            else if (e.key === 'Enter' && !e.isComposing) ejecutar(halladas[elegida]);
            else return;
            e.preventDefault();
          }}
        />
      </div>
      <ul ref={lista} id="vs-paleta-lista" role="listbox" class="vs-paleta-lista" aria-label={tr('Acciones')}>
        {halladas.map((c, i) => (
          <li
            key={c.id}
            id={`vs-paleta-${c.id}`}
            role="option"
            aria-selected={i === elegida}
            aria-disabled={c.deshabilitada || undefined}
            data-orden={c.id}
            data-marcada={c.tipo ? String(!!c.marcada) : undefined}
            class={`vs-paleta-orden ${i === elegida ? 'elegida' : ''}`}
            onMouseMove={() => i !== elegida && fijarElegida(i)}
            onClick={() => ejecutar(c)}
          >
            <span class="vs-menu-marca" aria-hidden="true">
              {c.tipo === 'casilla' && c.marcada ? <Icono n="check" t={14} /> : c.tipo === 'opcion' && c.marcada ? <span class="vs-menu-punto" /> : c.icono ? <Icono n={c.icono} t={15} /> : null}
            </span>
            <span class="vs-menu-texto">
              <span class="vs-menu-etiqueta">{c.etiqueta}</span>
              <small class="vs-paleta-donde">{[nombreMenu(c.menu), c.submenu].filter(Boolean).join(' › ')}{c.ayuda ? ` · ${c.ayuda}` : ''}</small>
            </span>
            {c.atajo && (
              <kbd class="vs-menu-atajo">
                <Atajo texto={mostrarAtajo(c.atajo)} />
              </kbd>
            )}
          </li>
        ))}
        {!halladas.length && <li class="vs-paleta-nada ayuda">{tr('Ninguna acción se llama así')}</li>}
      </ul>
    </Dialogo>
  );
}

/** Los atajos de teclado: los del registro, por menús, y los que atiende el visor por su cuenta. */
export function Atajos({ ordenes, rtl, alCerrar }: { ordenes: Comando[]; rtl: boolean; alCerrar: () => void }) {
  const cerrar = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => cerrar.current?.focus(), []);
  const fijos: [string[], string][] = [
    [rtl ? ['←'] : ['→'], tr('Página siguiente')],
    [rtl ? ['→'] : ['←'], tr('Página anterior')],
    [[tr('Re Pág y Av Pág'), tr('Espacio')], tr('Pasar de página')],
    [[tr('Inicio y Fin')], tr('La primera y la última página')],
    [['Esc'], tr('Cerrar lo abierto')],
    [[mostrarAtajo('Ctrl+C')], tr('Copiar lo abierto en la ventana')],
    [['1', '2', '3', '4'], tr('El estado de la palabra elegida: desconocida, rastrear, conocida, ignorada')],
    [[mostrarAtajo('Ctrl+0').replace(/\+?0$/, ''), tr('Rueda del ratón')], tr('Acercar y alejar')],
  ];
  const conTecla = ordenes.filter((o) => o.atajo && !o.atajoAparte);
  const porMenu = MENUS.map((m) => ({ m, l: [...conTecla, ...ordenes.filter((o) => o.id === 'paleta' || o.id === 'buscar')].filter((o) => o.menu === m.id) })).filter((x) => x.l.length);
  return (
    <Dialogo etiqueta={tr('Atajos de teclado')} clase="vs-atajos" alCerrar={alCerrar}>
      <div class="vs-panel-titulo">
        <Icono n="teclado" t={17} />
        <b>{tr('Atajos de teclado')}</b>
        <button ref={cerrar} class="btn-icono chico vs-cerrar" aria-label={tr('Cerrar')} onClick={alCerrar}>
          <Icono n="cerrar" t={15} />
        </button>
      </div>
      <div class="vs-atajos-columnas">
        <section>
          <h3>{tr('Leer')}</h3>
          <dl>
            {fijos.map(([teclas, que]) => (
              <div key={que} class="vs-atajo">
                <dt>
                  {teclas.map((t, i) => (
                    <kbd key={i}>
                      <Atajo texto={t} />
                    </kbd>
                  ))}
                </dt>
                <dd>{que}</dd>
              </div>
            ))}
          </dl>
        </section>
        {porMenu.map(({ m, l }) => (
          <section key={m.id}>
            <h3>{tr(m.nombre)}</h3>
            <dl>
              {l.map((o) => (
                <div key={o.id} class="vs-atajo">
                  <dt>
                    <kbd>
                      <Atajo texto={mostrarAtajo(o.atajo!)} />
                    </kbd>
                  </dt>
                  <dd>{o.id === 'atras' ? tr('Atrás') : o.etiqueta}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialogo>
  );
}
