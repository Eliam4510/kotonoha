// Pantallas de la ventana de la app: inicio, diccionario, lector, memoria y palabras. La Ayuda de lectura está en
// Biblioteca.tsx.

import { useEffect, useMemo, useState } from 'preact/hooks';
import { type Card, fsrs, type Grade } from 'ts-fsrs';
import type { Ajustes } from '../compartido/ajustes';
import type { EstadoMotor } from '../compartido/api';
import { alRecibirEvento, motor } from '../compartido/rpc';
import type {
  ElementoBiblioteca,
  EstadisticasPalabras,
  EstadoPalabra,
  FilaPalabra,
  ProgresoInstalacion,
  ResultadoBusqueda,
  TarjetaMemoria,
} from '../compartido/tipos';
import { AvisoVersion } from './AvisoVersion';
import { SeguirLeyendo } from './Biblioteca';
import { TarjetaInmersion } from './Inmersion';
import { SelectorLengua } from './SelectorLengua';
import { enviarAlCreador } from '../ui/borrador';
import { Ficha, NOMBRE_ESTADO } from '../ui/Ficha';
import { Icono } from '../ui/iconos';
import { TarjetaGasto } from './Gasto';
import { creadorAbierto, estadoAnki, guardarPreferencia, leerPreferencia, navegar, refrescarAnki } from './estadoApp';
import { Cabecera, Mensaje, Vacio } from './Piezas';
import { idiomaActual, numero, tm, tr } from '../compartido/i18n';
import { fuentesRecomendadas } from '../nucleo/diccionariosRecomendados';
import { lecturaDeTarjeta, lengua } from '../ui/lengua';

// ---------- Inicio ----------

const SITIOS = [
  ['YouTube', 'https://www.youtube.com'],
  [tm('Netflix'), 'https://www.netflix.com'],
  [tm('Disney+'), 'https://www.disneyplus.com'],
  [tm('Crunchyroll'), 'https://www.crunchyroll.com'],
  [tm('Viki'), 'https://www.viki.com'],
  [tm('Bilibili'), 'https://www.bilibili.com'],
  ['iQIYI', 'https://www.iq.com'],
  [tm('Prime Video'), 'https://www.primevideo.com'],
];

const NIVELES_LECTURA = [tm('Principiante'), tm('Intermedio'), tm('Avanzado')];

/** La cita del prólogo del Kokin Wakashū explica el nombre de Kotonoha: es japonés se estudie lo que se estudie. */
const LENGUA_DE_LA_MARCA = 'ja';

const ATAJOS: [string, string[]][] = [
  [tm('Crear tarjeta de la frase'), ['Q']],
  [tm('Marcar la palabra como conocida'), ['3']],
  [tm('Navegador de subtítulos'), ['G']],
  [tm('Repetir la frase'), ['S']],
  [tm('Activar la captura de audio'), [tm('Alt'), 'R']],
];

function Sendero({ conocidas }: { conocidas: number }) {
  const hitos = lengua.value.niveles.flatMap((n) => (n.palabras ? [{ nivel: n.nombre, palabras: n.palabras }] : []));
  const tope = hitos[hitos.length - 1].palabras;
  // La escala es una raíz cuadrada para que los primeros niveles no queden apretados al principio.
  const posicionHito = (n: number) => Math.min(100, Math.sqrt(n / tope) * 100);
  const siguiente = hitos.find((h) => conocidas < h.palabras);
  return (
    <div class="ap-sendero">
      <div class="ap-sendero-pista">
        <div class="ap-sendero-lleno" style={{ width: `${posicionHito(conocidas)}%` }} />
        {hitos.map((h) => (
          <span key={h.nivel} class={`ap-hito ${conocidas >= h.palabras ? 'alcanzado' : ''}`} style={{ left: `${posicionHito(h.palabras)}%` }}>
            <i />
            <b>{h.nivel}</b>
          </span>
        ))}
      </div>
      <p class="ayuda">
        {siguiente
          ? tr('Te faltan {0} palabras para el vocabulario habitual de {1}.', numero(siguiente.palabras - conocidas), siguiente.nivel)
          : tr(lengua.value.textos.vocabularioSuperado)}
      </p>
    </div>
  );
}

function PrimerosPasos({ estado, anki, instalando, alInstalar }: { estado: EstadoMotor | null; anki: boolean | null; instalando: ProgresoInstalacion | null; alInstalar: () => void }) {
  const hayDics = (estado?.diccionarios ?? []).some((d) => d.tipo === 'terminos');
  const pasos = [
    {
      hecho: hayDics,
      titulo: tr('Diccionarios'),
      ayuda: instalando ? `${instalando.titulo}: ${Math.round(instalando.avance * 100)} %` : tr(lengua.value.textos.diccionariosResumen),
      accion: !hayDics && !instalando ? <button class="btn chico primario" onClick={alInstalar}>{tr('Instalar')}</button> : null,
      progreso: instalando ? instalando.avance : null,
    },
    {
      hecho: !!estado?.claveIA,
      titulo: tr('Clave de Claude'),
      ayuda: tr('Explicaciones, lecturas y traducciones'),
      accion: !estado?.claveIA ? <button class="btn chico" onClick={() => navegar('ajustes')}>{tr('Añadir')}</button> : null,
      progreso: null,
    },
    {
      hecho: !!anki,
      titulo: tr('Anki'),
      ayuda: anki ? tr('Conectado con AnkiConnect') : tr('Abre Anki para enviarle tarjetas'),
      accion: !anki ? <button class="btn chico" onClick={() => navegar('ajustes')}>{tr('Conectar')}</button> : null,
      progreso: null,
    },
  ];
  const hechos = pasos.filter((p) => p.hecho).length;
  if (!estado || anki === null || hechos === pasos.length) return null;
  return (
    <section class="tarjeta ap-pasos ap-c12" aria-label={tr('Primeros pasos')}>
      <div class="ap-pasos-cab">
        <h2>{tr('Primeros pasos')}</h2>
        <span class="ayuda num">{tr('{0} de {1}', hechos, pasos.length)}</span>
      </div>
      <div class="ap-pasos-lista">
        {pasos.map((p, i) => (
          <div class={`ap-paso ${p.hecho ? 'hecho' : ''}`} key={p.titulo}>
            <span class="ap-paso-marca">{p.hecho ? <Icono n="ok" t={14} /> : i + 1}</span>
            <div class="ap-paso-texto">
              <b>{p.titulo}</b>
              <span>{p.ayuda}</span>
              {p.progreso !== null && <div class="barra-progreso"><div style={{ width: `${p.progreso * 100}%` }} /></div>}
            </div>
            {p.accion}
          </div>
        ))}
      </div>
    </section>
  );
}

export function Inicio({ ajustes }: { ajustes: Ajustes }) {
  const [estado, fijarEstado] = useState<EstadoMotor | null>(null);
  const anki = estadoAnki.value?.conectado ?? null;
  const [texto, fijarTexto] = useState('');
  const [mensaje, fijarMensaje] = useState('');
  const [palabras, fijarPalabras] = useState<EstadisticasPalabras | null>(null);
  const [instalando, fijarInstalando] = useState<ProgresoInstalacion | null>(null);
  const [resumenMemoria, fijarResumen] = useState<{ total: number; pendientes: number; nuevas: number } | null>(null);
  const [ultimoLibro, fijarUltimoLibro] = useState<ElementoBiblioteca | null>(null);

  const cargar = () => {
    motor.estado().then(fijarEstado).catch(console.error);
    motor.estadisticasPalabras().then(fijarPalabras).catch(console.error);
    refrescarAnki();
    motor.memoriaResumen().then(fijarResumen).catch(() => {});
    // Lo último que se abrió y aún no se ha terminado.
    motor.bibliotecaListar().then((l) => fijarUltimoLibro(l.filter((e) => e.abierto && !e.terminado).sort((x, y) => (y.abierto ?? 0) - (x.abierto ?? 0))[0] ?? null)).catch(() => {});
  };
  useEffect(() => {
    cargar();
    return alRecibirEvento((e) => {
      if (e.tipo === 'instalacion') fijarInstalando(e.progreso.fase === 'listo' ? null : e.progreso);
      if (e.tipo === 'diccionarios') cargar();
    });
  }, []);

  const dics = estado?.diccionarios ?? [];

  const instalarRecomendados = async () => {
    const fuentes = await motor.fuentesDiccionario();
    for (const f of fuentesRecomendadas(fuentes, idiomaActual()).filter((x) => !dics.some((d) => d.id === x.id))) {
      await motor.instalarDiccionario(f.id);
    }
  };

  const conocidas = palabras?.conocidas ?? 0;
  const pendientes = resumenMemoria?.pendientes ?? 0;

  return (
    <div class="ap-lienzo ap-inicio">
      <header class="ap-saludo">
        <div class="ap-saludo-texto">
          <h1 lang={lengua.value.id}>{lengua.value.saludo(new Date().getHours(), ajustes.nombre.trim())}</h1>
          <p>{pendientes ? (pendientes === 1 ? tr('Hoy tienes 1 tarjeta por repasar.') : tr('Hoy tienes {0} tarjetas por repasar.', numero(pendientes))) : tr('Hoy no tienes tarjetas pendientes. Buen momento para ver algo nuevo.')}</p>
        </div>
        <SelectorLengua a={ajustes} />
      </header>

      <div class="ap-rejilla">
        <AvisoVersion avisar={ajustes.avisarVersiones} />
        <PrimerosPasos estado={estado} anki={anki} instalando={instalando} alInstalar={instalarRecomendados} />

        <section class="tarjeta ap-vocabulario ap-c8" aria-label={tr('Tu vocabulario')}>
          <div class="ap-vocabulario-cifras">
            <div class="ap-cifra-grande">
              <b class="num">{palabras ? numero(conocidas) : '–'}</b>
              <span>{tr('palabras conocidas')}</span>
            </div>
            <dl class="ap-cifras-menores">
              <div><dt>{tr('Aprendiendo')}</dt><dd class="num">{palabras ? numero(palabras.aprendiendo) : '–'}</dd></div>
              <div><dt>{tr('Rastreadas')}</dt><dd class="num">{palabras ? numero(palabras.rastreadas) : '–'}</dd></div>
              <div><dt>{tr('Tu nivel')}</dt><dd>{lengua.value.nombreNivel(ajustes.nivel)}</dd></div>
            </dl>
          </div>
          <Sendero conocidas={conocidas} />
        </section>

        <section class={`tarjeta ap-resumen-repaso ap-c4 ${pendientes ? 'pendiente' : ''}`} aria-label={tr('Repaso')}>
          <span class="hoja-icono"><Icono n={pendientes ? 'tarjetas' : 'sello'} t={24} /></span>
          {pendientes ? (
            <>
              <div class="ap-resumen-cifra"><b class="num">{numero(pendientes)}</b><span>{tr('por repasar')}</span></div>
              <p class="ayuda">{resumenMemoria?.nuevas ? (resumenMemoria.nuevas === 1 ? tr('1 nueva de {0} en Memoria', resumenMemoria.total) : tr('{0} nuevas de {1} en Memoria', resumenMemoria.nuevas, resumenMemoria.total)) : tr('{0} en Memoria', resumenMemoria?.total ?? 0)}</p>
              <button class="btn primario bloque" onClick={() => navegar('memoria')}>{tr('Empezar el repaso')}</button>
            </>
          ) : (
            <>
              <div class="ap-resumen-cifra"><b>{tr('Todo al día')}</b></div>
              <p class="ayuda">{resumenMemoria?.total ? (resumenMemoria.total === 1 ? tr('1 tarjeta en Memoria') : tr('{0} tarjetas en Memoria', resumenMemoria.total)) : tr('Crea tu primera tarjeta desde un video o el diccionario.')}</p>
              <button class="btn bloque" onClick={() => (creadorAbierto.value = true)}><Icono n="mas" t={15} /> {tr('Crear tarjeta')}</button>
            </>
          )}
        </section>

        <TarjetaInmersion />
        {ultimoLibro && <SeguirLeyendo e={ultimoLibro} />}

        <section class="tarjeta ap-c7" aria-labelledby="ap-t-video">
          <div class="ap-tarjeta-cab">
            <span class="hoja-icono chica"><Icono n="video" t={18} /></span>
            <h2 id="ap-t-video">{tr('Mira un video')}</h2>
          </div>
          <p class="ayuda ap-tarjeta-ayuda">{tr(lengua.value.textos.primerVideo)}</p>
          <div class="ap-mosaicos">
            {SITIOS.map(([n, u]) => (
              <a key={n} class="ap-mosaico" href={u} target="_blank" rel="noreferrer noopener">
                <span>{tr(n)}</span>
                <Icono n="externo" t={14} />
              </a>
            ))}
          </div>
          <button class="ap-enlace-tarjeta" onClick={() => navegar('reproductor')}><Icono n="carpeta" t={16} /> {tr('O reproduce un archivo de tu ordenador')} <Icono n="flecha" t={14} /></button>
        </section>

        <section class="tarjeta ap-c5" aria-labelledby="ap-t-leer">
          <div class="ap-tarjeta-cab">
            <span class="hoja-icono chica"><Icono n="lector" t={18} /></span>
            <h2 id="ap-t-leer">{tr('O lee una página')}</h2>
          </div>
          <p class="ayuda ap-tarjeta-ayuda">{tr(lengua.value.textos.primeraPagina)}</p>
          <div class="ap-niveles">
            {NIVELES_LECTURA.map((nivel) => (
              <div class="ap-nivel" key={nivel}>
                <span>{tr(nivel)}</span>
                <div>
                  {lengua.value.sitiosLectura.filter((s) => s.nivel === nivel).map(({ nombre: n, url: u }) => (
                    <a key={n} class="chip" href={u} target="_blank" rel="noreferrer noopener">{n}</a>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button class="ap-enlace-tarjeta" onClick={() => navegar('lector')}><Icono n="cuaderno" t={16} /> {tr('O escribe y pega en el Cuaderno')} <Icono n="flecha" t={14} /></button>
        </section>

        <TarjetaGasto credito={ajustes.creditoMensual} />

        <section class="tarjeta ap-c7" aria-labelledby="ap-t-sabes">
          <div class="ap-tarjeta-cab">
            <span class="hoja-icono chica"><Icono n="brote" t={18} /></span>
            <h2 id="ap-t-sabes">{tr('Enséñale lo que ya sabes')}</h2>
          </div>
          <p class="ayuda ap-tarjeta-ayuda">{tr('Pega una lista de palabras o cualquier texto: se marcarán como conocidas.')}</p>
          <textarea class="campo ap-campo-lengua" lang={lengua.value.id} aria-label={tr('Palabras que ya conoces')} value={texto} onInput={(e) => fijarTexto(e.currentTarget.value)} placeholder={lengua.value.ejemplos.lista} />
          <div class="ap-botones">
            <button class="btn primario" disabled={!texto.trim()} onClick={async () => {
              const n = await motor.anadirConocidas(texto);
              fijarMensaje(tr('{0} palabras añadidas.', numero(n)));
              fijarTexto('');
              cargar();
            }}>{tr('Añadir')}</button>
            <button class="btn" onClick={() => navegar('palabras?evaluar=1')}><Icono n="objetivo" t={16} /> {tr('Evaluar mi nivel')}</button>
          </div>
          {mensaje && <Mensaje>{mensaje}</Mensaje>}
        </section>

        <section class="tarjeta ap-c5" aria-labelledby="ap-t-atajos">
          <div class="ap-tarjeta-cab">
            <span class="hoja-icono chica"><Icono n="teclado" t={18} /></span>
            <h2 id="ap-t-atajos">{tr('Atajos sobre el video')}</h2>
          </div>
          <ul class="ap-atajos">
            {ATAJOS.map(([n, teclas]) => (
              <li key={n}>
                <span>{tr(n)}</span>
                <span class="ap-teclas">{teclas.map((t) => <kbd class="tecla" key={t}>{tr(t)}</kbd>)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <footer class="ap-cita">
        <span class="ap-cita-hoja"><Icono n="hoja" t={18} /></span>
        <blockquote lang={LENGUA_DE_LA_MARCA}>やまとうたは、人の心を種として、よろづの言の葉とぞなれりける</blockquote>
        <p>{tr('La poesía de Japón tiene por semilla el corazón humano, y de él brotan miríadas de hojas de palabras.')}</p>
        <cite>{tr('Prólogo del Kokin Wakashū, c. 905. De ahí viene nuestro nombre.')}</cite>
      </footer>
    </div>
  );
}

// ---------- Diccionario ----------

export function Diccionario({ ajustes, consulta }: { ajustes: Ajustes; consulta: string }) {
  const [texto, fijarTexto] = useState(consulta);
  const [resultados, fijarResultados] = useState<ResultadoBusqueda[] | null>(null);
  const [buscado, fijarBuscado] = useState('');
  const [frase, fijarFrase] = useState('');
  const [cargando, fijarCargando] = useState(false);
  const [recientes, fijarRecientes] = useState<string[]>(() => leerPreferencia('busquedas', []));
  const [hayDics, fijarHayDics] = useState(true);

  const buscar = async (t: string) => {
    const limpio = t.trim();
    if (!limpio) return;
    fijarCargando(true);
    try {
      fijarResultados(await motor.buscarLibre(limpio));
      fijarBuscado(limpio);
      const nuevas = [limpio, ...recientes.filter((x) => x !== limpio)].slice(0, 8);
      fijarRecientes(nuevas);
      guardarPreferencia('busquedas', nuevas);
    } finally {
      fijarCargando(false);
    }
  };
  useEffect(() => {
    motor.estado().then((e) => fijarHayDics(e.diccionarios.some((d) => d.tipo === 'terminos'))).catch(() => {});
  }, []);
  useEffect(() => {
    if (consulta) {
      fijarTexto(consulta);
      buscar(consulta);
    }
  }, [consulta]);

  const inicial = resultados === null;
  const atajos = recientes.length ? recientes : lengua.value.ejemplos.sugerencias;

  return (
    <div class={`ap-lienzo ap-diccionario ${inicial ? 'inicial' : ''}`}>
      {inicial && (
        <div class="ap-dic-portada">
          <span class="hoja-icono"><Icono n="diccionario" t={24} /></span>
          <h1>{tr('¿Qué palabra buscas?')}</h1>
          <p>{tr(lengua.value.textos.buscarAyuda)}</p>
        </div>
      )}
      <form class="ap-buscador" role="search" onSubmit={(e) => { e.preventDefault(); buscar(texto); }}>
        <Icono n="buscar" t={20} />
        <input lang={lengua.value.id} aria-label={tr('Buscar en el diccionario')} placeholder={lengua.value.ejemplos.busqueda} value={texto} onInput={(e) => fijarTexto(e.currentTarget.value)} autoFocus />
        <button class="btn primario" type="submit" disabled={!texto.trim() || cargando}>{cargando ? tr('Buscando…') : tr('Buscar')}</button>
      </form>
      <label class="ap-contexto">
        <Icono n="ia" t={15} />
        <input lang={lengua.value.id} aria-label={tr('Frase de contexto opcional')} placeholder={tr('Opcional: la frase donde la viste, para que Claude la explique en contexto')} value={frase} onInput={(e) => fijarFrase(e.currentTarget.value)} />
      </label>

      {inicial && (
        <div class="ap-dic-atajos">
          <span class="ayuda">{recientes.length ? tr('Búsquedas recientes') : tr('Prueba con')}</span>
          {atajos.map((r) => (
            <button key={r} class="chip" lang={lengua.value.id} onClick={() => { fijarTexto(r); buscar(r); }}>{r}</button>
          ))}
        </div>
      )}

      {resultados && resultados.length > 0 && (
        <h2 class="ap-seccion-titulo">
          {resultados.length === 1 ? tr('1 resultado') : tr('{0} resultados', resultados.length)} · <span lang={lengua.value.id}>{buscado}</span>
        </h2>
      )}
      {resultados?.length === 0 && (
        <Vacio icono="buscar" titulo={hayDics ? tr('Sin resultados') : tr('Aún no hay diccionarios')}>
          <p>{hayDics ? tr('No hay nada para «{0}». Comprueba la escritura o busca solo la raíz de la palabra.', buscado) : tr('Instálalos en Ajustes para poder buscar.')}</p>
          {!hayDics && <button class="btn primario" onClick={() => navegar('ajustes')}>{tr('Ir a Ajustes')}</button>}
        </Vacio>
      )}
      <div class="ap-resultados">
        {resultados?.map((r) => (
          <div class="ap-resultado" key={r.clave}>
            <Ficha
              lema={r.lema}
              lectura={r.lectura}
              ajustes={ajustes}
              contexto={{ frase: frase || undefined }}
              pestanaInicial={frase ? 'ninguna' : 'audio'}
              alEnviar={(x) => enviarAlCreador({ palabra: x.lema, lectura: lecturaDeTarjeta(x), frase, definicion: [...new Set(x.entradas.flatMap((e) => e.glosas))].slice(0, 5).join('<br>') }, false)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Memoria ----------

const programador = fsrs({ enable_fuzz: false });

function duracion(ms: number): string {
  const min = ms / 60000;
  if (min < 1) return tr('<1 min');
  if (min < 60) return `${Math.round(min)} min`;
  const h = min / 60;
  if (h < 24) return `${Math.round(h)} h`;
  const d = h / 24;
  if (d < 30) return `${Math.round(d)} d`;
  const meses = d / 30.4;
  if (meses < 12) return `${Math.round(meses)} m`;
  return `${(d / 365).toFixed(1).replace('.0', '').replace('.', ',')} a`;
}

/** Cuándo volverá la tarjeta con cada respuesta. El motor añade algo de azar, así que es orientativo. */
function intervalos(t: TarjetaMemoria): Record<Grade, string> {
  const c = t.fsrs as unknown as Card;
  const tarjeta: Card = { ...c, due: new Date(c.due), last_review: c.last_review ? new Date(c.last_review) : undefined };
  const ahora = new Date();
  const de = (g: Grade) => duracion(new Date(programador.next(tarjeta, ahora, g).card.due).getTime() - ahora.getTime());
  return { 1: de(1), 2: de(2), 3: de(3), 4: de(4) } as Record<Grade, string>;
}

const NOTAS: { nota: 1 | 2 | 3 | 4; nombre: string; clase: string }[] = [
  { nota: 1, nombre: tm('Otra vez'), clase: 'otra' },
  { nota: 2, nombre: tm('Difícil'), clase: 'dificil' },
  { nota: 3, nombre: tm('Bien'), clase: 'bien' },
  { nota: 4, nombre: tm('Fácil'), clase: 'facil' },
];

export function Memoria() {
  const [cola, fijarCola] = useState<TarjetaMemoria[]>([]);
  const [resumen, fijarResumen] = useState<{ total: number; pendientes: number; nuevas: number } | null>(null);
  const [volteada, fijarVolteada] = useState(false);
  const [cargada, fijarCargada] = useState(false);

  const cargar = async () => {
    fijarCola(await motor.memoriaPendientes(50));
    fijarResumen(await motor.memoriaResumen());
    fijarVolteada(false);
    fijarCargada(true);
  };
  useEffect(() => {
    cargar().catch(console.error);
  }, []);

  const t = cola[0];
  const responder = async (nota: 1 | 2 | 3 | 4) => {
    await motor.memoriaResponder(t.id, nota);
    await cargar();
  };
  const medio = (m: { tipo: string; datos?: string; url?: string }) => (m.datos ? `data:${m.tipo};base64,${m.datos}` : m.url);
  const plazos = useMemo(() => (t ? intervalos(t) : null), [t?.id, t?.vence]);

  // Espacio para ver la respuesta y del 1 al 4 para valorarla, como en Anki.
  useEffect(() => {
    if (!t) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const objetivo = e.composedPath()[0] as HTMLElement | undefined;
      if (objetivo && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(objetivo.tagName)) return;
      if (!volteada && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        e.stopPropagation();
        fijarVolteada(true);
      } else if (volteada && /^[1-4]$/.test(e.key)) {
        e.stopPropagation();
        responder(Number(e.key) as 1 | 2 | 3 | 4);
      }
    };
    window.addEventListener('keydown', alPulsar, true);
    return () => window.removeEventListener('keydown', alPulsar, true);
  }, [t?.id, volteada]);

  return (
    <div class="ap-lienzo ap-memoria">
      <Cabecera titulo={tr('Memoria')} sub={tr('Repaso espaciado con FSRS para las tarjetas que no envías a Anki.')}>
        {resumen && resumen.total > 0 && (
          <dl class="ap-memoria-datos">
            <div><dd class="num">{numero(resumen.pendientes)}</dd><dt>{tr('Por repasar')}</dt></div>
            <div><dd class="num">{numero(resumen.nuevas)}</dd><dt>{tr('Nuevas')}</dt></div>
            <div><dd class="num">{numero(resumen.total)}</dd><dt>{tr('En total')}</dt></div>
          </dl>
        )}
      </Cabecera>

      {cargada && !t ? (
        <Vacio icono="sello" titulo={resumen?.total ? tr('Todo al día') : tr('Todavía no hay tarjetas')}>
          <p>{resumen?.total ? tr('No queda nada por repasar ahora mismo. Las tarjetas volverán cuando toque.') : tr('Las tarjetas que crees con destino Memoria aparecerán aquí.')}</p>
          <button class="btn primario" onClick={() => (creadorAbierto.value = true)}><Icono n="mas" t={15} /> {tr('Crear tarjeta')}</button>
        </Vacio>
      ) : t ? (
        <div class="ap-repaso">
          <div class={`ap-naipe ${volteada ? 'volteada' : ''} ${cola.length > 1 ? 'mazo' : ''}`} key={t.id}>
            <div class="ap-naipe-frente" lang={lengua.value.id} dangerouslySetInnerHTML={{ __html: t.frente }} />
            {t.borrador.audioFrase[0] && <button class="btn chico" onClick={() => new Audio(medio(t.borrador.audioFrase[0])).play()}><Icono n="altavoz" t={15} /> {tr('Escuchar')}</button>}
            {volteada && (
              <div class="ap-naipe-reverso">
                {t.borrador.palabra && (
                  <h3>
                    <span lang={lengua.value.id}>{t.borrador.palabra}</span>
                    {t.borrador.lectura && <small lang={lengua.value.id}>{t.borrador.lectura}</small>}
                  </h3>
                )}
                {t.borrador.traduccion && <p class="ap-naipe-traduccion">{t.borrador.traduccion}</p>}
                <div class="ap-naipe-definicion" dangerouslySetInnerHTML={{ __html: t.reverso }} />
                {t.borrador.imagenes[0] && <img src={medio(t.borrador.imagenes[0])} alt="" />}
                {t.borrador.notas && <p class="ayuda">{t.borrador.notas}</p>}
              </div>
            )}
          </div>

          {!volteada ? (
            <div class="ap-repaso-acciones">
              <button class="btn primario grande" onClick={() => fijarVolteada(true)}>{tr('Ver respuesta')} <kbd class="tecla">{tr('Espacio')}</kbd></button>
            </div>
          ) : (
            <>
              <div class="ap-notas" role="group" aria-label={tr('¿Cómo te ha ido?')}>
                {NOTAS.map((n) => (
                  <button key={n.nota} class={`ap-nota ${n.clase}`} onClick={() => responder(n.nota)}>
                    <b>{tr(n.nombre)}</b>
                    <span class="num">{plazos?.[n.nota]}</span>
                    <kbd class="tecla">{n.nota}</kbd>
                  </button>
                ))}
              </div>
              <div class="ap-repaso-acciones">
                <button class="btn fantasma chico" onClick={async () => { await motor.memoriaEliminar(t.id); await cargar(); }}><Icono n="basura" t={14} /> {tr('Eliminar esta tarjeta')}</button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ---------- Palabras ----------

function Evaluacion({ alCerrar, alTerminar }: { alCerrar: () => void; alTerminar: () => void }) {
  const [muestra, fijarMuestra] = useState<{ lema: string; lectura: string; rango: number }[] | null>(null);
  const [i, fijarI] = useState(0);
  const [conocidas, fijarConocidas] = useState<number[]>([]);
  const [error, fijarError] = useState('');
  const [resultado, fijarResultado] = useState<number | null>(null);
  useEffect(() => {
    motor.muestraEvaluacion().then(fijarMuestra).catch((e: Error) => fijarError(e.message));
  }, []);

  const terminar = async (lista: number[]) => {
    // Hasta donde siguen siendo conocidas, sin fiarse de un acierto aislado muy arriba.
    const ordenadas = [...lista].sort((a, b) => a - b);
    const estimado = ordenadas.length ? ordenadas[Math.max(0, Math.floor(ordenadas.length * 0.85) - 1)] : 0;
    fijarResultado(await motor.aplicarEvaluacion(estimado));
    alTerminar();
  };
  const m = muestra?.[i];
  const responder = (si: boolean) => {
    if (!m || !muestra) return;
    const lista = si ? [...conocidas, m.rango] : conocidas;
    fijarConocidas(lista);
    if (i + 1 >= muestra.length) terminar(lista);
    else fijarI(i + 1);
  };

  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar();
      if (resultado !== null || !m) return;
      if (e.key === 'ArrowLeft') responder(false);
      if (e.key === 'ArrowRight') responder(true);
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  });

  return (
    <div class="ap-modal-fondo" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) alCerrar(); }}>
      <div class="ap-modal ap-evaluacion" role="dialog" aria-modal="true" aria-label={tr('Evaluar mi nivel')}>
        <button class="btn-icono chico ap-modal-cerrar" aria-label={tr('Cerrar la evaluación')} onClick={alCerrar}><Icono n="cerrar" t={15} /></button>
        {error ? (
          <>
            <span class="hoja-icono"><Icono n="aviso" t={24} /></span>
            <h2>{tr('No se puede evaluar todavía')}</h2>
            <p class="ayuda">{error}</p>
            <button class="btn primario" onClick={() => navegar('ajustes')}>{tr('Ir a Ajustes')}</button>
          </>
        ) : resultado !== null ? (
          <>
            <span class="hoja-icono"><Icono n="sello" t={24} /></span>
            <h2>{tr('Hecho')}</h2>
            <p>{tr('Hemos marcado {0} palabras como conocidas según tus respuestas. Puedes corregir cualquiera en esta lista.', numero(resultado))}</p>
            <button class="btn primario" onClick={alCerrar}>{tr('Ver mis palabras')}</button>
          </>
        ) : !muestra ? (
          <>
            <span class="esqueleto" style={{ width: '40%' }} />
            <span class="esqueleto" style={{ width: '70%', height: '48px' }} />
            <span class="esqueleto" style={{ width: '50%' }} />
          </>
        ) : m ? (
          <>
            <div class="ap-evaluacion-avance">
              <span class="ayuda num">{tr('Palabra {0} de {1}', i + 1, muestra.length)}</span>
              <div class="barra-progreso"><div style={{ width: `${(i / muestra.length) * 100}%` }} /></div>
            </div>
            <div class="ap-evaluacion-palabra" lang={lengua.value.id} key={m.lema}>{m.lema}</div>
            <p class="ayuda">{tr('¿Conoces esta palabra?')}</p>
            <div class="ap-evaluacion-botones">
              <button class="btn grande" onClick={() => responder(false)}>{tr('No')} <kbd class="tecla ap-tecla-icono"><Icono n="flecha-izq" t={12} /></kbd></button>
              <button class="btn primario grande" onClick={() => responder(true)}>{tr('Sí')} <kbd class="tecla ap-tecla-icono"><Icono n="flecha" t={12} /></kbd></button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

const FILTROS: { id: EstadoPalabra | 'todas' | 'rastreadas'; nombre: string; punto?: string }[] = [
  { id: 'todas', nombre: tm('Todas') },
  { id: 'conocida', nombre: NOMBRE_ESTADO.conocida, punto: 'conocida' },
  { id: 'aprendiendo', nombre: NOMBRE_ESTADO.aprendiendo, punto: 'aprendiendo' },
  { id: 'rastreadas', nombre: tm('Rastreadas'), punto: 'rastreada' },
  { id: 'ignorada', nombre: NOMBRE_ESTADO.ignorada, punto: 'ignorada' },
];

export function Palabras({ evaluar = false }: { evaluar?: boolean }) {
  const [stats, fijarStats] = useState<EstadisticasPalabras | null>(null);
  const [filas, fijarFilas] = useState<FilaPalabra[]>([]);
  const [total, fijarTotal] = useState(0);
  const [cargada, fijarCargada] = useState(false);
  const [estado, fijarEstado] = useState<EstadoPalabra | 'todas' | 'rastreadas'>('todas');
  const [orden, fijarOrden] = useState<'reciente' | 'alfabetico' | 'frecuencia'>('reciente');
  const [busqueda, fijarBusqueda] = useState('');
  const [sel, fijarSel] = useState<Set<string>>(new Set());
  const [evaluando, fijarEvaluando] = useState(evaluar);
  const [texto, fijarTexto] = useState('');
  const [limite, fijarLimite] = useState(200);

  const cargar = async () => {
    fijarStats(await motor.estadisticasPalabras());
    const r = await motor.listarPalabras({
      estado: estado === 'rastreadas' ? 'todas' : estado,
      rastreada: estado === 'rastreadas',
      orden,
      busqueda,
      limite,
    });
    fijarFilas(r.filas);
    fijarTotal(r.total);
    fijarCargada(true);
  };
  useEffect(() => {
    cargar().catch(console.error);
  }, [estado, orden, busqueda, limite]);

  const cambiar = async (claves: string[], nuevo: EstadoPalabra) => {
    const cambios = filas.filter((f) => claves.includes(f.clave)).map((f) => ({ clave: f.clave, lema: f.lema, lectura: f.lectura, estado: nuevo }));
    await motor.cambiarPalabras(cambios);
    fijarSel(new Set());
    await cargar();
  };

  const totalPalabras = stats ? stats.conocidas + stats.aprendiendo + stats.ignoradas : 0;
  const parte = (n: number) => (totalPalabras ? `${(n / totalPalabras) * 100}%` : '0%');
  const filtrando = estado !== 'todas' || !!busqueda;

  return (
    <div class="ap-lienzo ap-palabras">
      <Cabecera titulo={tr('Palabras')} sub={tr('Todo lo que Kotonoha sabe de tu vocabulario.')}>
        <button class="btn primario" onClick={() => fijarEvaluando(true)}><Icono n="objetivo" t={16} /> {tr('Evaluar mi nivel')}</button>
      </Cabecera>

      <div class="ap-palabras-resumen">
        <section class="tarjeta ap-distribucion" aria-label={tr('Distribución de tus palabras')}>
          <div class="ap-cifra-grande mediana">
            <b class="num">{stats ? numero(totalPalabras) : '–'}</b>
            <span>{tr('palabras registradas')}</span>
          </div>
          <div class="ap-barra-estados" aria-hidden="true">
            {stats && totalPalabras > 0 ? (
              <>
                <div class="conocida" style={{ width: parte(stats.conocidas) }} />
                <div class="aprendiendo" style={{ width: parte(stats.aprendiendo) }} />
                <div class="ignorada" style={{ width: parte(stats.ignoradas) }} />
              </>
            ) : null}
          </div>
          <dl class="ap-leyenda">
            <div><dt><i class="ap-punto-estado conocida" />{tr('Conocidas')}</dt><dd class="num">{numero(stats?.conocidas) ?? '–'}</dd></div>
            <div><dt><i class="ap-punto-estado aprendiendo" />{tr('Aprendiendo')}</dt><dd class="num">{numero(stats?.aprendiendo) ?? '–'}</dd></div>
            <div><dt><i class="ap-punto-estado rastreada" />{tr('Rastreadas')}</dt><dd class="num">{numero(stats?.rastreadas) ?? '–'}</dd></div>
            <div><dt><i class="ap-punto-estado ignorada" />{tr('Ignoradas')}</dt><dd class="num">{numero(stats?.ignoradas) ?? '–'}</dd></div>
          </dl>
        </section>

        <section class="tarjeta ap-anadir-conocidas" aria-labelledby="ap-t-pegar">
          <h2 id="ap-t-pegar">{tr('Añadir conocidas')}</h2>
          <p class="ayuda">{tr(lengua.value.textos.pegarLista)}</p>
          <textarea class="campo ap-campo-lengua" lang={lengua.value.id} aria-label={tr('Añadir palabras conocidas')} placeholder={lengua.value.ejemplos.lista} value={texto} onInput={(e) => fijarTexto(e.currentTarget.value)} />
          <button class="btn bloque" disabled={!texto.trim()} onClick={async () => { await motor.anadirConocidas(texto); fijarTexto(''); await cargar(); }}>{tr('Añadir')}</button>
        </section>
      </div>

      <div class="ap-filtros">
        <label class="ap-busqueda-mini">
          <Icono n="buscar" t={16} />
          <input aria-label={tr('Buscar palabra')} placeholder={tr('Buscar')} value={busqueda} onInput={(e) => fijarBusqueda(e.currentTarget.value)} />
        </label>
        <div class="segmentado" role="radiogroup" aria-label={tr('Filtrar por estado')}>
          {FILTROS.map((f) => (
            <button key={f.id} role="radio" aria-checked={estado === f.id} class={estado === f.id ? 'activo' : ''} onClick={() => fijarEstado(f.id)}>
              {f.punto && <i class={`ap-punto-estado ${f.punto}`} />}
              {tr(f.nombre)}
            </button>
          ))}
        </div>
        <select class="selector" aria-label={tr('Ordenar')} value={orden} onChange={(e) => fijarOrden(e.currentTarget.value as typeof orden)}>
          <option value="reciente">{tr('Más recientes')}</option>
          <option value="alfabetico">{tr('Por lectura')}</option>
          <option value="frecuencia">{tr('Por frecuencia')}</option>
        </select>
      </div>

      {cargada && filas.length === 0 ? (
        <Vacio icono="palabras" titulo={filtrando ? tr('Nada con este filtro') : tr('Todavía no hay palabras aquí')}>
          <p>{filtrando ? tr('Prueba con otro estado o cambia la búsqueda.') : tr('Márcalas mientras ves un video o lees, o evalúa tu nivel para empezar con buen pie.')}</p>
          {!filtrando && <button class="btn primario" onClick={() => fijarEvaluando(true)}>{tr('Evaluar mi nivel')}</button>}
        </Vacio>
      ) : (
        <div class="ap-lista-palabras" role="list">
          {filas.map((f) => (
            <div class={`ap-fila-palabra ${sel.has(f.clave) ? 'elegida' : ''}`} role="listitem" key={f.clave}>
              <input class="ap-casilla" type="checkbox" aria-label={tr('Seleccionar {0}', f.lema)} checked={sel.has(f.clave)} onChange={(e) => {
                const s = new Set(sel);
                if (e.currentTarget.checked) s.add(f.clave);
                else s.delete(f.clave);
                fijarSel(s);
              }} />
              <div class="ap-fila-termino">
                <b lang={lengua.value.id}>{f.lema}</b>
                {f.lectura !== f.lema && <span lang={lengua.value.id}>{f.lectura}</span>}
              </div>
              <span class="ap-fila-datos num">
                {f.rastreada && <span class="ap-rastreada" data-tip={tr('Rastreada')} aria-label={tr('Rastreada')}><Icono n="huella" t={15} /></span>}
                {f.rango ? <span data-tip={tr('Posición en la lista de frecuencia')}>#{numero(f.rango)}</span> : null}
              </span>
              <label class={`ap-estado-fila ${f.estado}`}>
                <i class={`ap-punto-estado ${f.estado}`} />
                <select aria-label={tr('Estado de {0}', f.lema)} value={f.estado} onChange={(e) => cambiar([f.clave], e.currentTarget.value as EstadoPalabra)}>
                  {(['desconocida', 'aprendiendo', 'conocida', 'ignorada'] as EstadoPalabra[]).map((e) => <option key={e} value={e}>{NOMBRE_ESTADO[e]}</option>)}
                </select>
              </label>
              <button class="btn-icono chico" data-tip={tr('Buscar en el diccionario')} data-tip-lado="izq" aria-label={tr('Buscar {0}', f.lema)} onClick={() => navegar(`diccionario?q=${encodeURIComponent(f.lema)}`)}><Icono n="buscar" t={15} /></button>
            </div>
          ))}
        </div>
      )}
      {total > filas.length && <div class="ap-ver-mas"><button class="btn" onClick={() => fijarLimite(limite + 300)}>{tr('Ver más ({0})', numero(total - filas.length))}</button></div>}

      {sel.size > 0 && (
        <div class="ap-seleccion" role="toolbar" aria-label={tr('Cambiar las palabras seleccionadas')}>
          <b class="num">{sel.size === 1 ? tr('1 seleccionada') : tr('{0} seleccionadas', sel.size)}</b>
          {(['conocida', 'aprendiendo', 'ignorada', 'desconocida'] as EstadoPalabra[]).map((e) => (
            <button key={e} class="btn chico" onClick={() => cambiar([...sel], e)}><i class={`ap-punto-estado ${e}`} /> {NOMBRE_ESTADO[e]}</button>
          ))}
          <button class="btn-icono chico" aria-label={tr('Quitar la selección')} onClick={() => fijarSel(new Set())}><Icono n="cerrar" t={14} /></button>
        </div>
      )}

      {evaluando && <Evaluacion alCerrar={() => fijarEvaluando(false)} alTerminar={() => cargar().catch(console.error)} />}
    </div>
  );
}
