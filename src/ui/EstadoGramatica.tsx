// Cómo va un punto de gramática (nuevo, aprendiendo, sabido), dónde se ha visto y su tarjeta de opción múltiple: lo
// mismo en el globo de gramática del video, en la ficha, en la lista del JLPT y en el diccionario.

import { useEffect, useState } from 'preact/hooks';
import { tr } from '../compartido/i18n';
import { motor } from '../compartido/rpc';
import { ESTADOS_GRAMATICA, type GramaticaVista } from '../compartido/tipos';
import type { PuntoGramatica } from '../lenguas/tipos';
import { enviarAlCreador } from './borrador';
import { estadoGramatica, fijarEstadoGramatica, NOMBRE_ESTADO_GRAMATICA } from './gramatica';
import { Icono } from './iconos';
import { lengua } from './lengua';

export function BotonesEstadoGramatica({ patron }: { patron: string }) {
  const actual = estadoGramatica(patron);
  return (
    <div class="segmentado estado-gram" role="radiogroup" aria-label={tr('Cómo lo llevas')}>
      {ESTADOS_GRAMATICA.map((e) => (
        <button key={e} role="radio" aria-checked={actual === e} class={actual === e ? 'activo' : ''} onClick={() => fijarEstadoGramatica(patron, e).catch(() => {})}>
          <i class={`punto-gram ${e}`} /> {tr(NOMBRE_ESTADO_GRAMATICA[e])}
        </button>
      ))}
    </div>
  );
}

/** Los videos y textos donde apareció el punto, lo más reciente primero. */
export function VistoEn({ patron }: { patron: string }) {
  const [vistas, fijarVistas] = useState<GramaticaVista[] | null>(null);
  useEffect(() => {
    let vivo = true;
    motor
      .gramaticaVista(patron)
      .then((v) => vivo && fijarVistas(v))
      .catch(() => vivo && fijarVistas([]));
    return () => {
      vivo = false;
    };
  }, [patron]);
  if (!vistas?.length) return null;
  return (
    <div class="visto-en">
      <div class="subtitulo-def">{tr('Dónde lo has visto')}</div>
      {vistas.map((v) => (
        <a key={v.fuente} class="visto-en-fila" href={v.url || undefined} target="_blank" rel="noreferrer noopener">
          <span class="visto-en-titulo">{v.titulo || v.fuente}{v.veces > 1 && <small class="num"> · {tr('{0} veces', v.veces)}</small>}</span>
          <span class="visto-en-frase" lang={lengua.value.id}>{v.frase}</span>
        </a>
      ))}
    </div>
  );
}

const mezclar = <T,>(xs: T[]): T[] => {
  const r = [...xs];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};

/**
 * Una tarjeta de opción múltiple: la frase con un hueco donde iba el patrón y cuatro opciones; detrás, la buena con su
 * significado y por qué no van las otras. Las opciones falsas las elige Claude entre los puntos que se confunden con este.
 */
export function BotonOpcionMultiple({ punto, frase, fuente, url }: { punto: PuntoGramatica; frase: string; fuente?: string; url?: string }) {
  const [estado, fijarEstado] = useState<'' | 'pidiendo' | 'hecha' | 'error'>('');
  const [error, fijarError] = useState('');
  if (!frase || !punto.fragmento || !frase.includes(punto.fragmento)) return null;
  const crear = async () => {
    fijarEstado('pidiendo');
    try {
      const falsas = await motor.distractoresGramatica(punto, frase);
      const opciones = mezclar([punto.patron, ...falsas.map((f) => f.patron)]);
      const letras = 'ABCDEF';
      await enviarAlCreador({
        tipo: 'frase',
        palabra: punto.patron,
        frase: `${frase.replace(punto.fragmento, '＿＿＿')}<br><br>${opciones.map((o, i) => `${letras[i]}. ${o}`).join('<br>')}`,
        definicion: [`<b>${letras[opciones.indexOf(punto.patron)]}. ${punto.patron}</b>${punto.nivel ? ` (${punto.nivel})` : ''}: ${tr(punto.significado)}`, `${frase.replace(punto.fragmento, `<b>${punto.fragmento}</b>`)}`, ...falsas.map((f) => `<i>${f.patron}</i>: ${f.motivo}`)].join('<br>'),
        fuente,
        url,
        etiquetas: ['gramatica', 'opcion-multiple', ...(punto.nivel ? [punto.nivel] : [])],
      });
      fijarEstado('hecha');
    } catch (e) {
      fijarError(e instanceof Error ? e.message : String(e));
      fijarEstado('error');
    }
  };
  return (
    <div class="opcion-multiple">
      <button class="btn chico ia" disabled={estado === 'pidiendo'} onClick={crear}>
        {estado === 'pidiendo' ? <span class="giro" /> : <Icono n="tarjetas" t={14} />} {tr('Tarjeta de opción múltiple')}
      </button>
      {estado === 'hecha' && <span class="ayuda">{tr('En el creador de tarjetas, con las opciones mezcladas.')}</span>}
      {estado === 'error' && <span class="texto-error">{error}</span>}
    </div>
  );
}
