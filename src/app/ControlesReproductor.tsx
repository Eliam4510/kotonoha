// Los controles del reproductor de archivos. Los del navegador no sabían de Kotonoha: su pantalla completa dejaba fuera
// los subtítulos, y para estudiar faltaba casi todo (la velocidad, saltar de línea, ver qué se dice en cada momento de la
// barra). Tocan el <video> como lo hacían ellos, así que la capa de subtítulos no nota el cambio.

import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { irALinea, lineaAnteriorOSiguiente } from '../contenido/controlador';
import { lineasObjetivo, panel } from '../contenido/estado';
import { pestanaVideo } from '../contenido/Paneles';
import { numero, tr } from '../compartido/i18n';
import { lineaEn, reloj, VELOCIDADES } from '../nucleo/reproductor';
import { Icono } from '../ui/iconos';
import { lengua } from '../ui/lengua';

const VOLUMEN = 'kk-reproductor-volumen';
const VELOCIDAD = 'kk-reproductor-velocidad';

/** Lo que se recuerda entre videos y sesiones: el volumen y la velocidad. Sin almacenamiento, se empieza como siempre. */
export function recordado(clave: typeof VOLUMEN | typeof VELOCIDAD, porOmision: number): number {
  try {
    const v = Number(localStorage.getItem(clave));
    return localStorage.getItem(clave) !== null && Number.isFinite(v) ? v : porOmision;
  } catch {
    return porOmision;
  }
}
function recordar(clave: typeof VOLUMEN | typeof VELOCIDAD, v: number) {
  try {
    localStorage.setItem(clave, String(v));
  } catch {
    // Sin almacenamiento no pasa nada: la próxima vez empieza como siempre.
  }
}
export const CLAVES_RECORDADAS = { VOLUMEN, VELOCIDAD } as const;

export const textoVelocidad = (v: number) => `${numero(v, { maximumFractionDigits: 2 })}×`;

/** La velocidad elegida vale también para el archivo siguiente: cambiar de fuente vuelve a defaultPlaybackRate. */
export function fijarVelocidadVideo(v: HTMLVideoElement, x: number) {
  v.defaultPlaybackRate = x;
  v.playbackRate = x;
  recordar(VELOCIDAD, x);
}

/** Silenciar es bajar a cero y recordar el volumen: con otra pista de audio, el video ya va silenciado a propósito. */
let volumenAntes = 1;
export function alternarSonido(v: HTMLVideoElement) {
  if (v.volume > 0) {
    volumenAntes = v.volume;
    v.volume = 0;
  } else v.volume = volumenAntes > 0 ? volumenAntes : 1;
}

export interface PropsControles {
  video: HTMLVideoElement;
  titulo: string;
  visible: boolean;
  pantallaCompleta: boolean;
  alPantallaCompleta: () => void;
  anterior?: () => void;
  siguiente?: () => void;
  listaAbierta: boolean;
  alLista: () => void;
  /** El selector de la pista de audio, si el archivo trae más de una. */
  audio?: ComponentChildren;
  /** Con un menú abierto, los controles no se esconden. */
  alMenu: (abierto: boolean) => void;
}

/** El botón no se queda con el foco al pulsarlo con el ratón: así Espacio sigue siendo reproducir y pausar. */
const sinFoco = (e: MouseEvent) => e.preventDefault();

export function ControlesReproductor(p: PropsControles) {
  const { video } = p;
  const [pausado, fijarPausado] = useState(video.paused);
  const [t, fijarT] = useState(video.currentTime);
  const [dur, fijarDur] = useState(0);
  const [vol, fijarVol] = useState(video.volume);
  const [vel, fijarVel] = useState(video.playbackRate);
  const [menu, fijarMenu] = useState(false);
  const [encima, fijarEncima] = useState<{ x: number; ancho: number; s: number } | null>(null);
  const refMenu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const v = video;
    const leer = () => {
      fijarPausado(v.paused);
      fijarDur(Number.isFinite(v.duration) ? v.duration : 0);
      fijarVol(v.volume);
      fijarVel(v.playbackRate);
      fijarT(v.currentTime);
    };
    const EVENTOS = ['play', 'pause', 'durationchange', 'loadedmetadata', 'volumechange', 'ratechange', 'seeked', 'timeupdate', 'emptied'];
    for (const e of EVENTOS) v.addEventListener(e, leer);
    // Mientras suena, la barra avanza a unos 30 fotogramas por segundo; timeupdate solo llega cuatro veces.
    let raf = 0;
    let ultimo = 0;
    const bucle = (ahora: number) => {
      if (ahora - ultimo > 33) {
        ultimo = ahora;
        fijarT(v.currentTime);
      }
      raf = requestAnimationFrame(bucle);
    };
    const alSonar = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(bucle);
    };
    const alParar = () => cancelAnimationFrame(raf);
    v.addEventListener('play', alSonar);
    v.addEventListener('pause', alParar);
    if (!v.paused) alSonar();
    leer();
    return () => {
      for (const e of EVENTOS) v.removeEventListener(e, leer);
      v.removeEventListener('play', alSonar);
      v.removeEventListener('pause', alParar);
      cancelAnimationFrame(raf);
    };
  }, [video]);

  // El menú de la velocidad se cierra al pulsar fuera o con Escape.
  useEffect(() => {
    p.alMenu(menu);
    if (!menu) return;
    const fuera = (e: PointerEvent) => {
      if (!refMenu.current?.contains(e.target as Node)) fijarMenu(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      fijarMenu(false);
    };
    window.addEventListener('pointerdown', fuera, true);
    window.addEventListener('keydown', escape, true);
    return () => {
      window.removeEventListener('pointerdown', fuera, true);
      window.removeEventListener('keydown', escape, true);
    };
  }, [menu]);

  const hayLineas = lineasObjetivo.value.length > 0;
  const saltarLinea = (dir: -1 | 1) => {
    const l = lineaAnteriorOSiguiente(dir);
    if (l) irALinea(l);
  };
  const fijarVelocidad = (x: number) => {
    fijarVelocidadVideo(video, x);
    fijarMenu(false);
  };
  const fijarVolumen = (x: number) => {
    video.volume = x;
    recordar(VOLUMEN, x);
  };
  const mudo = vol === 0;
  const progreso = dur > 0 ? Math.min(1, t / dur) : 0;
  const lineaEncima = encima && hayLineas ? lineaEn(lineasObjetivo.value, encima.s * 1000) : null;

  return (
    <div class={`ap-rep-controles ${p.visible || menu || pausado ? 'visible' : ''}`} role="group" aria-label={tr('Controles del reproductor')}>
      <div
        class="ap-rep-barra"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
          fijarEncima({ x: e.clientX - r.left, ancho: r.width, s: f * dur });
        }}
        onMouseLeave={() => fijarEncima(null)}
      >
        <div class="ap-rep-pista">
          <div class="ap-rep-hecho" style={{ width: `${progreso * 100}%` }} />
          {encima && <div class="ap-rep-sombra" style={{ width: `${(encima.x / encima.ancho) * 100}%` }} />}
        </div>
        <div class="ap-rep-bolita" style={{ left: `${progreso * 100}%` }} />
        <input
          type="range"
          class="ap-rep-buscar"
          min={0}
          max={dur || 0}
          step={0.1}
          value={t}
          disabled={!dur}
          aria-label={tr('Posición')}
          aria-valuetext={`${reloj(t)} / ${reloj(dur)}`}
          onInput={(e) => {
            video.currentTime = Number(e.currentTarget.value);
            fijarT(video.currentTime);
          }}
        />
        {encima && dur > 0 && (
          <div class={`ap-rep-vista ${lineaEncima ? 'con-linea' : ''}`} style={{ left: `${Math.min(Math.max(encima.x, 130), encima.ancho - 130)}px` }} aria-hidden="true">
            {lineaEncima && <span class="ap-rep-vista-linea" lang={lengua.value.id}>{lineaEncima.texto}</span>}
            <span class="ap-rep-vista-tiempo num">{reloj(encima.s)}</span>
          </div>
        )}
      </div>

      <div class="ap-rep-fila">
        <div class="ap-rep-grupo">
          {p.anterior && (
            <button class="ap-rep-boton" onMouseDown={sinFoco} onClick={p.anterior} aria-label={tr('Archivo anterior')} data-tip-lado="arriba" data-tip={tr('Archivo anterior')}>
              <Icono n="anterior" t={20} />
            </button>
          )}
          <button class="ap-rep-boton grande" onMouseDown={sinFoco} onClick={() => (video.paused ? video.play().catch(() => {}) : video.pause())} aria-label={pausado ? tr('Reproducir') : tr('Pausar')} data-tip-lado="arriba" data-tip={`${pausado ? tr('Reproducir') : tr('Pausar')} · ${tr('Espacio')}`}>
            <Icono n={pausado ? 'reproducir' : 'pausa'} t={26} />
          </button>
          {p.siguiente && (
            <button class="ap-rep-boton" onMouseDown={sinFoco} onClick={p.siguiente} aria-label={tr('Archivo siguiente')} data-tip-lado="arriba" data-tip={tr('Archivo siguiente')}>
              <Icono n="siguiente" t={20} />
            </button>
          )}
          {hayLineas && (
            <>
              <button class="ap-rep-boton" onMouseDown={sinFoco} onClick={() => saltarLinea(-1)} aria-label={tr('Subtítulo anterior')} data-tip-lado="arriba" data-tip={`${tr('Subtítulo anterior')} · A`}>
                <Icono n="atras" t={20} />
              </button>
              <button class="ap-rep-boton" onMouseDown={sinFoco} onClick={() => saltarLinea(1)} aria-label={tr('Subtítulo siguiente')} data-tip-lado="arriba" data-tip={`${tr('Subtítulo siguiente')} · D`}>
                <Icono n="adelante" t={20} />
              </button>
            </>
          )}
          <div class="ap-rep-volumen">
            <button class="ap-rep-boton" onMouseDown={sinFoco} onClick={() => alternarSonido(video)} aria-label={mudo ? tr('Activar el sonido') : tr('Silenciar')} data-tip-lado="arriba" data-tip={`${mudo ? tr('Activar el sonido') : tr('Silenciar')} · M`}>
              <Icono n={mudo ? 'silencio' : 'altavoz'} t={20} />
            </button>
            <input type="range" class="ap-rep-nivel" min={0} max={1} step={0.05} value={vol} aria-label={tr('Volumen')} onInput={(e) => fijarVolumen(Number(e.currentTarget.value))} style={{ '--nivel': `${vol * 100}%` }} />
          </div>
          <span class="ap-rep-reloj num">
            {reloj(t)} <span class="ap-rep-total">/ {reloj(dur)}</span>
          </span>
        </div>

        <div class="ap-rep-titulo" title={p.titulo}>{p.titulo}</div>

        <div class="ap-rep-grupo">
          {p.audio}
          {/* Las pistas, importar otras y la sincronía: el panel de la capa, que si no solo sale al pasar por arriba. */}
          <button
            class={`ap-rep-boton ${panel.value === 'video' && pestanaVideo.value === 'subtitulos' ? 'activo' : ''}`}
            onMouseDown={sinFoco}
            onClick={() => {
              const abierto = panel.value === 'video' && pestanaVideo.value === 'subtitulos';
              pestanaVideo.value = 'subtitulos';
              panel.value = abierto ? null : 'video';
            }}
            aria-label={tr('Subtítulos')}
            data-tip-lado="arriba"
            data-tip={tr('Subtítulos: elegir, importar o sincronizar')}
          >
            <Icono n="cc" t={20} />
          </button>
          <div class="ap-rep-menu-ancla" ref={refMenu}>
            <button class={`ap-rep-boton texto ${vel !== 1 ? 'cambiado' : ''}`} onMouseDown={sinFoco} onClick={() => fijarMenu(!menu)} aria-haspopup="menu" aria-expanded={menu} aria-label={tr('Velocidad: {0}', textoVelocidad(vel))} data-tip-lado="arriba" data-tip={menu ? undefined : `${tr('Velocidad')} · < >`}>
              {textoVelocidad(vel)}
            </button>
            {menu && (
              <div class="ap-rep-menu" role="menu" aria-label={tr('Velocidad')}>
                {[...VELOCIDADES].reverse().map((x) => (
                  <button key={x} role="menuitemradio" aria-checked={Math.abs(x - vel) < 0.001} class={Math.abs(x - vel) < 0.001 ? 'activo' : ''} onClick={() => fijarVelocidad(x)}>
                    {x === 1 ? tr('Normal') : textoVelocidad(x)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button class={`ap-rep-boton ${p.listaAbierta ? 'activo' : ''}`} onMouseDown={sinFoco} onClick={p.alLista} aria-pressed={p.listaAbierta} aria-label={tr('Lista de reproducción')} data-tip-lado="arriba" data-tip={tr('Lista de reproducción')}>
            <Icono n="lista" t={20} />
          </button>
          <button class="ap-rep-boton" onMouseDown={sinFoco} onClick={p.alPantallaCompleta} aria-label={p.pantallaCompleta ? tr('Salir de pantalla completa') : tr('Pantalla completa')} data-tip-lado="arriba" data-tip={`${p.pantallaCompleta ? tr('Salir de pantalla completa') : tr('Pantalla completa')} · F`}>
            <Icono n={p.pantallaCompleta ? 'salir-pantalla' : 'pantalla-completa'} t={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
