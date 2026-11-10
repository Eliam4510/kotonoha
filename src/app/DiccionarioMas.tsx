// Lo que el diccionario ofrece además de la palabra: la gramática que encaja con lo buscado y las categorías para explorar
// (onomatopeyas, refranes, expresiones de cuatro kanji…), cada una con sus entradas en tarjetas.

import { useEffect, useState } from 'preact/hooks';
import type { Ajustes } from '../compartido/ajustes';
import { idiomaActual, numero, tr } from '../compartido/i18n';
import { motor } from '../compartido/rpc';
import type { PuntoEncontrado } from '../compartido/tipos';
import type { EntradaBreve } from '../nucleo/explorar';
import { significadoEn } from '../nucleo/niveles';
import { Icono, type NombreIcono } from '../ui/iconos';
import { lengua } from '../ui/lengua';
import { navegar } from './estadoApp';
import { DetalleGramatica } from './Niveles';
import { Vacio } from './Piezas';
import { estiloDiccionario, TarjetaPalabra } from './TarjetaPalabra';

/** Los puntos de gramática que encajan con lo buscado; al abrir uno, sus ejemplos y su explicación. */
export function ResultadosGramatica({ puntos }: { puntos: PuntoEncontrado[] }) {
  const [abierto, fijarAbierto] = useState<string | null>(null);
  const [todos, fijarTodos] = useState(false);
  if (!puntos.length) return null;
  const idioma = idiomaActual();
  const visibles = todos ? puntos : puntos.slice(0, 5);
  return (
    <section class="ap-dic-seccion" aria-label={tr('Gramática')}>
      <h2 class="ap-seccion-titulo">{tr('Gramática')}</h2>
      <div class="ap-lista-gramatica">
        {visibles.map(({ nivel, g }) => (
          <div key={g.patron} class={`ap-patron ${abierto === g.patron ? 'abierto' : ''}`}>
            <button class="ap-patron-cab" aria-expanded={abierto === g.patron} onClick={() => fijarAbierto(abierto === g.patron ? null : g.patron)}>
              <b lang={lengua.value.id}>{g.patron} <small class="chip-nivel">{nivel}</small></b>
              <span>{significadoEn(g, idioma)}</span>
              <Icono n={abierto === g.patron ? 'arriba' : 'abajo'} t={14} />
            </button>
            {abierto === g.patron && <DetalleGramatica g={g} idioma={idioma} />}
          </div>
        ))}
      </div>
      {puntos.length > 5 && (
        <button class="btn fantasma chico ver-mas" onClick={() => fijarTodos(!todos)}>
          {todos ? tr('Ver menos') : tr('Ver {0} más', puntos.length - 5)} <Icono n={todos ? 'arriba' : 'abajo'} t={12} />
        </button>
      )}
    </section>
  );
}

/** Las categorías del diccionario para explorar, en la portada. */
export function Explorar() {
  const categorias = lengua.value.categoriasDiccionario ?? [];
  if (!categorias.length) return null;
  return (
    <section class="ap-explorar" aria-label={tr('Explorar el diccionario')}>
      <h2 class="ap-seccion-titulo">{tr('Explorar el diccionario')}</h2>
      <div class="ap-explorar-rejilla">
        {categorias.map((c) => (
          <button key={c.id} class="tarjeta ap-categoria" onClick={() => navegar(`diccionario?cat=${c.id}`)}>
            <span class="hoja-icono chica"><Icono n={c.icono as NombreIcono} t={18} /></span>
            <b>{tr(c.nombre)}</b>
            <span class="ayuda">{tr(c.descripcion)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

const POR_PAGINA = 100;

/** Una categoría del diccionario: sus entradas, de las más comunes a las menos. */
export function CategoriaDiccionario({ id, ajustes }: { id: string; ajustes: Ajustes }) {
  const c = lengua.value.categoriasDiccionario?.find((x) => x.id === id);
  const [filas, fijarFilas] = useState<EntradaBreve[] | null>(null);
  const [total, fijarTotal] = useState(0);
  const [error, fijarError] = useState('');
  const cargar = (desde: number) =>
    motor
      .categoriaDiccionario(id, desde, POR_PAGINA)
      .then((r) => {
        fijarFilas((previas) => (desde ? [...(previas ?? []), ...r.filas] : r.filas));
        fijarTotal(r.total);
      })
      .catch((e: Error) => fijarError(e.message));
  useEffect(() => {
    fijarFilas(null);
    cargar(0);
  }, [id]);
  if (!c) return <Vacio icono="buscar" titulo={tr('Sin resultados')} />;
  // Donde casi todo son frases (refranes, expresiones), las tarjetas van más anchas: partidas en dos renglones se leen
  // peor. Solo donde cada carácter ocupa un cuadro entero.
  const frases = !!filas && lengua.value.lectura.distingue && filas.filter((f) => [...f.termino].length >= 8).length * 2 > filas.length;
  return (
    <div class={`ap-lienzo ap-categoria-vista ${ajustes.diccionarioAncho === 'centrado' ? '' : 'ancho'}`} style={estiloDiccionario(ajustes)}>
      <button class="btn fantasma chico" onClick={() => navegar('diccionario')}><Icono n="atras" t={14} /> {tr('Diccionario')}</button>
      <header class="ap-cabecera">
        <div class="ap-cabecera-texto">
          <h1><Icono n={c.icono as NombreIcono} t={26} /> {tr(c.nombre)}</h1>
          <p>{tr(c.descripcion)}</p>
        </div>
      </header>
      {error && <Vacio icono="aviso" titulo={tr('Sin resultados')}><p>{error}</p></Vacio>}
      {!filas && !error && (
        <div class="ap-niveles-cargando"><span class="giro" /> {tr('Preparando el diccionario: la primera vez tarda unos segundos.')}</div>
      )}
      {filas && filas.length === 0 && <Vacio icono="buscar" titulo={tr('Sin resultados')}><p>{tr('Los diccionarios instalados no marcan ninguna entrada así.')}</p></Vacio>}
      {filas && filas.length > 0 && (
        <>
          <p class="ayuda">{tr('{0} entradas, las de uso común primero.', numero(total))}</p>
          <div class={`dic-tarjetas ${frases ? 'frases' : ''}`}>{filas.map((e) => <TarjetaPalabra key={`${e.termino}|${e.lectura}`} e={e} />)}</div>
          {total > filas.length && <div class="ap-ver-mas"><button class="btn" onClick={() => cargar(filas.length)}>{tr('Ver más ({0})', numero(total - filas.length))}</button></div>}
        </>
      )}
    </div>
  );
}
