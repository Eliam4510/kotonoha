// El visor de la Biblioteca, en una pestaña propia. Abre el libro de la biblioteca y su archivo guardado y le da
// paso al visor que le toca: el de páginas, como un lector de PDF, para los EPUB de imágenes, los CBZ y los PDF; el de
// texto para un EPUB de texto, que se pinta con su propio formato; o el de lectura para un texto de la estantería (pegado,
// una historia, un artículo), que no tiene archivo. Es una página de la extensión: el libro no sale del equipo.

import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import appCss from '../app/app.css';
import { guardarPreferencia, leerPreferencia } from '../app/estadoApp';
import { AJUSTES_INICIALES, type Ajustes, alCambiarAjustes, leerAjustes } from '../compartido/ajustes';
import { archivoDocumento } from '../compartido/documentos';
import { bcp47Actual, fijarIdioma, tr } from '../compartido/i18n';
import { motor } from '../compartido/rpc';
import type { ElementoBiblioteca } from '../compartido/tipos';
import overlay from '../contenido/overlay.css';
import base from '../ui/estilos';
import { cargarFuentes } from '../ui/fuentes';
import { useRelojLectura } from '../ui/relojLectura';
import { aplicarLengua, lengua } from '../ui/lengua';
import { letraElegida } from '../ui/letra';
import { variablesPaleta } from '../ui/paletas';
import { useTema } from '../ui/tema';
import { Abriendo, AvisoError, Cabeza } from './comun';
import visorCss from './visor.css';
import { VisorLectura } from './VisorLectura';
import { VisorPaginas } from './VisorPaginas';
import { VisorTexto } from './VisorTexto';
import { seguirEstadosGramatica } from '../ui/gramatica';

function Visor({ id }: { id: string }) {
  const [a, fijarA] = useState<Ajustes>(() => ({ ...AJUSTES_INICIALES, tema: leerPreferencia('tema', AJUSTES_INICIALES.tema) }));
  const [cargados, fijarCargados] = useState(false);
  const tema = useTema(a.tema);
  aplicarLengua(a);
  // Un texto de la estantería no tiene archivo: su texto va en la ficha.
  const [abierto, fijarAbierto] = useState<{ doc: ElementoBiblioteca; archivo: File | null } | null>(null);
  const [error, fijarError] = useState('');
  useRelojLectura(abierto ? abierto.doc.id : null, abierto?.doc.titulo ?? '', a.idiomaObjetivo);

  useEffect(() => {
    leerAjustes().then((x) => {
      fijarA(x);
      fijarCargados(true);
    });
    cargarFuentes().catch(() => {});
    seguirEstadosGramatica(() => lengua.value.id);
    return alCambiarAjustes(fijarA);
  }, []);

  useEffect(() => {
    if (!cargados) return;
    fijarIdioma(a.idiomaInterfaz).then(() => {
      document.documentElement.lang = bcp47Actual();
    });
  }, [cargados, a.idiomaInterfaz]);

  useEffect(() => guardarPreferencia('tema', a.tema), [a.tema]);

  // El libro: su ficha en la biblioteca y su archivo guardado.
  useEffect(() => {
    let vivo = true;
    (async () => {
      const e = await motor.bibliotecaObtener(id);
      if (!e) throw new Error(tr('Este libro ya no está en la Biblioteca.'));
      const archivo = e.documento ? await archivoDocumento(id) : null;
      if (e.documento && !archivo) throw new Error(tr('El archivo de este libro no está en este equipo. Vuelve a importarlo desde la Biblioteca.'));
      if (!vivo) return;
      document.title = tr('{0} · Kotonoha', e.titulo);
      fijarAbierto({ doc: e, archivo });
    })().catch((err) => vivo && fijarError(err instanceof Error ? err.message : String(err)));
    return () => {
      vivo = false;
    };
  }, [id]);

  // La letra elegida para la lengua, como en los subtítulos y el diccionario: el visor usaba siempre la redondeada, que se
  // lee peor en los kanji complejos.
  const letra = letraElegida(lengua.value, a.diccionarioLetra);
  return (
    <div class="kk-raiz vs" data-tema={tema} lang={bcp47Actual()} style={{ ...variablesPaleta(a.paleta, tema === 'oscuro'), '--letra-lengua': letra.letra, '--aire-lectura': letra.aire }}>
      <style>{base + overlay + appCss + visorCss}</style>
      {abierto ? (
        !abierto.doc.documento || !abierto.archivo ? (
          <VisorLectura doc={abierto.doc} ajustes={a} />
        ) : abierto.doc.documento.texto ? (
          <VisorTexto doc={abierto.doc} archivo={abierto.archivo} ajustes={a} />
        ) : (
          <VisorPaginas doc={abierto.doc} archivo={abierto.archivo} ajustes={a} />
        )
      ) : (
        <>
          <header class="vs-barra">
            <Cabeza />
          </header>
          <div class="vs-cuerpo">
            <main class="vs-lienzo">{error ? <AvisoError mensaje={error} /> : <Abriendo />}</main>
          </div>
        </>
      )}
    </div>
  );
}

const id = decodeURIComponent(location.hash.slice(1));
// Antes de pintar: si no, la pestaña se vería un instante en español.
leerAjustes()
  .then((a) => fijarIdioma(a.idiomaInterfaz))
  .catch(() => {})
  .finally(() => render(<Visor id={id} />, document.getElementById('raiz')!));
