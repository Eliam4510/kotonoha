// El vocabulario de un libro o de una colección, para prepararlo antes de leer o mientras: sus palabras ordenadas por las
// veces que salen, con lo que se sabe de cada una y sus mejores frases del libro; cuánto se entiende ya y cuántas palabras
// hacen falta para entender más; su gramática; y, en una colección, cómo es cada tomo. Las palabras se marcan aquí mismo,
// una a una o todas las elegidas, y van a Memoria o a Anki con su frase del libro.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Ajustes } from '../compartido/ajustes';
import { numero, tm, tr } from '../compartido/i18n';
import { baseOcr } from '../compartido/paginasOcr';
import { alRecibirEvento, fondo, motor } from '../compartido/rpc';
import type { BorradorTarjeta, ColeccionBiblioteca, CuentaTexto, DatoPalabra, ElementoBiblioteca, EstadoPalabra, EstadoGramatica, TrozoTexto } from '../compartido/tipos';
import { deTomos, librosDe } from '../nucleo/estanteria';
import { aFuriganaAnki, NOMBRES_NIVEL, nivelDe } from '../nucleo/frases';
import { trozosDePatron } from '../nucleo/niveles';
import {
  conDatos,
  type EjemploVocabulario,
  type FilaVocabulario,
  type FiltroVocabulario,
  type GramaticaVocabulario,
  juntarCuentas,
  type OrdenVocabulario,
  palabrasParaLlegar,
  partirEjemplo,
  pasaFiltro,
  resumenPorLibro,
  resumirVocabulario,
  ordenarVocabulario,
  type Vocabulario as DatosVocabulario,
} from '../nucleo/vocabulario';
import { borradorVacio, enviarAlCreador } from '../ui/borrador';
import { BotonesEstadoGramatica } from '../ui/EstadoGramatica';
import { NOMBRE_ESTADO, PanelFlujo } from '../ui/Ficha';
import { estadoGramatica, estadosGramatica, NOMBRE_ESTADO_GRAMATICA } from '../ui/gramatica';
import { Icono } from '../ui/iconos';
import { lecturaDeTarjeta, lengua } from '../ui/lengua';
import { useEsperar } from '../ui/preparacion';
import { modoDe } from '../visor/procesador';
import { claseTono, langDe, Portada } from './Biblioteca';
import { creadorAbierto, guardarPreferencia, leerPreferencia, navegar } from './estadoApp';
import { ConPatron } from './Niveles';
import { Mensaje, Vacio } from './Piezas';
import { pausar, procesar, procesos } from './procesos';
import { SinArchivo, textoDeLibro } from './textoDeLibro';

type Pestana = 'palabras' | 'gramatica' | 'libros';

/** Cuántas palabras se enseñan de una vez: con miles, la lista se alarga al pedirlo. */
const POR_PAGINA = 120;
/** Las metas de comprensión para las que se dice cuántas palabras faltan. */
const METAS = [0.9, 0.95, 0.98];
/**
 * Lo que se manda al motor de una vez: un libro largo va por partes, y entre ellas el motor atiende lo demás. Cada parte
 * devuelve sus palabras con sus frases, así que con partes más pequeñas viaja más: una novela entera son unas cuatro.
 */
const LETRAS_POR_TANDA = 80000;
/** Cuántas glosas se piden de una vez: buscarlas es lo que más tarda, así que llegan por partes, primero las que se ven. */
const GLOSAS_POR_TANDA = 400;

const FILTROS: { id: FiltroVocabulario; nombre: string; punto?: EstadoPalabra }[] = [
  { id: 'nuevas', nombre: tm('Por aprender'), punto: 'desconocida' },
  { id: 'aprendiendo', nombre: tm('Aprendiendo'), punto: 'aprendiendo' },
  { id: 'conocidas', nombre: tm('Conocidas'), punto: 'conocida' },
  { id: 'todas', nombre: tm('Todas') },
];

const ORDENES: { id: OrdenVocabulario; nombre: string }[] = [
  { id: 'veces', nombre: tm('Las que más salen') },
  { id: 'aparicion', nombre: tm('En orden de aparición') },
  { id: 'comunes', nombre: tm('Las más comunes de la lengua') },
];

const FILTROS_GRAMATICA: { id: FiltroVocabulario; nombre: string; punto?: EstadoGramatica }[] = [
  { id: 'nuevas', nombre: tm('Nuevos'), punto: 'nuevo' },
  { id: 'aprendiendo', nombre: tm('Aprendiendo'), punto: 'aprendiendo' },
  { id: 'conocidas', nombre: tm('Sabidos'), punto: 'sabido' },
  { id: 'todas', nombre: tm('Todos') },
];

const pasaFiltroGramatica = (estado: EstadoGramatica, f: FiltroVocabulario) =>
  f === 'todas' || (f === 'nuevas' ? estado === 'nuevo' : f === 'aprendiendo' ? estado === 'aprendiendo' : estado === 'sabido');

// ---------- Contar ----------

/** Lo que se sabe del texto de un libro, sin el texto. */
interface MetaTexto {
  unidad: 'pagina' | 'capitulo';
  total: number;
  conTexto: number;
  completo: boolean;
}

interface Contado {
  firma: string;
  cuentas: CuentaTexto[];
  meta: MetaTexto;
}

/**
 * Lo ya contado mientras la ventana está abierta: volver a un libro no lo cuenta otra vez si su texto no ha cambiado. Se
 * guardan los últimos libros, no todos: cada uno ocupa unos pocos MB.
 */
const contados = new Map<string, Contado>();
const LIBROS_GUARDADOS = 40;

function hashTexto(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

/** Lo que cambia cuando cambia el texto de un libro: lo leído con el OCR y lo editado, en un libro de páginas. */
async function firmaDe(e: ElementoBiblioteca): Promise<string> {
  const id = lengua.value.id;
  const d = e.documento;
  if (!d) return `${id}:t:${e.texto.length}:${hashTexto(e.texto)}`;
  if (d.texto) return `${id}:e:${d.tamano}`;
  const [leidas, editadas] = await Promise.all([
    baseOcr().paginas.where('libro').equals(e.id).count(),
    baseOcr().ediciones.where('libro').equals(e.id).toArray(),
  ]);
  const ultima = editadas.reduce((m, x) => Math.max(m, x.creada), 0);
  return `${id}:p:${d.paginas}:${modoDe(d)}:${d.ocr?.textoPdf ?? true}:${leidas}:${editadas.length}:${ultima}`;
}

/** Los trozos en tandas de unas decenas de miles de letras, sin partir ninguno. */
function tandas(trozos: TrozoTexto[]): TrozoTexto[][] {
  const salida: TrozoTexto[][] = [];
  let actual: TrozoTexto[] = [];
  let letras = 0;
  for (const t of trozos) {
    actual.push(t);
    letras += t.texto.length;
    if (letras >= LETRAS_POR_TANDA) {
      salida.push(actual);
      actual = [];
      letras = 0;
    }
  }
  if (actual.length) salida.push(actual);
  return salida;
}

/** Cuenta las palabras de un libro, o da lo ya contado si su texto no ha cambiado. `avance` va de 0 a 1. */
async function contarLibro(e: ElementoBiblioteca, alAvanzar: (avance: number, aviso: string) => void, senal: AbortSignal): Promise<Contado> {
  const firma = await firmaDe(e);
  const guardado = contados.get(e.id);
  if (guardado?.firma === firma) return guardado;
  alAvanzar(0, tr('Leyendo el texto de «{0}»…', e.titulo));
  const t = await textoDeLibro(e, (hechas, total) => alAvanzar(total ? (0.4 * hechas) / total : 0, tr('Leyendo el texto de «{0}»…', e.titulo)), senal);
  const lotes = tandas(t.trozos);
  const cuentas: CuentaTexto[] = [];
  for (const [i, lote] of lotes.entries()) {
    if (senal.aborted) throw new DOMException('', 'AbortError');
    alAvanzar(0.4 + (0.6 * i) / lotes.length, tr('Contando las palabras de «{0}»…', e.titulo));
    cuentas.push(await motor.contarPalabras(lote));
  }
  const { trozos: _t, ...meta } = t;
  const contado = { firma, cuentas, meta };
  contados.delete(e.id);
  contados.set(e.id, contado);
  if (contados.size > LIBROS_GUARDADOS) contados.delete(contados.keys().next().value!);
  return contado;
}

interface Calculo {
  fase: 'contando' | 'listo' | 'error';
  avance: number;
  aviso: string;
  vocabulario?: DatosVocabulario;
  /** Lo que se sabe del texto de cada libro; null si su archivo no está en este equipo. */
  textos: (MetaTexto | null)[];
  error?: string;
}

/** Cuenta las palabras de unos libros, junta lo de todos y pide lo que se sabe de cada palabra. */
function useVocabulario(libros: ElementoBiblioteca[] | null, vez: number) {
  const [calculo, fijarCalculo] = useState<Calculo>({ fase: 'contando', avance: 0, aviso: '', textos: [] });
  const [datos, fijarDatos] = useState<DatoPalabra[] | null>(null);
  const clave = libros?.map((e) => e.id).join('|') ?? '';

  useEffect(() => {
    if (!libros) return;
    const control = new AbortController();
    // Al volver a contar (al acabar de leer con el OCR, por ejemplo), lo de antes sigue a la vista mientras tanto.
    fijarCalculo((x) => ({ ...x, fase: 'contando', avance: 0, aviso: tr('Preparando…') }));
    (async () => {
      const partes: { cuenta: CuentaTexto; libro: number }[] = [];
      const textos: (MetaTexto | null)[] = [];
      for (const [i, e] of libros.entries()) {
        try {
          const c = await contarLibro(e, (a, aviso) => !control.signal.aborted && fijarCalculo((x) => ({ ...x, avance: (i + a) / libros.length, aviso })), control.signal);
          for (const cuenta of c.cuentas) partes.push({ cuenta, libro: i });
          textos.push(c.meta);
        } catch (x) {
          if (!(x instanceof SinArchivo)) throw x;
          textos.push(null);
        }
      }
      if (control.signal.aborted) return;
      fijarCalculo((x) => ({ ...x, avance: 1, aviso: tr('Buscando lo que sabes de cada palabra…') }));
      const v = juntarCuentas(partes.length ? partes : [], !lengua.value.escritura.palabrasSeparadas);
      // Con ningún libro con texto, juntar no sabe cuántos hay: cada libro cuenta igual.
      const vocabulario = { ...v, libros: Math.max(v.libros, libros.length), palabras: v.palabras.map((p) => ({ ...p, porLibro: rellenar(p.porLibro, libros.length) })) };
      const d = await motor.datosPalabras(vocabulario.palabras.map(({ clave, lema, lectura, categoria, gramatica }) => ({ clave, lema, lectura, categoria, gramatica })));
      if (control.signal.aborted) return;
      fijarDatos(d);
      fijarCalculo({ fase: 'listo', avance: 1, aviso: '', vocabulario, textos });
    })().catch((x) => {
      if (control.signal.aborted) return;
      console.error(x);
      fijarCalculo((c) => ({ ...c, fase: 'error', error: x instanceof Error ? x.message : String(x) }));
    });
    return () => control.abort();
  }, [clave, vez, lengua.value.id]);

  // Lo que se cambia aquí o en otra parte (el video, el diccionario) se ve en la lista sin volver a contar.
  const palabras = calculo.vocabulario?.palabras;
  useEffect(() => {
    if (!palabras) return;
    const pedir = () =>
      motor
        .datosPalabras(palabras.map(({ clave, lema, lectura, categoria, gramatica }) => ({ clave, lema, lectura, categoria, gramatica })), true)
        .then((estados) => fijarDatos((antes) => antes && antes.map((x, i) => ({ ...x, ...estados[i] }))))
        .catch(console.error);
    return alRecibirEvento((ev) => {
      if (ev.tipo === 'palabras' || ev.tipo === 'palabrasRecargar') pedir();
    });
  }, [palabras]);

  /** Cambia el estado de unas palabras en la lista al momento; el motor lo confirma después. */
  const cambiarEnLista = (claves: Set<string>, estado: EstadoPalabra) =>
    fijarDatos((antes) => antes && palabras ? antes.map((x, i) => (claves.has(palabras[i].clave) ? { ...x, estado } : x)) : antes);

  // Las glosas llegan por partes: primero las de las palabras que se ven, y luego las demás, de las que más salen a las que
  // menos. Mientras tanto, la lista ya se puede usar.
  const [glosas, fijarGlosas] = useState<Map<string, string | null>>(new Map());
  const yaTenidas = useRef(glosas);
  yaTenidas.current = glosas;
  const visibles = useRef<string[]>([]);
  useEffect(() => {
    if (!palabras) return;
    let vivo = true;
    const porClave = new Map(palabras.map((p) => [p.clave, p]));
    // Las que ya llegaron en una cuenta anterior del mismo libro se quedan: solo se piden las nuevas.
    const pendientes = new Set([...porClave.keys()].filter((k) => !yaTenidas.current.has(k)));
    const enOrden = [...palabras].sort((a, b) => b.veces - a.veces).map((p) => p.clave);
    let i = 0;
    (async () => {
      while (vivo && pendientes.size) {
        let lote = visibles.current.filter((k) => pendientes.has(k)).slice(0, GLOSAS_POR_TANDA);
        while (!lote.length && i < enOrden.length) lote = enOrden.slice(i, (i += GLOSAS_POR_TANDA)).filter((k) => pendientes.has(k));
        if (!lote.length) break;
        const res = await motor.glosasPalabras(lote.map((k) => {
          const { clave, lema, lectura, categoria } = porClave.get(k)!;
          return { clave, lema, lectura, categoria };
        }));
        if (!vivo) return;
        for (const k of lote) pendientes.delete(k);
        fijarGlosas((m) => {
          const n = new Map(m);
          lote.forEach((k, j) => n.set(k, res[j] ?? null));
          return n;
        });
      }
    })().catch(console.error);
    return () => {
      vivo = false;
    };
  }, [palabras]);

  return { calculo, datos, cambiarEnLista, glosas, alVer: (claves: string[]) => (visibles.current = claves) };
}

const rellenar = (xs: number[], n: number) => (xs.length >= n ? xs : [...xs, ...new Array(n - xs.length).fill(0)]);

// ---------- Tarjetas ----------

/** Una frase con la palabra en negrita, como en las tarjetas que salen de un video. */
function conNegrita(texto: string, superficie: string | undefined, lema: string): string {
  const p = partirEjemplo(texto, superficie, lema);
  return p ? `${p.antes}<b>${p.palabra}</b>${p.despues}` : texto;
}

/**
 * La tarjeta de una palabra con una frase suya del libro: su lectura, sus definiciones del diccionario y, si así está en
 * los ajustes, el audio de la palabra. Nada de Claude: crear muchas de golpe no gasta.
 */
async function borradorDe(f: FilaVocabulario, ej: EjemploVocabulario | undefined, a: Ajustes, fuente: string, conAudio: boolean): Promise<BorradorTarjeta> {
  const b = borradorVacio();
  const r = await motor.buscar(f.lema, f.lectura);
  b.palabra = f.lema;
  b.lectura = lecturaDeTarjeta(r);
  b.definicion = [...new Set(r.entradas.flatMap((x) => x.glosas))].slice(0, 5).join('<br>');
  b.fuente = fuente;
  if (ej) {
    b.frase = a.negritaPalabra ? conNegrita(ej.texto, ej.superficie, f.lema) : ej.texto;
    if (lengua.value.lectura.distingue) {
      const [palabras] = await motor.analizarTexto(ej.texto).catch(() => [[]]);
      if (palabras?.length) b.fraseFurigana = aFuriganaAnki(palabras, a.negritaPalabra ? f.clave : undefined);
    }
  } else b.tipo = 'palabra';
  if (conAudio && a.prellenado.audioPalabraDiccionario) {
    try {
      const audios = await motor.audiosPalabra(f.lema, f.lectura);
      if (audios[0]) {
        const m = await motor.descargarMedio(audios[0].url);
        b.audioPalabra = [{ id: audios[0].url, nombre: `kotonoha_${f.lema}.mp3`, tipo: m.tipo, datos: m.datos, etiqueta: audios[0].etiqueta }];
      }
    } catch {
      // Sin audio, la tarjeta sigue sirviendo.
    }
  }
  return b;
}

// ---------- La pantalla ----------

interface Fuente {
  titulo: string;
  libros: ElementoBiblioteca[];
  coleccion?: ColeccionBiblioteca;
  /** La colección del libro, para volver a ella. */
  deColeccion?: ColeccionBiblioteca;
}

export function Vocabulario({ ajustes, libro, coleccion }: { ajustes: Ajustes; libro?: string; coleccion?: string }) {
  const [fuente, fijarFuente] = useState<Fuente | null>(null);
  const [falta, fijarFalta] = useState(false);
  const [vez, fijarVez] = useState(0);
  const esperar = useEsperar();

  const cargar = () =>
    Promise.all([motor.bibliotecaListar(), motor.coleccionesListar()]).then(([lista, colecciones]) => {
      const c = coleccion ? colecciones.find((x) => x.id === coleccion) : undefined;
      const e = libro ? lista.find((x) => x.id === libro) : undefined;
      if (c) fijarFuente({ titulo: c.nombre, libros: librosDe(c, lista), coleccion: c });
      else if (e) fijarFuente({ titulo: e.titulo, libros: [e], deColeccion: colecciones.find((x) => x.id === e.coleccion) });
      else fijarFalta(true);
    });
  useEffect(() => {
    esperar(cargar()).catch(console.error);
  }, [libro, coleccion]);

  const { calculo, datos, cambiarEnLista, glosas, alVer } = useVocabulario(fuente?.libros ?? null, vez);

  // Al terminar de leer con el OCR un libro de los que se cuentan, se vuelve a contar con todo su texto.
  const listos = fuente?.libros.filter((e) => procesos.value[e.id]?.estado === 'listo').map((e) => e.id).join('|') ?? '';
  const primera = useRef(true);
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    if (listos) cargar().then(() => fijarVez((v) => v + 1)).catch(console.error);
  }, [listos]);

  if (falta) {
    return (
      <div class="ap-lienzo">
        <Vacio icono="biblioteca" titulo={tr('Este libro ya no está en la Biblioteca')}>
          <button class="btn" onClick={() => navegar('biblioteca')}><Icono n="flecha-izq" t={15} /> {tr('Biblioteca')}</button>
        </Vacio>
      </div>
    );
  }
  if (!fuente) return <div class="ap-lienzo ap-voc-pantalla" />;
  return (
    <PantallaVocabulario
      fuente={fuente}
      calculo={calculo}
      datos={datos}
      glosas={glosas}
      alVer={alVer}
      ajustes={ajustes}
      cambiarEnLista={cambiarEnLista}
      alRecontar={() => cargar().then(() => fijarVez((v) => v + 1))}
    />
  );
}

function PantallaVocabulario({ fuente, calculo, datos, glosas, alVer, ajustes, cambiarEnLista, alRecontar }: {
  fuente: Fuente;
  calculo: Calculo;
  datos: DatoPalabra[] | null;
  glosas: Map<string, string | null>;
  alVer: (claves: string[]) => void;
  ajustes: Ajustes;
  cambiarEnLista: (claves: Set<string>, estado: EstadoPalabra) => void;
  alRecontar: () => void;
}) {
  const { libros, coleccion } = fuente;
  const v = calculo.vocabulario;
  const filas = useMemo(() => (v && datos ? conDatos(v.palabras, datos) : null), [v, datos]);
  const resumen = useMemo(() => (filas ? resumirVocabulario(filas) : null), [filas]);
  const tomos = deTomos(coleccion?.tipo);
  // Las palabras de la lista, en cualquier estado: los nombres propios van aparte.
  const enLista = useMemo(() => filas?.filter((f) => !f.nombre).length ?? 0, [filas]);
  const [pestana, fijarPestana] = useState<Pestana>('palabras');
  /** La lista de palabras con unas ya elegidas: lo que se pide desde las metas del resumen. */
  const [eleccion, fijarEleccion] = useState<{ claves: Set<string>; vez: number } | null>(null);

  const volver = coleccion ? `biblioteca?coleccion=${encodeURIComponent(coleccion.id)}` : fuente.deColeccion ? `biblioteca?coleccion=${encodeURIComponent(fuente.deColeccion.id)}` : 'biblioteca';
  const nombreVuelta = coleccion?.nombre ?? fuente.deColeccion?.nombre;
  const lugarDe = (s: { libro: number; lugar: number }) => {
    const meta = calculo.textos[s.libro];
    const dentro = meta?.unidad === 'capitulo' ? tr('cap. {0}', s.lugar + 1) : tr('p. {0}', s.lugar + 1);
    return libros.length > 1 ? `${tomos ? tr('Tomo {0}', s.libro + 1) : tr('Libro {0}', s.libro + 1)} · ${dentro}` : dentro;
  };
  const tituloDe = (libro: number) => libros[libro]?.titulo ?? fuente.titulo;

  const elegirLas = (n: number) => {
    if (!filas) return;
    const primeras = ordenarVocabulario(filas.filter((f) => f.estado === 'desconocida' && !f.nombre), 'veces').slice(0, n);
    fijarPestana('palabras');
    fijarEleccion({ claves: new Set(primeras.map((f) => f.clave)), vez: Date.now() });
  };

  const sinTexto = calculo.fase === 'listo' && calculo.textos.every((t) => !t || t.conTexto === 0);
  const sinLengua = calculo.fase === 'listo' && !sinTexto && (v?.total ?? 0) === 0;

  return (
    <div class="ap-lienzo ap-voc-pantalla">
      <button class="btn chico fantasma ap-volver" onClick={() => navegar(volver)}>
        <Icono n="flecha-izq" t={15} /> {nombreVuelta ? tr('«{0}»', nombreVuelta) : tr('Biblioteca')}
      </button>
      <Cabeza fuente={fuente} calculo={calculo} resumen={resumen} />
      <AvisoTexto fuente={fuente} calculo={calculo} alRecontar={alRecontar} />

      {calculo.fase === 'contando' && (
        <div class="tarjeta ap-voc-contando" role="status">
          <span class="ayuda">{calculo.aviso}</span>
          <div class="barra-progreso"><div style={{ width: `${Math.round(calculo.avance * 100)}%` }} /></div>
        </div>
      )}
      {calculo.fase === 'error' && <Mensaje error>{tr('No se pudo contar el vocabulario: {0}', calculo.error ?? '')}</Mensaje>}

      {sinTexto && (
        <Vacio icono="texto" titulo={libros.length > 1 ? tr('Estos libros aún no tienen texto') : tr('Este libro aún no tiene texto')}>
          {incompletosDe(libros, calculo.textos).length > 0 ? (
            <>
              <p>{tr('Sus páginas son imágenes: para contar sus palabras hay que leerlas antes con el OCR.')}</p>
              <LeerConOcr libros={incompletosDe(libros, calculo.textos)} alRecontar={alRecontar} />
            </>
          ) : (
            <p>{tr('No hay texto que contar.')}</p>
          )}
        </Vacio>
      )}
      {sinLengua && (
        <Vacio icono="aviso" titulo={tr('Este texto no está en la lengua que estudias')}>
          <p>{tr('Ahora estudias: {0}. Para ver su vocabulario, cambia de lengua en el menú de la barra lateral.', tr(lengua.value.textos.nombre))}</p>
        </Vacio>
      )}

      {filas && resumen && v && !sinTexto && !sinLengua && (
        <>
          <Resumen filas={filas} resumen={resumen} alElegir={elegirLas} />
          {/* Con una sola pestaña, la barra sobra. */}
          <div class={`ap-filtros ap-voc-pestanas ${v.gramatica.length === 0 && libros.length < 2 ? 'sola' : ''}`}>
            <div class="segmentado acento" role="tablist" aria-label={tr('Qué ver')}>
              <button role="tab" aria-selected={pestana === 'palabras'} class={pestana === 'palabras' ? 'activo' : ''} onClick={() => fijarPestana('palabras')}>
                {tr('Palabras')} <small class="num">{numero(enLista)}</small>
              </button>
              {v.gramatica.length > 0 && (
                <button role="tab" aria-selected={pestana === 'gramatica'} class={pestana === 'gramatica' ? 'activo' : ''} onClick={() => fijarPestana('gramatica')}>
                  {tr('Gramática')} <small class="num">{numero(v.gramatica.length)}</small>
                </button>
              )}
              {libros.length > 1 && (
                <button role="tab" aria-selected={pestana === 'libros'} class={pestana === 'libros' ? 'activo' : ''} onClick={() => fijarPestana('libros')}>
                  {tomos ? tr('Por tomo') : tr('Por libro')}
                </button>
              )}
            </div>
          </div>
          {pestana === 'palabras' && (
            <ListaVocabulario key={eleccion?.vez ?? 0} filas={filas} glosas={glosas} alVer={alVer} ajustes={ajustes} eleccion={eleccion?.claves} lugarDe={lugarDe} tituloDe={tituloDe} cambiarEnLista={cambiarEnLista} />
          )}
          {pestana === 'gramatica' && <GramaticaDelLibro puntos={v.gramatica} lugarDe={lugarDe} />}
          {pestana === 'libros' && <PorLibro filas={filas} libros={libros} textos={calculo.textos} tomos={tomos} />}
        </>
      )}
    </div>
  );
}

/** La tapa, el título y lo que tiene el libro, con el botón para leerlo. */
function Cabeza({ fuente, calculo, resumen }: { fuente: Fuente; calculo: Calculo; resumen: ReturnType<typeof resumirVocabulario> | null }) {
  const { libros, coleccion } = fuente;
  const e = libros[0];
  const portada = coleccion ? (coleccion.portada ?? libros.find((x) => x.documento?.portada)?.documento?.portada) : e?.documento?.portada;
  const tomos = deTomos(coleccion?.tipo);
  const meta = calculo.textos.filter((t): t is MetaTexto => !!t);
  const unidades = meta.reduce((n, t) => n + t.total, 0);
  const partes = [
    coleccion ? (tomos ? tr('{0} tomos', numero(libros.length)) : tr('{0} libros', numero(libros.length))) : '',
    unidades && !coleccion
      ? meta[0]?.unidad === 'capitulo'
        ? unidades === 1 ? tr('1 capítulo') : tr('{0} capítulos', numero(unidades))
        : unidades === 1 ? tr('1 página') : tr('{0} páginas', numero(unidades))
      : '',
    calculo.vocabulario?.total && calculo.fase === 'listo' ? tr('{0} palabras', numero(calculo.vocabulario.total)) : '',
    resumen?.distintas ? tr('{0} distintas', numero(resumen.distintas)) : '',
  ].filter(Boolean);
  const leer = () => {
    if (!e) return;
    if (e.documento) fondo.abrirVisor(e.id).catch(console.error);
    else navegar(`biblioteca?abrir=${encodeURIComponent(e.id)}`);
  };
  return (
    <header class="ap-voc-cab">
      <div class={`ap-voc-tapa ${coleccion ? 'ap-pila' : ''}`} aria-hidden="true">
        {e && (
          <span class={`ap-tapa ${claseTono(e)} horizontal ${portada ? 'con-portada' : ''}`}>
            {portada ? <img class="ap-tapa-imagen" src={portada} alt="" draggable={false} /> : <Portada e={e} />}
            {!portada && <span class="ap-tapa-titulo" lang={langDe(fuente.titulo)}>{fuente.titulo}</span>}
          </span>
        )}
      </div>
      <div class="ap-voc-datos">
        <span class="ap-coleccion-tipo">{tr('Vocabulario')}</span>
        <h1 lang={langDe(fuente.titulo)}>{fuente.titulo}</h1>
        {partes.length > 0 && <p class="ayuda num">{partes.join(' · ')}</p>}
        {!coleccion && e && (
          <div class="ap-voc-acciones">
            <button class="btn" onClick={leer}><Icono n="libro" t={15} /> {tr('Leer')}</button>
          </div>
        )}
      </div>
    </header>
  );
}

/**
 * Lo que falta del texto: las páginas aún sin leer con el OCR, con el botón para leerlas y el avance mientras tanto, y
 * los libros cuyo archivo no está en este equipo.
 */
/** Los libros de páginas a los que les falta texto por leer con el OCR. */
const incompletosDe = (libros: ElementoBiblioteca[], textos: (MetaTexto | null)[]) =>
  libros.filter((e, i) => e.documento && !e.documento.texto && textos[i] && !textos[i]!.completo);

/** Leer con el OCR lo que falta de unos libros: el botón y, mientras se lee, cuánto va, con la pausa. */
function LeerConOcr({ libros, alRecontar }: { libros: ElementoBiblioteca[]; alRecontar: () => void }) {
  const enMarcha = libros.filter((e) => ['procesando', 'en-cola'].includes(procesos.value[e.id]?.estado ?? ''));
  if (!enMarcha.length) {
    return (
      <button class="btn chico primario" onClick={() => libros.forEach((e) => procesar(e, () => {}))}>
        <Icono n="rayo" t={14} /> {libros.length > 1 ? tr('Leer los que faltan') : tr('Leer el libro entero')}
      </button>
    );
  }
  const avance = enMarcha.map((e) => procesos.value[e.id]!).reduce((a, p) => ({ hechas: a.hechas + p.hechas, total: a.total + p.total }), { hechas: 0, total: 0 });
  return (
    <div class="ap-voc-leyendo" role="status">
      <span class="ayuda num">{avance.total ? tr('Leyendo con el OCR: {0} de {1} páginas. Al terminar, la lista se pone al día.', numero(avance.hechas), numero(avance.total)) : tr('Leyendo con el OCR…')}</span>
      <div class="barra-progreso"><div style={{ width: `${avance.total ? (100 * avance.hechas) / avance.total : 0}%` }} /></div>
      <div class="ap-voc-leyendo-botones">
        <button class="btn chico fantasma" onClick={alRecontar}><Icono n="recargar" t={14} /> {tr('Contar lo leído')}</button>
        <button class="btn chico" onClick={() => enMarcha.forEach((e) => pausar(e.id))}><Icono n="pausa" t={14} /> {tr('Pausar')}</button>
      </div>
    </div>
  );
}

/**
 * Lo que falta del texto: las páginas aún sin leer con el OCR, con el botón para leerlas, y los libros cuyo archivo no
 * está en este equipo. Si no hay ningún texto, lo dice el estado vacío, con el mismo botón.
 */
function AvisoTexto({ fuente, calculo, alRecontar }: { fuente: Fuente; calculo: Calculo; alRecontar: () => void }) {
  if (calculo.fase !== 'listo' || calculo.textos.every((t) => !t || t.conTexto === 0)) return null;
  const { libros } = fuente;
  const incompletos = incompletosDe(libros, calculo.textos);
  const sinArchivo = libros.filter((_, i) => calculo.textos[i] === null);
  if (!incompletos.length && !sinArchivo.length) return null;
  const unico = libros.length === 1 ? calculo.textos[0] : null;
  return (
    <div class="tarjeta ap-voc-aviso">
      <Icono n="info" t={18} />
      <div class="ap-voc-aviso-texto">
        {incompletos.length > 0 && (
          <p>
            {unico
              ? tr('Solo está leído el texto de {0} de sus {1} páginas: las demás aún no se han pasado por el OCR, y sus palabras no cuentan.', numero(unico.conTexto), numero(unico.total))
              : tr('A {0} de los {1} libros les falta texto por leer con el OCR: sus páginas sin leer no cuentan.', numero(incompletos.length), numero(libros.length))}
          </p>
        )}
        {sinArchivo.length > 0 && <p>{tr('No está en este equipo el archivo de: {0}.', sinArchivo.map((e) => `«${e.titulo}»`).join(', '))}</p>}
        {incompletos.length > 0 && <LeerConOcr libros={incompletos} alRecontar={alRecontar} />}
      </div>
    </div>
  );
}

/** Cuánto se entiende ya, cuántas palabras quedan por aprender y cuántas hacen falta para entender más. */
function Resumen({ filas, resumen, alElegir }: { filas: FilaVocabulario[]; resumen: ReturnType<typeof resumirVocabulario>; alElegir: (n: number) => void }) {
  const metas = useMemo(() => palabrasParaLlegar(filas, METAS), [filas]);
  const nombres = useMemo(() => filas.filter((f) => f.nombre && f.estado === 'desconocida').length, [filas]);
  const nivel = NOMBRES_NIVEL[nivelDe(resumen.comprension)];
  return (
    <section class="ap-voc-resumen" aria-label={tr('Resumen')}>
      <div class="tarjeta ap-voc-dato ap-voc-comprension">
        <AnilloComprension conocidas={resumen.total ? (resumen.conocidas - aprendiendoVeces(filas)) / resumen.total : 0} aprendiendo={resumen.total ? aprendiendoVeces(filas) / resumen.total : 0} valor={resumen.comprension} />
        <div>
          <span class="ap-voc-dato-titulo">{tr('Comprensión')}</span>
          <b>{tr(nivel)}</b>
          <p class="ayuda">{tr('Conoces o estás aprendiendo {0} de cada 100 palabras del texto.', numero(resumen.comprension))}</p>
        </div>
      </div>
      <div class="tarjeta ap-voc-dato">
        <span class="ap-voc-dato-titulo">{tr('Por aprender')}</span>
        <b class="ap-voc-cifra num">{numero(resumen.porAprender - nombres)}</b>
        <p class="ayuda">
          {tr('de {0} palabras distintas', numero(resumen.distintas))}
          {resumen.aprendiendo > 0 && <>{' · '}{tr('{0} aprendiendo', numero(resumen.aprendiendo))}</>}
          {nombres > 0 && <>{' · '}{nombres === 1 ? tr('sin contar 1 nombre propio') : tr('sin contar {0} nombres propios', numero(nombres))}</>}
        </p>
      </div>
      <div class="tarjeta ap-voc-dato ap-voc-metas">
        <span class="ap-voc-dato-titulo">{tr('Para entender más')}</span>
        <ul>
          {metas.map((m) => (
            <li key={m.meta}>
              <span class="ap-voc-meta num">{numero(Math.round(m.meta * 100))} %</span>
              {m.palabras === 0 ? (
                <span class="ap-voc-meta-hecha"><Icono n="check" t={13} /> {tr('Ya llegas')}</span>
              ) : (
                <button class="btn chico fantasma" data-tip={tr('Elegir esas palabras en la lista')} onClick={() => alElegir(m.palabras)}>
                  {m.palabras === 1 ? tr('1 palabra') : tr('{0} palabras', numero(m.palabras))}
                </button>
              )}
            </li>
          ))}
        </ul>
        <p class="ayuda">{tr('Las que más salen, aprendidas en orden.')}</p>
      </div>
    </section>
  );
}

const aprendiendoVeces = (filas: FilaVocabulario[]) => filas.reduce((n, f) => n + (f.estado === 'aprendiendo' ? f.veces : 0), 0);

/** Un anillo con lo conocido y, a continuación, lo que se está aprendiendo. */
function AnilloComprension({ conocidas, aprendiendo, valor }: { conocidas: number; aprendiendo: number; valor: number }) {
  const r = 30;
  const vuelta = 2 * Math.PI * r;
  return (
    <svg class="ap-anillo-nivel ap-voc-anillo" viewBox="0 0 72 72" width="76" height="76" aria-hidden="true">
      <circle cx="36" cy="36" r={r} class="fondo" />
      {conocidas + aprendiendo > 0 && <circle cx="36" cy="36" r={r} class="aprendiendo" stroke-dasharray={`${vuelta * Math.min(1, conocidas + aprendiendo)} ${vuelta}`} />}
      {conocidas > 0 && <circle cx="36" cy="36" r={r} class="conocida" stroke-dasharray={`${vuelta * conocidas} ${vuelta}`} />}
      <text x="36" y="41" text-anchor="middle">{valor}%</text>
    </svg>
  );
}

// ---------- Las palabras ----------

function ListaVocabulario({ filas, glosas, alVer, ajustes, eleccion, lugarDe, tituloDe, cambiarEnLista }: {
  filas: FilaVocabulario[];
  glosas: Map<string, string | null>;
  alVer: (claves: string[]) => void;
  ajustes: Ajustes;
  eleccion?: Set<string>;
  lugarDe: (s: { libro: number; lugar: number }) => string;
  tituloDe: (libro: number) => string;
  cambiarEnLista: (claves: Set<string>, estado: EstadoPalabra) => void;
}) {
  const [filtro, fijarFiltro] = useState<FiltroVocabulario>('nuevas');
  const [orden, fijarOrden] = useState<OrdenVocabulario>(() => leerPreferencia<OrdenVocabulario>('ordenVocabulario', 'veces'));
  const [busqueda, fijarBusqueda] = useState('');
  const [conNombres, fijarConNombres] = useState(false);
  const [sel, fijarSel] = useState<Set<string>>(() => eleccion ?? new Set());
  const [limite, fijarLimite] = useState(() => Math.max(POR_PAGINA, eleccion?.size ?? 0));
  const [abierta, fijarAbierta] = useState<string | null>(null);
  const [creando, fijarCreando] = useState<{ hechas: number; total: number } | null>(null);
  const [aviso, fijarAviso] = useState<{ texto: string; error?: boolean } | null>(null);

  const nombres = useMemo(() => filas.filter((f) => f.nombre && pasaFiltro(f.estado, filtro)).length, [filas, filtro]);
  const cuentas = useMemo(() => {
    const c: Record<FiltroVocabulario, number> = { nuevas: 0, aprendiendo: 0, conocidas: 0, todas: 0 };
    for (const f of filas) {
      if (f.nombre && !conNombres) continue;
      c.todas++;
      if (f.estado === 'desconocida') c.nuevas++;
      else if (f.estado === 'aprendiendo') c.aprendiendo++;
      else c.conocidas++;
    }
    return c;
  }, [filas, conNombres]);
  const texto = busqueda.trim().toLocaleLowerCase();
  const lista = useMemo(
    () =>
      ordenarVocabulario(
        filas.filter(
          (f) =>
            (conNombres || !f.nombre || (eleccion?.has(f.clave) ?? false)) &&
            pasaFiltro(f.estado, filtro) &&
            (!texto || f.lema.toLocaleLowerCase().includes(texto) || f.lectura.includes(texto) || (glosas.get(f.clave) ?? '').toLocaleLowerCase().includes(texto))
        ),
        orden
      ),
    [filas, filtro, orden, texto, conNombres, texto ? glosas : null]
  );
  const vistas = lista.slice(0, limite);
  useEffect(() => alVer(vistas.map((f) => f.clave)), [lista, limite]);
  const elegidas = filas.filter((f) => sel.has(f.clave));
  const maximoVeces = lista[0] ? Math.max(...lista.slice(0, 50).map((f) => f.veces)) : 1;

  const elegirOrden = (o: OrdenVocabulario) => {
    fijarOrden(o);
    guardarPreferencia('ordenVocabulario', o);
  };

  const cambiar = async (cuales: FilaVocabulario[], estado: EstadoPalabra) => {
    const claves = new Set(cuales.map((f) => f.clave));
    cambiarEnLista(claves, estado);
    fijarSel(new Set());
    await motor.cambiarPalabras(cuales.map((f) => ({ clave: f.clave, lema: f.lema, lectura: f.lectura, estado })));
  };

  /** Lleva una palabra al creador de tarjetas, con la frase elegida, para completarla antes de crearla. */
  const alCreador = async (f: FilaVocabulario, ej?: EjemploVocabulario) => {
    try {
      const b = await borradorDe(f, ej ?? f.ejemplos[0], ajustes, tituloDe((ej ?? f.ejemplos[0])?.libro ?? f.primera.libro), false);
      await enviarAlCreador(b, false);
      creadorAbierto.value = true;
    } catch (x) {
      fijarAviso({ texto: tr('No se pudo preparar la tarjeta: {0}', x instanceof Error ? x.message : String(x)), error: true });
    }
  };

  /** Crea de golpe la tarjeta de cada palabra elegida, con su mejor frase, y las deja en aprendizaje. */
  const crearTarjetas = async () => {
    const cuales = elegidas;
    if (!cuales.length) return;
    fijarAviso(null);
    // Con Anki cerrado no se empieza: cada tarjeta fallaría igual.
    if (ajustes.destino === 'anki') {
      const anki = await motor.anki().catch(() => null);
      if (!anki?.conectado) {
        fijarAviso({ texto: anki?.error ?? tr('Anki no responde. Ábrelo y comprueba que AnkiConnect está instalado.'), error: true });
        return;
      }
    }
    fijarCreando({ hechas: 0, total: cuales.length });
    let hechas = 0;
    const fallos: string[] = [];
    for (const f of cuales) {
      try {
        const ej = f.ejemplos[0];
        const b = await borradorDe(f, ej, ajustes, tituloDe(ej?.libro ?? f.primera.libro), true);
        await motor.crearTarjeta(b, ajustes.destino);
        hechas++;
      } catch (x) {
        // Una que falla (en Anki, por ejemplo, porque ya está en el mazo) no para las demás.
        fallos.push(`${f.lema}: ${x instanceof Error ? x.message : String(x)}`);
      }
      fijarCreando({ hechas: hechas + fallos.length, total: cuales.length });
    }
    const nuevas = cuales.filter((f) => f.estado === 'desconocida' && !fallos.some((x) => x.startsWith(`${f.lema}:`)));
    if (nuevas.length && hechas) await cambiar(nuevas, 'aprendiendo');
    fijarCreando(null);
    fijarSel(new Set());
    const destino = ajustes.destino === 'anki' ? tr('Anki') : tr('Memoria');
    if (fallos.length) fijarAviso({ texto: `${tr('Creadas {0} de {1} tarjetas en {2}.', numero(hechas), numero(cuales.length), destino)} ${fallos[0]}`, error: true });
    else fijarAviso({ texto: hechas === 1 ? tr('Tarjeta creada en {0}.', destino) : tr('{0} tarjetas creadas en {1}.', numero(hechas), destino) });
  };

  return (
    <>
      <div class="ap-filtros ap-voc-filtros">
        <div class="segmentado" role="radiogroup" aria-label={tr('Filtrar por estado')}>
          {FILTROS.map((f) => (
            <button key={f.id} role="radio" aria-checked={filtro === f.id} class={filtro === f.id ? 'activo' : ''} onClick={() => fijarFiltro(f.id)}>
              {f.punto && <i class={`ap-punto-estado ${f.punto}`} />}
              {tr(f.nombre)} <small class="num">{numero(cuentas[f.id])}</small>
            </button>
          ))}
        </div>
        <label class="ap-busqueda-mini">
          <Icono n="buscar" t={16} />
          <input aria-label={tr('Buscar en la lista')} placeholder={tr('Buscar')} value={busqueda} onInput={(e) => fijarBusqueda(e.currentTarget.value)} />
        </label>
        <label class="ap-voc-orden">
          <span class="ayuda">{tr('Orden')}</span>
          <select class="campo" aria-label={tr('Orden de la lista')} value={orden} onChange={(e) => elegirOrden(e.currentTarget.value as OrdenVocabulario)}>
            {ORDENES.map((o) => <option key={o.id} value={o.id}>{tr(o.nombre)}</option>)}
          </select>
        </label>
        {(nombres > 0 || conNombres) && (
          <button class={`chip ap-voc-nombres ${conNombres ? 'activo' : ''}`} aria-pressed={conNombres} data-tip={tr('Los nombres de personas y lugares no se cuentan como vocabulario: aquí se ven aparte')} onClick={() => fijarConNombres(!conNombres)}>
            <Icono n={conNombres ? 'check' : 'mas'} t={13} /> {tr('Nombres propios')} <small class="num">{numero(nombres)}</small>
          </button>
        )}
      </div>

      {aviso && <Mensaje error={aviso.error}>{aviso.texto}</Mensaje>}

      {!lista.length ? (
        <Vacio icono="palabras" titulo={filtro === 'nuevas' && !texto ? tr('No te queda ninguna por aprender') : tr('Nada con este filtro')}>
          <p>{filtro === 'nuevas' && !texto ? tr('Conoces o estás aprendiendo todas las palabras de este texto.') : tr('Prueba con otro estado o cambia la búsqueda.')}</p>
        </Vacio>
      ) : (
        <div class="ap-lista-palabras ap-voc-lista" role="list">
          {vistas.map((f) => (
            <FilaPalabraLibro
              key={f.clave}
              f={f}
              glosa={glosas.get(f.clave)}
              elegida={sel.has(f.clave)}
              abierta={abierta === f.clave}
              barra={f.veces / maximoVeces}
              lugarDe={lugarDe}
              alElegir={(marcada) =>
                fijarSel((anterior) => {
                  const s = new Set(anterior);
                  if (marcada) s.add(f.clave);
                  else s.delete(f.clave);
                  return s;
                })
              }
              alAbrir={() => fijarAbierta(abierta === f.clave ? null : f.clave)}
              alCambiar={(estado) => cambiar([f], estado)}
              alCreador={(ej) => alCreador(f, ej)}
            />
          ))}
        </div>
      )}
      {lista.length > limite && <div class="ap-ver-mas"><button class="btn" onClick={() => fijarLimite(limite + POR_PAGINA)}>{tr('Ver más ({0})', numero(lista.length - limite))}</button></div>}

      {lista.length > 0 && (
        <div class="ap-seleccion ap-voc-seleccion" role="toolbar" aria-label={tr('Cambiar las palabras seleccionadas')}>
          {creando ? (
            <span class="ap-voc-creando" role="status">
              <Icono n="espera" t={14} /> {tr('Creando tarjetas: {0} de {1}…', numero(creando.hechas), numero(creando.total))}
            </span>
          ) : sel.size === 0 ? (
            <>
              {filtro === 'nuevas' && lista.length > 20 && (
                <button class="btn chico" onClick={() => fijarSel(new Set(lista.slice(0, 20).map((f) => f.clave)))}>
                  <Icono n="check" t={14} /> {tr('Elegir las 20 primeras')}
                </button>
              )}
              <button class="btn chico" onClick={() => fijarSel(new Set(lista.map((f) => f.clave)))}>
                <Icono n="check" t={14} /> {tr('Elegir las {0} de la lista', numero(lista.length))}
              </button>
            </>
          ) : (
            <>
              <b class="num">{sel.size === 1 ? tr('1 seleccionada') : tr('{0} seleccionadas', numero(sel.size))}</b>
              {(['conocida', 'aprendiendo', 'ignorada', 'desconocida'] as EstadoPalabra[]).map((e) => (
                <button key={e} class="btn chico" onClick={() => cambiar(elegidas, e)}><i class={`ap-punto-estado ${e}`} /> {tr(NOMBRE_ESTADO[e])}</button>
              ))}
              <button class="btn chico primario" onClick={crearTarjetas} data-tip={tr('Con su mejor frase del libro y las definiciones del diccionario. Las nuevas pasan a «Aprendiendo».')}>
                <Icono n="tarjetas" t={14} /> {ajustes.destino === 'anki' ? tr('Crear {0} en Anki', numero(sel.size)) : tr('Crear {0} en Memoria', numero(sel.size))}
              </button>
              <button class="btn-icono chico" aria-label={tr('Quitar la selección')} onClick={() => fijarSel(new Set())}><Icono n="cerrar" t={14} /></button>
            </>
          )}
        </div>
      )}
    </>
  );
}

/** Una frase de ejemplo con la palabra resaltada. */
function Ejemplo({ e, f }: { e: EjemploVocabulario; f: FilaVocabulario }) {
  const p = partirEjemplo(e.texto, e.superficie, f.lema);
  return (
    <span lang={lengua.value.id}>
      {p ? (
        <>
          {p.antes}
          <mark>{p.palabra}</mark>
          {p.despues}
        </>
      ) : (
        e.texto
      )}
    </span>
  );
}

function FilaPalabraLibro({ f, glosa, elegida, abierta, barra, lugarDe, alElegir, alAbrir, alCambiar, alCreador }: {
  f: FilaVocabulario;
  /** Sin buscar aún, undefined; sin glosa, null. */
  glosa: string | null | undefined;
  elegida: boolean;
  abierta: boolean;
  barra: number;
  lugarDe: (s: { libro: number; lugar: number }) => string;
  alElegir: (marcada: boolean) => void;
  alAbrir: () => void;
  alCambiar: (estado: EstadoPalabra) => void;
  alCreador: (ej?: EjemploVocabulario) => void;
}) {
  const ej = f.ejemplos[0];
  return (
    <div class={`ap-voc-fila ${elegida ? 'elegida' : ''} ${abierta ? 'abierta' : ''}`} role="listitem">
      <div class="ap-fila-palabra ap-voc-fila-cab">
        <input class="ap-casilla" type="checkbox" aria-label={tr('Seleccionar {0}', f.lema)} checked={elegida} onChange={(e) => alElegir(e.currentTarget.checked)} />
        <button class="ap-voc-termino" aria-expanded={abierta} aria-label={tr('{0}: ver sus frases del libro', f.lema)} onClick={alAbrir}>
          <b lang={lengua.value.id}>{f.lema}</b>
          {f.lectura && f.lectura !== f.lema && lengua.value.lectura.distingue && <span lang={lengua.value.id}>{f.lectura}</span>}
          {f.nombre && <small class="ap-voc-etiqueta">{tr('nombre')}</small>}
        </button>
        {glosa === undefined ? <span class="esqueleto ap-voc-esqueleto" aria-hidden="true" /> : <span class="ap-fila-glosa" title={glosa ?? undefined}>{glosa ?? ''}</span>}
        <span class="ap-voc-veces num" data-tip={tr('Sale {0} veces', numero(f.veces))} aria-label={tr('Sale {0} veces', numero(f.veces))}>
          <span class="ap-voc-barra" aria-hidden="true"><i style={{ width: `${Math.max(8, Math.round(barra * 100))}%` }} /></span>
          <b>×{numero(f.veces)}</b>
        </span>
        <span class="ap-voc-nivel">{f.nivel && <span class={`chip-nivel n-${f.nivel}`}>{lengua.value.nombreNivel(f.nivel)}</span>}</span>
        <label class={`ap-estado-fila ${f.estado}`}>
          <i class={`ap-punto-estado ${f.estado}`} />
          <select aria-label={tr('Estado de {0}', f.lema)} value={f.estado} onChange={(e) => alCambiar(e.currentTarget.value as EstadoPalabra)}>
            {(['desconocida', 'aprendiendo', 'conocida', 'ignorada'] as EstadoPalabra[]).map((e) => <option key={e} value={e}>{tr(NOMBRE_ESTADO[e])}</option>)}
          </select>
        </label>
        <span class="ap-voc-botones">
          <button class="btn-icono chico" data-tip={tr('Buscar en el diccionario')} data-tip-lado="izq" aria-label={tr('Buscar {0}', f.lema)} onClick={() => navegar(`diccionario?q=${encodeURIComponent(f.lema)}`)}><Icono n="buscar" t={15} /></button>
          <button class="btn-icono chico" data-tip={tr('Preparar su tarjeta')} data-tip-lado="izq" aria-label={tr('Preparar la tarjeta de {0}', f.lema)} onClick={() => alCreador()}><Icono n="tarjetas" t={15} /></button>
        </span>
      </div>
      {ej && !abierta && (
        <button class="ap-voc-ejemplo" onClick={alAbrir} tabIndex={-1}>
          <Ejemplo e={ej} f={f} />
          <small class="num">{lugarDe(ej)}</small>
        </button>
      )}
      {abierta && (
        <div class="ap-voc-detalle">
          {f.ejemplos.map((e, i) => (
            <div class="ap-voc-ejemplo-largo" key={i}>
              <Ejemplo e={e} f={f} />
              <small class="num">{lugarDe(e)}</small>
              <button class="btn chico fantasma" onClick={() => alCreador(e)}><Icono n="tarjetas" t={14} /> {tr('Tarjeta con esta frase')}</button>
            </div>
          ))}
          <p class="ayuda num">
            {tr('Sale {0} veces; la primera, en {1}.', numero(f.veces), lugarDe(f.primera))}
            {f.rango !== undefined && ` ${tr('Puesto {0} entre las más usadas de la lengua.', numero(f.rango))}`}
          </p>
        </div>
      )}
    </div>
  );
}

// ---------- La gramática ----------

function GramaticaDelLibro({ puntos, lugarDe }: { puntos: GramaticaVocabulario[]; lugarDe: (s: { libro: number; lugar: number }) => string }) {
  const [filtro, fijarFiltro] = useState<FiltroVocabulario>('nuevas');
  const [abierto, fijarAbierto] = useState<string | null>(null);
  const estados = estadosGramatica.value;
  const lista = useMemo(
    () => puntos.filter((g) => pasaFiltroGramatica(estados[g.patron] ?? 'nuevo', filtro)).sort((a, b) => b.veces - a.veces || a.patron.localeCompare(b.patron)),
    [puntos, filtro, estados]
  );
  return (
    <>
      <div class="ap-filtros ap-voc-filtros">
        <div class="segmentado" role="radiogroup" aria-label={tr('Filtrar por estado')}>
          {FILTROS_GRAMATICA.map((f) => (
            <button key={f.id} role="radio" aria-checked={filtro === f.id} class={filtro === f.id ? 'activo' : ''} onClick={() => fijarFiltro(f.id)}>
              {f.punto && <i class={`punto-gram ${f.punto}`} />}
              {tr(f.nombre)}
            </button>
          ))}
        </div>
      </div>
      {!lista.length ? (
        <Vacio icono="gramatica" titulo={tr('Nada con este filtro')}>
          <p>{tr('Prueba con otro estado.')}</p>
        </Vacio>
      ) : (
        <div class="ap-lista-gramatica ap-voc-gramatica" role="list">
          {lista.map((g) => (
            <div key={g.patron} class={`ap-patron ${abierto === g.patron ? 'abierto' : ''}`} role="listitem">
              <button class="ap-patron-cab ap-voc-patron-cab" aria-expanded={abierto === g.patron} onClick={() => fijarAbierto(abierto === g.patron ? null : g.patron)}>
                <b lang={lengua.value.id}><i class={`punto-gram ${estadoGramatica(g.patron)}`} aria-label={tr(NOMBRE_ESTADO_GRAMATICA[estadoGramatica(g.patron)])} /> {g.patron}</b>
                <span>{tr(g.significado)}</span>
                <span class="ap-voc-nivel">{g.nivel && <span class={`chip-nivel n-${g.nivel}`}>{lengua.value.nombreNivel(g.nivel)}</span>}</span>
                <span class="ap-voc-veces-texto num">×{numero(g.veces)}</span>
                <Icono n={abierto === g.patron ? 'arriba' : 'abajo'} t={14} />
              </button>
              {abierto === g.patron && <DetallePunto g={g} lugarDe={lugarDe} />}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function DetallePunto({ g, lugarDe }: { g: GramaticaVocabulario; lugarDe: (s: { libro: number; lugar: number }) => string }) {
  const trozos = useMemo(() => trozosDePatron(g.patron), [g.patron]);
  const [explicar, fijarExplicar] = useState(false);
  return (
    <div class="ap-patron-detalle">
      <BotonesEstadoGramatica patron={g.patron} />
      <div class="subtitulo-def">{tr('En este texto')}</div>
      {g.ejemplos.map((e, i) => (
        <div class="ejemplo" key={i}>
          <div class="ejemplo-texto">
            <span lang={lengua.value.id}><ConPatron texto={e.texto} trozos={trozos} /></span>
            <small class="num">{lugarDe(e)}</small>
          </div>
        </div>
      ))}
      {explicar ? (
        <PanelFlujo
          metodo="preguntar"
          args={[{ lema: g.patron, frase: g.ejemplos[0]?.texto }, tr('Explica este punto de gramática ({0}): qué significa, cómo se forma y dos ejemplos breves con su traducción.', tr(g.significado))]}
          titulo={g.patron}
        />
      ) : (
        <button class="btn chico ia" onClick={() => fijarExplicar(true)}><Icono n="ia" t={14} /> {tr('Explicar con Claude')}</button>
      )}
    </div>
  );
}

// ---------- Por tomo ----------

function PorLibro({ filas, libros, textos, tomos }: { filas: FilaVocabulario[]; libros: ElementoBiblioteca[]; textos: (MetaTexto | null)[]; tomos: boolean }) {
  const resumenes = useMemo(() => resumenPorLibro(filas, libros.length), [filas, libros.length]);
  return (
    <nav class="ap-voc-libros" aria-label={tomos ? tr('Por tomo') : tr('Por libro')}>
      {resumenes.map((r) => {
        const e = libros[r.libro];
        const t = textos[r.libro];
        return (
          <button key={e.id} class="tarjeta ap-voc-libro" onClick={() => navegar(`vocabulario?libro=${encodeURIComponent(e.id)}`)}>
            <span class={`ap-tapa mini ${claseTono(e)} ${e.documento?.portada ? 'con-portada' : ''}`} aria-hidden="true"><Portada e={e} /></span>
            <span class="ap-voc-libro-texto">
              <small class="ap-voc-libro-num">{tomos ? tr('Tomo {0}', r.libro + 1) : tr('Libro {0}', r.libro + 1)}</small>
              <b lang={langDe(e.titulo)}>{e.titulo}</b>
              <span class="ayuda num">
                {!t ? tr('Su archivo no está en este equipo') : !t.conTexto ? tr('Sin texto aún') : [tr('{0} por aprender', numero(r.porAprender)), r.libro > 0 ? tr('{0} nuevas en la serie', numero(r.nuevas)) : ''].filter(Boolean).join(' · ')}
                {t && !t.completo && t.conTexto > 0 && ` · ${tr('falta texto')}`}
              </span>
            </span>
            <span class="ap-voc-libro-comp">
              <b class="num">{r.total ? `${numero(r.comprension)} %` : '–'}</b>
              <span class="barra-progreso"><span style={{ width: `${r.comprension}%` }} /></span>
            </span>
            <Icono n="flecha" t={15} />
          </button>
        );
      })}
      <p class="ayuda ap-voc-pie">{tr('«Nuevas en la serie»: las palabras por aprender que aparecen por primera vez en ese tomo.')}</p>
    </nav>
  );
}

