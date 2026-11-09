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
import { bcp47Actual, fijarIdioma, numero, tm, tr } from '../compartido/i18n';
import { PAQUETES } from '../lenguas';
import { aplicarLengua, estudiarLengua, lengua } from '../ui/lengua';
import { buscarVersionNueva, type VersionPublicada } from '../compartido/actualizaciones';
import { Bandera } from '../app/SelectorLengua';

const RUTAS: [string, NombreIcono, string][] = [
  ['inicio', 'inicio', tm('Inicio')],
  ['diccionario', 'diccionario', tm('Diccionario')],
  ['lector', 'cuaderno', tm('Cuaderno')],
  ['biblioteca', 'biblioteca', tm('Ayuda de lectura')],
  ['reproductor', 'video', tm('Reproductor')],
  ['memoria', 'tarjetas', tm('Memoria')],
  ['palabras', 'palabras', tm('Palabras')],
  ['ajustes', 'ajustes', tm('Ajustes')],
];

const MODOS_FURIGANA: [Ajustes['lectorFurigana'], string][] = [['todas', tm('Todo')], ['desconocidas', tm('Nuevas')], ['alPasar', tm('Al pasar')], ['ninguna', tm('Nada')]];

function Popup() {
  const [a, fijarA] = useState<Ajustes | null>(null);
  const [host, fijarHost] = useState('');
  const [conocidas, fijarConocidas] = useState<number | null>(null);
  const [captura, fijarCaptura] = useState(false);
  const [pestana, fijarPestana] = useState<number | undefined>();
  const [error, fijarError] = useState('');
  const [atajoCaptura, fijarAtajoCaptura] = useState('');
  const [nueva, fijarNueva] = useState<VersionPublicada | null>(null);
  const tema = useTema(a?.tema ?? 'auto');

  useEffect(() => {
    leerAjustes().then((x) => {
      aplicarLengua(x);
      fijarA(x);
      // Se mira después de leer los ajustes: el aviso puede estar apagado.
      if (x.avisarVersiones) buscarVersionNueva().then(fijarNueva).catch(() => {});
    });
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
  const estudiar = (id: string) => {
    estudiarLengua(a, id)
      .then(() => leerAjustes())
      .then((n) => {
        aplicarLengua(n);
        fijarA(n);
        return motor.estadisticasPalabras();
      })
      .then((s) => fijarConocidas(s.conocidas))
      .catch(console.error);
  };
  const desactivado = a.sitiosDesactivados.includes(host);
  const esWeb = !!host;

  return (
    <div class="kk-raiz ap-menu" data-tema={tema}>
      <style>{base + css}</style>
      <header class="ap-menu-cab">
        <Marca t={28} />
        <button class="ap-menu-conocidas" aria-label={tr('Ver mis palabras')} onClick={() => fondo.abrirApp('palabras')}>
          <b class="num">{numero(conocidas) ?? '–'}</b> {tr('conocidas')}
        </button>
      </header>

      {nueva && (
        <a class="ap-menu-version" href={nueva.url} target="_blank" rel="noreferrer noopener">
          <Icono n="sello" t={15} />
          <span>{tr('Kotonoha {0} ya está disponible', nueva.version)}</span>
          <Icono n="externo" t={13} />
        </a>
      )}

      <section class="ap-menu-grupo">
        <div class="ap-menu-fila columna">
          <div class="ap-menu-texto">
            <b>{tr('Idioma que estudias')}</b>
          </div>
          <div class="segmentado" role="radiogroup" aria-label={tr('Idioma que estudias')}>
            {PAQUETES.map((p) => (
              <button key={p.id} role="radio" aria-checked={a.idiomaObjetivo === p.id} class={a.idiomaObjetivo === p.id ? 'activo' : ''} onClick={() => estudiar(p.id)}><Bandera id={p.id} t={16} />{tr(p.textos.nombre)}</button>
            ))}
          </div>
        </div>
        <div class="ap-menu-fila">
          <div class="ap-menu-texto">
            <b>{a.activo ? tr('Activado') : tr('En pausa')}</b>
            <span>{tr('En todas las páginas')}</span>
          </div>
          <button class={`interruptor ${a.activo ? 'on' : ''}`} role="switch" aria-checked={a.activo} aria-label={tr('Activar Kotonoha')} onClick={() => cambiar({ activo: !a.activo })} />
        </div>
        {esWeb && (
          <div class="ap-menu-fila">
            <div class="ap-menu-texto">
              <b>{tr('En este sitio')}</b>
              <span>{host}</span>
            </div>
            <button
              class={`interruptor ${!desactivado ? 'on' : ''}`}
              role="switch"
              aria-checked={!desactivado}
              aria-label={tr('Activar Kotonoha en {0}', host)}
              onClick={() => cambiar({ sitiosDesactivados: desactivado ? a.sitiosDesactivados.filter((s) => s !== host) : [...new Set([...a.sitiosDesactivados, host])] })}
            />
          </div>
        )}
        <div class="ap-menu-fila">
          <div class="ap-menu-texto">
            <b>{tr('Lector de páginas')}</b>
            <span>{tr(lengua.value.textos.lectorResumen)}</span>
          </div>
          <button class={`interruptor ${a.lectorActivo ? 'on' : ''}`} role="switch" aria-checked={a.lectorActivo} aria-label={tr('Lector de páginas')} onClick={() => cambiar({ lectorActivo: !a.lectorActivo })} />
        </div>
        {a.lectorActivo && (
          <div class="ap-menu-fila columna">
            <div class="ap-menu-texto">
              <b>{tr(lengua.value.textos.lectura)}</b>
            </div>
            <div class="segmentado" role="radiogroup" aria-label={tr(lengua.value.textos.lectura)}>
              {MODOS_FURIGANA.map(([v, n]) => (
                <button key={v} role="radio" aria-checked={a.lectorFurigana === v} class={a.lectorFurigana === v ? 'activo' : ''} onClick={() => cambiar({ lectorFurigana: v })}>{tr(n)}</button>
              ))}
            </div>
          </div>
        )}
        <div class="ap-menu-fila">
          <div class="ap-menu-texto">
            <b>{tr('Capturar imagen y audio')}</b>
            <span>
              {tr('Durante esta sesión')}{' '}
              {atajoCaptura ? atajoCaptura.split('+').map((x) => <kbd class="tecla" key={x}>{x}</kbd>) : <button class="enlace" onClick={() => fondo.abrirAtajos()}>{tr('Asignar un atajo')}</button>}
            </span>
          </div>
          <button class={`interruptor ${captura ? 'on' : ''}`} role="switch" aria-checked={captura} aria-label={tr('Capturar imagen y audio')} onClick={async () => {
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

      <nav class="ap-menu-grupo ap-menu-rutas" aria-label={tr('Abrir la ventana de Kotonoha')}>
        {RUTAS.map(([r, i, n]) => (
          <button key={r} class="ap-menu-ruta" onClick={() => fondo.abrirApp(r)}>
            <Icono n={i} t={20} />
            {tr(n)}
          </button>
        ))}
      </nav>

      <button class="btn fantasma chico ap-menu-activar" onClick={() => {
        fondo.abrirLectorWeb(esWeb).catch(console.error);
        window.close();
      }}>
        <Icono n="dividir" t={15} /> {esWeb ? tr('Abrir el Cuaderno junto a esta pestaña') : tr('Abrir el Cuaderno en una pestaña')}
      </button>

      {pestana !== undefined && !/youtube|netflix|disneyplus|viki|iq\.com|bilibili|crunchyroll|primevideo/.test(host) && esWeb && (
        <button class="btn fantasma chico ap-menu-activar" onClick={() => chrome.tabs.sendMessage(pestana, { activarVideoAqui: true })}>
          <Icono n="video" t={15} /> {tr('Usar el reproductor en el video de esta página')}
        </button>
      )}
    </div>
  );
}

leerAjustes()
  .then((a) => fijarIdioma(a.idiomaInterfaz))
  .catch(() => {})
  .finally(() => {
    document.documentElement.lang = bcp47Actual();
    render(<Popup />, document.getElementById('raiz')!);
  });
