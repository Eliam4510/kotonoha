// Las voces de AivisHub dentro de Kotonoha, en Ajustes: instalarlas (la primera vez, con lo que todas comparten), elegir
// voz y estilo, y el catálogo de AivisHub para añadir más, con la licencia de cada una a la vista. Y el aviso de Inicio
// para quien usaba el programa AivisSpeech.

import { useEffect, useRef, useState } from 'preact/hooks';
import { type Ajustes, guardarAjustes } from '../compartido/ajustes';
import type { EstadoVocesIntegradas, FiltrosCatalogo, PaginaCatalogo, VozCatalogo } from '../compartido/api';
import { numero, tm, tr } from '../compartido/i18n';
import { alRecibirEvento, motor } from '../compartido/rpc';
import type { ProgresoInstalacion } from '../compartido/tipos';
import { Icono } from '../ui/iconos';
import { lengua } from '../ui/lengua';
import { navegar } from './estadoApp';
import { BotonBorrar, Interruptor, Opcion, textoTamano } from './Piezas';

/** Lo que pesa, más o menos: lo que comparten todas (el BERT y el diccionario) y una voz. */
const MB_BASE = 660;
const MB_VOZ = 255;

const TIMBRES: Record<string, string> = {
  YoungFemale: tm('Niña'),
  YoungMale: tm('Niño'),
  YouthfulFemale: tm('Chica joven'),
  YouthfulMale: tm('Chico joven'),
  AdultFemale: tm('Mujer adulta'),
  AdultMale: tm('Hombre adulto'),
  MiddleAgedFemale: tm('Mujer madura'),
  MiddleAgedMale: tm('Hombre maduro'),
  ElderlyFemale: tm('Mujer mayor'),
  ElderlyMale: tm('Hombre mayor'),
  Neutral: tm('Neutra'),
  Baby: tm('Bebé'),
  Mechanical: tm('Robótica'),
  Other: tm('Otra'),
};

/** Cada licencia, como se nombra en la tarjeta y como se explica en el filtro. */
const LICENCIAS: Record<string, { corta: string; larga: string }> = {
  'ACML 1.0': { corta: 'ACML', larga: tm('ACML: libre, con o sin fines comerciales') },
  'ACML-NC 1.0': { corta: 'ACML-NC', larga: tm('ACML-NC: solo sin fines comerciales') },
  CC0: { corta: 'CC0', larga: tm('CC0: dominio público') },
  Custom: { corta: tm('Propia'), larga: tm('Propia: hay que leerla') },
};

const ORDENES: { id: NonNullable<FiltrosCatalogo['orden']>; nombre: string }[] = [
  { id: 'download', nombre: tm('Más descargadas') },
  { id: 'like', nombre: tm('Más queridas') },
  { id: 'recent', nombre: tm('Más recientes') },
];

type Cambiar = (c: Partial<Ajustes> | ((x: Ajustes) => Partial<Ajustes>)) => void;

/** Lo que va en Ajustes, en Voces, para la lengua que tenga voces integradas. */
export function VocesIntegradas({ a, cambiar }: { a: Ajustes; cambiar: Cambiar }) {
  const oferta = lengua.value.vocesIntegradas;
  const [progreso, fijarProgreso] = useState<Record<string, ProgresoInstalacion>>({});
  const [estado, fijarEstado] = useState<EstadoVocesIntegradas | null>(null);
  const [probando, fijarProbando] = useState(false);
  const [error, fijarError] = useState('');
  const [catalogo, fijarCatalogo] = useState(false);
  const releer = () => motor.estadoVoces().then(fijarEstado).catch(() => {});
  useEffect(() => {
    releer();
    return alRecibirEvento((e) => {
      if (e.tipo !== 'instalacion' || !e.progreso.id.startsWith('voz-')) return;
      fijarProgreso((p) => ({ ...p, [e.progreso.id]: e.progreso }));
      if (e.progreso.fase === 'listo') releer();
    });
  }, []);
  if (!oferta) return null;

  const instaladas = a.vozIntegrada.instaladas;
  const instalar = (uuid: string) => {
    fijarError('');
    motor.instalarVoz(uuid).then(releer, (e: unknown) => fijarError(e instanceof Error ? e.message : String(e)));
  };
  const borrar = (uuid: string) => motor.borrarVoz(uuid).then(releer);
  const enCurso = Object.values(progreso).find((p) => p.fase === 'descargando');
  const faltaBase = estado && instaladas.length > 0 && !estado.base.instalada;
  const ejemplo = lengua.value.ejemplos.texto.split(lengua.value.escritura.frase.partir).find((f) => f.trim()) ?? lengua.value.ejemplos.palabra;
  const probar = async () => {
    fijarProbando(true);
    fijarError('');
    try {
      await new Audio(`data:audio/mpeg;base64,${await motor.vozFrase(ejemplo, a.vocesFrase[0])}`).play();
    } catch (e) {
      fijarError(e instanceof Error ? e.message : String(e));
    } finally {
      fijarProbando(false);
    }
  };
  const opciones = instaladas.flatMap((v) =>
    v.hablantes.flatMap((h) =>
      h.estilos.map((e) => ({ valor: `${v.uuid}|${h.id}|${e.id}`, nombre: v.hablantes.length > 1 ? `${v.nombre} (${h.nombre}) · ${e.nombre}` : `${v.nombre} · ${e.nombre}` }))
    )
  );
  const elegida = `${a.vozIntegrada.voz}|${a.vozIntegrada.hablante}|${a.vozIntegrada.estilo}`;

  return (
    <>
      <div class="ap-opcion ap-voces-integradas">
        <div class="ap-opcion-texto">
          <b>{tr('Voces neuronales de AivisHub')}</b>
          <span>
            {instaladas.length
              ? tr('Las voces de AivisSpeech, en tu equipo y sin programas aparte. La primera frase tarda unos segundos; las siguientes, casi nada, y quedan guardadas.')
              : tr('Las voces de AivisSpeech, en tu equipo y sin programas aparte. La primera vez se descargan unos {0} con {1}; cada voz más, unos {2}.', textoTamano(MB_BASE + MB_VOZ), oferta.nombreInicial, textoTamano(MB_VOZ))}
          </span>
          {enCurso && <Descargando p={enCurso} />}
          {faltaBase && (
            <span class="ap-texto-error">
              {tr('Faltan archivos que comparten todas las voces.')} <button class="enlace" onClick={() => instalar(instaladas[0].uuid)}>{tr('Volver a instalarlos')}</button>
            </span>
          )}
          {error && <span class="texto-error">{error}</span>}
        </div>
        <div class="ap-opcion-control">
          {instaladas.length > 0 && <Interruptor etiqueta={tr('Leer las frases con la voz neuronal')} on={a.vozIntegrada.activa} alCambiar={(v) => cambiar((x) => ({ vozIntegrada: { ...x.vozIntegrada, activa: v } }))} />}
          {!instaladas.length && (
            <button class="btn chico primario" disabled={!!enCurso} onClick={() => instalar(oferta.inicial)}><Icono n="descargar" t={14} /> {tr('Instalar las voces')}</button>
          )}
          {instaladas.length > 0 && (
            <button class="btn chico fantasma" aria-label={tr('Probar la voz neuronal')} disabled={!a.vozIntegrada.activa || probando} onClick={() => void probar()}><Icono n="reproducir" t={14} /> {probando ? tr('Preparando…') : tr('Probar')}</button>
          )}
        </div>
      </div>
      {instaladas.length > 0 && (
        <Opcion titulo={tr('Voz y estilo')}>
          <select
            class="campo ap-campo-medio"
            aria-label={tr('Voz y estilo')}
            value={elegida}
            onChange={(e) => {
              const [voz, hablante, estilo] = e.currentTarget.value.split('|');
              cambiar((x) => ({ vozIntegrada: { ...x.vozIntegrada, voz, hablante: Number(hablante), estilo: Number(estilo) } }));
            }}
          >
            {opciones.map((o) => (
              <option key={o.valor} value={o.valor}>{o.nombre}</option>
            ))}
          </select>
        </Opcion>
      )}
      <Opcion titulo={tr('Más voces')} ayuda={tr('El catálogo de AivisHub: niñas, adultos, voces mayores… Cada una dice su licencia, y puedes oírla antes de instalarla.')}>
        <button class="btn chico" aria-expanded={catalogo} onClick={() => fijarCatalogo(!catalogo)}><Icono n="buscar" t={14} /> {catalogo ? tr('Cerrar el catálogo') : tr('Ver el catálogo')}</button>
      </Opcion>
      {catalogo && <CatalogoVoces instaladas={new Set(instaladas.map((v) => v.uuid))} progreso={progreso} alInstalar={instalar} alBorrar={borrar} />}
    </>
  );
}

function Descargando({ p }: { p: ProgresoInstalacion }) {
  return (
    <div class="ap-instalando">
      <div class="barra-progreso"><div style={{ width: `${p.avance * 100}%` }} /></div>
      <span class="num">{tr('Descargando')} {Math.round(p.avance * 100)} %</span>
    </div>
  );
}

function CatalogoVoces({ instaladas, progreso, alInstalar, alBorrar }: { instaladas: Set<string>; progreso: Record<string, ProgresoInstalacion>; alInstalar: (uuid: string) => void; alBorrar: (uuid: string) => Promise<void> }) {
  const [filtros, fijarFiltros] = useState<FiltrosCatalogo>({ orden: 'download', pagina: 1 });
  const [texto, fijarTexto] = useState('');
  const [pagina, fijarPagina] = useState<PaginaCatalogo | null>(null);
  const [cargando, fijarCargando] = useState(true);
  const [error, fijarError] = useState('');
  const [sonando, fijarSonando] = useState<string | null>(null);
  const [licencias, fijarLicencias] = useState<Record<string, string>>({});
  const audio = useRef<HTMLAudioElement | null>(null);
  // Solo vale la última búsqueda: una anterior puede contestar después.
  const peticion = useRef(0);
  useEffect(() => {
    const esta = ++peticion.current;
    fijarCargando(true);
    fijarError('');
    motor
      .catalogoVoces(filtros)
      .then((p) => esta === peticion.current && fijarPagina(p))
      .catch((e: unknown) => esta === peticion.current && fijarError(e instanceof Error ? e.message : String(e)))
      .finally(() => esta === peticion.current && fijarCargando(false));
  }, [filtros]);
  useEffect(() => {
    const t = setTimeout(() => fijarFiltros((f) => (f.texto === texto ? f : { ...f, texto, pagina: 1 })), 400);
    return () => clearTimeout(t);
  }, [texto]);
  useEffect(() => () => audio.current?.pause(), []);

  const oir = (url: string) => {
    audio.current?.pause();
    if (sonando === url) {
      fijarSonando(null);
      return;
    }
    const a = new Audio(url);
    audio.current = a;
    fijarSonando(url);
    a.onended = () => fijarSonando(null);
    a.play().catch(() => fijarSonando(null));
  };
  const leerLicencia = (uuid: string) => {
    motor.licenciaVoz(uuid).then(
      (t) => fijarLicencias((l) => ({ ...l, [uuid]: t })),
      (e: unknown) => fijarError(e instanceof Error ? e.message : String(e))
    );
  };
  const filtro = (cambio: Partial<FiltrosCatalogo>) => fijarFiltros((f) => ({ ...f, ...cambio, pagina: 1 }));

  return (
    <div class="ap-catalogo" aria-label={tr('Catálogo de voces de AivisHub')}>
      <div class="ap-catalogo-filtros">
        <input class="campo" type="search" placeholder={tr('Buscar voces')} aria-label={tr('Buscar voces')} value={texto} onInput={(e) => fijarTexto(e.currentTarget.value)} />
        <select class="campo" aria-label={tr('Timbre')} value={filtros.timbre ?? ''} onChange={(e) => filtro({ timbre: e.currentTarget.value || undefined })}>
          <option value="">{tr('Todos los timbres')}</option>
          {Object.entries(TIMBRES).map(([id, n]) => (
            <option key={id} value={id}>{tr(n)}</option>
          ))}
        </select>
        <select class="campo" aria-label={tr('Licencia')} value={filtros.licencia ?? ''} onChange={(e) => filtro({ licencia: e.currentTarget.value || undefined })}>
          <option value="">{tr('Todas las licencias')}</option>
          {Object.entries(LICENCIAS).map(([id, l]) => (
            <option key={id} value={id}>{tr(l.larga)}</option>
          ))}
        </select>
        <select class="campo" aria-label={tr('Orden')} value={filtros.orden} onChange={(e) => filtro({ orden: e.currentTarget.value as FiltrosCatalogo['orden'] })}>
          {ORDENES.map((o) => (
            <option key={o.id} value={o.id}>{tr(o.nombre)}</option>
          ))}
        </select>
      </div>
      {error && <span class="ap-texto-error">{error}</span>}
      <div class="ap-catalogo-lista" aria-busy={cargando}>
        {pagina?.voces.map((v) => (
          <TarjetaVoz
            key={v.uuid}
            v={v}
            instalada={instaladas.has(v.uuid)}
            progreso={progreso[`voz-${v.uuid}`]}
            licencia={licencias[v.uuid]}
            sonando={sonando}
            alOir={oir}
            alLeerLicencia={() => leerLicencia(v.uuid)}
            alInstalar={() => alInstalar(v.uuid)}
            alBorrar={() => alBorrar(v.uuid)}
          />
        ))}
        {pagina && !pagina.voces.length && !cargando && <p class="ayuda">{tr('Ninguna voz con estos filtros.')}</p>}
      </div>
      {pagina && pagina.paginas > 1 && (
        <div class="ap-catalogo-paginas">
          <button class="btn chico fantasma" disabled={pagina.pagina <= 1 || cargando} onClick={() => fijarFiltros((f) => ({ ...f, pagina: pagina.pagina - 1 }))}><Icono n="anterior" t={14} /> {tr('Anterior')}</button>
          <span class="num">{tr('{0} de {1}', numero(pagina.pagina), numero(pagina.paginas))}</span>
          <button class="btn chico fantasma" disabled={pagina.pagina >= pagina.paginas || cargando} onClick={() => fijarFiltros((f) => ({ ...f, pagina: pagina.pagina + 1 }))}>{tr('Siguiente')} <Icono n="siguiente" t={14} /></button>
        </div>
      )}
    </div>
  );
}

function TarjetaVoz(p: {
  v: VozCatalogo;
  instalada: boolean;
  progreso?: ProgresoInstalacion;
  licencia?: string;
  sonando: string | null;
  alOir: (url: string) => void;
  alLeerLicencia: () => void;
  alInstalar: () => void;
  alBorrar: () => Promise<void>;
}) {
  const { v } = p;
  const [h] = v.hablantes;
  const muestra = h?.estilos.flatMap((e) => e.muestras)[0];
  const estilos = v.hablantes.reduce((n, x) => n + x.estilos.length, 0);
  const licencia = LICENCIAS[v.licencia];
  const propia = v.licencia === 'Custom';
  const descargando = p.progreso?.fase === 'descargando';
  return (
    <article class="ap-catalogo-voz">
      {h?.icono ? <img class="ap-catalogo-icono" src={h.icono} alt="" loading="lazy" /> : <span class="ap-catalogo-icono"><Icono n="voz" t={22} /></span>}
      <div class="ap-catalogo-texto">
        <b lang={lengua.value.id}>{v.nombre}</b>
        <span class="ayuda">{v.autor}</span>
        <span class="ap-catalogo-datos">
          {tr(TIMBRES[v.timbre] ?? TIMBRES.Other)} · {estilos === 1 ? tr('1 estilo') : tr('{0} estilos', numero(estilos))} · {textoTamano(v.bytes / 1e6)} · <span class={`ap-catalogo-licencia-tipo ${propia ? 'propia' : ''}`} title={licencia ? tr(licencia.larga) : v.licencia}>{licencia ? tr(licencia.corta) : v.licencia}</span>
        </span>
        {muestra && <span class="ap-catalogo-muestra" lang={lengua.value.id}>{muestra.texto}</span>}
        {p.licencia !== undefined && (
          <details class="ap-catalogo-licencia" open>
            <summary>{tr('Licencia')}</summary>
            <pre lang={lengua.value.id}>{p.licencia}</pre>
          </details>
        )}
        {p.progreso?.fase === 'error' && <span class="ap-texto-error">{p.progreso.error}</span>}
        {descargando && <Descargando p={p.progreso!} />}
      </div>
      <div class="ap-catalogo-acciones">
        {muestra && (
          <button class="btn-icono chico" aria-label={tr('Oír una muestra de {0}', v.nombre)} aria-pressed={p.sonando === muestra.url} onClick={() => p.alOir(muestra.url)}>
            <Icono n={p.sonando === muestra.url ? 'pausa' : 'reproducir'} t={14} />
          </button>
        )}
        {p.instalada ? (
          <>
            <span class="ap-catalogo-instalada"><Icono n="check" t={14} /> {tr('Instalada')}</span>
            <BotonBorrar etiqueta={`${tr('Borrar')}: ${v.nombre}`} texto={tr('Borrar')} alBorrar={p.alBorrar} />
          </>
        ) : propia && p.licencia === undefined ? (
          <button class="btn chico" onClick={p.alLeerLicencia}>{tr('Leer la licencia')}</button>
        ) : (
          <button class="btn chico" disabled={descargando} onClick={p.alInstalar}><Icono n="descargar" t={14} /> {tr('Instalar')}</button>
        )}
      </div>
    </article>
  );
}

/** El aviso de Inicio para quien leía con el programa AivisSpeech: una vez, hasta que lo cierre o mire las voces. */
export function AvisoVoces() {
  const cerrar = () => guardarAjustes({ avisoVocesVisto: true }).catch(console.error);
  return (
    <section class="tarjeta ap-aviso-voces ap-c12" aria-label={tr('Voces neuronales de AivisHub')}>
      <span class="ap-aviso-version-icono"><Icono n="voz" t={20} /></span>
      <div class="ap-aviso-version-texto">
        <b>{tr('Nuevo: las voces de AivisSpeech, dentro de Kotonoha')}</b>
        <span>{tr('Ya no hace falta tener AivisSpeech abierto: instala sus voces en Kotonoha y se oyen sin programas aparte.')}</span>
      </div>
      <button
        class="btn primario chico"
        onClick={() => {
          cerrar();
          navegar('ajustes?seccion=voces');
        }}
      >
        {tr('Ver las voces')}
      </button>
      <button class="btn-icono chico" aria-label={tr('Cerrar')} onClick={cerrar}>
        <Icono n="cerrar" t={15} />
      </button>
    </section>
  );
}
