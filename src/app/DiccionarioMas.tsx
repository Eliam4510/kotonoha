// Lo que el diccionario ofrece además de la ficha: buscar por significado, la gramática que encaja con lo buscado, los
// kanji y los homófonos de cada palabra, las palabras parecidas (con Claude) y las categorías para explorar.

import { useEffect, useState } from 'preact/hooks';
import type { Ajustes } from '../compartido/ajustes';
import { idiomaActual, numero, tr } from '../compartido/i18n';
import { motor } from '../compartido/rpc';
import type { CaracterConNivel, PuntoEncontrado, ResultadoBusqueda } from '../compartido/tipos';
import type { EntradaBreve } from '../nucleo/explorar';
import { significadoEn } from '../nucleo/niveles';
import { PanelFlujo } from '../ui/Ficha';
import { Icono, type NombreIcono } from '../ui/iconos';
import { lengua } from '../ui/lengua';
import { navegar } from './estadoApp';
import { DetalleGramatica } from './Niveles';
import { Vacio } from './Piezas';

const buscarPalabra = (t: string) => navegar(`diccionario?q=${encodeURIComponent(t)}`);

function FilaBreve({ e }: { e: EntradaBreve }) {
  return (
    <button class="ap-breve" onClick={() => buscarPalabra(e.termino)}>
      <span class="ap-breve-termino" lang={lengua.value.id}>
        <b>{e.termino}</b>
        {e.lectura !== e.termino && <small>{e.lectura}</small>}
      </span>
      <span class="ap-breve-glosa">{e.glosa}</span>
      {e.comun && <span class="ap-breve-comun" data-tip={tr('De uso común')} aria-label={tr('De uso común')}><Icono n="estrella" t={13} /></span>}
    </button>
  );
}

/** Las palabras que significan lo buscado: «perro» → 犬. */
export function ResultadosSignificado({ buscado, entradas }: { buscado: string; entradas: EntradaBreve[] }) {
  if (!entradas.length) return null;
  return (
    <section class="ap-dic-seccion" aria-label={tr('Palabras que significan «{0}»', buscado)}>
      <h2 class="ap-seccion-titulo">{tr('Palabras que significan «{0}»', buscado)}</h2>
      <div class="ap-breves">{entradas.map((e) => <FilaBreve key={`${e.termino}|${e.lectura}`} e={e} />)}</div>
    </section>
  );
}

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

/** Debajo de la ficha de una palabra del diccionario: sus kanji, las palabras que se leen igual y las parecidas. */
export function MasDeLaPalabra({ r, frase }: { r: ResultadoBusqueda; frase?: string }) {
  const listas = lengua.value.listasNivel;
  const caracteres = lengua.value.trazos?.conocidas?.caracteres(r.lema) ?? [];
  const [kanji, fijarKanji] = useState<CaracterConNivel[]>([]);
  const [homofonos, fijarHomofonos] = useState<EntradaBreve[]>([]);
  const [sinonimos, fijarSinonimos] = useState<EntradaBreve[]>([]);
  const [parecidas, fijarParecidas] = useState(false);
  useEffect(() => {
    let vivo = true;
    fijarParecidas(false);
    if (listas && caracteres.length) motor.caracteresConNivel(listas.carpeta, caracteres).then((k) => vivo && fijarKanji(k)).catch(() => {});
    else fijarKanji([]);
    if (lengua.value.lectura.distingue && r.lectura) motor.homofonos(r.lectura, r.lema).then((h) => vivo && fijarHomofonos(h)).catch(() => {});
    else fijarHomofonos([]);
    fijarSinonimos([]);
    if (lengua.value.categoriasDiccionario?.length) motor.sinonimos(r.lema, r.lectura ?? '').then((s) => vivo && fijarSinonimos(s)).catch(() => {});
    return () => {
      vivo = false;
    };
  }, [r.lema, r.lectura]);

  return (
    <div class="ap-mas-palabra">
      {kanji.length > 0 && (
        <div class="ap-mas-bloque">
          <div class="subtitulo-def">{tr(listas?.caracteres ?? '')}</div>
          <div class="ap-kanji-palabra">
            {kanji.map((k) => (
              <button key={k.caracter} class="ap-kanji-ficha" onClick={() => buscarPalabra(k.caracter)} aria-label={`${k.caracter}: ${k.glosa}`}>
                <b lang={lengua.value.id}>{k.caracter}</b>
                <span>
                  {k.nivel && <small class="chip-nivel">{k.nivel}</small>}
                  <em>{k.glosa || tr('Fuera de las listas')}</em>
                  {(k.on || k.kun) && <small lang={lengua.value.id}>{[k.on, k.kun].filter(Boolean).join(' · ')}</small>}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      {sinonimos.length > 0 && (
        <div class="ap-mas-bloque">
          <div class="subtitulo-def">{tr('Significan lo mismo')}</div>
          <div class="ap-sinonimos">
            {sinonimos.map((s) => (
              <button key={`${s.termino}|${s.lectura}`} class={`chip ${s.comun ? 'comun' : ''}`} lang={lengua.value.id} data-tip={[s.lectura !== s.termino ? s.lectura : '', s.glosa].filter(Boolean).join(' · ')} onClick={() => buscarPalabra(s.termino)}>
                {s.termino}
              </button>
            ))}
          </div>
        </div>
      )}
      {homofonos.length > 0 && (
        <div class="ap-mas-bloque">
          <div class="subtitulo-def">{tr('Se leen igual')}</div>
          <div class="ap-homofonos">
            {homofonos.map((h) => (
              <button key={h.termino} class={`chip ${h.comun ? 'comun' : ''}`} lang={lengua.value.id} data-tip={h.glosa} onClick={() => buscarPalabra(h.termino)}>
                {h.termino}
              </button>
            ))}
          </div>
        </div>
      )}
      <div class="ap-mas-bloque">
        {parecidas ? (
          <PanelFlujo
            metodo="preguntar"
            args={[{ lema: r.lema, lectura: r.lectura, frase: frase || undefined }, tr('¿Qué palabras parecidas a «{0}» hay, y en qué se diferencian? Da tres o cuatro, con un ejemplo breve de cada una.', r.lema)]}
            titulo={tr('Palabras parecidas')}
          />
        ) : (
          <button class="btn chico ia" onClick={() => fijarParecidas(true)}><Icono n="ia" t={14} /> {tr('Palabras parecidas y en qué se diferencian')}</button>
        )}
      </div>
    </div>
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
            <span class="ayuda" lang={lengua.value.id === 'ja' ? undefined : undefined}>{tr(c.descripcion)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

const POR_PAGINA = 100;

/** Una categoría del diccionario: sus entradas, de las más comunes a las menos. */
export function CategoriaDiccionario({ id, ajustes: _ }: { id: string; ajustes: Ajustes }) {
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
  return (
    <div class="ap-lienzo ap-categoria-vista">
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
          <div class="ap-breves">{filas.map((e) => <FilaBreve key={`${e.termino}|${e.lectura}`} e={e} />)}</div>
          {total > filas.length && <div class="ap-ver-mas"><button class="btn" onClick={() => cargar(filas.length)}>{tr('Ver más ({0})', numero(total - filas.length))}</button></div>}
        </>
      )}
    </div>
  );
}
