// Pantalla de ajustes de la ventana de la app.

import type { InfoAyudante, MotorVozLocal } from '../compartido/api';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { AJUSTES_INICIALES, type Ajustes, type AjustesVozLocal, type AjustesVozNeuronal, CLAVE_API, type Esfuerzo, guardarAjustes, MODELO_AUTOMATICO, MODELOS, MODELOS_WHISPER, modeloSirveParaLengua, type ModeloWhisper, type PestanaDiccionario, type Prellenado, type TareaIA, type Tema } from '../compartido/ajustes';
import { borrarArchivosSueltos, borrarModeloGuardado, borrarModeloMoras, bytesModeloMoras, leerModelosGuardados, type ResumenModelos } from '../compartido/modelosGuardados';
import { alRecibirEvento, fondo, motor } from '../compartido/rpc';
import { ACCIONES_TECLADO, nombreAccion } from '../compartido/accionesTeclado';
import { mostrarCombinacion, teclaLatina, textoCombinacion } from '../nucleo/teclas';
import type { FuenteBiblioteca, InfoDiccionario, ProgresoInstalacion } from '../compartido/tipos';
import { motorDe } from '../lenguas/motor';
import type { TareaPrompt, TextosLengua } from '../lenguas/tipos';
import { TAREAS_PERSONALIZABLES } from '../motor/prompts';
import { Icono, type NombreIcono } from '../ui/iconos';
import { estadoAnki, refrescarAnki } from './estadoApp';
import { Cabecera, Interruptor, Mensaje } from './Piezas';
import { IDIOMAS_INTERFAZ, bcp47Actual, lenguaDe, lenguasExplicacion, lenguasTraduccion, numero, resolverIdioma, tm, tr } from '../compartido/i18n';
import { PAQUETES } from '../lenguas';
import { estudiarLengua, lengua } from '../ui/lengua';
import { buscarVersionNueva, type VersionPublicada } from '../compartido/actualizaciones';
import { ordenInstalarAyudante, URL_ULTIMA_VERSION, versionInstalada } from '../compartido/proyecto';
import { BotonActualizar, useActualizacion } from './ActualizarAhora';
import { exportarCopiaCompleta, hayCopiaCompleta, restaurarCopiaCompleta, type ResumenCopia } from './copiaCompleta';
import { nombreCorto } from '../nucleo/voces';
import { CLAVES_PROVEEDORES, idParaProveedor, type ProveedorConocido, type ProveedorIA, PROVEEDORES_CONOCIDOS, separarModelo, valorDeModelo } from '../compartido/proveedores';
import { decirConNavegador, vocesDeLaLengua } from '../ui/vozNavegador';

const NOMBRES_TAREA: [TareaIA, string][] = [
  ['explicar', tm('Explicación de palabras')],
  ['sentido', tm('Significado en la frase')],
  ['analisis', tm('Revisión de lecturas, sentidos y gramática')],
  ['corregir', tm('Corrección de subtítulos automáticos')],
  ['letra', tm('Ajuste de letras')],
  ['ocr', tm('Revisión del texto de las páginas')],
  ['desglosar', tm('Desglose de frases')],
  ['traducir', tm('Traducción de frases')],
  ['subtitulos', tm('Traducción de subtítulos completos')],
  ['preguntar', tm('Preguntas libres')],
  ['generar', tm('Frases de ejemplo')],
  ['historia', tm('Relatos')],
  ['profundo', tm('Botón «Profundizar»')],
];

const camposTarjeta = (textos: TextosLengua): [string, string][] => [
  ['palabra', tm('Palabra')],
  ['lectura', tm('Lectura')],
  ['frase', tm('Frase')],
  ['furigana', textos.fraseConLectura],
  ['traduccion', tm('Traducción')],
  ['definicion', tm('Definición')],
  ['audioFrase', tm('Audio de la frase')],
  ['audioPalabra', tm('Audio de la palabra')],
  ['imagenes', tm('Imagen')],
  ['ejemplos', tm('Ejemplos')],
  ['notas', tm('Notas')],
  ['fuente', tm('Fuente')],
];

const PRELLENADO: { grupo: string; ayuda?: string; items: [keyof Prellenado, string][] }[] = [
  { grupo: tm('Frase'), ayuda: tm('Se añade solo una'), items: [['fraseVideo', tm('La frase donde aparece la palabra')], ['fraseIA', tm('Generada por Claude si no hay frase')]] },
  { grupo: tm('Traducción'), ayuda: tm('Se añade solo una'), items: [['traduccionIA', tm('Traducción de Claude')], ['traduccionSecundaria', tm('Subtítulos secundarios, si los hay')]] },
  { grupo: tm('Definición'), items: [['definiciones', tm('Definiciones del diccionario')]] },
  { grupo: tm('Audio de la frase'), ayuda: tm('Se añade solo uno'), items: [['audioFraseVideo', tm('Audio del video')], ['audioFraseVoz', tm('Voz neuronal de Azure')]] },
  { grupo: tm('Audio de la palabra'), items: [['audioPalabraDiccionario', tm('Grabación de un nativo')], ['audioPalabraVoz', tm('Voz neuronal de Azure')]] },
  { grupo: tm('Imagen'), items: [['imagenCaptura', tm('Captura del video')], ['imagenBusqueda', tm('Búsqueda de imágenes')]] },
  { grupo: tm('Extras'), items: [['ejemplos', tm('Frases de lo que has visto')], ['explicacionIA', tm('Explicación de Claude en las notas')]] },
];

const PESTANAS: [PestanaDiccionario, string][] = [
  ['ninguna', tm('Solo el diccionario')],
  ['explicar', tm('Explicación de Claude')],
  ['desglose', tm('Desglose de la frase')],
  ['traduccion', tm('Traducción')],
  ['audio', tm('Audio')],
  ['imagenes', tm('Imágenes')],
  ['trazos', tm('Trazos')],
  ['ejemplos', tm('Ejemplos')],
  ['enlaces', tm('Enlaces')],
];

const nombreContenido = (c: Ajustes['ordenContenido'][number]) => {
  if (c === 'flexiones') return tr(lengua.value.textos.flexiones);
  return c === 'definiciones' ? tr('Definiciones') : tr('Pestañas');
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
  { id: 'auto', nombre: tm('Automático'), icono: 'monitor', ayuda: tm('Sigue a tu sistema') },
  { id: 'claro', nombre: tm('Papel'), icono: 'sol', ayuda: tm('Claro, como el washi') },
  { id: 'oscuro', nombre: tm('Tinta'), icono: 'luna', ayuda: tm('Oscuro, para la noche') },
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

const PALETAS: { id: Ajustes['paleta']; nombre: string; ayuda: string; colores: string[] }[] = [
  { id: 'predeterminada', nombre: tm('Predeterminados'), ayuda: tm('Los de siempre'), colores: ['#FF9166', '#F7CB52', '#BCA9FF'] },
  { id: 'daltonismo', nombre: tm('Para daltonismo'), ayuda: tm('Se distinguen sin rojo ni verde'), colores: ['#E69F00', '#56B4E9', '#CC79A7'] },
  { id: 'contraste', nombre: tm('Alto contraste'), ayuda: tm('Más marcados'), colores: ['#FF7A3D', '#FFE14D', '#D3C2FF'] },
];

function SeccionLector({ a, cambiar }: PropsSeccion) {
  return (
    <Seccion id="lector" icono="lector" titulo={tr('Lector de páginas')} descripcion={tr(lengua.value.textos.lectorAyuda)}>
      <div class="ap-grupo">
        <Opcion titulo={tr(lengua.value.textos.lectorActivar)}>
          <Interruptor etiqueta={tr(lengua.value.textos.lectorActivar)} on={a.lectorActivo} alCambiar={(v) => cambiar({ lectorActivo: v })} />
        </Opcion>
        <Opcion titulo={tr('Colores')} ayuda={tr('Subraya las palabras según lo que sabes de ellas.')}>
          <Interruptor etiqueta={tr('Colores')} on={a.lectorColor} alCambiar={(v) => cambiar({ lectorColor: v })} />
        </Opcion>
        <Opcion titulo={tr(lengua.value.textos.lectura)}>
          <select class="selector" aria-label={tr(lengua.value.textos.lectura)} value={a.lectorFurigana} onChange={(e) => cambiar({ lectorFurigana: e.currentTarget.value as Ajustes['lectorFurigana'] })}>
            <option value="todas">{tr('En todas las palabras')}</option>
            <option value="desconocidas">{tr('Solo en las nuevas')}</option>
            <option value="alPasar">{tr('Al pasar el ratón')}</option>
            <option value="ninguna">{tr('Nunca')}</option>
          </select>
        </Opcion>
        <Opcion titulo={tr(lengua.value.textos.separarLineas)} ayuda={tr(lengua.value.textos.separarLineasAyuda)}>
          <Interruptor etiqueta={tr(lengua.value.textos.separarLineas)} on={a.lectorInterlineado} alCambiar={(v) => cambiar({ lectorInterlineado: v })} />
        </Opcion>
        <Opcion titulo={tr('Abrir la ficha')}>
          <div class="segmentado" role="radiogroup" aria-label={tr('Abrir la ficha')}>
            <button role="radio" aria-checked={a.lectorAbrir === 'clic'} class={a.lectorAbrir === 'clic' ? 'activo' : ''} onClick={() => cambiar({ lectorAbrir: 'clic' })}>{tr('Con un clic')}</button>
            <button role="radio" aria-checked={a.lectorAbrir === 'pasar'} class={a.lectorAbrir === 'pasar' ? 'activo' : ''} onClick={() => cambiar({ lectorAbrir: 'pasar' })}>{tr('Al pasar el ratón')}</button>
          </div>
        </Opcion>
        <Opcion titulo={tr('El clic en enlaces y botones consulta la palabra')} ayuda={tr('Apagado, siguen funcionando como siempre y la ficha se abre al dejar el ratón encima. Encendido, para usar el enlace habrá que hacerlo sin el lector.')}>
          <Interruptor etiqueta={tr('El clic en enlaces y botones consulta la palabra')} on={a.lectorClicEnlaces} alCambiar={(v) => cambiar({ lectorClicEnlaces: v })} />
        </Opcion>
        <Opcion titulo={tr('Botón en el borde de la página')} ayuda={tr(lengua.value.textos.lectorBotonAyuda)}>
          <Interruptor etiqueta={tr('Botón en el borde de la página')} on={a.lectorBoton} alCambiar={(v) => cambiar({ lectorBoton: v })} />
        </Opcion>
      </div>
      {a.sitiosDesactivados.length > 0 && (
        <>
          <Subtitulo>{tr('Sitios sin lector')}</Subtitulo>
          <div class="ap-grupo">
            {a.sitiosDesactivados.map((s) => (
              <div class="ap-opcion" key={s}>
                <div class="ap-opcion-texto"><b>{s}</b></div>
                <div class="ap-opcion-control">
                  <button class="btn chico fantasma" onClick={() => cambiar({ sitiosDesactivados: a.sitiosDesactivados.filter((x) => x !== s) })}>{tr('Volver a activar')}</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Seccion>
  );
}

function SeccionApariencia({ a, cambiar }: PropsSeccion) {
  return (
    <Seccion id="apariencia" icono="paleta" titulo={tr('Apariencia')} descripcion={tr('Se aplica a esta ventana y al menú de la extensión. Sobre el video, Kotonoha siempre va en oscuro para no deslumbrar.')}>
      <div class="ap-temas" role="radiogroup" aria-label={tr('Tema')}>
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
            <span class="ap-tema-nombre"><Icono n={t.icono} t={16} /> <b>{tr(t.nombre)}</b></span>
            <span class="ayuda">{tr(t.ayuda)}</span>
          </button>
        ))}
      </div>
      <Subtitulo>{tr('Colores de las palabras')}</Subtitulo>
      <div class="ap-paletas" role="radiogroup" aria-label={tr('Colores de las palabras')}>
        {PALETAS.map((p) => (
          <button key={p.id} role="radio" aria-checked={a.paleta === p.id} class={`ap-paleta ${a.paleta === p.id ? 'activo' : ''}`} onClick={() => cambiar({ paleta: p.id })}>
            <span class="ap-paleta-muestra">{p.colores.map((c) => <i key={c} style={{ background: c }} />)}</span>
            <b>{tr(p.nombre)}</b>
            <span class="ayuda">{tr(p.ayuda)}</span>
          </button>
        ))}
      </div>
      <div class="ap-botones ap-tras-grupo">
        <button class="btn chico fantasma" onClick={() => cambiar({ bienvenidaVista: false })}>{tr('Volver a ver la bienvenida')}</button>
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
    <Seccion id="claude" icono="ia" ia titulo={tr('Claude')} descripcion={tr('La IA usa tu propia clave de la API. Se guarda solo en este navegador y nunca llega a las páginas que visitas.')}>
      <div class={`ap-clave ${guardada ? 'guardada' : ''}`}>
        <div class="ap-clave-estado">
          <span class={`ap-punto ${guardada ? 'ia' : ''}`} />
          <b>{guardada ? tr('Clave guardada') : tr('Aún no hay clave')}</b>
          {!guardada && <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer noopener">{tr('Conseguir una clave')} <Icono n="externo" t={13} /></a>}
        </div>
        <form class="ap-clave-form" onSubmit={async (e) => {
          e.preventDefault();
          if (!clave.trim()) return;
          await chrome.storage.local.set({ [CLAVE_API]: clave.trim() });
          fijarClave('');
          fijarGuardada(true);
          fijarPrueba({ texto: tr('Clave guardada.') });
        }}>
          <input class="campo" type="password" autocomplete="off" aria-label={tr('Clave de la API de Claude')} placeholder={guardada ? tr('Escribe otra para cambiarla') : 'sk-ant-...'} value={clave} onInput={(e) => fijarClave(e.currentTarget.value)} />
          <button class="btn primario" type="submit" disabled={!clave.trim()}>{tr('Guardar')}</button>
        </form>
        <div class="ap-botones">
          <button class="btn chico ia" disabled={!guardada || probando} onClick={async () => {
            fijarProbando(true);
            fijarPrueba(null);
            try {
              fijarPrueba({ texto: tr('Conectado: {0}', await motor.probarIA()) });
            } catch (e) {
              fijarPrueba({ texto: e instanceof Error ? e.message : String(e), error: true });
            } finally {
              fijarProbando(false);
            }
          }}><Icono n={probando ? 'espera' : 'conectado'} t={14} /> {probando ? tr('Probando…') : tr('Probar la conexión')}</button>
          {guardada && <button class="btn fantasma chico" onClick={async () => {
            await chrome.storage.local.remove(CLAVE_API);
            fijarGuardada(false);
            fijarPrueba({ texto: tr('Clave eliminada.') });
          }}>{tr('Eliminar la clave')}</button>}
        </div>
        {prueba && <Mensaje error={prueba.error}>{prueba.texto}</Mensaje>}
      </div>

      <Subtitulo>{tr('Comportamiento')}</Subtitulo>
      <div class="ap-grupo">
        <Opcion titulo={tr('Revisar lecturas, sentidos y gramática')} ayuda={tr('Claude repasa los subtítulos unos minutos por delante de donde vas, y sigue a medida que avanza. Se paga una sola vez por línea.')}>
          <Interruptor etiqueta={tr('Revisar automáticamente')} on={a.analisisAutomatico} alCambiar={(v) => cambiar({ analisisAutomatico: v })} />
        </Opcion>
        <Opcion titulo={tr('Preguntar el significado al abrir una palabra')} ayuda={tr('Apagado, la ficha abre con el diccionario y solo se pregunta a Claude al pulsar el botón. Encendido, cada palabra nueva que abras es una petición.')}>
          <Interruptor etiqueta={tr('Significado en la frase')} on={a.sentidoAutomatico} alCambiar={(v) => cambiar({ sentidoAutomatico: v })} />
        </Opcion>
        <Opcion titulo={tr('Guion completo como contexto')} ayuda={tr('Siempre recibe unas 40 líneas alrededor de la frase. Con esto, además lee todo el video: ayuda con nombres y referencias, y cuesta más, sobre todo en películas.')}>
          <Interruptor etiqueta={tr('Guion como contexto')} on={a.usarGuion} alCambiar={(v) => cambiar({ usarGuion: v })} />
        </Opcion>
        <Opcion titulo={tr('Tope de gasto al mes, en dólares')} ayuda={tr('Al llegar, Claude deja de usarse hasta el mes siguiente. Con 0 no hay tope.')}>
          <input class="campo ap-campo-corto" type="number" min="0" step="1" aria-label={tr('Tope de gasto al mes, en dólares')} value={a.limiteGasto} onInput={(ev) => cambiar({ limiteGasto: Math.max(0, Number(ev.currentTarget.value) || 0) })} />
        </Opcion>
        <Opcion titulo={tr('Crédito mensual, en dólares')} ayuda={tr('Para ver en Inicio cuánto llevas gastado de tu crédito de la API. No limita nada.')}>
          <input class="campo ap-campo-corto" type="number" min="0" step="10" aria-label={tr('Crédito mensual en dólares')} value={a.creditoMensual} onInput={(ev) => cambiar({ creditoMensual: Math.max(0, Number(ev.currentTarget.value) || 0) })} />
        </Opcion>
        <Opcion titulo={tr('Reintentar en otro modelo')} ayuda={tr('Si hay un rechazo de seguridad, prueba con el modelo de respaldo.')}>
          <Interruptor etiqueta={tr('Respaldo de seguridad')} on={a.respaldoSeguridad} alCambiar={(v) => cambiar({ respaldoSeguridad: v })} />
        </Opcion>
      </div>

      <Subtitulo>{tr('Modelo y esfuerzo por tarea')}</Subtitulo>
      <div class="ap-grupo">
        {NOMBRES_TAREA.map(([t, n]) => (
          <div class="ap-opcion ap-modelo" key={t}>
            <div class="ap-opcion-texto"><b>{tr(n)}</b></div>
            <div class="ap-opcion-control">
              <select class="selector" aria-label={tr('Modelo para {0}', tr(n))} value={a.modelos[t]} onChange={(e) => cambiar({ modelos: { ...a.modelos, [t]: e.currentTarget.value } })}>
                <optgroup label="Claude">
                  {MODELOS.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </optgroup>
                {a.proveedores.filter((p) => p.modelos.length).map((p) => (
                  <optgroup key={p.id} label={p.nombre}>
                    {p.modelos.map((m) => <option key={m} value={valorDeModelo(p.id, m)}>{m}</option>)}
                  </optgroup>
                ))}
              </select>
              {/* El esfuerzo es de Claude: los otros proveedores no lo entienden igual. */}
              <select class="selector" aria-label={tr('Esfuerzo para {0}', tr(n))} disabled={separarModelo(a.modelos[t]).proveedor !== null} value={a.esfuerzos[t]} onChange={(e) => cambiar({ esfuerzos: { ...a.esfuerzos, [t]: e.currentTarget.value as Esfuerzo } })}>
                <option value="low">{tr('Bajo')}</option>
                <option value="medium">{tr('Medio')}</option>
                <option value="high">{tr('Alto')}</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </Seccion>
  );
}

/** Un proveedor añadido: su dirección, su clave (que solo se escribe, nunca se enseña), sus modelos y una prueba. */
function TarjetaProveedor({ p, guardada, alGuardarClave, alQuitarClave, alCambiar, alQuitar }: {
  p: ProveedorIA;
  guardada: boolean;
  alGuardarClave: (clave: string) => Promise<void>;
  alQuitarClave: () => Promise<void>;
  alCambiar: (cambios: Partial<ProveedorIA>) => void;
  alQuitar: () => void;
}) {
  const conocido = PROVEEDORES_CONOCIDOS.find((c) => c.id === p.id);
  const [clave, fijarClave] = useState('');
  const [disponibles, fijarDisponibles] = useState<string[] | null>(null);
  const [nuevo, fijarNuevo] = useState('');
  const [mensaje, fijarMensaje] = useState<{ texto: string; error?: boolean } | null>(null);
  const [ocupado, fijarOcupado] = useState(false);
  const conMensaje = async (fn: () => Promise<string>) => {
    fijarOcupado(true);
    fijarMensaje(null);
    try {
      fijarMensaje({ texto: await fn() });
    } catch (e) {
      fijarMensaje({ texto: e instanceof Error ? e.message : String(e), error: true });
    } finally {
      fijarOcupado(false);
    }
  };
  const anadirModelo = () => {
    const m = nuevo.trim();
    if (m && !p.modelos.includes(m)) alCambiar({ modelos: [...p.modelos, m] });
    fijarNuevo('');
  };
  const listaId = `modelos-${p.id}`;
  return (
    <div class={`ap-clave ap-proveedor ${guardada || !p.conClave ? 'guardada' : ''}`} aria-label={p.nombre} role="group">
      <div class="ap-clave-estado">
        <span class={`ap-punto ${guardada || !p.conClave ? 'ia' : ''}`} />
        <b>{p.nombre}</b>
        <span class="ayuda">{p.url}</span>
        <button class="btn fantasma chico ap-proveedor-quitar" onClick={alQuitar}>{tr('Quitar')}</button>
      </div>
      {!conocido && (
        <div class="ap-proveedor-campos">
          <input class="campo" aria-label={tr('Nombre del proveedor')} value={p.nombre} onChange={(e) => alCambiar({ nombre: e.currentTarget.value.trim() || p.nombre })} />
          <input class="campo" aria-label={tr('Dirección de su API')} placeholder="https://…/v1" value={p.url} onChange={(e) => alCambiar({ url: e.currentTarget.value.trim() })} />
          <label class="ap-proveedor-casilla"><input type="checkbox" checked={p.conClave} onChange={(e) => alCambiar({ conClave: e.currentTarget.checked })} /> {tr('Pide clave')}</label>
        </div>
      )}
      {p.conClave && (
        <form class="ap-clave-form" onSubmit={async (e) => {
          e.preventDefault();
          if (!clave.trim()) return;
          await alGuardarClave(clave.trim());
          fijarClave('');
          fijarMensaje({ texto: tr('Clave guardada.') });
        }}>
          <input class="campo" type="password" autocomplete="off" aria-label={tr('Clave de {0}', p.nombre)} placeholder={guardada ? tr('Escribe otra para cambiarla') : tr('Clave')} value={clave} onInput={(e) => fijarClave(e.currentTarget.value)} />
          <button class="btn primario" type="submit" disabled={!clave.trim()}>{tr('Guardar')}</button>
          {conocido?.dondeClave && !guardada && <a class="btn fantasma chico" href={conocido.dondeClave} target="_blank" rel="noreferrer noopener">{tr('Conseguir una clave')} <Icono n="externo" t={13} /></a>}
        </form>
      )}
      <div class="ap-proveedor-modelos">
        <span class="ayuda">{tr('Modelos que se ofrecen en cada tarea:')}</span>
        {p.modelos.map((m) => (
          <span class="chip ap-proveedor-modelo" key={m}>
            {m}
            <button class="btn-icono chico" aria-label={tr('Quitar {0}', m)} onClick={() => alCambiar({ modelos: p.modelos.filter((x) => x !== m) })}><Icono n="cerrar" t={12} /></button>
          </span>
        ))}
        {!p.modelos.length && <span class="ayuda">{tr('Ninguno todavía.')}</span>}
      </div>
      <form class="ap-clave-form" onSubmit={(e) => {
        e.preventDefault();
        anadirModelo();
      }}>
        <input class="campo" list={listaId} aria-label={tr('Modelo que añadir')} placeholder={tr('Nombre del modelo')} value={nuevo} onInput={(e) => fijarNuevo(e.currentTarget.value)} />
        <datalist id={listaId}>{disponibles?.map((m) => <option key={m} value={m} />)}</datalist>
        <button class="btn" type="submit" disabled={!nuevo.trim()}>{tr('Añadir')}</button>
      </form>
      <div class="ap-botones">
        <button class="btn chico" disabled={ocupado} onClick={() => conMensaje(async () => {
          const lista = await motor.modelosProveedor(p.id);
          fijarDisponibles(lista);
          return tr('{0} modelos disponibles: escribe el nombre de uno para añadirlo.', lista.length);
        })}><Icono n="lista" t={14} /> {tr('Ver sus modelos')}</button>
        <button class="btn chico ia" disabled={ocupado || !p.modelos.length || (p.conClave && !guardada)} onClick={() => conMensaje(async () => tr('Conectado: {0}', await motor.probarProveedor(p.id, p.modelos[0])))}>
          <Icono n={ocupado ? 'espera' : 'conectado'} t={14} /> {tr('Probar la conexión')}
        </button>
        {p.conClave && guardada && <button class="btn fantasma chico" onClick={async () => {
          await alQuitarClave();
          fijarMensaje({ texto: tr('Clave eliminada.') });
        }}>{tr('Eliminar la clave')}</button>}
      </div>
      {conocido?.nota === 'OLLAMA_ORIGINS' && <p class="ayuda">{tr('Ollama solo atiende a las extensiones si se arranca con la variable OLLAMA_ORIGINS=chrome-extension://*.')}</p>}
      {mensaje && <Mensaje error={mensaje.error}>{mensaje.texto}</Mensaje>}
    </div>
  );
}

/**
 * Otros proveedores de IA con la API de OpenAI. Se añade uno, se le pone la clave y los modelos, y en «Modelo y esfuerzo por
 * tarea» se elige qué tareas hace. Claude sigue siendo el de siempre.
 */
function SeccionProveedores({ a, cambiar }: PropsSeccion) {
  const [conClave, fijarConClave] = useState<Record<string, boolean>>({});
  const leerClaves = () =>
    chrome.storage.local.get(CLAVES_PROVEEDORES).then((d) => fijarConClave(Object.fromEntries(Object.entries((d[CLAVES_PROVEEDORES] ?? {}) as Record<string, string>).map(([k, v]) => [k, !!v]))));
  useEffect(() => {
    void leerClaves();
  }, []);
  const claves = async (fn: (c: Record<string, string>) => Record<string, string>) => {
    const d = await chrome.storage.local.get(CLAVES_PROVEEDORES);
    await chrome.storage.local.set({ [CLAVES_PROVEEDORES]: fn({ ...((d[CLAVES_PROVEEDORES] ?? {}) as Record<string, string>) }) });
    await leerClaves();
  };
  const anadir = (c: ProveedorConocido | null) => {
    const usados = a.proveedores.map((p) => p.id);
    const nuevo: ProveedorIA = c
      ? { id: c.id, nombre: c.nombre, url: c.url, modelos: c.sugeridos, esquemas: c.esquemas, conClave: c.conClave }
      : { id: idParaProveedor(tr('Otro proveedor'), usados), nombre: tr('Otro proveedor'), url: '', modelos: [], esquemas: 'auto', conClave: true };
    cambiar({ proveedores: [...a.proveedores, nuevo] });
  };
  const quitar = (id: string) => {
    // Las tareas que lo usaban vuelven a su modelo de Claude de siempre.
    const modelos = { ...a.modelos };
    for (const t of Object.keys(modelos) as TareaIA[]) if (separarModelo(modelos[t]).proveedor === id) modelos[t] = AJUSTES_INICIALES.modelos[t];
    cambiar({ proveedores: a.proveedores.filter((p) => p.id !== id), modelos });
    void claves((c) => {
      delete c[id];
      return c;
    });
  };
  const porAnadir = PROVEEDORES_CONOCIDOS.filter((c) => !a.proveedores.some((p) => p.id === c.id));
  return (
    <Seccion id="proveedores" icono="ia" ia titulo={tr('Otros proveedores de IA')} descripcion={tr('OpenRouter, DeepSeek, OpenAI, o LM Studio y Ollama en este equipo: todos hablan la misma API. Añade uno, pon su clave y sus modelos, y elige en «Modelo y esfuerzo por tarea» qué tareas hace. Las instrucciones están afinadas para Claude, que sigue siendo el de siempre.')}>
      {a.proveedores.map((p) => (
        <TarjetaProveedor
          key={p.id}
          p={p}
          guardada={!!conClave[p.id]}
          alGuardarClave={(clave) => claves((c) => ({ ...c, [p.id]: clave }))}
          alQuitarClave={() => claves((c) => {
            delete c[p.id];
            return c;
          })}
          alCambiar={(cambios) => cambiar({ proveedores: a.proveedores.map((x) => (x.id === p.id ? { ...x, ...cambios } : x)) })}
          alQuitar={() => quitar(p.id)}
        />
      ))}
      <div class="ap-botones ap-proveedores-anadir">
        {porAnadir.map((c) => (
          <button key={c.id} class="btn chico" onClick={() => anadir(c)}><Icono n="mas" t={14} /> {c.nombre}</button>
        ))}
        <button class="btn chico fantasma" onClick={() => anadir(null)}><Icono n="mas" t={14} /> {tr('Otro compatible con OpenAI')}</button>
      </div>
    </Seccion>
  );
}

function CampoNombre({ a, cambiar }: PropsSeccion) {
  return (
    <Opcion titulo={tr('Tu nombre')} ayuda={tr('Para el saludo de la pantalla de inicio. Es opcional.')}>
      <input class="campo ap-campo-corto" aria-label={tr('Tu nombre')} value={a.nombre} onInput={(ev) => cambiar({ nombre: ev.currentTarget.value })} />
    </Opcion>
  );
}

function SeccionIdioma({ a, cambiar }: PropsSeccion) {
  return (
    <Seccion id="idioma" icono="nivel" titulo={tr('Idioma y nivel')} descripcion={tr('Las explicaciones se adaptan a tu nivel.')}>
      <div class="ap-grupo">
        <Opcion titulo={tr('Idioma que estudias')} ayuda={tr('Cada idioma guarda sus propias palabras, diccionarios y tarjetas.')}>
          <select class="selector" aria-label={tr('Idioma que estudias')} value={a.idiomaObjetivo} onChange={(e) => estudiarLengua(a, e.currentTarget.value).catch(console.error)}>
            {PAQUETES.map((p) => <option key={p.id} value={p.id}>{tr(p.textos.nombre) === p.nombrePropio ? p.nombrePropio : `${tr(p.textos.nombre)} · ${p.nombrePropio}`}</option>)}
          </select>
        </Opcion>
        <Opcion titulo={tr('Idioma de la interfaz')} ayuda={tr('Al cambiarlo, también se ajustan las explicaciones y las traducciones. Luego puedes elegirlas por separado.')}>
          <select class="selector" aria-label={tr('Idioma de la interfaz')} value={a.idiomaInterfaz} onChange={(e) => {
            const v = e.currentTarget.value as Ajustes['idiomaInterfaz'];
            const l = lenguaDe(resolverIdioma(v), a.idiomaObjetivo);
            cambiar({ idiomaInterfaz: v, idiomaExplicaciones: l.explicaciones, idiomaTraduccion: l.traducciones, idiomaSecundario: l.secundaria });
          }}>
            <option value="auto">{tr('Automático, como el navegador')}</option>
            {IDIOMAS_INTERFAZ.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
          </select>
        </Opcion>
        <CampoNombre a={a} cambiar={cambiar} />
        <Opcion titulo={tr('Nivel')}>
          <select class="selector" aria-label={tr('Nivel')} value={a.nivel} onChange={(e) => cambiar({ nivel: e.currentTarget.value })}>
            <option value={lengua.value.principiante.valor}>{tr(lengua.value.principiante.nombre)}</option>
            {lengua.value.niveles.map((n) => <option key={n.valor} value={n.valor}>{n.valor}</option>)}
            <option value="nativo">{tr('Nativo')}</option>
          </select>
        </Opcion>
        <Opcion titulo={tr(lengua.value.textos.formatoTitulo)} ayuda={tr(lengua.value.textos.formatoAyuda)}>
          <div class="segmentado" role="radiogroup" aria-label={tr(lengua.value.textos.formatoTitulo)}>
            {lengua.value.lectura.formatos.map(({ id: v, muestra: n }) => (
              <button key={v} role="radio" aria-checked={a.formatoLectura === v} class={a.formatoLectura === v ? 'activo' : ''} onClick={() => cambiar({ formatoLectura: v })}>{n}</button>
            ))}
          </div>
        </Opcion>
        <Opcion titulo={tr('Idioma de las explicaciones')}>
          <select class="selector" aria-label={tr('Idioma de las explicaciones')} value={a.idiomaExplicaciones} onChange={(e) => cambiar({ idiomaExplicaciones: e.currentTarget.value })}>
            {lenguasExplicacion(a.idiomaObjetivo).map((l) => <option key={l.valor} value={l.valor}>{tr(l.nombre)}</option>)}
          </select>
        </Opcion>
        <Opcion titulo={tr('Idioma de las traducciones')}>
          <select class="selector" aria-label={tr('Idioma de las traducciones')} value={a.idiomaTraduccion} onChange={(e) => cambiar({ idiomaTraduccion: e.currentTarget.value })}>
            {lenguasTraduccion(a.idiomaObjetivo).map((l) => <option key={l.valor} value={l.valor}>{tr(l.nombre)}</option>)}
          </select>
        </Opcion>
      </div>
    </Seccion>
  );
}

/** Un tamaño para leerlo: 1,5 GB o 185 MB. */
function textoTamano(mb: number): string {
  return mb >= 1000 ? `${(mb / 1000).toLocaleString(bcp47Actual(), { maximumFractionDigits: 1 })} GB` : `${Math.max(1, Math.round(mb))} MB`;
}

const INTENSIDADES: { id: Ajustes['whisperIntensidad']; nombre: string; ayuda: string }[] = [
  { id: 'auto', nombre: tm('Automática'), ayuda: tm('Equilibra velocidad y fluidez, y acelera cuando te alejas. Un video de 30 minutos tarda alrededor de uno con Haas-ja o Parakeet, y unos 5 con Whisper.') },
  { id: 'suave', nombre: tm('Suave'), ayuda: tm('La mínima carga, por si estás jugando o editando video. Un video de 30 minutos tarda unos 3 con Haas-ja o Parakeet, y unos 12 con Whisper.') },
  { id: 'rapida', nombre: tm('Rápida'), ayuda: tm('Siempre a la máxima velocidad segura. Un video de 30 minutos tarda menos de uno con Haas-ja o Parakeet, y unos 4 con Whisper.') },
];

/** Sin el ayudante, un video de internet solo se puede transcribir mientras se reproduce. */
function AyudanteLocal() {
  const [info, fijarInfo] = useState<InfoAyudante | null | undefined>(undefined);
  const comprobar = () => {
    fijarInfo(undefined);
    motor.ayudante().then(fijarInfo).catch(() => fijarInfo(null));
  };
  useEffect(comprobar, []);
  if (info === undefined) return <Opcion titulo={tr('Ayudante para YouTube')} ayuda={tr('Comprobando si está instalado…')}><span class="ayuda">…</span></Opcion>;
  if (info) {
    // El de PowerShell convierte el audio con FFmpeg si lo hay, y si no lo convierte la extensión: solo le falta yt-dlp.
    const falta = !info.ytdlp ? tr('Falta yt-dlp') : info.version < 2 && !info.ffmpeg ? tr('Falta ffmpeg') : null;
    return (
      <Opcion
        titulo={tr('Ayudante para YouTube')}
        ayuda={
          <>
            {tr('Instalado, con yt-dlp {0}. Los videos de internet se transcriben enteros, sin reproducirlos.', info.ytdlp ?? tr('(falta)'))}{' '}
            {info.version < 2 ? tr('Hay un ayudante nuevo que no necesita Python y también actualiza Kotonoha: descárgalo y haz doble clic en Instalar.cmd.') : !info.ffmpeg ? tr('Sin FFmpeg en el equipo, la extensión convierte el audio por su cuenta, algo más despacio.') : ''}
          </>
        }
      >
        {falta ? <span class="ayuda">{falta}</span> : <span class="ap-whisper-tam"><Icono n="check" t={14} /> {tr('Listo')}</span>}
      </Opcion>
    );
  }
  const orden = ordenInstalarAyudante(chrome.runtime.id);
  return (
    <Opcion
      titulo={tr('Ayudante para YouTube')}
      ayuda={
        <>
          {tr('Permite transcribir un video entero sin reproducirlo, y actualizar Kotonoha con un clic. Solo para Windows, sin instalar nada más.')}{' '}
          {tr('Descarga el ayudante de la última versión, descomprímelo y haz doble clic en Instalar.cmd: encuentra Kotonoha en Chrome y Edge.')}{' '}
          {tr('Si no la encuentra, ejecuta esto en la carpeta del ayudante:')}{' '}
          <code class="ap-orden-ayudante">{orden}</code>
        </>
      }
    >
      <span class="ap-acciones-fila ap-acciones-ayudante">
        <a class="btn chico fantasma" href={URL_ULTIMA_VERSION} target="_blank" rel="noreferrer noopener"><Icono n="descargar" t={14} /> {tr('Descargar')}</a>
        <button class="btn chico fantasma" onClick={() => navigator.clipboard.writeText(orden).catch(() => {})}><Icono n="portapapeles" t={14} /> {tr('Copiar')}</button>
        <button class="btn chico fantasma" onClick={comprobar}>{tr('Comprobar')}</button>
      </span>
    </Opcion>
  );
}

function SeccionTranscripcion({ a, cambiar }: PropsSeccion) {
  const [guardados, fijarGuardados] = useState<ResumenModelos | null>(null);
  // narabas, el modelo con que la práctica del acento comprueba las moras: va en su propia caché.
  const [moras, fijarMoras] = useState(0);
  const releer = () => {
    leerModelosGuardados().then(fijarGuardados).catch(() => {});
    bytesModeloMoras().then(fijarMoras).catch(() => {});
  };
  useEffect(() => {
    releer();
  }, []);
  const descargados = new Set(guardados?.modelos.map((m) => m.id));
  const modelos = (Object.entries(MODELOS_WHISPER) as [ModeloWhisper, (typeof MODELOS_WHISPER)[ModeloWhisper]][]).filter(([id]) => modeloSirveParaLengua(id, a.idiomaObjetivo));
  return (
    <Seccion id="transcripcion" icono="ondas" titulo={tr('Transcripción de voz')} descripcion={tr(lengua.value.textos.whisperAyuda)}>
      <div class="ap-whisper-modelos" role="radiogroup" aria-label={tr('Modelo de transcripción')}>
        <button class={`ap-whisper-modelo ${a.whisperModelo === 'auto' ? 'activo' : ''}`} role="radio" aria-checked={a.whisperModelo === 'auto'} onClick={() => cambiar({ whisperModelo: 'auto' })}>
          <b>{tr('Automático')}</b>
          <span class="ayuda">{tr(MODELO_AUTOMATICO)}</span>
        </button>
        {modelos.map(([id, m]) => (
          <button key={id} class={`ap-whisper-modelo ${a.whisperModelo === id ? 'activo' : ''}`} role="radio" aria-checked={a.whisperModelo === id} onClick={() => cambiar({ whisperModelo: id })}>
            <b>{tr(m.nombre)}</b>
            <span class="ayuda">{tr(m.descripcion)}</span>
            <span class="ap-whisper-tam num">
              {descargados.has(id) ? <><Icono n="check" t={14} /> {tr('Descargado')}</> : <><Icono n="descargar" t={14} /> {textoTamano(m.mb)}</>}
            </span>
          </button>
        ))}
      </div>
      <div class="ap-grupo">
        <Opcion titulo={tr('Intensidad al transcribir archivos')} ayuda={tr(INTENSIDADES.find((i) => i.id === a.whisperIntensidad)?.ayuda ?? '')}>
          <div class="segmentado" role="radiogroup" aria-label={tr('Intensidad de la transcripción')}>
            {INTENSIDADES.map((i) => (
              <button key={i.id} class={a.whisperIntensidad === i.id ? 'activo' : ''} role="radio" aria-checked={a.whisperIntensidad === i.id} onClick={() => cambiar({ whisperIntensidad: i.id })}>{tr(i.nombre)}</button>
            ))}
          </div>
        </Opcion>
        <Opcion titulo={tr('Corregir con Claude')} ayuda={tr(lengua.value.textos.whisperCorregirAyuda)}>
          <Interruptor etiqueta={tr('Corregir con Claude')} on={a.whisperCorregir} alCambiar={(v) => cambiar({ whisperCorregir: v })} />
        </Opcion>
        <AyudanteLocal />
      </div>
      {guardados && guardados.totalBytes + moras > 0 && (
        <>
          <Subtitulo>{tr('Modelos guardados')}</Subtitulo>
          <p class="ayuda ap-subtitulo-ayuda">
            {tr('Se guardan en este navegador: se leen del disco y no se vuelven a descargar. Si borras uno, se descargará de nuevo la próxima vez que lo uses. Desinstalar la extensión también los borra.')}
            {guardados.modelos.length + (moras ? 1 : 0) > 1 && ` ${tr('En total ocupan {0}.', textoTamano((guardados.totalBytes + moras) / 1e6))}`}
          </p>
          <div class="ap-grupo">
            {moras > 0 && (
              <Opcion titulo={tr('narabas, para las moras de la práctica del acento')} ayuda={textoTamano(moras / 1e6)}>
                <button class="btn chico fantasma" aria-label={`${tr('Borrar')}: narabas`} onClick={() => borrarModeloMoras().then(releer)}><Icono n="basura" t={14} /> {tr('Borrar')}</button>
              </Opcion>
            )}
            {guardados.modelos.map(({ id, bytes }) => (
              <Opcion key={id} titulo={tr(MODELOS_WHISPER[id].nombre)} ayuda={textoTamano(bytes / 1e6)}>
                <button class="btn chico fantasma" aria-label={`${tr('Borrar')}: ${tr(MODELOS_WHISPER[id].nombre)}`} onClick={() => borrarModeloGuardado(id).then(releer)}><Icono n="basura" t={14} /> {tr('Borrar')}</button>
              </Opcion>
            ))}
            {guardados.otrosBytes > 0 && (
              <Opcion titulo={tr('Archivos sueltos')} ayuda={`${tr('De una descarga que no terminó o de un modelo que ya no se ofrece.')} ${textoTamano(guardados.otrosBytes / 1e6)}`}>
                <button class="btn chico fantasma" aria-label={`${tr('Borrar')}: ${tr('Archivos sueltos')}`} onClick={() => borrarArchivosSueltos().then(releer)}><Icono n="basura" t={14} /> {tr('Borrar')}</button>
              </Opcion>
            )}
          </div>
        </>
      )}
    </Seccion>
  );
}

const VARIABLES_PROMPT = ['PALABRA', 'SUPERFICIE', 'LECTURA', 'FRASE', 'ENTORNO', 'TRADUCCION', 'TITULO', 'NIVEL', 'IDIOMA', 'PREGUNTA'];

function SeccionPrompts({ a, cambiar }: PropsSeccion) {
  const [tarea, fijarTarea] = useState<TareaPrompt>('explicar');
  const originales = motorDe(lengua.value.id).prompts.base;
  const actual = a.prompts[tarea] ?? originales[tarea];
  const [sistema, fijarSistema] = useState(actual.sistema);
  const [usuario, fijarUsuario] = useState(actual.usuario);
  useEffect(() => {
    const p = a.prompts[tarea] ?? originales[tarea];
    fijarSistema(p.sistema);
    fijarUsuario(p.usuario);
  }, [tarea]);
  const personalizado = !!a.prompts[tarea];
  return (
    <Seccion id="prompts" icono="nota-lapiz" ia titulo={tr('Prompts personalizados')} descripcion={tr('Cambia lo que se le pide a Claude en cada tarea. Si algo sale mal, puedes volver al original.')}>
      <div class="ap-grupo ap-prompts">
        <div class="ap-prompts-cab">
          <select class="selector" aria-label={tr('Tarea')} value={tarea} onChange={(e) => fijarTarea(e.currentTarget.value as typeof tarea)}>
            {TAREAS_PERSONALIZABLES.map((t) => <option key={t.id} value={t.id}>{t.nombre}{a.prompts[t.id] ? tr(' (personalizado)') : ''}</option>)}
          </select>
          <div class="ap-variables" aria-label={tr('Variables disponibles')}>
            {VARIABLES_PROMPT.map((v) => <code key={v}>[{v}]</code>)}
          </div>
        </div>
        <label class="ap-prompt-campo">
          <span>{tr('Prompt de sistema')}</span>
          <textarea class="campo ap-codigo" rows={9} value={sistema} onInput={(e) => fijarSistema(e.currentTarget.value)} />
        </label>
        <label class="ap-prompt-campo">
          <span>{tr('Prompt de usuario')}</span>
          <textarea class="campo ap-codigo" rows={4} value={usuario} onInput={(e) => fijarUsuario(e.currentTarget.value)} />
        </label>
        <div class="ap-botones">
          <button class="btn primario" onClick={() => cambiar({ prompts: { ...a.prompts, [tarea]: { sistema, usuario } } })}>{tr('Guardar')}</button>
          <button class="btn" disabled={!personalizado} onClick={() => {
            const { [tarea]: _quitado, ...resto } = a.prompts;
            cambiar({ prompts: resto });
            fijarSistema(originales[tarea].sistema);
            fijarUsuario(originales[tarea].usuario);
          }}>{tr('Restablecer')}</button>
        </div>
      </div>
    </Seccion>
  );
}

function SeccionDiccionarios({ a, cambiar }: PropsSeccion) {
  const [instalados, fijarInstalados] = useState<InfoDiccionario[]>([]);
  const [fuentes, fijarFuentes] = useState<FuenteBiblioteca[]>([]);
  const [progreso, fijarProgreso] = useState<Record<string, ProgresoInstalacion>>({});
  const [borrando, fijarBorrando] = useState<string[]>([]);
  const [errorBorrar, fijarErrorBorrar] = useState('');
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

  // Uno grande tarda en borrarse: sin avisar, parecería que el botón no hace nada.
  const eliminar = async (id: string) => {
    fijarErrorBorrar('');
    fijarBorrando((b) => [...b, id]);
    try {
      await motor.eliminarDiccionario(id);
    } catch (e) {
      fijarErrorBorrar(e instanceof Error ? e.message : String(e));
    } finally {
      fijarBorrando((b) => b.filter((x) => x !== id));
    }
  };

  const filaInstalado = (d: InfoDiccionario, i: number, lista: InfoDiccionario[]) => (
    <div class="ap-opcion" key={d.id}>
      <div class="ap-opcion-texto">
        <b>{tr(d.titulo)}</b>
        <span class="num">{numero(d.filas)} {tr('filas')}</span>
      </div>
      <div class="ap-opcion-control ap-apretado">
        {lista.length > 1 && (
          <>
            <button class="btn-icono chico" disabled={i === 0} aria-label={tr('Subir {0}', d.titulo)} onClick={() => mover(lista, i, -1)}><Icono n="arriba" t={15} /></button>
            <button class="btn-icono chico" disabled={i === lista.length - 1} aria-label={tr('Bajar {0}', d.titulo)} onClick={() => mover(lista, i, 1)}><Icono n="abajo" t={15} /></button>
          </>
        )}
        {borrando.includes(d.id)
          ? <span class="ayuda" role="status">{tr('Eliminando…')}</span>
          : <button class="btn-icono chico" aria-label={tr('Eliminar {0}', d.titulo)} data-tip={tr('Eliminar')} data-tip-lado="izq" onClick={() => eliminar(d.id)}><Icono n="basura" t={15} /></button>}
      </div>
    </div>
  );

  const terminos = instalados.filter((d) => d.tipo === 'terminos');
  const frecuencias = instalados.filter((d) => d.tipo === 'frecuencia');
  const otros = instalados.filter((d) => d.tipo === 'acento');
  const faltan = fuentes.filter((f) => !instalados.some((d) => d.id === f.id));
  const instalandoArchivo = Object.values(progreso).filter((p) => p.id.startsWith('archivo-') && p.fase !== 'listo');

  return (
    <Seccion id="diccionarios" icono="diccionario" titulo={tr('Diccionarios')} descripcion={tr('El orden importa: el primero manda en las traducciones cortas y en lo que se muestra primero.')}>
      <div class="ap-grupo">
        {terminos.map(filaInstalado)}
        {terminos.length === 0 && <div class="ap-opcion"><span class="ayuda">{tr('Aún no hay diccionarios instalados.')}</span></div>}
      </div>
      {errorBorrar && <Mensaje error>{errorBorrar}</Mensaje>}

      {(frecuencias.length > 0 || otros.length > 0) && (
        <>
          <Subtitulo>{tr(lengua.value.textos.frecuenciaYAcento)}</Subtitulo>
          <div class="ap-grupo">
            {frecuencias.map(filaInstalado)}
            {otros.map((d) => filaInstalado(d, 0, [d]))}
          </div>
        </>
      )}

      {faltan.length > 0 && <Subtitulo>{tr('Disponibles para instalar')}</Subtitulo>}
      {faltan.length > 0 && (
        <div class="ap-grupo">
          {faltan.map((f) => {
            const p = progreso[f.id];
            const activo = p && p.fase !== 'listo' && p.fase !== 'error';
            return (
              <div class="ap-opcion" key={f.id}>
                <div class="ap-opcion-texto">
                  <b>{tr(f.titulo)}</b>
                  <span>{tr(f.descripcion)} {f.licencia}.</span>
                  {p?.fase === 'error' && <span class="ap-texto-error">{p.error}</span>}
                  {activo && (
                    <div class="ap-instalando">
                      <div class="barra-progreso"><div style={{ width: `${p.avance * 100}%` }} /></div>
                      <span class="num">{p.fase === 'descargando' ? tr('Descargando') : tr('Guardando')} {Math.round(p.avance * 100)} %</span>
                    </div>
                  )}
                </div>
                <div class="ap-opcion-control">
                  <button class={`btn chico ${f.recomendado ? 'primario' : ''}`} disabled={activo} onClick={() => motor.instalarDiccionario(f.id).catch(() => {})}>{tr('Instalar')}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div class="ap-botones ap-tras-grupo">
        <button class="btn chico" onClick={() => entrada.current?.click()}><Icono n="subir" t={14} /> {tr('Instalar desde un archivo Yomitan')}</button>
        <input ref={entrada} type="file" accept=".zip" hidden aria-label={tr('Instalar diccionario desde archivo')} onChange={async (e) => {
          const f = e.currentTarget.files?.[0];
          if (f) await motor.instalarArchivo(URL.createObjectURL(f), f.name).catch(() => {});
          e.currentTarget.value = '';
        }} />
      </div>
      {instalandoArchivo.map((p) => (
        <p key={p.id} class="ayuda num">{tr(p.titulo)}: {p.fase === 'error' ? p.error : `${Math.round(p.avance * 100)} %`}</p>
      ))}

      <Subtitulo>{tr('Ficha de la palabra')}</Subtitulo>
      <div class="ap-grupo">
        <Opcion titulo={tr('Pestaña inicial')} ayuda={tr('Lo primero que ves al consultar una palabra. Una pestaña de Claude haría una petición por cada palabra nueva que abras.')}>
          <select class="selector" aria-label={tr('Pestaña inicial')} value={a.diccionarioPestana} onChange={(e) => cambiar({ diccionarioPestana: e.currentTarget.value as PestanaDiccionario })}>
            {PESTANAS.filter(([v]) => v !== 'trazos' || lengua.value.trazos).map(([v, n]) => <option key={v} value={v}>{tr(n)}</option>)}
          </select>
        </Opcion>
        <Opcion titulo={tr('Etiqueta de frecuencia')}>
          <div class="segmentado" role="radiogroup" aria-label={tr('Etiqueta de frecuencia')}>
            <button role="radio" aria-checked={a.estiloFrecuencia === 'numero'} class={a.estiloFrecuencia === 'numero' ? 'activo' : ''} onClick={() => cambiar({ estiloFrecuencia: 'numero' })}>{tr('Posición')}</button>
            <button role="radio" aria-checked={a.estiloFrecuencia === 'estrellas'} class={a.estiloFrecuencia === 'estrellas' ? 'activo' : ''} onClick={() => cambiar({ estiloFrecuencia: 'estrellas' })}>{tr('Estrellas')}</button>
          </div>
        </Opcion>
        {a.ordenContenido.map((c, i) => (
          <Opcion key={c} titulo={<><span class="ap-orden num">{i + 1}</span> {nombreContenido(c)}</>} ayuda={i === 0 ? tr('Orden del contenido dentro de la ficha.') : undefined}>
            <span class="ap-apretado">
              <button class="btn-icono chico" disabled={i === 0} aria-label={tr('Subir {0}', nombreContenido(c))} onClick={() => {
                const n = [...a.ordenContenido];
                [n[i - 1], n[i]] = [n[i], n[i - 1]];
                cambiar({ ordenContenido: n });
              }}><Icono n="arriba" t={15} /></button>
              <button class="btn-icono chico" disabled={i === a.ordenContenido.length - 1} aria-label={tr('Bajar {0}', nombreContenido(c))} onClick={() => {
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
  const [consultaGramatica, fijarConsultaGramatica] = useState('deck:*');
  const [campoGramatica, fijarCampoGramatica] = useState('');

  useEffect(() => {
    refrescarAnki();
  }, []);
  useEffect(() => {
    if (e?.conectado && a.ankiModelo && a.ankiModelo !== 'Kotonoha') motor.ankiCamposModelo(a.ankiModelo).then(fijarCampos).catch(() => fijarCampos([]));
    else fijarCampos([]);
  }, [e?.conectado, a.ankiModelo]);

  return (
    <Seccion id="anki" icono="tarjetas" titulo={tr('Tarjetas y Anki')} descripcion={tr('Dónde van tus tarjetas y qué llevan al crearlas.')}>
      <div class="ap-grupo">
        <Opcion titulo={tr('Enviar tarjetas a')}>
          <div class="segmentado" role="radiogroup" aria-label={tr('Destino de las tarjetas')}>
            <button role="radio" aria-checked={a.destino === 'anki'} class={a.destino === 'anki' ? 'activo' : ''} onClick={() => cambiar({ destino: 'anki' })}>{tr('Anki')}</button>
            <button role="radio" aria-checked={a.destino === 'memoria'} class={a.destino === 'memoria' ? 'activo' : ''} onClick={() => cambiar({ destino: 'memoria' })}>{tr('Memoria')}</button>
          </div>
        </Opcion>
        <Opcion
          titulo={<span class="ap-estado-anki"><span class={`ap-punto ${e?.conectado ? 'ok' : ''}`} /> {e?.conectado ? tr('Conectado con AnkiConnect, versión {0}', e.version) : tr('Anki sin conectar')}</span>}
          ayuda={e?.conectado ? undefined : tr('Abre Anki con AnkiConnect instalado y pulsa Conectar. Anki te pedirá confirmación la primera vez.')}
        >
          <button class="btn chico" onClick={async () => {
            try {
              estadoAnki.value = await motor.ankiPermiso();
              fijarMensaje({ texto: tr('Conectado.') });
            } catch (err) {
              fijarMensaje({ texto: err instanceof Error ? err.message : String(err), error: true });
            }
          }}><Icono n="conectado" t={14} /> {tr('Conectar con Anki')}</button>
        </Opcion>
        {e?.conectado && (
          <>
            <Opcion titulo={tr('Mazo')}>
              <input class="campo ap-campo-corto" list="kk-mazos" aria-label={tr('Mazo de Anki')} value={a.ankiMazo} onInput={(ev) => cambiar({ ankiMazo: ev.currentTarget.value })} />
              <datalist id="kk-mazos">{e.mazos.map((m) => <option key={m} value={m} />)}</datalist>
            </Opcion>
            <Opcion titulo={tr('Tipo de nota')}>
              <select class="selector" aria-label={tr('Tipo de nota')} value={a.ankiModelo} onChange={(ev) => cambiar({ ankiModelo: ev.currentTarget.value })}>
                <option value="Kotonoha">{tr('Kotonoha (se crea sola)')}</option>
                {e.modelos.filter((m) => m !== 'Kotonoha').map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Opcion>
            <Opcion titulo={tr('Etiquetas')}>
              <input class="campo ap-campo-corto" aria-label={tr('Etiquetas')} value={a.ankiEtiquetas} onInput={(ev) => cambiar({ ankiEtiquetas: ev.currentTarget.value })} />
            </Opcion>
          </>
        )}
        <Opcion titulo={tr('Poner en negrita la palabra en la frase')}>
          <Interruptor etiqueta={tr('Negrita')} on={a.negritaPalabra} alCambiar={(v) => cambiar({ negritaPalabra: v })} />
        </Opcion>
      </div>
      {mensaje && <Mensaje error={mensaje.error}>{mensaje.texto}</Mensaje>}

      {e?.conectado && campos.length > 0 && (
        <>
          <Subtitulo>{tr('Campos de')} {a.ankiModelo}</Subtitulo>
          <div class="ap-grupo">
            {camposTarjeta(lengua.value.textos).map(([dato, nombre]) => (
              <Opcion key={dato} titulo={tr(nombre)}>
                <select class="selector" aria-label={tr('Campo para {0}', tr(nombre))} value={a.ankiCampos[dato] ?? ''} onChange={(ev) => cambiar({ ankiCampos: { ...a.ankiCampos, [dato]: ev.currentTarget.value } })}>
                  <option value="">{tr('No usar')}</option>
                  {campos.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Opcion>
            ))}
          </div>
        </>
      )}

      {e?.conectado && (
        <>
          <Subtitulo>{tr('Importar palabras desde Anki')}</Subtitulo>
          <div class="ap-grupo ap-importar-anki">
            <p class="ayuda">{tr('Las tarjetas con intervalo de 21 días o más se marcan como conocidas; el resto, aprendiendo.')}</p>
            <div class="ap-importar-fila">
              <input class="campo" aria-label={tr('Búsqueda de Anki')} placeholder="deck:…" value={consulta} onInput={(ev) => fijarConsulta(ev.currentTarget.value)} />
              <input class="campo ap-campo-corto" aria-label={tr('Campo con la palabra')} placeholder={tr('Campo')} value={campoImport} onInput={(ev) => fijarCampoImport(ev.currentTarget.value)} />
              <button class="btn" disabled={!campoImport} onClick={async () => {
                fijarMensaje({ texto: tr('Importando…') });
                try {
                  fijarMensaje({ texto: tr('{0} palabras importadas.', await motor.importarConocidasAnki(consulta, campoImport)) });
                } catch (err) {
                  fijarMensaje({ texto: err instanceof Error ? err.message : String(err), error: true });
                }
              }}>{tr('Importar')}</button>
            </div>
          </div>
          <Subtitulo>{tr('Importar gramática desde Anki')}</Subtitulo>
          <div class="ap-grupo ap-importar-anki">
            <p class="ayuda">{tr('Busca en el campo indicado los puntos de gramática que Kotonoha conoce. Los de tarjetas con intervalo de 21 días o más quedan como sabidos y dejan de señalarse en los subtítulos; el resto, en aprendizaje.')}</p>
            <div class="ap-importar-fila">
              <input class="campo" aria-label={tr('Búsqueda de Anki para la gramática')} placeholder="deck:…" value={consultaGramatica} onInput={(ev) => fijarConsultaGramatica(ev.currentTarget.value)} />
              <input class="campo ap-campo-corto" aria-label={tr('Campo con el punto de gramática')} placeholder={tr('Campo')} value={campoGramatica} onInput={(ev) => fijarCampoGramatica(ev.currentTarget.value)} />
              <button class="btn" disabled={!campoGramatica} onClick={async () => {
                fijarMensaje({ texto: tr('Importando…') });
                try {
                  fijarMensaje({ texto: tr('{0} puntos de gramática importados.', await motor.importarGramaticaAnki(consultaGramatica, campoGramatica)) });
                } catch (err) {
                  fijarMensaje({ texto: err instanceof Error ? err.message : String(err), error: true });
                }
              }}>{tr('Importar')}</button>
            </div>
          </div>
        </>
      )}

      <Subtitulo>{tr('Relleno automático')}</Subtitulo>
      <p class="ayuda ap-subtitulo-ayuda">{tr('Lo que se añade solo al crear una tarjeta.')}</p>
      <div class="ap-grupo ap-prellenado">
        {PRELLENADO.map((g) => (
          <fieldset key={g.grupo}>
            <legend><b>{tr(g.grupo)}</b> {g.ayuda && <span class="ayuda">{tr(g.ayuda)}</span>}</legend>
            {g.items.map(([k, n]) => (
              <label key={k} class="ap-marca">
                <input class="ap-casilla" type="checkbox" checked={a.prellenado[k]} onChange={(ev) => cambiar({ prellenado: { ...a.prellenado, [k]: ev.currentTarget.checked } })} />
                {tr(n)}
              </label>
            ))}
          </fieldset>
        ))}
      </div>
    </Seccion>
  );
}

/** La voz del navegador para esta lengua: la mejor por omisión, u otra de las que ofrezca, con un botón para oírla. */
function VozDelNavegador({ a, cambiar }: PropsSeccion) {
  const [voces, fijarVoces] = useState<SpeechSynthesisVoice[] | null>(null);
  useEffect(() => {
    let vigente = true;
    const leer = () => {
      vocesDeLaLengua().then((v) => vigente && fijarVoces(v)).catch(() => vigente && fijarVoces([]));
    };
    leer();
    speechSynthesis.addEventListener('voiceschanged', leer);
    return () => {
      vigente = false;
      speechSynthesis.removeEventListener('voiceschanged', leer);
    };
  }, [a.idiomaObjetivo, a.formatoLectura]);
  const mejor = voces?.[0];
  // La primera frase del texto de ejemplo de la lengua, partida con sus propias reglas.
  const ejemplo = lengua.value.ejemplos.texto.split(lengua.value.escritura.frase.partir).find((f) => f.trim()) ?? lengua.value.ejemplos.palabra;
  return (
    <Opcion
      titulo={tr('Voz del navegador')}
      ayuda={voces && !voces.length ? tr('Este navegador no tiene voces para esta lengua.') : tr('Sin clave de Azure se lee con ella. Las voces «Natural» de Edge y las de Google en Chrome suenan mejor que las de Windows.')}
    >
      <span class="ap-acciones-fila">
        <select class="campo ap-campo-medio" aria-label={tr('Voz del navegador')} value={a.vozNavegador} onChange={(e) => cambiar({ vozNavegador: e.currentTarget.value })}>
          <option value="">{mejor ? tr('Automática: {0}', nombreCorto(mejor.name)) : tr('Automática')}</option>
          {voces?.map((v) => (
            <option key={v.name} value={v.name}>{v.localService ? nombreCorto(v.name) : tr('{0}, en línea', nombreCorto(v.name))}</option>
          ))}
        </select>
        <button class="btn chico fantasma" disabled={!voces?.length} onClick={() => decirConNavegador(ejemplo, a.vozNavegador).catch(() => {})}><Icono n="reproducir" t={14} /> {tr('Probar')}</button>
      </span>
    </Opcion>
  );
}

/** Dónde se descarga AivisSpeech: el programa de voz local que se recomienda. */
const URL_AIVISSPEECH = 'https://aivis-project.com/';

/**
 * La voz japonesa local: AivisSpeech o VOICEVOX en este equipo. Kotonoha los busca solo; se activa, se elige la voz y se
 * prueba aquí. Lee con el acento del diccionario, gratis y sin que nada salga del equipo.
 */
/** Las voces de Kokoro que se ofrecen para el inglés: las mejor valoradas por quienes la hicieron. */
const VOCES_KOKORO: { id: string; nombre: string }[] = [
  { id: 'af_heart', nombre: tm('Heart (mujer, Estados Unidos)') },
  { id: 'af_bella', nombre: tm('Bella (mujer, Estados Unidos)') },
  { id: 'am_michael', nombre: tm('Michael (hombre, Estados Unidos)') },
  { id: 'am_fenrir', nombre: tm('Fenrir (hombre, Estados Unidos)') },
  { id: 'bf_emma', nombre: tm('Emma (mujer, Reino Unido)') },
  { id: 'bm_george', nombre: tm('George (hombre, Reino Unido)') },
];

/** Kokoro para el inglés y Piper para el alemán, en el propio equipo: sin clave ni programa aparte. */
function VozNeuronal({ a, cambiar }: PropsSeccion) {
  const [probando, fijarProbando] = useState(false);
  const [error, fijarError] = useState('');
  const aleman = lengua.value.id === 'de';
  const fijar = (cambios: Partial<AjustesVozNeuronal>) => cambiar({ vozNeuronal: { ...a.vozNeuronal, ...cambios } });
  const ejemplo = lengua.value.ejemplos.texto.split(lengua.value.escritura.frase.partir).find((f) => f.trim()) ?? lengua.value.ejemplos.palabra;
  const probar = async () => {
    fijarProbando(true);
    fijarError('');
    try {
      await new Audio(`data:audio/mpeg;base64,${await motor.vozFrase(ejemplo, a.vocesFrase[0])}`).play();
    } catch (e) {
      fijarError(e instanceof Error ? e.message : String(e));
    } finally {
      fijarProbando(false);
    }
  };
  return (
    <Opcion
      titulo={tr('Voz neuronal en el navegador')}
      ayuda={
        aleman
          ? tr('Piper, con la voz de Thorsten, lee el alemán en tu equipo, sin clave ni programas aparte. La primera vez se descargan 63 MB.')
          : tr('Kokoro lee el inglés en tu equipo, sin clave ni programas aparte, con voces muy naturales. La primera vez se descargan 92 MB, y cada frase nueva tarda unos segundos; después queda guardada.')
      }
    >
      <span class="ap-acciones-fila">
        <Interruptor etiqueta={tr('Leer las frases con la voz neuronal')} on={a.vozNeuronal.activa} alCambiar={(v) => fijar({ activa: v })} />
        {!aleman && (
          <select class="campo ap-campo-medio" aria-label={tr('Voz de Kokoro')} value={a.vozNeuronal.vozIngles} onChange={(e) => fijar({ vozIngles: e.currentTarget.value })}>
            {VOCES_KOKORO.map((v) => (
              <option key={v.id} value={v.id}>{tr(v.nombre)}</option>
            ))}
          </select>
        )}
        <button class="btn chico fantasma" aria-label={tr('Probar la voz neuronal')} disabled={!a.vozNeuronal.activa || probando} onClick={() => void probar()}><Icono n="reproducir" t={14} /> {probando ? tr('Preparando…') : tr('Probar')}</button>
      </span>
      {error && <span class="texto-error">{error}</span>}
    </Opcion>
  );
}

function VozLocal({ a, cambiar }: PropsSeccion) {
  const [motores, fijarMotores] = useState<MotorVozLocal[] | null>(null);
  const [probando, fijarProbando] = useState(false);
  const [error, fijarError] = useState('');
  // Solo vale la última búsqueda: una anterior, con otra dirección, puede contestar después.
  const busqueda = useRef(0);
  const buscar = () => {
    const esta = ++busqueda.current;
    fijarMotores(null);
    motor
      .motoresVoz(a.vozLocal.url)
      .catch(() => [])
      .then((m) => esta === busqueda.current && fijarMotores(m));
  };
  useEffect(buscar, [a.vozLocal.url]);
  const hallado = motores?.[0];
  const estilos = hallado?.voces.flatMap((v) => v.estilos.map((e) => ({ id: e.id, nombre: `${v.nombre} · ${e.nombre}` }))) ?? [];
  const fijar = (cambios: Partial<AjustesVozLocal>) => cambiar({ vozLocal: { ...a.vozLocal, ...cambios } });
  const ejemplo = lengua.value.ejemplos.texto.split(lengua.value.escritura.frase.partir).find((f) => f.trim()) ?? lengua.value.ejemplos.palabra;
  const probar = async () => {
    fijarProbando(true);
    fijarError('');
    try {
      await new Audio(`data:audio/mpeg;base64,${await motor.vozFrase(ejemplo, a.vocesFrase[0])}`).play();
    } catch (e) {
      fijarError(e instanceof Error ? e.message : String(e));
    } finally {
      fijarProbando(false);
    }
  };
  const estado = !motores
    ? tr('Buscando AivisSpeech o VOICEVOX en este equipo…')
    : hallado
      ? tr('{0} {1}, en {2}. Lee las frases con el acento del diccionario, sin que nada salga del equipo.', hallado.nombre, hallado.version, hallado.url)
      : tr('No se encontró ninguna. Instala AivisSpeech, que es gratis, y ábrelo: Kotonoha lo encuentra solo.');
  return (
    <>
      <Opcion titulo={tr('Voz local')} ayuda={estado}>
        <span class="ap-acciones-fila">
          <Interruptor etiqueta={tr('Leer las frases con la voz local')} on={a.vozLocal.activa} alCambiar={(v) => fijar({ activa: v })} />
          {motores && !hallado && (
            <a class="btn chico fantasma" href={URL_AIVISSPEECH} target="_blank" rel="noreferrer"><Icono n="externo" t={14} /> {tr('Descargar AivisSpeech')}</a>
          )}
          <button class="btn chico fantasma" disabled={!motores} onClick={buscar}><Icono n="recargar" t={14} /> {tr('Buscar otra vez')}</button>
        </span>
      </Opcion>
      {hallado && (
        <Opcion titulo={tr('Voz y estilo')}>
          <span class="ap-acciones-fila">
            <select class="campo ap-campo-medio" aria-label={tr('Voz y estilo')} value={a.vozLocal.estilo ?? estilos[0]?.id ?? ''} onChange={(e) => fijar({ estilo: Number(e.currentTarget.value) })}>
              {estilos.map((e) => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </select>
            <button class="btn chico fantasma" aria-label={tr('Probar la voz local')} disabled={!a.vozLocal.activa || probando} onClick={() => void probar()}><Icono n="reproducir" t={14} /> {probando ? tr('Preparando…') : tr('Probar')}</button>
          </span>
          {error && <span class="texto-error">{error}</span>}
        </Opcion>
      )}
      <Opcion titulo={tr('Acento del diccionario')} ayuda={tr('Antes de leer, corrige el acento de cada palabra con el del diccionario de acento: la voz dice lo que el diccionario dice, no lo que adivina.')}>
        <Interruptor etiqueta={tr('Acento del diccionario')} on={a.vozLocal.acentoDiccionario} alCambiar={(v) => fijar({ acentoDiccionario: v })} />
      </Opcion>
      <Opcion titulo={tr('Dirección de la voz local')} ayuda={tr('Vacía, se busca en los puertos de AivisSpeech (10101) y de VOICEVOX (50021).')}>
        <input class="campo ap-campo-medio" aria-label={tr('Dirección de la voz local')} placeholder="http://127.0.0.1:10101" value={a.vozLocal.url} onChange={(e) => fijar({ url: e.currentTarget.value.trim() })} />
      </Opcion>
    </>
  );
}

function SeccionVoces({ a, cambiar }: PropsSeccion) {
  const VOCES = lengua.value.voces.map((v) => [v.id, tr(v.nombre)]);
  return (
    <Seccion id="voces" icono="voz" titulo={tr('Voces')} descripcion={tr('Para frases sin audio del video. Azure Speech ofrece medio millón de caracteres gratis al mes con tu propia cuenta. Sin clave se usa la voz del navegador, que no se puede guardar en tarjetas.')}>
      <div class="ap-grupo">
        {lengua.value.id === 'ja' && <VozLocal a={a} cambiar={cambiar} />}
        {(lengua.value.id === 'en' || lengua.value.id === 'de') && <VozNeuronal a={a} cambiar={cambiar} />}
        <VozDelNavegador a={a} cambiar={cambiar} />
        <Opcion titulo={tr('Clave de Azure Speech')}>
          <input class="campo ap-campo-medio" type="password" autocomplete="off" aria-label={tr('Clave de Azure Speech')} placeholder={tr('Clave')} value={a.azureClave} onInput={(e) => cambiar({ azureClave: e.currentTarget.value.trim() })} />
        </Opcion>
        <Opcion titulo={tr('Región')}>
          <input class="campo ap-campo-corto" aria-label={tr('Región de Azure')} placeholder="eastus" value={a.azureRegion} onInput={(e) => cambiar({ azureRegion: e.currentTarget.value.trim() })} />
        </Opcion>
        <Opcion titulo={tr('Voces de las frases')} ayuda={tr('Hasta tres.')}>
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
  const [copiando, fijarCopiando] = useState<string | null>(null);
  const textoResumen = (r: ResumenCopia) => tr('libros: {0}; libros con texto del OCR: {1}; dictados: {2}.', r.libros, r.librosConOcr, r.dictados);
  const copiaCompleta = async (restaurar: boolean) => {
    fijarMensaje(null);
    fijarCopiando(tr('Preparando…'));
    try {
      if (restaurar) {
        const { ajustes, resumen } = await restaurarCopiaCompleta(fijarCopiando);
        if (ajustes) cambiar(ajustes);
        fijarMensaje({ texto: `${tr('Copia completa restaurada:')} ${textoResumen(resumen)}` });
      } else {
        const { carpeta, resumen } = await exportarCopiaCompleta(a, fijarCopiando);
        fijarMensaje({ texto: `${tr('Copia completa guardada en la carpeta «{0}»:', carpeta)} ${textoResumen(resumen)}` });
      }
    } catch (err) {
      // Cerrar el selector de carpetas sin elegir ninguna no es un error.
      if (!(err instanceof DOMException && err.name === 'AbortError')) fijarMensaje({ texto: err instanceof Error ? err.message : String(err), error: true });
    } finally {
      fijarCopiando(null);
    }
  };
  return (
    <Seccion id="datos" icono="carpeta" titulo={tr('Tus datos')} descripcion={tr('Todo se guarda en este navegador. Haz copias de vez en cuando para no perder tus palabras.')}>
      <div class="ap-grupo">
        <Opcion titulo={tr('Copia de seguridad')} ayuda={tr('Palabras, tarjetas, biblioteca y ajustes en un archivo. Las claves de API no se guardan.')}>
          <span class="ap-botones">
            <button class="btn chico" onClick={async () => {
              const json = await motor.exportarDatos(a);
              const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
              const v = document.createElement('a');
              v.href = url;
              v.download = `kotonoha-copia-${new Date().toISOString().slice(0, 10)}.json`;
              v.click();
              URL.revokeObjectURL(url);
            }}><Icono n="descargar" t={14} /> {tr('Exportar')}</button>
            <button class="btn chico" onClick={() => entrada.current?.click()}><Icono n="subir" t={14} /> {tr('Restaurar')}</button>
          </span>
          <input ref={entrada} type="file" accept=".json" hidden aria-label={tr('Restaurar copia')} onChange={async (e) => {
            const f = e.currentTarget.files?.[0];
            if (!f) return;
            try {
              const ajustes = await motor.importarDatos(await f.text());
              if (ajustes) cambiar(ajustes);
              fijarMensaje({ texto: tr('Copia restaurada.') });
            } catch (err) {
              fijarMensaje({ texto: err instanceof Error ? err.message : String(err), error: true });
            }
          }} />
        </Opcion>
        {hayCopiaCompleta() && (
          <Opcion
            titulo={tr('Copia completa')}
            ayuda={copiando ? <span role="status">{copiando}</span> : tr('Lo anterior más los archivos de los libros, el texto del OCR y los dictados, en una carpeta. Sirve para pasar Kotonoha a otro equipo o a otra copia. Las claves de API no se guardan.')}
          >
            <span class="ap-botones">
              <button class="btn chico" disabled={!!copiando} onClick={() => void copiaCompleta(false)}><Icono n="descargar" t={14} /> {tr('Exportar a una carpeta')}</button>
              <button class="btn chico" disabled={!!copiando} onClick={() => void copiaCompleta(true)}><Icono n="subir" t={14} /> {tr('Restaurar de una carpeta')}</button>
            </span>
          </Opcion>
        )}
        <Opcion titulo={tr('Guardar las frases que ves')} ayuda={tr('Sirven para buscar ejemplos de lo que ya conoces.')}>
          <Interruptor etiqueta={tr('Guardar historial')} on={a.guardarHistorial} alCambiar={(v) => cambiar({ guardarHistorial: v })} />
        </Opcion>
      </div>
      {mensaje && <Mensaje error={mensaje.error}>{mensaje.texto}</Mensaje>}
    </Seccion>
  );
}

function SeccionAtajos({ a, cambiar }: PropsSeccion) {
  const [grabando, fijarGrabando] = useState<string | null>(null);
  const [aviso, fijarAviso] = useState('');
  useEffect(() => {
    if (!grabando) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (['Alt', 'Shift', 'Control', 'Meta', 'AltGraph'].includes(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        fijarGrabando(null);
        return;
      }
      const nueva = textoCombinacion({ k: teclaLatina(e), alt: e.altKey, shift: e.shiftKey, ctrl: e.ctrlKey });
      const ocupada = ACCIONES_TECLADO.find((x) => x.id !== grabando && (a.atajosPersonales[x.id] ?? x.defecto) === nueva);
      if (ocupada) {
        fijarAviso(tr('Esa combinación ya es de «{0}».', tr(nombreAccion(ocupada, lengua.value.textos))));
        return;
      }
      fijarAviso('');
      fijarGrabando(null);
      const accion = ACCIONES_TECLADO.find((x) => x.id === grabando);
      const resto = { ...a.atajosPersonales };
      if (accion?.defecto === nueva) delete resto[grabando];
      else resto[grabando] = nueva;
      cambiar({ atajosPersonales: resto });
    };
    window.addEventListener('keydown', alPulsar, true);
    return () => window.removeEventListener('keydown', alPulsar, true);
  }, [grabando, a.atajosPersonales]);
  const grupos = [...new Set(ACCIONES_TECLADO.map((x) => x.grupo))];
  return (
    <Seccion id="atajos" icono="teclado" titulo={tr('Atajos de teclado')} descripcion={tr('Sobre el video. Cámbialos a tu gusto o según tu teclado. Los que usan Chrome, como la captura de audio, se cambian en la página de atajos del navegador.')}>
      {aviso && <Mensaje error>{aviso}</Mensaje>}
      {grupos.map((g) => (
        <div key={g}>
          <Subtitulo>{tr(g)}</Subtitulo>
          <div class="ap-grupo">
            {ACCIONES_TECLADO.filter((x) => x.grupo === g).map((x) => {
              const actual = a.atajosPersonales[x.id] ?? x.defecto;
              const cambiado = actual !== x.defecto;
              return (
                <div class="ap-opcion" key={x.id}>
                  <div class="ap-opcion-texto"><b>{tr(nombreAccion(x, lengua.value.textos))}</b></div>
                  <div class="ap-opcion-control ap-apretado">
                    <button class={`btn chico ${grabando === x.id ? 'primario' : ''}`} onClick={() => { fijarAviso(''); fijarGrabando(grabando === x.id ? null : x.id); }}>
                      {grabando === x.id ? tr('Pulsa una tecla…') : mostrarCombinacion(actual)}
                    </button>
                    {cambiado && (
                      <button class="btn-icono chico" aria-label={tr('Restablecer {0}', tr(x.nombre))} data-tip={tr('Restablecer')} data-tip-lado="izq" onClick={() => {
                        const resto = { ...a.atajosPersonales };
                        delete resto[x.id];
                        cambiar({ atajosPersonales: resto });
                      }}><Icono n="historial" t={14} /></button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div class="ap-botones ap-tras-grupo">
        <button class="btn chico fantasma" onClick={() => fondo.abrirAtajos()}>{tr('Atajos de Chrome')} <Icono n="externo" t={13} /></button>
      </div>
    </Seccion>
  );
}

/** La versión de esta copia y los avisos de versiones nuevas en GitHub. */
function SeccionVersion({ a, cambiar }: PropsSeccion) {
  const [estado, fijarEstado] = useState<{ fase: 'nada' | 'buscando' | 'al-dia' | 'error' } | { fase: 'nueva'; nueva: VersionPublicada }>({ fase: 'nada' });
  const buscar = async () => {
    fijarEstado({ fase: 'buscando' });
    try {
      const nueva = await buscarVersionNueva(true);
      fijarEstado(nueva ? { fase: 'nueva', nueva } : { fase: 'al-dia' });
    } catch {
      fijarEstado({ fase: 'error' });
    }
  };
  const actualizacion = useActualizacion(estado.fase === 'nueva' ? estado.nueva.version : null);
  const resultado =
    estado.fase === 'buscando' ? tr('Buscando…')
    : estado.fase === 'al-dia' ? tr('Tienes la última versión.')
    : estado.fase === 'error' ? tr('No se pudo consultar GitHub. Comprueba la conexión.')
    : estado.fase === 'nueva' ? `${tr('Hay una versión nueva: {0}.', estado.nueva.version)} ${actualizacion.texto}`
    : tr('Comprueba ahora si hay una versión nueva.');
  return (
    <Seccion id="version" icono="sello" titulo={tr('Versión')} descripcion={tr('Tienes Kotonoha {0}.', versionInstalada())}>
      <div class="ap-grupo">
        <Opcion titulo={tr('Avisar de versiones nuevas')} ayuda={tr('Una vez al día, Kotonoha pregunta a GitHub cuál es la última versión publicada. Si es más nueva, lo dice en Inicio y en el menú de la extensión.')}>
          <Interruptor etiqueta={tr('Avisar de versiones nuevas')} on={a.avisarVersiones} alCambiar={(v) => cambiar({ avisarVersiones: v })} />
        </Opcion>
        <Opcion titulo={tr('Buscar una versión nueva')} ayuda={<span role="status">{resultado}</span>}>
          <span class="ap-acciones-fila">
            <button class="btn chico" disabled={estado.fase === 'buscando'} onClick={() => void buscar()}>{tr('Buscar')}</button>
            <BotonActualizar a={actualizacion} />
            <a class="btn chico fantasma" href={estado.fase === 'nueva' ? estado.nueva.url : URL_ULTIMA_VERSION} target="_blank" rel="noreferrer noopener">{tr('Ver en GitHub')} <Icono n="externo" t={13} /></a>
          </span>
        </Opcion>
      </div>
    </Seccion>
  );
}

const SECCIONES: { id: string; nombre: string; icono: NombreIcono }[] = [
  { id: 'idioma', nombre: tm('Idioma y nivel'), icono: 'nivel' },
  { id: 'apariencia', nombre: tm('Apariencia'), icono: 'paleta' },
  { id: 'lector', nombre: tm('Lector de páginas'), icono: 'lector' },
  { id: 'atajos', nombre: tm('Atajos de teclado'), icono: 'teclado' },
  { id: 'claude', nombre: tm('Claude'), icono: 'ia' },
  { id: 'proveedores', nombre: tm('Otros proveedores de IA'), icono: 'ia' },
  { id: 'diccionarios', nombre: tm('Diccionarios'), icono: 'diccionario' },
  { id: 'transcripcion', nombre: tm('Transcripción'), icono: 'ondas' },
  { id: 'anki', nombre: tm('Tarjetas y Anki'), icono: 'tarjetas' },
  { id: 'voces', nombre: tm('Voces'), icono: 'voz' },
  { id: 'prompts', nombre: tm('Prompts'), icono: 'nota-lapiz' },
  { id: 'datos', nombre: tm('Tus datos'), icono: 'carpeta' },
  { id: 'version', nombre: tm('Versión'), icono: 'sello' },
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
      <Cabecera titulo={tr('Ajustes')} />
      <div class="ap-ajustes-cuerpo">
        <nav class="ap-subnav" aria-label={tr('Secciones de ajustes')}>
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
              <Icono n={s.icono} t={17} /> {tr(s.nombre)}
            </button>
          ))}
        </nav>
        <div class="ap-ajustes-secciones">
          <SeccionIdioma a={a} cambiar={cambiar} />
          <SeccionApariencia a={a} cambiar={cambiar} />
          <SeccionLector a={a} cambiar={cambiar} />
          <SeccionAtajos a={a} cambiar={cambiar} />
          <SeccionClaude a={a} cambiar={cambiar} />
          <SeccionProveedores a={a} cambiar={cambiar} />
          <SeccionDiccionarios a={a} cambiar={cambiar} />
          <SeccionTranscripcion a={a} cambiar={cambiar} />
          <SeccionAnki a={a} cambiar={cambiar} />
          <SeccionVoces a={a} cambiar={cambiar} />
          <SeccionPrompts a={a} cambiar={cambiar} />
          <SeccionDatos a={a} cambiar={cambiar} />
          <SeccionVersion a={a} cambiar={cambiar} />
        </div>
      </div>
    </div>
  );
}
