// La página del diccionario. Usa todo el ancho: la lista de resultados a un lado, la palabra elegida en el centro, con
// las frases donde la has visto y el minuto de cada una, y en otra columna lo que la rodea (sus kanji, sus opuestos, las
// que significan lo mismo, las que se leen igual). Un carácter suelto tiene su propia página: sus lecturas, sus piezas,
// las palabras que lo llevan y dónde lo has visto. Con poco ancho, todo queda en una columna.
//
// Pasar de una palabra a otra no deja ver la de antes a medio quitar ni la nueva a medio llegar: la nueva se prepara a
// escondidas mientras se ve la anterior (ui/preparacion.tsx) y entra de una vez, con un fundido corto.

import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { type Ajustes, guardarAjustes, TAMANO_DICCIONARIO } from '../compartido/ajustes';
import { idiomaActual, numero, tr } from '../compartido/i18n';
import { motor } from '../compartido/rpc';
import type { CaracterBreve, CaracterConNivel, PuntoEncontrado, ResultadoBusqueda } from '../compartido/tipos';
import type { EntradaBreve } from '../nucleo/explorar';
import { enviarAlCreador } from '../ui/borrador';
import { Ficha, PanelFlujo } from '../ui/Ficha';
import { Icono } from '../ui/iconos';
import { lecturaDeTarjeta, lengua } from '../ui/lengua';
import { conFundido, Preparar, useEsperar } from '../ui/preparacion';
import { Explorar, ResultadosGramatica } from './DiccionarioMas';
import { FrasesVistas, referenciasDe } from './FrasesVistas';
import { PaginaCaracter, significadoDe } from './PaginaCaracter';
import { guardarPreferencia, leerPreferencia, navegar } from './estadoApp';
import { Vacio } from './Piezas';
import { buscarPalabra, estiloDiccionario, type PalabraBreve, SeccionTarjetas, TarjetaPalabra } from './TarjetaPalabra';

interface Busqueda {
  texto: string;
  /** Las palabras de la lista: la primera se abre sola. */
  candidatos: PalabraBreve[];
  /** Si la lista es de palabras que significan lo buscado («perro» → 犬). */
  porSignificado: boolean;
  gramatica: PuntoEncontrado[];
  /** El carácter suelto buscado, si tiene página propia. */
  caracter: string | null;
  /** Si ese carácter es también una palabra: entonces se puede ver como tal. */
  caracterEsPalabra: boolean;
}

/**
 * Lo que se ve de una búsqueda: qué palabra de la lista está abierta y si un carácter se ve como tal o como palabra. Cada
 * cambio es una vista nueva, que se prepara mientras se ve la anterior.
 */
interface Vista {
  id: number;
  busqueda: Busqueda;
  elegida: number;
  comoPalabra: boolean;
  /** Viene de otra búsqueda, no de elegir en la misma lista: al enseñarla, la página vuelve arriba. */
  nueva: boolean;
}

/** La primera definición de verdad de una entrada: las referencias no cuentan. */
function primeraGlosa(r: ResultadoBusqueda): string {
  const refDe = lengua.value.referenciaEnGlosa;
  return r.entradas.flatMap((e) => e.glosas).find((g) => !refDe?.(g)) ?? '';
}

/**
 * Junta lo encontrado en una lista: primero lo que el análisis sacó de lo escrito (la forma de diccionario de 食べた, las
 * palabras de una frase), luego las palabras que son justo eso o empiezan por ello. Sin nada de eso, lo que significa.
 */
function juntar(buscado: string, lista: EntradaBreve[], libres: ResultadoBusqueda[], porSentido: EntradaBreve[]): { candidatos: PalabraBreve[]; porSignificado: boolean } {
  const analizadas: PalabraBreve[] = libres
    .filter((r) => r.entradas.length && r.lema !== buscado)
    .map((r) => ({ termino: r.lema, lectura: r.lectura, glosa: primeraGlosa(r), estado: r.estado }));
  const todas = [...analizadas, ...lista];
  const vistas = new Set<string>();
  const candidatos = todas.filter((c) => {
    const k = `${c.termino}|${c.lectura}`;
    if (vistas.has(k)) return false;
    vistas.add(k);
    return true;
  });
  if (candidatos.length) return { candidatos, porSignificado: false };
  // Lo buscado tal cual, si el diccionario lo tiene aunque no esté en la lista (una entrada sin glosa en el índice).
  const directa = libres.find((r) => r.entradas.length);
  if (directa) return { candidatos: [{ termino: directa.lema, lectura: directa.lectura, glosa: primeraGlosa(directa), estado: directa.estado }], porSignificado: false };
  return { candidatos: porSentido, porSignificado: porSentido.length > 0 };
}

export function PaginaDiccionario({ ajustes, consulta }: { ajustes: Ajustes; consulta: string }) {
  const [texto, fijarTexto] = useState(consulta);
  const [frase, fijarFrase] = useState('');
  // La vista que se ve y la que se pide: son la misma salvo mientras la pedida se prepara.
  const [vista, fijarVista] = useState<Vista | null>(null);
  const [pedida, fijarPedida] = useState<Vista | null>(null);
  const [cargando, fijarCargando] = useState(false);
  const [preparando, fijarPreparando] = useState(false);
  const [recientes, fijarRecientes] = useState<string[]>(() => leerPreferencia('busquedas', []));
  const [hayDics, fijarHayDics] = useState(true);
  // Las búsquedas que llegan tarde, porque ya se pidió otra, no cuentan.
  const turno = useRef(0);
  const numeroVista = useRef(0);
  const ultimaPedida = useRef<Vista | null>(null);
  ultimaPedida.current = pedida;
  // Mientras no haya una búsqueda que enseñar, sigue la portada: así no se queda la página en blanco al buscar desde ella.
  const conPortada = useRef(!consulta);

  const pedirVista = (v: Omit<Vista, 'id'>) => fijarPedida({ ...v, id: ++numeroVista.current });

  /** Enseña la vista que se preparaba, si sigue siendo la que se pidió. */
  const ensenar = (id: number) => {
    const v = ultimaPedida.current;
    if (!v || v.id !== id) return;
    conFundido(
      () => {
        conPortada.current = false;
        fijarVista(v);
        // Las búsquedas recientes de la portada cambian al enseñar la búsqueda, no antes: si no, se movían mientras tanto.
        if (v.nueva) {
          const nuevas = [v.busqueda.texto, ...recientes.filter((x) => x !== v.busqueda.texto)].slice(0, 8);
          fijarRecientes(nuevas);
          guardarPreferencia('busquedas', nuevas);
        }
      },
      () => {
        const p = document.querySelector<HTMLElement>('.ap-principal');
        if (!p) return;
        if (v.nueva) {
          p.scrollTop = 0;
          return;
        }
        // Elegida otra de la lista con la página bajada: la palabra nueva se lee desde su principio.
        const cuerpo = document.querySelector('.dic-pantalla:not(.preparando)');
        const arriba = cuerpo ? cuerpo.getBoundingClientRect().top - p.getBoundingClientRect().top : 0;
        if (arriba < 0) p.scrollTop += arriba - 12;
      }
    );
  };

  const buscar = async (limpio: string) => {
    const t = ++turno.current;
    fijarCargando(true);
    const paquete = lengua.value;
    const caracter = paquete.paginaCaracter?.es(limpio) ? limpio.trim() : null;
    // Lo escrito sin la escritura de la lengua es un significado: «perro» busca 犬. Solo donde la escritura lo distingue.
    const significado = paquete.lectura.distingue && !paquete.escritura.tieneTexto(limpio);
    fijarPreparando(significado);
    try {
      const [lista, libres, sentido, puntos] = await Promise.all([
        caracter ? Promise.resolve([] as EntradaBreve[]) : motor.resultadosDeBusqueda(limpio).catch(() => [] as EntradaBreve[]),
        motor.buscarLibre(limpio).catch(() => [] as ResultadoBusqueda[]),
        significado ? motor.buscarPorSignificado(limpio).catch(() => [] as EntradaBreve[]) : Promise.resolve([] as EntradaBreve[]),
        paquete.listasNivel ? motor.buscarGramatica(paquete.listasNivel.carpeta, limpio, idiomaActual()).catch(() => [] as PuntoEncontrado[]) : Promise.resolve([] as PuntoEncontrado[]),
      ]);
      if (t !== turno.current) return;
      const { candidatos, porSignificado } = juntar(limpio, lista, libres, sentido);
      pedirVista({
        busqueda: { texto: limpio, candidatos, porSignificado, gramatica: puntos, caracter, caracterEsPalabra: !!caracter && libres.some((r) => r.lema === caracter && r.entradas.length > 0) },
        elegida: 0,
        comoPalabra: false,
        nueva: true,
      });
    } finally {
      if (t === turno.current) {
        fijarCargando(false);
        fijarPreparando(false);
      }
    }
  };

  // Buscar es navegar: así el botón de volver del navegador vuelve a la búsqueda anterior.
  const pedir = (t: string) => {
    const limpio = t.trim();
    if (!limpio) return;
    if (limpio === consulta) buscar(limpio);
    else navegar(`diccionario?q=${encodeURIComponent(limpio)}`);
  };

  useEffect(() => {
    motor.estado().then((e) => fijarHayDics(e.diccionarios.some((d) => d.tipo === 'terminos'))).catch(() => {});
  }, []);
  useEffect(() => {
    fijarTexto(consulta);
    if (consulta) {
      buscar(consulta);
      return;
    }
    turno.current++;
    conPortada.current = true;
    fijarVista(null);
    fijarPedida(null);
    fijarCargando(false);
  }, [consulta]);

  const paquete = lengua.value;
  const cambiando = !!pedida && pedida.id !== vista?.id;
  const inicial = !consulta || (!vista && conPortada.current);
  const atajos = recientes.length ? recientes : paquete.ejemplos.sugerencias;
  const estilo = estiloDiccionario(ajustes);
  // En la lista y en «Ver como», lo pulsado se marca al momento, aunque la palabra tarde un poco en llegar.
  const marcas = (v: Vista) => (cambiando && pedida!.busqueda === v.busqueda ? pedida! : v);
  const base = pedida ?? vista;

  return (
    <div class={`dic ${ajustes.diccionarioAncho === 'centrado' ? 'centrado' : ''} ${inicial ? 'inicial' : ''}`} style={estilo}>
      {cambiando && <div class="dic-progreso" role="progressbar" aria-label={tr('Cargando…')} />}
      {inicial && (
        <div class="ap-dic-portada">
          <span class="hoja-icono"><Icono n="diccionario" t={24} /></span>
          <h1>{tr('¿Qué palabra buscas?')}</h1>
          <p>{tr(paquete.textos.buscarAyuda)}</p>
        </div>
      )}
      <div class="dic-barra">
        <div class="dic-barra-busqueda">
          {/* El botón no cambia de texto ni se desactiva al buscar: con búsquedas de un instante, solo parpadeaba. */}
          <form class="ap-buscador" role="search" onSubmit={(e) => { e.preventDefault(); pedir(texto); }}>
            <Icono n="buscar" t={20} />
            <input lang={paquete.id} aria-label={tr('Buscar en el diccionario')} placeholder={paquete.ejemplos.busqueda} value={texto} onInput={(e) => fijarTexto(e.currentTarget.value)} autoFocus />
            <button class="btn primario" type="submit" disabled={!texto.trim()}>{tr('Buscar')}</button>
          </form>
          <label class="ap-contexto">
            <Icono n="ia" t={15} />
            <input lang={paquete.id} aria-label={tr('Frase de contexto opcional')} placeholder={tr('Opcional: la frase donde la viste, para que Claude la explique en contexto')} value={frase} onInput={(e) => fijarFrase(e.currentTarget.value)} />
          </label>
        </div>
        {!inicial && <AjustesPagina ajustes={ajustes} />}
      </div>

      {inicial && (
        <>
          <div class="ap-dic-atajos">
            <span class="ayuda">{recientes.length ? tr('Búsquedas recientes') : tr('Prueba con')}</span>
            {atajos.map((r) => (
              <button key={r} class="chip" lang={paquete.id} onClick={() => pedir(r)}>{r}</button>
            ))}
          </div>
          <Explorar />
        </>
      )}
      {cargando && preparando && <p class="ayuda ap-dic-preparando"><span class="giro" /> {tr('Preparando el diccionario para buscar por significado: la primera vez tarda unos segundos.')}</p>}

      {[vista, cambiando ? pedida : null].map((v) => {
        if (!v) return null;
        const aLaVista = v === vista;
        return (
          <div key={v.id} class={`dic-pantalla ${aLaVista ? (cambiando ? 'esperando' : '') : 'preparando'}`} inert={!aLaVista} aria-hidden={aLaVista ? undefined : 'true'}>
            <Preparar alListo={() => ensenar(v.id)}>
              <CuerpoBusqueda
                v={v}
                marcas={marcas(v)}
                ajustes={ajustes}
                frase={frase}
                hayDics={hayDics}
                alElegir={(i) => {
                  if (base && base.busqueda === v.busqueda && base.elegida === i && !base.comoPalabra) return;
                  pedirVista({ busqueda: v.busqueda, elegida: i, comoPalabra: false, nueva: false });
                }}
                alVerComo={(como) => {
                  if (base && base.busqueda === v.busqueda && base.comoPalabra === como) return;
                  pedirVista({ busqueda: v.busqueda, elegida: base?.busqueda === v.busqueda ? base.elegida : v.elegida, comoPalabra: como, nueva: false });
                }}
              />
            </Preparar>
          </div>
        );
      })}
    </div>
  );
}

/** Lo que se ve de una búsqueda: la página del carácter o la de la palabra con su lista, su gramática, o que no hay nada. */
function CuerpoBusqueda({ v, marcas, ajustes, frase, hayDics, alElegir, alVerComo }: {
  v: Vista;
  /** Lo marcado en la lista y en «Ver como»: lo pedido, aunque aún no se vea. */
  marcas: Pick<Vista, 'elegida' | 'comoPalabra'>;
  ajustes: Ajustes;
  frase: string;
  hayDics: boolean;
  alElegir: (i: number) => void;
  alVerComo: (comoPalabra: boolean) => void;
}) {
  const paquete = lengua.value;
  const { busqueda } = v;
  const c = busqueda.candidatos[v.elegida];
  const verCaracter = !!busqueda.caracter && !v.comoPalabra;
  const nada = !busqueda.caracter && !busqueda.candidatos.length && !busqueda.gramatica.length;
  const conLista = busqueda.candidatos.length > 1 && !v.comoPalabra;
  return (
    <>
      {busqueda.caracter && busqueda.caracterEsPalabra && (
        <div class="segmentado dic-vista" role="radiogroup" aria-label={tr('Ver como')}>
          <button role="radio" aria-checked={!marcas.comoPalabra} class={!marcas.comoPalabra ? 'activo' : ''} onClick={() => alVerComo(false)}>
            <span lang={paquete.id}>{busqueda.caracter}</span> {tr(paquete.paginaCaracter!.nombre)}
          </button>
          <button role="radio" aria-checked={marcas.comoPalabra} class={marcas.comoPalabra ? 'activo' : ''} onClick={() => alVerComo(true)}>
            <span lang={paquete.id}>{busqueda.caracter}</span> {tr('Palabra')}
          </button>
        </div>
      )}

      {verCaracter && <PaginaCaracter key={busqueda.caracter} caracter={busqueda.caracter!} ajustes={ajustes} />}

      {!verCaracter && (v.comoPalabra ? busqueda.caracter : c) && (
        <div class={`dic-cuerpo ${conLista ? 'con-lista' : ''}`}>
          {conLista && (
            <ListaResultados
              busqueda={busqueda}
              titulo={busqueda.porSignificado ? tr('Palabras que significan «{0}»', busqueda.texto) : tr('Resultados')}
              elegida={marcas.comoPalabra ? -1 : marcas.elegida}
              alElegir={alElegir}
            />
          )}
          {v.comoPalabra ? (
            <PalabraEnPagina key={`caracter|${busqueda.caracter}`} termino={busqueda.caracter!} ajustes={ajustes} frase={frase} />
          ) : (
            <PalabraEnPagina key={`${c!.termino}|${c!.lectura}`} termino={c!.termino} lectura={c!.lectura} ajustes={ajustes} frase={frase} />
          )}
        </div>
      )}

      <div class="dic-gramatica"><ResultadosGramatica key={busqueda.texto} puntos={busqueda.gramatica} /></div>

      {nada && (
        <Vacio icono="buscar" titulo={hayDics ? tr('Sin resultados') : tr('Aún no hay diccionarios')}>
          <p>{hayDics ? tr('No hay nada para «{0}». Comprueba la escritura o busca solo la raíz de la palabra.', busqueda.texto) : tr('Instálalos en Ajustes para poder buscar.')}</p>
          {!hayDics && <button class="btn primario" onClick={() => navegar('ajustes')}>{tr('Ir a Ajustes')}</button>}
        </Vacio>
      )}
    </>
  );
}

/** Tamaño y ancho a mano, junto al buscador: lo mismo que en Ajustes, sin salir de la página. */
function AjustesPagina({ ajustes }: { ajustes: Ajustes }) {
  const { minimo, maximo, paso } = TAMANO_DICCIONARIO;
  const t = ajustes.diccionarioTamano;
  const cambiar = (c: Partial<Ajustes>) => guardarAjustes(c).catch(() => {});
  const completo = ajustes.diccionarioAncho !== 'centrado';
  return (
    <div class="dic-ajustes">
      <div class="ap-tamano" role="group" aria-label={tr('Tamaño de las palabras')}>
        <button class="btn-icono chico" aria-label={tr('Palabras más pequeñas')} data-tip={tr('Palabras más pequeñas')} disabled={t <= minimo} onClick={() => cambiar({ diccionarioTamano: Math.max(minimo, t - paso) })}><Icono n="menos" t={14} /></button>
        <span aria-hidden="true" lang={lengua.value.id}>{lengua.value.ejemplos.letra}</span>
        <button class="btn-icono chico" aria-label={tr('Palabras más grandes')} data-tip={tr('Palabras más grandes')} disabled={t >= maximo} onClick={() => cambiar({ diccionarioTamano: Math.min(maximo, t + paso) })}><Icono n="mas" t={14} /></button>
      </div>
      <button class={`btn-icono chico ${completo ? 'activo' : ''}`} aria-pressed={completo} aria-label={tr('A todo el ancho')} data-tip={completo ? tr('Pasar a una columna centrada') : tr('Usar todo el ancho')} data-tip-lado="izq" onClick={() => cambiar({ diccionarioAncho: completo ? 'centrado' : 'completo' })}>
        <Icono n="ajustar-ancho" t={16} />
      </button>
    </div>
  );
}

/**
 * Por dónde iba la lista de cada búsqueda. Al elegir otra palabra, la lista se pinta de nuevo con la vista nueva: así
 * sigue en el mismo sitio en vez de volver al principio.
 */
const desplazamientos = new WeakMap<Busqueda, { x: number; y: number }>();

function ListaResultados({ busqueda, titulo, elegida, alElegir }: { busqueda: Busqueda; titulo: string; elegida: number; alElegir: (i: number) => void }) {
  const caja = useRef<HTMLElement>(null);
  const fila = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const d = desplazamientos.get(busqueda);
    if (!d) return;
    if (caja.current) caja.current.scrollTop = d.y;
    if (fila.current) fila.current.scrollLeft = d.x;
  }, []);
  const recordar = () => desplazamientos.set(busqueda, { x: fila.current?.scrollLeft ?? 0, y: caja.current?.scrollTop ?? 0 });
  return (
    <nav ref={caja} class="dic-lista" aria-label={titulo} onScroll={recordar}>
      <h2 class="dic-lista-titulo">
        <span>{titulo}</span>
        <span class="dic-cuenta num">{numero(busqueda.candidatos.length)}</span>
      </h2>
      <div ref={fila} class="dic-lista-items" onScroll={recordar}>
        {busqueda.candidatos.map((c, i) => <TarjetaPalabra key={`${c.termino}|${c.lectura}`} e={c} activa={i === elegida} alElegir={() => alElegir(i)} />)}
      </div>
    </nav>
  );
}

/** La palabra elegida: su ficha grande, las frases donde la has visto, y a su lado lo que la rodea. */
function PalabraEnPagina({ termino, lectura, ajustes, frase }: { termino: string; lectura?: string; ajustes: Ajustes; frase: string }) {
  const [r, fijarR] = useState<ResultadoBusqueda | null>(null);
  return (
    <>
      <div class="dic-centro">
        <div class="dic-ficha">
          <Ficha
            vista="pagina"
            lema={termino}
            lectura={lectura || undefined}
            ajustes={ajustes}
            contexto={{ frase: frase || undefined }}
            pestanaInicial="ninguna"
            alCargar={fijarR}
            alEnviar={(x) => enviarAlCreador({ palabra: x.lema, lectura: lecturaDeTarjeta(x), frase, definicion: [...new Set(x.entradas.flatMap((e) => e.glosas))].slice(0, 5).join('<br>') }, false)}
          />
        </div>
        {r && <FrasesVistas clave={r.lema} titulo={tr('Donde la has visto')} cargar={() => motor.ejemplos(r.lema)} resaltar={(t) => t.lema === r.lema} ajustes={ajustes} vacio={tr('Aún no has visto esta palabra en otras frases. Irán apareciendo aquí conforme la encuentres.')} />}
      </div>
      <Lateral r={r} frase={frase} />
    </>
  );
}

/** Lo que rodea a una palabra, salvo las que significan lo mismo, que pueden tardar más y van aparte. */
interface Alrededor {
  kanji: CaracterConNivel[];
  breves: Map<string, CaracterBreve>;
  opuestos: EntradaBreve[];
  ver: EntradaBreve[];
  homofonos: EntradaBreve[];
}

async function cargarAlrededor(r: ResultadoBusqueda): Promise<Alrededor> {
  const paquete = lengua.value;
  const listas = paquete.listasNivel;
  const caracteres = paquete.trazos?.conocidas?.caracteres(r.lema) ?? [];
  const refs = referenciasDe(r);
  const op = refs.filter((x) => x.tipo === 'opuesto');
  const vs = refs.filter((x) => x.tipo === 'ver');
  const [kanji, breves, opuestos, ver, homofonos] = await Promise.all([
    listas && caracteres.length ? motor.caracteresConNivel(listas.carpeta, caracteres).catch(() => [] as CaracterConNivel[]) : ([] as CaracterConNivel[]),
    // Con el diccionario de caracteres, lo que significan en el idioma de la interfaz; las listas solo lo traen en inglés.
    caracteres.length ? motor.caracteresBreves(caracteres).catch(() => [] as CaracterBreve[]) : ([] as CaracterBreve[]),
    op.length ? motor.entradasDe(op).catch(() => [] as EntradaBreve[]) : ([] as EntradaBreve[]),
    vs.length ? motor.entradasDe(vs).catch(() => [] as EntradaBreve[]) : ([] as EntradaBreve[]),
    paquete.lectura.distingue && r.lectura ? motor.homofonos(r.lectura, r.lema).catch(() => [] as EntradaBreve[]) : ([] as EntradaBreve[]),
  ]);
  return { kanji, breves: new Map(breves.map((x) => [x.caracter, x])), opuestos, ver, homofonos };
}

/**
 * Lo que rodea a una palabra: sus kanji, sus opuestos, las que significan lo mismo, las que hay que ver y las que se leen
 * igual. Llega todo de una vez, salvo las que significan lo mismo: sin el índice del diccionario aún hecho tardan unos
 * segundos, y lo demás no las espera.
 */
function Lateral({ r, frase }: { r: ResultadoBusqueda | null; frase: string }) {
  const paquete = lengua.value;
  const listas = paquete.listasNivel;
  const esperar = useEsperar();
  const [alrededor, fijarAlrededor] = useState<Alrededor | null>(null);
  const [sinonimos, fijarSinonimos] = useState<EntradaBreve[] | null>(null);
  const [parecidas, fijarParecidas] = useState(false);

  useEffect(() => {
    if (!r) return;
    let vivo = true;
    fijarParecidas(false);
    fijarAlrededor(null);
    fijarSinonimos(null);
    esperar(cargarAlrededor(r)).then((x) => vivo && fijarAlrededor(x));
    const sinon = paquete.categoriasDiccionario?.length ? motor.sinonimos(r.lema, r.lectura ?? '').catch(() => [] as EntradaBreve[]) : Promise.resolve([] as EntradaBreve[]);
    esperar(sinon).then((s) => vivo && fijarSinonimos(s));
    return () => {
      vivo = false;
    };
  }, [r?.lema, r?.lectura]);

  if (!r) return <aside class="dic-lateral" aria-busy="true" />;
  const kanji = alrededor?.kanji ?? [];
  return (
    <aside class="dic-lateral" aria-label={tr('Relacionadas')} aria-busy={alrededor ? undefined : 'true'}>
      {kanji.length > 0 && (
        <section class="dic-seccion" aria-label={tr(listas?.caracteres ?? '')}>
          <h3 class="dic-seccion-titulo">{tr(listas?.caracteres ?? '')}</h3>
          <div class="dic-caracteres">
            {kanji.map((k) => {
              const b = alrededor!.breves.get(k.caracter);
              const s = b ? significadoDe(b.significados) : { textos: k.glosa ? [k.glosa] : [], lang: 'en' };
              const glosa = s.textos.slice(0, 3).join(', ');
              return (
              <button key={k.caracter} class="dic-caracter-tarjeta" onClick={() => buscarPalabra(k.caracter)} aria-label={`${k.caracter}: ${glosa}`}>
                <b lang={paquete.id}>{k.caracter}</b>
                <span>
                  <em lang={glosa ? s.lang : undefined}>{glosa || tr('Fuera de las listas')}</em>
                  {(k.on || k.kun) && <small lang={paquete.id}>{[k.on, k.kun].filter(Boolean).join(' · ')}</small>}
                </span>
                {k.nivel && <small class="chip-nivel">{k.nivel}</small>}
              </button>
              );
            })}
          </div>
        </section>
      )}
      <SeccionTarjetas titulo={tr('Opuestos')} xs={alrededor?.opuestos ?? []} />
      <SeccionTarjetas titulo={tr('Significan lo mismo')} xs={sinonimos} cargando={sinonimos === null} />
      <SeccionTarjetas titulo={tr('Ver también')} xs={alrededor?.ver ?? []} />
      <SeccionTarjetas titulo={tr('Se leen igual')} xs={alrededor?.homofonos ?? []} />
      <section class="dic-seccion">
        {parecidas ? (
          <PanelFlujo
            metodo="preguntar"
            args={[{ lema: r.lema, lectura: r.lectura, frase: frase || undefined }, tr('¿Qué palabras parecidas a «{0}» hay, y en qué se diferencian? Da tres o cuatro, con un ejemplo breve de cada una.', r.lema)]}
            titulo={tr('Palabras parecidas')}
          />
        ) : (
          <button class="btn chico ia" onClick={() => fijarParecidas(true)}><Icono n="ia" t={14} /> {tr('Palabras parecidas y en qué se diferencian')}</button>
        )}
      </section>
    </aside>
  );
}
