// Pantalla de ajustes de la ventana de la app.

import type { InfoAyudante } from '../compartido/api';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { type Ajustes, CLAVE_API, type Esfuerzo, guardarAjustes, MODELOS, MODELOS_WHISPER, type ModeloWhisper, type PestanaDiccionario, type Prellenado, type TareaIA, type Tema } from '../compartido/ajustes';
import { alRecibirEvento, motor } from '../compartido/rpc';
import type { FuenteBiblioteca, InfoDiccionario, ProgresoInstalacion } from '../compartido/tipos';
import { PROMPTS_BASE, TAREAS_PERSONALIZABLES } from '../motor/prompts';
import { Icono, type NombreIcono } from '../ui/iconos';
import { estadoAnki, refrescarAnki } from './estadoApp';
import { Cabecera, Interruptor, Mensaje } from './Piezas';

const NOMBRES_TAREA: [TareaIA, string][] = [
  ['explicar', 'Explicación de palabras'],
  ['sentido', 'Significado en la frase'],
  ['analisis', 'Revisión de lecturas, sentidos y gramática'],
  ['corregir', 'Corrección de subtítulos automáticos'],
  ['desglosar', 'Desglose de frases'],
  ['traducir', 'Traducción de frases'],
  ['subtitulos', 'Traducción de subtítulos completos'],
  ['preguntar', 'Preguntas libres'],
  ['generar', 'Frases de ejemplo'],
  ['historia', 'Relatos'],
  ['profundo', 'Botón «Profundizar»'],
];

const CAMPOS_TARJETA: [string, string][] = [
  ['palabra', 'Palabra'],
  ['lectura', 'Lectura'],
  ['frase', 'Frase'],
  ['furigana', 'Frase con furigana'],
  ['traduccion', 'Traducción'],
  ['definicion', 'Definición'],
  ['audioFrase', 'Audio de la frase'],
  ['audioPalabra', 'Audio de la palabra'],
  ['imagenes', 'Imagen'],
  ['ejemplos', 'Ejemplos'],
  ['notas', 'Notas'],
  ['fuente', 'Fuente'],
];

const PRELLENADO: { grupo: string; ayuda?: string; items: [keyof Prellenado, string][] }[] = [
  { grupo: 'Frase', ayuda: 'Se añade solo una', items: [['fraseVideo', 'La frase donde aparece la palabra'], ['fraseIA', 'Generada por Claude si no hay frase']] },
  { grupo: 'Traducción', ayuda: 'Se añade solo una', items: [['traduccionIA', 'Traducción de Claude'], ['traduccionSecundaria', 'Subtítulos secundarios, si los hay']] },
  { grupo: 'Definición', items: [['definiciones', 'Definiciones del diccionario']] },
  { grupo: 'Audio de la frase', ayuda: 'Se añade solo uno', items: [['audioFraseVideo', 'Audio del video'], ['audioFraseVoz', 'Voz neuronal de Azure']] },
  { grupo: 'Audio de la palabra', items: [['audioPalabraDiccionario', 'Grabación de un nativo'], ['audioPalabraVoz', 'Voz neuronal de Azure']] },
  { grupo: 'Imagen', items: [['imagenCaptura', 'Captura del video'], ['imagenBusqueda', 'Búsqueda de imágenes']] },
  { grupo: 'Extras', items: [['ejemplos', 'Frases de lo que has visto'], ['explicacionIA', 'Explicación de Claude en las notas']] },
];

const PESTANAS: [PestanaDiccionario, string][] = [
  ['ninguna', 'Solo el diccionario'],
  ['explicar', 'Explicación de Claude'],
  ['desglose', 'Desglose de la frase'],
  ['traduccion', 'Traducción'],
  ['audio', 'Audio'],
  ['imagenes', 'Imágenes'],
  ['ejemplos', 'Ejemplos'],
  ['enlaces', 'Enlaces'],
];

const NOMBRES_CONTENIDO: Record<Ajustes['ordenContenido'][number], string> = {
  definiciones: 'Definiciones',
  flexiones: 'Conjugación',
  pestanas: 'Pestañas',
};

interface PropsSeccion {
  a: Ajustes;
  cambiar: (c: Partial<Ajustes>) => void;
}

function Seccion({ id, icono, titulo, descripcion, ia, children }: { id: string; icono: NombreIcono; titulo: string; descripcion?: ComponentChildren; ia?: boolean; children: ComponentChildren }) {
  return (
    <section class="ap-ajuste-seccion" id={id} aria-labelledby={`ap-t-${id}`}>
      <header>
        <span class={`hoja-icono chica ${ia ? 'ia' : ''}`}><Icono n={icono} t={18} /></span>
        <div>
          <h2 id={`ap-t-${id}`}>{titulo}</h2>
          {descripcion && <p>{descripcion}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

/** Fila de ajuste: lo que hace a la izquierda, el control a la derecha. */
function Opcion({ titulo, ayuda, children }: { titulo: ComponentChildren; ayuda?: ComponentChildren; children: ComponentChildren }) {
  return (
    <div class="ap-opcion">
      <div class="ap-opcion-texto">
        <b>{titulo}</b>
        {ayuda && <span>{ayuda}</span>}
      </div>
      <div class="ap-opcion-control">{children}</div>
    </div>
  );
}

function Subtitulo({ children }: { children: ComponentChildren }) {
  return <h3 class="ap-ajuste-subtitulo">{children}</h3>;
}

const TEMAS: { id: Tema; nombre: string; icono: NombreIcono; ayuda: string }[] = [
  { id: 'auto', nombre: 'Automático', icono: 'monitor', ayuda: 'Sigue a tu sistema' },
  { id: 'claro', nombre: 'Papel', icono: 'sol', ayuda: 'Claro, como el washi' },
  { id: 'oscuro', nombre: 'Tinta', icono: 'luna', ayuda: 'Oscuro, para la noche' },
];

function MuestraTema({ tema }: { tema: 'claro' | 'oscuro' }) {
  return (
    <div class="kk-raiz ap-muestra" data-tema={tema} aria-hidden="true">
      <span class="ap-muestra-lateral"><i /><i /><i /></span>
      <span class="ap-muestra-cuerpo">
        <i class="titulo" />
        <i class="tarjeta-m"><u /><u /></i>
        <i class="boton" />
      </span>
    </div>
  );
}

function SeccionApariencia({ a, cambiar }: PropsSeccion) {
  return (
    <Seccion id="apariencia" icono="paleta" titulo="Apariencia" descripcion="Se aplica a esta ventana y al menú de la extensión. Sobre el video, Kotonoha siempre va en oscuro para no deslumbrar.">
      <div class="ap-temas" role="radiogroup" aria-label="Tema">
        {TEMAS.map((t) => (
          <button key={t.id} class={`ap-tema ${a.tema === t.id ? 'activo' : ''}`} role="radio" aria-checked={a.tema === t.id} onClick={() => cambiar({ tema: t.id })}>
            <span class={`ap-tema-vista ${t.id}`}>
              {t.id === 'auto' ? (
                <>
                  <MuestraTema tema="claro" />
                  <MuestraTema tema="oscuro" />
                </>
              ) : (
                <MuestraTema tema={t.id} />
              )}
            </span>
            <span class="ap-tema-nombre"><Icono n={t.icono} t={16} /> <b>{t.nombre}</b></span>
            <span class="ayuda">{t.ayuda}</span>
          </button>
        ))}
      </div>
    </Seccion>
  );
}

function SeccionClaude({ a, cambiar }: PropsSeccion) {
  const [clave, fijarClave] = useState('');
  const [guardada, fijarGuardada] = useState(false);
  const [prueba, fijarPrueba] = useState<{ texto: string; error?: boolean } | null>(null);
  const [probando, fijarProbando] = useState(false);
  useEffect(() => {
    chrome.storage.local.get(CLAVE_API).then((d) => fijarGuardada(!!d[CLAVE_API]));
  }, []);
  return (
    <Seccion id="claude" icono="ia" ia titulo="Claude" descripcion="La IA usa tu propia clave de la API. Se guarda solo en este navegador y nunca llega a las páginas que visitas.">
      <div class={`ap-clave ${guardada ? 'guardada' : ''}`}>
        <div class="ap-clave-estado">
          <span class={`ap-punto ${guardada ? 'ia' : ''}`} />
          <b>{guardada ? 'Clave guardada' : 'Aún no hay clave'}</b>
          {!guardada && <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer noopener">Conseguir una clave <Icono n="externo" t={13} /></a>}
        </div>
        <form class="ap-clave-form" onSubmit={async (e) => {
          e.preventDefault();
          if (!clave.trim()) return;
          await chrome.storage.local.set({ [CLAVE_API]: clave.trim() });
          fijarClave('');
          fijarGuardada(true);
          fijarPrueba({ texto: 'Clave guardada.' });
        }}>
          <input class="campo" type="password" autocomplete="off" aria-label="Clave de la API de Claude" placeholder={guardada ? 'Escribe otra para cambiarla' : 'sk-ant-...'} value={clave} onInput={(e) => fijarClave(e.currentTarget.value)} />
          <button class="btn primario" type="submit" disabled={!clave.trim()}>Guardar</button>
        </form>
        <div class="ap-botones">
          <button class="btn chico ia" disabled={!guardada || probando} onClick={async () => {
            fijarProbando(true);
            fijarPrueba(null);
            try {
              fijarPrueba({ texto: `Conectado: ${await motor.probarIA()}` });
            } catch (e) {
              fijarPrueba({ texto: e instanceof Error ? e.message : String(e), error: true });
            } finally {
              fijarProbando(false);
            }
          }}><Icono n={probando ? 'espera' : 'conectado'} t={14} /> {probando ? 'Probando…' : 'Probar la conexión'}</button>
          {guardada && <button class="btn fantasma chico" onClick={async () => {
            await chrome.storage.local.remove(CLAVE_API);
            fijarGuardada(false);
            fijarPrueba({ texto: 'Clave eliminada.' });
          }}>Eliminar la clave</button>}
        </div>
        {prueba && <Mensaje error={prueba.error}>{prueba.texto}</Mensaje>}
      </div>

      <Subtitulo>Comportamiento</Subtitulo>
      <div class="ap-grupo">
        <Opcion titulo="Revisar lecturas, sentidos y gramática" ayuda="Claude repasa los subtítulos unos minutos por delante de donde vas, y sigue a medida que avanza. Se paga una sola vez por línea.">
          <Interruptor etiqueta="Revisar automáticamente" on={a.analisisAutomatico} alCambiar={(v) => cambiar({ analisisAutomatico: v })} />
        </Opcion>
        <Opcion titulo="Preguntar el significado al abrir una palabra" ayuda="Apagado, la ficha abre con el diccionario y solo se pregunta a Claude al pulsar el botón. Encendido, cada palabra nueva que abras es una petición.">
          <Interruptor etiqueta="Significado en la frase" on={a.sentidoAutomatico} alCambiar={(v) => cambiar({ sentidoAutomatico: v })} />
        </Opcion>
        <Opcion titulo="Guion completo como contexto" ayuda="Siempre recibe unas 40 líneas alrededor de la frase. Con esto, además lee todo el video: ayuda con nombres y referencias, y cuesta más, sobre todo en películas.">
          <Interruptor etiqueta="Guion como contexto" on={a.usarGuion} alCambiar={(v) => cambiar({ usarGuion: v })} />
        </Opcion>
        <Opcion titulo="Crédito mensual, en dólares" ayuda="Para ver en Inicio cuánto llevas gastado de tu crédito de la API. No limita nada.">
          <input class="campo ap-campo-corto" type="number" min="0" step="10" aria-label="Crédito mensual en dólares" value={a.creditoMensual} onInput={(ev) => cambiar({ creditoMensual: Math.max(0, Number(ev.currentTarget.value) || 0) })} />
        </Opcion>
        <Opcion titulo="Reintentar en otro modelo" ayuda="Si hay un rechazo de seguridad, prueba con el modelo de respaldo.">
          <Interruptor etiqueta="Respaldo de seguridad" on={a.respaldoSeguridad} alCambiar={(v) => cambiar({ respaldoSeguridad: v })} />
        </Opcion>
      </div>

      <Subtitulo>Modelo y esfuerzo por tarea</Subtitulo>
      <div class="ap-grupo">
        {NOMBRES_TAREA.map(([t, n]) => (
          <div class="ap-opcion ap-modelo" key={t}>
            <div class="ap-opcion-texto"><b>{n}</b></div>
            <div class="ap-opcion-control">
              <select class="selector" aria-label={`Modelo para ${n}`} value={a.modelos[t]} onChange={(e) => cambiar({ modelos: { ...a.modelos, [t]: e.currentTarget.value } })}>
                {MODELOS.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
              <select class="selector" aria-label={`Esfuerzo para ${n}`} value={a.esfuerzos[t]} onChange={(e) => cambiar({ esfuerzos: { ...a.esfuerzos, [t]: e.currentTarget.value as Esfuerzo } })}>
                <option value="low">Bajo</option>
                <option value="medium">Medio</option>
                <option value="high">Alto</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </Seccion>
  );
}

function CampoNombre({ a, cambiar }: PropsSeccion) {
  return (
    <Opcion titulo="Tu nombre" ayuda="Para el saludo de la pantalla de inicio. Es opcional.">
      <input class="campo ap-campo-corto" aria-label="Tu nombre" value={a.nombre} onInput={(ev) => cambiar({ nombre: ev.currentTarget.value })} />
    </Opcion>
  );
}

function SeccionIdioma({ a, cambiar }: PropsSeccion) {
  return (
    <Seccion id="idioma" icono="nivel" titulo="Tu nivel e idioma" descripcion="Las explicaciones se adaptan a tu nivel.">
      <div class="ap-grupo">
        <CampoNombre a={a} cambiar={cambiar} />
        <Opcion titulo="Nivel">
          <select class="selector" aria-label="Nivel" value={a.nivel} onChange={(e) => cambiar({ nivel: e.currentTarget.value })}>
            {['JLPT N5', 'JLPT N4', 'JLPT N3', 'JLPT N2', 'JLPT N1', 'nativo'].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Opcion>
        <Opcion titulo="Idioma de las explicaciones">
          <select class="selector" aria-label="Idioma de las explicaciones" value={a.idiomaExplicaciones} onChange={(e) => cambiar({ idiomaExplicaciones: e.currentTarget.value })}>
            {['español', 'inglés', 'japonés sencillo'].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Opcion>
        <Opcion titulo="Idioma de las traducciones">
          <select class="selector" aria-label="Idioma de las traducciones" value={a.idiomaTraduccion} onChange={(e) => cambiar({ idiomaTraduccion: e.currentTarget.value })}>
            {['español', 'inglés', 'portugués', 'francés', 'alemán'].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Opcion>
      </div>
    </Seccion>
  );
}

const CACHE_MODELOS = 'transformers-cache';

/** Qué modelos están ya guardados: los descarga Transformers.js en la caché del navegador. */
async function modelosDescargados(): Promise<Set<ModeloWhisper>> {
  const salida = new Set<ModeloWhisper>();
  const cache = await caches.open(CACHE_MODELOS);
  const urls = (await cache.keys()).map((k) => k.url);
  for (const [id, m] of Object.entries(MODELOS_WHISPER) as [ModeloWhisper, (typeof MODELOS_WHISPER)[ModeloWhisper]][]) {
    if (urls.some((u) => u.includes(m.id) && u.includes(`encoder_model_${m.dtype.encoder_model}.onnx`))) salida.add(id);
  }
  return salida;
}

const INTENSIDADES: { id: Ajustes['whisperIntensidad']; nombre: string; ayuda: string }[] = [
  { id: 'auto', nombre: 'Automática', ayuda: 'Equilibra velocidad y fluidez, y acelera cuando te alejas. Un video de 30 minutos tarda unos 5.' },
  { id: 'suave', nombre: 'Suave', ayuda: 'La mínima carga, por si estás jugando o editando video. Un video de 30 minutos tarda unos 12.' },
  { id: 'rapida', nombre: 'Rápida', ayuda: 'Siempre a la máxima velocidad segura. Un video de 30 minutos tarda unos 4.' },
];

const ORDEN_INSTALAR = 'powershell -ExecutionPolicy Bypass -File herramientas\\ayudante\\instalar.ps1';

/** Sin el ayudante, un video de internet solo se puede transcribir mientras se reproduce. */
function AyudanteLocal() {
  const [info, fijarInfo] = useState<InfoAyudante | null | undefined>(undefined);
  const comprobar = () => {
    fijarInfo(undefined);
    motor.ayudante().then(fijarInfo).catch(() => fijarInfo(null));
  };
  useEffect(comprobar, []);
  if (info === undefined) return <Opcion titulo="Ayudante para YouTube" ayuda="Comprobando si está instalado…"><span class="ayuda">…</span></Opcion>;
  if (info) {
    return (
      <Opcion titulo="Ayudante para YouTube" ayuda={`Instalado, con yt-dlp ${info.ytdlp ?? '(falta)'}. Los videos de internet se transcriben enteros, sin reproducirlos.`}>
        {info.ytdlp && info.ffmpeg ? <span class="ap-whisper-tam"><Icono n="check" t={14} /> Listo</span> : <span class="ayuda">{info.ffmpeg ? 'Falta yt-dlp' : 'Falta ffmpeg'}</span>}
      </Opcion>
    );
  }
  return (
    <Opcion titulo="Ayudante para YouTube" ayuda={<>Permite transcribir un video entero sin reproducirlo. Para instalarlo, ejecuta esto una vez en la carpeta del proyecto: <code>{ORDEN_INSTALAR}</code></>}>
      <span class="ap-acciones-fila">
        <button class="btn chico fantasma" onClick={() => navigator.clipboard.writeText(ORDEN_INSTALAR)}><Icono n="portapapeles" t={14} /> Copiar</button>
        <button class="btn chico fantasma" onClick={comprobar}>Comprobar</button>
      </span>
    </Opcion>
  );
}

function SeccionTranscripcion({ a, cambiar }: PropsSeccion) {
  const [descargados, fijarDescargados] = useState<Set<ModeloWhisper>>(new Set());
  useEffect(() => {
    modelosDescargados().then(fijarDescargados).catch(() => {});
  }, []);
  const modelos = Object.entries(MODELOS_WHISPER) as [ModeloWhisper, (typeof MODELOS_WHISPER)[ModeloWhisper]][];
  return (
    <Seccion id="transcripcion" icono="ondas" titulo="Transcripción con Whisper" descripcion="Genera subtítulos en japonés cuando un video no los trae. Corre en tu tarjeta gráfica: el audio no sale de tu equipo.">
      <div class="ap-whisper-modelos" role="radiogroup" aria-label="Modelo de transcripción">
        {modelos.map(([id, m]) => (
          <button key={id} class={`ap-whisper-modelo ${a.whisperModelo === id ? 'activo' : ''}`} role="radio" aria-checked={a.whisperModelo === id} onClick={() => cambiar({ whisperModelo: id })}>
            <b>{m.nombre}</b>
            <span class="ayuda">{m.descripcion}</span>
            <span class="ap-whisper-tam num">
              {descargados.has(id) ? <><Icono n="check" t={14} /> Descargado</> : <><Icono n="descargar" t={14} /> {m.mb >= 1000 ? `${(m.mb / 1000).toLocaleString('es', { maximumFractionDigits: 1 })} GB` : `${m.mb} MB`}</>}
            </span>
          </button>
        ))}
      </div>
      <div class="ap-grupo">
        <Opcion titulo="Intensidad al transcribir archivos" ayuda={INTENSIDADES.find((i) => i.id === a.whisperIntensidad)?.ayuda}>
          <div class="segmentado" role="radiogroup" aria-label="Intensidad de la transcripción">
            {INTENSIDADES.map((i) => (
              <button key={i.id} class={a.whisperIntensidad === i.id ? 'activo' : ''} role="radio" aria-checked={a.whisperIntensidad === i.id} onClick={() => cambiar({ whisperIntensidad: i.id })}>{i.nombre}</button>
            ))}
          </div>
        </Opcion>
        <Opcion titulo="Corregir con Claude" ayuda="Arregla kanji, homófonos y puntuación a medida que llega el texto.">
          <Interruptor etiqueta="Corregir con Claude" on={a.whisperCorregir} alCambiar={(v) => cambiar({ whisperCorregir: v })} />
        </Opcion>
        <AyudanteLocal />
        {descargados.size > 0 && (
          <Opcion titulo="Modelos descargados" ayuda="Si los borras, se volverán a descargar la próxima vez que transcribas.">
            <button class="btn chico fantasma" onClick={async () => {
              await caches.delete(CACHE_MODELOS);
              fijarDescargados(new Set());
            }}><Icono n="basura" t={14} /> Borrar</button>
          </Opcion>
        )}
      </div>
    </Seccion>
  );
}

const VARIABLES_PROMPT = ['PALABRA', 'SUPERFICIE', 'LECTURA', 'FRASE', 'ENTORNO', 'TRADUCCION', 'TITULO', 'NIVEL', 'IDIOMA', 'PREGUNTA'];

function SeccionPrompts({ a, cambiar }: PropsSeccion) {
  const [tarea, fijarTarea] = useState<keyof typeof PROMPTS_BASE>('explicar');
  const actual = a.prompts[tarea] ?? PROMPTS_BASE[tarea];
  const [sistema, fijarSistema] = useState(actual.sistema);
  const [usuario, fijarUsuario] = useState(actual.usuario);
  useEffect(() => {
    const p = a.prompts[tarea] ?? PROMPTS_BASE[tarea];
    fijarSistema(p.sistema);
    fijarUsuario(p.usuario);
  }, [tarea]);
  const personalizado = !!a.prompts[tarea];
  return (
    <Seccion id="prompts" icono="nota-lapiz" ia titulo="Prompts personalizados" descripcion="Cambia lo que se le pide a Claude en cada tarea. Si algo sale mal, puedes volver al original.">
      <div class="ap-grupo ap-prompts">
        <div class="ap-prompts-cab">
          <select class="selector" aria-label="Tarea" value={tarea} onChange={(e) => fijarTarea(e.currentTarget.value as typeof tarea)}>
            {TAREAS_PERSONALIZABLES.map((t) => <option key={t.id} value={t.id}>{t.nombre}{a.prompts[t.id] ? ' (personalizado)' : ''}</option>)}
          </select>
          <div class="ap-variables" aria-label="Variables disponibles">
            {VARIABLES_PROMPT.map((v) => <code key={v}>[{v}]</code>)}
          </div>
        </div>
        <label class="ap-prompt-campo">
          <span>Prompt de sistema</span>
          <textarea class="campo ap-codigo" rows={9} value={sistema} onInput={(e) => fijarSistema(e.currentTarget.value)} />
        </label>
        <label class="ap-prompt-campo">
          <span>Prompt de usuario</span>
          <textarea class="campo ap-codigo" rows={4} value={usuario} onInput={(e) => fijarUsuario(e.currentTarget.value)} />
        </label>
        <div class="ap-botones">
          <button class="btn primario" onClick={() => cambiar({ prompts: { ...a.prompts, [tarea]: { sistema, usuario } } })}>Guardar</button>
          <button class="btn" disabled={!personalizado} onClick={() => {
            const { [tarea]: _quitado, ...resto } = a.prompts;
            cambiar({ prompts: resto });
            fijarSistema(PROMPTS_BASE[tarea].sistema);
            fijarUsuario(PROMPTS_BASE[tarea].usuario);
          }}>Restablecer</button>
        </div>
      </div>
    </Seccion>
  );
}

function SeccionDiccionarios({ a, cambiar }: PropsSeccion) {
  const [instalados, fijarInstalados] = useState<InfoDiccionario[]>([]);
  const [fuentes, fijarFuentes] = useState<FuenteBiblioteca[]>([]);
  const [progreso, fijarProgreso] = useState<Record<string, ProgresoInstalacion>>({});
  const entrada = useRef<HTMLInputElement>(null);

  const cargar = () => motor.estado().then((e) => fijarInstalados(e.diccionarios)).catch(console.error);
  useEffect(() => {
    cargar();
    motor.fuentesDiccionario().then(fijarFuentes).catch(console.error);
    return alRecibirEvento((e) => {
      if (e.tipo === 'instalacion') fijarProgreso((p) => ({ ...p, [e.progreso.id]: e.progreso }));
      if (e.tipo === 'diccionarios') cargar();
    });
  }, []);

  const mover = async (lista: InfoDiccionario[], i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= lista.length) return;
    const nueva = [...lista];
    [nueva[i], nueva[j]] = [nueva[j], nueva[i]];
    const otros = instalados.filter((x) => !nueva.includes(x));
    await motor.ordenarDiccionarios([...nueva, ...otros].map((x) => x.id));
  };

  const filaInstalado = (d: InfoDiccionario, i: number, lista: InfoDiccionario[]) => (
    <div class="ap-opcion" key={d.id}>
      <div class="ap-opcion-texto">
        <b>{d.titulo}</b>
        <span class="num">{d.filas.toLocaleString('es')} filas</span>
      </div>
      <div class="ap-opcion-control ap-apretado">
        {lista.length > 1 && (
          <>
            <button class="btn-icono chico" disabled={i === 0} aria-label={`Subir ${d.titulo}`} onClick={() => mover(lista, i, -1)}><Icono n="arriba" t={15} /></button>
            <button class="btn-icono chico" disabled={i === lista.length - 1} aria-label={`Bajar ${d.titulo}`} onClick={() => mover(lista, i, 1)}><Icono n="abajo" t={15} /></button>
          </>
        )}
        <button class="btn-icono chico" aria-label={`Eliminar ${d.titulo}`} data-tip="Eliminar" data-tip-lado="izq" onClick={() => motor.eliminarDiccionario(d.id)}><Icono n="basura" t={15} /></button>
      </div>
    </div>
  );

  const terminos = instalados.filter((d) => d.tipo === 'terminos');
  const frecuencias = instalados.filter((d) => d.tipo === 'frecuencia');
  const otros = instalados.filter((d) => d.tipo === 'acento');
  const faltan = fuentes.filter((f) => !instalados.some((d) => d.id === f.id));
  const instalandoArchivo = Object.values(progreso).filter((p) => p.id.startsWith('archivo-') && p.fase !== 'listo');

  return (
    <Seccion id="diccionarios" icono="diccionario" titulo="Diccionarios" descripcion="El orden importa: el primero manda en las traducciones cortas y en lo que se muestra primero.">
      <div class="ap-grupo">
        {terminos.map(filaInstalado)}
        {terminos.length === 0 && <div class="ap-opcion"><span class="ayuda">Aún no hay diccionarios instalados.</span></div>}
      </div>

      {(frecuencias.length > 0 || otros.length > 0) && (
        <>
          <Subtitulo>Frecuencia y acento</Subtitulo>
          <div class="ap-grupo">
            {frecuencias.map(filaInstalado)}
            {otros.map((d) => filaInstalado(d, 0, [d]))}
          </div>
        </>
      )}

      {faltan.length > 0 && <Subtitulo>Disponibles para instalar</Subtitulo>}
      {faltan.length > 0 && (
        <div class="ap-grupo">
          {faltan.map((f) => {
            const p = progreso[f.id];
            const activo = p && p.fase !== 'listo' && p.fase !== 'error';
            return (
              <div class="ap-opcion" key={f.id}>
                <div class="ap-opcion-texto">
                  <b>{f.titulo}</b>
                  <span>{f.descripcion} {f.licencia}.</span>
                  {p?.fase === 'error' && <span class="ap-texto-error">{p.error}</span>}
                  {activo && (
                    <div class="ap-instalando">
                      <div class="barra-progreso"><div style={{ width: `${p.avance * 100}%` }} /></div>
                      <span class="num">{p.fase === 'descargando' ? 'Descargando' : 'Guardando'} {Math.round(p.avance * 100)} %</span>
                    </div>
                  )}
                </div>
                <div class="ap-opcion-control">
                  <button class={`btn chico ${f.recomendado ? 'primario' : ''}`} disabled={activo} onClick={() => motor.instalarDiccionario(f.id).catch(() => {})}>Instalar</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div class="ap-botones ap-tras-grupo">
        <button class="btn chico" onClick={() => entrada.current?.click()}><Icono n="subir" t={14} /> Instalar desde un archivo Yomitan</button>
        <input ref={entrada} type="file" accept=".zip" hidden aria-label="Instalar diccionario desde archivo" onChange={async (e) => {
          const f = e.currentTarget.files?.[0];
          if (f) await motor.instalarArchivo(URL.createObjectURL(f), f.name).catch(() => {});
          e.currentTarget.value = '';
        }} />
      </div>
      {instalandoArchivo.map((p) => (
        <p key={p.id} class="ayuda num">{p.titulo}: {p.fase === 'error' ? p.error : `${Math.round(p.avance * 100)} %`}</p>
      ))}

      <Subtitulo>Ficha de la palabra</Subtitulo>
      <div class="ap-grupo">
        <Opcion titulo="Pestaña inicial" ayuda="Lo primero que ves al consultar una palabra. Una pestaña de Claude haría una petición por cada palabra nueva que abras.">
          <select class="selector" aria-label="Pestaña inicial" value={a.diccionarioPestana} onChange={(e) => cambiar({ diccionarioPestana: e.currentTarget.value as PestanaDiccionario })}>
            {PESTANAS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
          </select>
        </Opcion>
        <Opcion titulo="Etiqueta de frecuencia">
          <div class="segmentado" role="radiogroup" aria-label="Etiqueta de frecuencia">
            <button role="radio" aria-checked={a.estiloFrecuencia === 'numero'} class={a.estiloFrecuencia === 'numero' ? 'activo' : ''} onClick={() => cambiar({ estiloFrecuencia: 'numero' })}>Posición</button>
            <button role="radio" aria-checked={a.estiloFrecuencia === 'estrellas'} class={a.estiloFrecuencia === 'estrellas' ? 'activo' : ''} onClick={() => cambiar({ estiloFrecuencia: 'estrellas' })}>Estrellas</button>
          </div>
        </Opcion>
        {a.ordenContenido.map((c, i) => (
          <Opcion key={c} titulo={<><span class="ap-orden num">{i + 1}</span> {NOMBRES_CONTENIDO[c]}</>} ayuda={i === 0 ? 'Orden del contenido dentro de la ficha.' : undefined}>
            <span class="ap-apretado">
              <button class="btn-icono chico" disabled={i === 0} aria-label={`Subir ${NOMBRES_CONTENIDO[c]}`} onClick={() => {
                const n = [...a.ordenContenido];
                [n[i - 1], n[i]] = [n[i], n[i - 1]];
                cambiar({ ordenContenido: n });
              }}><Icono n="arriba" t={15} /></button>
              <button class="btn-icono chico" disabled={i === a.ordenContenido.length - 1} aria-label={`Bajar ${NOMBRES_CONTENIDO[c]}`} onClick={() => {
                const n = [...a.ordenContenido];
                [n[i + 1], n[i]] = [n[i], n[i + 1]];
                cambiar({ ordenContenido: n });
              }}><Icono n="abajo" t={15} /></button>
            </span>
          </Opcion>
        ))}
      </div>
    </Seccion>
  );
}

function SeccionAnki({ a, cambiar }: PropsSeccion) {
  const e = estadoAnki.value;
  const [campos, fijarCampos] = useState<string[]>([]);
  const [mensaje, fijarMensaje] = useState<{ texto: string; error?: boolean } | null>(null);
  const [consulta, fijarConsulta] = useState('deck:*');
  const [campoImport, fijarCampoImport] = useState('');

  useEffect(() => {
    refrescarAnki();
  }, []);
  useEffect(() => {
    if (e?.conectado && a.ankiModelo && a.ankiModelo !== 'Kotonoha') motor.ankiCamposModelo(a.ankiModelo).then(fijarCampos).catch(() => fijarCampos([]));
    else fijarCampos([]);
  }, [e?.conectado, a.ankiModelo]);

  return (
    <Seccion id="anki" icono="tarjetas" titulo="Tarjetas y Anki" descripcion="Dónde van tus tarjetas y qué llevan al crearlas.">
      <div class="ap-grupo">
        <Opcion titulo="Enviar tarjetas a">
          <div class="segmentado" role="radiogroup" aria-label="Destino de las tarjetas">
            <button role="radio" aria-checked={a.destino === 'anki'} class={a.destino === 'anki' ? 'activo' : ''} onClick={() => cambiar({ destino: 'anki' })}>Anki</button>
            <button role="radio" aria-checked={a.destino === 'memoria'} class={a.destino === 'memoria' ? 'activo' : ''} onClick={() => cambiar({ destino: 'memoria' })}>Memoria</button>
          </div>
        </Opcion>
        <Opcion
          titulo={<span class="ap-estado-anki"><span class={`ap-punto ${e?.conectado ? 'ok' : ''}`} /> {e?.conectado ? `Conectado con AnkiConnect, versión ${e.version}` : 'Anki sin conectar'}</span>}
          ayuda={e?.conectado ? undefined : 'Abre Anki con AnkiConnect instalado y pulsa Conectar. Anki te pedirá confirmación la primera vez.'}
        >
          <button class="btn chico" onClick={async () => {
            try {
              estadoAnki.value = await motor.ankiPermiso();
              fijarMensaje({ texto: 'Conectado.' });
            } catch (err) {
              fijarMensaje({ texto: err instanceof Error ? err.message : String(err), error: true });
            }
          }}><Icono n="conectado" t={14} /> Conectar con Anki</button>
        </Opcion>
        {e?.conectado && (
          <>
            <Opcion titulo="Mazo">
              <input class="campo ap-campo-corto" list="kk-mazos" aria-label="Mazo de Anki" value={a.ankiMazo} onInput={(ev) => cambiar({ ankiMazo: ev.currentTarget.value })} />
              <datalist id="kk-mazos">{e.mazos.map((m) => <option key={m} value={m} />)}</datalist>
            </Opcion>
            <Opcion titulo="Tipo de nota">
              <select class="selector" aria-label="Tipo de nota" value={a.ankiModelo} onChange={(ev) => cambiar({ ankiModelo: ev.currentTarget.value })}>
                <option value="Kotonoha">Kotonoha (se crea sola)</option>
                {e.modelos.filter((m) => m !== 'Kotonoha').map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Opcion>
            <Opcion titulo="Etiquetas">
              <input class="campo ap-campo-corto" aria-label="Etiquetas" value={a.ankiEtiquetas} onInput={(ev) => cambiar({ ankiEtiquetas: ev.currentTarget.value })} />
            </Opcion>
          </>
        )}
        <Opcion titulo="Poner en negrita la palabra en la frase">
          <Interruptor etiqueta="Negrita" on={a.negritaPalabra} alCambiar={(v) => cambiar({ negritaPalabra: v })} />
        </Opcion>
      </div>
      {mensaje && <Mensaje error={mensaje.error}>{mensaje.texto}</Mensaje>}

      {e?.conectado && campos.length > 0 && (
        <>
          <Subtitulo>Campos de {a.ankiModelo}</Subtitulo>
          <div class="ap-grupo">
            {CAMPOS_TARJETA.map(([dato, nombre]) => (
              <Opcion key={dato} titulo={nombre}>
                <select class="selector" aria-label={`Campo para ${nombre}`} value={a.ankiCampos[dato] ?? ''} onChange={(ev) => cambiar({ ankiCampos: { ...a.ankiCampos, [dato]: ev.currentTarget.value } })}>
                  <option value="">No usar</option>
                  {campos.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Opcion>
            ))}
          </div>
        </>
      )}

      {e?.conectado && (
        <>
          <Subtitulo>Importar palabras desde Anki</Subtitulo>
          <div class="ap-grupo ap-importar-anki">
            <p class="ayuda">Las tarjetas con intervalo de 21 días o más se marcan como conocidas; el resto, aprendiendo.</p>
            <div class="ap-importar-fila">
              <input class="campo" aria-label="Búsqueda de Anki" placeholder="deck:Mi mazo" value={consulta} onInput={(ev) => fijarConsulta(ev.currentTarget.value)} />
              <input class="campo ap-campo-corto" aria-label="Campo con la palabra" placeholder="Campo" value={campoImport} onInput={(ev) => fijarCampoImport(ev.currentTarget.value)} />
              <button class="btn" disabled={!campoImport} onClick={async () => {
                fijarMensaje({ texto: 'Importando…' });
                try {
                  fijarMensaje({ texto: `${await motor.importarConocidasAnki(consulta, campoImport)} palabras importadas.` });
                } catch (err) {
                  fijarMensaje({ texto: err instanceof Error ? err.message : String(err), error: true });
                }
              }}>Importar</button>
            </div>
          </div>
        </>
      )}

      <Subtitulo>Relleno automático</Subtitulo>
      <p class="ayuda ap-subtitulo-ayuda">Lo que se añade solo al crear una tarjeta.</p>
      <div class="ap-grupo ap-prellenado">
        {PRELLENADO.map((g) => (
          <fieldset key={g.grupo}>
            <legend><b>{g.grupo}</b> {g.ayuda && <span class="ayuda">{g.ayuda}</span>}</legend>
            {g.items.map(([k, n]) => (
              <label key={k} class="ap-marca">
                <input class="ap-casilla" type="checkbox" checked={a.prellenado[k]} onChange={(ev) => cambiar({ prellenado: { ...a.prellenado, [k]: ev.currentTarget.checked } })} />
                {n}
              </label>
            ))}
          </fieldset>
        ))}
      </div>
    </Seccion>
  );
}

function SeccionVoces({ a, cambiar }: PropsSeccion) {
  const VOCES = [
    ['ja-JP-MasaruMultilingualNeural', 'Masaru'],
    ['ja-JP-KeitaNeural', 'Keita'],
    ['ja-JP-DaichiNeural', 'Daichi'],
    ['ja-JP-NanamiNeural', 'Nanami'],
    ['ja-JP-AoiNeural', 'Aoi'],
    ['ja-JP-MayuNeural', 'Mayu'],
    ['ja-JP-ShioriNeural', 'Shiori'],
  ];
  return (
    <Seccion id="voces" icono="voz" titulo="Voces" descripcion="Para frases sin audio del video. Azure Speech ofrece medio millón de caracteres gratis al mes con tu propia cuenta. Sin clave se usa la voz del sistema, que no se puede guardar en tarjetas.">
      <div class="ap-grupo">
        <Opcion titulo="Clave de Azure Speech">
          <input class="campo ap-campo-medio" type="password" autocomplete="off" aria-label="Clave de Azure Speech" placeholder="Clave" value={a.azureClave} onInput={(e) => cambiar({ azureClave: e.currentTarget.value.trim() })} />
        </Opcion>
        <Opcion titulo="Región">
          <input class="campo ap-campo-corto" aria-label="Región de Azure" placeholder="eastus" value={a.azureRegion} onInput={(e) => cambiar({ azureRegion: e.currentTarget.value.trim() })} />
        </Opcion>
        <Opcion titulo="Voces de las frases" ayuda="Hasta tres.">
          <div class="ap-voces">
            {VOCES.map(([id, n]) => {
              const elegida = a.vocesFrase.includes(id);
              return (
                <button key={id} class={`chip ap-voz ${elegida ? 'activa' : ''}`} role="checkbox" aria-checked={elegida} onClick={() => cambiar({ vocesFrase: elegida ? a.vocesFrase.filter((v) => v !== id) : [...a.vocesFrase, id].slice(-3) })}>
                  {elegida && <Icono n="ok" t={13} />}{n}
                </button>
              );
            })}
          </div>
        </Opcion>
      </div>
    </Seccion>
  );
}

function SeccionDatos({ a, cambiar }: PropsSeccion) {
  const entrada = useRef<HTMLInputElement>(null);
  const [mensaje, fijarMensaje] = useState<{ texto: string; error?: boolean } | null>(null);
  return (
    <Seccion id="datos" icono="carpeta" titulo="Tus datos" descripcion="Todo se guarda en este navegador. Haz copias de vez en cuando para no perder tus palabras.">
      <div class="ap-grupo">
        <Opcion titulo="Copia de seguridad" ayuda="Palabras, tarjetas, biblioteca y ajustes en un archivo.">
          <span class="ap-botones">
            <button class="btn chico" onClick={async () => {
              const json = await motor.exportarDatos();
              const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
              const v = document.createElement('a');
              v.href = url;
              v.download = `kotonoha-copia-${new Date().toISOString().slice(0, 10)}.json`;
              v.click();
              URL.revokeObjectURL(url);
            }}><Icono n="descargar" t={14} /> Exportar</button>
            <button class="btn chico" onClick={() => entrada.current?.click()}><Icono n="subir" t={14} /> Restaurar</button>
          </span>
          <input ref={entrada} type="file" accept=".json" hidden aria-label="Restaurar copia" onChange={async (e) => {
            const f = e.currentTarget.files?.[0];
            if (!f) return;
            try {
              await motor.importarDatos(await f.text());
              fijarMensaje({ texto: 'Copia restaurada.' });
            } catch (err) {
              fijarMensaje({ texto: err instanceof Error ? err.message : String(err), error: true });
            }
          }} />
        </Opcion>
        <Opcion titulo="Guardar las frases que ves" ayuda="Sirven para buscar ejemplos de lo que ya conoces.">
          <Interruptor etiqueta="Guardar historial" on={a.guardarHistorial} alCambiar={(v) => cambiar({ guardarHistorial: v })} />
        </Opcion>
      </div>
      {mensaje && <Mensaje error={mensaje.error}>{mensaje.texto}</Mensaje>}
    </Seccion>
  );
}

const SECCIONES: { id: string; nombre: string; icono: NombreIcono }[] = [
  { id: 'apariencia', nombre: 'Apariencia', icono: 'paleta' },
  { id: 'claude', nombre: 'Claude', icono: 'ia' },
  { id: 'idioma', nombre: 'Nivel e idioma', icono: 'nivel' },
  { id: 'diccionarios', nombre: 'Diccionarios', icono: 'diccionario' },
  { id: 'transcripcion', nombre: 'Transcripción', icono: 'ondas' },
  { id: 'anki', nombre: 'Tarjetas y Anki', icono: 'tarjetas' },
  { id: 'voces', nombre: 'Voces', icono: 'voz' },
  { id: 'prompts', nombre: 'Prompts', icono: 'nota-lapiz' },
  { id: 'datos', nombre: 'Tus datos', icono: 'carpeta' },
];

export function PantallaAjustes({ a }: { a: Ajustes }) {
  const [visible, fijarVisible] = useState(SECCIONES[0].id);
  const raiz = useRef<HTMLDivElement>(null);
  const cambiar = (c: Partial<Ajustes>) => {
    guardarAjustes(c).catch(console.error);
  };

  // Marca en la subnavegación la sección que se está leyendo.
  useEffect(() => {
    const secciones = [...(raiz.current?.querySelectorAll('.ap-ajuste-seccion') ?? [])];
    const contenedor = raiz.current?.closest('.ap-principal') ?? null;
    const observador = new IntersectionObserver(
      (entradas) => {
        const vista = entradas.filter((e) => e.isIntersecting).sort((x, y) => x.boundingClientRect.top - y.boundingClientRect.top)[0];
        if (vista) fijarVisible(vista.target.id);
      },
      { root: contenedor, rootMargin: '-10% 0px -70% 0px' }
    );
    secciones.forEach((s) => observador.observe(s));
    return () => observador.disconnect();
  }, []);

  return (
    <div class="ap-lienzo ap-ajustes" ref={raiz}>
      <Cabecera titulo="Ajustes" />
      <div class="ap-ajustes-cuerpo">
        <nav class="ap-subnav" aria-label="Secciones de ajustes">
          {SECCIONES.map((s) => (
            <button
              key={s.id}
              class={visible === s.id ? 'activa' : ''}
              aria-current={visible === s.id ? 'true' : undefined}
              onClick={() => {
                fijarVisible(s.id);
                raiz.current?.querySelector(`#${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              <Icono n={s.icono} t={17} /> {s.nombre}
            </button>
          ))}
        </nav>
        <div class="ap-ajustes-secciones">
          <SeccionApariencia a={a} cambiar={cambiar} />
          <SeccionClaude a={a} cambiar={cambiar} />
          <SeccionIdioma a={a} cambiar={cambiar} />
          <SeccionDiccionarios a={a} cambiar={cambiar} />
          <SeccionTranscripcion a={a} cambiar={cambiar} />
          <SeccionAnki a={a} cambiar={cambiar} />
          <SeccionVoces a={a} cambiar={cambiar} />
          <SeccionPrompts a={a} cambiar={cambiar} />
          <SeccionDatos a={a} cambiar={cambiar} />
        </div>
      </div>
    </div>
  );
}
