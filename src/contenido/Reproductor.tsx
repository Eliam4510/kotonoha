// Interfaz sobre el video: isla, subtítulos, navegador, paneles y ventana de palabra.

import { signal, useComputed, useSignal, useSignalEffect } from '@preact/signals';
import { memo } from 'preact/compat';
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { type Ajustes, guardarAjustes, NOMBRES_MODO } from '../compartido/ajustes';
import { fondo, motor } from '../compartido/rpc';
import type { EstadoPalabra, LineaAnalizada, PalabraToken } from '../compartido/tipos';
import { filtrarLineas, type FiltroNavegador, NOMBRES_NIVEL } from '../nucleo/frases';
import { visibilidadVelo } from '../nucleo/modos';
import { type CajaSubs, conImanes, enZonaActivacion, enZonaSegura, ESPERA_MOSTRAR_MS, ESPERA_OCULTAR_MS, factorLargo, pixelesDe, type PosicionSubs, posicionDesde, posicionInicial } from '../nucleo/presentacion';
import type { Linea } from '../nucleo/subtitulos';
import { pegarSignos } from '../nucleo/tokens';
import { enviarAlCreador } from '../ui/borrador';
import { colocarJunto, Ficha, PanelFlujo } from '../ui/Ficha';
import { Icono, Logo, type NombreIcono } from '../ui/iconos';
import {
  abrirConsultaDe,
  alAbrirConsulta,
  alCerrarConsulta,
  alEntrarSubtitulo,
  alSalirSubtitulo,
  alternarMarcador,
  alternarSeleccion,
  anclarLinea,
  combinarSeleccionadas,
  fijarAbrirConsulta,
  importarArchivo,
  irALinea,
  pausasEnLinea,
  refrescarAnalisis,
  videoEnPantalla,
} from './controlador';
import {
  ajustes,
  analisisEnCurso,
  anuncio,
  avisos,
  barraVisible,
  capturaActiva,
  cargandoPista,
  clasesLineas,
  configModo,
  consulta,
  consultaGramatica,
  encimaSubtitulo,
  errorPista,
  estadisticas,
  filtro,
  correccion,
  generacion,
  originales,
  indiceActivo,
  indiceVisual,
  infoVideo,
  lineasObjetivo,
  lineasSecundarias,
  marcadas,
  opcionesFrase,
  origenSubs,
  panel,
  pausado,
  quitarAviso,
  rectVideo,
  secundariaVisual,
  seleccionadas,
  tipoPausa,
  verTemporal,
  whisper,
} from './estado';
import { Anillo, PanelesFlotantes, pestanaVideo } from './Paneles';
import { contextoDe, crearUnClic, crearVarias, enviarACreador } from './tarjetas';

export const ANCHO_NAVEGADOR = 380;

export const ocultarParaCaptura = { valor: false, oyente: (_v: boolean) => {} };
const fijarOculto = (v: boolean) => ocultarParaCaptura.oyente(v);

export const cambiarAjuste = (c: Partial<Ajustes>) => {
  ajustes.value = { ...ajustes.value, ...c };
  guardarAjustes(c).catch(console.error);
};

// ---------- Palabra ----------

function clasesRaiz(a: Ajustes) {
  return [
    a.mostrarEstado ? '' : 'sin-estado',
    a.furigana === 'alPasar' ? 'fur-alpasar' : a.furigana === 'ninguna' ? 'fur-ninguna' : a.furigana === 'desconocidas' ? 'fur-desconocidas' : '',
    a.glosas === 'alPasar' ? 'glosas-alpasar' : a.glosas === 'desconocidas' ? 'glosas-desconocidas' : '',
    a.colorAcento === 'alPasar' ? 'color-alpasar' : '',
  ].join(' ');
}

let temporizadorCierre: ReturnType<typeof setTimeout> | null = null;
let temporizadorApertura: ReturnType<typeof setTimeout> | null = null;
/** Al soltar los subtítulos el puntero queda sobre una palabra: eso no es querer consultarla. */
let sinFichaHasta = 0;
/** La palabra sobre la que ya se resolvió qué hacer: no se reabre hasta salir de ella. */
let palabraAtendida: PalabraToken | null = null;

// Cuando una línea nueva aparece bajo un ratón quieto, el navegador avisa de que ha «entrado» en ella.
// Ese aviso llega con las coordenadas de siempre, y eso lo distingue de un movimiento de verdad, que
// trae coordenadas nuevas porque el navegador avisa de la entrada antes de avisar del movimiento.
let ratonX = -1;
let ratonY = -1;
window.addEventListener(
  'mousemove',
  (e) => {
    ratonX = e.clientX;
    ratonY = e.clientY;
  },
  { capture: true, passive: true }
);
const ratonQuieto = (e: MouseEvent) => e.clientX === ratonX && e.clientY === ratonY;

function programarCierre() {
  if (temporizadorCierre) clearTimeout(temporizadorCierre);
  temporizadorCierre = setTimeout(() => {
    if (consulta.value && !consulta.value.fijada) cerrarConsulta();
  }, 260);
}

function cancelarCierre() {
  if (temporizadorCierre) clearTimeout(temporizadorCierre);
  temporizadorCierre = null;
}

export function cerrarConsulta() {
  if (!consulta.value) return;
  consulta.value = null;
  alCerrarConsulta();
}

function abrirConsulta(p: PalabraToken, l: LineaAnalizada | null, el: Element, fijada: boolean) {
  const r = el.getBoundingClientRect();
  const yaAbierta = !!consulta.value;
  consulta.value = { palabra: p, linea: l, ancla: { left: r.left, top: r.top, width: r.width, height: r.height }, fijada };
  if (!yaAbierta) alAbrirConsulta();
}

function alPasarPorPalabra(p: PalabraToken, l: LineaAnalizada | null, el: Element) {
  const c = ajustes.value;
  if (moviendoSubs.value || performance.now() < sinFichaHasta) return;
  palabraAtendida = p;
  if (!c.popupAlPasar || (c.popupSoloDesconocidas && p.estado !== 'desconocida')) return;
  if (temporizadorApertura) clearTimeout(temporizadorApertura);
  temporizadorApertura = setTimeout(() => abrirConsulta(p, l, el, false), 130);
}

export const PalabraVista = memo(function PalabraVista({ p, l }: { p: PalabraToken; l: LineaAnalizada | null }) {
  if (!p.esPalabra) return <span>{pegarSignos(p.superficie)}</span>;
  const a = ajustes.value;
  const clases = ['pal', `est-${p.estado}`];
  if (p.rastreada) clases.push('rastreada');
  if (p.patron && a.colorAcento !== 'ninguno') clases.push(`ac-${p.patron}`);
  if (p.lecturaCorregida) clases.push('leida');
  if (p.sentido && p.uso && p.uso !== 'literal') clases.push('con-sentido');
  return (
    <span
      class={clases.join(' ')}
      data-clave={p.clave}
      onMouseEnter={(e) => {
        cancelarCierre();
        if (!ratonQuieto(e)) alPasarPorPalabra(p, l, e.currentTarget);
      }}
      onMouseMove={(e) => {
        // Si la línea apareció bajo el ratón, el primer movimiento de verdad es el que cuenta.
        if (palabraAtendida !== p && (e.movementX || e.movementY)) alPasarPorPalabra(p, l, e.currentTarget);
      }}
      onMouseLeave={() => {
        palabraAtendida = null;
        if (temporizadorApertura) clearTimeout(temporizadorApertura);
        programarCierre();
      }}
      onClick={(e) => {
        e.stopPropagation();
        // Si no, la apertura pendiente por pasar el ratón llegaría después y dejaría de estar fijada.
        if (temporizadorApertura) clearTimeout(temporizadorApertura);
        palabraAtendida = p;
        abrirConsulta(p, l, e.currentTarget, true);
      }}
    >
      {p.furigana.map((s, i) =>
        s.lectura ? (
          <ruby key={i}>
            {s.texto}
            <rt>{s.lectura}</rt>
          </ruby>
        ) : (
          <span key={i}>{s.texto}</span>
        )
      )}
      {p.glosa && <span class="glosa">{p.glosa}</span>}
    </span>
  );
});

// ---------- Subtítulos ----------

const moviendoSubs = signal(false);
const guiaSubs = signal({ centrado: false, enBase: false });

function Subtitulos() {
  const oculto = useSignal(false);
  useEffect(() => {
    ocultarParaCaptura.oyente = (v) => (oculto.value = v);
  }, []);

  const zona = useRef<HTMLDivElement>(null);
  const bloque = useRef<HTMLDivElement>(null);
  const fondoSub = useRef<HTMLDivElement>(null);
  const contenido = useRef<HTMLDivElement>(null);
  const enArrastre = useRef<PosicionSubs | null>(null);
  const colocada = useRef({ left: 0, top: 0 });
  const arriba = useRef(false);
  const ultima = useRef<{ linea: LineaAnalizada | null; sec: Linea | null; visObjetivo: string; visSecundaria: string } | null>(null);

  const caja = (): CajaSubs | null => {
    const z = zona.current;
    const c = contenido.current;
    if (!z || !c) return null;
    return { W: z.clientWidth, H: z.clientHeight, w: c.offsetWidth, h: c.offsetHeight };
  };

  const colocar = () => {
    const c = caja();
    const b = bloque.current;
    if (!c || !b) return;
    const p = enArrastre.current ?? ajustes.value.subsPosicion ?? (arriba.current ? { x: 0.5, y: 0.78 } : posicionInicial(c.H));
    const { left, top } = pixelesDe(p, c);
    colocada.current = { left, top };
    b.style.transform = `translate(${left}px, ${top}px)`;
    const f = fondoSub.current;
    if (f) {
      f.style.width = `${c.w}px`;
      f.style.height = `${c.h}px`;
    }
  };

  // Antes de pintar: el fondo y la posición siguen al texto en el mismo fotograma, sin saltos.
  useEffect(() => {
    const o = new ResizeObserver(colocar);
    if (contenido.current) o.observe(contenido.current);
    if (zona.current) o.observe(zona.current);
    return () => o.disconnect();
  });
  useLayoutEffect(colocar);

  const alPulsar = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const destino = e.target as Element;
    if (destino.closest('button, .chip-gram')) return;
    e.stopPropagation();
    const sobrePalabra = !!destino.closest('.pal');
    // Pulsar una palabra es para consultarla: solo se mueve si de verdad hay arrastre.
    if (!sobrePalabra) e.preventDefault();
    const umbral = sobrePalabra ? 8 : 3;
    const { clientX: x0, clientY: y0, pointerId } = e;
    const inicio = { ...colocada.current };
    let moviendo = false;
    const mover = (m: PointerEvent) => {
      const dx = m.clientX - x0;
      const dy = m.clientY - y0;
      if (!moviendo) {
        if (Math.hypot(dx, dy) < umbral) return;
        moviendo = true;
        moviendoSubs.value = true;
        bloque.current?.setPointerCapture(pointerId);
        if (temporizadorApertura) clearTimeout(temporizadorApertura);
        cerrarConsulta();
        getSelection()?.removeAllRanges();
      }
      const c = caja();
      if (!c) return;
      const r = conImanes(inicio.left + dx, inicio.top + dy, c);
      guiaSubs.value = { centrado: r.centrado, enBase: r.enBase };
      enArrastre.current = posicionDesde(r.left, r.top, c);
      colocar();
    };
    const fin = () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', fin);
      window.removeEventListener('pointercancel', fin);
      if (!moviendo) return;
      const { centrado, enBase } = guiaSubs.value;
      const p = enArrastre.current;
      enArrastre.current = null;
      moviendoSubs.value = false;
      sinFichaHasta = performance.now() + 500;
      // En el sitio de siempre no hace falta recordar nada: así sigue bien si cambia el video.
      cambiarAjuste({ subsPosicion: centrado && enBase ? null : p });
      // El clic que sigue al soltar no debe abrir la palabra sobre la que terminó.
      const tragar = (c: Event) => {
        c.stopPropagation();
        c.preventDefault();
      };
      window.addEventListener('click', tragar, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', tragar, { capture: true }), 0);
    };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', fin);
    window.addEventListener('pointercancel', fin);
  };

  const r = rectVideo.value;
  const a = ajustes.value;
  const i = indiceVisual.value;
  const lineas = lineasObjetivo.value;
  const lineaActual = i >= 0 ? lineas[i] : null;
  const secActual = secundariaVisual.value;
  if (!r || anuncio.value || !a.activo) return <div class="zona-subs" ref={zona} hidden />;

  const cfg = configModo.value;
  const clases = i >= 0 ? clasesLineas.value[i] : new Set<never>();
  const ctx = {
    pausado: pausado.value,
    tipoPausa: tipoPausa.value,
    autoEnLinea: i >= 0 ? pausasEnLinea(i) : 0,
    clases,
    encima: encimaSubtitulo.value,
  };
  const visObjetivoAhora = a.ocultarObjetivo ? 'oculta' : visibilidadVelo(cfg.velarObjetivo, ctx);
  const visSecundariaAhora = a.ocultarSecundario ? 'oculta' : visibilidadVelo(cfg.velarSecundario, ctx);

  const hayObjetivo = !!lineaActual && visObjetivoAhora !== 'oculta';
  const haySecundaria = !!secActual && visSecundariaAhora !== 'oculta';
  const hay = hayObjetivo || haySecundaria;
  // Al quedarse sin línea, la última se desvanece en lugar de desaparecer de golpe.
  if (hay) ultima.current = { linea: hayObjetivo ? lineaActual : null, sec: haySecundaria ? secActual : null, visObjetivo: visObjetivoAhora, visSecundaria: visSecundariaAhora };
  else if (!lineas.length && !lineasSecundarias.value.length) ultima.current = null;
  const v = ultima.current;
  const linea = v?.linea ?? null;
  const sec = v?.sec ?? null;
  const visObjetivo = v?.visObjetivo ?? 'visible';
  const visSecundaria = v?.visSecundaria ?? 'visible';
  arriba.current = !!linea?.arriba;

  const base = Math.max(16, Math.min(r.height * 0.05, 52));
  const anchoLibre = a.navegadorAbierto ? Math.max(240, Math.min(r.width, innerWidth - ANCHO_NAVEGADOR - r.left)) : r.width;
  const estiloZona = {
    left: `${r.left}px`,
    width: `${anchoLibre}px`,
    top: `${r.top}px`,
    height: `${r.height}px`,
    '--op-sombra': String(a.opacidadSombra),
    '--base': `${base}px`,
  };

  return (
    <div class={`zona-subs ${oculto.value ? 'oculta-captura' : ''}`} ref={zona} style={estiloZona}>
      {moviendoSubs.value && guiaSubs.value.centrado && <div class="subs-guia" aria-hidden="true" />}
      {v && (
        <div
          class={`subs-bloque ${a.sombra ? 'con-sombra' : ''} ${hay ? '' : 'saliendo'} ${moviendoSubs.value ? 'arrastrando' : ''}`}
          ref={bloque}
          onPointerDown={alPulsar}
          onClick={(e) => e.stopPropagation()}
          onDblClick={(e) => {
            e.stopPropagation();
            if (!(e.target as Element).closest('.pal, button')) cambiarAjuste({ subsPosicion: null });
          }}
        >
          <div class="subs-fondo" ref={fondoSub} aria-hidden="true" />
          <div class="subs-asa" title="Arrastra para mover los subtítulos. Doble clic para volver a su sitio." aria-hidden="true" />
          <div class="subs-contenido" ref={contenido}>
            {linea && (
              <div
                class={`linea-sub objetivo ${visObjetivo === 'difuminada' ? 'difuminada' : ''} ${consulta.value ? 'consultando' : ''} ${clasesRaiz(a)}`}
                lang="ja"
                style={{ fontSize: `${(base * a.escalaObjetivo * factorLargo(linea.texto.length)) / 100}px` }}
                onMouseEnter={(e) => {
                  encimaSubtitulo.value = true;
                  if (!ratonQuieto(e)) alEntrarSubtitulo();
                }}
                onMouseLeave={() => {
                  encimaSubtitulo.value = false;
                  alSalirSubtitulo();
                }}
              >
                <div class="linea-texto" key={linea.id}>{linea.palabras.map((p, k) => <PalabraVista key={k} p={p} l={linea} />)}</div>
              </div>
            )}
            {linea && a.mostrarGramatica && visObjetivo === 'visible' && (linea.gramatica?.length ?? 0) > 0 && (
              <div class="fila-gram">
                {linea.gramatica!.slice(0, 4).map((g) => (
                  <button key={g.patron} class={`chip-gram n-${g.nivel ?? ''}`} title={g.significado} onClick={(e) => {
                    e.stopPropagation();
                    const c = e.currentTarget.getBoundingClientRect();
                    const caja = e.currentTarget.closest('.subs-bloque')?.getBoundingClientRect() ?? c;
                    consulta.value = null;
                    consultaGramatica.value = consultaGramatica.value?.punto.patron === g.patron ? null : { punto: g, linea, ancla: { left: c.left, top: caja.top, width: c.width, height: caja.height } };
                  }}>
                    <span lang="ja">{g.patron}</span>{g.nivel && <small>{g.nivel}</small>}
                  </button>
                ))}
              </div>
            )}
            {sec && (
              <div class={`linea-sub secundaria ${visSecundaria === 'difuminada' ? 'difuminada' : ''}`} style={{ fontSize: `${(base * 0.56 * a.escalaSecundario * factorLargo(sec.texto.length, 90)) / 100}px` }}>
                <div class="linea-texto" key={sec.id}>{sec.texto}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Ventana de palabra ----------

const ANCHO_FICHA = 468;
/** Tamaño elegido al arrastrar el asa: se conserva mientras dure la sesión. */
const tamanoFicha = signal<{ ancho: number; alto: number } | null>(null);

function AsaFicha({ sx, sy }: { sx: 1 | -1; sy: 1 | -1 }) {
  return (
    <div
      class="ficha-asa"
      aria-hidden="true"
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        cancelarCierre();
        if (consulta.value) consulta.value = { ...consulta.value, fijada: true };
        const el = e.currentTarget as HTMLElement;
        const caja = el.parentElement!.getBoundingClientRect();
        const { clientX: x0, clientY: y0 } = e;
        el.setPointerCapture(e.pointerId);
        const mover = (m: PointerEvent) => {
          tamanoFicha.value = {
            ancho: Math.max(340, Math.min(860, caja.width + sx * (m.clientX - x0))),
            alto: Math.max(240, Math.min(innerHeight - 24, caja.height + sy * (m.clientY - y0))),
          };
        };
        const fin = () => {
          el.removeEventListener('pointermove', mover);
          el.removeEventListener('pointerup', fin);
        };
        el.addEventListener('pointermove', mover);
        el.addEventListener('pointerup', fin);
      }}
    />
  );
}

function PopupPalabra() {
  const c = consulta.value;
  if (!c) return null;
  const t = tamanoFicha.value;
  const ancho = Math.min(t?.ancho ?? ANCHO_FICHA, innerWidth - 24);
  const limite = innerWidth - (ajustes.value.navegadorAbierto ? ANCHO_NAVEGADOR : 0);
  const { estilo, clase, arriba, haciaDerecha } = colocarJunto(c.ancla, ancho, limite, t ? innerHeight : undefined);
  const p = c.palabra;
  const superficies = c.linea ? c.linea.palabras.slice(c.linea.palabras.indexOf(p)).map((x) => x.superficie) : undefined;
  return (
    <div
      class={`popup-palabra ${clase}`}
      style={{ ...estilo, width: `${ancho}px`, ...(t ? { height: `${t.alto}px` } : {}) }}
      role="dialog"
      aria-label={`Consulta de ${p.lema}`}
      onMouseEnter={cancelarCierre}
      onMouseLeave={programarCierre}
      onClick={(e) => e.stopPropagation()}
    >
      <AsaFicha sx={haciaDerecha ? 1 : -1} sy={arriba ? -1 : 1} />
      <Ficha
        lema={p.lema}
        lectura={p.lecturaLema}
        superficie={p.superficie}
        flexion={p.flexion}
        compuestos={superficies}
        ajustes={ajustes.value}
        contexto={contextoDe(c.linea?.texto, c.linea)}
        sentidoPrevio={p.sentido ? { significado: p.sentido, uso: p.uso } : undefined}
        gramatica={c.linea?.gramatica}
        lecturaCorregida={p.lecturaCorregida}
        alCorregirLectura={() => refrescarAnalisis()}
        alCerrar={c.fijada ? cerrarConsulta : undefined}
        estado={p.estado}
        rastreada={p.rastreada}
        alCrear={() => crearUnClic(p, c.linea, fijarOculto)}
        alEnviar={() => enviarACreador(p, c.linea, fijarOculto)}
      />
    </div>
  );
}

function PopupGramatica() {
  const c = consultaGramatica.value;
  if (!c) return null;
  const ancho = Math.min(ANCHO_FICHA, innerWidth - 24);
  const limite = innerWidth - (ajustes.value.navegadorAbierto ? ANCHO_NAVEGADOR : 0);
  const { estilo, clase } = colocarJunto(c.ancla, ancho, limite);
  const { punto, linea } = c;
  return (
    <div class={`popup-palabra popup-gramatica ${clase}`} style={{ ...estilo, width: `${ancho}px` }} role="dialog" aria-label={`Gramática: ${punto.patron}`} onClick={(e) => e.stopPropagation()}>
      <div class="gram-cab">
        <div class="gram-titulo">
          <h3 lang="ja">{punto.patron} {punto.nivel && <span class={`chip-gram n-${punto.nivel}`}>{punto.nivel}</span>}</h3>
          <p class="gram-significado">{punto.significado}</p>
          <p class="gram-frase">En esta frase: <span lang="ja">「{punto.fragmento}」</span>{punto.fuente === 'regla' ? ' · detectado por reglas' : ' · detectado por Claude'}</p>
        </div>
        <button class="btn-icono chico relleno" data-tip="Enviar al creador" aria-label="Enviar al creador de tarjetas" onClick={() => enviarAlCreador({ tipo: 'frase', palabra: punto.patron, frase: linea.texto.replace(punto.fragmento, `<b>${punto.fragmento}</b>`), definicion: punto.significado, fuente: infoVideo.value?.titulo, url: location.href, etiquetas: ['gramatica', ...(punto.nivel ? [punto.nivel] : [])] })}><Icono n="enviar" t={15} /></button>
        <button class="btn-icono chico" aria-label="Cerrar" onClick={() => (consultaGramatica.value = null)}><Icono n="cerrar" t={15} /></button>
      </div>
      <div class="gram-cuerpo">
        <PanelFlujo metodo="gramatica" args={[{ ...contextoDe(linea.texto, linea), lema: punto.patron, superficie: punto.fragmento }]} titulo="Explicación" />
      </div>
    </div>
  );
}

// ---------- Isla ----------

const BOTONES_PANEL: { n: 'generar' | 'visual' | 'video' | 'atajos' | 'traductor'; icono: NombreIcono; nombre: string; tip: string }[] = [
  { n: 'generar', icono: 'varita', nombre: 'Generar subtítulos', tip: 'Generar y revisar subtítulos' },
  { n: 'traductor', icono: 'traducir', nombre: 'Traductor', tip: 'Traductor · Alt+T' },
  { n: 'video', icono: 'cc', nombre: 'Ajustes de video', tip: 'Subtítulos y reproducción' },
  { n: 'visual', icono: 'ojo', nombre: 'Ajustes de visualización', tip: 'Visualización' },
  { n: 'atajos', icono: 'teclado', nombre: 'Atajos de teclado', tip: 'Atajos de teclado' },
];

function Barra() {
  const a = ajustes.value;
  const e = estadisticas.value;
  const visible = barraVisible.value || a.desanclarBarra || verTemporal.value || panel.value !== null;
  const hayLineas = lineasObjetivo.value.length > 0;
  const conocidas = useSignal(0);
  const refBarra = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let mostrando: ReturnType<typeof setTimeout> | null = null;
    let ocultando: ReturnType<typeof setTimeout> | null = null;
    const cancelarMostrar = () => {
      if (mostrando) clearTimeout(mostrando);
      mostrando = null;
    };
    const cancelarOcultar = () => {
      if (ocultando) clearTimeout(ocultando);
      ocultando = null;
    };
    const programarOcultar = () => {
      ocultando ??= setTimeout(() => {
        ocultando = null;
        barraVisible.value = false;
      }, ESPERA_OCULTAR_MS);
    };
    const alMover = (e: MouseEvent) => {
      const el = refBarra.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const caja = { izq: r.left, der: r.right, abajo: 12 + r.height };
      if (barraVisible.value) {
        if (enZonaSegura(e.clientX, e.clientY, caja)) cancelarOcultar();
        else programarOcultar();
      } else if (enZonaActivacion(e.clientX, e.clientY, caja) && videoEnPantalla()) {
        mostrando ??= setTimeout(() => {
          mostrando = null;
          barraVisible.value = true;
        }, ESPERA_MOSTRAR_MS);
      } else {
        cancelarMostrar();
      }
    };
    const alSalirDeLaVentana = (e: MouseEvent) => {
      if (e.relatedTarget) return;
      cancelarMostrar();
      if (barraVisible.value) programarOcultar();
    };
    window.addEventListener('mousemove', alMover, { capture: true, passive: true });
    document.addEventListener('mouseout', alSalirDeLaVentana, { passive: true });
    return () => {
      cancelarMostrar();
      cancelarOcultar();
      window.removeEventListener('mousemove', alMover, { capture: true });
      document.removeEventListener('mouseout', alSalirDeLaVentana);
    };
  }, []);
  useEffect(() => {
    const cargar = () => motor.estadisticasPalabras().then((s) => (conocidas.value = s.conocidas)).catch(() => {});
    cargar();
    const t = setInterval(cargar, 15000);
    return () => clearInterval(t);
  }, []);
  const g = generacion.value;
  const r = analisisEnCurso.value;
  const abrirVideo = (pestana: typeof pestanaVideo.value) => {
    pestanaVideo.value = pestana;
    panel.value = 'video';
  };
  const c = correccion.value;
  const proceso = g
    ? { texto: `Traduciendo ${g.hechas}/${g.total}`, tip: 'Claude está traduciendo los subtítulos', hechas: g.hechas, total: g.total }
    : c
      ? { texto: `Corrigiendo ${c.hechas}/${c.total}`, tip: 'Claude está corrigiendo los subtítulos automáticos', hechas: c.hechas, total: c.total }
    : r
      ? { texto: `Revisando ${r.hechas}/${r.total}`, tip: 'Claude está revisando lecturas, sentidos y gramática', hechas: r.hechas, total: r.total }
      : null;
  return (
    <>
      <div class={`barra ${visible ? 'visible' : ''} ${a.navegadorAbierto ? 'con-nav' : ''}`} ref={refBarra} role="toolbar" aria-label="Barra de Kotonoha">
        <button class="barra-logo" data-tip="Abrir Kotonoha · Alt+Shift+W" aria-label="Abrir la ventana de Kotonoha" onClick={() => fondo.abrirApp()}>
          <Logo t={26} />
        </button>
        <div class="barra-resumen">
          {cargandoPista.value ? (
            <span class="barra-estado"><span class="giro" /> Analizando subtítulos…</span>
          ) : errorPista.value ? (
            <>
              <span class="barra-estado error" title={errorPista.value}><Icono n="aviso" t={16} /> Error con los subtítulos</span>
              <button class="btn chico" onClick={() => abrirVideo('subtitulos')}>Elegir otros</button>
            </>
          ) : hayLineas ? (
            <button class={`resumen-boton ${panel.value === 'comprension' ? 'activo' : ''}`} aria-label="Comprensión" data-tip="Ver el detalle de comprensión" onClick={() => (panel.value = panel.value === 'comprension' ? null : 'comprension')}>
              <Anillo valor={e.comprension} t={36} grosor={3.5}>{e.comprension}</Anillo>
              <span class="resumen-texto">
                <b>{NOMBRES_NIVEL[e.nivel]}</b>
                <small>Comprensión · {e.recomendadas.toLocaleString('es')} {e.recomendadas === 1 ? 'recomendada' : 'recomendadas'}</small>
              </span>
            </button>
          ) : (
            <>
              <span class="barra-estado">Sin subtítulos en japonés</span>
              <button class="btn chico" onClick={() => abrirVideo('subtitulos')}><Icono n="archivo-subir" t={14} /> Importar</button>
            </>
          )}
        </div>
        <span class="barra-conocidas barra-opcional" data-tip="Palabras conocidas"><Icono n="hoja" t={15} /> <span class="num">{conocidas.value.toLocaleString('es')}</span></span>
        {proceso && (
          <span class="barra-proceso barra-opcional" data-tip={proceso.tip}>
            <Anillo valor={(proceso.hechas / Math.max(proceso.total, 1)) * 100} t={18} grosor={3} clase="ia" />
            {proceso.texto}
          </span>
        )}
        {whisper.value && (
          <span class="barra-proceso local barra-opcional" data-tip="Whisper está transcribiendo el video en tu equipo">
            <Icono n="ondas" t={15} />
            {whisper.value.pausado ? 'En pausa' : whisper.value.fase === 'descargando' ? `Descargando ${Math.round(whisper.value.porcentaje ?? 0)} %` : whisper.value.fase === 'bajando' ? `Bajando audio ${Math.round(whisper.value.porcentaje ?? 0)} %` : whisper.value.fase === 'extrayendo' ? `Extrayendo ${Math.round(whisper.value.porcentaje ?? 0)} %` : whisper.value.desdeArchivo && whisper.value.porcentaje !== undefined ? `${Math.round(whisper.value.porcentaje)} %` : `${whisper.value.lineas} ${whisper.value.lineas === 1 ? 'línea' : 'líneas'}`}
          </span>
        )}
        <span class="barra-sep" />
        <button class="barra-modo barra-opcional" data-tip="Cambiar el modo de reproducción" aria-label={`Modo de reproducción: ${NOMBRES_MODO[a.modo].titulo}`} aria-expanded={panel.value === 'video' && pestanaVideo.value === 'reproduccion'} onClick={() => (panel.value === 'video' && pestanaVideo.value === 'reproduccion' ? (panel.value = null) : abrirVideo('reproduccion'))}>
          {NOMBRES_MODO[a.modo].titulo}
          <Icono n="abajo" t={12} />
        </button>
        <div class="barra-acciones">
          {BOTONES_PANEL.map((b) => (
            <button key={b.n} class={`btn-icono ${panel.value === b.n ? 'activo' : ''}`} data-tip={b.tip} aria-label={b.nombre} aria-pressed={panel.value === b.n} onClick={() => (panel.value = panel.value === b.n ? null : b.n)}>
              <Icono n={b.icono} t={20} />
            </button>
          ))}
          <button class={`btn-icono ${a.navegadorAbierto ? 'activo' : ''}`} data-tip="Navegador de subtítulos · G" aria-label="Navegador de subtítulos" aria-pressed={a.navegadorAbierto} onClick={() => cambiarAjuste({ navegadorAbierto: !a.navegadorAbierto })}>
            <Icono n="panel" t={20} />
          </button>
          <span class="barra-sep" />
          <button class={`btn-icono ${capturaActiva.value ? 'en-marcha' : ''}`} data-tip={capturaActiva.value ? 'Grabando audio para tus tarjetas · Alt+R' : 'Audio para tarjetas desactivado · Alt+R'} aria-label="Estado de la captura" disabled>
            <Icono n="microfono" t={20} />
          </button>
          <button class={`btn-icono ${a.desanclarBarra ? 'activo' : ''}`} data-tip={a.desanclarBarra ? 'Soltar la barra · Alt+X' : 'Fijar la barra · Alt+X'} aria-label="Fijar la barra" aria-pressed={a.desanclarBarra} onClick={() => cambiarAjuste({ desanclarBarra: !a.desanclarBarra })}>
            <Icono n="fijar" t={20} />
          </button>
        </div>
      </div>
    </>
  );
}

// ---------- Navegador ----------

const hora = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor(s / 60) % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(s % 60)}` : `${m}:${p(s % 60)}`;
};

const FILTROS: { id: FiltroNavegador; nombre: string }[] = [
  { id: 'todas', nombre: 'Todas las líneas' },
  { id: 'recomendadas', nombre: 'Frases recomendadas' },
  { id: '1d', nombre: '1 palabra desconocida' },
  { id: '1dUnicas', nombre: '1 desconocida, sin repetir' },
  { id: '1mas', nombre: '1 o más desconocidas' },
  { id: '2mas', nombre: '2 o más desconocidas' },
  { id: 'rastreadas', nombre: 'Con palabras rastreadas' },
  { id: 'aprendiendo', nombre: 'Con palabras en aprendizaje' },
  { id: 'conocidas', nombre: 'Todas conocidas' },
  { id: 'marcadas', nombre: 'Marcadas' },
  { id: 'seleccionadas', nombre: 'Seleccionadas' },
];

const LineaNavegador = memo(function LineaNavegador({
  l,
  activa,
  marcada,
  seleccionada,
  raiz,
}: {
  l: LineaAnalizada;
  activa: boolean;
  marcada: boolean;
  seleccionada: boolean;
  raiz: string;
}) {
  const sec = lineasSecundarias.value.filter((s) => s.inicio < l.fin && s.fin > l.inicio).map((s) => s.texto.replace(/\n/g, ' ')).join(' ');
  const reales = l.palabras.filter((p) => p.esPalabra);
  const nuevas = reales.filter((p) => p.estado === 'desconocida').length;
  const punto = !reales.length ? 'ninguna' : nuevas === 0 ? 'n0' : nuevas === 1 ? 'n1' : 'n2';
  const textoPunto = !reales.length ? '' : nuevas === 0 ? 'Todas conocidas' : nuevas === 1 ? 'Una palabra desconocida' : `${nuevas} palabras desconocidas`;
  return (
    <div class={`nav-linea ${activa ? 'activa' : ''} ${seleccionada ? 'seleccionada' : ''}`} data-id={l.id} onClick={() => irALinea(l)}>
      <span class={`nav-punto ${punto}`} title={textoPunto} />
      <div class="nav-botones">
        <button class={`btn-icono chico ${marcada ? 'activo' : ''}`} title="Marcar (B)" aria-label="Marcar" aria-pressed={marcada} onClick={(e) => { e.stopPropagation(); alternarMarcador(l.id); }}><Icono n="marcador" t={15} /></button>
        <button class={`btn-icono chico ${seleccionada ? 'activo' : ''}`} title="Seleccionar (L)" aria-label="Seleccionar" aria-pressed={seleccionada} onClick={(e) => { e.stopPropagation(); alternarSeleccion(l.id); }}><Icono n="check" t={15} /></button>
        <button class="btn-icono chico" title="Sincronizar: esta línea suena ahora" aria-label="Sincronizar: esta línea suena ahora" onClick={(e) => { e.stopPropagation(); anclarLinea(l); }}><Icono n="reloj" t={15} /></button>
        <button class="btn-icono chico" title="Crear tarjeta" aria-label="Crear tarjeta" onClick={(e) => { e.stopPropagation(); crearUnClic(null, l, fijarOculto); }}><Icono n="rayo" t={15} /></button>
      </div>
      <div class={`nav-texto ${raiz}`} lang="ja">{l.palabras.map((p, k) => <PalabraVista key={k} p={p} l={l} />)}</div>
      {sec && <div class="nav-sec">{sec}</div>}
      {ajustes.value.mostrarGramatica && (l.gramatica?.length ?? 0) > 0 && (
        <div class="nav-gram">
          {l.gramatica!.map((g) => <span key={g.patron} class={`chip-gram n-${g.nivel ?? ''}`} title={g.significado} lang="ja">{g.patron}</span>)}
        </div>
      )}
      <div class="nav-tiempo">
        {hora(l.inicio)} – {hora(l.fin)}
        {marcada && <Icono n="marcador" t={12} />}
        {originales.value.has(l.id) && <span class="nav-corregida" title={`Antes: ${originales.value.get(l.id)}`} lang="ja"><Icono n="ia" t={12} /> Corregida</span>}
      </div>
    </div>
  );
});

function Navegador() {
  const a = ajustes.value;
  const lista = useRef<HTMLDivElement>(null);
  const encima = useSignal(false);
  const menu = useSignal(false);
  const f = filtro.value;
  const visibles = useComputed(() => filtrarLineas(lineasObjetivo.value, filtro.value, opcionesFrase.value, marcadas.value, seleccionadas.value));

  useSignalEffect(() => {
    const i = indiceActivo.value;
    if (i < 0 || encima.value) return;
    const id = lineasObjetivo.value[i]?.id;
    const el = lista.current?.querySelector(`[data-id="${id}"]`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });

  if (!a.navegadorAbierto) return null;
  const sel = seleccionadas.value;
  const activaId = indiceActivo.value >= 0 ? lineasObjetivo.value[indiceActivo.value]?.id : -1;
  const raiz = clasesRaiz(a);
  const lineasSel = () => lineasObjetivo.value.filter((l) => sel.has(l.id));
  const total = lineasObjetivo.value.length;
  const nombreFiltro = FILTROS.find((x) => x.id === f)?.nombre ?? 'Todas las líneas';

  return (
    <aside class="navegador" style={{ '--ancho-nav': `${ANCHO_NAVEGADOR}px` }} aria-label="Navegador de subtítulos">
      <div class="nav-cab">
        <div class="nav-titulo">
          <b title={infoVideo.value?.titulo}>{infoVideo.value?.titulo || 'Subtítulos'}</b>
          <small>{f === 'todas' ? `${total.toLocaleString('es')} líneas` : `${visibles.value.length.toLocaleString('es')} de ${total.toLocaleString('es')} líneas`}{encima.value && total > 0 ? ' · desplazamiento en pausa' : ''}</small>
        </div>
        <button class="btn-icono chico" data-tip="Cerrar · G" data-tip-lado="izq" aria-label="Cerrar navegador" onClick={() => cambiarAjuste({ navegadorAbierto: false })}><Icono n="cerrar" t={16} /></button>
      </div>
      <div class="nav-filtros">
        <button class={`nav-filtro-btn ${f !== 'todas' ? 'activo' : ''}`} aria-label="Filtros" aria-haspopup="menu" aria-expanded={menu.value} onClick={() => (menu.value = !menu.value)}>
          <Icono n="filtro" t={15} />
          <span>{nombreFiltro}</span>
          <Icono n={menu.value ? 'arriba' : 'abajo'} t={12} />
        </button>
        {f !== 'todas' && <button class="btn-icono chico" aria-label="Quitar filtro" title="Quitar filtro" onClick={() => (filtro.value = 'todas')}><Icono n="cerrar" t={14} /></button>}
        {menu.value && (
          <div class="nav-menu" role="menu">
            {FILTROS.map((x) => (
              <button key={x.id} role="menuitem" class={f === x.id ? 'activo' : ''} onClick={() => { filtro.value = x.id; menu.value = false; }}>
                <span>{x.nombre}</span>
                {x.id === 'marcadas' && marcadas.value.size > 0 && <small>{marcadas.value.size}</small>}
                {x.id === 'seleccionadas' && sel.size > 0 && <small>{sel.size}</small>}
                {f === x.id && <Icono n="ok" t={14} />}
              </button>
            ))}
          </div>
        )}
      </div>
      <div class="nav-lista" ref={lista} onMouseEnter={() => (encima.value = true)} onMouseLeave={() => (encima.value = false)} onPointerDown={() => (menu.value = false)}>
        {anuncio.value && (
          <div class="vacio nav-vacio">
            <span class="hoja-icono"><Icono n="espera" t={22} /></span>
            <p>Esperando a que termine el anuncio…</p>
          </div>
        )}
        {!anuncio.value && !total && (
          <div class="vacio nav-vacio">
            {cargandoPista.value ? (
              <>
                <span class="giro" />
                <p>Analizando los subtítulos…</p>
              </>
            ) : (
              <>
                <span class="hoja-icono"><Icono n="subtitulos" t={22} /></span>
                <h3>Sin subtítulos en japonés</h3>
                <p>Arrastra un archivo SRT sobre el video o genera unos.</p>
                <button class="btn chico" onClick={() => { pestanaVideo.value = 'subtitulos'; panel.value = 'video'; }}><Icono n="archivo-subir" t={14} /> Importar</button>
              </>
            )}
          </div>
        )}
        {total > 0 && !visibles.value.length && (
          <div class="vacio nav-vacio">
            <span class="hoja-icono"><Icono n="filtro" t={22} /></span>
            <h3>Ninguna línea cumple este filtro</h3>
            <button class="btn chico" onClick={() => (filtro.value = 'todas')}>Quitar filtro</button>
          </div>
        )}
        {visibles.value.map((l) => (
          <LineaNavegador key={l.id} l={l} activa={l.id === activaId} marcada={marcadas.value.has(l.id)} seleccionada={sel.has(l.id)} raiz={raiz} />
        ))}
      </div>
      {sel.size > 0 && (
        <div class="nav-pie">
          <div class="nav-pie-cab">
            <b>{sel.size === 1 ? '1 línea seleccionada' : `${sel.size} líneas seleccionadas`}</b>
            <button class="btn chico fantasma" onClick={() => (seleccionadas.value = new Set())}>Limpiar</button>
          </div>
          <div class="nav-pie-acciones">
            {sel.size > 1 && <button class="btn chico" onClick={() => combinarSeleccionadas()}>Unir</button>}
            <button class="btn chico" onClick={() => (filtro.value = filtro.value === 'seleccionadas' ? 'todas' : 'seleccionadas')}>{filtro.value === 'seleccionadas' ? 'Ver todas' : 'Ver solo estas'}</button>
            {sel.size === 1 && <button class="btn chico" onClick={() => enviarACreador(null, lineasSel()[0], fijarOculto)}>Enviar</button>}
            <button class="btn chico primario" onClick={() => crearVarias(lineasSel(), fijarOculto)}><Icono n="rayo" t={14} /> Crear {sel.size} {sel.size === 1 ? 'tarjeta' : 'tarjetas'}</button>
          </div>
        </div>
      )}
    </aside>
  );
}

// ---------- Avisos y archivos ----------

const ICONO_AVISO: Record<string, NombreIcono> = { error: 'error', exito: 'check' };

export function Avisos() {
  const a = ajustes.value;
  const c = consulta.value;
  const islaVisible = barraVisible.value || a.desanclarBarra || verTemporal.value || panel.value !== null;
  const aLaDerecha = !!c && c.ancla.left + c.ancla.width / 2 < innerWidth / 2;
  return (
    <div class={`avisos ${islaVisible ? 'bajo-isla' : ''} ${aLaDerecha ? 'a-la-derecha' : ''} ${a.navegadorAbierto ? 'con-nav' : ''}`} aria-live="polite">
      {avisos.value.map((x) => (
        <div class={`aviso ${x.tipo ?? ''}`} key={x.id} role={x.tipo === 'error' ? 'alert' : 'status'}>
          <span class="aviso-icono"><Icono n={ICONO_AVISO[x.tipo ?? ''] ?? 'info'} t={20} /></span>
          <span class="aviso-texto">{x.texto}</span>
          {x.accion && <button class="btn chico" onClick={x.accion.fn}>{x.accion.texto}</button>}
          <button class="btn-icono chico" aria-label="Cerrar aviso" onClick={() => quitarAviso(x.id)}><Icono n="cerrar" t={14} /></button>
        </div>
      ))}
    </div>
  );
}

function ZonaSoltar() {
  const arrastrando = useSignal(false);
  useEffect(() => {
    const entrar = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        arrastrando.value = true;
        e.preventDefault();
      }
    };
    const sobre = (e: DragEvent) => {
      if (arrastrando.value) e.preventDefault();
    };
    const salir = (e: DragEvent) => {
      if (!e.relatedTarget) arrastrando.value = false;
    };
    const soltar = (e: DragEvent) => {
      if (!arrastrando.value) return;
      e.preventDefault();
      arrastrando.value = false;
      const archivos = [...(e.dataTransfer?.files ?? [])].filter((f) => /\.(srt|vtt|ass|ssa|ttml|xml|dfxp)$/i.test(f.name));
      if (archivos[0]) importarArchivo(archivos[0], lineasObjetivo.value.length ? 'secundaria' : 'objetivo');
    };
    window.addEventListener('dragenter', entrar);
    window.addEventListener('dragover', sobre);
    window.addEventListener('dragleave', salir);
    window.addEventListener('drop', soltar);
    return () => {
      window.removeEventListener('dragenter', entrar);
      window.removeEventListener('dragover', sobre);
      window.removeEventListener('dragleave', salir);
      window.removeEventListener('drop', soltar);
    };
  }, []);
  if (!arrastrando.value) return null;
  const destino = lineasObjetivo.value.length ? 'como subtítulos secundarios' : 'como subtítulos en japonés';
  return (
    <div class="zona-soltar">
      <div class="zona-soltar-marco">
        <span class="hoja-icono"><Icono n="archivo-subir" t={38} /></span>
        <h3>Suelta aquí tus subtítulos</h3>
        <p>SRT, VTT, ASS o TTML · se añadirán {destino}</p>
      </div>
    </div>
  );
}

export function Reproductor({ sinBarra = false }: { sinBarra?: boolean }) {
  const raiz = useRef<HTMLDivElement>(null);
  useEffect(() => {
    fijarAbrirConsulta((p: PalabraToken, l: LineaAnalizada) => {
      // Los subtítulos viven fuera de la capa fija: se busca en todo el overlay.
      const overlay = raiz.current?.getRootNode() as ParentNode | undefined;
      const el = overlay?.querySelector(`.linea-sub [data-clave="${CSS.escape(p.clave)}"]`);
      if (el) abrirConsulta(p, l, el, true);
    });
    void abrirConsultaDe;

    // Las ventanas fijadas se cierran al pulsar fuera. La capa no recibe esos clics: deja pasar el ratón al video.
    const alPulsar = (e: PointerEvent) => {
      if (!consulta.value?.fijada && !consultaGramatica.value) return;
      const dentro = e.composedPath().some((n) => n instanceof Element && n.matches('.popup-palabra, .pal, .chip-gram'));
      if (dentro) return;
      if (consulta.value?.fijada) cerrarConsulta();
      consultaGramatica.value = null;
    };
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') consultaGramatica.value = null;
    };
    window.addEventListener('pointerdown', alPulsar, true);
    window.addEventListener('keydown', alTeclear, true);
    return () => {
      window.removeEventListener('pointerdown', alPulsar, true);
      window.removeEventListener('keydown', alTeclear, true);
    };
  }, []);

  // kk-raiz aquí también: sobre el video la interfaz siempre es oscura, sea cual sea el tema de la página.
  return (
    <>
      <div class="capa-subs kk-raiz" ref={(el) => {
        origenSubs.el = el;
      }}>
        <Subtitulos />
      </div>
      <div class="capa kk-raiz" ref={raiz} onClick={() => {
        if (consulta.value?.fijada) cerrarConsulta();
        consultaGramatica.value = null;
      }}>
        {!sinBarra && <Barra />}
        <Navegador />
        <PanelesFlotantes />
        <PopupPalabra />
        <PopupGramatica />
        <Avisos />
        <ZonaSoltar />
      </div>
    </>
  );
}

export { fijarOculto };
export type { EstadoPalabra };
