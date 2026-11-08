// El visor de la Ayuda de lectura, en una pestaña propia. Abre el libro de la biblioteca y su archivo guardado y le da
// paso al visor que le toca: el de páginas, como un lector de PDF, para los EPUB de imágenes, los CBZ y los PDF; o el de
// texto para un EPUB de texto, que se pinta con su propio formato. Es una página de la extensión: el libro no sale del equipo.

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
import { aplicarLengua, lengua } from '../ui/lengua';
import { variablesPaleta } from '../ui/paletas';
import { useTema } from '../ui/tema';
import { Abriendo, AvisoError, Cabeza } from './comun';
import visorCss from './visor.css';
import { VisorPaginas } from './VisorPaginas';
import { VisorTexto } from './VisorTexto';

function Visor({ id }: { id: string }) {
  const [a, fijarA] = useState<Ajustes>(() => ({ ...AJUSTES_INICIALES, tema: leerPreferencia('tema', AJUSTES_INICIALES.tema) }));
  const [cargados, fijarCargados] = useState(false);
  const tema = useTema(a.tema);
  aplicarLengua(a);
  const [abierto, fijarAbierto] = useState<{ doc: ElementoBiblioteca; archivo: File } | null>(null);
  const [error, fijarError] = useState('');

  useEffect(() => {
    leerAjustes().then((x) => {
      fijarA(x);
      fijarCargados(true);
    });
    cargarFuentes().catch(() => {});
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
      if (!e?.documento) throw new Error(tr('Este libro ya no está en la Ayuda de lectura.'));
      const archivo = await archivoDocumento(id);
      if (!archivo) throw new Error(tr('El archivo de este libro no está en este equipo. Vuelve a importarlo desde la Ayuda de lectura.'));
      if (!vivo) return;
      document.title = tr('{0} · Kotonoha', e.titulo);
      fijarAbierto({ doc: e, archivo });
    })().catch((err) => vivo && fijarError(err instanceof Error ? err.message : String(err)));
    return () => {
      vivo = false;
    };
  }, [id]);

  return (
    <div class="kk-raiz vs" data-tema={tema} lang={bcp47Actual()} style={{ ...variablesPaleta(a.paleta, tema === 'oscuro'), '--letra-lengua': lengua.value.letra }}>
      <style>{base + overlay + appCss + visorCss}</style>
      {abierto ? (
        abierto.doc.documento?.texto ? (
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
