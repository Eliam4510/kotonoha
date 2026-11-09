// El dictado del Portapapeles. «Dictar» graba con el micrófono, lo transcribe con el modelo de voz de los ajustes y
// entrega el texto con el id de su grabación, ya guardada. Mientras graba se ve el tiempo y cuánto suena, para saber que
// el micrófono oye; mientras transcribe, en qué va. Encima de cada párrafo dictado, su grabación se puede volver a oír.

import { useEffect, useRef, useState } from 'preact/hooks';
import { guardarGrabacion, type Grabacion, leerGrabacion } from '../compartido/dictados';
import { bcp47Actual, tr } from '../compartido/i18n';
import { type FlujoCancelable, flujoMotor, motor } from '../compartido/rpc';
import { MAXIMO_DICTADO_MS, minutosYSegundos, nuevoIdDictado } from '../nucleo/dictado';
import { Icono } from '../ui/iconos';
import { lengua } from '../ui/lengua';
import { guardarPreferencia, leerPreferencia } from './estadoApp';
import { abrirPermisosMicrofono, empezarGrabacion, errorDeMicrofono, type Grabadora, type GrabacionHecha } from './grabadora';

/** Lo que cuenta el motor mientras transcribe: es lo mismo que emite con los videos (EventoWhisper en motor/whisper.ts). */
interface EventoDictado {
  tipo: string;
  porcentaje?: number;
}

type Estado =
  | { fase: 'inactivo' }
  | { fase: 'pidiendo' }
  | { fase: 'grabando'; ms: number; nivel: number }
  | { fase: 'transcribiendo'; paso: 'preparando' | 'descarga' | 'procesando' | 'recuperando'; porcentaje?: number }
  | { fase: 'error'; mensaje: string; permiso?: boolean; reintentar?: boolean };

/** Una grabación más corta que esto se tomó por un toque sin querer. */
const MINIMO_MS = 400;
const BARRAS_NIVEL = 5;

/** Lee por partes un flujo cuyo avance llega como líneas de JSON. */
function lectorJson<T>(alEvento: (e: T) => void) {
  let vistos = 0;
  return (acumulado: string) => {
    const texto = acumulado.slice(vistos);
    const fin = texto.lastIndexOf('\n');
    if (fin < 0) return;
    vistos += fin + 1;
    for (const fila of texto.slice(0, fin).split('\n')) if (fila) alEvento(JSON.parse(fila) as T);
  };
}

function textoDelPaso(e: Extract<Estado, { fase: 'transcribiendo' }>): string {
  if (e.paso === 'descarga') return tr('Descargando el modelo de voz: {0} %', e.porcentaje ?? 0);
  if (e.paso === 'recuperando') return tr('La tarjeta gráfica se reinició. Vuelvo a intentarlo…');
  if (e.paso === 'procesando') return e.porcentaje ? tr('Transcribiendo tu grabación: {0} %', e.porcentaje) : tr('Transcribiendo tu grabación…');
  return tr('Preparando el modelo de voz…');
}

/** El botón «Dictar» y lo que enseña mientras graba y transcribe. `alDictar` recibe el texto y el id de su grabación. */
export function Dictado({ alDictar }: { alDictar: (id: string, texto: string) => void }) {
  const [estado, fijar] = useState<Estado>({ fase: 'inactivo' });
  const grabadora = useRef<Grabadora | null>(null);
  /** Lo grabado mientras se transcribe, o si falló: se puede reintentar sin volver a grabar. */
  const grabada = useRef<GrabacionHecha | null>(null);
  const flujo = useRef<FlujoCancelable | null>(null);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
      grabadora.current?.cancelar();
      flujo.current?.cancelar();
    };
  }, []);

  const transcribir = async () => {
    const g = grabada.current;
    if (!g) return;
    fijar({ fase: 'transcribiendo', paso: 'preparando' });
    const url = URL.createObjectURL(g.audio);
    const f = flujoMotor(
      'transcribirDictado',
      [url],
      lectorJson<EventoDictado>((e) => {
        if (flujo.current !== f) return;
        if (e.tipo === 'descarga' || e.tipo === 'procesando') fijar({ fase: 'transcribiendo', paso: e.tipo, porcentaje: e.porcentaje });
        else if (e.tipo === 'recuperando') fijar({ fase: 'transcribiendo', paso: 'recuperando' });
      })
    );
    flujo.current = f;
    try {
      const texto = (await f).trim();
      if (flujo.current !== f || !vivo.current) return;
      if (!texto) {
        grabada.current = null;
        fijar({ fase: 'error', mensaje: tr('No se oyó voz en la grabación.') });
        return;
      }
      const id = nuevoIdDictado();
      await guardarGrabacion({ id, audio: g.audio, duracionMs: g.duracionMs, creado: Date.now(), lengua: lengua.value.id });
      grabada.current = null;
      fijar({ fase: 'inactivo' });
      alDictar(id, texto);
    } catch (e) {
      if (flujo.current !== f || !vivo.current) return;
      fijar({ fase: 'error', mensaje: tr('No se pudo transcribir: {0}', e instanceof Error ? e.message : String(e)), reintentar: true });
    } finally {
      URL.revokeObjectURL(url);
      if (flujo.current === f) flujo.current = null;
    }
  };

  const terminar = async () => {
    const g = grabadora.current;
    grabadora.current = null;
    if (!g) return;
    const hecha = await g.terminar();
    if (!vivo.current) return;
    if (!hecha || hecha.duracionMs < MINIMO_MS) {
      fijar({ fase: 'inactivo' });
      return;
    }
    grabada.current = hecha;
    await transcribir();
  };

  const empezar = async () => {
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
    const f = flujo.current;
    flujo.current = null;
    f?.cancelar();
    grabada.current = null;
    fijar({ fase: 'inactivo' });
  };

  // Mientras graba: el tiempo y el nivel, y el final por tiempo.
  const grabando = estado.fase === 'grabando';
  useEffect(() => {
    if (!grabando) return;
    const reloj = setInterval(() => {
      const g = grabadora.current;
      if (!g) return;
      const ms = g.duracion();
      if (ms >= MAXIMO_DICTADO_MS) void terminar();
      else fijar({ fase: 'grabando', ms, nivel: g.nivel() });
    }, 100);
    return () => clearInterval(reloj);
  }, [grabando]);

  switch (estado.fase) {
    case 'inactivo':
      return (
        <button class="btn fantasma chico ap-dictar" data-tip={tr(lengua.value.textos.dictar)} onClick={() => void empezar()}>
          <Icono n="microfono" t={15} /> {tr('Dictar')}
        </button>
      );
    case 'pidiendo':
      return (
        <div class="ap-dictado" role="status">
          <span class="ap-dictado-girando" aria-hidden="true" />
          <span class="ap-dictado-texto">{tr('Esperando el permiso del micrófono…')}</span>
          <button class="btn fantasma chico" onClick={cancelar}>{tr('Cancelar')}</button>
        </div>
      );
    case 'grabando':
      return (
        <div class="ap-dictado grabando" role="group" aria-label={tr('Grabando')}>
          <span class="ap-dictado-punto" aria-hidden="true" />
          <span class="num ap-dictado-tiempo" role="timer" aria-label={tr('Tiempo grabado')}>{minutosYSegundos(estado.ms)}</span>
          <span class="ap-dictado-nivel" aria-hidden="true">
            {Array.from({ length: BARRAS_NIVEL }, (_, i) => <i key={i} class={estado.nivel > (i + 0.5) / BARRAS_NIVEL ? 'on' : ''} />)}
          </span>
          <button class="btn primario chico" onClick={() => void terminar()}><Icono n="detener" t={14} /> {tr('Terminar')}</button>
          <button class="btn fantasma chico" onClick={cancelar}>{tr('Cancelar')}</button>
        </div>
      );
    case 'transcribiendo':
      return (
        <div class="ap-dictado" role="status">
          <span class="ap-dictado-girando" aria-hidden="true" />
          <span class="ap-dictado-texto">{textoDelPaso(estado)}</span>
          <button class="btn fantasma chico" onClick={cancelar}>{tr('Cancelar')}</button>
        </div>
      );
    case 'error':
      return (
        <div class="ap-dictado error" role="alert">
          <Icono n="aviso" t={15} />
          <span class="ap-dictado-texto">{estado.mensaje}</span>
          {estado.reintentar && <button class="btn chico" onClick={() => void transcribir()}><Icono n="recargar" t={14} /> {tr('Reintentar')}</button>}
          {estado.permiso && <button class="btn chico" onClick={abrirPermisosMicrofono}><Icono n="externo" t={14} /> {tr('Abrir los permisos')}</button>}
          <button class="btn-icono chico" aria-label={tr('Cerrar el aviso')} onClick={cancelar}><Icono n="cerrar" t={14} /></button>
        </div>
      );
  }
}

/** La grabación de un dictado, encima del párrafo que salió de ella. */
export function GrabacionDictada({ id }: { id: string }) {
  // undefined mientras se busca; null si no está en este equipo (una copia de seguridad restaurada en otro).
  const [grabacion, fijarGrabacion] = useState<Grabacion | null | undefined>(undefined);
  const [sonando, fijarSonando] = useState(false);
  const [posicion, fijarPosicion] = useState(0);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let vigente = true;
    leerGrabacion(id)
      .then((g) => vigente && fijarGrabacion(g ?? null))
      .catch(() => vigente && fijarGrabacion(null));
    return () => {
      vigente = false;
      const a = audio.current;
      audio.current = null;
      if (a) {
        a.pause();
        URL.revokeObjectURL(a.src);
      }
    };
  }, [id]);

  if (grabacion === undefined) return <div class="ap-grabacion cargando" aria-hidden="true" />;
  if (grabacion === null) {
    return (
      <div class="ap-grabacion sin-audio" lang={bcp47Actual()}>
        <Icono n="microfono" t={14} /> {tr('La grabación de este dictado no está en este equipo.')}
      </div>
    );
  }

  const alternar = (e: Event) => {
    e.stopPropagation();
    let a = audio.current;
    if (!a) {
      a = new Audio(URL.createObjectURL(grabacion.audio));
      // Lo que graba el navegador no dice cuánto dura: la duración es la que se midió al grabar.
      a.ontimeupdate = () => fijarPosicion(a!.currentTime * 1000);
      a.onplay = () => fijarSonando(true);
      a.onpause = () => fijarSonando(false);
      a.onended = () => {
        fijarSonando(false);
        fijarPosicion(0);
      };
      audio.current = a;
    }
    if (a.paused) a.play().catch(console.error);
    else a.pause();
  };

  const avance = Math.min(100, (posicion / Math.max(grabacion.duracionMs, 1)) * 100);
  return (
    <div class={`ap-grabacion ${sonando ? 'sonando' : ''}`} lang={bcp47Actual()}>
      <button class="btn-icono chico" aria-label={sonando ? tr('Pausar tu grabación') : tr('Oír tu grabación')} data-tip={sonando ? tr('Pausar tu grabación') : tr('Oír tu grabación')} onClick={alternar}>
        <Icono n={sonando ? 'pausa' : 'reproducir'} t={14} />
      </button>
      <span class="ap-grabacion-barra" aria-hidden="true"><i style={{ width: `${avance}%` }} /></span>
      <span class="num ap-grabacion-tiempo">{sonando || posicion > 0 ? `${minutosYSegundos(posicion)} / ` : ''}{minutosYSegundos(grabacion.duracionMs)}</span>
      <span class="ap-grabacion-nombre"><Icono n="microfono" t={13} /> {tr('Tu grabación')}</span>
    </div>
  );
}

/** Se mira una vez al día como mucho: recorre la biblioteca entera. */
const CADA_CUANTO_LIMPIAR_MS = 24 * 60 * 60 * 1000;

/** Pide al motor que borre las grabaciones de esta lengua que ya no usa ningún texto, si hace un día que no se mira. */
export async function limpiarDictadosSiToca(abiertos: string[]): Promise<void> {
  const ahora = Date.now();
  const clave = `dictadosLimpiados-${lengua.value.id}`;
  if (ahora - leerPreferencia(clave, 0) < CADA_CUANTO_LIMPIAR_MS) return;
  guardarPreferencia(clave, ahora);
  await motor.limpiarDictados(abiertos);
}
