// Compartir una palabra o un punto de gramática como imagen: el clic dibuja la tarjeta y la copia al portapapeles en el
// acto, lista para pegarla en un chat con Ctrl+V. Queda a la vista para cambiarle el estilo, copiarla otra vez o guardarla.

import { useEffect, useState } from 'preact/hooks';
import { tr } from '../compartido/i18n';
import { Icono } from './iconos';
import { copiarImagen, crearTarjeta, type DatosTarjeta, type EstiloTarjeta, guardarImagen } from './tarjeta';

export interface Compartida {
  /** Dónde se pidió: la ficha enseña la vista previa junto a ese botón. */
  origen: string;
  nombre: string;
  estilo: EstiloTarjeta;
  datos: DatosTarjeta;
  letraLengua?: string;
  imagen: Promise<Blob>;
  copia: Promise<void>;
}

// El último estilo elegido, para la próxima tarjeta. Se lee al cargar: el clic no puede esperar a leerlo.
let estiloElegido: EstiloTarjeta | null = null;
try {
  chrome.storage?.local
    .get('estiloTarjeta')
    .then((d) => {
      if (!estiloElegido && (d.estiloTarjeta === 'claro' || d.estiloTarjeta === 'oscuro')) estiloElegido = d.estiloTarjeta;
    })
    .catch(() => {});
} catch {
  // Fuera de la extensión (en las pruebas) no hay dónde recordarlo.
}

/** Empieza a compartir en el mismo clic: dibuja la tarjeta y la copia sin esperar a que esté lista. */
export function compartir(origen: string, datos: DatosTarjeta, nombre: string, estiloPorOmision: EstiloTarjeta, letraLengua?: string, estilo = estiloElegido ?? estiloPorOmision): Compartida {
  const imagen = crearTarjeta(datos, estilo, letraLengua);
  const copia = copiarImagen(imagen);
  imagen.catch(() => {});
  copia.catch(() => {});
  return { origen, nombre, estilo, datos, letraLengua, imagen, copia };
}

export function PanelCompartir({ c, alCambiar, alCerrar }: { c: Compartida; alCambiar: (c: Compartida) => void; alCerrar: () => void }) {
  const [url, fijarUrl] = useState('');
  const [estado, fijarEstado] = useState<'copiando' | 'copiada' | 'sin-copiar' | 'error'>('copiando');
  const [error, fijarError] = useState('');

  useEffect(() => {
    let vivo = true;
    let enlace = '';
    fijarEstado('copiando');
    fijarError('');
    c.imagen
      .then((b) => {
        if (!vivo) return;
        enlace = URL.createObjectURL(b);
        fijarUrl(enlace);
      })
      .catch((e: unknown) => {
        if (!vivo) return;
        fijarEstado('error');
        fijarError(e instanceof Error ? e.message : String(e));
      });
    c.copia.then(
      () => vivo && fijarEstado((x) => (x === 'error' ? x : 'copiada')),
      () => vivo && fijarEstado((x) => (x === 'error' ? x : 'sin-copiar'))
    );
    return () => {
      vivo = false;
      if (enlace) setTimeout(() => URL.revokeObjectURL(enlace), 1000);
    };
  }, [c]);

  const cambiarEstilo = (estilo: EstiloTarjeta) => {
    if (estilo === c.estilo) return;
    estiloElegido = estilo;
    chrome.storage?.local.set({ estiloTarjeta: estilo }).catch(() => {});
    alCambiar(compartir(c.origen, c.datos, c.nombre, estilo, c.letraLengua, estilo));
  };

  return (
    <div class="compartir" role="region" aria-label={tr('Compartir como imagen')}>
      <div class="compartir-cab">
        <b><Icono n="compartir" t={15} /> {tr('Compartir como imagen')}</b>
        <button class="btn-icono chico" aria-label={tr('Cerrar')} data-tip={tr('Cerrar')} data-tip-lado="izq" onClick={alCerrar}><Icono n="cerrar" t={14} /></button>
      </div>
      <div class={`compartir-vista ${c.estilo}`}>
        {url ? <img src={url} alt={tr('Vista previa de la tarjeta')} /> : estado !== 'error' && <span class="esqueleto" aria-hidden="true" />}
      </div>
      <div class={`compartir-estado ${estado}`} role="status">
        {estado === 'copiando' && <><span class="giro" /> {tr('Creando la imagen…')}</>}
        {estado === 'copiada' && <><Icono n="check" t={15} /> {tr('Imagen copiada: pégala con Ctrl+V donde quieras.')}</>}
        {estado === 'sin-copiar' && <><Icono n="info" t={15} /> {tr('No se pudo copiar la imagen. Guárdala con «Guardar imagen».')}</>}
        {estado === 'error' && <><Icono n="aviso" t={15} /> {tr('No se pudo crear la imagen: {0}', error)}</>}
      </div>
      <div class="compartir-acciones">
        <div class="segmentado" role="radiogroup" aria-label={tr('Estilo de la tarjeta')}>
          {(['oscuro', 'claro'] as const).map((e) => (
            <button key={e} role="radio" aria-checked={c.estilo === e} class={c.estilo === e ? 'activo' : ''} onClick={() => cambiarEstilo(e)}>
              <Icono n={e === 'oscuro' ? 'luna' : 'sol'} t={14} /> {e === 'oscuro' ? tr('Tinta') : tr('Papel')}
            </button>
          ))}
        </div>
        <span class="compartir-hueco" />
        <button class="btn chico" disabled={estado === 'error'} onClick={() => alCambiar({ ...c, copia: copiarImagen(c.imagen) })}>
          <Icono n="copiar" t={14} /> {tr('Copiar')}
        </button>
        <button class="btn chico" disabled={estado === 'error'} onClick={() => c.imagen.then((b) => guardarImagen(b, c.nombre)).catch(() => {})}>
          <Icono n="descargar" t={14} /> {tr('Guardar imagen')}
        </button>
      </div>
    </div>
  );
}
