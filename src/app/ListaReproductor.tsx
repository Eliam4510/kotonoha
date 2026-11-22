// La lista del reproductor de archivos y lo último que se vio: con su miniatura, cuánto queda y si ya se terminó.

import { bcp47Actual, tr } from '../compartido/i18n';
import { reloj, sinExtension } from '../nucleo/reproductor';
import { Icono } from '../ui/iconos';
import type { Visto } from './reproductorDatos';

/** Un archivo de la lista: lo que llegó (File) o el acceso a él, que se lee al abrirlo. */
export interface Fuente {
  nombre: string;
  /** La ruta dentro de la carpeta elegida, o el nombre si llegó suelto. */
  ruta: string;
  archivo?: File;
  asa?: FileSystemFileHandle;
}

export interface Elemento extends Fuente {
  id: number;
  tipo: 'video' | 'audio';
  subtitulos: Fuente[];
}

/** «Hace 5 minutos», «ayer», en el idioma de la interfaz. */
export function hace(ms: number, ahora = Date.now()): string {
  const f = new Intl.RelativeTimeFormat(bcp47Actual(), { numeric: 'auto' });
  const s = Math.round((ms - ahora) / 1000);
  if (s > -60) return f.format(0, 'second');
  if (s > -3600) return f.format(Math.round(s / 60), 'minute');
  if (s > -86400) return f.format(Math.round(s / 3600), 'hour');
  if (s > -86400 * 30) return f.format(Math.round(s / 86400), 'day');
  return new Date(ms).toLocaleDateString(bcp47Actual(), { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Lo que falta o lo que se lleva: «12:34 de 23:40», o que ya se terminó. */
function avance(v: Visto | undefined) {
  if (!v || !v.duracion) return null;
  if (v.terminado) return <span class="ap-rep-avance terminado"><Icono n="check" t={13} /> {tr('Visto')}</span>;
  if (v.posicion < 5) return <span class="ap-rep-avance num">{reloj(v.duracion)}</span>;
  return <span class="ap-rep-avance num">{tr('{0} de {1}', reloj(v.posicion), reloj(v.duracion))}</span>;
}

function Miniatura({ v, tipo }: { v?: Visto; tipo: 'video' | 'audio' }) {
  const parte = v?.duracion ? Math.min(1, v.terminado ? 1 : v.posicion / v.duracion) : 0;
  return (
    <span class="ap-rep-mini">
      {v?.miniatura ? <img src={v.miniatura} alt="" /> : <Icono n={tipo === 'audio' ? 'ondas' : 'pelicula'} t={22} />}
      {parte > 0 && <span class="ap-rep-mini-avance" style={{ width: `${parte * 100}%` }} />}
    </span>
  );
}

export function Recientes({ vistos, alAbrir, alOlvidar }: { vistos: Visto[]; alAbrir: (v: Visto) => void; alOlvidar: (v: Visto) => void }) {
  if (!vistos.length) return null;
  return (
    <section class="ap-rep-recientes" aria-label={tr('Seguir viendo')}>
      <h2><Icono n="historial" t={17} /> {tr('Seguir viendo')}</h2>
      <ul>
        {vistos.map((v) => (
          <li key={v.clave} class="ap-rep-reciente">
            <button class="ap-rep-reciente-abrir" onClick={() => alAbrir(v)} title={v.asa ? v.nombre : tr('Vuelve a elegir {0} para seguir donde lo dejaste', v.nombre)}>
              <Miniatura v={v} tipo={v.tipo} />
              <span class="ap-rep-reciente-texto">
                <b>{sinExtension(v.nombre)}</b>
                <small>{avance(v)}<span class="ap-rep-cuando">{hace(v.actualizado)}</span></small>
              </span>
              {!v.asa && <span class="ap-rep-sin-acceso" title={tr('Kotonoha no tiene acceso a este archivo: al pulsar, elígelo otra vez')}><Icono n="carpeta" t={14} /></span>}
            </button>
            <button class="btn-icono chico ap-rep-olvidar" onClick={() => alOlvidar(v)} aria-label={tr('Quitar {0} de la lista', sinExtension(v.nombre))} data-tip={tr('Quitar de la lista')}>
              <Icono n="cerrar" t={14} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export interface PropsPanelLista {
  lista: Elemento[];
  actual: number;
  vistosPorNombre: Map<string, Visto>;
  alAbrir: (i: number) => void;
  alQuitar: (i: number) => void;
  alVaciar: () => void;
  alAnadir: () => void;
  alCarpeta?: () => void;
  alCerrar: () => void;
}

export function PanelLista(p: PropsPanelLista) {
  return (
    <aside class="ap-rep-lista" aria-label={tr('Lista de reproducción')}>
      <header class="ap-rep-lista-cab">
        <h2>{tr('Lista de reproducción')} <span class="num">{p.lista.length}</span></h2>
        <button class="btn-icono chico" onClick={p.alAnadir} aria-label={tr('Añadir archivos')} data-tip={tr('Añadir archivos')}><Icono n="mas" t={16} /></button>
        {p.alCarpeta && <button class="btn-icono chico" onClick={p.alCarpeta} aria-label={tr('Abrir una carpeta')} data-tip={tr('Abrir una carpeta')}><Icono n="carpeta" t={16} /></button>}
        <button class="btn-icono chico" onClick={p.alVaciar} aria-label={tr('Vaciar la lista')} data-tip={tr('Vaciar la lista')}><Icono n="basura" t={16} /></button>
        <button class="btn-icono chico" onClick={p.alCerrar} aria-label={tr('Cerrar la lista')} data-tip={tr('Cerrar')}><Icono n="cerrar" t={16} /></button>
      </header>
      <ol class="ap-rep-lista-elementos">
        {p.lista.map((e, i) => {
          const v = p.vistosPorNombre.get(e.nombre);
          const carpeta = e.ruta.includes('/') ? e.ruta.slice(0, e.ruta.lastIndexOf('/')) : '';
          return (
            <li key={e.id} class={`ap-rep-elemento ${i === p.actual ? 'actual' : ''} ${v?.terminado ? 'terminado' : ''}`}>
              <button class="ap-rep-elemento-abrir" onClick={() => p.alAbrir(i)} aria-current={i === p.actual ? 'true' : undefined}>
                <Miniatura v={v} tipo={e.tipo} />
                <span class="ap-rep-elemento-texto">
                  <b>{sinExtension(e.nombre)}</b>
                  <small>
                    {i === p.actual ? <span class="ap-rep-ahora"><Icono n="reproducir" t={11} /> {tr('Ahora')}</span> : avance(v)}
                    {e.subtitulos.length > 0 && <span class="ap-rep-con-subs" title={e.subtitulos.map((s) => s.nombre).join('\n')}><Icono n="subtitulos" t={12} /> {e.subtitulos.length}</span>}
                    {carpeta && <span class="ap-rep-carpeta">{carpeta}</span>}
                  </small>
                </span>
              </button>
              <button class="btn-icono chico ap-rep-quitar" onClick={() => p.alQuitar(i)} aria-label={tr('Quitar {0} de la lista', sinExtension(e.nombre))} data-tip={tr('Quitar de la lista')} data-tip-lado="izq">
                <Icono n="cerrar" t={14} />
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
