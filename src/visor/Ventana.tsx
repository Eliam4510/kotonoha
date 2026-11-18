// La ventana de lo que se toca en una página del visor: la frase, el párrafo, el globo o lo seleccionado, con furigana y
// sus palabras; lo que se puede hacer con ello (traducir, explicar, desglosar, escuchar, resaltar, anotar, copiar,
// editar) y la ficha de la palabra elegida. Flota junto al texto, como la de los subtítulos, sin tapar lo que queda por
// leer (nucleo/colocarVentana.ts); fijada, es un panel a la derecha que se ensancha arrastrando su borde.

import type { JSX } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { guardarPreferencia, leerPreferencia } from '../app/estadoApp';
import { type Ajustes, hayVozSintetica } from '../compartido/ajustes';
import { tm, tr } from '../compartido/i18n';
import { alRecibirEvento, motor } from '../compartido/rpc';
import type { AnotacionLibro, ColorAnotacion, ContextoIA, EstadoPalabra, PalabraToken } from '../compartido/tipos';
import { motorDe } from '../lenguas/motor';
import { type Colocacion, colocarVentana } from '../nucleo/colocarVentana';
import type { LineaEditada } from '../nucleo/ediciones';
import { fraseConNegrita } from '../nucleo/frases';
import { alinearSuperficies } from '../nucleo/lectorTexto';
import type { Caja } from '../nucleo/ocr';
import { cajasDeTrozo, envolvente, type Posicion, type TramoPagina } from '../nucleo/seleccion';
import { enviarAlCreador } from '../ui/borrador';
import { Desglose, Ficha, PanelFlujo } from '../ui/Ficha';
import { Icono, type NombreIcono } from '../ui/iconos';
import { lecturaDeTarjeta, lengua } from '../ui/lengua';
import { clasesPalabras } from '../ui/palabras';
import { sinCortes } from '../ui/sinCorte';
import { decirConNavegador } from '../ui/vozNavegador';
import { COLORES, EditorNota, resaltarEn } from './Anotaciones';

/** Qué se abrió: la frase de una palabra tocada, la frase o el párrafo con doble o triple toque, un globo o lo seleccionado. */
export type TipoUnidad = 'palabra' | 'frase' | 'parrafo' | 'globo' | 'seleccion';

export interface UnidadAbierta {
  /** Cambia con cada toque: la ventana se vuelve a colocar. */
  clave: number;
  pagina: number;
  tipo: TipoUnidad;
  texto: string;
  /** El sitio en la página de cada unidad del texto. */
  sitios: Posicion[];
  tramo: TramoPagina;
  /** La letra tocada: su palabra se elige en cuanto el texto está analizado. */
  tocada?: Posicion;
  /** Para Claude: la frase entera que lo contiene y unas pocas de alrededor. */
  contexto: { frase: string; antes: string[]; despues: string[] };
  /** Dónde está en la página, en fracciones: una caja por renglón. */
  cajas: Caja[];
  /** Si se sabe dónde va cada letra; en un globo de manga, no. */
  porLetra: boolean;
  vertical: boolean;
}

/** Lo que se pide a Claude desde la ventana. */
type Peticion = 'traducir' | 'explicar' | 'desglosar';

/** El tamaño elegido arrastrando el asa: se recuerda. Sin alto, el que pida su contenido. */
interface Tamano {
  ancho: number;
  alto?: number;
}
const TAMANO_INICIAL: Tamano = { ancho: 440 };
/** Desde cuántas letras una palabra se parte entre sus trozos con lectura si no cabe en el renglón. */
const PALABRA_LARGA = 4;
const ANCHO_FIJADA = 420;

const ETIQUETA: Record<TipoUnidad, string> = {
  palabra: tm('Frase'),
  frase: tm('Frase'),
  parrafo: tm('Párrafo'),
  globo: tm('Globo'),
  seleccion: tm('Selección'),
};

interface PropsVentana {
  unidad: UnidadAbierta;
  /** Las líneas de su página, con lo editado: para editar una y marcar la palabra elegida. */
  lineas: LineaEditada[];
  ajustes: Ajustes;
  titulo: string;
  fijada: boolean;
  alFijar: (fijada: boolean) => void;
  alCerrar: () => void;
  /** Marca en la página la palabra elegida, o nada. */
  alMarcar: (cajas: Caja[] | null) => void;
  /** Lo resaltado que cae sobre lo abierto. */
  resaltados: AnotacionLibro[];
  /** Resalta lo abierto, o solo un trozo de su texto. Devuelve el resaltado para poder comentarlo. */
  alResaltar: (estilo: 'fondo' | 'subrayado', color: ColorAnotacion, trozo: { inicio: number; fin: number } | null) => AnotacionLibro | null;
  alGuardarAnotacion: (a: AnotacionLibro) => void;
  alQuitarAnotacion: (id: string) => void;
  /** Guarda el texto escrito a mano para una línea de la página, o vuelve al leído. */
  alEditar?: (linea: number, texto: string) => Promise<void>;
  alRestaurar?: (linea: number) => Promise<void>;
  alBuscar?: (texto: string) => void;
  /** Se pidió la traducción: el visor la pone también como un subtítulo bajo la frase. */
  alTraducir?: () => void;
  /** Una palabra elegida en la ventana: el visor la apunta entre las consultadas del libro. */
  alConsultar?: (w: { clave: string; lema: string; lectura: string; superficie: string; frase: string }) => void;
}

/** Un botón de la fila de acciones: icono y nombre, que se ven siempre. */
function Accion({ icono, nombre, activa, ayuda, alPulsar }: { icono: NombreIcono; nombre: string; activa?: boolean; ayuda?: string; alPulsar: () => void }) {
  return (
    <button class={`btn chico fantasma vs-accion ${activa ? 'activo' : ''}`} aria-pressed={activa} data-tip={ayuda} onClick={alPulsar}>
      <Icono n={icono} t={14} /> {nombre}
    </button>
  );
}

export function Ventana(p: PropsVentana) {
  const { unidad, ajustes } = p;
  const texto = unidad.texto;
  const raiz = useRef<HTMLDivElement>(null);

  // ---------- El texto, analizado ----------
  // Lo analizado va con su texto: al cambiar de frase, lo de la anterior no vale ni un momento.
  const [analizado, fijarAnalizado] = useState<{ texto: string; tokens: PalabraToken[] } | null>(null);
  const tokens = analizado?.texto === texto ? analizado.tokens : [];
  const sitios = useMemo(() => alinearSuperficies(texto, tokens.map((t) => t.superficie)), [texto, tokens]);
  const [elegida, fijarElegida] = useState<number | null>(null);
  const analizar = () => {
    const t = texto;
    motor
      .analizarTexto(t)
      .then((r) => fijarAnalizado({ texto: t, tokens: r.flat() }))
      .catch(console.error);
  };
  useEffect(() => {
    analizar();
    return alRecibirEvento((e) => {
      if (e.tipo === 'palabras' || e.tipo === 'palabrasRecargar') analizar();
    });
  }, [texto]);

  // La palabra tocada en la página se elige una vez por toque: si después se elige otra aquí, volver a analizar no la cambia.
  useEffect(() => fijarElegida(null), [unidad.clave]);
  const aplicado = useRef(-1);
  useEffect(() => {
    const t = unidad.tocada;
    if (!t || !tokens.length || aplicado.current === unidad.clave) return;
    aplicado.current = unidad.clave;
    const k = sitios.findIndex((s, i) => !!s && tokens[i].esPalabra && unidad.sitios.slice(s.inicio, s.fin).some((x) => x.linea === t.linea && x.letra === t.letra));
    if (k >= 0) fijarElegida(k);
  }, [unidad.clave, tokens, sitios]);

  // La palabra elegida, marcada también en la página.
  const sitioElegida = elegida !== null ? sitios[elegida] : null;
  useEffect(() => {
    p.alMarcar(sitioElegida ? cajasDeTrozo(p.lineas, unidad, sitioElegida.inicio, sitioElegida.fin, unidad.porLetra) : null);
  }, [sitioElegida?.inicio, sitioElegida?.fin, unidad.clave]);
  useEffect(() => () => p.alMarcar(null), []);

  const palabra = elegida !== null ? tokens[elegida] : null;
  // Lo consultado queda apuntado en el libro, para pasarlo a tarjetas al terminar de leer.
  useEffect(() => {
    if (palabra?.esPalabra) p.alConsultar?.({ clave: palabra.clave, lema: palabra.lema, lectura: palabra.lecturaLema, superficie: palabra.superficie, frase: unidad.contexto.frase });
  }, [palabra?.clave, unidad.clave]);

  // Con una palabra elegida, sus teclas, como en el lector de páginas web: 1 desconocida, 2 rastrear, 3 conocida, 4 ignorada.
  useEffect(() => {
    if (!palabra?.esPalabra) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      const estados: Record<string, EstadoPalabra> = { '1': 'desconocida', '3': 'conocida', '4': 'ignorada' };
      const clave = { lema: palabra.lema, lectura: palabra.lecturaLema, clave: palabra.clave };
      if (estados[e.key]) motor.cambiarPalabras([{ ...clave, estado: estados[e.key] }]).catch(console.error);
      else if (e.key === '2') motor.cambiarPalabras([{ ...clave, rastreada: !palabra.rastreada }]).catch(console.error);
      else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', tecla, true);
    return () => window.removeEventListener('keydown', tecla, true);
  }, [palabra]);

  // ---------- Lo que se puede hacer ----------
  const [accion, fijarAccion] = useState<Peticion | null>(null);
  const [resaltando, fijarResaltando] = useState(false);
  const [soloPalabra, fijarSoloPalabra] = useState(false);
  const [mas, fijarMas] = useState(false);
  const [copiado, fijarCopiado] = useState(false);
  const [comentando, fijarComentando] = useState<string | null>(null);
  const [borrador, fijarBorrador] = useState<string | null>(null);
  useEffect(() => {
    fijarAccion(null);
    fijarResaltando(false);
    fijarMas(false);
    fijarBorrador(null);
  }, [texto]);
  useEffect(() => fijarSoloPalabra(false), [elegida]);

  // Un trozo de una frase se explica dentro de ella; la frase entera, o más, se desglosa.
  const esTrozo = unidad.tipo === 'seleccion' && texto.trim() !== unidad.contexto.frase.trim();
  const contextoBase: ContextoIA = {
    frase: texto,
    // Para traducir un trozo, la frase que lo contiene es su entorno más cercano.
    antes: esTrozo ? [...unidad.contexto.antes, unidad.contexto.frase] : unidad.contexto.antes,
    despues: unidad.contexto.despues,
    titulo: p.titulo,
  };
  const alternar = (a: Peticion) => fijarAccion((x) => (x === a ? null : a));

  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => audio.current?.pause(), []);
  const escuchar = async () => {
    audio.current?.pause();
    if (hayVozSintetica(ajustes)) {
      const datos = await motor.vozFrase(texto, ajustes.vocesFrase[0]).catch(() => null);
      if (datos) {
        const a = new Audio(`data:audio/mpeg;base64,${datos}`);
        audio.current = a;
        await a.play().catch(() => {});
        return;
      }
    }
    await decirConNavegador(texto);
  };
  const copiar = () => {
    navigator.clipboard
      .writeText(texto)
      .then(() => {
        fijarCopiado(true);
        setTimeout(() => fijarCopiado(false), 1600);
      })
      .catch(console.error);
  };
  const trozoElegido = soloPalabra && sitioElegida ? sitioElegida : null;
  const resaltar = (estilo: 'fondo' | 'subrayado', color: ColorAnotacion) => {
    p.alResaltar(estilo, color, trozoElegido);
    fijarResaltando(false);
  };
  /** Una nota es el comentario de un resaltado: el que ya tenga lo mismo, o uno nuevo en amarillo. */
  const anotar = () => {
    const que = trozoElegido ? texto.slice(trozoElegido.inicio, trozoElegido.fin) : texto;
    const a = p.resaltados.find((r) => r.texto === que) ?? p.alResaltar('fondo', 'amarillo', trozoElegido);
    if (a) fijarComentando(a.id);
  };

  // Editar el texto de la línea de la palabra elegida, o de la primera de lo abierto.
  const lineaEditable = sitioElegida ? (unidad.sitios[sitioElegida.inicio]?.linea ?? unidad.tramo.desde.linea) : unidad.tramo.desde.linea;
  const editable = p.lineas[lineaEditable];
  const guardar = async () => {
    const nuevo = (borrador ?? '').replace(/\s*\n\s*/g, '').trim();
    if (nuevo && p.alEditar) await p.alEditar(lineaEditable, nuevo);
    fijarBorrador(null);
  };

  const gramatica = useMemo(() => motorDe(lengua.value.id).detectarGramatica(unidad.contexto.frase), [unidad.contexto.frase]);
  const fraseTarjeta = (clave: string) =>
    unidad.tipo === 'palabra' || unidad.tipo === 'frase' ? fraseConNegrita(tokens, clave) : unidad.contexto.frase;

  // ---------- Dónde va ----------
  const [tam, fijarTam] = useState<Tamano>(() => leerPreferencia('visorVentanaTamano', TAMANO_INICIAL));
  const [anchoFijada, fijarAnchoFijada] = useState(() => leerPreferencia('visorVentanaFijadaAncho', ANCHO_FIJADA));
  const [lugar, fijarLugar] = useState<Colocacion | null>(null);
  // Movida a mano arrastrando su cabecera: se queda ahí hasta el siguiente toque.
  const [movida, fijarMovida] = useState<{ left: number; top: number } | null>(null);
  const ancho = Math.min(tam.ancho, innerWidth - 24);
  const colocar = (intentos = 0) => {
    const lienzo = document.querySelector('.vs-lienzo')?.getBoundingClientRect();
    // Entre las flechas de pasar página: la ventana no las tapa.
    const izquierda = document.querySelector('.vs-flecha.izquierda')?.getBoundingClientRect();
    const derecha = document.querySelector('.vs-flecha.derecha')?.getBoundingClientRect();
    const desde = lienzo && izquierda ? Math.max(lienzo.left, izquierda.right) : lienzo?.left;
    const hasta = lienzo && derecha ? Math.min(lienzo.right, derecha.left) : lienzo?.right;
    const zona = lienzo && desde !== undefined && hasta !== undefined ? { left: desde, top: lienzo.top, width: hasta - desde, height: lienzo.height } : null;
    const hoja = document.querySelector<HTMLElement>(`.vs-pagina[data-pagina="${unidad.pagina + 1}"]`)?.getBoundingClientRect();
    const caja = envolvente(unidad.cajas);
    if (!zona || !hoja || !caja) {
      // La página aún no está en el lienzo, por ejemplo al ir a ella desde un panel: se prueba en el siguiente fotograma.
      if (intentos < 30) requestAnimationFrame(() => colocar(intentos + 1));
      return;
    }
    const ancla = { left: hoja.left + caja.x0 * hoja.width, top: hoja.top + caja.y0 * hoja.height, width: (caja.x1 - caja.x0) * hoja.width, height: (caja.y1 - caja.y0) * hoja.height };
    fijarLugar(colocarVentana({ ancla, hoja, zona, vista: { ancho: innerWidth, alto: innerHeight }, ancho, alto: tam.alto ?? 520, vertical: unidad.vertical }));
  };
  useLayoutEffect(() => {
    fijarMovida(null);
    if (!p.fijada) colocar();
  }, [unidad.clave, p.fijada]);
  // Sigue al texto si la página se desplaza o cambia la ventana del navegador.
  useEffect(() => {
    if (p.fijada) return;
    const lienzo = document.querySelector('.vs-lienzo');
    const otraVez = () => colocar();
    lienzo?.addEventListener('scroll', otraVez, { passive: true });
    addEventListener('resize', otraVez);
    return () => {
      lienzo?.removeEventListener('scroll', otraVez);
      removeEventListener('resize', otraVez);
    };
  }, [unidad.clave, p.fijada, tam.ancho, tam.alto]);

  /** Mueve la ventana arrastrando su cabecera. */
  const moverDesde = (e: PointerEvent) => {
    if (p.fijada || e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    const caja = raiz.current?.getBoundingClientRect();
    if (!caja) return;
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    const dx = e.clientX - caja.left;
    const dy = e.clientY - caja.top;
    el.setPointerCapture(e.pointerId);
    const mover = (m: PointerEvent) => fijarMovida({ left: Math.max(0, Math.min(innerWidth - 80, m.clientX - dx)), top: Math.max(0, Math.min(innerHeight - 40, m.clientY - dy)) });
    const fin = () => {
      el.removeEventListener('pointermove', mover);
      el.removeEventListener('pointerup', fin);
    };
    el.addEventListener('pointermove', mover);
    el.addEventListener('pointerup', fin);
  };
  /** Cambia el tamaño con el asa de la esquina; fijada, el ancho con el borde izquierdo. */
  const redimensionar = (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const caja = raiz.current?.getBoundingClientRect();
    if (!caja) return;
    const el = e.currentTarget as HTMLElement;
    const { clientX: x0, clientY: y0 } = e;
    el.setPointerCapture(e.pointerId);
    // Flotante, se queda donde está y crece desde ahí: su ancho ya no es el que le dio la colocación.
    if (!p.fijada) fijarMovida({ left: caja.left, top: caja.top });
    let ultimo: Tamano | number | null = null;
    const mover = (m: PointerEvent) => {
      if (p.fijada) {
        const a = Math.round(Math.max(300, Math.min(innerWidth * 0.6, caja.width - (m.clientX - x0))));
        fijarAnchoFijada(a);
        ultimo = a;
      } else {
        const t = { ancho: Math.round(Math.max(320, Math.min(900, caja.width + (m.clientX - x0)))), alto: Math.round(Math.max(220, Math.min(innerHeight - 24, caja.height + (m.clientY - y0)))) };
        fijarTam(t);
        ultimo = t;
      }
    };
    const fin = () => {
      el.removeEventListener('pointermove', mover);
      el.removeEventListener('pointerup', fin);
      if (typeof ultimo === 'number') guardarPreferencia('visorVentanaFijadaAncho', ultimo);
      else if (ultimo) guardarPreferencia('visorVentanaTamano', ultimo);
    };
    el.addEventListener('pointermove', mover);
    el.addEventListener('pointerup', fin);
  };

  // ---------- Lo que se ve ----------
  const textoAnalizado = tokens.length
    ? sinCortes(
        tokens.flatMap((w, k) => {
          // Donde lo abierto cambia de párrafo, un salto: el análisis no lo devuelve como una palabra.
          const anterior = k > 0 ? sitios[k - 1] : null;
          const salto = anterior && sitios[k] && texto.slice(anterior.fin, sitios[k]!.inicio).includes('\n');
          const clases = ['pal', `est-${w.estado}`, w.rastreada ? 'rastreada' : '', w.patron && ajustes.colorAcento !== 'ninguno' ? `ac-${w.patron}` : '', elegida === k ? 'ap-elegida' : ''].join(' ');
          const trozo = (s: { texto: string; lectura?: string }, j: number) =>
            s.lectura && ajustes.furigana !== 'ninguna' ? (
              <ruby key={j}>{s.texto}<rt>{lengua.value.lectura.visible(s.lectura, ajustes.formatoLectura)}</rt></ruby>
            ) : (
              <span key={j}>{s.texto}</span>
            );
          // Una palabra larga se puede partir entre sus trozos con lectura: así no salta entera de renglón.
          const partible = w.esPalabra && w.furigana.length > 1 && [...w.superficie].length >= PALABRA_LARGA;
          const pieza = !w.esPalabra ? (
            <span key={k} data-k={k}>{lengua.value.escritura.pegarSignos(w.superficie)}</span>
          ) : partible ? (
            <span key={k} data-k={k} class="pal-partible" onClick={() => fijarElegida(k)}>
              {w.furigana.map((s, j) => (
                <span key={j} class={`${clases} trozo`}>{trozo(s, j)}</span>
              ))}
            </span>
          ) : (
            <span key={k} data-k={k} class={clases} onClick={() => fijarElegida(k)}>
              {w.furigana.map(trozo)}
            </span>
          );
          return salto ? [<br key={`br${k}`} />, pieza] : [pieza];
        }) as JSX.Element[],
        tokens.flatMap((w, k) => {
          const anterior = k > 0 ? sitios[k - 1] : null;
          const salto = anterior && sitios[k] && texto.slice(anterior.fin, sitios[k]!.inicio).includes('\n');
          const t = w.esPalabra ? null : lengua.value.escritura.pegarSignos(w.superficie);
          return salto ? [null, t] : [t];
        })
      )
    : texto;

  const cabecera = (
    <div class="vs-ventana-cab" onPointerDown={moverDesde}>
      <span class="vs-ventana-que">{tr(ETIQUETA[unidad.tipo])}</span>
      <button
        class={`btn-icono chico ${p.fijada ? 'activo' : ''}`}
        aria-pressed={p.fijada}
        aria-label={p.fijada ? tr('Soltar la ventana') : tr('Fijar a un lado')}
        data-tip={p.fijada ? tr('Soltar la ventana') : tr('Fijar a un lado')}
        onClick={() => p.alFijar(!p.fijada)}
      >
        <Icono n="fijar" t={15} />
      </button>
      <button class="btn-icono chico" aria-label={tr('Cerrar')} data-tip={tr('Cerrar · Esc')} onClick={p.alCerrar}>
        <Icono n="cerrar" t={15} />
      </button>
    </div>
  );

  const cuerpo = (
    <div class="vs-ventana-cuerpo">
      {borrador !== null ? (
        <div class="vs-editar">
          <textarea
            class="campo vs-editar-campo"
            lang={lengua.value.id}
            aria-label={tr('Texto de la línea')}
            value={borrador}
            rows={Math.min(5, Math.max(2, Math.ceil(borrador.length / 18)))}
            ref={(el) => {
              // Al abrirse, el cursor ya está dentro y el texto elegido, para escribir encima sin más.
              if (el && !el.dataset.listo) {
                el.dataset.listo = '1';
                el.focus();
                el.select();
              }
            }}
            onInput={(e) => fijarBorrador(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
                e.preventDefault();
                void guardar();
              } else if (e.key === 'Escape') {
                e.stopPropagation();
                fijarBorrador(null);
              }
            }}
          />
          <div class="vs-editar-botones">
            <button class="btn chico fantasma" onClick={() => fijarBorrador(null)}>{tr('Cancelar')}</button>
            <button class="btn chico primario" onClick={() => void guardar()} disabled={!borrador.trim()}>{tr('Guardar')}</button>
          </div>
        </div>
      ) : (
        <p class={`vs-ventana-texto ${clasesPalabras(ajustes)}`} lang={lengua.value.id}>
          {textoAnalizado}
        </p>
      )}

      {borrador === null && (
        <div class="vs-acciones" role="toolbar" aria-label={tr('Qué hacer con esto')}>
          <Accion
            icono="traducir"
            nombre={tr('Traducir')}
            activa={accion === 'traducir'}
            alPulsar={() => {
              if (accion !== 'traducir') p.alTraducir?.();
              alternar('traducir');
            }}
          />
          {esTrozo && <Accion icono="ia" nombre={tr('Explicar')} ayuda={tr('Qué significa aquí, dentro de su frase')} activa={accion === 'explicar'} alPulsar={() => alternar('explicar')} />}
          <Accion icono="frases" nombre={tr('Desglosar')} ayuda={tr('La frase por partes, con su gramática')} activa={accion === 'desglosar'} alPulsar={() => alternar('desglosar')} />
          <Accion icono="altavoz" nombre={tr('Escuchar')} alPulsar={() => void escuchar()} />
          <Accion icono="resaltar" nombre={tr('Resaltar')} activa={resaltando} alPulsar={() => fijarResaltando(!resaltando)} />
          <Accion icono="nota" nombre={tr('Nota')} ayuda={tr('Resalta esto y escribe un comentario')} alPulsar={anotar} />
          <Accion icono={copiado ? 'ok' : 'copiar'} nombre={copiado ? tr('Copiado') : tr('Copiar')} alPulsar={copiar} />
          <button class={`btn-icono chico ${mas ? 'activo' : ''}`} aria-expanded={mas} aria-label={tr('Más')} data-tip={tr('Más')} onClick={() => fijarMas(!mas)}>
            <Icono n="menu" t={15} />
          </button>
        </div>
      )}

      {borrador === null && mas && (
        <div class="vs-acciones vs-acciones-mas">
          {p.alBuscar && <Accion icono="buscar" nombre={tr('Buscar en el libro')} alPulsar={() => p.alBuscar?.(texto.replace(/\n/g, ' '))} />}
          {p.alEditar && editable && <Accion icono="lapiz" nombre={tr('Editar la línea')} ayuda={tr('Cambia el texto de esta línea a mano')} alPulsar={() => fijarBorrador(editable.texto)} />}
          {editable?.edicion && (
            <>
              <span class="ayuda" title={editable.original ? tr('Antes: {0}', editable.original) : undefined}>{editable.origen === 'claude' ? tr('Revisado con Claude') : tr('Editado')}</span>
              <Accion icono="reiniciar" nombre={tr('Restaurar')} ayuda={editable.original ? tr('Antes: {0}', editable.original) : undefined} alPulsar={() => void p.alRestaurar?.(lineaEditable)} />
            </>
          )}
        </div>
      )}

      {borrador === null && resaltando && (
        <div class="vs-resaltar">
          {sitioElegida && palabra && (
            <span class="segmentado vs-resaltar-objetivo" role="radiogroup" aria-label={tr('Qué resaltar')}>
              <button role="radio" aria-checked={!soloPalabra} class={soloPalabra ? '' : 'activo'} onClick={() => fijarSoloPalabra(false)}>{unidad.tipo === 'seleccion' ? tr('Lo seleccionado') : tr(ETIQUETA[unidad.tipo])}</button>
              <button role="radio" aria-checked={soloPalabra} class={soloPalabra ? 'activo' : ''} lang={lengua.value.id} onClick={() => fijarSoloPalabra(true)}>{tr('Solo «{0}»', palabra.superficie)}</button>
            </span>
          )}
          <span class="vs-resaltar-botones">
            {COLORES.map((c) => (
              <button key={c} class={`vs-color ${c}`} aria-label={resaltarEn(c)} data-tip={resaltarEn(c)} onClick={() => resaltar('fondo', c)} />
            ))}
            <button class="btn chico fantasma" data-tip={tr('Una línea debajo, en lugar del fondo de color')} onClick={() => resaltar('subrayado', 'rosa')}>
              <Icono n="subrayar" t={13} /> {tr('Subrayar')}
            </button>
          </span>
        </div>
      )}

      {borrador === null && accion === 'traducir' && <PanelFlujo key={`t-${texto}`} metodo="traducir" args={[contextoBase]} titulo={tr('Traducción')} />}
      {borrador === null && accion === 'explicar' && (
        <PanelFlujo
          key={`e-${texto}`}
          metodo="explicar"
          args={[{ lema: texto, superficie: texto, frase: unidad.contexto.frase, antes: unidad.contexto.antes, despues: unidad.contexto.despues, titulo: p.titulo }, false]}
          titulo={tr('¿Qué significa aquí?')}
        />
      )}
      {borrador === null && accion === 'desglosar' && <PanelFlujo key={`d-${texto}`} metodo="desglosar" args={[contextoBase]} titulo={tr('Desglose de la frase')} render={(t) => <Desglose texto={t} />} />}

      {borrador === null && p.resaltados.length > 0 && (
        <ul class="vs-resaltados-linea">
          {p.resaltados.map((r) => (
            <li key={r.id} class={`vs-resaltado-linea ${r.color ?? 'amarillo'} ${r.estilo ?? 'fondo'}`}>
              <q lang={lengua.value.id}>{r.texto}</q>
              {comentando === r.id ? (
                <EditorNota
                  inicial={r.nota ?? ''}
                  etiqueta={tr('Escribe un comentario')}
                  alGuardar={(nota) => {
                    const { nota: _n, ...resto } = r;
                    p.alGuardarAnotacion(nota ? { ...resto, nota } : resto);
                    fijarComentando(null);
                  }}
                  alCancelar={() => fijarComentando(null)}
                />
              ) : (
                <>
                  {r.nota && <p class="vs-resaltado-comentario">{r.nota}</p>}
                  <span class="vs-resaltado-acciones">
                    <button class="btn chico fantasma" onClick={() => fijarComentando(r.id)}>
                      <Icono n="lapiz" t={13} /> {r.nota ? tr('Editar el comentario') : tr('Comentar')}
                    </button>
                    <button class="btn chico fantasma" onClick={() => p.alQuitarAnotacion(r.id)}>
                      <Icono n="basura" t={13} /> {r.estilo === 'subrayado' ? tr('Quitar el subrayado') : tr('Quitar el resaltado')}
                    </button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {palabra ? (
        <div class="vs-ficha">
          <Ficha
            key={`${unidad.clave}-${elegida}`}
            lema={palabra.lema}
            lectura={palabra.lecturaLema}
            superficie={palabra.superficie}
            flexion={palabra.flexion}
            ajustes={ajustes}
            estado={palabra.estado}
            rastreada={palabra.rastreada}
            gramatica={gramatica}
            contexto={{ frase: unidad.contexto.frase, antes: unidad.contexto.antes, despues: unidad.contexto.despues, titulo: p.titulo }}
            fraseFuera
            alCorregirLectura={analizar}
            alEnviar={(r) =>
              enviarAlCreador(
                {
                  palabra: r.lema,
                  lectura: lecturaDeTarjeta(r),
                  frase: fraseTarjeta(palabra.clave) || unidad.contexto.frase,
                  definicion: [...new Set(r.entradas.flatMap((e) => e.glosas))].slice(0, 5).join('<br>'),
                  fuente: p.titulo,
                },
                false
              )
            }
          />
        </div>
      ) : (
        tokens.length > 0 && <p class="ayuda vs-pista">{tr('Toca una palabra para ver su ficha.')}</p>
      )}
    </div>
  );

  if (p.fijada) {
    return (
      <aside ref={raiz} class="vs-panel vs-ventana fijada" style={{ width: `${anchoFijada}px` }} aria-label={tr(ETIQUETA[unidad.tipo])}>
        <div class="vs-ventana-borde" aria-hidden="true" onPointerDown={redimensionar} />
        {cabecera}
        {cuerpo}
      </aside>
    );
  }
  // Al margen de la hoja puede quedar algo más estrecha, para caber sin tapar la página.
  const estilo: Record<string, string> = { width: `${!movida && lugar ? lugar.ancho : ancho}px` };
  if (movida) {
    estilo.left = `${movida.left}px`;
    estilo.top = `${movida.top}px`;
    estilo.maxHeight = `${innerHeight - movida.top - 12}px`;
  } else if (lugar) {
    estilo.left = `${lugar.left}px`;
    if (lugar.top !== undefined) estilo.top = `${lugar.top}px`;
    if (lugar.bottom !== undefined) estilo.bottom = `${lugar.bottom}px`;
    estilo.maxHeight = `${lugar.maxAlto}px`;
  } else estilo.visibility = 'hidden';
  if (tam.alto) estilo.height = `${tam.alto}px`;
  return (
    <div ref={raiz} class={`vs-ventana flotante ${lugar?.lado ?? ''}`} style={estilo} role="dialog" aria-label={tr(ETIQUETA[unidad.tipo])}>
      {cabecera}
      {cuerpo}
      <div class="vs-ventana-asa" aria-hidden="true" onPointerDown={redimensionar} />
    </div>
  );
}
