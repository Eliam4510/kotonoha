// «Descubre Kotonoha»: todo lo que hace, en cinco familias (ver, leer, repasar, consultar y practicar), cada cosa con una
// frase y, si se puede probar ya, un botón que lleva a ella. Lo que corre en la gráfica y va lento en este equipo lo dice,
// con lo de «Tu equipo». Cada lengua enseña lo suyo: el acento, los kanji o el examen, solo si los tiene.
// Aquí están también el texto de ejemplo, que abren la bienvenida y esta página, y las dos tarjetas de Inicio: la que
// lleva aquí y la que cuenta lo nuevo tras actualizar.

import { type Ajustes, guardarAjustes } from '../compartido/ajustes';
import { tm, tr } from '../compartido/i18n';
import { fondo, motor } from '../compartido/rpc';
import type { PaqueteLengua } from '../lenguas/tipos';
import type { EstimacionPieza, PiezaPesada } from '../nucleo/equipo';
import { Icono, type NombreIcono } from '../ui/iconos';
import { lengua } from '../ui/lengua';
import { navegar } from './estadoApp';
import { hayNovedades, NOVEDADES } from './novedades';
import { Cabecera } from './Piezas';
import { ESTADO, useEstimaciones } from './TuEquipo';

/** El texto de ejemplo de la lengua que se estudia, en la Biblioteca: la primera vez se guarda; luego se abre el mismo. */
export async function abrirTextoDeEjemplo(): Promise<void> {
  // Cada lengua tiene su base: estado() fija primero la de la lengua elegida, por si se acaba de cambiar.
  await motor.estado();
  const l = lengua.value;
  const id = `ejemplo-${l.id}`;
  if (!(await motor.bibliotecaObtener(id))) {
    const e = l.textoDeEjemplo;
    await motor.bibliotecaGuardar({ id, titulo: e.titulo, autor: e.autor, texto: e.texto, origen: 'pegado', creado: Date.now() });
  }
  await fondo.abrirVisor(id);
}

/** La primera frase del texto de prueba de la lengua: la que se propone para practicar el acento. */
const primeraFrase = () => lengua.value.ejemplos.texto.split(lengua.value.escritura.frase.partir).find((f) => f.trim()) ?? lengua.value.ejemplos.palabra;

interface Funcion {
  id: string;
  icono: NombreIcono;
  nombre: () => string;
  que: () => string;
  /** Lo que corre en la gráfica: si va lento en este equipo, se dice. */
  pieza?: PiezaPesada;
  /** Si se puede probar ya, adónde lleva. */
  probar?: { texto: string; ir: () => void };
  /** Si la lengua que se estudia lo tiene. */
  hay?: (l: PaqueteLengua) => boolean;
}

interface Familia {
  id: string;
  icono: NombreIcono;
  nombre: string;
  que: string;
  funciones: Funcion[];
}

// «Probar» ya es el botón de oír una voz (en japonés, «試聴»): aquí es ir a usar algo, y se traduce aparte.
const PROBAR = tm('Probarlo');
const nombre = (t: string) => () => tr(t);

const FAMILIAS: Familia[] = [
  {
    id: 'ver',
    icono: 'video',
    // «Ver» ya es el menú del visor («View», «表示»): esta familia es la de mirar videos, y se traduce aparte.
    nombre: tm('Mirar'),
    que: tm('Videos y series, con subtítulos para aprender.'),
    funciones: [
      {
        id: 'subtitulos',
        icono: 'subtitulos',
        nombre: nombre(tm('Subtítulos sobre el video')),
        que: () => tr(lengua.value.textos.primerVideo),
        probar: { texto: tm('Abrir YouTube'), ir: () => window.open('https://www.youtube.com', '_blank', 'noopener') },
      },
      {
        id: 'archivos',
        icono: 'carpeta',
        nombre: nombre(tm('Videos de tu ordenador')),
        que: () => tr('El reproductor abre tus archivos de video, con los subtítulos que traigan.'),
        probar: { texto: PROBAR, ir: () => navegar('reproductor') },
      },
      { id: 'voz', icono: 'ondas', nombre: nombre(tm('Videos sin subtítulos')), que: () => tr('Se transcriben en tu equipo, con la tarjeta gráfica, sin la nube.'), pieza: 'voz' },
      { id: 'letras', icono: 'musica', nombre: nombre(tm('Letras de canciones')), que: () => tr('Pega la letra de una canción y Claude la coloca sobre sus tiempos.'), pieza: 'letras' },
    ],
  },
  {
    id: 'leer',
    icono: 'lector',
    nombre: tm('Leer'),
    que: tm('Libros, manga, páginas web y lo que escribas.'),
    funciones: [
      {
        id: 'ejemplo',
        icono: 'libro',
        nombre: nombre(tm('Un texto de ejemplo')),
        que: () => tr('{0}, de {1}: toca una palabra para ver su ficha y crear tu primera tarjeta.', lengua.value.textoDeEjemplo.titulo, lengua.value.textoDeEjemplo.autor),
        probar: { texto: tm('Abrir'), ir: () => void abrirTextoDeEjemplo().catch(console.error) },
      },
      {
        id: 'biblioteca',
        icono: 'biblioteca',
        nombre: nombre(tm('Libros y manga')),
        que: () => tr('Tus PDF, EPUB y CBZ en el visor, con notas, marcadores y búsqueda.'),
        probar: { texto: PROBAR, ir: () => navegar('biblioteca') },
      },
      { id: 'ocr', icono: 'texto', nombre: nombre(tm('Texto de las páginas')), que: () => tr('El OCR lee en tu equipo las páginas que son una imagen.'), pieza: 'ocr-libro' },
      { id: 'web', icono: 'mundo', nombre: nombre(tm('Páginas web')), que: () => tr(lengua.value.textos.primeraPagina) },
      {
        id: 'cuaderno',
        icono: 'cuaderno',
        nombre: nombre(tm('Cuaderno')),
        que: () => tr('Escribe o pega texto, y léelo analizado, con la ficha de cada palabra.'),
        probar: { texto: PROBAR, ir: () => navegar('lector') },
      },
    ],
  },
  {
    id: 'repasar',
    icono: 'tarjetas',
    nombre: tm('Repasar'),
    que: tm('Lo que guardas vuelve justo antes de que lo olvides.'),
    funciones: [
      {
        id: 'memoria',
        icono: 'tarjetas',
        nombre: nombre(tm('Memoria')),
        que: () => tr('Tus tarjetas, con repetición espaciada, o en Anki si lo prefieres.'),
        probar: { texto: PROBAR, ir: () => navegar('memoria') },
      },
      {
        id: 'palabras',
        icono: 'palabras',
        nombre: nombre(tm('Palabras')),
        que: () => tr('Las palabras que ya sabes, y una prueba para conocer tu nivel.'),
        probar: { texto: PROBAR, ir: () => navegar('palabras') },
      },
      {
        id: 'niveles',
        icono: 'nivel',
        nombre: () => lengua.value.listasNivel?.examen ?? '',
        que: () => tr('El vocabulario, los caracteres y la gramática de cada nivel del examen.'),
        probar: { texto: PROBAR, ir: () => navegar('niveles') },
        hay: (l) => !!l.listasNivel,
      },
    ],
  },
  {
    id: 'consultar',
    icono: 'diccionario',
    nombre: tm('Consultar'),
    que: tm('Todo lo de una palabra, en un sitio.'),
    funciones: [
      {
        id: 'diccionario',
        icono: 'diccionario',
        nombre: nombre(tm('Diccionario')),
        que: () => tr('Sus sentidos, ejemplos sacados de lo que ves y lees, y cómo se pronuncia.'),
        probar: { texto: PROBAR, ir: () => navegar(`diccionario?q=${encodeURIComponent(lengua.value.ejemplos.palabra)}`) },
      },
      {
        id: 'kanji',
        icono: 'trazos',
        // El nombre de los caracteres es de cada lengua («Kanji» en japonés): sale de su paquete.
        nombre: () => tr(lengua.value.paginaCaracter?.nombre ?? ''),
        que: () => tr('Al buscar un solo carácter: sus lecturas, sus partes y el orden de sus trazos.'),
        probar: { texto: PROBAR, ir: () => navegar(`diccionario?q=${encodeURIComponent([...lengua.value.ejemplos.palabra][0] ?? '')}`) },
        hay: (l) => !!l.paginaCaracter,
      },
      { id: 'gramatica', icono: 'gramatica', nombre: nombre(tm('Gramática')), que: () => tr('Los puntos de gramática de cada frase, con su explicación, en la ficha.') },
    ],
  },
  {
    id: 'practicar',
    icono: 'microfono',
    nombre: tm('Practicar'),
    que: tm('Escuchar, hablar y escribir.'),
    funciones: [
      {
        id: 'dictado',
        icono: 'microfono',
        nombre: nombre(tm('Dictado')),
        que: () => tr('Dicta al Cuaderno con tu voz, que se transcribe en tu equipo.'),
        pieza: 'practica',
        probar: { texto: PROBAR, ir: () => navegar('lector') },
      },
      {
        id: 'acento',
        icono: 'voz',
        nombre: nombre(tm('Acento')),
        que: () => tr('Lee una frase en voz alta y compara la curva de tu tono con la esperada.'),
        pieza: 'practica',
        probar: { texto: PROBAR, ir: () => navegar(`practicar?t=${encodeURIComponent(primeraFrase())}`) },
        // Inglés y alemán colorean el acento de las palabras, pero la práctica con el micrófono es la del acento tonal.
        hay: (l) => !!l.acento?.practica,
      },
      {
        id: 'tonos',
        icono: 'voz',
        nombre: nombre(tm('Tonos')),
        que: () => tr('Lee una frase en voz alta y compara la curva de cada sílaba con la forma de su tono. Sin modelos de voz: se mide al momento.'),
        probar: { texto: PROBAR, ir: () => navegar(`practicar?t=${encodeURIComponent(primeraFrase())}`) },
        hay: (l) => !!l.acento?.tonos,
      },
      {
        id: 'como-suena',
        icono: 'oido',
        nombre: nombre(tm('Cómo suena')),
        que: () => tr('Cómo se dice de verdad una frase hablando seguido, en su pestaña de la ficha.'),
        hay: (l) => !!l.comoSuena,
      },
      {
        id: 'voces',
        icono: 'altavoz',
        nombre: nombre(tm('Voces neuronales de AivisHub')),
        que: () => tr('Las frases, leídas con las voces de AivisSpeech en tu equipo y sin programas aparte.'),
        pieza: 'habla',
        probar: { texto: PROBAR, ir: () => navegar('ajustes?seccion=voces') },
        hay: (l) => !!l.vocesIntegradas,
      },
    ],
  },
];

function TarjetaFuncion({ f, e }: { f: Funcion; e?: EstimacionPieza }) {
  const lento = e && (e.estado === 'lento' || e.estado === 'muy-lento');
  return (
    <li class="ap-funcion" data-funcion={f.id}>
      <span class="ap-funcion-icono" aria-hidden="true">
        <Icono n={f.icono} t={18} />
      </span>
      <div class="ap-funcion-texto">
        <b>{f.nombre()}</b>
        <span>{f.que()}</span>
        {lento && <span class={`ap-equipo-estado ${e.estado}`}>{tr(ESTADO[e.estado])}</span>}
        {f.probar && (
          <button type="button" class="btn chico" onClick={f.probar.ir}>
            {tr(f.probar.texto)}
          </button>
        )}
      </div>
    </li>
  );
}

/** La página: las cinco familias, con lo que la lengua que se estudia tiene. */
export function Descubre({ a }: { a: Ajustes }) {
  const estimaciones = useEstimaciones(a);
  return (
    <div class="ap-lienzo ap-descubre">
      <Cabecera titulo={tr('Descubre Kotonoha')} sub={tr('Todo lo que puede hacer, por familias. Lo que corre en la tarjeta gráfica dice si en este equipo irá lento.')} />
      {FAMILIAS.map((familia) => (
        <section class="tarjeta ap-familia" key={familia.id} data-familia={familia.id} aria-labelledby={`ap-familia-${familia.id}`}>
          <div class="ap-tarjeta-cab">
            <span class="hoja-icono chica">
              <Icono n={familia.icono} t={18} />
            </span>
            <div>
              <h2 id={`ap-familia-${familia.id}`}>{tr(familia.nombre)}</h2>
              <p class="ayuda">{tr(familia.que)}</p>
            </div>
          </div>
          <ul class="ap-funciones">
            {familia.funciones
              .filter((f) => !f.hay || f.hay(lengua.value))
              .map((f) => (
                <TarjetaFuncion key={f.id} f={f} e={f.pieza ? estimaciones?.[f.pieza] : undefined} />
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** En Inicio, la tarjeta que lleva a «Descubre Kotonoha». */
export function TarjetaDescubre() {
  return (
    <section class="tarjeta ap-aviso-descubre ap-c12" aria-label={tr('Descubre Kotonoha')}>
      <span class="ap-aviso-version-icono">
        <Icono n="brujula" t={20} />
      </span>
      <div class="ap-aviso-version-texto">
        <b>{tr('Descubre Kotonoha')}</b>
        <span>{tr('Todo lo que puede hacer, por familias, con un botón para probar cada cosa.')}</span>
      </div>
      <button type="button" class="btn chico" onClick={() => navegar('descubre')}>
        {tr('Ver todo')}
      </button>
    </section>
  );
}

/** En Inicio, tras actualizar: lo nuevo de esta versión, una vez. Quien acaba de instalar Kotonoha no lo ve. */
export function LoNuevo({ a }: { a: Ajustes }) {
  const instalada = chrome.runtime.getManifest().version;
  if (!a.bienvenidaVista || !hayNovedades(instalada, a.novedadesVistas)) return null;
  const cerrar = () => guardarAjustes({ novedadesVistas: instalada }).catch(console.error);
  return (
    <section class="tarjeta ap-lo-nuevo ap-c12" aria-label={tr('Novedades de la {0}', instalada)}>
      <div class="ap-lo-nuevo-cab">
        <span class="ap-aviso-version-icono">
          <Icono n="estrella" t={20} />
        </span>
        <b>{tr('Novedades de la {0}', instalada)}</b>
        <button type="button" class="btn-icono chico" aria-label={tr('Cerrar')} onClick={cerrar}>
          <Icono n="cerrar" t={15} />
        </button>
      </div>
      <ul>
        {NOVEDADES.puntos.map((p) => (
          <li key={p}>{tr(p)}</li>
        ))}
      </ul>
      <a class="ap-enlace-tarjeta" href={`https://github.com/Eliam4510/kotonoha/releases/tag/v${instalada}`} target="_blank" rel="noreferrer noopener" onClick={cerrar}>
        {tr('Todas las novedades')} <Icono n="externo" t={14} />
      </a>
    </section>
  );
}
