// La página del diccionario. Usa todo el ancho: la lista de resultados a un lado, la palabra elegida en el centro, con
// las frases donde la has visto y el minuto de cada una, y en otra columna lo que la rodea (sus kanji, sus opuestos, las
// que significan lo mismo, las que se leen igual). Un carácter suelto tiene su propia página: sus lecturas, sus piezas,
// las palabras que lo llevan y dónde lo has visto. Con poco ancho, todo queda en una columna.

import { useEffect, useState } from 'preact/hooks';
import { type Ajustes, guardarAjustes, TAMANO_DICCIONARIO } from '../compartido/ajustes';
import { idiomaActual, numero, tr } from '../compartido/i18n';
import { motor } from '../compartido/rpc';
import type { CaracterBreve, CaracterConNivel, PuntoEncontrado, ResultadoBusqueda } from '../compartido/tipos';
import type { EntradaBreve } from '../nucleo/explorar';
import { enviarAlCreador } from '../ui/borrador';
import { Ficha, PanelFlujo } from '../ui/Ficha';
import { Icono } from '../ui/iconos';
import { lecturaDeTarjeta, lengua } from '../ui/lengua';
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
  const [busqueda, fijarBusqueda] = useState<Busqueda | null>(null);
  const [elegida, fijarElegida] = useState(0);
  const [comoPalabra, fijarComoPalabra] = useState(false);
  const [cargando, fijarCargando] = useState(false);
  const [preparando, fijarPreparando] = useState(false);
  const [recientes, fijarRecientes] = useState<string[]>(() => leerPreferencia('busquedas', []));
  const [hayDics, fijarHayDics] = useState(true);

  const buscar = async (limpio: string) => {
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
      const { candidatos, porSignificado } = juntar(limpio, lista, libres, sentido);
      fijarBusqueda({ texto: limpio, candidatos, porSignificado, gramatica: puntos, caracter, caracterEsPalabra: !!caracter && libres.some((r) => r.lema === caracter && r.entradas.length > 0) });
      fijarElegida(0);
      fijarComoPalabra(false);
      const nuevas = [limpio, ...recientes.filter((x) => x !== limpio)].slice(0, 8);
      fijarRecientes(nuevas);
      guardarPreferencia('busquedas', nuevas);
    } finally {
      fijarCargando(false);
      fijarPreparando(false);
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
    if (consulta) buscar(consulta);
    else fijarBusqueda(null);
  }, [consulta]);

  const paquete = lengua.value;
  const inicial = busqueda === null && !cargando;
  const atajos = recientes.length ? recientes : paquete.ejemplos.sugerencias;
  const estilo = estiloDiccionario(ajustes);
  const c = busqueda?.candidatos[elegida];
  const verCaracter = !!busqueda?.caracter && !comoPalabra;
  const nada = !!busqueda && !busqueda.caracter && !busqueda.candidatos.length && !busqueda.gramatica.length;

  return (
    <div class={`dic ${ajustes.diccionarioAncho === 'centrado' ? 'centrado' : ''} ${inicial ? 'inicial' : ''}`} style={estilo}>
      {inicial && (
        <div class="ap-dic-portada">
          <span class="hoja-icono"><Icono n="diccionario" t={24} /></span>
          <h1>{tr('¿Qué palabra buscas?')}</h1>
          <p>{tr(paquete.textos.buscarAyuda)}</p>
        </div>
      )}
      <div class="dic-barra">
        <div class="dic-barra-busqueda">
          <form class="ap-buscador" role="search" onSubmit={(e) => { e.preventDefault(); pedir(texto); }}>
            <Icono n="buscar" t={20} />
            <input lang={paquete.id} aria-label={tr('Buscar en el diccionario')} placeholder={paquete.ejemplos.busqueda} value={texto} onInput={(e) => fijarTexto(e.currentTarget.value)} autoFocus />
            <button class="btn primario" type="submit" disabled={!texto.trim() || cargando}>{cargando ? tr('Buscando…') : tr('Buscar')}</button>
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

      {busqueda?.caracter && busqueda.caracterEsPalabra && (
        <div class="segmentado dic-vista" role="radiogroup" aria-label={tr('Ver como')}>
          <button role="radio" aria-checked={!comoPalabra} class={!comoPalabra ? 'activo' : ''} onClick={() => fijarComoPalabra(false)}>
            <span lang={paquete.id}>{busqueda.caracter}</span> {tr(paquete.paginaCaracter!.nombre)}
          </button>
          <button role="radio" aria-checked={comoPalabra} class={comoPalabra ? 'activo' : ''} onClick={() => fijarComoPalabra(true)}>
            <span lang={paquete.id}>{busqueda.caracter}</span> {tr('Palabra')}
          </button>
        </div>
      )}

      {busqueda && verCaracter && <PaginaCaracter key={busqueda.caracter} caracter={busqueda.caracter!} ajustes={ajustes} />}

      {busqueda && !verCaracter && (comoPalabra ? busqueda.caracter : c) && (
        <div class={`dic-cuerpo ${busqueda.candidatos.length > 1 && !comoPalabra ? 'con-lista' : ''}`}>
          {busqueda.candidatos.length > 1 && !comoPalabra && (
            <ListaResultados
              titulo={busqueda.porSignificado ? tr('Palabras que significan «{0}»', busqueda.texto) : tr('Resultados')}
              candidatos={busqueda.candidatos}
              elegida={elegida}
              alElegir={fijarElegida}
            />
          )}
          {comoPalabra ? (
            <PalabraEnPagina key={`caracter|${busqueda.caracter}`} termino={busqueda.caracter!} ajustes={ajustes} frase={frase} />
          ) : (
            <PalabraEnPagina key={`${c!.termino}|${c!.lectura}`} termino={c!.termino} lectura={c!.lectura} ajustes={ajustes} frase={frase} />
          )}
        </div>
      )}

      {busqueda && !cargando && <div class="dic-gramatica"><ResultadosGramatica key={busqueda.texto} puntos={busqueda.gramatica} /></div>}

      {nada && !cargando && (
        <Vacio icono="buscar" titulo={hayDics ? tr('Sin resultados') : tr('Aún no hay diccionarios')}>
          <p>{hayDics ? tr('No hay nada para «{0}». Comprueba la escritura o busca solo la raíz de la palabra.', busqueda.texto) : tr('Instálalos en Ajustes para poder buscar.')}</p>
          {!hayDics && <button class="btn primario" onClick={() => navegar('ajustes')}>{tr('Ir a Ajustes')}</button>}
        </Vacio>
      )}
    </div>
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

function ListaResultados({ titulo, candidatos, elegida, alElegir }: { titulo: string; candidatos: PalabraBreve[]; elegida: number; alElegir: (i: number) => void }) {
  return (
    <nav class="dic-lista" aria-label={titulo}>
      <h2 class="dic-lista-titulo">
        <span>{titulo}</span>
        <span class="dic-cuenta num">{numero(candidatos.length)}</span>
      </h2>
      <div class="dic-lista-items">
        {candidatos.map((c, i) => <TarjetaPalabra key={`${c.termino}|${c.lectura}`} e={c} activa={i === elegida} alElegir={() => alElegir(i)} />)}
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

/** Lo que rodea a una palabra: sus kanji, sus opuestos, las que significan lo mismo, las que hay que ver y las que se leen igual. */
function Lateral({ r, frase }: { r: ResultadoBusqueda | null; frase: string }) {
  const paquete = lengua.value;
  const listas = paquete.listasNivel;
  const [kanji, fijarKanji] = useState<CaracterConNivel[]>([]);
  const [breves, fijarBreves] = useState<Map<string, CaracterBreve>>(new Map());
  const [opuestos, fijarOpuestos] = useState<EntradaBreve[]>([]);
  const [ver, fijarVer] = useState<EntradaBreve[]>([]);
  const [sinonimos, fijarSinonimos] = useState<EntradaBreve[] | null>(null);
  const [homofonos, fijarHomofonos] = useState<EntradaBreve[]>([]);
  const [parecidas, fijarParecidas] = useState(false);

  useEffect(() => {
    if (!r) return;
    let vivo = true;
    fijarParecidas(false);
    fijarKanji([]);
    fijarOpuestos([]);
    fijarVer([]);
    fijarSinonimos(null);
    fijarHomofonos([]);
    const caracteres = paquete.trazos?.conocidas?.caracteres(r.lema) ?? [];
    if (listas && caracteres.length) motor.caracteresConNivel(listas.carpeta, caracteres).then((k) => vivo && fijarKanji(k)).catch(() => {});
    // Con el diccionario de caracteres, lo que significan en el idioma de la interfaz; las listas solo lo traen en inglés.
    if (caracteres.length) motor.caracteresBreves(caracteres).then((xs) => vivo && fijarBreves(new Map(xs.map((x) => [x.caracter, x])))).catch(() => {});
    const refs = referenciasDe(r);
    const op = refs.filter((x) => x.tipo === 'opuesto');
    const vs = refs.filter((x) => x.tipo === 'ver');
    if (op.length) motor.entradasDe(op).then((x) => vivo && fijarOpuestos(x)).catch(() => {});
    if (vs.length) motor.entradasDe(vs).then((x) => vivo && fijarVer(x)).catch(() => {});
    if (paquete.categoriasDiccionario?.length) motor.sinonimos(r.lema, r.lectura ?? '').then((s) => vivo && fijarSinonimos(s)).catch(() => vivo && fijarSinonimos([]));
    else fijarSinonimos([]);
    if (paquete.lectura.distingue && r.lectura) motor.homofonos(r.lectura, r.lema).then((h) => vivo && fijarHomofonos(h)).catch(() => {});
    return () => {
      vivo = false;
    };
  }, [r?.lema, r?.lectura]);

  if (!r) return <aside class="dic-lateral" aria-busy="true" />;
  return (
    <aside class="dic-lateral" aria-label={tr('Relacionadas')}>
      {kanji.length > 0 && (
        <section class="dic-seccion" aria-label={tr(listas?.caracteres ?? '')}>
          <h3 class="dic-seccion-titulo">{tr(listas?.caracteres ?? '')}</h3>
          <div class="dic-caracteres">
            {kanji.map((k) => {
              const b = breves.get(k.caracter);
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
      <SeccionTarjetas titulo={tr('Opuestos')} xs={opuestos} />
      <SeccionTarjetas titulo={tr('Significan lo mismo')} xs={sinonimos} cargando={sinonimos === null} />
      <SeccionTarjetas titulo={tr('Ver también')} xs={ver} />
      <SeccionTarjetas titulo={tr('Se leen igual')} xs={homofonos} />
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
