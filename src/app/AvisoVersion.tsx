// El aviso de Inicio cuando hay una versión nueva de Kotonoha en GitHub: qué versión es, qué trae y cómo ponerla, con un
// clic si el ayudante está instalado. Se cierra por versión: cerrado, no vuelve hasta que salga otra. Se apaga en
// Ajustes, en «Versión».

import { useEffect, useState } from 'preact/hooks';
import { avisoCerrado, buscarVersionNueva, cerrarAviso, type VersionPublicada } from '../compartido/actualizaciones';
import { idiomaActual, tr } from '../compartido/i18n';
import { novedadesDeTitulo } from '../nucleo/versiones';
import { Icono } from '../ui/iconos';
import { BotonActualizar, useActualizacion } from './ActualizarAhora';

export function AvisoVersion({ avisar }: { avisar: boolean }) {
  const [nueva, fijarNueva] = useState<VersionPublicada | null>(null);
  const actualizacion = useActualizacion(nueva?.version ?? null);

  useEffect(() => {
    fijarNueva(null);
    if (!avisar) return;
    let vigente = true;
    (async () => {
      const n = await buscarVersionNueva();
      if (vigente && n && !(await avisoCerrado(n.version))) fijarNueva(n);
    })().catch(() => {});
    return () => {
      vigente = false;
    };
  }, [avisar]);

  if (!nueva) return null;
  // Los títulos de las versiones se escriben en español: en otro idioma de la interfaz basta el número.
  const novedades = idiomaActual() === 'es' ? novedadesDeTitulo(nueva.titulo) : '';
  return (
    <section class="tarjeta ap-aviso-version ap-c12" aria-label={tr('Versión nueva')}>
      <span class="ap-aviso-version-icono"><Icono n="sello" t={20} /></span>
      <div class="ap-aviso-version-texto">
        <b>{tr('Kotonoha {0} ya está disponible', nueva.version)}{novedades && <span class="ap-aviso-version-trae"> · {novedades}</span>}</b>
        {/* El paquete lleva compilacion.txt al final: al descomprimirlo encima, la extensión ve el cambio y se recarga. */}
        <span role="status">{actualizacion.texto}</span>
      </div>
      <BotonActualizar a={actualizacion} />
      <a class={`btn chico ${actualizacion.posible ? 'fantasma' : 'primario'}`} href={nueva.url} target="_blank" rel="noreferrer noopener">{tr('Ver la versión')} <Icono n="externo" t={13} /></a>
      <button
        class="btn-icono chico"
        aria-label={tr('Cerrar el aviso')}
        onClick={() => {
          cerrarAviso(nueva.version).catch(() => {});
          fijarNueva(null);
        }}
      >
        <Icono n="cerrar" t={14} />
      </button>
    </section>
  );
}
