// La Ayuda de lectura: la estantería con los libros, textos y relatos, sus colecciones, lo que se importa a ella y la
// lectura de los textos por páginas. Los libros de páginas se leen en el visor, en su propia pestaña, que guarda por dónde
// se va; aquí se ve cuánto se lleva de cada uno y de cada colección.

import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Ajustes } from '../compartido/ajustes';
import { archivoDocumento, guardarArchivoDocumento } from '../compartido/documentos';
import { numero, tm, tr } from '../compartido/i18n';
import { flujoMotor, fondo, motor } from '../compartido/rpc';
import type { CambioBiblioteca, ColeccionBiblioteca, ElementoBiblioteca, TipoColeccion } from '../compartido/tipos';
import { librosDeImagenes } from '../nucleo/carpetas';
import { type Avance, avanceDe, coleccionesDeImportados, deTomos, enCurso, type FiltroEstanteria, filtrar, type Importado, librosDe, resumenDe } from '../nucleo/estanteria';
import { estructuraDeHtml, estructuraDeNodo, type NodoHtml } from '../nucleo/estructura';
import { IMAGEN, leerEpubDeTexto, leerLibro } from '../nucleo/libro';
import { analizarSubtitulos } from '../nucleo/subtitulos';
import { fuenteDeArchivo, LIMITE_ZIP, leerEntrada } from '../nucleo/zip';
import { Icono } from '../ui/iconos';
import { lengua } from '../ui/lengua';
import { datosDeZip, miniaturaDe } from '../visor/paginador';
import { datosDePdf } from '../visor/pdf';
import { estaProcesado } from '../visor/procesador';
import { guardarPreferencia, leerPreferencia, navegar } from './estadoApp';
import { type ArchivoImportado, archivosElegidos, archivosSoltados, cbzDe, tamanoDe } from './importacion';
import { TextoInteractivo } from './Lectura';
import { Cabecera, Mensaje, Vacio } from './Piezas';
import { descargaOcr, pausar, procesar, procesos } from './procesos';

/** El idioma de un título: el que se estudia si está escrito en él. */
export const langDe = (titulo: string) => (lengua.value.escritura.tieneTexto(titulo) ? lengua.value.id : undefined);

const TAM_PAGINA = 2500;

/** Parte el texto en páginas: entre párrafos si se puede, y si no, al final de una línea. */
function paginas(texto: string): string[] {
  const salida: string[] = [];
  let i = 0;
  while (i < texto.length) {
    let fin = Math.min(i + TAM_PAGINA, texto.length);
    if (fin < texto.length) {
      const parrafo = texto.lastIndexOf('\n\n', fin);
      const linea = texto.lastIndexOf('\n', fin);
      if (parrafo > i + TAM_PAGINA / 2) fin = parrafo + 2;
      else if (linea > i + TAM_PAGINA / 2) fin = linea + 1;
    }
    salida.push(texto.slice(i, fin));
    i = fin;
  }
  return salida.length ? salida : [''];
}

async function textoDeArchivo(f: File): Promise<string> {
  const crudo = await f.text();
  if (/\.(srt|vtt|ass|ssa)$/i.test(f.name)) return analizarSubtitulos(crudo).map((l) => l.texto).join('\n');
  if (/\.html?$/i.test(f.name)) return estructuraDeHtml(crudo);
  if (/\.epub$/i.test(f.name)) return textoDeEpub(await f.arrayBuffer());
  return crudo;
}

async function textoDeEpub(datos: ArrayBuffer): Promise<string> {
  const { unzipSync, strFromU8 } = await import('fflate');
  const archivos = unzipSync(new Uint8Array(datos));
  const opf = Object.keys(archivos).find((n) => n.endsWith('.opf'));
  if (!opf) throw new Error(tr('EPUB sin índice'));
  const doc = new DOMParser().parseFromString(strFromU8(archivos[opf]), 'application/xml');
  const base = opf.includes('/') ? opf.slice(0, opf.lastIndexOf('/') + 1) : '';
  const items = new Map([...doc.querySelectorAll('manifest > item')].map((i) => [i.getAttribute('id'), i.getAttribute('href')]));
  const partes: string[] = [];
  for (const r of doc.querySelectorAll('spine > itemref')) {
    const href = items.get(r.getAttribute('idref'));
    const a = href ? archivos[base + decodeURI(href)] : undefined;
    if (!a) continue;
    // Cada capítulo con su estructura: títulos, párrafos y listas, sin el furigana del libro.
    const html = new DOMParser().parseFromString(strFromU8(a), 'text/html');
    const t = html.body ? estructuraDeNodo(html.body as unknown as NodoHtml).trim() : '';
    if (t) partes.push(t);
  }
  return partes.join('\n\n');
}

const TONOS_PORTADA = 5;

/** El tono de la portada sale del título, para que cada libro conserve siempre el suyo. */
function tonoDe(titulo: string): number {
  let h = 0;
  for (const c of titulo) h = (h * 31 + c.codePointAt(0)!) >>> 0;
  return h % TONOS_PORTADA;
}

export const claseTono = (e: ElementoBiblioteca) => (e.origen === 'historia' ? 'claude' : `tono-${tonoDe(e.titulo)}`);
export const paginasDe = (e: ElementoBiblioteca) => Math.max(1, e.documento ? e.documento.paginas : Math.ceil(e.texto.length / TAM_PAGINA));
const megas = (bytes: number) => `${numero(Math.max(0.1, Math.round(bytes / 1e5) / 10))} MB`;
/** Cuánto se ha leído de un elemento de la estantería. */
export const avance = (e: ElementoBiblioteca): Avance => avanceDe(e, paginasDe(e));
const porcentaje = (a: Avance) => `${Math.max(1, Math.floor(a.fraccion * 100))} %`;
/** Por dónde se va: la página, o el capítulo en un libro de texto. */
const posicionDe = (e: ElementoBiblioteca, a: Avance) => (e.documento?.texto ? tr('Cap. {0} de {1}', a.actual, a.total) : tr('Página {0} de {1}', a.actual, a.total));
const verticalDe = (titulo: string) => !!langDe(titulo) && lengua.value.escritura.portadaVertical;

/** La portada de verdad de un libro de páginas, encima de la tapa dibujada. */
export const Portada = ({ e }: { e: ElementoBiblioteca }) => (e.documento?.portada ? <img class="ap-tapa-imagen" src={e.documento.portada} alt="" draggable={false} /> : null);

// ---------- Colecciones ----------

const TIPOS: { id: TipoColeccion; nombre: string }[] = [
  { id: 'manga', nombre: tm('Manga') },
  { id: 'novela', nombre: tm('Novela') },
  { id: 'estudio', nombre: tm('Estudio') },
  { id: 'otro', nombre: tm('Otro') },
];

/** «6 tomos» en una colección de manga o de novelas; «6 libros» en las demás. */
const cuantos = (n: number, tipo?: TipoColeccion) => (deTomos(tipo) ? (n === 1 ? tr('1 tomo') : tr('{0} tomos', n)) : n === 1 ? tr('1 libro') : tr('{0} libros', n));
const lugarEn = (posicion: number, total: number, tipo?: TipoColeccion) => (deTomos(tipo) ? tr('Tomo {0} de {1}', posicion, total) : tr('Libro {0} de {1}', posicion, total));

/** Cómo va una colección, en pocas palabras. */
function estadoDe(c: ColeccionBiblioteca, lista: ElementoBiblioteca[]): string {
  const r = resumenDe(c, lista, avance);
  const total = r.libros.length;
  if (!total) return tr('Vacía');
  if (r.terminados === total) return tr('Terminada');
  if (r.actual) return lugarEn(r.posicion!, total, c.tipo);
  return r.terminados ? tr('{0} de {1} terminados', r.terminados, total) : tr('Sin empezar');
}

/** La tapa de una colección: la portada elegida, o la del primer libro, con otras dos debajo, como una pila de tomos. */
function TapaColeccion({ c, portada, total, fraccion, alAbrir }: { c: ColeccionBiblioteca; portada?: string; total: number; fraccion: number; alAbrir?: () => void }) {
  const clase = `ap-tapa tono-${tonoDe(c.nombre)} ${verticalDe(c.nombre) ? 'vertical' : 'horizontal'} ${portada ? 'con-portada' : ''}`;
  const dentro = (
    <>
      {portada && <img class="ap-tapa-imagen" src={portada} alt="" draggable={false} />}
      <span class="ap-tapa-titulo" lang={langDe(c.nombre)}>{c.nombre}</span>
      <span class="ap-obi">
        <Icono n="pila" t={13} />
        <span class="num">{cuantos(total, c.tipo)}</span>
        {fraccion > 0 && <i class="ap-obi-avance" style={{ width: `${fraccion * 100}%` }} />}
      </span>
    </>
  );
  return alAbrir ? (
    <button class={clase} aria-label={tr('Abrir la colección {0}', c.nombre)} onClick={alAbrir}>
      {dentro}
    </button>
  ) : (
    <span class={clase} aria-hidden="true">
      {dentro}
    </span>
  );
}

function TarjetaColeccion({ c, lista }: { c: ColeccionBiblioteca; lista: ElementoBiblioteca[] }) {
  const r = resumenDe(c, lista, avance);
  return (
    <article class="ap-libro ap-coleccion">
      <div class="ap-libro-tapa-marco ap-pila">
        <TapaColeccion c={c} portada={r.portada} total={r.libros.length} fraccion={r.fraccion} alAbrir={() => navegar(`biblioteca?coleccion=${encodeURIComponent(c.id)}`)} />
      </div>
      <h3 title={c.nombre} lang={langDe(c.nombre)}>{c.nombre}</h3>
      <p class="ayuda">{estadoDe(c, lista)}</p>
    </article>
  );
}

// ---------- Libros ----------

/**
 * Un libro (EPUB, CBZ o PDF) se guarda tal cual, aparte, y se lee en el visor: un EPUB de texto, con su propio formato y
 * capítulo a capítulo; lo demás, por páginas. De un PDF se saca ya su portada y cuántas páginas tiene. Devuelve null si no
 * es un libro, o si un EPUB de texto no se puede leer así: entonces sigue el camino del texto.
 */
async function importarDocumento(f: File, coleccion?: string): Promise<ElementoBiblioteca | null> {
  const formato = /\.pdf$/i.test(f.name) ? 'pdf' : /\.cbz$/i.test(f.name) ? 'cbz' : /\.epub$/i.test(f.name) ? 'epub' : null;
  if (!formato) return null;
  let titulo = f.name.replace(/\.[^.]+$/, '');
  let paginas = 0;
  let direccion: 'rtl' | 'ltr' = 'ltr';
  let portada: string | undefined;
  let anchas: number[] | undefined;
  let texto = false;
  if (formato === 'pdf') {
    // Un PDF dañado o con contraseña entra igual: el visor dirá qué le pasa al abrirlo.
    const datos = await datosDePdf(f).catch(() => null);
    if (datos) ({ paginas, direccion, portada } = datos);
  } else {
    const fuente = fuenteDeArchivo(f);
    // Un CBZ no dice su sentido si no trae ComicInfo: en japonés, lo normal es el manga, de derecha a izquierda.
    const { libro, indice } = await leerLibro(fuente, f.name, lengua.value.id === 'ja' ? 'rtl' : 'ltr');
    if (libro) {
      titulo = libro.titulo;
      paginas = libro.paginas.length;
      direccion = libro.direccion;
      ({ portada, anchas } = await datosDeZip(f, f.name).catch(() => ({ portada: undefined, anchas: undefined })));
    } else {
      const novela = await leerEpubDeTexto(fuente, indice, titulo).catch(() => null);
      if (!novela) return null;
      texto = true;
      titulo = novela.titulo;
      paginas = novela.capitulos.length;
      direccion = novela.direccion;
      const tapa = novela.portada ? indice.get(novela.portada) : undefined;
      if (tapa) portada = await leerEntrada(fuente, tapa).then((b) => miniaturaDe(new Blob([b as BlobPart]))).catch(() => undefined);
    }
  }
  const id = crypto.randomUUID();
  await guardarArchivoDocumento(id, f);
  const e: ElementoBiblioteca = {
    id,
    titulo,
    texto: '',
    origen: 'archivo',
    creado: Date.now(),
    ...(coleccion ? { coleccion } : {}),
    documento: { formato, ...(texto ? { texto } : {}), paginas, direccion, tamano: f.size, portada, ...(anchas ? { anchas } : {}) },
  };
  await motor.bibliotecaGuardar(e);
  return e;
}

/** Los PDF de antes de la 0.10.0 no tienen portada ni páginas hasta abrirlos: se sacan aquí, uno a uno y una sola vez. */
const pdfsMirados = new Set<string>();
async function completarPdf(e: ElementoBiblioteca): Promise<boolean> {
  pdfsMirados.add(e.id);
  const archivo = await archivoDocumento(e.id);
  if (!archivo) return false;
  const datos = await datosDePdf(archivo);
  await motor.bibliotecaCambiar(e.id, { documento: { ...(e.documento?.paginas ? {} : { paginas: datos.paginas }), ...(datos.portada && !e.documento?.portada ? { portada: datos.portada } : {}) } });
  return true;
}

const NOMBRE_ORIGEN: Record<ElementoBiblioteca['origen'], string> = {
  historia: tm('Relato de Claude'),
  archivo: 'Archivo',
  pegado: tm('Texto pegado'),
};

/** Lo que dice la faja de la tapa: cuánto tiene, por dónde se va o que está terminado. */
function fajaDe(e: ElementoBiblioteca, a: Avance): string {
  if (a.terminado) return tr('Terminado');
  if (e.documento && !e.documento.paginas) return e.documento.formato.toUpperCase();
  if (e.documento?.texto) return a.empezado ? tr('Cap. {0} de {1}', a.actual, a.total) : a.total === 1 ? tr('Lectura breve') : tr('{0} capítulos', a.total);
  return a.empezado ? tr('Pág. {0} de {1}', a.actual, a.total) : a.total === 1 ? tr('Lectura breve') : tr('{0} páginas', a.total);
}

function Libro({ e, colecciones, alAbrir, alEliminar, alCambiar, alMover }: { e: ElementoBiblioteca; colecciones: ColeccionBiblioteca[]; alAbrir: () => void; alEliminar: () => void; alCambiar: () => void; alMover: () => void }) {
  const a = avance(e);
  const titulo = langDe(e.titulo);
  const claude = e.origen === 'historia';
  return (
    <article class={`ap-libro ${a.terminado ? 'terminado' : ''}`}>
      <div class="ap-libro-tapa-marco">
        <button class={`ap-tapa ${claseTono(e)} ${verticalDe(e.titulo) ? 'vertical' : 'horizontal'} ${e.documento?.portada ? 'con-portada' : ''}`} aria-label={tr('Leer {0}', e.titulo)} onClick={alAbrir}>
          <Portada e={e} />
          <span class="ap-tapa-titulo" lang={titulo}>{e.titulo}</span>
          <span class="ap-obi">
            {a.terminado ? <Icono n="ok" t={13} /> : claude ? <Icono n="ia" t={13} /> : <Icono n={e.documento ? 'libro' : 'hoja'} t={13} />}
            <span class="num">{fajaDe(e, a)}</span>
            {a.empezado && !a.terminado && <i class="ap-obi-avance" style={{ width: `${a.fraccion * 100}%` }} />}
          </span>
        </button>
        <button class="btn-icono chico relleno ap-libro-quitar" aria-label={tr('Eliminar {0}', e.titulo)} data-tip={tr('Eliminar')} onClick={alEliminar}><Icono n="basura" t={14} /></button>
        <MenuLibro e={e} colecciones={colecciones} alCambiar={alCambiar} alMover={alMover} />
      </div>
      <h3 title={e.titulo} lang={titulo}>{e.titulo}</h3>
      {a.terminado ? (
        <p class="ayuda ap-libro-estado terminado"><Icono n="check" t={12} /> {tr('Terminado')}</p>
      ) : a.empezado ? (
        <p class="ayuda ap-libro-estado num">{tr('{0} leído', porcentaje(a))}</p>
      ) : e.documento ? (
        <p class="ayuda">{`${e.documento.formato.toUpperCase()} · ${megas(e.documento.tamano)}`}</p>
      ) : (
        <p class="ayuda" title={tr('{0} caracteres', numero(e.texto.length))}>{tr(NOMBRE_ORIGEN[e.origen])}</p>
      )}
      {e.documento && !e.documento.texto && <ProcesoLibro e={e} alCambiar={alCambiar} />}
    </article>
  );
}

/** Lo que se puede hacer con un libro: llevarlo a una colección, cambiarle la portada y marcarlo como terminado. */
function MenuLibro({ e, colecciones, alCambiar, alMover }: { e: ElementoBiblioteca; colecciones: ColeccionBiblioteca[]; alCambiar: () => void; alMover: () => void }) {
  const [abierto, fijarAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const imagen = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (ev: MouseEvent) => {
      if (!caja.current?.contains(ev.target as Node)) fijarAbierto(false);
    };
    const tecla = (ev: KeyboardEvent) => ev.key === 'Escape' && fijarAbierto(false);
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);
  const c = colecciones.find((x) => x.id === e.coleccion);
  const cambiar = async (cambio: CambioBiblioteca) => {
    fijarAbierto(false);
    await motor.bibliotecaCambiar(e.id, cambio);
    alCambiar();
  };
  const terminado = avance(e).terminado;
  return (
    <div class={`ap-libro-menu ${abierto ? 'abierto' : ''}`} ref={caja}>
      <button class="btn-icono chico relleno" aria-label={tr('Opciones de {0}', e.titulo)} aria-haspopup="menu" aria-expanded={abierto} data-tip={tr('Opciones')} onClick={() => fijarAbierto(!abierto)}>
        <Icono n="menu" t={15} />
      </button>
      {abierto && (
        <div class="ap-menu-libro" role="menu">
          <button role="menuitem" onClick={() => { fijarAbierto(false); alMover(); }}>
            <Icono n="pila" t={15} /> {c ? tr('Cambiar de colección…') : tr('Añadir a una colección…')}
          </button>
          {c && (
            <button role="menuitem" onClick={() => cambiar({ coleccion: null })}>
              <Icono n="menos" t={15} /> {tr('Sacar de «{0}»', c.nombre)}
            </button>
          )}
          {e.documento && (
            <button role="menuitem" onClick={() => imagen.current?.click()}>
              <Icono n="imagen" t={15} /> {tr('Cambiar la portada…')}
            </button>
          )}
          {terminado ? (
            <button role="menuitem" onClick={() => cambiar({ terminado: null, pagina: 0, ...(e.documento?.texto ? { documento: { posicion: 0 } } : {}) })}>
              <Icono n="reiniciar" t={15} /> {tr('Volver a empezar')}
            </button>
          ) : (
            <button role="menuitem" onClick={() => cambiar({ terminado: Date.now() })}>
              <Icono n="check" t={15} /> {tr('Marcar como terminado')}
            </button>
          )}
        </div>
      )}
      <input
        ref={imagen}
        type="file"
        accept="image/*"
        hidden
        aria-label={tr('Elegir la imagen de la portada')}
        onChange={async (ev) => {
          const f = ev.currentTarget.files?.[0];
          ev.currentTarget.value = '';
          if (f) await cambiar({ documento: { portada: await miniaturaDe(f) } });
        }}
      />
    </div>
  );
}

/**
 * Leer el libro entero con el OCR por adelantado, desde su tarjeta: el botón, el avance mientras se lee, la pausa y, al
 * acabar, que el texto ya está listo.
 */
function ProcesoLibro({ e, alCambiar }: { e: ElementoBiblioteca; alCambiar: () => void }) {
  const p = procesos.value[e.id];
  if (p?.estado === 'listo' || (!p && estaProcesado(e.documento!))) {
    return (
      <p class="ayuda ap-proceso listo" title={tr('Todas las páginas están leídas con el OCR: al abrirlo, el texto ya está')}>
        <Icono n="check" t={12} /> {tr('Texto listo')}
      </p>
    );
  }
  if (p?.estado === 'procesando' || p?.estado === 'en-cola') {
    const d = descargaOcr.value;
    const texto =
      p.estado === 'en-cola'
        ? tr('En cola')
        : d
          ? tr('Descargando el reconocimiento de texto: {0} %', Math.round((100 * d.cargado) / Math.max(1, d.total)))
          : p.total
            ? tr('Procesando {0} de {1}', numero(p.hechas), numero(p.total))
            : tr('Procesando…');
    return (
      <div class="ap-proceso" role="status">
        <span class="ayuda num">{texto}</span>
        <button class="btn-icono chico" aria-label={tr('Pausar')} data-tip={tr('Pausar')} onClick={() => pausar(e.id)}>
          <Icono n="pausa" t={12} />
        </button>
        <i class="ap-proceso-barra">
          <i style={{ width: `${p.total ? (100 * p.hechas) / p.total : 0}%` }} />
        </i>
      </div>
    );
  }
  return (
    <div class="ap-proceso">
      {p?.estado === 'en-pausa' && <span class="ayuda num">{tr('En pausa: {0} de {1}', numero(p.hechas), numero(p.total))}</span>}
      {p?.estado === 'error' && <span class="ayuda ap-proceso-error" title={p.error}>{p.error}</span>}
      <button class="btn chico fantasma ap-procesar" data-tip={tr('Lee ahora con el OCR todas las páginas, para que al leer no haya que esperar')} onClick={() => procesar(e, alCambiar)}>
        <Icono n="rayo" t={13} /> {p?.estado === 'en-pausa' ? tr('Seguir') : p?.estado === 'error' ? tr('Reintentar') : tr('Procesar')}
      </button>
    </div>
  );
}

/** El libro por el que se va, en la pantalla de inicio. */
export function SeguirLeyendo({ e }: { e: ElementoBiblioteca }) {
  const a = avance(e);
  return (
    <section class="tarjeta ap-seguir ap-c12" aria-label={tr('Seguir leyendo')}>
      <span class={`ap-tapa mini ${claseTono(e)} ${e.documento?.portada ? 'con-portada' : ''}`} aria-hidden="true"><Portada e={e} /><span class="ap-obi" /></span>
      <div class="ap-seguir-texto">
        <span class="ayuda">{tr('Sigue leyendo')}</span>
        <b lang={langDe(e.titulo)}>{e.titulo}</b>
      </div>
      {a.total > 1 && (
        <div class="ap-seguir-avance">
          <span class="ayuda num">{posicionDe(e, a)}</span>
          <div class="barra-progreso"><div style={{ width: `${a.fraccion * 100}%` }} /></div>
        </div>
      )}
      <button class="btn" onClick={() => navegar(`biblioteca?abrir=${encodeURIComponent(e.id)}`)}>{tr('Continuar')} <Icono n="flecha" t={15} /></button>
    </section>
  );
}

/** Lo que se está leyendo, arriba de la estantería: un clic y se sigue por donde se iba. */
function EnCurso({ libros, alAbrir }: { libros: ElementoBiblioteca[]; alAbrir: (e: ElementoBiblioteca) => void }) {
  return (
    <section class="ap-en-curso" aria-labelledby="ap-t-en-curso">
      <h2 class="ap-seccion-titulo" id="ap-t-en-curso">{tr('Seguir leyendo')}</h2>
      <div class="ap-en-curso-lista">
        {libros.map((e) => {
          const a = avance(e);
          return (
            <button key={e.id} class="tarjeta ap-en-curso-libro" aria-label={tr('Seguir leyendo {0}', e.titulo)} onClick={() => alAbrir(e)}>
              <span class={`ap-tapa mini ${claseTono(e)} ${e.documento?.portada ? 'con-portada' : ''}`} aria-hidden="true"><Portada e={e} /><span class="ap-obi" /></span>
              <span class="ap-en-curso-texto">
                <b lang={langDe(e.titulo)}>{e.titulo}</b>
                <span class="ayuda num">{`${posicionDe(e, a)} · ${porcentaje(a)}`}</span>
                <span class="barra-progreso"><i style={{ width: `${a.fraccion * 100}%` }} /></span>
              </span>
              <Icono n="flecha" t={16} />
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ---------- Diálogos ----------

type Dialogo =
  | { tipo: 'coleccion'; coleccion?: ColeccionBiblioteca; libros?: string[] }
  | { tipo: 'mover'; libro: ElementoBiblioteca }
  | { tipo: 'anadir'; coleccion: ColeccionBiblioteca }
  | { tipo: 'portada'; coleccion: ColeccionBiblioteca };

function Modal({ titulo, alCerrar, children }: { titulo: string; alCerrar: () => void; children: ComponentChildren }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && alCerrar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);
  return (
    <div class="ap-modal-fondo" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) alCerrar(); }}>
      <div class="ap-modal ap-dialogo" role="dialog" aria-modal="true" aria-label={titulo}>
        <button class="btn-icono chico ap-modal-cerrar" aria-label={tr('Cerrar')} onClick={alCerrar}><Icono n="cerrar" t={15} /></button>
        <h2>{titulo}</h2>
        {children}
      </div>
    </div>
  );
}

/** Crear una colección, con los libros que se le pasen, o cambiar su nombre, su tipo y su descripción. */
function DialogoColeccion({ coleccion, libros, alCerrar, alGuardar }: { coleccion?: ColeccionBiblioteca; libros?: string[]; alCerrar: () => void; alGuardar: (c: ColeccionBiblioteca, nueva: boolean) => void }) {
  const [nombre, fijarNombre] = useState(coleccion?.nombre ?? '');
  const [tipo, fijarTipo] = useState<TipoColeccion | undefined>(coleccion?.tipo);
  const [descripcion, fijarDescripcion] = useState(coleccion?.descripcion ?? '');
  const campo = useRef<HTMLInputElement>(null);
  // Antes de pintar: si no, el foco podría llegar después de que se empiece a escribir en otro campo.
  useLayoutEffect(() => campo.current?.focus(), []);
  const guardar = async (ev: Event) => {
    ev.preventDefault();
    if (!nombre.trim()) return;
    const { tipo: _t, descripcion: _d, ...base } = coleccion ?? { id: crypto.randomUUID(), creada: Date.now(), nombre: '' };
    const c: ColeccionBiblioteca = { ...base, nombre: nombre.trim(), ...(tipo ? { tipo } : {}), ...(descripcion.trim() ? { descripcion: descripcion.trim() } : {}) };
    await motor.coleccionGuardar(c);
    for (const id of libros ?? []) await motor.bibliotecaCambiar(id, { coleccion: c.id });
    alGuardar(c, !coleccion);
  };
  return (
    <Modal titulo={coleccion ? tr('Editar la colección') : tr('Nueva colección')} alCerrar={alCerrar}>
      <form class="ap-dialogo-form" onSubmit={guardar}>
        <label class="ap-dialogo-campo">
          <span>{tr('Nombre')}</span>
          <input ref={campo} class="campo" value={nombre} placeholder={tr('Una serie, un tema…')} onInput={(e) => fijarNombre(e.currentTarget.value)} />
        </label>
        <div class="ap-dialogo-campo">
          <span id="ap-t-tipo">{tr('Tipo')}</span>
          <div class="segmentado" role="radiogroup" aria-labelledby="ap-t-tipo">
            {TIPOS.map((t) => (
              <button key={t.id} type="button" role="radio" aria-checked={tipo === t.id} class={tipo === t.id ? 'activo' : ''} onClick={() => fijarTipo(tipo === t.id ? undefined : t.id)}>
                {tr(t.nombre)}
              </button>
            ))}
          </div>
        </div>
        <label class="ap-dialogo-campo">
          <span>{tr('Descripción')}</span>
          <textarea class="campo" rows={3} value={descripcion} placeholder={tr('Opcional')} onInput={(e) => fijarDescripcion(e.currentTarget.value)} />
        </label>
        <div class="ap-dialogo-botones">
          <button type="button" class="btn fantasma" onClick={alCerrar}>{tr('Cancelar')}</button>
          <button type="submit" class="btn primario" disabled={!nombre.trim()}>{coleccion ? tr('Guardar') : tr('Crear')}</button>
        </div>
      </form>
    </Modal>
  );
}

/** Llevar un libro a una colección, a una nueva o sacarlo de la suya. */
function DialogoMover({ libro, colecciones, lista, alCerrar, alNueva, alHecho }: { libro: ElementoBiblioteca; colecciones: ColeccionBiblioteca[]; lista: ElementoBiblioteca[]; alCerrar: () => void; alNueva: () => void; alHecho: () => void }) {
  const mover = async (id: string | null) => {
    await motor.bibliotecaCambiar(libro.id, { coleccion: id });
    alHecho();
  };
  return (
    <Modal titulo={tr('Colección de «{0}»', libro.titulo)} alCerrar={alCerrar}>
      <div class="ap-dialogo-lista">
        {colecciones.map((c) => {
          const r = resumenDe(c, lista, avance);
          const suya = libro.coleccion === c.id;
          return (
            <button key={c.id} class={`ap-dialogo-opcion ${suya ? 'elegida' : ''}`} aria-pressed={suya} onClick={() => mover(c.id)}>
              <span class={`ap-tapa mini tono-${tonoDe(c.nombre)} ${r.portada ? 'con-portada' : ''}`} aria-hidden="true">
                {r.portada && <img class="ap-tapa-imagen" src={r.portada} alt="" draggable={false} />}
                <span class="ap-obi" />
              </span>
              <span class="ap-dialogo-opcion-texto">
                <b lang={langDe(c.nombre)}>{c.nombre}</b>
                <span class="ayuda">{cuantos(r.libros.length, c.tipo)}</span>
              </span>
              {suya && <Icono n="ok" t={16} />}
            </button>
          );
        })}
        <button class="ap-dialogo-opcion nueva" onClick={alNueva}>
          <span class="hoja-icono chica"><Icono n="mas" t={16} /></span>
          <span class="ap-dialogo-opcion-texto"><b>{tr('Nueva colección…')}</b></span>
        </button>
      </div>
      {libro.coleccion && (
        <div class="ap-dialogo-botones">
          <button class="btn fantasma" onClick={() => mover(null)}>{tr('Dejarlo sin colección')}</button>
        </div>
      )}
    </Modal>
  );
}

/** Elegir de la estantería los libros que se añaden a una colección. */
function DialogoAnadir({ coleccion, colecciones, lista, alCerrar, alHecho }: { coleccion: ColeccionBiblioteca; colecciones: ColeccionBiblioteca[]; lista: ElementoBiblioteca[]; alCerrar: () => void; alHecho: () => void }) {
  const [elegidos, fijarElegidos] = useState<Set<string>>(() => new Set());
  // Primero los que no están en ninguna colección.
  const candidatos = lista.filter((e) => e.coleccion !== coleccion.id).sort((a, b) => Number(!!a.coleccion) - Number(!!b.coleccion));
  const alternar = (id: string) =>
    fijarElegidos((s) => {
      const n = new Set(s);
      if (!n.delete(id)) n.add(id);
      return n;
    });
  const anadir = async () => {
    for (const id of elegidos) await motor.bibliotecaCambiar(id, { coleccion: coleccion.id });
    alHecho();
  };
  return (
    <Modal titulo={tr('Añadir a «{0}»', coleccion.nombre)} alCerrar={alCerrar}>
      {candidatos.length ? (
        <ul class="ap-dialogo-lista ap-dialogo-libros">
          {candidatos.map((e) => {
            const otra = colecciones.find((c) => c.id === e.coleccion);
            return (
              <li key={e.id}>
                <label class={`ap-dialogo-opcion ${elegidos.has(e.id) ? 'elegida' : ''}`}>
                  <input type="checkbox" checked={elegidos.has(e.id)} onChange={() => alternar(e.id)} />
                  <span class={`ap-tapa mini ${claseTono(e)} ${e.documento?.portada ? 'con-portada' : ''}`} aria-hidden="true"><Portada e={e} /><span class="ap-obi" /></span>
                  <span class="ap-dialogo-opcion-texto">
                    <b lang={langDe(e.titulo)}>{e.titulo}</b>
                    {otra && <span class="ayuda">{tr('Ahora en «{0}»', otra.nombre)}</span>}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : (
        <p class="ayuda">{tr('Todo lo que hay en la estantería ya está en esta colección.')}</p>
      )}
      <div class="ap-dialogo-botones">
        <button class="btn fantasma" onClick={alCerrar}>{tr('Cancelar')}</button>
        <button class="btn primario" disabled={!elegidos.size} onClick={anadir}>{elegidos.size ? tr('Añadir {0}', elegidos.size) : tr('Añadir')}</button>
      </div>
    </Modal>
  );
}

/** La portada de una colección: la de uno de sus libros, una imagen propia o, sin elegir, la del primero. */
function DialogoPortada({ coleccion, lista, alCerrar, alHecho }: { coleccion: ColeccionBiblioteca; lista: ElementoBiblioteca[]; alCerrar: () => void; alHecho: () => void }) {
  const imagen = useRef<HTMLInputElement>(null);
  const conPortada = librosDe(coleccion, lista).filter((e) => e.documento?.portada);
  const fijar = async (portada?: string) => {
    const { portada: _p, ...base } = coleccion;
    await motor.coleccionGuardar(portada ? { ...base, portada } : base);
    alHecho();
  };
  return (
    <Modal titulo={tr('Portada de «{0}»', coleccion.nombre)} alCerrar={alCerrar}>
      {conPortada.length > 0 && (
        <>
          <p class="ayuda">{tr('Elige la de uno de sus libros o sube una imagen.')}</p>
          <div class="ap-portadas">
            {conPortada.map((e) => {
              const elegida = coleccion.portada === e.documento!.portada;
              return (
                <button key={e.id} class={`ap-portada-opcion ${elegida ? 'elegida' : ''}`} aria-pressed={elegida} aria-label={tr('La de {0}', e.titulo)} data-tip={e.titulo} onClick={() => fijar(e.documento!.portada)}>
                  <img src={e.documento!.portada} alt="" draggable={false} />
                </button>
              );
            })}
          </div>
        </>
      )}
      <div class="ap-dialogo-botones">
        {coleccion.portada && <button class="btn fantasma" onClick={() => fijar(undefined)}>{tr('La del primer libro')}</button>}
        <button class="btn" onClick={() => imagen.current?.click()}><Icono n="subir" t={15} /> {tr('Subir una imagen…')}</button>
      </div>
      <input
        ref={imagen}
        type="file"
        accept="image/*"
        hidden
        aria-label={tr('Elegir la imagen de la portada')}
        onChange={async (ev) => {
          const f = ev.currentTarget.files?.[0];
          ev.currentTarget.value = '';
          if (f) await fijar(await miniaturaDe(f));
        }}
      />
    </Modal>
  );
}

// ---------- La estantería ----------

const FILTROS: { id: FiltroEstanteria; nombre: string }[] = [
  { id: 'todo', nombre: tm('Todo') },
  { id: 'leyendo', nombre: tm('Leyendo') },
  { id: 'sin-empezar', nombre: tm('Sin empezar') },
  { id: 'terminados', nombre: tm('Terminados') },
];

const VACIO_DE: Record<Exclude<FiltroEstanteria, 'todo'>, string> = {
  leyendo: tm('No tienes ninguna lectura a medias.'),
  'sin-empezar': tm('Ya has empezado todo lo que tienes.'),
  terminados: tm('Aún no has terminado ninguna lectura.'),
};

export function Biblioteca({ ajustes, abrir, coleccion: idColeccion }: { ajustes: Ajustes; abrir?: string; coleccion?: string }) {
  const [lista, fijarLista] = useState<ElementoBiblioteca[]>([]);
  const [colecciones, fijarColecciones] = useState<ColeccionBiblioteca[]>([]);
  const [cargada, fijarCargada] = useState(false);
  const [abierto, fijarAbierto] = useState<ElementoBiblioteca | null>(null);
  const [pagina, fijarPagina] = useState(0);
  const [tema, fijarTema] = useState('');
  const [relato, fijarRelato] = useState('');
  const [generando, fijarGenerando] = useState(false);
  const [error, fijarError] = useState('');
  const [aviso, fijarAviso] = useState('');
  const [arrastrando, fijarArrastrando] = useState(false);
  const [progreso, fijarProgreso] = useState('');
  const [filtro, fijarFiltroEstado] = useState<FiltroEstanteria>(() => leerPreferencia('filtroEstanteria', 'todo'));
  const [dialogo, fijarDialogo] = useState<Dialogo | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const carpeta = useRef<HTMLInputElement>(null);
  /** La colección a la que va lo que se importe desde su página. */
  const destino = useRef<string | undefined>(undefined);

  const cargar = () =>
    Promise.all([motor.bibliotecaListar(), motor.coleccionesListar()])
      .then(([l, c]) => {
        fijarLista(l);
        fijarColecciones(c);
        fijarCargada(true);
        return l;
      })
      .catch((e) => {
        console.error(e);
        return undefined;
      });

  const fijarFiltro = (f: FiltroEstanteria) => {
    fijarFiltroEstado(f);
    guardarPreferencia('filtroEstanteria', f);
  };

  const abrirLibro = (e: ElementoBiblioteca) => {
    // Un libro de páginas se lee en el visor, en su propia pestaña; él guarda por dónde se va.
    if (e.documento) {
      fondo.abrirVisor(e.id).catch((x) => fijarError(x instanceof Error ? x.message : String(x)));
      return;
    }
    fijarPagina(e.pagina ?? 0);
    fijarAbierto(e);
    motor.bibliotecaCambiar(e.id, { abierto: Date.now() }).catch(console.error);
  };

  useEffect(() => {
    cargar().then((l) => {
      const pedido = abrir ? l?.find((e) => e.id === abrir) : undefined;
      if (pedido) abrirLibro(pedido);
    });
    // Al volver del visor, que lee en su propia pestaña, la estantería ya dice por dónde se va.
    const alVolver = () => {
      if (document.visibilityState === 'visible') void cargar();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, []);

  // Los PDF sin portada ni páginas, de antes de sacarlas al importar: de uno en uno, sin estorbar.
  useEffect(() => {
    const falta = lista.find((e) => e.documento?.formato === 'pdf' && (!e.documento.portada || !e.documento.paginas) && !pdfsMirados.has(e.id));
    if (falta) {
      completarPdf(falta).then(
        (hecho) => {
          if (hecho) void cargar();
        },
        () => {}
      );
    }
  }, [lista]);

  // En un texto, ver la última página lo deja terminado.
  const pags = abierto ? paginas(abierto.texto) : [];
  useEffect(() => {
    if (!abierto || abierto.terminado || pagina < pags.length - 1) return;
    const terminado = Date.now();
    fijarAbierto({ ...abierto, terminado });
    motor.bibliotecaCambiar(abierto.id, { terminado }).catch(console.error);
  }, [abierto?.id, pagina]);

  // Una colección que no está en lo cargado puede ser nueva: se mira otra vez, y si de verdad ya no existe (se quitó en
  // otra pestaña), se vuelve a la estantería.
  const vista = idColeccion ? colecciones.find((c) => c.id === idColeccion) : undefined;
  useEffect(() => {
    if (!cargada || !idColeccion || vista) return;
    motor
      .coleccionesListar()
      .then((l) => {
        if (l.some((c) => c.id === idColeccion)) fijarColecciones(l);
        else navegar('biblioteca');
      })
      .catch(console.error);
  }, [cargada, idColeccion, vista]);

  const importar = async (archivos: ArchivoImportado[], coleccion?: string) => {
    fijarError('');
    fijarAviso('');
    const errores: string[] = [];
    const fallo = (nombre: string, e: unknown) => {
      errores.push(`${nombre}: ${e instanceof Error ? e.message : e}`);
      fijarError(errores.join('\n'));
    };
    const importados: Importado[] = [];
    const anotar = (e: ElementoBiblioteca | null, carpeta?: string) => e && importados.push({ id: e.id, rtl: e.documento?.direccion === 'rtl', ...(carpeta ? { carpeta } : {}) });
    const imagenes = archivos.filter((a) => IMAGEN.test(a.ruta) || /(^|\/)ComicInfo\.xml$/i.test(a.ruta));
    // De una carpeta solo entran sus libros: un léame o unas notas que vengan con el manga no son lecturas.
    const resto = archivos.filter((a) => !imagenes.includes(a) && (!a.ruta.includes('/') || /\.(epub|pdf|cbz)$/i.test(a.ruta)));
    for (const { archivo: f, ruta } of resto) {
      fijarProgreso(tr('Importando «{0}»…', f.name));
      try {
        const doc = await importarDocumento(f, coleccion);
        if (doc) anotar(doc, ruta.includes('/') ? ruta.slice(0, ruta.lastIndexOf('/')) : undefined);
        else await motor.bibliotecaGuardar({ id: crypto.randomUUID(), titulo: f.name.replace(/\.[^.]+$/, ''), texto: await textoDeArchivo(f), origen: 'archivo', creado: Date.now(), ...(coleccion ? { coleccion } : {}) });
        await cargar();
      } catch (e) {
        fallo(f.name, e);
      }
    }
    // Las imágenes, en libros: uno por carpeta o por tomo, cada uno guardado como un CBZ.
    for (const libro of librosDeImagenes(imagenes, tr('Imágenes'))) {
      try {
        if (tamanoDe(libro) >= LIMITE_ZIP) throw new Error(tr('pasa de 4 GB; impórtalo por tomos.'));
        const cbz = await cbzDe(libro, (n, total) => (n % 10 === 0 || n === total) && fijarProgreso(tr('Preparando «{0}»: {1} de {2} páginas', libro.titulo, n, total)));
        fijarProgreso(tr('Guardando «{0}»…', libro.titulo));
        anotar(await importarDocumento(cbz, coleccion), libro.carpeta);
        await cargar();
      } catch (e) {
        fallo(libro.titulo, e);
      }
    }
    // Lo que venía de una misma carpeta va a su colección: la que se llame como ella o, si son varios, una nueva.
    if (!coleccion && importados.length) {
      const existentes = await motor.coleccionesListar();
      const plan = coleccionesDeImportados(importados, existentes);
      const hecho: string[] = [];
      for (const n of plan.nuevas) {
        const c: ColeccionBiblioteca = { id: crypto.randomUUID(), nombre: n.nombre, ...(n.tipo ? { tipo: n.tipo } : {}), creada: Date.now() };
        await motor.coleccionGuardar(c);
        for (const id of n.libros) await motor.bibliotecaCambiar(id, { coleccion: c.id });
        hecho.push(tr('Nueva colección «{0}», con {1}.', c.nombre, cuantos(n.libros.length, c.tipo)));
      }
      for (const a of plan.anadir) {
        for (const id of a.libros) await motor.bibliotecaCambiar(id, { coleccion: a.coleccion });
        const c = existentes.find((x) => x.id === a.coleccion);
        if (c) hecho.push(tr('Añadido a «{0}»: {1}.', c.nombre, cuantos(a.libros.length, c.tipo)));
      }
      fijarAviso(hecho.join(' '));
    }
    fijarProgreso('');
    cargar();
  };

  const elegirArchivos = (enColeccion?: string) => {
    destino.current = enColeccion;
    entrada.current?.click();
  };
  const elegirCarpeta = (enColeccion?: string) => {
    destino.current = enColeccion;
    carpeta.current?.click();
  };
  const soltar = (enColeccion?: string) => ({
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      fijarArrastrando(true);
    },
    onDragLeave: (e: DragEvent) => {
      if (e.currentTarget === e.target) fijarArrastrando(false);
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      fijarArrastrando(false);
      archivosSoltados(e.dataTransfer)
        .then((l) => importar(l, enColeccion))
        .catch((x) => fijarError(String(x)));
    },
  });

  const generar = async () => {
    fijarGenerando(true);
    fijarRelato('');
    fijarError('');
    try {
      const { filas } = await motor.listarPalabras({ estado: 'aprendiendo', limite: 15 });
      const texto = await flujoMotor('historia', [tema, filas.map((f) => f.lema).join(lengua.value.escritura.separadorLista)], fijarRelato);
      const titulo = texto.split('\n')[0].slice(0, 40) || tema;
      await motor.bibliotecaGuardar({ id: crypto.randomUUID(), titulo, texto, origen: 'historia', creado: Date.now() });
      fijarTema('');
      cargar();
    } catch (e) {
      fijarError(e instanceof Error ? e.message : String(e));
    } finally {
      fijarGenerando(false);
    }
  };

  if (abierto) {
    const irA = (n: number) => {
      fijarPagina(n);
      motor.bibliotecaCambiar(abierto.id, { pagina: n, abierto: Date.now() }).catch(console.error);
      document.querySelector('.ap-principal')?.scrollTo(0, 0);
    };
    return (
      <div class="ap-lienzo ancho">
        <TextoInteractivo
          key={pagina}
          texto={pags[pagina]}
          ajustes={ajustes}
          titulo={abierto.titulo}
          inicioBarra={
            <>
              <button class="btn chico fantasma" onClick={() => { fijarAbierto(null); cargar(); }}><Icono n="flecha-izq" t={15} /> {tr('Ayuda de lectura')}</button>
              <b class="ap-lectura-titulo" lang={lengua.value.id}>{abierto.titulo}</b>
            </>
          }
          pie={
            pags.length > 1 ? (
              <nav class="ap-paginacion" aria-label={tr('Páginas')}>
                <button class="btn" disabled={pagina === 0} onClick={() => irA(pagina - 1)}><Icono n="flecha-izq" t={15} /> {tr('Anterior')}</button>
                <div class="ap-paginacion-centro">
                  <span class="ayuda num">{tr('Página {0} de {1}', pagina + 1, pags.length)}</span>
                  <div class="barra-progreso"><div style={{ width: `${((pagina + 1) / pags.length) * 100}%` }} /></div>
                </div>
                <button class="btn" disabled={pagina >= pags.length - 1} onClick={() => irA(pagina + 1)}>{tr('Siguiente')} <Icono n="flecha" t={15} /></button>
              </nav>
            ) : undefined
          }
        />
      </div>
    );
  }

  const libro = (e: ElementoBiblioteca) => (
    <Libro
      key={e.id}
      e={e}
      colecciones={colecciones}
      alAbrir={() => abrirLibro(e)}
      alEliminar={async () => {
        pausar(e.id);
        await motor.bibliotecaEliminar(e.id);
        cargar();
      }}
      alCambiar={cargar}
      alMover={() => fijarDialogo({ tipo: 'mover', libro: e })}
    />
  );

  const cerrarDialogo = () => fijarDialogo(null);
  const dialogos = dialogo && (
    <>
      {dialogo.tipo === 'coleccion' && (
        <DialogoColeccion
          coleccion={dialogo.coleccion}
          libros={dialogo.libros}
          alCerrar={cerrarDialogo}
          alGuardar={async (c, nueva) => {
            cerrarDialogo();
            await cargar();
            // Una colección nueva sin libros se abre, para añadírselos.
            if (nueva && !dialogo.libros?.length) navegar(`biblioteca?coleccion=${encodeURIComponent(c.id)}`);
          }}
        />
      )}
      {dialogo.tipo === 'mover' && (
        <DialogoMover
          libro={dialogo.libro}
          colecciones={colecciones}
          lista={lista}
          alCerrar={cerrarDialogo}
          alNueva={() => fijarDialogo({ tipo: 'coleccion', libros: [dialogo.libro.id] })}
          alHecho={() => {
            cerrarDialogo();
            cargar();
          }}
        />
      )}
      {dialogo.tipo === 'anadir' && (
        <DialogoAnadir
          coleccion={dialogo.coleccion}
          colecciones={colecciones}
          lista={lista}
          alCerrar={cerrarDialogo}
          alHecho={() => {
            cerrarDialogo();
            cargar();
          }}
        />
      )}
      {dialogo.tipo === 'portada' && (
        <DialogoPortada
          coleccion={dialogo.coleccion}
          lista={lista}
          alCerrar={cerrarDialogo}
          alHecho={() => {
            cerrarDialogo();
            cargar();
          }}
        />
      )}
    </>
  );

  // Los selectores de archivos, comunes a la estantería y a cada colección: lo elegido va a donde se pidió.
  const selectores = (
    <>
      <input ref={entrada} type="file" multiple hidden aria-label={tr('Importar archivos')} accept=".txt,.html,.htm,.epub,.pdf,.cbz,.srt,.vtt,.ass,.ssa,.md,.jpg,.jpeg,.png,.webp,.avif,.gif,.bmp" onChange={(e) => { importar(archivosElegidos(e.currentTarget.files), destino.current); e.currentTarget.value = ''; }} />
      {/* Con webkitdirectory, el selector elige carpetas y cada archivo trae su ruta dentro de la elegida. */}
      <input ref={carpeta} type="file" multiple hidden aria-label={tr('Importar una carpeta')} {...({ webkitdirectory: true } as Record<string, unknown>)} onChange={(e) => { importar(archivosElegidos(e.currentTarget.files), destino.current); e.currentTarget.value = ''; }} />
    </>
  );

  const avisos = (
    <>
      {progreso && (
        <p class="ayuda ap-importando" role="status">
          <Icono n="espera" t={14} /> {progreso}
        </p>
      )}
      {aviso && <Mensaje>{aviso}</Mensaje>}
      {error && <Mensaje error>{error}</Mensaje>}
    </>
  );

  // ---------- Una colección ----------
  if (vista) {
    const r = resumenDe(vista, lista, avance);
    const total = r.libros.length;
    const siguiente = r.actual ?? r.libros.find((e) => !avance(e).terminado);
    const tipo = TIPOS.find((t) => t.id === vista.tipo);
    return (
      <div class={`ap-lienzo ap-biblioteca ap-vista-coleccion ${arrastrando ? 'arrastrando' : ''}`} {...soltar(vista.id)}>
        <button class="btn chico fantasma ap-volver" onClick={() => navegar('biblioteca')}><Icono n="flecha-izq" t={15} /> {tr('Ayuda de lectura')}</button>
        <header class="ap-coleccion-cab">
          <div class="ap-pila ap-coleccion-tapa">
            <TapaColeccion c={vista} portada={r.portada} total={total} fraccion={r.fraccion} />
          </div>
          <div class="ap-coleccion-datos">
            <span class="ap-coleccion-tipo">{[tipo ? tr(tipo.nombre) : tr('Colección'), cuantos(total, vista.tipo)].join(' · ')}</span>
            <h1 lang={langDe(vista.nombre)}>{vista.nombre}</h1>
            {vista.descripcion && <p class="ap-coleccion-descripcion">{vista.descripcion}</p>}
            {total > 0 && (
              <div class="ap-coleccion-avance">
                <span class="ayuda num">
                  {r.terminados === total ? tr('Terminada') : [r.actual ? lugarEn(r.posicion!, total, vista.tipo) : '', tr('{0} de {1} terminados', r.terminados, total)].filter(Boolean).join(' · ')}
                </span>
                <div class="barra-progreso"><div style={{ width: `${r.fraccion * 100}%` }} /></div>
              </div>
            )}
            <div class="ap-coleccion-acciones">
              {siguiente && (
                <button class="btn primario ap-coleccion-seguir" onClick={() => abrirLibro(siguiente)}>
                  <span>{avance(siguiente).empezado ? tr('Seguir con «{0}»', siguiente.titulo) : tr('Empezar «{0}»', siguiente.titulo)}</span> <Icono n="flecha" t={15} />
                </button>
              )}
              <button class="btn" onClick={() => fijarDialogo({ tipo: 'anadir', coleccion: vista })}><Icono n="mas" t={15} /> {tr('Añadir libros')}</button>
              <button class="btn fantasma" onClick={() => elegirArchivos(vista.id)}><Icono n="subir" t={15} /> {tr('Importar aquí')}</button>
              <button class="btn fantasma" onClick={() => fijarDialogo({ tipo: 'coleccion', coleccion: vista })}><Icono n="lapiz" t={15} /> {tr('Editar')}</button>
              <button class="btn fantasma" onClick={() => fijarDialogo({ tipo: 'portada', coleccion: vista })}><Icono n="imagen" t={15} /> {tr('Portada')}</button>
              <button
                class="btn fantasma"
                data-tip={tr('Sus libros se quedan en la estantería')}
                onClick={async () => {
                  await motor.coleccionEliminar(vista.id);
                  navegar('biblioteca');
                  cargar();
                }}
              >
                <Icono n="basura" t={15} /> {tr('Quitar la colección')}
              </button>
            </div>
          </div>
        </header>
        {avisos}
        {total ? (
          <div class="ap-estanteria">{r.libros.map(libro)}</div>
        ) : (
          <Vacio icono="pila" titulo={tr('Esta colección está vacía')}>
            <p>{tr('Añade libros de tu estantería, o arrastra aquí archivos y carpetas para importarlos directamente en ella.')}</p>
          </Vacio>
        )}
        {selectores}
        {dialogos}
      </div>
    );
  }

  // ---------- La estantería ----------
  const enColeccion = new Set(colecciones.map((c) => c.id));
  const sueltos = lista.filter((e) => !e.coleccion || !enColeccion.has(e.coleccion));
  const mostrados = filtro === 'todo' ? sueltos : filtrar(lista, filtro, avance);
  const leyendo = enCurso(lista, avance, 3);
  return (
    <div class="ap-lienzo ap-biblioteca" {...soltar()}>
      <Cabecera titulo={tr('Ayuda de lectura')} sub={tr('Tus libros, textos y subtítulos, listos para leer con diccionario y Claude.')} />

      <div class="ap-biblioteca-entrada">
        <div class="ap-entrada-libros">
          <button class={`ap-soltar ${arrastrando ? 'activo' : ''}`} onClick={() => elegirArchivos()}>
            <span class="hoja-icono"><Icono n="subir" t={22} /></span>
            <b>{tr('Importa un libro o unos subtítulos')}</b>
            <span class="ayuda">{tr('Arrástralos aquí o haz clic para elegirlos')}</span>
            <span class="ap-formatos">{['EPUB', 'PDF', 'CBZ', 'JPG', 'PNG', 'TXT', 'HTML', 'SRT', 'VTT', 'ASS'].map((f) => <i key={f}>{f}</i>)}</span>
          </button>
          <button class="btn chico fantasma ap-elegir-carpeta" data-tip={tr('Cada carpeta de imágenes, o cada tomo dentro de ella, entra como un libro')} onClick={() => elegirCarpeta()}>
            <Icono n="carpeta" t={15} /> {tr('Elegir una carpeta de imágenes')}
          </button>
        </div>
        {selectores}

        <section class="ap-claude" aria-labelledby="ap-t-relato">
          <div class="ap-tarjeta-cab">
            <span class="hoja-icono chica ia"><Icono n="ia" t={18} /></span>
            <h2 id="ap-t-relato">{tr('Pide un relato a Claude')}</h2>
          </div>
          <p class="ayuda ap-tarjeta-ayuda">{tr('Escrito para tu nivel ({0}) y con las palabras que estás aprendiendo.', ajustes.nivel)}</p>
          <form class="ap-claude-form" onSubmit={(e) => { e.preventDefault(); if (tema.trim() && !generando) generar(); }}>
            <input class="campo" aria-label={tr('Tema del relato')} placeholder={tr(lengua.value.textos.temaRelato)} value={tema} onInput={(e) => fijarTema(e.currentTarget.value)} />
            <button class="btn ia" type="submit" disabled={!tema.trim() || generando}><Icono n={generando ? 'espera' : 'ia'} t={16} /> {generando ? tr('Escribiendo…') : tr('Escribir')}</button>
          </form>
          {generando ? (
            <div class="ap-claude-relato" lang={lengua.value.id} aria-live="polite">
              {relato ? <p class="panel-ia-texto">{relato}</p> : <><span class="esqueleto" style={{ width: '92%' }} /><span class="esqueleto" style={{ width: '78%' }} /><span class="esqueleto" style={{ width: '85%' }} /></>}
            </div>
          ) : (
            <div class="ap-claude-ideas">
              {lengua.value.ideasRelato.map((i) => <button key={i} class="chip" onClick={() => fijarTema(tr(i))}>{tr(i)}</button>)}
            </div>
          )}
        </section>
      </div>

      {avisos}

      {cargada && lista.length === 0 && colecciones.length === 0 ? (
        <Vacio icono="biblioteca" titulo={tr('Tu estantería está vacía')}>
          <p>{tr('Importa tu primer libro o pide un relato a Claude. Te recordamos por qué página ibas.')}</p>
        </Vacio>
      ) : (
        <>
          {filtro === 'todo' && leyendo.length > 0 && <EnCurso libros={leyendo} alAbrir={abrirLibro} />}
          <div class="ap-estanteria-cab">
            <h2 class="ap-seccion-titulo">{tr('Tus lecturas')} <span class="ap-cuenta num">{lista.length}</span></h2>
            <div class="segmentado" role="radiogroup" aria-label={tr('Qué lecturas mostrar')}>
              {FILTROS.map((f) => (
                <button key={f.id} role="radio" aria-checked={filtro === f.id} class={filtro === f.id ? 'activo' : ''} onClick={() => fijarFiltro(f.id)}>
                  {tr(f.nombre)}
                </button>
              ))}
            </div>
            <button class="btn chico fantasma ap-nueva-coleccion" onClick={() => fijarDialogo({ tipo: 'coleccion' })}><Icono n="pila" t={15} /> {tr('Nueva colección')}</button>
          </div>
          {filtro !== 'todo' && mostrados.length === 0 ? (
            <p class="ayuda ap-estanteria-nada">{tr(VACIO_DE[filtro])}</p>
          ) : (
            <div class="ap-estanteria">
              {filtro === 'todo' && colecciones.map((c) => <TarjetaColeccion key={c.id} c={c} lista={lista} />)}
              {mostrados.map(libro)}
            </div>
          )}
        </>
      )}
      {dialogos}
    </div>
  );
}
