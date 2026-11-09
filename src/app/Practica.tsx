// La práctica del acento tonal de una frase. Se ve su acento, se oye, se graba, y Kotonoha pone la curva del tono de la
// grabación sobre la esperada y señala las palabras para revisar, las que no reconoció y las pausas largas. Todo queda en
// el equipo: el tono se mide aquí mismo (nucleo/tono.ts) y la transcripción la hace el modelo de voz en el motor.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { type Ajustes, guardarAjustes, hayVozSintetica } from '../compartido/ajustes';
import { numero, tm, tr } from '../compartido/i18n';
import { type FlujoCancelable, flujoMotor, lectorJson, motor } from '../compartido/rpc';
import type { PalabraToken } from '../compartido/tipos';
import type { TextosMoras } from '../lenguas/tipos';
import { type MoraEspecialOida, morasEspecialesOidas } from '../nucleo/alineacion';
import { minutosYSegundos } from '../nucleo/dictado';
import {
  type FraseAcentual,
  type Juicio,
  juzgarFrases,
  kanaConTiempo,
  type Pausa,
  pausasLargas,
  tonosEsperados,
  type TramoFrase,
  tramosConVoz,
  tramosDeFrases,
  type Veredicto,
} from '../nucleo/practicaAcento';
import { curvaDeTono, type MarcoTono, referenciaDeVoz, semitonos } from '../nucleo/tono';
import { Icono } from '../ui/iconos';
import { motorDe } from '../lenguas/motor';
import { lengua } from '../ui/lengua';
import { decirConNavegador } from '../ui/vozNavegador';
import { navegar } from './estadoApp';
import { abrirPermisosMicrofono, empezarGrabacion, errorDeMicrofono, type Grabadora, type GrabacionHecha } from './grabadora';
import { Interruptor } from './Piezas';

/** Una frase se lee en unos segundos: la grabación se termina sola a los veinte. */
const MAXIMO_MS = 20_000;
const MINIMO_MS = 400;
const FRECUENCIA = 16000;
const BARRAS_NIVEL = 5;
/** Cada cuánto se pide que los modelos sigan cargados mientras el panel está abierto (el motor los suelta a los 3 minutos). */
const MANTENER_CARGADO_MS = 2 * 60 * 1000;

interface Resultado {
  curva: MarcoTono[];
  referencia: number;
  tramos: TramoFrase[];
  juicios: Juicio[];
  pausas: Pausa[];
  /** Lo que enseña la gráfica: de poco antes de la primera voz a poco después de la última, en segundos. */
  desde: number;
  hasta: number;
  audio: Blob;
  /** Las っ, ん y vocales largas que faltan o sobran, si se comprobaron con narabas; o por qué no se pudo. */
  moras?: { errores: MoraEspecialOida[]; especiales: number; juzgadas: number } | { error: string };
}

type Estado =
  | { fase: 'listo' }
  | { fase: 'pidiendo' }
  | { fase: 'grabando'; ms: number; nivel: number }
  | { fase: 'analizando'; paso: string }
  | { fase: 'resultado'; r: Resultado }
  | { fase: 'error'; mensaje: string; permiso?: boolean };

const NOMBRE_VEREDICTO: Record<Veredicto, string> = {
  bien: tm('Bien'),
  revisar: tm('Revisar'),
  'sin-juzgar': tm('Sin juzgar'),
  'sin-datos': tm('Sin datos'),
  'no-oida': tm('No se reconoció'),
};

/** Qué se oyó y qué se esperaba, dicho con las moras de la palabra. */
function explicacion(f: FraseAcentual, j: Juicio): string {
  const tras = (n: number) => f.moras[n - 1] ?? '';
  // El núcleo de la palabra y el que se puede oír: al final de lo dicho, uno en la última mora no tiene dónde caer.
  const nucleo = f.nucleos?.[0] ?? 0;
  const esperado = j.esperado ?? 0;
  switch (j.veredicto) {
    case 'bien':
      if (esperado) return tr('El tono cae después de «{0}», como debe.', tras(esperado));
      return nucleo ? tr('El tono no baja antes de tiempo, como debe.') : tr('El tono no cae, como debe.');
    case 'revisar':
      if (!esperado) {
        return nucleo
          ? tr('El tono debería seguir alto hasta «{0}»; en tu grabación cae después de «{1}».', tras(nucleo), tras(j.caida ?? 0))
          : tr('El tono no debería caer; en tu grabación cae después de «{0}».', tras(j.caida ?? 0));
      }
      if (!j.caida) return tr('El tono cae después de «{0}»; en tu grabación no cae.', tras(esperado));
      return tr('El tono cae después de «{0}»; en tu grabación cae después de «{1}».', tras(esperado), tras(j.caida));
    case 'sin-juzgar':
      return tr('Sin juzgar: no se sabe su acento en esta forma.');
    case 'sin-datos':
      return tr('No hay bastante voz para juzgarla.');
    case 'no-oida':
      return tr('Kotonoha no la reconoció en tu grabación.');
  }
}

/** Dónde va una mora de entre todas las de la frase: en qué frase acentual y en qué lugar de ella. */
function moraEnFrase(frases: FraseAcentual[], mora: number): { frase: FraseAcentual; i: number } | null {
  let base = 0;
  for (const frase of frases) {
    if (mora < base + frase.moras.length) return { frase, i: mora - base };
    base += frase.moras.length;
  }
  return null;
}

/** Qué mora falta o sobra, dicho con las de alrededor dentro de su palabra: «きょう», «きって», «かんじ». */
function explicacionMora(e: MoraEspecialOida, frases: FraseAcentual[], textos: TextosMoras): string {
  const sitio = moraEnFrase(frases, e.mora);
  if (!sitio) return '';
  const { frase, i } = sitio;
  const alrededor = frase.moras.slice(Math.max(0, i - 1), e.error === 'falta' && e.tipo === 'larga' ? i + 1 : i + 2).join('');
  return tr((e.error === 'falta' ? textos.falta : textos.sobra)[e.tipo], alrededor);
}

/**
 * Las っ, ん y vocales largas que faltan o sobran: narabas oye los fonemas en el motor y se comparan con la lectura. Un
 * fallo (sin conexión para la descarga, por ejemplo) no estropea el resto del resultado.
 */
async function comprobarMoras(
  url: string,
  frases: FraseAcentual[],
  alPaso: (texto: string) => void,
  alFlujo: (f: FlujoCancelable) => void
): Promise<Resultado['moras']> {
  const paquete = lengua.value.acento?.practica?.moras;
  if (!paquete) return undefined;
  const porMora = frases.flatMap((f) => paquete.fonemas(f));
  const especiales = paquete.especiales(porMora);
  alPaso(tr('Comprobando las moras…'));
  let oidos: string[];
  try {
    const f = flujoMotor(
      'oirFonemas',
      [url],
      lectorJson<{ tipo: string; porcentaje?: number }>((e) => {
        if (e.tipo === 'descarga') alPaso(tr('Descargando el modelo de las moras: {0} %', e.porcentaje ?? 0));
        else if (e.tipo === 'comprobando') alPaso(tr('Comprobando la descarga…'));
        else if (e.tipo === 'preparando') alPaso(tr('Preparando el modelo de las moras…'));
        else if (e.tipo === 'procesando') alPaso(tr('Comprobando las moras…'));
      })
    );
    alFlujo(f);
    oidos = JSON.parse((await f) || '[]');
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  if (!oidos.length) return { error: tr('No se oyó voz en la grabación.') };
  // Cada frase se juzga por lo que se oye de ella: no se filtra por la transcripción, que justo cuando falta una mora
  // entiende otra palabra (おばさん por おばあさん).
  const fraseDeMora = frases.flatMap((f, i) => f.moras.map(() => i));
  const { errores, juzgadas } = morasEspecialesOidas(porMora, especiales, oidos, fraseDeMora);
  return { errores, especiales: especiales.filter(Boolean).length, juzgadas };
}

/** Mide el tono de la grabación, la transcribe y juzga cada frase acentual; con `moras`, también sus moras especiales. */
async function analizar(
  g: GrabacionHecha,
  frases: FraseAcentual[],
  moras: boolean,
  alPaso: (texto: string) => void,
  alFlujo: (f: FlujoCancelable) => void,
  vigente: () => boolean
): Promise<Resultado | null> {
  alPaso(tr('Midiendo el tono…'));
  const pcm = (await new OfflineAudioContext(1, FRECUENCIA, FRECUENCIA).decodeAudioData(await g.audio.arrayBuffer())).getChannelData(0);
  const curva = curvaDeTono(pcm, FRECUENCIA);
  const sonoros = curva.filter((m) => m.f0 !== null);
  if (!sonoros.length) throw new Error(tr('No se oyó voz en la grabación.'));
  const finVoz = sonoros[sonoros.length - 1].t + 0.05;

  const url = URL.createObjectURL(g.audio);
  try {
    const f = flujoMotor(
      'transcribirPractica',
      [url],
      lectorJson<{ tipo: string; porcentaje?: number }>((e) => {
        if (e.tipo === 'descarga') alPaso(tr('Descargando el modelo de voz: {0} %', e.porcentaje ?? 0));
        else if (e.tipo === 'procesando') alPaso(tr('Escuchando tu grabación…'));
        else if (e.tipo === 'preparando') alPaso(tr('Preparando el modelo de voz…'));
      })
    );
    alFlujo(f);
    const texto = await f;
    if (!vigente()) return null;
    const tokens: { texto: string; t: number }[] = JSON.parse(texto || '[]');

    const reconocido = tokens.map((t) => t.texto).join('');
    if (!reconocido.trim()) throw new Error(tr('No se reconoció nada en la grabación. Prueba a leer más alto o más cerca del micrófono.'));
    const palabras = (await motor.analizarTexto(reconocido, { expresiones: false })).flat();
    const crudos = tramosDeFrases(frases, kanaConTiempo(tokens, palabras, finVoz), finVoz);
    if (!crudos) throw new Error(tr('En la grabación no se reconoce esta frase. Escúchala y vuelve a probar.'));
    const tramos = tramosConVoz(frases, crudos, curva);
    const referencia = referenciaDeVoz(curva);
    const { juicios } = juzgarFrases(frases, tramos, curva, referencia);
    const desde = Math.max(0, Math.min(sonoros[0].t, ...tramos.filter((t) => t.fin > t.inicio).map((t) => t.inicio)) - 0.1);
    const hasta = Math.max(finVoz, ...tramos.map((t) => t.fin)) + 0.1;
    const especiales = moras ? await comprobarMoras(url, frases, alPaso, alFlujo) : undefined;
    if (!vigente()) return null;
    return { curva, referencia, tramos, juicios, pausas: pausasLargas(curva, tramos, frases), desde, hasta, audio: g.audio, moras: especiales };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * El acento esperado de cada palabra: una línea sobre sus moras, alta o baja, que cae donde está el núcleo. `marcadas` son
 * las moras (contadas en toda la frase) donde falta o sobra una っ, una ん o una vocal larga.
 */
function AcentoEsperado({ frases, marcadas }: { frases: FraseAcentual[]; marcadas?: Set<number> }) {
  const ANCHO = 22;
  let base = 0;
  return (
    <div class="ap-practica-acento" lang="ja">
      {frases.map((f, i) => {
        const tonos = f.nucleos ? tonosEsperados(f.moras.length, f.nucleos[0]) : null;
        const puntos = tonos?.map((t, j) => `${j * ANCHO + ANCHO / 2},${t === 'alto' ? 5 : 17}`).join(' ');
        const desde = base;
        base += f.moras.length;
        return (
          <span key={i} class={`ap-practica-palabra ${tonos ? '' : 'sin-acento'}`} title={tonos ? undefined : tr('Sin juzgar: no se sabe su acento en esta forma.')}>
            <svg width={f.moras.length * ANCHO} height="22" viewBox={`0 0 ${f.moras.length * ANCHO} 22`} aria-hidden="true">
              {puntos && <polyline points={puntos} />}
              {tonos?.map((t, j) => <circle key={j} cx={j * ANCHO + ANCHO / 2} cy={t === 'alto' ? 5 : 17} r="2.6" />)}
            </svg>
            <span class="ap-practica-moras">
              {f.moras.map((m, j) => (
                <span key={j} class={marcadas?.has(desde + j) ? 'revisar' : undefined} style={{ width: `${ANCHO}px` }}>{m}</span>
              ))}
            </span>
          </span>
        );
      })}
    </div>
  );
}

/** La curva del tono de la grabación, con el acento esperado de cada frase encima, en su tramo. */
function GraficaTono({ r, frases }: { r: Resultado; frases: FraseAcentual[] }) {
  const ANCHO = 400;
  const ALTO = 176;
  const ARRIBA = 10;
  const ABAJO = 30;
  const MARGEN = 6;
  const st = r.curva.filter((m) => m.f0 !== null).map((m) => semitonos(m.f0!, r.referencia)).sort((a, b) => a - b);
  const percentil = (p: number) => st[Math.min(st.length - 1, Math.max(0, Math.round((st.length - 1) * p)))] ?? 0;
  const minimo = percentil(0.05) - 2.5;
  const maximo = percentil(0.95) + 2.5;
  const alto = percentil(0.8);
  const bajo = percentil(0.2);
  const x = (t: number) => MARGEN + ((Math.min(Math.max(t, r.desde), r.hasta) - r.desde) / (r.hasta - r.desde)) * (ANCHO - 2 * MARGEN);
  const y = (s: number) => ARRIBA + (1 - (s - minimo) / Math.max(maximo - minimo, 1)) * (ALTO - ARRIBA - ABAJO);

  // La curva propia, en trozos: un hueco sin voz la corta.
  const trozos: string[] = [];
  let actual: string[] = [];
  for (const m of r.curva) {
    if (m.f0 === null || m.t < r.desde || m.t > r.hasta) {
      if (actual.length > 1) trozos.push(actual.join(' '));
      actual = [];
      continue;
    }
    actual.push(`${x(m.t).toFixed(1)},${y(semitonos(m.f0, r.referencia)).toFixed(1)}`);
  }
  if (actual.length > 1) trozos.push(actual.join(' '));

  return (
    <svg class="ap-practica-grafica" viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img" aria-label={tr('La curva del tono de tu grabación sobre el acento esperado de cada palabra.')}>
      {r.tramos.map((t, i) =>
        r.juicios[i].veredicto === 'revisar' ? <rect key={`m${i}`} class="revisar" x={x(t.inicio)} y={ARRIBA - 6} width={Math.max(2, x(t.fin) - x(t.inicio))} height={ALTO - ARRIBA - ABAJO + 12} rx="6" /> : null
      )}
      <line class="rejilla" x1={MARGEN} x2={ANCHO - MARGEN} y1={y(alto)} y2={y(alto)} />
      <line class="rejilla" x1={MARGEN} x2={ANCHO - MARGEN} y1={y(bajo)} y2={y(bajo)} />
      {frases.map((f, i) => {
        const t = r.tramos[i];
        if (!f.nucleos || t.fin <= t.inicio) return null;
        const paso = (t.fin - t.inicio) / f.moras.length;
        const puntos = tonosEsperados(f.moras.length, f.nucleos[0]).flatMap((tono, j) => {
          const nivel = y(tono === 'alto' ? alto : bajo).toFixed(1);
          return [`${x(t.inicio + j * paso).toFixed(1)},${nivel}`, `${x(t.inicio + (j + 1) * paso).toFixed(1)},${nivel}`];
        });
        return <polyline key={`e${i}`} class="esperado" points={puntos.join(' ')} />;
      })}
      {trozos.map((p, i) => (
        <polyline key={`v${i}`} class="tuya" points={p} />
      ))}
      {frases.map((f, i) => {
        const t = r.tramos[i];
        const ancho = x(t.fin) - x(t.inicio);
        const texto = ancho < 26 ? '' : ancho < 52 ? Array.from(f.texto).slice(0, 2).join('') : f.texto;
        return (
          <text key={`t${i}`} class="etiqueta" x={(x(t.inicio) + x(t.fin)) / 2} y={ALTO - 10} text-anchor="middle" lang="ja">
            {texto}
          </text>
        );
      })}
      {/* Encima de todo, el tramo de cada frase: al pasar el ratón se ilumina y dice qué palabra es y cómo salió. */}
      {frases.map((f, i) => {
        const t = r.tramos[i];
        if (t.fin <= t.inicio) return null;
        return (
          <rect key={`h${i}`} class="tramo" x={x(t.inicio)} y={0} width={Math.max(2, x(t.fin) - x(t.inicio))} height={ALTO}>
            <title>{`${f.texto} · ${tr(NOMBRE_VEREDICTO[r.juicios[i].veredicto])}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

/** El panel de práctica de una frase, al lado del texto. */
export function Practica({ frase, palabras, ajustes, alCerrar }: { frase: string; palabras: PalabraToken[]; ajustes: Ajustes; alCerrar: () => void }) {
  // El texto viene partido para leer: 雨が降る es una expresión que se consulta entera. Para el acento, cada palabra lleva el
  // suyo, así que la frase se vuelve a partir sin las expresiones con partícula.
  const [sueltas, fijarSueltas] = useState<PalabraToken[] | null>(null);
  useEffect(() => {
    let vigente = true;
    motor
      .analizarTexto(frase, { expresiones: false })
      .then((l) => vigente && fijarSueltas(l.flat()))
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [frase]);
  const frases = useMemo(() => lengua.value.acento?.practica?.frases(sueltas ?? palabras) ?? [], [sueltas, palabras]);
  // Qué decir si falta el diccionario de acento: lo dice el paquete de la lengua, con el nombre de su diccionario.
  const dicAcento = motorDe(lengua.value.id).diccionarios.find((d) => d.tipo === 'acento');
  const textoAviso = lengua.value.acento?.practica?.sinDiccionario;
  const aviso = dicAcento && textoAviso ? tr(textoAviso, tr(dicAcento.titulo)) : '';
  const [estado, fijar] = useState<Estado>({ fase: 'listo' });
  const grabadora = useRef<Grabadora | null>(null);
  const flujo = useRef<FlujoCancelable | null>(null);
  const reproduccion = useRef<HTMLAudioElement | null>(null);
  const vivo = useRef(true);
  const intento = useRef(0);
  const [sinDiccionario, fijarSinDiccionario] = useState(false);
  // Las moras especiales se comprueban con narabas si la lengua sabe sus fonemas y se ha pedido: la primera vez descarga 1,26 GB.
  const textosMoras = lengua.value.acento?.practica?.moras?.textos;
  const sabeMoras = !!textosMoras;
  const [moras, fijarMoras] = useState(ajustes.practicaMoras);
  const cambiarMoras = (v: boolean) => {
    fijarMoras(v);
    guardarAjustes({ practicaMoras: v }).catch(() => {});
  };

  // Los modelos se cargan ya, mientras se escucha y se graba: al terminar, el análisis no espera a leerlos del disco. Y se
  // mantienen cargados mientras el panel esté abierto.
  useEffect(() => {
    const preparar = () => {
      motor.prepararVoz('practica').catch(() => {});
      if (sabeMoras && moras) motor.prepararMoras().catch(() => {});
    };
    preparar();
    const reloj = setInterval(preparar, MANTENER_CARGADO_MS);
    return () => clearInterval(reloj);
  }, [moras]);

  useEffect(() => {
    vivo.current = true;
    motor
      .estado()
      .then((e) => vivo.current && fijarSinDiccionario(!e.diccionarios.some((d) => d.tipo === 'acento')))
      .catch(() => {});
    return () => {
      vivo.current = false;
      grabadora.current?.cancelar();
      flujo.current?.cancelar();
      reproduccion.current?.pause();
    };
  }, []);

  // Antes de pintar: con un efecto normal, un Escape pulsado justo al abrirse el panel se perdería.
  useLayoutEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && estado.fase !== 'grabando') alCerrar();
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [estado.fase]);

  const terminar = async () => {
    const g = grabadora.current;
    grabadora.current = null;
    if (!g) return;
    const hecha = await g.terminar();
    if (!vivo.current) return;
    if (!hecha || hecha.duracionMs < MINIMO_MS) {
      fijar({ fase: 'listo' });
      return;
    }
    const este = ++intento.current;
    const vigente = () => vivo.current && intento.current === este;
    fijar({ fase: 'analizando', paso: tr('Midiendo el tono…') });
    try {
      const r = await analizar(hecha, frases, sabeMoras && moras, (paso) => vigente() && fijar({ fase: 'analizando', paso }), (f) => (flujo.current = f), vigente);
      if (r && vigente()) fijar({ fase: 'resultado', r });
    } catch (e) {
      if (vigente()) fijar({ fase: 'error', mensaje: e instanceof Error ? e.message : String(e) });
    } finally {
      flujo.current = null;
    }
  };

  const grabar = async () => {
    reproduccion.current?.pause();
    fijar({ fase: 'pidiendo' });
    try {
      const g = await empezarGrabacion(() => void terminar());
      if (!vivo.current) {
        g.cancelar();
        return;
      }
      grabadora.current = g;
      fijar({ fase: 'grabando', ms: 0, nivel: 0 });
    } catch (e) {
      if (!vivo.current) return;
      const { mensaje, permiso } = errorDeMicrofono(e);
      fijar({ fase: 'error', mensaje, permiso });
    }
  };

  const cancelar = () => {
    grabadora.current?.cancelar();
    grabadora.current = null;
    intento.current++;
    flujo.current?.cancelar();
    flujo.current = null;
    fijar({ fase: 'listo' });
  };

  const grabando = estado.fase === 'grabando';
  useEffect(() => {
    if (!grabando) return;
    const reloj = setInterval(() => {
      const g = grabadora.current;
      if (!g) return;
      const ms = g.duracion();
      if (ms >= MAXIMO_MS) void terminar();
      else fijar({ fase: 'grabando', ms, nivel: g.nivel() });
    }, 100);
    return () => clearInterval(reloj);
  }, [grabando]);

  // La voz modelo: la local, que lee con el acento del diccionario, o la de Azure; si no hay, la del navegador.
  const oirFrase = async () => {
    reproduccion.current?.pause();
    try {
      const datos = hayVozSintetica(ajustes) ? await motor.vozFrase(frase, ajustes.vocesFrase[0]).catch(() => null) : null;
      if (datos) {
        const a = new Audio(`data:audio/mpeg;base64,${datos}`);
        reproduccion.current = a;
        await a.play();
      } else await decirConNavegador(frase);
    } catch {
      // Sin voz no hay nada que oír; la práctica sigue igual.
    }
  };

  const oirGrabacion = (audio: Blob) => {
    reproduccion.current?.pause();
    const a = new Audio(URL.createObjectURL(audio));
    a.onended = () => URL.revokeObjectURL(a.src);
    reproduccion.current = a;
    a.play().catch(() => {});
  };

  const r = estado.fase === 'resultado' ? estado.r : null;
  const juzgadas = r ? r.juicios.filter((j) => j.veredicto === 'bien' || j.veredicto === 'revisar') : [];
  const bien = juzgadas.filter((j) => j.veredicto === 'bien').length;
  const erroresMoras = r?.moras && 'errores' in r.moras ? r.moras.errores : [];
  const marcadas = erroresMoras.length ? new Set(erroresMoras.map((e) => e.mora)) : undefined;

  return (
    <div class="ap-practica">
      <div class="ap-practica-cab">
        <h3>{tr('Practicar el acento')}</h3>
        <button class="btn-icono chico" aria-label={tr('Cerrar la práctica')} onClick={alCerrar}><Icono n="cerrar" t={15} /></button>
      </div>
      <p class="ap-practica-frase-texto" lang="ja">{frase}</p>
      {frases.length ? <AcentoEsperado frases={frases} marcadas={marcadas} /> : <p class="ayuda">{tr('Esta frase no tiene palabras que practicar.')}</p>}
      {sinDiccionario && aviso && (
        <div class="ap-practica-aviso" role="note">
          <Icono n="info" t={15} />
          <span>{aviso}</span>
          <button class="btn chico" onClick={() => navegar('ajustes')}>{tr('Abrir Ajustes')}</button>
        </div>
      )}

      {estado.fase === 'listo' && (
        <p class="ayuda">
          {tr('Escúchala, pulsa Grabar y léela en voz alta. Kotonoha mira dónde cae el tono en cada palabra.')}
          {textosMoras && moras && ` ${tr(textosMoras.ayuda)}`}
        </p>
      )}

      <div class="ap-practica-botones">
        {estado.fase === 'grabando' ? (
          <div class="ap-dictado grabando" role="group" aria-label={tr('Grabando')}>
            <span class="ap-dictado-punto" aria-hidden="true" />
            <span class="num ap-dictado-tiempo" role="timer">{minutosYSegundos(estado.ms)}</span>
            <span class="ap-dictado-nivel" aria-hidden="true">
              {Array.from({ length: BARRAS_NIVEL }, (_, i) => <i key={i} class={estado.nivel > (i + 0.5) / BARRAS_NIVEL ? 'on' : ''} />)}
            </span>
            <button class="btn primario chico" onClick={() => void terminar()}><Icono n="detener" t={14} /> {tr('Terminar')}</button>
            <button class="btn fantasma chico" onClick={cancelar}>{tr('Cancelar')}</button>
          </div>
        ) : estado.fase === 'pidiendo' || estado.fase === 'analizando' ? (
          <div class="ap-dictado" role="status">
            <span class="ap-dictado-girando" aria-hidden="true" />
            <span class="ap-dictado-texto">{estado.fase === 'pidiendo' ? tr('Esperando el permiso del micrófono…') : estado.paso}</span>
            <button class="btn fantasma chico" onClick={cancelar}>{tr('Cancelar')}</button>
          </div>
        ) : (
          <>
            <button class="btn chico" onClick={() => void oirFrase()}><Icono n="altavoz" t={15} /> {tr('Oír la frase')}</button>
            <button class="btn primario chico" disabled={!frases.length} onClick={() => void grabar()}><Icono n="microfono" t={15} /> {r ? tr('Volver a grabar') : tr('Grabar')}</button>
            {r && <button class="btn chico" onClick={() => oirGrabacion(r.audio)}><Icono n="reproducir" t={14} /> {tr('Oír tu grabación')}</button>}
          </>
        )}
      </div>

      {textosMoras && (
        <div class="ap-practica-opcion">
          <Interruptor etiqueta={tr(textosMoras.opcion)} on={moras} alCambiar={cambiarMoras} />
          <span>
            <b>{tr(textosMoras.opcion)}</b>
            <span class="ayuda">{tr(textosMoras.ayudaOpcion, numero(1.26))}</span>
          </span>
        </div>
      )}

      {estado.fase === 'error' && (
        <div class="ap-dictado error" role="alert">
          <Icono n="aviso" t={15} />
          <span class="ap-dictado-texto">{estado.mensaje}</span>
          {estado.permiso && <button class="btn chico" onClick={abrirPermisosMicrofono}><Icono n="externo" t={14} /> {tr('Abrir los permisos')}</button>}
        </div>
      )}

      {r && (
        <div class="ap-practica-resultado">
          <p class="ap-practica-resumen" role="status">
            {juzgadas.length ? tr('{0} de {1} palabras con el tono en su sitio.', bien, juzgadas.length) : tr('No se pudo juzgar ninguna palabra.')}
          </p>
          <GraficaTono r={r} frases={frases} />
          <div class="leyenda-practica"><span><i class="l-esperado" /> {tr('Esperado')}</span><span><i class="l-tuya" /> {tr('Tu voz')}</span></div>
          <ul class="ap-practica-juicios">
            {frases.map((f, i) => (
              <li key={i}>
                <span class={`ap-veredicto ${r.juicios[i].veredicto}`}>{tr(NOMBRE_VEREDICTO[r.juicios[i].veredicto])}</span>
                <span>
                  <b lang="ja">{f.texto}</b> {explicacion(f, r.juicios[i])}
                </span>
              </li>
            ))}
            {r.pausas.map((p, i) => (
              <li key={`p${i}`}>
                <span class="ap-veredicto pausa">{tr('Pausa')}</span>
                <span>{tr('{0} s entre «{1}» y «{2}»: dentro de una frase, mejor seguido.', numero(p.duracion), frases[p.despuesDe].texto, frases[p.antesDe].texto)}</span>
              </li>
            ))}
            {erroresMoras.map((e, i) => (
              <li key={`m${i}`}>
                <span class="ap-veredicto revisar">{tr('Mora')}</span>
                <span>{textosMoras && explicacionMora(e, frases, textosMoras)}</span>
              </li>
            ))}
            {textosMoras && r.moras && 'errores' in r.moras && !erroresMoras.length && (
              <li>
                {r.moras.juzgadas ? (
                  <>
                    <span class="ap-veredicto bien">{tr('Moras')}</span>
                    <span>{tr(r.moras.especiales ? textosMoras.bien : textosMoras.sinEspeciales)}</span>
                  </>
                ) : (
                  <>
                    <span class="ap-veredicto">{tr('Moras')}</span>
                    <span>{tr('No se pudieron comprobar: {0}', tr('lo que se oye no se parece a la frase.'))}</span>
                  </>
                )}
              </li>
            )}
            {r.moras && 'error' in r.moras && (
              <li>
                <span class="ap-veredicto">{tr('Moras')}</span>
                <span>{tr('No se pudieron comprobar: {0}', r.moras.error)}</span>
              </li>
            )}
          </ul>
          <p class="ayuda">{tr('Es una orientación: con frases leídas, la medida automática no acierta siempre. Compara las dos curvas y escucha tu grabación.')}</p>
        </div>
      )}
    </div>
  );
}
