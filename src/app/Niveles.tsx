// Los niveles del examen de la lengua que se estudia (en japonés, el JLPT): el vocabulario, los caracteres y la gramática
// de cada nivel, con lo que ya se conoce de cada uno. Las palabras se marcan aquí mismo, una a una o todas las elegidas.

import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Ajustes } from '../compartido/ajustes';
import { idiomaActual, numero, tm, tr } from '../compartido/i18n';
import { motor } from '../compartido/rpc';
import type { CaracterNivel, EstadoPalabra, FraseEjemplo, GramaticaNivel, ListaNivel, PalabraNivel, ResumenNivel } from '../compartido/tipos';
import { significadoEn, trozosDePatron } from '../nucleo/niveles';
import type { ListasNivelLengua } from '../lenguas/tipos';
import { NOMBRE_ESTADO, PanelFlujo } from '../ui/Ficha';
import { Icono } from '../ui/iconos';
import { lengua } from '../ui/lengua';
import { PanelTrazos } from '../ui/Trazos';
import { guardarPreferencia, leerPreferencia, navegar } from './estadoApp';
import { Cabecera, Vacio } from './Piezas';

type Pestana = 'palabras' | 'caracteres' | 'gramatica';
type Filtro = 'todas' | 'nuevas' | 'aprendiendo' | 'conocidas';

const FILTROS: { id: Filtro; nombre: string; punto?: EstadoPalabra }[] = [
  { id: 'todas', nombre: tm('Todas') },
  { id: 'nuevas', nombre: tm('Por aprender'), punto: 'desconocida' },
  { id: 'aprendiendo', nombre: tm('Aprendiendo'), punto: 'aprendiendo' },
  { id: 'conocidas', nombre: tm('Conocidas'), punto: 'conocida' },
];

const pasaFiltro = (estado: EstadoPalabra, f: Filtro) =>
  f === 'todas' || (f === 'nuevas' ? estado === 'desconocida' : f === 'aprendiendo' ? estado === 'aprendiendo' : estado === 'conocida' || estado === 'ignorada');

const POR_PAGINA = 300;

/** Un anillo con la parte conocida de un nivel. */
function Anillo({ parte, aprendiendo }: { parte: number; aprendiendo: number }) {
  const r = 26;
  const vuelta = 2 * Math.PI * r;
  return (
    <svg class="ap-anillo-nivel" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
      <circle cx="32" cy="32" r={r} class="fondo" />
      {/* Un arco de largo cero con los extremos redondos pintaría un punto suelto. */}
      {parte + aprendiendo > 0 && <circle cx="32" cy="32" r={r} class="aprendiendo" stroke-dasharray={`${vuelta * Math.min(1, parte + aprendiendo)} ${vuelta}`} />}
      {parte > 0 && <circle cx="32" cy="32" r={r} class="conocida" stroke-dasharray={`${vuelta * parte} ${vuelta}`} />}
      <text x="32" y="36.5" text-anchor="middle">{Math.round(parte * 100)}%</text>
    </svg>
  );
}

function TarjetaNivel({ id, r, activo, listas, alElegir }: { id: string; r?: ResumenNivel; activo: boolean; listas: ListasNivelLengua; alElegir: () => void }) {
  const parte = r?.palabras.total ? r.palabras.conocidas / r.palabras.total : 0;
  const aprendiendo = r?.palabras.total ? r.palabras.aprendiendo / r.palabras.total : 0;
  return (
    <button role="radio" aria-checked={activo} class={`tarjeta ap-nivel-examen ${activo ? 'activo' : ''}`} onClick={alElegir}>
      <span class="ap-nivel-examen-cab">
        <b>{id}</b>
        <Anillo parte={parte} aprendiendo={aprendiendo} />
      </span>
      <dl>
        <div><dt>{tr('Vocabulario')}</dt><dd class="num">{r ? `${numero(r.palabras.conocidas)} / ${numero(r.palabras.total)}` : '–'}</dd></div>
        {listas.caracteres && <div><dt>{tr(listas.caracteres)}</dt><dd class="num">{r ? `${numero(r.caracteres.conocidas)} / ${numero(r.caracteres.total)}` : '–'}</dd></div>}
        <div><dt>{tr('Gramática')}</dt><dd class="num">{r ? numero(r.gramatica.total) : '–'}</dd></div>
      </dl>
    </button>
  );
}

export function Niveles({ ajustes }: { ajustes: Ajustes }) {
  const listas = lengua.value.listasNivel;
  if (!listas) {
    return (
      <div class="ap-lienzo">
        <Vacio icono="nivel" titulo={tr('Sin listas por nivel')}>
          <p>{tr('La lengua que estudias aún no tiene listas por nivel.')}</p>
        </Vacio>
      </div>
    );
  }
  return <PantallaNiveles key={lengua.value.id} listas={listas} ajustes={ajustes} />;
}

function nivelInicial(listas: ListasNivelLengua, a: Ajustes): string {
  const guardado = leerPreferencia<string>(`nivelLista:${lengua.value.id}`, '');
  if (listas.niveles.includes(guardado)) return guardado;
  // Si no se ha elegido ninguno, el del nivel de los ajustes: «JLPT N3» abre N3.
  return listas.niveles.find((n) => a.nivel?.includes(n)) ?? listas.niveles[0];
}

function PantallaNiveles({ listas, ajustes }: { listas: ListasNivelLengua; ajustes: Ajustes }) {
  const [nivel, fijarNivel] = useState(() => nivelInicial(listas, ajustes));
  const [pestana, fijarPestana] = useState<Pestana>(() => leerPreferencia<Pestana>('pestanaNiveles', 'palabras'));
  const [resumen, fijarResumen] = useState<ResumenNivel[] | null>(null);
  const [lista, fijarLista] = useState<ListaNivel | null>(null);
  const [error, fijarError] = useState('');
  const [filtro, fijarFiltro] = useState<Filtro>('todas');
  const [busqueda, fijarBusqueda] = useState('');
  const [sel, fijarSel] = useState<Set<string>>(new Set());
  const [limite, fijarLimite] = useState(POR_PAGINA);
  const [caracter, fijarCaracter] = useState<CaracterNivel | null>(null);
  const [abierta, fijarAbierta] = useState<string | null>(null);

  const cargar = async (n = nivel) => {
    try {
      const [r, l] = await Promise.all([motor.resumenNiveles(listas.carpeta, listas.niveles), motor.listaNivel(listas.carpeta, n)]);
      fijarResumen(r);
      fijarLista(l);
      fijarError('');
    } catch (e) {
      fijarError(e instanceof Error ? e.message : String(e));
    }
  };
  useEffect(() => {
    fijarLista(null);
    fijarSel(new Set());
    fijarLimite(POR_PAGINA);
    fijarCaracter(null);
    fijarAbierta(null);
    cargar(nivel).catch(console.error);
  }, [nivel]);

  const elegirNivel = (n: string) => {
    fijarNivel(n);
    guardarPreferencia(`nivelLista:${lengua.value.id}`, n);
  };
  const elegirPestana = (p: Pestana) => {
    fijarPestana(p);
    guardarPreferencia('pestanaNiveles', p);
    fijarSel(new Set());
  };

  const texto = busqueda.trim().toLowerCase();
  const palabras = useMemo(
    () => (lista?.palabras ?? []).filter((p) => pasaFiltro(p.estado, filtro) && (!texto || p.lema.includes(texto) || p.lectura.includes(texto) || p.glosa.toLowerCase().includes(texto))),
    [lista, filtro, texto]
  );
  const caracteres = useMemo(
    () => (lista?.caracteres ?? []).filter((c) => pasaFiltro(c.estado, filtro) && (!texto || c.caracter === texto || c.on.includes(texto) || c.kun.includes(texto) || c.glosa.toLowerCase().includes(texto))),
    [lista, filtro, texto]
  );
  const idioma = idiomaActual();
  const gramatica = useMemo(
    () => (lista?.gramatica ?? []).filter((g) => !texto || g.patron.includes(texto) || significadoEn(g, idioma).toLowerCase().includes(texto)),
    [lista, texto, idioma]
  );

  const cambiar = async (filas: PalabraNivel[], estado: EstadoPalabra) => {
    await motor.cambiarPalabras(filas.map((f) => ({ clave: f.clave, lema: f.lema, lectura: f.lectura, estado })));
    fijarSel(new Set());
    await cargar();
  };

  const pestanas: { id: Pestana; nombre: string; n?: number }[] = [
    { id: 'palabras', nombre: tr('Vocabulario'), n: lista?.palabras.length },
    ...(listas.caracteres ? [{ id: 'caracteres' as const, nombre: tr(listas.caracteres), n: lista?.caracteres.length }] : []),
    { id: 'gramatica', nombre: tr('Gramática'), n: lista?.gramatica.length },
  ];

  return (
    <div class="ap-lienzo ap-niveles">
      <Cabecera titulo={listas.examen} sub={tr(listas.descripcion)} />

      <div class="ap-niveles-tarjetas" role="radiogroup" aria-label={tr('Nivel')}>
        {listas.niveles.map((n) => (
          <TarjetaNivel key={n} id={n} r={resumen?.find((x) => x.nivel === n)} activo={n === nivel} listas={listas} alElegir={() => elegirNivel(n)} />
        ))}
      </div>

      <div class="ap-filtros ap-niveles-filtros">
        <div class="segmentado acento" role="tablist" aria-label={tr('Qué ver')}>
          {pestanas.map((p) => (
            <button key={p.id} role="tab" aria-selected={pestana === p.id} class={pestana === p.id ? 'activo' : ''} onClick={() => elegirPestana(p.id)}>
              {p.nombre} {p.n !== undefined && <small class="num">{numero(p.n)}</small>}
            </button>
          ))}
        </div>
        <label class="ap-busqueda-mini">
          <Icono n="buscar" t={16} />
          <input aria-label={tr('Buscar en la lista')} placeholder={tr('Buscar')} value={busqueda} onInput={(e) => fijarBusqueda(e.currentTarget.value)} />
        </label>
        {pestana !== 'gramatica' && (
          <div class="segmentado" role="radiogroup" aria-label={tr('Filtrar por estado')}>
            {FILTROS.map((f) => (
              <button key={f.id} role="radio" aria-checked={filtro === f.id} class={filtro === f.id ? 'activo' : ''} onClick={() => fijarFiltro(f.id)}>
                {f.punto && <i class={`ap-punto-estado ${f.punto}`} />}
                {tr(f.nombre)}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <Vacio icono="aviso" titulo={tr('No se pudieron leer las listas')}><p>{error}</p></Vacio>}
      {!lista && !error && <div class="ap-niveles-cargando"><span class="giro" /> {tr('Cargando…')}</div>}

      {lista && pestana === 'palabras' && (
        <ListaPalabrasNivel palabras={palabras} limite={limite} sel={sel} alElegir={fijarSel} alCambiar={cambiar} alVerMas={() => fijarLimite(limite + POR_PAGINA)} />
      )}
      {lista && pestana === 'caracteres' && (
        <RejillaCaracteres caracteres={caracteres} elegido={caracter} alElegir={fijarCaracter} palabras={lista.palabras} listas={listas} />
      )}
      {lista && pestana === 'gramatica' && <ListaGramatica gramatica={gramatica} idioma={idioma} abierta={abierta} alAbrir={fijarAbierta} />}

      <p class="ayuda ap-niveles-credito">{tr(listas.credito)}</p>
    </div>
  );
}

function ListaPalabrasNivel({ palabras, limite, sel, alElegir, alCambiar, alVerMas }: {
  palabras: PalabraNivel[];
  limite: number;
  sel: Set<string>;
  alElegir: (s: Set<string> | ((anterior: Set<string>) => Set<string>)) => void;
  alCambiar: (filas: PalabraNivel[], estado: EstadoPalabra) => Promise<void>;
  alVerMas: () => void;
}) {
  if (!palabras.length) {
    return (
      <Vacio icono="palabras" titulo={tr('Nada con este filtro')}>
        <p>{tr('Prueba con otro estado o cambia la búsqueda.')}</p>
      </Vacio>
    );
  }
  const elegidas = palabras.filter((p) => sel.has(p.clave));
  return (
    <>
      <div class="ap-lista-palabras ap-lista-nivel" role="list">
        {palabras.slice(0, limite).map((f) => (
          <div class={`ap-fila-palabra ${sel.has(f.clave) ? 'elegida' : ''}`} role="listitem" key={f.clave}>
            <input class="ap-casilla" type="checkbox" aria-label={tr('Seleccionar {0}', f.lema)} checked={sel.has(f.clave)} onChange={(e) => {
              // Sobre la selección más reciente: varias casillas seguidas no se pisan.
              const marcada = e.currentTarget.checked;
              alElegir((anterior) => {
                const s = new Set(anterior);
                if (marcada) s.add(f.clave);
                else s.delete(f.clave);
                return s;
              });
            }} />
            <div class="ap-fila-termino">
              <b lang={lengua.value.id}>{f.lema}</b>
              {f.lectura !== f.lema && <span lang={lengua.value.id}>{f.lectura}</span>}
            </div>
            <span class="ap-fila-glosa" lang="en">{f.glosa}</span>
            <label class={`ap-estado-fila ${f.estado}`}>
              <i class={`ap-punto-estado ${f.estado}`} />
              <select aria-label={tr('Estado de {0}', f.lema)} value={f.estado} onChange={(e) => alCambiar([f], e.currentTarget.value as EstadoPalabra)}>
                {(['desconocida', 'aprendiendo', 'conocida', 'ignorada'] as EstadoPalabra[]).map((e) => <option key={e} value={e}>{tr(NOMBRE_ESTADO[e])}</option>)}
              </select>
            </label>
            <button class="btn-icono chico" data-tip={tr('Buscar en el diccionario')} data-tip-lado="izq" aria-label={tr('Buscar {0}', f.lema)} onClick={() => navegar(`diccionario?q=${encodeURIComponent(f.lema)}`)}><Icono n="buscar" t={15} /></button>
          </div>
        ))}
      </div>
      {palabras.length > limite && <div class="ap-ver-mas"><button class="btn" onClick={alVerMas}>{tr('Ver más ({0})', numero(palabras.length - limite))}</button></div>}
      <div class="ap-seleccion" role="toolbar" aria-label={tr('Cambiar las palabras seleccionadas')}>
        {sel.size === 0 ? (
          <button class="btn chico" onClick={() => alElegir(new Set(palabras.map((p) => p.clave)))}>
            <Icono n="check" t={14} /> {tr('Elegir las {0} de la lista', numero(palabras.length))}
          </button>
        ) : (
          <>
            <b class="num">{sel.size === 1 ? tr('1 seleccionada') : tr('{0} seleccionadas', numero(sel.size))}</b>
            {(['conocida', 'aprendiendo', 'ignorada', 'desconocida'] as EstadoPalabra[]).map((e) => (
              <button key={e} class="btn chico" onClick={() => alCambiar(elegidas, e)}><i class={`ap-punto-estado ${e}`} /> {tr(NOMBRE_ESTADO[e])}</button>
            ))}
            <button class="btn-icono chico" aria-label={tr('Quitar la selección')} onClick={() => alElegir(new Set())}><Icono n="cerrar" t={14} /></button>
          </>
        )}
      </div>
    </>
  );
}

function RejillaCaracteres({ caracteres, elegido, alElegir, palabras, listas }: {
  caracteres: CaracterNivel[];
  elegido: CaracterNivel | null;
  alElegir: (c: CaracterNivel | null) => void;
  palabras: PalabraNivel[];
  listas: ListasNivelLengua;
}) {
  if (!caracteres.length) {
    return (
      <Vacio icono="trazos" titulo={tr('Nada con este filtro')}>
        <p>{tr('Prueba con otro estado o cambia la búsqueda.')}</p>
      </Vacio>
    );
  }
  const conEste = elegido ? palabras.filter((p) => p.lema.includes(elegido.caracter)).slice(0, 24) : [];
  return (
    <div class={`ap-caracteres ${elegido ? 'con-detalle' : ''}`}>
      <div class="ap-caracteres-rejilla">
        {caracteres.map((c) => (
          <button
            key={c.caracter}
            class={`ap-caracter ${c.estado} ${elegido?.caracter === c.caracter ? 'activo' : ''}`}
            lang={lengua.value.id}
            aria-label={`${c.caracter}: ${c.glosa} · ${tr(NOMBRE_ESTADO[c.estado])}`}
            data-tip={c.glosa}
            onClick={() => alElegir(elegido?.caracter === c.caracter ? null : c)}
          >
            {c.caracter}
          </button>
        ))}
      </div>
      {elegido && (
        <aside class="tarjeta ap-caracter-detalle" aria-label={elegido.caracter}>
          <div class="ap-caracter-cab">
            <b lang={lengua.value.id}>{elegido.caracter}</b>
            <div>
              {elegido.on && <p lang={lengua.value.id}><small>on</small> {elegido.on}</p>}
              {elegido.kun && <p lang={lengua.value.id}><small>kun</small> {elegido.kun}</p>}
              <p class="ap-caracter-glosa" lang="en">{elegido.glosa}</p>
            </div>
            <button class="btn-icono chico" aria-label={tr('Cerrar')} onClick={() => alElegir(null)}><Icono n="cerrar" t={15} /></button>
          </div>
          <span class={`chip ap-estado-chip ${elegido.estado}`}><i class={`ap-punto-estado ${elegido.estado}`} /> {tr(NOMBRE_ESTADO[elegido.estado])}</span>
          <PanelTrazos key={elegido.caracter} palabra={elegido.caracter} />
          {conEste.length > 0 && (
            <>
              <div class="subtitulo-def">{tr(listas.palabrasConCaracter ?? 'Palabras del nivel')}</div>
              <div class="ap-caracter-palabras">
                {conEste.map((p) => (
                  <button key={p.clave} class={`chip ${p.estado}`} lang={lengua.value.id} data-tip={p.glosa} onClick={() => navegar(`diccionario?q=${encodeURIComponent(p.lema)}`)}>
                    <i class={`ap-punto-estado ${p.estado}`} /> {p.lema}
                  </button>
                ))}
              </div>
            </>
          )}
          <button class="btn chico" onClick={() => navegar(`diccionario?q=${encodeURIComponent(elegido.caracter)}`)}><Icono n="diccionario" t={14} /> {tr('Buscar en el diccionario')}</button>
        </aside>
      )}
    </div>
  );
}

function ListaGramatica({ gramatica, idioma, abierta, alAbrir }: { gramatica: GramaticaNivel[]; idioma: string; abierta: string | null; alAbrir: (p: string | null) => void }) {
  if (!gramatica.length) {
    return (
      <Vacio icono="gramatica" titulo={tr('Nada con esta búsqueda')}>
        <p>{tr('Prueba con otra palabra.')}</p>
      </Vacio>
    );
  }
  return (
    <div class="ap-lista-gramatica" role="list">
      {gramatica.map((g) => (
        <div key={g.patron} class={`ap-patron ${abierta === g.patron ? 'abierto' : ''}`} role="listitem">
          <button class="ap-patron-cab" aria-expanded={abierta === g.patron} onClick={() => alAbrir(abierta === g.patron ? null : g.patron)}>
            <b lang={lengua.value.id}>{g.patron}</b>
            <span>{significadoEn(g, idioma)}</span>
            <Icono n={abierta === g.patron ? 'arriba' : 'abajo'} t={14} />
          </button>
          {abierta === g.patron && <DetalleGramatica g={g} idioma={idioma} />}
        </div>
      ))}
    </div>
  );
}

/** Una frase con los trozos fijos del patrón resaltados, en orden. */
function ConPatron({ texto, trozos }: { texto: string; trozos: string[] }) {
  const partes: preact.ComponentChildren[] = [];
  let desde = 0;
  for (const t of trozos) {
    const i = texto.indexOf(t, desde);
    if (i < 0) break;
    partes.push(texto.slice(desde, i), <mark key={i}>{t}</mark>);
    desde = i + t.length;
  }
  partes.push(texto.slice(desde));
  return <>{partes}</>;
}

/** Ejemplos reales, de las frases ya vistas, y la explicación de Claude cuando se pide. */
export function DetalleGramatica({ g, idioma }: { g: GramaticaNivel; idioma: string }) {
  const [ejemplos, fijarEjemplos] = useState<FraseEjemplo[] | null>(null);
  const trozos = useMemo(() => trozosDePatron(g.patron), [g.patron]);
  const [explicar, fijarExplicar] = useState(false);
  useEffect(() => {
    motor.frasesConPatron(g.patron, 4).then(fijarEjemplos).catch(() => fijarEjemplos([]));
  }, [g.patron]);
  return (
    <div class="ap-patron-detalle">
      <div class="subtitulo-def">{tr('En lo que has visto')}</div>
      {ejemplos === null && <span class="giro" />}
      {ejemplos?.length === 0 && <p class="ayuda">{tr('Aún no ha salido en tus videos, páginas ni libros. Cuando aparezca, sus frases se verán aquí.')}</p>}
      {ejemplos?.map((e, i) => (
        <div class="ejemplo" key={i}>
          <div class="ejemplo-texto">
            <span lang={lengua.value.id}><ConPatron texto={e.texto} trozos={trozos} /></span>
            {e.fuente && <small>{e.fuente}</small>}
          </div>
        </div>
      ))}
      {explicar ? (
        <PanelFlujo
          metodo="preguntar"
          args={[{ lema: g.patron, frase: ejemplos?.[0]?.texto }, tr('Explica este punto de gramática ({0}): qué significa, cómo se forma y dos ejemplos breves con su traducción.', significadoEn(g, idioma))]}
          titulo={g.patron}
        />
      ) : (
        <button class="btn chico ia" onClick={() => fijarExplicar(true)}><Icono n="ia" t={14} /> {tr('Explicar con Claude')}</button>
      )}
    </div>
  );
}
