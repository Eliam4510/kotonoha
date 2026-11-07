// El lector en una pestaña normal del navegador: el mismo de la ventana de la app, pero sin barra lateral y con dirección
// propia. La ventana de la app no tiene pestañas, así que no puede entrar en la vista dividida; esta sí, junto a cualquier
// página. Es una página de la extensión: no necesita servidor, funciona sin conexión y el texto no sale del equipo.

import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import appCss from '../app/app.css';
import { Creador } from '../app/Creador';
import { guardarPreferencia, leerPreferencia } from '../app/estadoApp';
import { Lector } from '../app/Pantallas';
import { Interruptor } from '../app/Piezas';
import { AJUSTES_INICIALES, type Ajustes, alCambiarAjustes, leerAjustes } from '../compartido/ajustes';
import { bcp47Actual, fijarIdioma, idiomaActual, tr } from '../compartido/i18n';
import { fondo, motor } from '../compartido/rpc';
import { guardarTextoLector, leerTextoLector } from '../compartido/textoLector';
import overlay from '../contenido/overlay.css';
import base from '../ui/estilos';
import { cargarFuentes } from '../ui/fuentes';
import { Icono, Marca } from '../ui/iconos';
import { aplicarLengua, lengua } from '../ui/lengua';
import { variablesPaleta } from '../ui/paletas';
import { useTema } from '../ui/tema';

const INTERVALO_PORTAPAPELES = 1000;

/**
 * Lo que se copia en cualquier sitio aparece aquí. La pestaña no tiene el foco si se está leyendo la de al lado, y sin
 * foco el navegador no le deja leer el portapapeles: por eso lo lee el motor. Solo mientras esta pestaña esté a la vista.
 */
function useSeguirPortapapeles(activo: boolean) {
  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    let ultimo: string | null = null;
    const mirar = async () => {
      if (document.hidden) return;
      const copiado = await motor.leerPortapapeles().catch(() => null);
      if (!vivo || copiado === null) return;
      // Lo que ya estaba copiado al encenderlo no cuenta: solo lo que se copie a partir de ahora.
      if (ultimo === null || copiado === ultimo) {
        ultimo = copiado;
        return;
      }
      ultimo = copiado;
      const nuevo = copiado.trim();
      if (!nuevo || !lengua.value.escritura.esDeLaLengua(nuevo, undefined, true)) return;
      const actual = await leerTextoLector();
      await guardarTextoLector(actual.trim() ? `${actual.trimEnd()}\n\n${nuevo}` : nuevo);
    };
    mirar().catch(console.error);
    const reloj = setInterval(() => mirar().catch(console.error), INTERVALO_PORTAPAPELES);
    return () => {
      vivo = false;
      clearInterval(reloj);
    };
  }, [activo]);
}

function LectorWeb() {
  const [a, fijarA] = useState<Ajustes>(() => ({ ...AJUSTES_INICIALES, tema: leerPreferencia('tema', AJUSTES_INICIALES.tema) }));
  const [cargados, fijarCargados] = useState(false);
  const [seguir, fijarSeguir] = useState(() => leerPreferencia('seguirPortapapeles', false));
  const tema = useTema(a.tema);
  aplicarLengua(a);
  useSeguirPortapapeles(seguir);

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

  useEffect(() => {
    document.title = tr('{0} · Kotonoha', tr('Lector'));
    guardarPreferencia('tema', a.tema);
  }, [a.tema, idiomaActual()]);

  return (
    <div class="kk-raiz ap-app ap-web" data-tema={tema} lang={bcp47Actual()} style={{ ...variablesPaleta(a.paleta, tema === 'oscuro'), '--letra-lengua': lengua.value.letra }}>
      <style>{base + overlay + appCss}</style>
      <header class="ap-web-cab">
        <Marca t={24} />
        <div class="ap-web-acciones">
          <label class="ap-web-seguir" data-tip={tr(lengua.value.textos.seguirPortapapeles)}>
            <span>{tr('Seguir el portapapeles')}</span>
            <Interruptor etiqueta={tr('Seguir el portapapeles')} on={seguir} alCambiar={(v) => {
              fijarSeguir(v);
              guardarPreferencia('seguirPortapapeles', v);
            }} />
          </label>
          <button class="btn chico fantasma" onClick={() => fondo.abrirApp('inicio')}><Icono n="externo" t={14} /> {tr('Abrir Kotonoha')}</button>
        </div>
      </header>
      <div class="ap-web-cuerpo">
        <main class="ap-principal">
          <Lector ajustes={a} inicial="" web />
        </main>
        <Creador ajustes={a} />
      </div>
    </div>
  );
}

// Antes de pintar: si no, la pestaña se vería un instante en español.
leerAjustes()
  .then((a) => fijarIdioma(a.idiomaInterfaz))
  .catch(() => {})
  .finally(() => render(<LectorWeb />, document.getElementById('raiz')!));
