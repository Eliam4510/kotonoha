// Ventana de la app: barra lateral, pantallas y el panel del creador de tarjetas.

import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { AJUSTES_INICIALES, type Ajustes, alCambiarAjustes, leerAjustes } from '../compartido/ajustes';
import { motor } from '../compartido/rpc';
import overlay from '../contenido/overlay.css';
import base from '../ui/estilos';
import { cargarFuentes } from '../ui/fuentes';
import { Icono, Logo, Marca, type NombreIcono } from '../ui/iconos';
import { variablesPaleta } from '../ui/paletas';
import { formatoLectura } from '../ui/lecturas';
import { useTema } from '../ui/tema';
import appCss from './app.css';
import { PantallaAjustes } from './Ajustes';
import { Bienvenida } from './Bienvenida';
import { Creador } from './Creador';
import { creadorAbierto, estadoAnki, guardarPreferencia, leerPreferencia, navegar, refrescarAnki, useMedia } from './estadoApp';
import { Biblioteca, Diccionario, Inicio, Lector, Memoria, Palabras } from './Pantallas';
import { ReproductorLocal } from './ReproductorLocal';
import { bcp47Actual, fijarIdioma, idiomaActual, tm, tr } from '../compartido/i18n';

interface Ruta {
  id: string;
  icono: NombreIcono;
  nombre: string;
}

const GRUPOS: { titulo?: string; rutas: Ruta[] }[] = [
  { rutas: [{ id: 'inicio', icono: 'inicio', nombre: tm('Inicio') }] },
  {
    titulo: tm('Aprender'),
    rutas: [
      { id: 'diccionario', icono: 'diccionario', nombre: tm('Diccionario') },
      { id: 'lector', icono: 'lector', nombre: tm('Lector') },
      { id: 'biblioteca', icono: 'biblioteca', nombre: tm('Biblioteca') },
      { id: 'reproductor', icono: 'video', nombre: tm('Reproductor') },
    ],
  },
  {
    titulo: tm('Repasar'),
    rutas: [
      { id: 'memoria', icono: 'tarjetas', nombre: tm('Memoria') },
      { id: 'palabras', icono: 'palabras', nombre: tm('Palabras') },
    ],
  },
];

function leerRuta(): { ruta: string; params: URLSearchParams } {
  const h = location.hash.replace(/^#\//, '');
  const [ruta, q] = h.split('?');
  return { ruta: ruta || 'inicio', params: new URLSearchParams(q ?? '') };
}

function BotonRuta({ r, ruta, compacta, cuenta }: { r: Ruta; ruta: string; compacta: boolean; cuenta?: number }) {
  const activa = ruta === r.id;
  return (
    <button
      class="ap-nav"
      aria-current={activa ? 'page' : undefined}
      aria-label={compacta ? (cuenta ? tr('{0}, {1} pendientes', tr(r.nombre), cuenta) : tr(r.nombre)) : undefined}
      data-tip={compacta ? tr(r.nombre) : undefined}
      data-tip-lado={compacta ? 'der' : undefined}
      onClick={() => navegar(r.id)}
    >
      <Icono n={r.icono} t={20} />
      {!compacta && <span>{tr(r.nombre)}</span>}
      {!!cuenta && <span class="ap-nav-cuenta num">{cuenta > 99 ? '99+' : cuenta}</span>}
    </button>
  );
}

function Lateral({ ruta }: { ruta: string }) {
  const estrecha = useMedia('(max-width: 1100px)');
  const [preferida, fijarPreferida] = useState(() => leerPreferencia('lateralCompacta', false));
  const compacta = estrecha || preferida;
  const [claude, fijarClaude] = useState<boolean | null>(null);
  const [pendientes, fijarPendientes] = useState(0);
  const anki = estadoAnki.value?.conectado ?? null;

  useEffect(() => {
    const cargar = () => {
      motor.estado().then((e) => fijarClaude(e.claveIA)).catch(() => fijarClaude(false));
      refrescarAnki();
      motor.memoriaResumen().then((r) => fijarPendientes(r.pendientes)).catch(() => {});
    };
    cargar();
    const t = setInterval(cargar, 30000);
    return () => clearInterval(t);
  }, [ruta]);

  const textoClaude = claude === null ? tr('Comprobando Claude') : claude ? tr('Claude listo') : tr('Falta la clave de Claude');
  const textoAnki = anki === null ? tr('Comprobando Anki') : anki ? tr('Anki conectado') : tr('Anki sin conectar');

  return (
    <nav class={`ap-lateral ${compacta ? 'compacta' : ''}`} aria-label={tr('Secciones')}>
      <button class="ap-lateral-marca" aria-label={tr('Kotonoha, ir a Inicio')} onClick={() => navegar('inicio')}>
        {compacta ? <Logo t={34} /> : <Marca t={32} />}
      </button>

      <button
        class={`ap-lateral-crear ${creadorAbierto.value ? 'abierto' : ''}`}
        aria-label={tr('Crear tarjeta')}
        aria-expanded={creadorAbierto.value}
        data-tip={compacta ? tr('Crear tarjeta') : undefined}
        data-tip-lado={compacta ? 'der' : undefined}
        onClick={() => (creadorAbierto.value = !creadorAbierto.value)}
      >
        <span class="ap-lateral-mas"><Icono n="mas" t={13} /></span>
        {!compacta && tr('Crear tarjeta')}
      </button>

      <div class="ap-lateral-rutas">
        {GRUPOS.map((g, i) => (
          <div class="ap-nav-grupo" key={i}>
            {g.titulo && !compacta && <div class="ap-nav-titulo">{tr(g.titulo)}</div>}
            {g.rutas.map((r) => (
              <BotonRuta key={r.id} r={r} ruta={ruta} compacta={compacta} cuenta={r.id === 'memoria' ? pendientes : undefined} />
            ))}
          </div>
        ))}
      </div>

      <div class="ap-lateral-pie">
        <BotonRuta r={{ id: 'ajustes', icono: 'ajustes', nombre: tr('Ajustes') }} ruta={ruta} compacta={compacta} />
        <div class="ap-conexiones">
          <button class="ap-conexion" aria-label={textoClaude} data-tip={compacta ? textoClaude : undefined} data-tip-lado={compacta ? 'der' : undefined} onClick={() => navegar('ajustes')}>
            <span class={`ap-punto ${claude ? 'ia' : ''}`} />
            {!compacta && <span>{textoClaude}</span>}
          </button>
          <button class="ap-conexion" aria-label={textoAnki} data-tip={compacta ? textoAnki : undefined} data-tip-lado={compacta ? 'der' : undefined} onClick={() => navegar('ajustes')}>
            <span class={`ap-punto ${anki ? 'ok' : ''}`} />
            {!compacta && <span>{textoAnki}</span>}
          </button>
        </div>
        {!estrecha && (
          <button
            class="btn-icono chico ap-lateral-plegar"
            aria-label={compacta ? tr('Mostrar los nombres') : tr('Ocultar los nombres')}
            data-tip={compacta ? tr('Mostrar los nombres') : tr('Ocultar los nombres')}
            data-tip-lado={compacta ? 'der' : 'arriba'}
            onClick={() => {
              guardarPreferencia('lateralCompacta', !preferida);
              fijarPreferida(!preferida);
            }}
          >
            <Icono n="panel" t={16} />
          </button>
        )}
      </div>
    </nav>
  );
}

function App() {
  const [a, fijarA] = useState<Ajustes>(() => ({ ...AJUSTES_INICIALES, tema: leerPreferencia('tema', AJUSTES_INICIALES.tema) }));
  const [{ ruta, params }, fijarRuta] = useState(leerRuta());
  const tema = useTema(a.tema);
  const [cargados, fijarCargados] = useState(false);
  formatoLectura.value = a.formatoLectura;

  useEffect(() => {
    leerAjustes().then((x) => {
      fijarA(x);
      fijarCargados(true);
    });
    cargarFuentes().catch(() => {});
    const quitar = alCambiarAjustes(fijarA);
    const alCambiarHash = () => fijarRuta(leerRuta());
    window.addEventListener('hashchange', alCambiarHash);
    return () => {
      quitar();
      window.removeEventListener('hashchange', alCambiarHash);
    };
  }, []);

  useEffect(() => {
    // Antes de leer los ajustes, `a` trae los valores por omisión: pedir ese idioma solo haría parpadear la ventana.
    if (!cargados) return;
    fijarIdioma(a.idiomaInterfaz).then(() => {
      document.documentElement.lang = bcp47Actual();
    });
  }, [cargados, a.idiomaInterfaz]);

  // Se recuerda para que la ventana no destelle en el otro tema al abrirse.
  useEffect(() => guardarPreferencia('tema', a.tema), [a.tema]);

  useEffect(() => {
    const nombre = [...GRUPOS.flatMap((g) => g.rutas), { id: 'ajustes', nombre: tr('Ajustes') }].find((r) => r.id === ruta)?.nombre;
    document.title = nombre ? tr('{0} · Kotonoha', tr(nombre)) : 'Kotonoha';
  }, [ruta, a.idiomaInterfaz, idiomaActual()]);

  return (
    <div class="kk-raiz ap-app" data-tema={tema} lang={bcp47Actual()} style={variablesPaleta(a.paleta, tema === 'oscuro')}>
      <style>{base + overlay + appCss}</style>
      <Lateral ruta={ruta} />
      <main class={`ap-principal ${ruta === 'reproductor' ? 'sin-scroll' : ''}`} key={ruta}>
        {ruta === 'inicio' && <Inicio ajustes={a} />}
        {ruta === 'diccionario' && <Diccionario ajustes={a} consulta={params.get('q') ?? ''} />}
        {ruta === 'lector' && <Lector ajustes={a} inicial={params.get('t') ?? ''} />}
        {ruta === 'biblioteca' && <Biblioteca ajustes={a} abrir={params.get('abrir') ?? undefined} />}
        {ruta === 'reproductor' && <ReproductorLocal a={a} />}
        {ruta === 'memoria' && <Memoria />}
        {ruta === 'palabras' && <Palabras evaluar={params.has('evaluar')} />}
        {ruta === 'ajustes' && <PantallaAjustes a={a} />}
      </main>
      <Creador ajustes={a} />
      {cargados && !a.bienvenidaVista && <Bienvenida a={a} />}
    </div>
  );
}

// Antes de pintar: si no, la ventana se vería un instante en español.
leerAjustes()
  .then((a) => fijarIdioma(a.idiomaInterfaz))
  .catch(() => {})
  .finally(() => render(<App />, document.getElementById('raiz')!));
