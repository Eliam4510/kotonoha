// La práctica de los tonos de una frase, en una lengua tonal como el chino. Se ven sus sílabas con el tono con que se
// dicen en la frase, se oye, se graba, y Kotonoha pone la curva del tono de cada sílaba sobre la forma del suyo y
// señala las que no cuadran. Todo queda en el equipo y sin modelos: el tono se mide con YIN (nucleo/tono.ts) y las
// sílabas se parten por la voz y la energía (nucleo/practicaTonos.ts), sin transcribir.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { type Ajustes, hayVozSintetica } from '../compartido/ajustes';
import { tm, tr } from '../compartido/i18n';
import { motor } from '../compartido/rpc';
import type { PalabraToken } from '../compartido/tipos';
import { minutosYSegundos } from '../nucleo/dictado';
import { juzgarTonos, type ResultadoTonos, type SilabaTonal, type VeredictoTono } from '../nucleo/practicaTonos';
import { curvaDeTono, type MarcoTono, semitonos } from '../nucleo/tono';
import { Icono } from '../ui/iconos';
import { lengua } from '../ui/lengua';
import { decirConNavegador } from '../ui/vozNavegador';
import { abrirPermisosMicrofono, empezarGrabacion, errorDeMicrofono, type Grabadora, type GrabacionHecha } from './grabadora';

const MAXIMO_MS = 20_000;
const MINIMO_MS = 400;
const FRECUENCIA = 16000;
const BARRAS_NIVEL = 5;

interface Resultado extends ResultadoTonos {
  curva: MarcoTono[];
  desde: number;
  hasta: number;
  audio: Blob;
}

type Estado =
  | { fase: 'listo' }
  | { fase: 'pidiendo' }
  | { fase: 'grabando'; ms: number; nivel: number }
  | { fase: 'analizando' }
  | { fase: 'resultado'; r: Resultado }
  | { fase: 'error'; mensaje: string; permiso?: boolean };

/** La forma de cada tono en los cinco niveles de Chao, para dibujarla: alto y llano, sube, bajo (y sube antes de una pausa), cae. */
const FORMAS: Record<number, number[]> = { 1: [5, 5], 2: [3, 5], 3: [2, 1, 1], 4: [5, 1] };
const FORMA_TERCERO_FINAL = [2, 1, 4];
const forma = (s: SilabaTonal) => (s.tono === 3 && s.pausa ? FORMA_TERCERO_FINAL : FORMAS[s.tono]);

const NOMBRE_VEREDICTO: Record<VeredictoTono, string> = {
  bien: tm('Bien'),
  revisar: tm('Revisar'),
  'sin-datos': tm('Sin datos'),
  'sin-juzgar': tm('Sin juzgar'),
};

/** Lo que se espera de cada tono y lo que se oyó en su lugar: frases enteras, que se traducen enteras. */
const EXPLICACIONES: Record<string, string> = {
  '1-cae': tm('Primer tono: alto y llano. En tu grabación cae.'),
  '1-sube': tm('Primer tono: alto y llano. En tu grabación sube.'),
  '1-bajo': tm('Primer tono: alto y llano. En tu grabación se queda bajo.'),
  '2-cae': tm('Segundo tono: sube. En tu grabación cae.'),
  '2-llano': tm('Segundo tono: sube. En tu grabación no llega a subir.'),
  '3-cae': tm('Tercer tono: bajo. En tu grabación cae desde arriba, como el cuarto.'),
  '3-sube': tm('Tercer tono: bajo. En tu grabación sube, como el segundo.'),
  '3-alto': tm('Tercer tono: bajo. En tu grabación se queda alto.'),
  '4-sube': tm('Cuarto tono: cae desde arriba. En tu grabación sube.'),
  '4-llano': tm('Cuarto tono: cae desde arriba. En tu grabación no llega a caer.'),
  '4-bajo': tm('Cuarto tono: cae desde arriba. En tu grabación cae, pero desde abajo, como el tercero.'),
};

/** Mide el tono de la grabación, parte la voz en las sílabas de la frase y juzga cada una. */
async function analizar(g: GrabacionHecha, silabas: SilabaTonal[]): Promise<Resultado> {
  const pcm = (await new OfflineAudioContext(1, FRECUENCIA, FRECUENCIA).decodeAudioData(await g.audio.arrayBuffer())).getChannelData(0);
  const curva = curvaDeTono(pcm, FRECUENCIA);
  const sonoros = curva.filter((m) => m.f0 !== null);
  if (!sonoros.length) throw new Error(tr('No se oyó voz en la grabación.'));
  const r = juzgarTonos(curva, silabas);
  if (!r) throw new Error(tr('En tu grabación no se distinguen todas las sílabas. Léela algo más despacio, cada sílaba con su vocal.'));
  const desde = Math.max(0, r.tramos[0].inicio - 0.1);
  const hasta = r.tramos[r.tramos.length - 1].fin + 0.1;
  return { ...r, curva, desde, hasta, audio: g.audio };
}

/** Las sílabas de la frase, con la forma del tono de cada una encima y su lectura, del color de su tono. */
function TonosEsperados({ silabas, marcadas }: { silabas: SilabaTonal[]; marcadas?: Set<number> }) {
  const ANCHO = 30;
  const y = (nivel: number) => 19 - (nivel - 1) * 3.5;
  return (
    <div class="ap-practica-acento ap-practica-tonos" lang={lengua.value.id}>
      {silabas.map((s, i) => {
        const f = forma(s);
        const puntos = f?.map((n, j) => `${4 + (j / (f.length - 1)) * (ANCHO - 8)},${y(n)}`).join(' ');
        const color = lengua.value.acento?.silaba?.(s.lectura);
        return (
          <span key={i} class={`ap-practica-silaba ${color ? `ac-${color}` : 'neutra'} ${marcadas?.has(i) ? 'revisar' : ''}`} title={s.tono === 5 ? tr('Tono neutro: no se juzga.') : undefined}>
            <svg width={ANCHO} height="22" viewBox={`0 0 ${ANCHO} 22`} aria-hidden="true">
              {puntos ? <polyline points={puntos} /> : <circle cx={ANCHO / 2} cy={y(3)} r="2.2" />}
            </svg>
            <span class="ap-practica-caracter">{s.texto}</span>
            <span class="ap-practica-pinyin">{s.lectura}</span>
          </span>
        );
      })}
    </div>
  );
}

/** La curva del tono de la grabación, con la forma esperada de cada sílaba en su tramo, a la altura de la voz de quien habla. */
function GraficaTonos({ r, silabas }: { r: Resultado; silabas: SilabaTonal[] }) {
  const ANCHO = 400;
  const ALTO = 176;
  const ARRIBA = 10;
  const ABAJO = 30;
  const MARGEN = 6;
  const minimo = r.registro.bajo - 3;
  const maximo = r.registro.alto + 3;
  const x = (t: number) => MARGEN + ((Math.min(Math.max(t, r.desde), r.hasta) - r.desde) / (r.hasta - r.desde)) * (ANCHO - 2 * MARGEN);
  const y = (s: number) => ARRIBA + (1 - (s - minimo) / Math.max(maximo - minimo, 1)) * (ALTO - ARRIBA - ABAJO);
  // Los cinco niveles de Chao, sobre lo que abarca la voz: el 1 abajo y el 5 arriba.
  const nivel = (n: number) => r.registro.bajo + ((n - 1) / 4) * (r.registro.alto - r.registro.bajo);

  const trozos: string[] = [];
  let actual: string[] = [];
  for (const m of r.curva) {
    if (m.f0 === null || m.t < r.desde || m.t > r.hasta) {
      if (actual.length > 1) trozos.push(actual.join(' '));
      actual = [];
      continue;
    }
    actual.push(`${x(m.t).toFixed(1)},${y(semitonos(m.f0, r.registro.referencia)).toFixed(1)}`);
  }
  if (actual.length > 1) trozos.push(actual.join(' '));

  return (
    <svg class="ap-practica-grafica" viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img" aria-label={tr('La curva del tono de tu grabación sobre la forma del tono de cada sílaba.')}>
      {r.tramos.map((t, i) =>
        r.juicios[i].veredicto === 'revisar' ? <rect key={`m${i}`} class="revisar" x={x(t.inicio)} y={ARRIBA - 6} width={Math.max(2, x(t.fin) - x(t.inicio))} height={ALTO - ARRIBA - ABAJO + 12} rx="6" /> : null
      )}
      <line class="rejilla" x1={MARGEN} x2={ANCHO - MARGEN} y1={y(r.registro.alto)} y2={y(r.registro.alto)} />
      <line class="rejilla" x1={MARGEN} x2={ANCHO - MARGEN} y1={y(r.registro.bajo)} y2={y(r.registro.bajo)} />
      {silabas.map((s, i) => {
        const f = forma(s);
        const t = r.tramos[i];
        if (!f || t.fin <= t.inicio) return null;
        // La forma va sobre la parte de la sílaba que tiene voz, que es donde se oye el tono.
        const voz = r.curva.filter((m) => m.f0 !== null && m.t >= t.inicio && m.t < t.fin);
        const a = voz[0]?.t ?? t.inicio;
        const b = voz[voz.length - 1]?.t ?? t.fin;
        const puntos = f.map((n, j) => `${x(a + (j / (f.length - 1)) * (b - a)).toFixed(1)},${y(nivel(n)).toFixed(1)}`);
        return <polyline key={`e${i}`} class="esperado" points={puntos.join(' ')} />;
      })}
      {trozos.map((p, i) => (
        <polyline key={`v${i}`} class="tuya" points={p} />
      ))}
      {silabas.map((s, i) => {
        const t = r.tramos[i];
        return (
          <text key={`t${i}`} class="etiqueta" x={(x(t.inicio) + x(t.fin)) / 2} y={ALTO - 10} text-anchor="middle" lang={lengua.value.id}>
            {x(t.fin) - x(t.inicio) < 12 ? '' : s.texto}
          </text>
        );
      })}
      {silabas.map((s, i) => {
        const t = r.tramos[i];
        if (t.fin <= t.inicio) return null;
        return (
          <rect key={`h${i}`} class="tramo" x={x(t.inicio)} y={0} width={Math.max(2, x(t.fin) - x(t.inicio))} height={ALTO}>
            <title>{`${s.texto} ${s.lectura} · ${tr(NOMBRE_VEREDICTO[r.juicios[i].veredicto])}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

/** El panel de práctica de los tonos de una frase. */
export function PracticaTonos({ frase, palabras, ajustes, alCerrar }: { frase: string; palabras: PalabraToken[]; ajustes: Ajustes; alCerrar: () => void }) {
  // La frase se vuelve a analizar entera: los cambios de tono dependen de las sílabas de alrededor.
  const [analizadas, fijarAnalizadas] = useState<PalabraToken[] | null>(null);
  useEffect(() => {
    let vigente = true;
    motor
      .analizarTexto(frase)
      .then((l) => vigente && fijarAnalizadas(l.flat()))
      .catch(() => vigente && fijarAnalizadas([]));
    return () => {
      vigente = false;
    };
  }, [frase]);
  const silabas = useMemo(() => lengua.value.acento?.tonos?.silabas(analizadas ?? palabras) ?? [], [analizadas, palabras]);
  const juzgables = silabas.filter((s) => s.tono !== 5).length;
  const [estado, fijar] = useState<Estado>({ fase: 'listo' });
  const grabadora = useRef<Grabadora | null>(null);
  const reproduccion = useRef<HTMLAudioElement | null>(null);
  const vivo = useRef(true);
  const intento = useRef(0);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
      grabadora.current?.cancelar();
      reproduccion.current?.pause();
    };
  }, []);

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
    fijar({ fase: 'analizando' });
    try {
      const r = await analizar(hecha, silabas);
      if (vigente()) fijar({ fase: 'resultado', r });
    } catch (e) {
      if (vigente()) fijar({ fase: 'error', mensaje: e instanceof Error ? e.message : String(e) });
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
  const marcadas = r ? new Set(r.juicios.map((j, i) => (j.veredicto === 'revisar' ? i : -1)).filter((i) => i >= 0)) : undefined;
  const avisos = r ? silabas.map((s, i) => ({ s, j: r.juicios[i] })).filter(({ j }) => j.veredicto === 'revisar' || j.veredicto === 'sin-datos') : [];

  return (
    <div class="ap-practica">
      <div class="ap-practica-cab">
        <h3>{tr('Practicar los tonos')}</h3>
        <button class="btn-icono chico" aria-label={tr('Cerrar la práctica')} onClick={alCerrar}><Icono n="cerrar" t={15} /></button>
      </div>
      {silabas.length ? (
        <TonosEsperados silabas={silabas} marcadas={marcadas} />
      ) : analizadas === null ? (
        <span class="giro" aria-label={tr('Cargando…')} />
      ) : (
        <p class="ayuda">{tr('Esta frase no tiene palabras que practicar.')}</p>
      )}

      {estado.fase === 'listo' && <p class="ayuda">{tr('Escúchala, pulsa Grabar y léela en voz alta, sin prisa. Kotonoha parte tu voz en sílabas y mira la forma del tono de cada una; el tono neutro no se juzga.')}</p>}

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
            <span class="ap-dictado-texto">{estado.fase === 'pidiendo' ? tr('Esperando el permiso del micrófono…') : tr('Midiendo el tono…')}</span>
            <button class="btn fantasma chico" onClick={cancelar}>{tr('Cancelar')}</button>
          </div>
        ) : (
          <>
            <button class="btn chico" onClick={() => void oirFrase()}><Icono n="altavoz" t={15} /> {tr('Oír la frase')}</button>
            <button class="btn primario chico" disabled={!juzgables} onClick={() => void grabar()}><Icono n="microfono" t={15} /> {r ? tr('Volver a grabar') : tr('Grabar')}</button>
            {r && <button class="btn chico" onClick={() => oirGrabacion(r.audio)}><Icono n="reproducir" t={14} /> {tr('Oír tu grabación')}</button>}
          </>
        )}
      </div>

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
            {juzgadas.length ? tr('{0} de {1} sílabas con la forma de su tono.', bien, juzgadas.length) : tr('No se pudo juzgar ninguna sílaba.')}
          </p>
          <GraficaTonos r={r} silabas={silabas} />
          <div class="leyenda-practica"><span><i class="l-esperado" /> {tr('Esperado')}</span><span><i class="l-tuya" /> {tr('Tu voz')}</span></div>
          <ul class="ap-practica-juicios">
            {avisos.map(({ s, j }) => {
              const i = silabas.indexOf(s);
              return (
                <li key={i}>
                  <span class={`ap-veredicto ${j.veredicto}`}>{tr(NOMBRE_VEREDICTO[j.veredicto])}</span>
                  <span>
                    <b lang={lengua.value.id}>{s.texto}</b> {s.lectura} · {j.veredicto === 'sin-datos' ? tr('No hay bastante voz en esta sílaba para juzgarla.') : tr(EXPLICACIONES[`${s.tono}-${j.oida}`] ?? '')}
                  </span>
                </li>
              );
            })}
            {!avisos.length && juzgadas.length > 0 && (
              <li>
                <span class="ap-veredicto bien">{tr('Bien')}</span>
                <span>{tr('Todas las sílabas tienen la forma de su tono.')}</span>
              </li>
            )}
          </ul>
          <p class="ayuda">{tr('Es una orientación: sin saber dónde empieza cada sílaba, la medida automática no acierta siempre. Compara las curvas y escucha tu grabación.')}</p>
        </div>
      )}
    </div>
  );
}
