// Content script. En sitios de video monta el reproductor; en el resto, el lector de páginas.

import { render } from 'preact';
import { alCambiarAjustes, leerAjustes } from '../compartido/ajustes';
import { alRecibirEvento, fondo, motor } from '../compartido/rpc';
import base from '../ui/estilos';
import { cargarFuentes } from '../ui/fuentes';
import { ejecutarComando, instalarAtajos } from './atajos';
import { cargarVideoActual, iniciarControlador, vigilarAnuncios } from './controlador';
import { ajustes, avisar, sinAceleracion } from './estado';
import { iniciarLectorWeb } from './lectorWeb';
import overlay from './overlay.css';
import { alNavegar, controlSitio, videoPrincipal } from './puente';
import { ANCHO_NAVEGADOR, Reproductor } from './Reproductor';
import { iniciarTarjetas } from './tarjetas';
import { instalarAtajosWeb } from './webAtajos';

const SITIOS_VIDEO = /(^|\.)(youtube\.com|netflix\.com|disneyplus\.com|viki\.com|iq\.com|bilibili\.com|crunchyroll\.com|primevideo\.com)$/;

function montar(): HTMLElement {
  const anfitrion = document.createElement('kotonoha-overlay');
  // Sin tamaño y sin fijar: lo fijo va dentro, y los subtítulos se mueven con la página al hacer scroll.
  anfitrion.style.cssText = 'all: initial; position: absolute; left: 0; top: 0; width: 0; height: 0; z-index: 2147483000; pointer-events: none;';
  const sombra = anfitrion.attachShadow({ mode: 'open' });
  const estilo = document.createElement('style');
  estilo.textContent = base + overlay;
  sombra.appendChild(estilo);
  const raiz = document.createElement('div');
  raiz.className = 'kk-raiz';
  sombra.appendChild(raiz);
  document.documentElement.appendChild(anfitrion);
  render(<Reproductor />, raiz);
  motor.sinAceleracion().then((si) => {
    sinAceleracion.value = si;
    raiz.classList.toggle('sin-gpu', si);
  }).catch(() => {});
  // En pantalla completa solo se ve lo que hay dentro del elemento a pantalla completa.
  document.addEventListener('fullscreenchange', () => {
    (document.fullscreenElement ?? document.documentElement).appendChild(anfitrion);
  });
  return anfitrion;
}

async function iniciarReproductor() {
  const a = await leerAjustes();
  ajustes.value = a;
  alCambiarAjustes((n) => {
    ajustes.value = n;
  });
  if (!a.activo || a.sitiosDesactivados.includes(location.hostname)) return;

  const control = controlSitio;
  iniciarControlador(control);
  iniciarTarjetas(control);
  instalarAtajos();
  instalarAtajosWeb(() => ajustes.value.activo, avisar);
  montar();
  cargarFuentes().catch(() => {});

  // Efecto: reserva espacio para el navegador de subtítulos.
  let anchoPrevio = -1;
  setInterval(() => {
    const ancho = ajustes.value.navegadorAbierto ? ANCHO_NAVEGADOR : 0;
    if (ancho !== anchoPrevio) {
      anchoPrevio = ancho;
      control.prepararPanel(ancho).catch(() => {});
    }
  }, 300);

  const cargar = () =>
    cargarVideoActual().catch((e) => avisar(`Error al cargar el video: ${e instanceof Error ? e.message : e}`, 'error'));

  await esperarAdaptador();
  cargar();
  vigilarAnuncios();
  let ultimoId: string | null = null;
  alNavegar(async () => {
    const i = await control.info().catch(() => null);
    if (!i || i.idVideo === ultimoId) return;
    ultimoId = i.idVideo;
    cargar();
  });
  control.info().then((i) => (ultimoId = i.idVideo)).catch(() => {});

  alRecibirEvento((e) => {
    if (e.tipo === 'comando') ejecutarComando(e.comando);
  });
}

async function esperarAdaptador() {
  for (let i = 0; i < 40; i++) {
    try {
      await controlSitio.info();
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
}

if (window === window.top && location.protocol.startsWith('http')) {
  if (SITIOS_VIDEO.test(location.hostname)) {
    iniciarReproductor().catch(console.error);
  } else {
    iniciarLectorWeb().catch(console.error);
    leerAjustes().then((a) => (ajustes.value = a)).catch(() => {});
    alCambiarAjustes((n) => {
      ajustes.value = n;
    });
    instalarAtajosWeb(() => ajustes.value.activo && !ajustes.value.sitiosDesactivados.includes(location.hostname), avisar);
    // Un video grande en otro sitio se puede activar a mano desde el menú de la extensión.
    chrome.runtime.onMessage.addListener((m: { activarVideoAqui?: boolean }) => {
      if (m?.activarVideoAqui && videoPrincipal()) {
        fondo.inyectarPagina().then(() => iniciarReproductor()).catch(console.error);
      }
      return false;
    });
  }
}
