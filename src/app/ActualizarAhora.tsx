// «Actualizar ahora»: con el ayudante instalado, una copia cargada desde una carpeta pone la versión nueva con un clic.
// Lo usan el aviso de Inicio y la sección «Versión» de Ajustes. Sin ayudante, o en una copia de tienda, no aparece.

import { useEffect, useState } from 'preact/hooks';
import type { InfoAyudante } from '../compartido/api';
import { actualizarConAyudante, puedeActualizar } from '../compartido/ayudante';
import { tr } from '../compartido/i18n';
import { fondo, motor } from '../compartido/rpc';
import { Icono } from '../ui/iconos';

type Estado = { fase: 'listo' } | { fase: 'bajando'; porcentaje: number } | { fase: 'hecho' } | { fase: 'error'; mensaje: string };

export interface Actualizacion {
  /** Si esta copia se puede actualizar desde aquí; undefined mientras se pregunta al ayudante. */
  posible: boolean | undefined;
  estado: Estado;
  actualizar(): void;
  /** Lo que conviene decir debajo del título según el estado. */
  texto: string;
}

export function useActualizacion(version: string | null): Actualizacion {
  const [info, fijarInfo] = useState<InfoAyudante | null | undefined>(undefined);
  const [estado, fijarEstado] = useState<Estado>({ fase: 'listo' });
  useEffect(() => {
    if (!version) return;
    let vigente = true;
    motor
      .ayudante()
      .then((i) => vigente && fijarInfo(i))
      .catch(() => vigente && fijarInfo(null));
    return () => {
      vigente = false;
    };
  }, [version]);

  const posible = info === undefined ? undefined : puedeActualizar(info);
  const actualizar = () => {
    if (!version || estado.fase === 'bajando') return;
    fijarEstado({ fase: 'bajando', porcentaje: 0 });
    actualizarConAyudante(version, (porcentaje) => fijarEstado({ fase: 'bajando', porcentaje }))
      .then(async () => {
        fijarEstado({ fase: 'hecho' });
        await fondo.comprobarActualizacion().catch(() => {});
      })
      .catch((e: unknown) => fijarEstado({ fase: 'error', mensaje: e instanceof Error ? e.message : String(e) }));
  };
  const texto =
    estado.fase === 'bajando' ? tr('Descargando la versión {0}: {1} %', version ?? '', estado.porcentaje)
    : estado.fase === 'hecho' ? tr('Actualizada. Kotonoha se recarga en cuanto termine lo que esté en marcha.')
    : estado.fase === 'error' ? estado.mensaje
    : posible ? tr('El ayudante la descarga, comprueba su SHA-256 y la pone en la carpeta de esta copia. Tus datos no cambian.')
    : tr('Descarga el zip de la extensión y descomprímelo sobre la carpeta de Kotonoha: la extensión se recarga sola.');
  return { posible, estado, actualizar, texto };
}

export function BotonActualizar({ a, primario = true }: { a: Actualizacion; primario?: boolean }) {
  if (!a.posible || a.estado.fase === 'hecho') return null;
  const bajando = a.estado.fase === 'bajando';
  return (
    <button class={`btn chico ${primario ? 'primario' : ''}`} disabled={bajando} aria-busy={bajando} onClick={a.actualizar}>
      <Icono n="descargar" t={14} /> {bajando ? tr('Actualizando…') : a.estado.fase === 'error' ? tr('Reintentar') : tr('Actualizar ahora')}
    </button>
  );
}
