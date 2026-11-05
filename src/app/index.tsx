// Ventana de la app: barra lateral, pantallas y el panel del creador de tarjetas.

import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { AJUSTES_INICIALES, type Ajustes, alCambiarAjustes, leerAjustes } from '../compartido/ajustes';
import { motor } from '../compartido/rpc';
import overlay from '../contenido/overlay.css';
import base from '../ui/estilos';
import { cargarFuentes } from '../ui/fuentes';
import { Icono, Logo, Marca, type NombreIcono } from '../ui/iconos';
import { useTema } from '../ui/tema';
import appCss from './app.css';
import { PantallaAjustes } from './Ajustes';
import { Creador } from './Creador';
import { creadorAbierto, estadoAnki, guardarPreferencia, leerPreferencia, navegar, refrescarAnki, useMedia } from './estadoApp';
import { Biblioteca, Diccionario, Inicio, Lector, Memoria, Palabras } from './Pantallas';
import { ReproductorLocal } from './ReproductorLocal';

interface Ruta {
  id: string;
  icono: NombreIcono;
  nombre: string;
}

const GRUPOS: { titulo?: string; rutas: Ruta[] }[] = [
  { rutas: [{ id: 'inicio', icono: 'inicio', nombre: 'Inicio' }] },
  {
    titulo: 'Aprender',
    rutas: [
      { id: 'diccionario', icono: 'diccionario', nombre: 'Diccionario' },
      { id: 'lector', icono: 'lector', nombre: 'Lector' },
      { id: 'biblioteca', icono: 'biblioteca', nombre: 'Biblioteca' },
      { id: 'reproductor', icono: 'video', nombre: 'Reproductor' },
    ],
  },
  {
    titulo: 'Repasar',
    rutas: [
      { id: 'memoria', icono: 'tarjetas', nombre: 'Memoria' },
      { id: 'palabras', icono: 'palabras', nombre: 'Palabras' },
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
      aria-label={compacta ? (cuenta ? `${r.nombre}, ${cuenta} pendientes` : r.nombre) : undefined}
      data-tip={compacta ? r.nombre : undefined}
      data-tip-lado={compacta ? 'der' : undefined}
      onClick={() => navegar(r.id)}
    >
      <Icono n={r.icono} t={20} />
      {!compacta && <span>{r.nombre}</span>}
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

  const textoClaude = claude === null ? 'Comprobando Claude' : claude ? 'Claude listo' : 'Falta la clave de Claude';
  const textoAnki = anki === null ? 'Comprobando Anki' : anki ? 'Anki conectado' : 'Anki sin conectar';

  return (
    <nav class={`ap-lateral ${compacta ? 'compacta' : ''}`} aria-label="Secciones">
      <button class="ap-lateral-marca" aria-label="Kotonoha, ir a Inicio" onClick={() => navegar('inicio')}>
        {compacta ? <Logo t={34} /> : <Marca t={32} />}
      </button>

      <button
        class={`ap-lateral-crear ${creadorAbierto.value ? 'abierto' : ''}`}
        aria-label="Crear tarjeta"
        aria-expanded={creadorAbierto.value}
        data-tip={compacta ? 'Crear tarjeta' : undefined}
        data-tip-lado={compacta ? 'der' : undefined}
        onClick={() => (creadorAbierto.value = !creadorAbierto.value)}
      >
        <span class="ap-lateral-mas"><Icono n="mas" t={13} /></span>
        {!compacta && 'Crear tarjeta'}
      </button>

      <div class="ap-lateral-rutas">
        {GRUPOS.map((g, i) => (
          <div class="ap-nav-grupo" key={i}>
            {g.titulo && !compacta && <div class="ap-nav-titulo">{g.titulo}</div>}
            {g.rutas.map((r) => (
              <BotonRuta key={r.id} r={r} ruta={ruta} compacta={compacta} cuenta={r.id === 'memoria' ? pendientes : undefined} />
            ))}
          </div>
        ))}
      </div>

      <div class="ap-lateral-pie">
        <BotonRuta r={{ id: 'ajustes', icono: 'ajustes', nombre: 'Ajustes' }} ruta={ruta} compacta={compacta} />
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
            aria-label={compacta ? 'Mostrar los nombres' : 'Ocultar los nombres'}
            data-tip={compacta ? 'Mostrar los nombres' : 'Ocultar los nombres'}
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

  useEffect(() => {
    leerAjustes().then(fijarA);
    cargarFuentes().catch(() => {});
    const quitar = alCambiarAjustes(fijarA);
    const alCambiarHash = () => fijarRuta(leerRuta());
    window.addEventListener('hashchange', alCambiarHash);
    return () => {
      quitar();
      window.removeEventListener('hashchange', alCambiarHash);
    };
  }, []);

  // Se recuerda para que la ventana no destelle en el otro tema al abrirse.
  useEffect(() => guardarPreferencia('tema', a.tema), [a.tema]);

  useEffect(() => {
    const nombre = [...GRUPOS.flatMap((g) => g.rutas), { id: 'ajustes', nombre: 'Ajustes' }].find((r) => r.id === ruta)?.nombre;
    document.title = nombre ? `${nombre} · Kotonoha` : 'Kotonoha';
  }, [ruta]);

  return (
    <div class="kk-raiz ap-app" data-tema={tema}>
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
    </div>
  );
}

render(<App />, document.getElementById('raiz')!);
