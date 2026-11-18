// Las palabras consultadas en un libro: cada palabra que se elige en la ventana queda apuntada, con su frase y su página,
// y desde este panel se pasan a tarjetas de golpe. Cada tarjeta lleva la frase con la palabra en negrita, su furigana, las
// definiciones del diccionario y, como imagen, un recorte de la página con la frase, como la captura de una tarjeta de un
// video. Nada de Claude: crear muchas no gasta. La lista va con el libro, en este equipo.

import { useState } from 'preact/hooks';
import { guardarPreferencia, leerPreferencia } from '../app/estadoApp';
import type { Ajustes } from '../compartido/ajustes';
import { tr } from '../compartido/i18n';
import { motor } from '../compartido/rpc';
import type { MedioTarjeta } from '../compartido/tipos';
import { aFuriganaAnki, fraseConNegrita } from '../nucleo/frases';
import type { Caja } from '../nucleo/ocr';
import { borradorVacio } from '../ui/borrador';
import { Icono } from '../ui/iconos';
import { lecturaDeTarjeta, lengua } from '../ui/lengua';
import { imagenParaOcr, type Paginador } from './paginador';

/** Una palabra consultada: lo que hace falta para su tarjeta. */
export interface Consultada {
  clave: string;
  lema: string;
  lectura: string;
  superficie: string;
  frase: string;
  pagina: number;
  /** Dónde está la frase en la página, en fracciones: el recorte de la tarjeta. */
  caja: Caja | null;
  creada: number;
  /** Ya se hizo su tarjeta. */
  hecha?: boolean;
}

/** Cuántas se recuerdan por libro: las más antiguas se van. */
const MAXIMO = 300;
const clave = (libro: string) => `visorConsultadas:${libro}`;

export const leerConsultadas = (libro: string) => leerPreferencia<Consultada[]>(clave(libro), []);

/** Apunta una palabra consultada, la primera de la lista; la misma palabra en la misma frase no se repite. */
export function apuntarConsultada(libro: string, c: Omit<Consultada, 'creada'>): Consultada[] {
  const lista = leerConsultadas(libro).filter((x) => !(x.clave === c.clave && x.frase === c.frase));
  const nueva = [{ ...c, creada: Date.now() }, ...lista].slice(0, MAXIMO);
  guardarPreferencia(clave(libro), nueva);
  return nueva;
}

const guardar = (libro: string, lista: Consultada[]) => guardarPreferencia(clave(libro), lista);

/**
 * Un recorte de la página con la frase: su caja con un margen, de la imagen con que lee el OCR (la del escaneo, si lo es),
 * a 900 píxeles de ancho como mucho, en JPEG.
 */
async function recorte(paginador: Paginador, n: number, caja: Caja, nombre: string): Promise<MedioTarjeta | null> {
  const { imagen, marco } = await imagenParaOcr(paginador, n);
  const bmp = imagen instanceof Blob ? await createImageBitmap(imagen) : imagen;
  // La caja va en fracciones de la página; la imagen puede ser solo una parte de ella (el marco del escaneo).
  const m = marco ?? { x0: 0, y0: 0, x1: 1, y1: 1 };
  const enImagen = (v: number, a: number, b: number) => (v - a) / (b - a);
  const margen = 0.02;
  const x0 = Math.max(0, enImagen(caja.x0 - margen, m.x0, m.x1)) * bmp.width;
  const x1 = Math.min(1, enImagen(caja.x1 + margen, m.x0, m.x1)) * bmp.width;
  const y0 = Math.max(0, enImagen(caja.y0 - margen, m.y0, m.y1)) * bmp.height;
  const y1 = Math.min(1, enImagen(caja.y1 + margen, m.y0, m.y1)) * bmp.height;
  if (x1 - x0 < 8 || y1 - y0 < 8) return null;
  const escala = Math.min(1, 900 / (x1 - x0));
  const lienzo = new OffscreenCanvas(Math.round((x1 - x0) * escala), Math.round((y1 - y0) * escala));
  const ctx = lienzo.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  ctx.drawImage(bmp, x0, y0, x1 - x0, y1 - y0, 0, 0, lienzo.width, lienzo.height);
  const blob = await lienzo.convertToBlob({ type: 'image/jpeg', quality: 0.86 });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binario = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { id: nombre, nombre, tipo: 'image/jpeg', datos: btoa(binario) };
}

export function PanelConsultadas({ libro, titulo, paginador, ajustes, lista, alCambiar, alIr, alCerrar }: {
  libro: string;
  titulo: string;
  paginador: Paginador;
  ajustes: Ajustes;
  lista: Consultada[];
  alCambiar: (l: Consultada[]) => void;
  alIr: (pagina: number) => void;
  alCerrar: () => void;
}) {
  const [elegidas, fijarElegidas] = useState<Set<number>>(() => new Set());
  const [creando, fijarCreando] = useState<{ hechas: number; total: number } | null>(null);
  const [aviso, fijarAviso] = useState<{ texto: string; error?: boolean } | null>(null);
  const pendientes = lista.map((c, i) => ({ c, i })).filter((x) => !x.c.hecha);
  const cambiar = (l: Consultada[]) => {
    guardar(libro, l);
    alCambiar(l);
  };
  const alternar = (i: number) =>
    fijarElegidas((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  const quitar = (i: number) => {
    cambiar(lista.filter((_, k) => k !== i));
    fijarElegidas(new Set());
  };

  const crear = async () => {
    const cuales = [...elegidas].sort((a, b) => a - b);
    if (!cuales.length) return;
    fijarAviso(null);
    if (ajustes.destino === 'anki') {
      const anki = await motor.anki().catch(() => null);
      if (!anki?.conectado) {
        fijarAviso({ texto: anki?.error ?? tr('Anki no responde. Ábrelo y comprueba que AnkiConnect está instalado.'), error: true });
        return;
      }
    }
    fijarCreando({ hechas: 0, total: cuales.length });
    const fallos: string[] = [];
    const hechas = new Set<number>();
    for (const i of cuales) {
      const c = lista[i];
      try {
        const b = borradorVacio();
        const r = await motor.buscar(c.lema, c.lectura);
        b.palabra = c.lema;
        b.lectura = lecturaDeTarjeta(r);
        b.definicion = [...new Set(r.entradas.flatMap((x) => x.glosas))].slice(0, 5).join('<br>');
        b.fuente = tr('{0}, página {1}', titulo, c.pagina + 1);
        const [palabras] = await motor.analizarTexto(c.frase).catch(() => [[]]);
        b.frase = palabras?.length && ajustes.negritaPalabra ? fraseConNegrita(palabras, c.clave) : c.frase;
        if (palabras?.length && lengua.value.lectura.distingue) b.fraseFurigana = aFuriganaAnki(palabras, ajustes.negritaPalabra ? c.clave : undefined);
        if (c.caja) {
          const img = await recorte(paginador, c.pagina, c.caja, `kotonoha_${libro.slice(0, 8)}_${c.pagina + 1}_${c.creada}.jpg`).catch(() => null);
          if (img) b.imagenes = [img];
        }
        await motor.crearTarjeta(b, ajustes.destino);
        hechas.add(i);
      } catch (x) {
        // Una que falla (en Anki, porque ya está en el mazo) no para las demás.
        fallos.push(`${c.lema}: ${x instanceof Error ? x.message : String(x)}`);
      }
      fijarCreando({ hechas: hechas.size + fallos.length, total: cuales.length });
    }
    cambiar(lista.map((c, i) => (hechas.has(i) ? { ...c, hecha: true } : c)));
    fijarElegidas(new Set());
    fijarCreando(null);
    fijarAviso(fallos.length ? { texto: `${tr('{0} tarjetas creadas; {1} no se pudieron crear', hechas.size, fallos.length)} (${fallos.slice(0, 3).join('; ')})`, error: true } : { texto: tr('{0} tarjetas creadas', hechas.size) });
  };

  return (
    <aside class="vs-panel vs-panel-consultadas" aria-label={tr('Consultadas')}>
      <div class="vs-panel-titulo">
        <Icono n="tarjetas" t={16} />
        <b>{tr('Consultadas')}</b>
        <span class="num vs-cuenta">{lista.length}</span>
        <button class="btn-icono chico vs-cerrar" aria-label={tr('Cerrar')} onClick={alCerrar}>
          <Icono n="cerrar" t={15} />
        </button>
      </div>
      <p class="ayuda">{tr('Las palabras que has consultado en este libro. Elige las que quieras pasar a tarjetas: llevan su frase y un recorte de la página.')}</p>
      {lista.length > 0 && (
        <div class="vs-consultadas-acciones">
          <button class="btn chico fantasma" disabled={!pendientes.length || !!creando} onClick={() => fijarElegidas(elegidas.size === pendientes.length ? new Set() : new Set(pendientes.map((x) => x.i)))}>
            {elegidas.size === pendientes.length && pendientes.length ? tr('Ninguna') : tr('Todas')}
          </button>
          <button class="btn chico primario" disabled={!elegidas.size || !!creando} onClick={() => crear().catch(console.error)}>
            <Icono n="tarjetas" t={14} /> {creando ? tr('Creando {0} de {1}…', creando.hechas, creando.total) : tr('Crear tarjetas ({0})', elegidas.size)}
          </button>
        </div>
      )}
      {aviso && <p class={`vs-consultadas-aviso ${aviso.error ? 'error' : ''}`} role="status">{aviso.texto}</p>}
      {!lista.length ? (
        <p class="ayuda vs-notas-vacio">{tr('Aún no has consultado ninguna palabra. Toca una en la página y quedará aquí.')}</p>
      ) : (
        <ul class="vs-consultadas">
          {lista.map((c, i) => (
            <li key={`${c.clave}-${c.creada}`} class={`vs-consultada ${c.hecha ? 'hecha' : ''}`}>
              <label class="vs-consultada-elegir">
                <input type="checkbox" checked={elegidas.has(i)} disabled={c.hecha || !!creando} onChange={() => alternar(i)} aria-label={c.lema} />
              </label>
              <div class="vs-consultada-texto">
                <span class="vs-consultada-palabra" lang={lengua.value.bcp47}>
                  {c.lema}
                  {c.lectura && c.lectura !== c.lema && <small>{c.lectura}</small>}
                  {c.hecha && <Icono n="ok" t={13} clase="vs-consultada-ok" />}
                </span>
                <span class="vs-consultada-frase" lang={lengua.value.bcp47}>
                  {c.frase}
                </span>
              </div>
              <div class="vs-consultada-botones">
                <button class="btn chico fantasma num" data-tip={tr('Ir a la página {0}', c.pagina + 1)} onClick={() => alIr(c.pagina)}>
                  {c.pagina + 1}
                </button>
                <button class="btn-icono chico" aria-label={tr('Quitar')} onClick={() => quitar(i)}>
                  <Icono n="cerrar" t={13} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
