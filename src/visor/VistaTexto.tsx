// La vista de texto del visor: el texto de las páginas a la vista como se lee, en párrafos, con la ayuda de lectura del
// Portapapeles. Trae furigana, palabras que se pueden consultar, comprensión, lectura en voz alta y tarjetas. Las páginas
// se pasan igual que en la vista normal; para volver a la imagen, «Ver las páginas».

import { useMemo } from 'preact/hooks';
import { TextoInteractivo } from '../app/Lectura';
import type { Ajustes } from '../compartido/ajustes';
import { tr } from '../compartido/i18n';
import type { LineaTexto } from '../nucleo/capaTexto';
import type { Bloque } from '../nucleo/estructura';
import { parrafosDe } from '../nucleo/parrafos';
import { lengua } from '../ui/lengua';

export interface TextoVista {
  lineas: LineaTexto[];
  /** Si es el texto que trae el PDF: entonces no son globos de manga aunque el OCR esté en modo Manga. */
  propias: boolean;
}

/**
 * Los bloques de lectura de unas páginas seguidas: sus párrafos y sus títulos, con una raya entre página y página.
 * `marca` es lo que abre un elemento de lista en la lengua del libro.
 */
export function bloquesDe(textos: (TextoVista | undefined)[], globos: boolean, marca?: RegExp): Bloque[] {
  const salida: Bloque[] = [];
  for (const t of textos) {
    if (!t) continue;
    const parrafos = parrafosDe(t.lineas, { globos: globos && !t.propias, marca });
    if (!parrafos.length) continue;
    if (salida.length) salida.push({ tipo: 'separador' });
    for (const p of parrafos) {
      const linea = { texto: p.texto, negritas: [] };
      salida.push(p.titulo ? { tipo: 'titulo', nivel: 2, linea } : { tipo: 'parrafo', lineas: [linea] });
    }
  }
  return salida;
}

export function VistaTexto({ paginas, textos, globos, leyendo, ocrActivo, alLeer, ajustes, titulo }: {
  paginas: number[];
  /** El texto de cada página a la vista, si ya lo tiene. */
  textos: (TextoVista | undefined)[];
  /** Si el texto del OCR es de manga: cada línea es un globo. */
  globos: boolean;
  /** Si el OCR está leyendo alguna de estas páginas. */
  leyendo: boolean;
  ocrActivo: boolean;
  alLeer: () => void;
  ajustes: Ajustes;
  titulo: string;
}) {
  // Los párrafos dependen del texto y del sitio de cada línea: con lo mismo, no se rehacen en cada vuelta.
  const clave = JSON.stringify([lengua.value.id, globos, textos.map((t) => (t ? [t.propias, t.lineas.map((l) => [l.texto, l.caja, l.vertical])] : null))]);
  const bloques = useMemo(() => bloquesDe(textos, globos, lengua.value.escritura.marcaDeLista), [clave]);
  const etiqueta = paginas.length > 1 ? tr('Páginas {0} y {1}', paginas[0] + 1, paginas[paginas.length - 1] + 1) : tr('Página {0}', (paginas[0] ?? 0) + 1);
  const falta = textos.some((t) => !t);

  if (!bloques.length) {
    return (
      <div class="vs-vista-texto vs-vista-texto-vacia">
        <p class="ayuda" role="status">
          {leyendo || (falta && ocrActivo) ? tr('Leyendo el texto de la página…') : falta ? tr('El texto de esta página aún no se ha leído.') : tr('Esta página no tiene texto.')}
        </p>
        {falta && !ocrActivo && !leyendo && (
          <button class="btn primario" onClick={alLeer}>{tr('Leer el texto de las páginas')}</button>
        )}
      </div>
    );
  }
  return (
    <div class="vs-vista-texto">
      <TextoInteractivo key={paginas.join('-')} texto="" bloques={bloques} ajustes={ajustes} titulo={titulo} inicioBarra={<span class="ap-lectura-titulo">{etiqueta}</span>} />
      {leyendo && <p class="ayuda vs-vista-texto-leyendo" role="status">{tr('Leyendo el texto de la página…')}</p>}
    </div>
  );
}
