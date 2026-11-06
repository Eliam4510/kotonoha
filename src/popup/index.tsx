// Menú del icono de la extensión.

import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { type Ajustes, guardarAjustes, leerAjustes } from '../compartido/ajustes';
import { fondo, motor } from '../compartido/rpc';
import base from '../ui/estilos';
import { cargarFuentes } from '../ui/fuentes';
import { Icono, Marca, type NombreIcono } from '../ui/iconos';
import { useTema } from '../ui/tema';
import css from './popup.css';

const RUTAS: [string, NombreIcono, string][] = [
  ['inicio', 'inicio', 'Inicio'],
  ['diccionario', 'diccionario', 'Diccionario'],
  ['lector', 'lector', 'Lector'],
  ['biblioteca', 'biblioteca', 'Biblioteca'],
  ['reproductor', 'video', 'Reproductor'],
  ['memoria', 'tarjetas', 'Memoria'],
  ['palabras', 'palabras', 'Palabras'],
  ['ajustes', 'ajustes', 'Ajustes'],
];

function Popup() {
  const [a, fijarA] = useState<Ajustes | null>(null);
  const [host, fijarHost] = useState('');
  const [conocidas, fijarConocidas] = useState<number | null>(null);
  const [captura, fijarCaptura] = useState(false);
  const [pestana, fijarPestana] = useState<number | undefined>();
  const [error, fijarError] = useState('');
  const [atajoCaptura, fijarAtajoCaptura] = useState('');
  const tema = useTema(a?.tema ?? 'auto');

  useEffect(() => {
    leerAjustes().then(fijarA);
    // El menú está en español: no merece la pena esperar a la tipografía japonesa, que pesa megas.
    cargarFuentes({ soloLatin: true }).catch(() => {});
    chrome.tabs.query({ active: true, currentWindow: true }).then(([t]) => {
      fijarPestana(t?.id);
      try {
        // Las páginas del navegador no son un sitio que se pueda activar o desactivar.
        const u = new URL(t?.url ?? '');
        fijarHost(/^https?:$/.test(u.protocol) ? u.hostname : '');
      } catch {
        fijarHost('');
      }
    });
    motor.estadisticasPalabras().then((s) => fijarConocidas(s.conocidas)).catch(() => {});
    fondo.capturaActiva().then(fijarCaptura).catch(() => {});
    fondo.atajos().then((t) => fijarAtajoCaptura(t['alternar-captura'] ?? '')).catch(() => {});
  }, []);

  if (!a) return null;
  const cambiar = (c: Partial<Ajustes>) => {
    const n = { ...a, ...c };
    fijarA(n);
    guardarAjustes(c);
  };
  const desactivado = a.sitiosDesactivados.includes(host);
  const esWeb = !!host;

  return (
    <div class="kk-raiz ap-menu" data-tema={tema}>
      <style>{base + css}</style>
      <header class="ap-menu-cab">
        <Marca t={28} />
        <button class="ap-menu-conocidas" aria-label="Ver mis palabras" onClick={() => fondo.abrirApp('palabras')}>
          <b class="num">{conocidas?.toLocaleString('es') ?? '–'}</b> conocidas
        </button>
      </header>

      <section class="ap-menu-grupo">
        <div class="ap-menu-fila">
          <div class="ap-menu-texto">
            <b>{a.activo ? 'Activado' : 'En pausa'}</b>
            <span>En todas las páginas</span>
          </div>
          <button class={`interruptor ${a.activo ? 'on' : ''}`} role="switch" aria-checked={a.activo} aria-label="Activar Kotonoha" onClick={() => cambiar({ activo: !a.activo })} />
        </div>
        {esWeb && (
          <div class="ap-menu-fila">
            <div class="ap-menu-texto">
              <b>En este sitio</b>
              <span>{host}</span>
            </div>
            <button
              class={`interruptor ${!desactivado ? 'on' : ''}`}
              role="switch"
              aria-checked={!desactivado}
              aria-label={`Activar Kotonoha en ${host}`}
              onClick={() => cambiar({ sitiosDesactivados: desactivado ? a.sitiosDesactivados.filter((s) => s !== host) : [...new Set([...a.sitiosDesactivados, host])] })}
            />
          </div>
        )}
        <div class="ap-menu-fila columna">
          <div class="ap-menu-texto">
            <b>Modo en páginas web</b>
            <span>{a.modoRender === 'ligero' ? 'Consulta con Shift y el ratón.' : 'Además subraya las palabras por estado, sin alterar la página.'}</span>
          </div>
          <div class="segmentado" role="radiogroup" aria-label="Modo en páginas web">
            <button role="radio" aria-checked={a.modoRender === 'ligero'} class={a.modoRender === 'ligero' ? 'activo' : ''} onClick={() => cambiar({ modoRender: 'ligero' })}>Ligero</button>
            <button role="radio" aria-checked={a.modoRender === 'completo'} class={a.modoRender === 'completo' ? 'activo' : ''} onClick={() => cambiar({ modoRender: 'completo' })}>Completo</button>
          </div>
        </div>
        <div class="ap-menu-fila">
          <div class="ap-menu-texto">
            <b>Capturar imagen y audio</b>
            <span>
              Durante esta sesión{' '}
              {atajoCaptura ? atajoCaptura.split('+').map((x) => <kbd class="tecla" key={x}>{x}</kbd>) : <button class="enlace" onClick={() => fondo.abrirAtajos()}>Asignar un atajo</button>}
            </span>
          </div>
          <button class={`interruptor ${captura ? 'on' : ''}`} role="switch" aria-checked={captura} aria-label="Capturar imagen y audio" onClick={async () => {
            try {
              fijarError('');
              fijarCaptura(await fondo.alternarCaptura());
            } catch (e) {
              fijarError(e instanceof Error ? e.message : String(e));
            }
          }} />
        </div>
        {error && <p class="ap-menu-error" role="alert">{error}</p>}
      </section>

      <nav class="ap-menu-grupo ap-menu-rutas" aria-label="Abrir la ventana de Kotonoha">
        {RUTAS.map(([r, i, n]) => (
          <button key={r} class="ap-menu-ruta" onClick={() => fondo.abrirApp(r)}>
            <Icono n={i} t={20} />
            {n}
          </button>
        ))}
      </nav>

      {pestana !== undefined && !/youtube|netflix|disneyplus|viki|iq\.com|bilibili|crunchyroll|primevideo/.test(host) && esWeb && (
        <button class="btn fantasma chico ap-menu-activar" onClick={() => chrome.tabs.sendMessage(pestana, { activarVideoAqui: true })}>
          <Icono n="video" t={15} /> Usar el reproductor en el video de esta página
        </button>
      )}
    </div>
  );
}

render(<Popup />, document.getElementById('raiz')!);
