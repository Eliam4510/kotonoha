// «Tu equipo»: lo que Kotonoha sabe de este equipo y cuánto tardaría aquí cada pieza pesada (la voz local, las letras de
// canciones, el OCR y el dictado), que corren en la gráfica y no en la nube. Va en la bienvenida y en Ajustes, y quien ya
// usaba Kotonoha lo conoce por un aviso en Inicio. «Probar mi equipo» lee una página de muestra con el OCR de libros (la
// primera vez baja su modelo, que luego usa el lector) y mide de verdad. Nada se apaga: solo se recomienda.

import { useEffect, useState } from 'preact/hooks';
import { type Ajustes, guardarAjustes, MODELOS_WHISPER } from '../compartido/ajustes';
import { detectarEquipo } from '../compartido/equipo';
import { numero, tm, tr } from '../compartido/i18n';
import { type EstadoPieza, type EstimacionPieza, estimar, lecturaCorrecta, type NivelEquipo, nivelDe, nombreDeGpu, OCR_LIBRO_MB, OCR_MANGA_MB, type PiezaPesada, pocoEspacio, type PruebaEquipo, type SenalesEquipo } from '../nucleo/equipo';
import { Icono, type NombreIcono } from '../ui/iconos';
import { lengua } from '../ui/lengua';
import { LectorOcr } from '../visor/ocr';
import { navegar } from './estadoApp';
import { Mensaje } from './Piezas';

/** La página de muestra: unas líneas en letra de imprenta, que se dibujan igual en cualquier sistema. */
const MUESTRA = ['Kotonoha 2026', 'Reading test 0123456789', 'The quick brown fox jumps over the lazy dog'];

function paginaDeMuestra(): ImageBitmap {
  const lienzo = new OffscreenCanvas(1200, 1600);
  const c = lienzo.getContext('2d')!;
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, 1200, 1600);
  c.fillStyle = '#111111';
  c.font = '56px Arial, Helvetica, sans-serif';
  MUESTRA.forEach((l, i) => c.fillText(l, 120, 300 + i * 110));
  return lienzo.transferToImageBitmap();
}

/**
 * Mide el equipo: el OCR de libros lee la página de muestra tres veces. La primera carga el modelo (y lo descarga la
 * primera vez) y no cuenta; de las otras dos vale la más rápida. Se lee como una zona suelta: no se guarda nada.
 */
export async function probarEquipo(alDescargar: (porcentaje: number | null) => void): Promise<PruebaEquipo> {
  const lector = new LectorOcr((d) => alDescargar(d.cargado >= d.total ? null : Math.round((100 * d.cargado) / Math.max(1, d.total))));
  try {
    const leer = async () => {
      const t0 = performance.now();
      const lineas = await lector.leerZona('libro', async () => ({ imagen: paginaDeMuestra() }));
      return { ms: performance.now() - t0, texto: lineas.map((l) => l.texto).join(' ') };
    };
    await leer();
    alDescargar(null);
    const a = await leer();
    const b = await leer();
    const mejor = a.ms <= b.ms ? a : b;
    return { ocrMs: Math.round(mejor.ms), correcto: lecturaCorrecta(mejor.texto, MUESTRA.join(' ')), dispositivo: lector.ultima?.dispositivo === 'webgpu' ? 'webgpu' : 'wasm', fecha: Date.now() };
  } finally {
    lector.cerrar();
  }
}

const NIVEL: Record<NivelEquipo, { nombre: string; explicacion: string }> = {
  potente: { nombre: tm('Equipo potente'), explicacion: tm('Todo irá bien en este equipo.') },
  medio: { nombre: tm('Equipo medio'), explicacion: tm('Lo esencial irá bien; lo más pesado, como la voz local, irá más lento.') },
  basico: {
    nombre: tm('Equipo básico'),
    explicacion: tm('Los subtítulos, el diccionario, las tarjetas, el Cuaderno y los libros que traen su texto irán bien. Lo que corre en la gráfica irá muy lento.'),
  },
  'sin-medir': { nombre: tm('Sin medir'), explicacion: tm('El navegador no dice si la gráfica es integrada o dedicada. Pruébala para saber qué tal irá cada cosa.') },
};

const ESTADO: Record<EstadoPieza, string> = {
  bien: tm('Irá bien'),
  lento: tm('Irá lento'),
  'muy-lento': tm('Muy lento aquí'),
  'sin-medir': tm('Sin medir'),
};

interface Pieza {
  nombre: string;
  que: string;
  /** Para qué es el tiempo: 30 minutos de video, una página… */
  unidad: string;
  icono: NombreIcono;
  /** Qué hacer si va lento. */
  consejo: string;
}

const PIEZA: Record<PiezaPesada, Pieza> = {
  voz: {
    nombre: tm('Subtítulos para videos sin ellos'),
    que: tm('Transcribe la voz del video en este equipo.'),
    unidad: tm('30 minutos de video'),
    icono: 'ondas',
    consejo: tm('Con Whisper Base, en Ajustes, Transcripción, va más rápido, aunque con más errores.'),
  },
  letras: {
    nombre: tm('Letras de canciones'),
    que: tm('Escucha la canción para poner cada verso a su tiempo.'),
    unidad: tm('Una canción de 4 minutos'),
    icono: 'musica',
    consejo: tm('Funciona igual, pero tarda: puede trabajar mientras haces otra cosa.'),
  },
  'ocr-libro': {
    nombre: tm('Texto de libros escaneados'),
    que: tm('Lee las páginas que son una imagen.'),
    unidad: tm('Una página'),
    icono: 'texto',
    consejo: tm('Las siguientes se leen mientras lees, y «Leer una zona» lee solo lo que haga falta.'),
  },
  'ocr-manga': {
    nombre: tm('Texto de manga'),
    que: tm('Lee los globos de cada página.'),
    unidad: tm('Una página'),
    icono: 'imagen',
    consejo: tm('Las siguientes se leen mientras lees, y «Leer una zona» lee solo lo que haga falta.'),
  },
  practica: {
    nombre: tm('Dictado y práctica de la pronunciación'),
    que: tm('Escucha lo que dices con el micrófono.'),
    unidad: tm('Después de decir una frase'),
    icono: 'microfono',
    consejo: tm('Cada frase tardará un poco en corregirse.'),
  },
};

/** Las piezas que hay en la lengua que se estudia: el manga, con manga-ocr, es del japonés. */
const piezasDeLengua = (): PiezaPesada[] => ['voz', 'letras', 'ocr-libro', ...(lengua.value.id === 'ja' ? (['ocr-manga'] as const) : []), 'practica'];

/** Lo que se descarga la primera vez que se usa cada pieza, en MB. */
function descargaDe(p: PiezaPesada): number {
  if (p === 'ocr-libro') return OCR_LIBRO_MB;
  if (p === 'ocr-manga') return OCR_MANGA_MB;
  if (p === 'letras') return MODELOS_WHISPER.turbo.mb;
  return lengua.value.id === 'ja' ? MODELOS_WHISPER.haas.mb : MODELOS_WHISPER.parakeet.mb;
}

const tamano = (mb: number) => (mb >= 1000 ? tr('{0} GB', numero(Math.round(mb / 100) / 10)) : tr('{0} MB', numero(mb)));

function duracion(segundos: number): string {
  if (segundos < 1) return tr('menos de 1 s');
  if (segundos < 10) return tr('unos {0} s', numero(Math.round(segundos * 10) / 10));
  if (segundos < 90) return tr('unos {0} s', numero(Math.round(segundos)));
  return tr('unos {0} min', numero(Math.round(segundos / 60)));
}

/** La gráfica, los núcleos y la memoria, como se los conoce. */
function descripcion(s: SenalesEquipo): string {
  const gpu = s.webgpu ? nombreDeGpu(s.gpu) || tr('una gráfica') : s.respaldo ? tr('solo una gráfica de respaldo') : tr('sin gráfica para la web');
  const partes = [tr('Gráfica: {0}', gpu)];
  if (s.nucleos) partes.push(tr('{0} núcleos', numero(s.nucleos)));
  if (s.memoria) partes.push(s.memoria >= 8 ? tr('8 GB de memoria o más') : tr('{0} GB de memoria', numero(s.memoria)));
  return partes.join(' · ');
}

function TarjetaPieza({ e, a }: { e: EstimacionPieza; a: Ajustes }) {
  const p = PIEZA[e.pieza];
  const lento = e.estado === 'lento' || e.estado === 'muy-lento';
  return (
    <li class={`ap-equipo-pieza ${e.estado}`} data-pieza={e.pieza}>
      <span class="ap-equipo-pieza-icono" aria-hidden="true"><Icono n={p.icono} t={17} /></span>
      <div class="ap-equipo-pieza-texto">
        <b>{tr(p.nombre)}</b>
        <span>
          {tr(p.que)} {tr('Descarga {0} la primera vez.', tamano(descargaDe(e.pieza)))}
        </span>
        {e.segundos !== undefined && (
          <span class="ap-equipo-tiempo">
            {tr(p.unidad)}: {duracion(e.segundos)}
          </span>
        )}
        {lento && <span class="ap-equipo-consejo">{tr(p.consejo)}</span>}
        {lento && e.pieza === 'voz' && a.whisperModelo !== 'base' && (
          <button class="btn chico" onClick={() => guardarAjustes({ whisperModelo: 'base' }).catch(console.error)}>
            {tr('Usar Whisper Base')}
          </button>
        )}
      </div>
      <span class={`ap-equipo-estado ${e.estado}`}>{tr(ESTADO[e.estado])}</span>
    </li>
  );
}

/** Lo de este equipo, con «Probar mi equipo». Lo medido se guarda en los ajustes, así que vale en todo Kotonoha. */
export function PanelEquipo({ a }: { a: Ajustes }) {
  const [senales, fijarSenales] = useState<SenalesEquipo | null>(null);
  const [probando, fijarProbando] = useState(false);
  const [descarga, fijarDescarga] = useState<number | null>(null);
  const [error, fijarError] = useState('');
  useEffect(() => {
    detectarEquipo()
      .then(fijarSenales)
      .catch(() => fijarSenales({ webgpu: false, respaldo: false, gpu: { fabricante: '', arquitectura: '', descripcion: '' }, nucleos: 0, memoria: null, libre: null }));
  }, []);
  const probar = async () => {
    fijarProbando(true);
    fijarError('');
    try {
      const p = await probarEquipo(fijarDescarga);
      await guardarAjustes({ equipoPrueba: p, avisoEquipoVisto: true });
    } catch (e) {
      fijarError(e instanceof Error ? e.message : String(e));
    } finally {
      fijarProbando(false);
      fijarDescarga(null);
    }
  };
  if (!senales) return <p class="ayuda" role="status">{tr('Mirando tu equipo…')}</p>;
  const prueba = a.equipoPrueba;
  const nivel = nivelDe(senales, prueba);
  const piezas = estimar(piezasDeLengua(), senales, prueba);
  const resultado = !prueba
    ? tr('Lee una página de muestra con el OCR. La primera vez descarga {0}, que luego usa el lector.', tamano(OCR_LIBRO_MB))
    : !prueba.correcto
      ? tr('El OCR leyó mal la página de muestra: la gráfica o su controlador pueden dar problemas.')
      : prueba.dispositivo === 'webgpu'
        ? tr('Leyó la página de muestra en {0} s, con la gráfica.', numero(Math.round(prueba.ocrMs / 100) / 10))
        : tr('Leyó la página de muestra en {0} s, con el procesador: el navegador no le dejó usar la gráfica.', numero(Math.round(prueba.ocrMs / 100) / 10));
  return (
    <div class="ap-equipo" data-nivel={nivel}>
      <div class="ap-equipo-cab">
        <span class={`ap-equipo-nivel ${nivel}`}>
          <Icono n="monitor" t={16} /> {tr(NIVEL[nivel].nombre)}
        </span>
        <span class="ap-equipo-datos">{descripcion(senales)}</span>
      </div>
      <p class="ap-equipo-explicacion">{tr(NIVEL[nivel].explicacion)}</p>
      <div class="ap-equipo-prueba">
        <button class="btn" disabled={probando} onClick={probar}>
          <Icono n={probando ? 'espera' : 'rayo'} t={15} /> {prueba ? tr('Probar otra vez') : tr('Probar mi equipo')}
        </button>
        <span class="ayuda" role="status">
          {probando ? (descarga !== null ? tr('Descargando el modelo del OCR: {0} %', numero(descarga)) : tr('Leyendo la página de muestra…')) : resultado}
        </span>
      </div>
      {error && <Mensaje error>{error}</Mensaje>}
      {pocoEspacio(senales) && <Mensaje error>{tr('Queda poco espacio: un modelo de voz ocupa más de 1 GB.')}</Mensaje>}
      <ul class="ap-equipo-piezas">
        {piezas.map((e) => (
          <TarjetaPieza key={e.pieza} e={e} a={a} />
        ))}
      </ul>
      <p class="ayuda ap-equipo-nota">{tr('Nada se apaga: todo sigue disponible. Lo pesado se descarga la primera vez que se usa, y lo medido no sale de este equipo.')}</p>
    </div>
  );
}

/** El aviso de Inicio para quien ya usaba Kotonoha: una vez, hasta que lo cierre o mire su equipo. */
export function AvisoEquipo() {
  const cerrar = () => guardarAjustes({ avisoEquipoVisto: true }).catch(console.error);
  return (
    <section class="tarjeta ap-aviso-equipo ap-c12" aria-label={tr('Tu equipo')}>
      <span class="ap-aviso-version-icono"><Icono n="monitor" t={20} /></span>
      <div class="ap-aviso-version-texto">
        <b>{tr('Nuevo: «Tu equipo»')}</b>
        <span>{tr('Mira qué tal irán en este equipo la voz local, las letras de canciones y el OCR, y pruébalo con una página de muestra.')}</span>
      </div>
      <button
        class="btn primario chico"
        onClick={() => {
          cerrar();
          navegar('ajustes?seccion=equipo');
        }}
      >
        {tr('Ver mi equipo')}
      </button>
      <button class="btn-icono chico" aria-label={tr('Cerrar')} onClick={cerrar}>
        <Icono n="cerrar" t={15} />
      </button>
    </section>
  );
}
