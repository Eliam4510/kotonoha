// Ficha de una palabra: significado en la frase, definiciones, estado, audio, imágenes, IA y enlaces.
// Se usa en la ventana emergente sobre el video, en el lector y en el diccionario de la app.

import { Fragment } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { type Ajustes, hayVozSintetica, type PestanaDiccionario, vozLocalActiva, vozNeuronalActiva } from '../compartido/ajustes';
import { type FlujoCancelable, flujoMotor, fondo, motor } from '../compartido/rpc';
import type { ContextoIA, EstadoPalabra, FraseEjemplo, ResultadoAudio, ResultadoBusqueda, ResultadoImagen, SentidoEnContexto } from '../compartido/tipos';
import { NOMBRES_USO } from '../nucleo/analisisProfundo';
import { claveDeVideo, momentoLegible } from '../nucleo/momento';
import type { PuntoGramatica } from '../lenguas/tipos';
import { enviarAlCreador } from './borrador';
import { useEsperar } from './preparacion';
import { type Compartida, compartir, PanelCompartir } from './Compartir';
import { Icono, type NombreIcono } from './iconos';
import { formatoLectura, lengua } from './lengua';
import { numero, tm, tr } from '../compartido/i18n';
import { PanelTrazos } from './Trazos';
import { type DatosTarjeta, type EstiloTarjeta, primerPunto, resolverLetra } from './tarjeta';
import { BotonesEstadoGramatica, BotonOpcionMultiple, VistoEn } from './EstadoGramatica';
import { estadoGramatica } from './gramatica';
import { type Paleta, paletaDe } from './paletas';
import { decirConNavegador } from './vozNavegador';

export const NOMBRE_ESTADO: Record<EstadoPalabra, string> = {
  desconocida: tm('Desconocida'),
  aprendiendo: tm('Aprendiendo'),
  conocida: tm('Conocida'),
  ignorada: tm('Ignorada'),
};

/**
 * Coloca una ventana junto a una palabra: nace de la palabra como un globo, con su esquina viva
 * apuntándole, y crece hacia donde haya sitio sin tapar nunca la línea que se está leyendo.
 */
export function colocarJunto(ancla: { left: number; top: number; width: number; height: number }, ancho: number, limiteDerecho = innerWidth, altoMaximo = 560) {
  const margen = 12;
  const separacion = 10;
  const centro = ancla.left + ancla.width / 2;
  const haciaDerecha = centro - 22 + ancho <= limiteDerecho - margen;
  const espacioArriba = ancla.top - separacion - margen;
  const espacioAbajo = innerHeight - (ancla.top + ancla.height) - separacion - margen;
  const arriba = espacioArriba >= 320 || espacioArriba >= espacioAbajo;
  const estilo: Record<string, string> = {};
  if (haciaDerecha) estilo.left = `${Math.max(margen, centro - 22)}px`;
  else estilo.right = `${Math.max(margen, innerWidth - Math.min(limiteDerecho - margen, centro + 22))}px`;
  if (arriba) estilo.bottom = `${innerHeight - ancla.top + separacion}px`;
  else estilo.top = `${ancla.top + ancla.height + separacion}px`;
  const maxAlto = Math.max(200, Math.min(arriba ? espacioArriba : espacioAbajo, altoMaximo));
  estilo.maxHeight = `${maxAlto}px`;
  return { estilo, clase: `${arriba ? 'nace-abajo' : 'nace-arriba'} ${haciaDerecha ? 'nace-izq' : 'nace-der'}`, arriba, haciaDerecha };
}

/** Lo más corto que puede ser una palabra para que el renglón se parta delante de ella. */
const LARGO_PARA_PARTIR = 3;
const separadores = new Map<string, Intl.Segmenter | null>();

/**
 * Un tramo sin lectura, en los trozos entre los que se puede partir el renglón: delante de cada palabra de cierto
 * largo, según el navegador. Las cortas (partículas, terminaciones) se quedan con la de antes, y la primera, con lo
 * que venga delante, que es de quien cuelga.
 */
function trozosPartibles(texto: string, idioma: string): string[] {
  if (!separadores.has(idioma)) {
    let s: Intl.Segmenter | null = null;
    try {
      s = new Intl.Segmenter(idioma, { granularity: 'word' });
    } catch {
      // Sin separador de palabras, el tramo va entero.
    }
    separadores.set(idioma, s);
  }
  const separador = separadores.get(idioma);
  if (!separador) return [texto];
  const trozos: string[] = [];
  for (const { segment } of separador.segment(texto)) {
    if (trozos.length && [...segment].length >= LARGO_PARA_PARTIR) trozos.push(segment);
    else if (trozos.length) trozos[trozos.length - 1] += segment;
    else trozos.push(segment);
  }
  return trozos;
}

/**
 * Lo escrito con su lectura encima. Con `partible`, deja partir el renglón solo entre palabras: antes de un tramo con
 * lectura que siga a uno sin ella (donde acaba una palabra con su terminación y empieza la siguiente) y, dentro de un
 * tramo sin lectura, delante de sus palabras largas. El navegador sabe partir una frase entre palabras, pero con las
 * lecturas en medio se pierde y deja sílabas sueltas.
 */
export function ConFurigana({ texto, lectura, partible }: { texto: string; lectura?: string; partible?: boolean }) {
  if (!lectura) return <>{texto}</>;
  const seg = lengua.value.lectura.segmentar(texto, lectura);
  return (
    <>
      {seg.map((s, i) =>
        s.lectura ? (
          <Fragment key={i}>
            {partible && i > 0 && !seg[i - 1].lectura && <wbr />}
            <ruby>
              {s.texto}
              <rt>{lengua.value.lectura.visible(s.lectura, formatoLectura.value)}</rt>
            </ruby>
          </Fragment>
        ) : (
          <span key={i}>{partible ? trozosPartibles(s.texto, lengua.value.id).map((t, k) => <Fragment key={k}>{k > 0 && <wbr />}{t}</Fragment>) : s.texto}</span>
        )
      )}
    </>
  );
}

/** Curva tonal sobre cada mora, con un punto hueco para la partícula siguiente. */
export function CurvaAcento({ lectura, posicion }: { lectura: string; posicion: number }) {
  const moras = lengua.value.acento?.moras?.(lectura) ?? [];
  const paso = 17;
  const inicio = 7;
  const alta = 5;
  const baja = 16;
  const esBaja = moras.map((_, i) => {
    if (posicion === 0) return i === 0;
    if (posicion === 1) return i !== 0;
    return i === 0 || i >= posicion;
  });
  const y = (b: boolean) => (b ? baja : alta);
  const finalBaja = posicion !== 0 && moras.length >= posicion;
  const xFinal = moras.length * paso + inicio;
  const puntos = esBaja.map((b, i) => `${i * paso + inicio},${y(b)}`);
  const ancho = xFinal + inicio;
  return (
    <svg class="curva-acento" width={ancho} height="37" viewBox={`0 0 ${ancho} 37`} role="img" aria-label={tr('Acento en la posición {0}', posicion)}>
      <polyline points={[...puntos, `${xFinal},${y(finalBaja)}`].join(' ')} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      {esBaja.map((b, i) => (
        <circle key={i} cx={i * paso + inicio} cy={y(b)} r="3.2" fill="currentColor" />
      ))}
      <circle cx={xFinal} cy={y(finalBaja)} r="2.8" fill="var(--curva-fondo, var(--superficie))" stroke="currentColor" stroke-width="1.6" />
      {moras.map((m, i) => (
        <text key={i} x={i * paso + inicio} y="33" text-anchor="middle" class="curva-mora">{m}</text>
      ))}
    </svg>
  );
}

function Esqueleto({ lineas = 3 }: { lineas?: number }) {
  return (
    <div class="esqueleto-bloque" aria-hidden="true">
      {Array.from({ length: lineas }, (_, i) => (
        <span key={i} class="esqueleto" style={{ width: `${i === lineas - 1 ? 58 : 94 - i * 6}%` }} />
      ))}
    </div>
  );
}

export function PanelFlujo({
  metodo,
  args,
  titulo,
  render,
  extra,
  alTerminar,
}: {
  metodo: string;
  args: unknown[];
  titulo: string;
  render?: (texto: string) => preact.ComponentChildren;
  extra?: preact.ComponentChildren;
  /** Recibe la respuesta completa, por ejemplo para ponerla en la tarjeta para compartir. */
  alTerminar?: (texto: string) => void;
}) {
  const [texto, fijarTexto] = useState('');
  const [error, fijarError] = useState('');
  const [cargando, fijarCargando] = useState(true);
  const flujo = useRef<FlujoCancelable | null>(null);
  const zona = useRef<HTMLDivElement>(null);
  const clave = JSON.stringify([metodo, args]);
  const [recarga, fijarRecarga] = useState(0);
  // Volver a generar vale para una sola petición: no debe saltarse lo guardado en las siguientes.
  const forzar = useRef(false);
  const [vista, fijarVista] = useState<string | null>(null);
  const [guardada, fijarGuardada] = useState(false);

  // Una ficha abierta al pasar el ratón no debe pedirle a Claude algo que queda fuera de la vista.
  useEffect(() => {
    const el = zona.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (e) => {
        if (e.some((x) => x.isIntersecting)) {
          fijarVista(clave);
          io.disconnect();
        }
      },
      { root: el.closest('.ficha-cuerpo, .gram-cuerpo'), rootMargin: '0px 0px -28px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [clave]);

  useEffect(() => {
    fijarTexto('');
    fijarError('');
    fijarCargando(true);
    fijarGuardada(false);
    if (vista !== clave) return;
    const inicio = performance.now();
    let vivo = true;
    const f = flujoMotor(metodo, [...args, forzar.current], (t) => fijarTexto(t));
    forzar.current = false;
    flujo.current = f;
    f.then((t) => {
      if (!vivo) return;
      fijarTexto(t);
      // Claude no responde tan rápido: esto venía de lo guardado.
      fijarGuardada(!!t && performance.now() - inicio < 350);
      if (t) alTerminar?.(t);
    })
      .catch((e: Error) => {
        if (vivo) fijarError(e.message);
      })
      .finally(() => {
        if (vivo) fijarCargando(false);
      });
    return () => {
      vivo = false;
      f.cancelar();
    };
  }, [clave, recarga, vista]);

  return (
    <div class="panel-ia" ref={zona}>
      <div class="panel-ia-cab">
        <span class="panel-ia-titulo"><Icono n="ia" t={15} /> <span>{titulo}</span></span>
        <span class="panel-ia-acciones">
          {guardada && <span class="panel-ia-guardada" title={tr('Esta respuesta ya estaba guardada: no se ha vuelto a pedir a Claude.')}>{tr('Guardada, sin gasto')}</span>}
          {extra}
          <button class="btn-icono chico ia" title={tr('Volver a preguntar a Claude')} aria-label={tr('Volver a generar')} onClick={() => {
            forzar.current = true;
            fijarRecarga((r) => r + 1);
          }} disabled={cargando}>
            <Icono n="recargar" t={14} />
          </button>
        </span>
      </div>
      {error ? (
        <div class="panel-ia-error" role="alert">
          <Icono n="aviso" t={16} />
          <span>{error}</span>
          <button class="btn chico" onClick={() => fijarRecarga((r) => r + 1)}>{tr('Reintentar')}</button>
        </div>
      ) : !texto && cargando ? (
        <Esqueleto />
      ) : (
        <div class={`panel-ia-texto ${cargando ? 'cursor-ia' : ''}`}>{render ? render(texto) : <ConEnfasis texto={texto} />}</div>
      )}
    </div>
  );
}

/**
 * Claude escribe a veces la palabra estudiada en cursiva, con asteriscos, sobre todo en inglés. Se muestran como cursiva y
 * negrita, y todo lo demás queda como texto: nada se interpreta como HTML.
 */
export function ConEnfasis({ texto }: { texto: string }) {
  const partes = texto.split(/(\*\*[^*\n]+\*\*|\*[^*\s][^*\n]*?\*)/g);
  return (
    <>
      {partes.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**') && p.length > 4) return <b key={i}>{p.slice(2, -2)}</b>;
        if (p.startsWith('*') && p.endsWith('*') && p.length > 2) return <i key={i}>{p.slice(1, -1)}</i>;
        return p;
      })}
    </>
  );
}

function Desglose({ texto }: { texto: string }) {
  const trozos = useMemo(() => {
    return texto
      .split(/^##\s*/m)
      .slice(1)
      .map((b) => {
        const [cabeza, ...resto] = b.split('\n');
        const cuerpo = resto.join('\n');
        const significado = /Significado:\s*(.*)/.exec(cuerpo)?.[1];
        const explicacion = /Explicación:\s*([\s\S]*)/.exec(cuerpo)?.[1]?.trim();
        return { cabeza: cabeza.trim(), significado, explicacion };
      });
  }, [texto]);
  if (!trozos.length) return <>{texto}</>;
  return (
    <>
      {trozos.map((t, i) => (
        <div class="fragmento" key={i}>
          <b lang={lengua.value.id}>{t.cabeza}</b>
          {t.significado && <div class="fragmento-sentido">{t.significado}</div>}
          {t.explicacion && <div class="fragmento-nota">{t.explicacion}</div>}
        </div>
      ))}
    </>
  );
}

async function reproducirBase64(datos: string, tipo = 'audio/mpeg') {
  await new Audio(`data:${tipo};base64,${datos}`).play();
}

/** Escuchar la palabra sin abrir ninguna pestaña: lo primero que se quiere al consultarla. */
function BotonAudio({ lema, lectura }: { lema: string; lectura: string }) {
  const [estado, fijarEstado] = useState<'listo' | 'cargando' | 'sonando'>('listo');
  const voz = () => {
    fijarEstado('sonando');
    decirConNavegador(lema).finally(() => fijarEstado('listo'));
  };
  const tocar = async () => {
    if (estado !== 'listo') return;
    fijarEstado('cargando');
    try {
      const lista = await motor.audiosPalabra(lema, lectura);
      if (!lista[0]) return voz();
      const a = new Audio(lista[0].url);
      a.onended = () => fijarEstado('listo');
      a.onerror = () => fijarEstado('listo');
      fijarEstado('sonando');
      await a.play();
    } catch {
      voz();
    }
  };
  return (
    <button class={`btn-icono relleno ${estado === 'sonando' ? 'activo' : ''}`} data-tip={tr('Escuchar')} aria-label={tr('Escuchar la palabra')} onClick={tocar}>
      {estado === 'cargando' ? <span class="giro" /> : <Icono n="altavoz" t={18} />}
    </button>
  );
}

function PanelAudio({ lema, lectura, frase, ajustes, enviar }: { lema: string; lectura: string; frase?: string; ajustes: Ajustes; enviar: boolean }) {
  const [audios, fijarAudios] = useState<ResultadoAudio[] | null>(null);
  const [error, fijarError] = useState('');
  useEffect(() => {
    motor.audiosPalabra(lema, lectura).then(fijarAudios).catch(() => fijarAudios([]));
  }, [lema, lectura]);

  const tocarVoz = async (voz: string, texto: string) => {
    fijarError('');
    if (hayVozSintetica(ajustes)) {
      try {
        await reproducirBase64(await motor.vozFrase(texto, voz));
        return;
      } catch (e) {
        // Se dice por qué (la voz local cerrada, Azure sin cuota) y se lee igual, con la voz del navegador.
        fijarError(e instanceof Error ? e.message : String(e));
      }
    }
    await decirConNavegador(texto).catch(() => {});
  };

  return (
    <div class="panel-medios">
      <div class="subtitulo-def">{tr('Palabra')}</div>
      {audios === null && <Esqueleto lineas={2} />}
      {audios?.map((a, i) => (
        <div class="fila-audio" key={i}>
          <button class="btn-icono chico relleno" title={tr('Reproducir')} aria-label={tr('Reproducir {0}', a.etiqueta)} onClick={() => new Audio(a.url).play().catch(() => fijarError(tr('No se pudo reproducir el audio')))}>
            <Icono n="reproducir" t={14} />
          </button>
          <span class="fila-audio-nombre">{a.etiqueta}</span>
          {enviar && (
            <button class="btn fantasma chico" onClick={async () => {
              // Si la grabación no baja, que se diga: sin esto, el botón parecía no hacer nada.
              fijarError('');
              try {
                const m = await motor.descargarMedio(a.url);
                await enviarAlCreador({ audioPalabra: [{ id: a.url, nombre: `kotonoha_${lema}.mp3`, tipo: m.tipo, datos: m.datos, etiqueta: a.etiqueta }] });
              } catch (e) {
                fijarError(e instanceof Error ? e.message : String(e));
              }
            }}>{tr('Enviar')}</button>
          )}
        </div>
      ))}
      {audios?.length === 0 && (
        <div class="fila-audio">
          <button class="btn-icono chico relleno" aria-label={tr('Reproducir voz sintética')} onClick={() => tocarVoz(ajustes.vocesFrase[0], lema)}><Icono n="reproducir" t={14} /></button>
          <span class="fila-audio-nombre">{tr('Voz sintética (sin grabación disponible)')}</span>
        </div>
      )}
      {frase && (
        <>
          <div class="subtitulo-def">{tr('Frase')}</div>
          {vozLocalActiva(ajustes) ? (
            <div class="fila-audio">
              <button class="btn-icono chico relleno" aria-label={tr('Leer la frase con la voz local')} onClick={() => tocarVoz('', frase)}><Icono n="reproducir" t={14} /></button>
              <span class="fila-audio-nombre">{tr('Voz local')}</span>
            </div>
          ) : vozNeuronalActiva(ajustes) ? (
            <div class="fila-audio">
              <button class="btn-icono chico relleno" aria-label={tr('Leer la frase con la voz neuronal')} onClick={() => tocarVoz('', frase)}><Icono n="reproducir" t={14} /></button>
              <span class="fila-audio-nombre">{ajustes.idiomaObjetivo === 'de' ? 'Piper · Thorsten' : 'Kokoro'}</span>
            </div>
          ) : ajustes.azureClave ? (
            ajustes.vocesFrase.map((v) => (
              <div class="fila-audio" key={v}>
                <button class="btn-icono chico relleno" aria-label={tr('Leer la frase con {0}', v)} onClick={() => tocarVoz(v, frase)}><Icono n="reproducir" t={14} /></button>
                <span class="fila-audio-nombre">{v.replace(/^[a-z]{2}-[A-Z]{2}-/, '').replace(/(Multilingual)?Neural$/, '')}</span>
              </div>
            ))
          ) : (
            <div class="fila-audio">
              <button class="btn-icono chico relleno" aria-label={tr('Leer la frase con la voz del sistema')} onClick={() => tocarVoz('', frase)}><Icono n="reproducir" t={14} /></button>
              <span class="fila-audio-nombre">{tr('Voz del sistema')} <small class="ayuda">{tr('· Configura una voz local o Azure en Ajustes para voces más naturales')}</small></span>
            </div>
          )}
        </>
      )}
      {error && <div class="texto-error">{error}</div>}
    </div>
  );
}

function PanelImagenes({ lema, frase, enviar, primeraGlosa }: { lema: string; frase?: string; enviar: boolean; primeraGlosa?: string }) {
  const [imgs, fijarImgs] = useState<ResultadoImagen[] | null>(null);
  const [meme, fijarMeme] = useState(false);
  const [error, fijarError] = useState('');
  // Las que no llegan a cargar se quitan: si no, queda el hueco con su título desbordado.
  const [rotas, fijarRotas] = useState<string[]>([]);
  useEffect(() => {
    let vivo = true;
    fijarImgs(null);
    fijarError('');
    fijarRotas([]);
    (async () => {
      // Sin IA si el diccionario ya da una palabra; con IA si no hay definición que buscar.
      let consulta = primeraGlosa?.replace(/\([^)]*\)/g, '').split(/[;,]/)[0].trim();
      if (!consulta) consulta = await motor.consultaImagen(lema, frase).catch(() => lema);
      const r = await motor.imagenes(meme ? `${consulta} meme` : consulta);
      if (vivo) fijarImgs(r);
    })().catch((e) => {
      if (vivo) fijarError(e instanceof Error ? e.message : String(e));
    });
    return () => {
      vivo = false;
    };
  }, [lema, meme]);
  const visibles = (imgs ?? []).filter((m) => !rotas.includes(m.url));
  return (
    <div class="panel-medios">
      {error && <div class="texto-error">{error}</div>}
      {!imgs && !error && (
        <div class="imagenes-fila" aria-hidden="true">
          <span class="esqueleto imagen-vacia" />
          <span class="esqueleto imagen-vacia" />
          <span class="esqueleto imagen-vacia" />
        </div>
      )}
      {imgs && visibles.length === 0 && <div class="ayuda">{tr('No se encontraron imágenes.')}</div>}
      {visibles.length > 0 && (
        <div class="imagenes-fila">
          {visibles.map((m) => (
            <button key={m.url} title={enviar ? tr('Enviar al creador de tarjetas') : m.titulo} onClick={async () => {
              if (!enviar) return;
              fijarError('');
              try {
                const d = await motor.descargarMedio(m.miniatura);
                await enviarAlCreador({ imagenes: [{ id: m.url, nombre: `kotonoha_${Date.now()}.jpg`, tipo: d.tipo, datos: d.datos }] });
              } catch (e) {
                fijarError(e instanceof Error ? e.message : String(e));
              }
            }}>
              <img src={m.miniatura} alt={m.titulo ?? ''} loading="lazy" referrerpolicy="no-referrer" onError={() => fijarRotas((r) => (r.includes(m.url) ? r : [...r, m.url]))} />
            </button>
          ))}
        </div>
      )}
      <div class="fila fila-suelta">
        <span class="ayuda">{tr('Modo meme')}</span>
        <button class={`interruptor ${meme ? 'on' : ''}`} role="switch" aria-checked={meme} aria-label={tr('Modo meme')} onClick={() => fijarMeme(!meme)} />
      </div>
    </div>
  );
}

/** Si la frase es de un video al que se puede volver: tiene su dirección y el momento en que sonó. */
export const momentoDe = (f: FraseEjemplo) => (f.url && typeof f.inicio === 'number' && claveDeVideo(f.url) ? { url: f.url, ms: f.inicio } : null);

/** Vuelve al momento del video donde sonó una frase: a su pestaña si sigue abierta, o la abre. */
export function BotonMomento({ f, corto }: { f: FraseEjemplo; corto?: boolean }) {
  const m = momentoDe(f);
  if (!m) return null;
  const texto = tr('Volver a {0}', momentoLegible(m.ms));
  const abrir = () => fondo.abrirMomento(m.url, m.ms).catch(() => {});
  return corto ? (
    <button class="btn-icono chico btn-momento" data-tip={texto} data-tip-lado="izq" aria-label={texto} onClick={abrir}><Icono n="reproducir" t={14} /></button>
  ) : (
    <button class="btn chico btn-momento" onClick={abrir}><Icono n="reproducir" t={13} /> {texto}</button>
  );
}

function PanelEjemplos({ lema, enviar }: { lema: string; enviar: boolean }) {
  const [filas, fijarFilas] = useState<FraseEjemplo[] | null>(null);
  useEffect(() => {
    motor.ejemplos(lema).then(fijarFilas).catch(() => fijarFilas([]));
  }, [lema]);
  return (
    <div class="panel-medios">
      {filas === null && <Esqueleto lineas={3} />}
      {filas?.length === 0 && (
        <div class="vacio-corto">
          <span class="hoja-icono chica"><Icono n="frases" t={16} /></span>
          <span>{tr('Aún no has visto esta palabra en otras frases. Irán apareciendo aquí conforme la encuentres.')}</span>
        </div>
      )}
      {filas?.map((f, i) => (
        <div class="ejemplo" key={i}>
          <div class="ejemplo-texto">
            <span lang={lengua.value.id}>{f.texto}</span>
            {(f.fuente || momentoDe(f)) && <small>{f.fuente}{momentoDe(f) && <>{f.fuente ? ' · ' : ''}<span class="num">{momentoLegible(f.inicio!)}</span></>}</small>}
          </div>
          <BotonMomento f={f} corto />
          {enviar && <button class="btn fantasma chico" onClick={() => enviarAlCreador({ ejemplos: f.texto })}>{tr('Enviar')}</button>}
        </div>
      ))}
    </div>
  );
}

const SENTIDOS_POR_DICCIONARIO = 6;

/**
 * En la página del diccionario: los sentidos de cada diccionario, con sus glosas juntas («hablar; conversar») y encima
 * su clase de palabra y cómo se usa, solo cuando cambian respecto al sentido anterior.
 */
function Sentidos({ r, elegida, verTodas, alVerTodas, enviar }: { r: ResultadoBusqueda; elegida?: string; verTodas: boolean; alVerTodas: () => void; enviar: boolean }) {
  const paquete = lengua.value;
  const refDe = paquete.referenciaEnGlosa;
  const grupos: { dic: string; titulo: string; sentidos: { glosas: string[]; etiquetas: string[] }[] }[] = [];
  for (const e of r.entradas) {
    const glosas = e.glosas.filter((g) => !refDe?.(g));
    if (!glosas.length) continue;
    let g = grupos.find((x) => x.dic === e.dic);
    if (!g) grupos.push((g = { dic: e.dic, titulo: e.dicTitulo, sentidos: [] }));
    const etiquetas = [...new Set((e.tags ?? '').split(' ').flatMap((t) => paquete.etiquetaDiccionario?.(t) ?? []))];
    g.sentidos.push({ glosas, etiquetas });
  }
  const hayMas = grupos.some((g) => g.sentidos.length > SENTIDOS_POR_DICCIONARIO);
  return (
    <div class="sentidos">
      {grupos.map((g) => {
        let previas = '';
        return (
          <section key={g.dic} class="sentidos-dic">
            {grupos.length > 1 && <h4 class="sentidos-dic-titulo">{tr(g.titulo)}</h4>}
            <ol class="lista-sentidos">
              {(verTodas ? g.sentidos : g.sentidos.slice(0, SENTIDOS_POR_DICCIONARIO)).map((x, i) => {
                const clave = x.etiquetas.join('|');
                const etiquetasNuevas = clave !== previas;
                previas = clave;
                // Unidas, las glosas que acaban en punto («Correr.», «Mover.») lo pierden: «Correr; Mover».
                const texto = x.glosas.length > 1 ? x.glosas.map((g) => g.replace(/\.\s*$/, '')).join('; ') : x.glosas[0];
                return (
                  <li key={i} class={elegida && x.glosas.includes(elegida) ? 'elegida' : ''}>
                    {etiquetasNuevas && x.etiquetas.length > 0 && <div class="sentido-etiquetas">{x.etiquetas.map((t) => <span key={t}>{tr(t)}</span>)}</div>}
                    <div class="sentido-fila">
                      <span class="sentido-num num" aria-hidden="true">{i + 1}</span>
                      <span class="def-texto">{texto}</span>
                      {enviar && <button class="def-enviar" aria-label={tr('Enviar «{0}» al creador', texto)} title={tr('Enviar al creador de tarjetas')} onClick={() => enviarAlCreador({ definicion: texto })}><Icono n="enviar" t={13} /></button>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
      {hayMas && (
        <button class="btn fantasma chico ver-mas" onClick={alVerTodas}>
          {verTodas ? tr('Ver menos') : tr('Ver todos los sentidos')}
          <Icono n={verTodas ? 'arriba' : 'abajo'} t={12} />
        </button>
      )}
    </div>
  );
}

export interface PropsFicha {
  lema: string;
  lectura?: string;
  superficie?: string;
  flexion?: string[];
  contexto: ContextoIA;
  ajustes: Ajustes;
  /** Crea la tarjeta de un clic. Si falta, el botón se oculta. */
  alCrear?: (r: ResultadoBusqueda) => void;
  /** Rellena el creador con esta palabra. */
  alEnviar?: (r: ResultadoBusqueda) => void;
  alCambiarEstado?: (clave: string, lema: string, lectura: string, estado?: EstadoPalabra, rastreada?: boolean) => void;
  pestanaInicial?: PestanaDiccionario;
  compuestos?: string[];
  /** Sentido ya conocido por el análisis profundo: se muestra sin esperar. */
  sentidoPrevio?: { significado: string; uso?: string };
  gramatica?: PuntoGramatica[];
  lecturaCorregida?: boolean;
  /** Se llama tras corregir una lectura, para repintar los subtítulos. */
  alCorregirLectura?: () => void;
  /** Si está, se muestra un botón para cerrar la ficha. */
  alCerrar?: () => void;
  /** Estado conocido por quien abre la ficha: si cambia fuera, por ejemplo con el teclado, se refleja aquí. */
  estado?: EstadoPalabra;
  rastreada?: boolean;
  /**
   * En la página del diccionario: más grande, sin límite de alto, con las pestañas junto a lo que abren y sin las
   * referencias (opuestos, «ver también»), que la página enseña aparte.
   */
  vista?: 'pagina';
  /** Se llama con la entrada del diccionario cuando llega: la página del diccionario la usa a su lado. */
  alCargar?: (r: ResultadoBusqueda) => void;
}

interface SentidoVisible {
  significado: string;
  uso?: string;
  nota?: string;
}

/**
 * El significado en esta frase, que es lo que el diccionario no puede darte. La ficha abre siempre con el
 * diccionario, sin gastar nada: Claude solo se consulta si se pide, y lo ya consultado aparece solo.
 */
function ConSentido({ contexto, definiciones, previo, automatico, listo, alElegir, alSentido, children }: {
  contexto: ContextoIA;
  definiciones: string[];
  previo?: { significado: string; uso?: string };
  automatico: boolean;
  listo: boolean;
  alElegir: (i: number) => void;
  /** Lo que significa en la frase, cuando se sabe: va en la tarjeta para compartir. */
  alSentido?: (s: SentidoVisible | null) => void;
  children: (bloque: preact.ComponentChildren, boton: preact.ComponentChildren) => preact.ComponentChildren;
}) {
  const clave = `${contexto.lema}|${contexto.lectura}|${contexto.frase}`;
  // Todo va atado a la pregunta: al cambiar de palabra, lo de la anterior no llega a pintarse.
  const [estado, fijarEstado] = useState<{ clave: string; s?: SentidoEnContexto; cargando?: boolean; error?: string }>({ clave });
  const { s, cargando, error } = estado.clave === clave ? estado : ({ clave } as typeof estado);
  const vigente = useRef(clave);
  vigente.current = clave;
  const esperar = useEsperar();

  const pedir = () => {
    fijarEstado({ clave, cargando: true });
    motor
      .sentidoEnContexto(contexto, definiciones)
      .then((r) => {
        if (vigente.current !== clave) return;
        fijarEstado({ clave, s: r });
        alElegir(r.definicion);
      })
      .catch((e: Error) => {
        if (vigente.current === clave) fijarEstado({ clave, error: e.message });
      });
  };

  useLayoutEffect(() => alElegir(-1), [clave]);

  useEffect(() => {
    if (!listo || !contexto.frase) return;
    let vivo = true;
    esperar(motor.sentidoGuardado(contexto, definiciones))
      .then((r) => {
        if (!vivo) return;
        if (r) {
          fijarEstado({ clave, s: r });
          alElegir(r.definicion);
        } else if (automatico && !previo) {
          pedir();
        }
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [clave, listo]);

  const significado = s?.significado ?? previo?.significado;
  const uso = s?.uso ?? previo?.uso;
  useEffect(() => alSentido?.(significado ? { significado, uso, nota: s?.nota || undefined } : null), [clave, significado, uso, s?.nota]);
  const bloque = significado || cargando ? (
    <div class={`sentido ${significado ? '' : 'cargando'}`}>
      <div class="sentido-cab">
        <span class="sentido-et"><Icono n="ia" t={14} /> {tr('En esta frase')}</span>
        {uso && uso !== 'literal' && <span class="uso">{NOMBRES_USO[uso] ? tr(NOMBRES_USO[uso]) : uso}</span>}
      </div>
      {significado ? <b>{significado}</b> : <Esqueleto lineas={2} />}
      {s?.nota && <p>{s.nota}</p>}
    </div>
  ) : null;
  // Si la revisión del video ya dijo qué significa aquí, no hace falta pagar por volver a preguntarlo.
  const boton = contexto.frase && !s && !previo && !cargando ? (
    <div class="sentido-pedir">
      <button class="btn chico ia" title={tr('Pregunta a Claude qué significa esta palabra en esta frase. La respuesta se guarda y no se vuelve a pagar.')} onClick={pedir}>
        <Icono n="ia" t={14} /> {tr('¿Qué significa en esta frase?')}
      </button>
      {error && <span class="texto-error" role="alert">{error}</span>}
    </div>
  ) : null;
  return <>{children(bloque, boton)}</>;
}

function CorregirLectura({ contexto, textoLinea, superficie, alHecho, alCerrar }: { contexto: ContextoIA; textoLinea: string; superficie: string; alHecho?: () => void; alCerrar: () => void }) {
  const [manual, fijarManual] = useState('');
  const [estado, fijarEstado] = useState('');
  return (
    <div class="corregir-lectura">
      <div class="corregir-cab">
        <b>{tr('¿La lectura no es correcta?')}</b>
        <button class="btn-icono chico" aria-label={tr('Cerrar')} onClick={alCerrar}><Icono n="cerrar" t={14} /></button>
      </div>
      <div class="corregir-fila">
        <button class="btn chico ia" disabled={estado === 'Revisando…'} onClick={async () => {
          fijarEstado(tr('Revisando…'));
          try {
            const r = await motor.revisarLectura({ ...contexto, superficie }, textoLinea);
            fijarEstado(`${r.lectura}: ${r.motivo}`);
            alHecho?.();
          } catch (e) {
            fijarEstado(e instanceof Error ? e.message : String(e));
          }
        }}><Icono n="ia" t={14} /> {tr('Revisar con Claude')}</button>
        <span class="ayuda">{tr('o')}</span>
        <input class="campo" lang={lengua.value.id} placeholder={tr(lengua.value.textos.lecturaCampo)} aria-label={tr('Lectura correcta')} value={manual} onInput={(e) => fijarManual(e.currentTarget.value)} onKeyDown={(e) => e.stopPropagation()} />
        <button class="btn chico" disabled={!manual.trim()} onClick={async () => {
          await motor.corregirLectura(textoLinea, { superficie, lectura: manual.trim() });
          fijarEstado(tr('Lectura guardada'));
          alHecho?.();
        }}>{tr('Guardar')}</button>
      </div>
      {estado && <span class="ayuda corregir-estado">{estado}</span>}
    </div>
  );
}

function Frecuencia({ lista, rango, estilo }: { lista: string; rango: number; estilo: Ajustes['estiloFrecuencia'] }) {
  const nombre = lista.replace(/^Frecuencia /, '');
  const nivel = rango <= 1500 ? 5 : rango <= 5000 ? 4 : rango <= 15000 ? 3 : rango <= 30000 ? 2 : 1;
  const posicion = numero(rango);
  return (
    <span class="etiqueta-frec" data-tip={tr('Frecuencia {0}: puesto {1}', nombre, posicion)}>
      {estilo === 'estrellas' ? (
        <span class="frec-estrellas" aria-label={`${nivel} de 5`}>{'★'.repeat(nivel)}<i>{'★'.repeat(5 - nivel)}</i></span>
      ) : (
        <>
          <span class={`frec-barras b${nivel}`} aria-hidden="true"><i /><i /><i /><i /><i /></span>
          <span class="num">{posicion}</span>
        </>
      )}
    </span>
  );
}

const ESTADOS: { e: EstadoPalabra; tecla: string }[] = [
  { e: 'desconocida', tecla: '1' },
  { e: 'aprendiendo', tecla: '2' },
  { e: 'conocida', tecla: '3' },
  { e: 'ignorada', tecla: '4' },
];

const PESTANAS: { id: PestanaDiccionario; icono: NombreIcono; nombre: string; titulo: string; ia?: boolean; conFrase?: boolean; larga?: boolean }[] = [
  { id: 'explicar', icono: 'ia', nombre: tm('Explicar'), titulo: tm('Explicar con Claude'), ia: true, larga: true },
  { id: 'desglose', icono: 'gramatica', nombre: tm('Desglose'), titulo: tm('Desglose de la frase'), ia: true, conFrase: true, larga: true },
  { id: 'traduccion', icono: 'traducir', nombre: tm('Traducir'), titulo: tm('Traducir la frase'), ia: true, conFrase: true },
  { id: 'audio', icono: 'altavoz', nombre: tm('Audio'), titulo: tm('Audio') },
  { id: 'imagenes', icono: 'imagen', nombre: tm('Imágenes'), titulo: tm('Imágenes') },
  { id: 'ejemplos', icono: 'frases', nombre: tm('Ejemplos'), titulo: tm('Frases de ejemplo de lo que has visto') },
  { id: 'trazos', icono: 'trazos', nombre: tm('Trazos'), titulo: tm('Orden de los trazos') },
  { id: 'suena', icono: 'oido', nombre: tm('Cómo suena'), titulo: tm('Cómo suena de verdad la frase'), conFrase: true },
  { id: 'enlaces', icono: 'enlace', nombre: tm('Enlaces'), titulo: tm('Enlaces externos') },
];

export function Ficha(p: PropsFicha) {
  const [r, fijarR] = useState<ResultadoBusqueda | null>(null);
  const [extras, fijarExtras] = useState<ResultadoBusqueda[]>([]);
  const pestanaGuardada = p.pestanaInicial ?? p.ajustes.diccionarioPestana;
  const pestanaDeInicio = pestanaGuardada === 'ninguna' ? null : pestanaGuardada;
  const [pestana, fijarPestana] = useState<PestanaDiccionario | null>(pestanaDeInicio);
  // De qué palabra es el resultado de `r`. Mientras llega el de la nueva, la ficha aún enseña la anterior.
  const [buscada, fijarBuscada] = useState('');
  const claveBusqueda = `${p.lema}|${p.lectura}`;
  const sincronizada = buscada === claveBusqueda;
  const [pregunta, fijarPregunta] = useState('');
  const [preguntaEnviada, fijarPreguntaEnviada] = useState('');
  const [cargando, fijarCargando] = useState(true);
  const [tieneTarjeta, fijarTieneTarjeta] = useState(false);
  const [elegida, fijarElegida] = useState(-1);
  const [profundo, fijarProfundo] = useState(false);
  const [patron, fijarPatron] = useState<PuntoGramatica | null>(null);
  const [verTodas, fijarVerTodas] = useState(false);
  const [corrigiendo, fijarCorrigiendo] = useState(false);
  const [altoPanel, fijarAltoPanel] = useState(0);
  const [hojas, fijarHojas] = useState(0);
  const [compartida, fijarCompartida] = useState<Compartida | null>(null);
  const [sentido, fijarSentido] = useState<SentidoVisible | null>(null);
  const [explicacionPatron, fijarExplicacionPatron] = useState<{ patron: string; texto: string } | null>(null);
  const cuerpo = useRef<HTMLDivElement>(null);
  const zonaPestana = useRef<HTMLDivElement>(null);
  const esperar = useEsperar();

  useEffect(() => {
    let vivo = true;
    fijarCargando(true);
    fijarPreguntaEnviada('');
    fijarProfundo(false);
    fijarPatron(null);
    fijarVerTodas(false);
    fijarCorrigiendo(false);
    fijarAltoPanel(0);
    fijarCompartida(null);
    cuerpo.current?.scrollTo({ top: 0 });
    esperar(motor.buscar(p.lema, p.lectura)).then((x) => {
      if (vivo) {
        fijarR(x);
        fijarBuscada(claveBusqueda);
        fijarCargando(false);
        p.alCargar?.(x);
      }
    });
    if (p.compuestos && p.ajustes.busquedaCompuesta) {
      motor.compuestos(p.compuestos).then((x) => vivo && fijarExtras(x)).catch(() => {});
    } else {
      fijarExtras([]);
    }
    if (p.ajustes.destino === 'anki') {
      esperar(motor.ankiTieneTarjeta(p.lema)).then((n) => vivo && fijarTieneTarjeta(n.length > 0)).catch(() => vivo && fijarTieneTarjeta(false));
    }
    return () => {
      vivo = false;
    };
  }, [p.lema, p.lectura]);

  // Haber preguntado a Claude por una palabra no significa querer preguntar por la siguiente.
  useEffect(() => {
    fijarPestana((actual) => (PESTANAS.find((x) => x.id === actual)?.ia ? pestanaDeInicio : actual));
  }, [p.lema, p.lectura, p.contexto.frase]);

  useEffect(() => {
    if (p.estado === undefined && p.rastreada === undefined) return;
    fijarR((x) => {
      if (!x) return x;
      if (p.estado === 'conocida' && x.estado !== 'conocida') fijarHojas((n) => n + 1);
      return { ...x, estado: p.estado ?? x.estado, rastreada: p.rastreada ?? x.rastreada };
    });
  }, [p.estado, p.rastreada]);

  if (cargando && !r) {
    return (
      <div class="ficha ficha-cargando" aria-busy="true">
        <div class="ficha-cab">
          <span class="esqueleto esq-palabra" />
          <span class="esqueleto esq-estados" />
        </div>
        <div class="ficha-cuerpo"><Esqueleto lineas={4} /></div>
      </div>
    );
  }
  if (!r) return null;

  const cambiar = (estado?: EstadoPalabra, rastreada?: boolean) => {
    const nuevo = { ...r, estado: estado ?? r.estado, rastreada: rastreada ?? r.rastreada };
    if (estado === 'conocida' && r.estado !== 'conocida') fijarHojas((n) => n + 1);
    fijarR(nuevo);
    p.alCambiarEstado?.(r.clave, r.lema, r.lectura, estado, rastreada);
    motor.cambiarPalabras([{ clave: r.clave, lema: r.lema, lectura: r.lectura, estado, rastreada }]).catch(console.error);
  };

  const elegirPestana = (id: PestanaDiccionario) => {
    const c = cuerpo.current;
    const cajaZona = zonaPestana.current?.getBoundingClientRect();
    const cajaCuerpo = c?.getBoundingClientRect();
    const aLaVista = !cajaZona || !cajaCuerpo || (cajaZona.top >= cajaCuerpo.top - 1 && cajaZona.top < cajaCuerpo.top + cajaCuerpo.height * 0.5);
    const nueva = pestana === id && aLaVista ? null : id;
    fijarPestana(nueva);
    // En el diccionario de la app la ficha crece con su contenido y no hay nada que desplazar.
    const limitada = !!c && (!!c.closest('.popup-palabra') || c.scrollHeight > c.clientHeight + 1);
    const ventana = c?.closest('.ficha')?.parentElement;
    if (!nueva || !c || !ventana || !limitada) {
      fijarAltoPanel(0);
      return;
    }
    if (!PESTANAS.find((x) => x.id === nueva)?.larga) {
      // Lo breve, como el audio o los enlaces, basta con dejarlo a la vista.
      fijarAltoPanel(0);
      for (const ms of [0, 350, 900]) {
        setTimeout(() => cuerpo.current?.scrollTo({ top: cuerpo.current.scrollHeight, behavior: 'smooth' }), ms);
      }
      return;
    }
    // En una ventana el panel recién pedido ocupa toda la zona visible: la respuesta de Claude se lee
    // desde su primera línea mientras va llegando. Lo demás sigue arriba, a un gesto de distancia.
    const maximo = parseFloat(getComputedStyle(ventana).maxHeight);
    const alto = (Number.isNaN(maximo) ? ventana.offsetHeight : Math.max(maximo, ventana.offsetHeight)) - (ventana.offsetHeight - c.clientHeight);
    fijarAltoPanel(Math.max(0, alto - 8));
    requestAnimationFrame(() => {
      const z = zonaPestana.current;
      if (z) c.scrollTo({ top: z.offsetTop - 8, behavior: 'smooth' });
    });
  };

  const porDic = new Map<string, { titulo: string; glosas: string[] }>();
  for (const e of r.entradas) {
    const g = porDic.get(e.dic);
    if (g) g.glosas.push(...e.glosas);
    else porDic.set(e.dic, { titulo: e.dicTitulo, glosas: [...e.glosas] });
  }
  const definiciones = [...porDic.values()].flatMap((d) => d.glosas);
  const definicionesUnicas = [...new Set(definiciones)];
  const nombresFlexion = (p.flexion ?? []).map((f) => [f, lengua.value.nombreFlexion(f)] as const);

  const contexto: ContextoIA = { ...p.contexto, lema: r.lema, lectura: r.lectura, superficie: p.superficie };
  // La definición que Claude señala como la más cercana va la primera.
  const defsOrdenadas = elegida >= 0 && elegida < definicionesUnicas.length
    ? [definicionesUnicas[elegida], ...definicionesUnicas.filter((_, i) => i !== elegida)]
    : definicionesUnicas;
  const tieneFrase = !!p.contexto.frase;
  const enviar = !!p.alEnviar;
  const pagina = p.vista === 'pagina';
  // Las referencias metidas entre las definiciones («antonym: …», «see: …») no son significados: van aparte.
  const refDe = lengua.value.referenciaEnGlosa;
  const referencias = refDe ? definicionesUnicas.flatMap((g) => refDe(g) ?? []).filter((x, i, xs) => xs.findIndex((y) => y.tipo === x.tipo && y.termino === x.termino) === i) : [];
  const defsSignificado = refDe ? defsOrdenadas.filter((g) => !refDe(g)) : defsOrdenadas;
  // En la página van los sentidos enteros (Sentidos); aquí, la lista breve de siempre.
  const cuantasDefs = 5;
  const defsVisibles = verTodas ? defsSignificado : defsSignificado.slice(0, cuantasDefs);

  // Compartir como imagen: la palabra o el patrón, lo que significa aquí y la frase donde apareció.
  // El título es la fuente (el video, el libro) salvo cuando es una línea del propio texto, como la primera de una nota.
  const tituloComoFuente = p.contexto.titulo?.trim() && ![p.contexto.frase, ...(p.contexto.antes ?? []), ...(p.contexto.despues ?? [])].some((l) => l?.includes(p.contexto.titulo!.trim()))
    ? p.contexto.titulo.trim()
    : undefined;
  const resaltadoEn = (frase: string | undefined, trozo: string | undefined) => {
    const i = frase && trozo ? frase.indexOf(trozo) : -1;
    return i >= 0 && trozo ? { inicio: i, fin: i + trozo.length } : undefined;
  };
  const datosPalabra = (): DatosTarjeta => {
    const paquete = lengua.value;
    const titulo = paquete.lectura.distingue && r.lectura && r.lectura !== r.lema
      ? paquete.lectura.segmentar(r.lema, r.lectura).map((s) => ({ texto: s.texto, lectura: s.lectura ? paquete.lectura.visible(s.lectura, formatoLectura.value) : undefined }))
      : [{ texto: r.lema }];
    const moras = r.acentos.length ? paquete.acento?.moras?.(r.lectura) ?? [] : [];
    const tono = (oscuro: boolean) => {
      const paleta = paletaDe(p.ajustes.paleta, oscuro);
      return paleta[(r.patron && r.patron in paleta ? r.patron : 'heiban') as keyof Paleta];
    };
    return {
      etiqueta: tr('Palabra'),
      titulo,
      pronunciacion: r.pronunciaciones?.length ? r.pronunciaciones.map((t) => `${t.zona.toUpperCase()}  ${t.ipa}`).join('      ') : undefined,
      acento: moras.length ? { moras, posicion: r.acentos[0], color: { oscuro: tono(true), claro: tono(false) } } : undefined,
      rotulo: sentido ? tr('En esta frase') : tr('Significado'),
      deClaude: !!sentido,
      uso: sentido?.uso && sentido.uso !== 'literal' ? (NOMBRES_USO[sentido.uso] ? tr(NOMBRES_USO[sentido.uso]) : sentido.uso) : undefined,
      significado: sentido?.significado ?? defsOrdenadas[0],
      otros: sentido ? [] : defsOrdenadas.slice(1, 3),
      nota: sentido?.nota,
      frase: p.contexto.frase,
      resaltado: resaltadoEn(p.contexto.frase, p.superficie ?? r.lema),
      traduccion: p.contexto.traduccion,
      fuente: tituloComoFuente,
    };
  };
  const datosGramatica = (g: PuntoGramatica): DatosTarjeta => ({
    etiqueta: tr('Gramática'),
    nivel: g.nivel,
    titulo: [{ texto: g.patron }],
    rotulo: tr('Significado'),
    significado: tr(g.significado),
    nota: explicacionPatron?.patron === g.patron ? primerPunto(explicacionPatron.texto) || undefined : undefined,
    frase: p.contexto.frase,
    resaltado: resaltadoEn(p.contexto.frase, g.fragmento),
    traduccion: p.contexto.traduccion,
    fuente: tituloComoFuente,
  });
  const compartirComo = (origen: string, datos: DatosTarjeta, nombre: string) => {
    if (compartida?.origen === origen) return fijarCompartida(null);
    const tema: EstiloTarjeta = cuerpo.current?.closest('[data-tema]')?.getAttribute('data-tema') === 'claro' ? 'claro' : 'oscuro';
    fijarCompartida(compartir(origen, datos, `kotonoha-${nombre}`, tema, resolverLetra(cuerpo.current, lengua.value.letra)));
    if (origen === 'palabra') cuerpo.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const panelCompartir = (origen: string) =>
    compartida?.origen === origen && <PanelCompartir c={compartida} alCambiar={fijarCompartida} alCerrar={() => fijarCompartida(null)} />;

  const bloqueGramatica = p.gramatica && p.gramatica.length > 0 ? (
    <div key="gram" class="ficha-bloque">
      <div class="subtitulo-def">{tr('Gramática en esta frase')}</div>
      <div class="ficha-chips">
        {p.gramatica.map((g) => (
          <button key={g.patron} class={`chip-gram n-${g.nivel ?? ''} estado-${estadoGramatica(g.patron)}`} title={tr(g.significado)} aria-pressed={patron?.patron === g.patron} onClick={() => {
            fijarPatron(patron?.patron === g.patron ? null : g);
            if (compartida?.origen === 'gramatica') fijarCompartida(null);
          }}>
            <span lang={lengua.value.id}>{g.patron}</span>{g.nivel && <small>{g.nivel}</small>}
          </button>
        ))}
      </div>
      {patron && (
        <div class="ficha-patron">
          <div class="ficha-patron-cab">
            <div class="ayuda">{tr(patron.significado)}</div>
            <button class={`btn-icono chico ${compartida?.origen === 'gramatica' ? 'activo' : ''}`} data-tip={tr('Compartir como imagen')} data-tip-lado="izq" aria-label={tr('Compartir como imagen')} aria-pressed={compartida?.origen === 'gramatica'} onClick={() => compartirComo('gramatica', datosGramatica(patron), patron.patron)}>
              <Icono n="compartir" t={15} />
            </button>
          </div>
          {panelCompartir('gramatica')}
          <BotonesEstadoGramatica patron={patron.patron} />
          <PanelFlujo metodo="gramatica" args={[{ ...contexto, lema: patron.patron }]} titulo={patron.patron} alTerminar={(texto) => fijarExplicacionPatron({ patron: patron.patron, texto })} />
          <BotonOpcionMultiple punto={patron} frase={p.contexto.frase ?? ''} fuente={p.contexto.titulo} url={location.href} />
          <VistoEn patron={patron.patron} />
        </div>
      )}
    </div>
  ) : null;

  const [sinDiccionarios, fijarSinDiccionarios] = useState(false);
  useEffect(() => {
    if (definicionesUnicas.length) return;
    motor.estado().then((e) => fijarSinDiccionarios(!e.diccionarios.some((d) => d.tipo === 'terminos'))).catch(() => {});
  }, [definicionesUnicas.length, lengua.value.id]);

  const bloques = {
    definiciones: (
      <div key="def" class="ficha-bloque">
        <div class="subtitulo-def">{tr('Definiciones')}</div>
        {definicionesUnicas.length === 0 && (sinDiccionarios ? (
          <div class="ayuda">
            {tr('Aún no hay diccionarios de este idioma. Se instalan en Ajustes, Diccionarios, y mientras tanto Claude puede explicarla con «Explicar».')}{' '}
            <button class="enlace" onClick={() => fondo.abrirApp('ajustes')}>{tr('Abrir Ajustes')}</button>
          </div>
        ) : <div class="ayuda">{tr('Sin entrada en los diccionarios instalados. Puedes preguntarle a Claude con «Explicar».')}</div>)}
        {pagina && <Sentidos r={r} elegida={elegida >= 0 ? definicionesUnicas[elegida] : undefined} verTodas={verTodas} alVerTodas={() => fijarVerTodas(!verTodas)} enviar={enviar} />}
        {!pagina && <ol class="lista-defs">
          {defsVisibles.map((g, i) => (
            <li key={g} class={i === 0 && elegida >= 0 ? 'elegida' : ''} title={i === 0 && elegida >= 0 ? tr('Claude la señala como la más cercana en esta frase') : undefined}>
              <span class="def-texto">{g}</span>
              {enviar && <button class="def-enviar" aria-label={tr('Enviar «{0}» al creador', g)} title={tr('Enviar al creador de tarjetas')} onClick={() => enviarAlCreador({ definicion: g })}><Icono n="enviar" t={13} /></button>}
            </li>
          ))}
        </ol>}
        {!pagina && defsSignificado.length > cuantasDefs && (
          <button class="btn fantasma chico ver-mas" onClick={() => fijarVerTodas(!verTodas)}>
            {verTodas ? tr('Ver menos') : tr('Ver {0} más', defsSignificado.length - cuantasDefs)}
            <Icono n={verTodas ? 'arriba' : 'abajo'} t={12} />
          </button>
        )}
        {!pagina && referencias.length > 0 && (
          <div class="ficha-refs">
            {(['opuesto', 'ver'] as const).map((tipo) => {
              const xs = referencias.filter((x) => x.tipo === tipo);
              return xs.length ? (
                <span key={tipo} class="ficha-ref">
                  <b>{tipo === 'opuesto' ? tr('Opuesto') : tr('Ver también')}</b>
                  {xs.map((x) => (
                    <button key={x.termino} class="enlace" lang={lengua.value.id} onClick={() => fondo.abrirApp(`diccionario?q=${encodeURIComponent(x.termino)}`)}>{x.termino}</button>
                  ))}
                </span>
              ) : null;
            })}
          </div>
        )}
        {extras.length > 0 && (
          <>
            <div class="subtitulo-def">{tr(lengua.value.textos.compuestos)}</div>
            <ul class="lista-compuestos">
              {extras.map((e) => (
                <li key={e.clave}>
                  <b lang={lengua.value.id}>{e.lema}</b> {e.lectura !== e.lema && <span class="ayuda" lang={lengua.value.id}>{e.lectura}</span>}
                  <div class="compuesto-def">{e.entradas[0]?.glosas.slice(0, 2).join('; ')}</div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    ),
    flexiones: nombresFlexion.length ? (
      <div key="flex" class="ficha-bloque">
        <div class="subtitulo-def">{tr(lengua.value.textos.flexionDe)} <span lang={lengua.value.id}>{p.superficie}</span></div>
        <div class="flexiones">
          {nombresFlexion.map(([f, n], i) => (
            <span key={i} class="chip"><b lang={lengua.value.id}>{f}</b>{n ? <span>{n}</span> : null}</span>
          ))}
        </div>
      </div>
    ) : null,
    pestanas: (
      <>
        {bloqueGramatica}
        <div key="tabs" class="ficha-bloque ficha-panel" ref={zonaPestana} style={altoPanel ? { minHeight: `${altoPanel}px` } : undefined}>
          {pestana === 'audio' && <PanelAudio lema={r.lema} lectura={r.lectura} frase={p.contexto.frase} ajustes={p.ajustes} enviar={enviar} />}
          {pestana === 'imagenes' && <PanelImagenes lema={r.lema} frase={p.contexto.frase} enviar={enviar} primeraGlosa={lengua.value.consultaImagen(r.lema, r.entradas, definicionesUnicas)} />}
          {pestana === 'ejemplos' && <PanelEjemplos lema={r.lema} enviar={enviar} />}
          {pestana === 'trazos' && <PanelTrazos palabra={r.lema} />}
          {pestana === 'suena' && p.contexto.frase && <PanelComoSuena frase={p.contexto.frase} />}
          {sincronizada && pestana === 'explicar' && (
            <>
              <PanelFlujo
                metodo="explicar"
                args={[contexto, profundo]}
                titulo={profundo ? tr('Análisis a fondo con Opus') : tr('¿Qué significa aquí?')}
                extra={!profundo && <button class="btn chico ia" title={tr('Vuelve a preguntar con Claude Opus, con más razonamiento. Útil con versos difíciles.')} onClick={() => fijarProfundo(true)}>{tr('Profundizar')}</button>}
              />
              {preguntaEnviada && (
                <div class="pregunta-respuesta">
                  <PreguntaLibre contexto={contexto} pregunta={preguntaEnviada} />
                </div>
              )}
              <form class="pregunta-ia" onSubmit={(e) => {
                e.preventDefault();
                if (pregunta.trim()) {
                  fijarPreguntaEnviada(pregunta.trim());
                  fijarPregunta('');
                }
              }}>
                <input class="campo" placeholder={tr('Pregúntale a Claude sobre esta palabra o frase')} value={pregunta} onInput={(e) => fijarPregunta(e.currentTarget.value)} onKeyDown={(e) => e.stopPropagation()} aria-label={tr('Pregunta a Claude')} />
                <button class="btn-icono ia" type="submit" aria-label={tr('Preguntar')} title={tr('Preguntar')} disabled={!pregunta.trim()}><Icono n="enviar" t={17} /></button>
              </form>
            </>
          )}
          {sincronizada && pestana === 'desglose' && <PanelFlujo metodo="desglosar" args={[contexto]} titulo={tr('Desglose de la frase')} render={(t) => <Desglose texto={t} />} />}
          {sincronizada && pestana === 'traduccion' && <PanelFlujo metodo="traducir" args={[contexto]} titulo={tr('Traducción')} />}
          {pestana === 'enlaces' && (
            <div class="enlaces">
              {lengua.value.enlaces.map((e) => (
                <a key={e.nombre} class="chip" href={e.url(r.lema, r.entradas)} target="_blank" rel="noreferrer noopener">{tr(e.nombre)} <Icono n="externo" t={12} /></a>
              ))}
            </div>
          )}
        </div>
      </>
    ),
  };

  const iaDock = PESTANAS.filter((x) => x.ia);
  const otrasDock = PESTANAS.filter((x) => !x.ia && (x.id !== 'trazos' || lengua.value.trazos) && (x.id !== 'suena' || lengua.value.comoSuena));
  const botonPestana = (x: (typeof PESTANAS)[number]) => (
    <button
      key={x.id}
      class={`pestana ${x.ia ? 'ia' : ''} ${pestana === x.id ? 'activo' : ''}`}
      title={tr(x.titulo)}
      aria-label={tr(x.titulo)}
      role="tab"
      aria-selected={pestana === x.id}
      disabled={x.conFrase && !tieneFrase}
      onClick={() => elegirPestana(x.id)}
    >
      <Icono n={x.icono} t={18} />
      <span>{tr(x.nombre)}</span>
    </button>
  );

  const dock = (
    <div key="dock" class="ficha-dock" role="tablist" aria-label={tr('Más sobre esta palabra')}>
      {iaDock.map(botonPestana)}
      <span class="dock-sep" aria-hidden="true" />
      {otrasDock.map(botonPestana)}
    </div>
  );

  return (
    <div class={`ficha ${pagina ? 'ficha-pagina' : ''}`}>
      <div class="ficha-cab">
        <div class="ficha-titulo">
          <div class="ficha-izq">
            <div class="ficha-palabra" lang={lengua.value.id}>
              <ConFurigana texto={r.lema} lectura={r.lectura} />
            </div>
            {!!r.pronunciaciones?.length && (
              <div class="ficha-ipa">
                {r.pronunciaciones.map((t) => <span key={t.zona}><small>{t.zona.toUpperCase()}</small>{t.ipa}</span>)}
              </div>
            )}
            {r.acentos.length > 0 && !!lengua.value.acento?.moras && (
              <div class={`ficha-tono ac-${r.patron ?? ''}`} lang={lengua.value.id}>
                {r.acentos.slice(0, 2).map((a) => <CurvaAcento key={a} lectura={r.lectura} posicion={a} />)}
              </div>
            )}
          </div>
          <div class="ficha-herr">
            {r.frecuencias.map((f) => <Frecuencia key={f.lista} lista={f.lista} rango={f.rango} estilo={p.ajustes.estiloFrecuencia} />)}
            {tieneTarjeta && (
              <button class="btn-icono activo" data-tip={tr('Ya tienes tarjeta: ver')} aria-label={tr('Ya tienes tarjeta: ver')} onClick={() => motor.ankiVerTarjeta(r.lema)}>
                <Icono n="sello" t={18} />
              </button>
            )}
            {tieneFrase && lengua.value.lectura.distingue && (
              <button class={`btn-icono ${corrigiendo ? 'activo' : ''}`} data-tip={tr('¿Lectura incorrecta?')} aria-label={tr('¿Lectura incorrecta?')} aria-pressed={corrigiendo} onClick={() => {
                fijarCorrigiendo(!corrigiendo);
                if (!corrigiendo) cuerpo.current?.scrollTo({ top: 0, behavior: 'smooth' });
              }}>
                <Icono n="lapiz" t={17} />
              </button>
            )}
            <button class={`btn-icono ${compartida?.origen === 'palabra' ? 'activo' : ''}`} data-tip={tr('Compartir como imagen')} aria-label={tr('Compartir como imagen')} aria-pressed={compartida?.origen === 'palabra'} onClick={() => compartirComo('palabra', datosPalabra(), r.lema)}>
              <Icono n="compartir" t={17} />
            </button>
            <BotonAudio key={r.clave} lema={r.lema} lectura={r.lectura} />
            {p.alCerrar && <button class="btn-icono" data-tip={tr('Cerrar · Esc')} aria-label={tr('Cerrar')} onClick={p.alCerrar}><Icono n="cerrar" t={17} /></button>}
          </div>
        </div>
        <div class="ficha-estado">
          <div class="estados" role="radiogroup" aria-label={tr('Estado de la palabra')}>
            {ESTADOS.map(({ e, tecla }) => (
              <button
                key={e}
                role="radio"
                aria-checked={e === r.estado}
                class={`estado ${e} ${e === r.estado ? 'activo' : ''}`}
                title={`${tr(NOMBRE_ESTADO[e])} (${tecla})`}
                onClick={() => cambiar(e)}
              >
                <i aria-hidden="true" />
                {tr(NOMBRE_ESTADO[e])}
                {e === 'conocida' && hojas > 0 && <span class="hoja-vuela" key={hojas} aria-hidden="true"><Icono n="hoja" t={16} /></span>}
              </button>
            ))}
          </div>
          <button class={`btn-icono chico rastrear ${r.rastreada ? 'activo' : ''}`} data-tip={tr('Rastrear esta palabra · 2')} data-tip-lado="izq" aria-label={tr('Rastrear esta palabra')} aria-pressed={r.rastreada} onClick={() => cambiar(undefined, !r.rastreada)}>
            <Icono n="huella" t={16} />
          </button>
        </div>
        {p.lecturaCorregida && (
          <div class="ficha-notas">
            <span class="nota-ia"><Icono n="ia" t={13} /> {tr('Lectura revisada por Claude')}</span>
          </div>
        )}
      </div>

      <div class="ficha-cuerpo" ref={cuerpo}>
        {panelCompartir('palabra')}
        {corrigiendo && p.contexto.frase && (
          <CorregirLectura contexto={contexto} textoLinea={p.contexto.frase} superficie={p.superficie ?? r.lema} alHecho={p.alCorregirLectura} alCerrar={() => fijarCorrigiendo(false)} />
        )}
        <ConSentido contexto={contexto} definiciones={definicionesUnicas} previo={p.sentidoPrevio} automatico={p.ajustes.sentidoAutomatico} listo={sincronizada} alElegir={fijarElegida} alSentido={fijarSentido}>
          {(bloque, boton) => (
            <>
              {bloque}
              {p.ajustes.ordenContenido.map((b) => (b === 'definiciones' ? <>{bloques[b]}{boton}</> : b === 'pestanas' && pagina ? <>{dock}{bloques[b]}</> : bloques[b]))}
            </>
          )}
        </ConSentido>
      </div>

      {!pagina && dock}

      {(p.alCrear || p.alEnviar) && (
        <div class="ficha-pie">
          {p.alCrear && (
            <button class="btn primario" title={tr('Crear tarjeta de un clic (Q)')} onClick={() => p.alCrear!(r)}>
              <Icono n="rayo" t={16} /> {tr('Crear tarjeta')} <kbd class="tecla">Q</kbd>
            </button>
          )}
          {p.alEnviar && (
            <button class={`btn ${p.alCrear ? '' : 'primario'}`} title={tr('Enviar al creador de tarjetas (E)')} onClick={() => p.alEnviar!(r)}>
              <Icono n="enviar" t={16} /> {tr('Enviar al creador')} {p.alCrear && <kbd class="tecla">E</kbd>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Cómo suena de verdad la frase al hablar seguido: la forma hablada encima de cada trozo que cambia, como el furigana,
 * con una leyenda de lo que pasa en ella. Lo calculan las reglas de la lengua, sin IA.
 */
function PanelComoSuena({ frase }: { frase: string }) {
  const paquete = lengua.value.comoSuena;
  const trozos = useMemo(() => paquete?.analizar(frase) ?? [], [frase, paquete]);
  if (!paquete) return null;
  const presentes = [...new Set(trozos.map((t) => t.fenomeno).filter((f): f is string => !!f))];
  return (
    <div class="como-suena">
      <p class="como-suena-frase" lang={lengua.value.id}>
        {trozos.map((t, i) =>
          t.suena ? (
            <ruby key={i} class={`cs-${t.fenomeno}`}>
              {t.texto}
              <rt>{t.suena}</rt>
            </ruby>
          ) : (
            <span key={i}>{t.texto}</span>
          )
        )}
      </p>
      {presentes.length ? (
        <ul class="como-suena-leyenda">
          {presentes.map((f) => (
            <li key={f}><b class={`cs-${f}`}>{tr(paquete.fenomenos[f]?.nombre ?? f)}</b> {tr(paquete.fenomenos[f]?.explicacion ?? '')}</li>
          ))}
        </ul>
      ) : (
        <p class="ayuda">{tr('Esta frase se dice como se escribe: no hay reducciones ni uniones que marcar.')}</p>
      )}
      <button class="btn chico" onClick={() => decirConNavegador(frase).catch(() => {})}><Icono n="altavoz" t={14} /> {tr('Escuchar la frase')}</button>
    </div>
  );
}

function PreguntaLibre({ contexto, pregunta }: { contexto: ContextoIA; pregunta: string }) {
  return <PanelFlujo metodo="preguntar" args={[contexto, pregunta]} titulo={pregunta} />;
}
