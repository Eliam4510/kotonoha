// Atajos sobre el contenido de cualquier página:
//   E con texto seleccionado   envía la frase o la palabra al creador de tarjetas
//   E con el ratón sobre una imagen   envía la imagen al creador
//   Alt+K, Alt+U, Alt+I con texto seleccionado   marca todas sus palabras como conocidas, desconocidas o ignoradas

import { motor } from '../compartido/rpc';
import type { EstadoPalabra } from '../compartido/tipos';
import { teclaLatina } from '../nucleo/teclas';
import { lengua } from '../ui/lengua';
import { enviarAlCreador } from '../ui/borrador';
import { tr } from '../compartido/i18n';

type Notificar = (texto: string, tipo?: 'error' | 'exito') => void;

/** Una selección corta y sin puntuación es una palabra; lo demás se trata como una frase. */

async function enviarSeleccion(texto: string, notificar: Notificar) {
  const comun = { fuente: document.title, url: location.href };
  if (lengua.value.escritura.pareceFrase(texto)) {
    await enviarAlCreador({ frase: texto, ...comun });
    return;
  }
  const r = await motor.buscar(texto).catch(() => null);
  await enviarAlCreador({
    palabra: r?.lema ?? texto,
    lectura: r?.lectura ?? '',
    definicion: r ? [...new Set(r.entradas.flatMap((e) => e.glosas))].slice(0, 5).join('<br>') : '',
    ...comun,
  });
  notificar(tr('Enviado al creador: {0}', r?.lema ?? texto), 'exito');
}

async function enviarImagen(img: HTMLImageElement, notificar: Notificar) {
  const url = img.currentSrc || img.src;
  if (!url) return;
  try {
    const m = await motor.descargarMedio(url);
    const extension = /png/.test(m.tipo) ? 'png' : /webp/.test(m.tipo) ? 'webp' : /gif/.test(m.tipo) ? 'gif' : 'jpg';
    await enviarAlCreador({ imagenes: [{ id: url, nombre: `kotonoha_${Date.now()}.${extension}`, tipo: m.tipo, datos: m.datos }], fuente: document.title, url: location.href });
    notificar(tr('Imagen enviada al creador'), 'exito');
  } catch (e) {
    notificar(tr('No se pudo descargar la imagen: {0}', e instanceof Error ? e.message : e), 'error');
  }
}

async function marcarSeleccion(texto: string, estado: EstadoPalabra, notificar: Notificar) {
  const lineas = await motor.analizarTexto(texto);
  const cambios = new Map<string, { clave: string; lema: string; lectura: string; estado: EstadoPalabra }>();
  for (const l of lineas) {
    for (const p of l) {
      if (p.esPalabra) cambios.set(p.clave, { clave: p.clave, lema: p.lema, lectura: p.lecturaLema, estado });
    }
  }
  if (!cambios.size) return;
  await motor.cambiarPalabras([...cambios.values()]);
  const n = cambios.size;
  const mensajes = {
    conocida: n === 1 ? tr('1 palabra marcada como conocida') : tr('{0} palabras marcadas como conocidas', n),
    desconocida: n === 1 ? tr('1 palabra marcada como desconocida') : tr('{0} palabras marcadas como desconocidas', n),
    aprendiendo: n === 1 ? tr('1 palabra marcada en aprendizaje') : tr('{0} palabras marcadas en aprendizaje', n),
    ignorada: n === 1 ? tr('1 palabra marcada como ignorada') : tr('{0} palabras marcadas como ignoradas', n),
  };
  notificar(mensajes[estado], 'exito');
}

const ESTADO_POR_TECLA: Record<string, EstadoPalabra> = { k: 'conocida', u: 'desconocida', i: 'ignorada' };

export function instalarAtajosWeb(activo: () => boolean, notificar: Notificar) {
  let imagen: HTMLImageElement | null = null;
  document.addEventListener(
    'mouseover',
    (e) => {
      imagen = e.target instanceof HTMLImageElement && e.target.width >= 48 && e.target.height >= 48 ? e.target : null;
    },
    { passive: true }
  );

  document.addEventListener('keydown', (e) => {
    if (!activo() || e.ctrlKey || e.metaKey || e.defaultPrevented) return;
    const objetivo = e.composedPath()[0] as HTMLElement | undefined;
    if (objetivo && (objetivo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(objetivo.tagName))) return;
    const k = teclaLatina(e);
    const seleccion = window.getSelection()?.toString().trim() ?? '';
    const enLengua = seleccion && lengua.value.escritura.tieneTexto(seleccion);

    if (k === 'e' && !e.altKey && !e.shiftKey) {
      if (enLengua) {
        e.preventDefault();
        enviarSeleccion(seleccion, notificar).catch((x) => notificar(String(x), 'error'));
      } else if (imagen?.isConnected) {
        e.preventDefault();
        enviarImagen(imagen, notificar).catch((x) => notificar(String(x), 'error'));
      }
      return;
    }
    if (e.altKey && !e.shiftKey && enLengua && ESTADO_POR_TECLA[k]) {
      e.preventDefault();
      marcarSeleccion(seleccion, ESTADO_POR_TECLA[k], notificar).catch((x) => notificar(String(x), 'error'));
    }
  });
}
