// Paneles flotantes de la isla: visualización, video, atajos, generación, traductor y comprensión.

import { signal, useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import type { Ajustes, ConfigModo, DisparadorPausa, IdModo, ModeloWhisper, ModoVelo, ObjetivoFrase, RevelarEnPausa } from '../compartido/ajustes';
import { MODELOS_WHISPER, NOMBRES_MODO } from '../compartido/ajustes';
import { flujoMotor, fondo } from '../compartido/rpc';
import { NOMBRES_NIVEL, palabrasPrioritarias } from '../nucleo/frases';
import { Icono, type NombreIcono } from '../ui/iconos';
import {
  ajustarDesfase,
  cancelarGeneracion,
  detenerWhisper,
  pausarWhisper,
  exportarSrt,
  actualizarAyudante,
  cancelarCorreccion,
  corregirSubtitulos,
  generarSecundarios,
  traducirAlJapones,
  iniciarAnalisisProfundo,
  iniciarWhisper,
  importarArchivo,
  irALinea,
  nombreIdioma,
  reiniciarSincronia,
  seleccionarObjetivo,
  seleccionarSecundaria,
} from './controlador';
import { ajustes, analisisEnCurso, anclas, ayudante, capturaActiva, correccion, estadisticas, generacion, idObjetivo, infoVideo, originales, idSecundaria, lineasObjetivo, lineasSecundarias, panel, pistas, sincronias, transcribeArchivo, whisper } from './estado';
import { cambiarAjuste } from './Reproductor';

/** Anillo de progreso: comprensión del video, avance de una tarea de Claude. */
export function Anillo({ valor, t = 36, grosor = 3.5, clase = '', children }: { valor: number; t?: number; grosor?: number; clase?: string; children?: preact.ComponentChildren }) {
  const r = (t - grosor) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, valor));
  return (
    <span class={`anillo ${clase}`} style={{ width: `${t}px`, height: `${t}px` }}>
      <svg width={t} height={t} viewBox={`0 0 ${t} ${t}`} aria-hidden="true">
        <circle class="anillo-fondo" cx={t / 2} cy={t / 2} r={r} fill="none" stroke-width={grosor} />
        <circle class="anillo-valor" cx={t / 2} cy={t / 2} r={r} fill="none" stroke-width={grosor} stroke-linecap="round" stroke-dasharray={c} stroke-dashoffset={c * (1 - v / 100)} transform={`rotate(-90 ${t / 2} ${t / 2})`} />
      </svg>
      {children !== undefined && <span class="anillo-centro">{children}</span>}
    </span>
  );
}

function Interruptor({ on, alCambiar, etiqueta }: { on: boolean; alCambiar: (v: boolean) => void; etiqueta: string }) {
  return <button class={`interruptor ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={etiqueta} onClick={() => alCambiar(!on)} />;
}

const FLECHAS: Record<string, NombreIcono> = { '←': 'flecha-izq', '→': 'flecha', '↑': 'flecha-arriba', '↓': 'flecha-abajo' };

function Teclas({ t }: { t: string[] }) {
  return (
    <span class="teclas">
      {t.map((x, i) =>
        x === '+' || x === '/' ? (
          <span key={i} class={`sep ${x === '+' ? 'mas' : ''}`}>{x}</span>
        ) : (
          <kbd class="tecla" key={i} aria-label={FLECHAS[x] ? x : undefined}>{FLECHAS[x] ? <Icono n={FLECHAS[x]} t={11} /> : x}</kbd>
        )
      )}
    </span>
  );
}

function Cabecera({ titulo, icono, detalle, ia }: { titulo: string; icono: NombreIcono; detalle?: string; ia?: boolean }) {
  return (
    <div class="panel-cab">
      <span class={`hoja-icono chica ${ia ? 'ia' : ''}`}><Icono n={icono} t={18} /></span>
      <h3>{titulo}{detalle && <small>{detalle}</small>}</h3>
      <button class="btn-icono chico" aria-label="Cerrar panel" onClick={() => (panel.value = null)}><Icono n="cerrar" t={16} /></button>
    </div>
  );
}

function Fila({ etq, ayuda, teclas, children }: { etq: string; ayuda?: string; teclas?: string[]; children: preact.ComponentChildren }) {
  return (
    <div class="fila">
      <span class="etq">
        {ayuda ? <span class="etq-doble">{etq}<small>{ayuda}</small></span> : etq}
        {teclas && <Teclas t={teclas} />}
      </span>
      {children}
    </div>
  );
}

function Selector<T extends string>({ valor, opciones, alCambiar, etiqueta }: { valor: T; opciones: [T, string][]; alCambiar: (v: T) => void; etiqueta: string }) {
  return (
    <select class="selector" aria-label={etiqueta} value={valor} onChange={(e) => alCambiar(e.currentTarget.value as T)}>
      {opciones.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
    </select>
  );
}

function Paso({ valor, paso, min, max, alCambiar, unidad = '', etiqueta }: { valor: number; paso: number; min?: number; max?: number; alCambiar: (v: number) => void; unidad?: string; etiqueta: string }) {
  const lim = (v: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));
  return (
    <span class="paso">
      <button aria-label={`Reducir ${etiqueta}`} onClick={() => alCambiar(lim(valor - paso))}><Icono n="menos" t={14} /></button>
      <span>{valor}{unidad}</span>
      <button aria-label={`Aumentar ${etiqueta}`} onClick={() => alCambiar(lim(valor + paso))}><Icono n="mas" t={14} /></button>
    </span>
  );
}

function TituloGrupo({ children, icono, ia }: { children: preact.ComponentChildren; icono?: NombreIcono; ia?: boolean }) {
  return <div class={`titulo-grupo ${ia ? 'ia' : ''}`}>{icono && <Icono n={icono} t={14} />}{children}</div>;
}

const claseNavegador = () => (ajustes.value.navegadorAbierto ? 'con-nav' : '');

// ---------- Visualización ----------

function PanelVisual() {
  const a = ajustes.value;
  return (
    <div class={`panel-flotante panel-visual ${claseNavegador()}`} role="dialog" aria-label="Ajustes de visualización">
      <Cabecera titulo="Visualización" icono="ojo" />
      <div class="grupo">
        <Fila etq="Estado de aprendizaje" teclas={['Alt', '+', 'L']}>
          <Interruptor on={a.mostrarEstado} etiqueta="Estado de aprendizaje" alCambiar={(v) => cambiarAjuste({ mostrarEstado: v })} />
        </Fila>
        <div class="leyenda">
          <span><i class="p-desconocida" />Desconocida</span>
          <span><i class="p-aprendiendo" />Aprendiendo</span>
          <span><i class="p-rastreada" />Rastreada</span>
        </div>
      </div>
      <TituloGrupo>Sobre cada palabra</TituloGrupo>
      <div class="grupo">
        <Fila etq="Furigana">
          <Selector etiqueta="Furigana" valor={a.furigana} opciones={[['ninguna', 'Ninguna'], ['todas', 'Todas las palabras'], ['desconocidas', 'Desconocidas'], ['alPasar', 'Al pasar el ratón']]} alCambiar={(v) => cambiarAjuste({ furigana: v })} />
        </Fila>
        <Fila etq="Traducción de palabras">
          <Selector etiqueta="Traducción de palabras" valor={a.glosas} opciones={[['ninguna', 'Ninguna'], ['desconocidas', 'Desconocidas'], ['alPasar', 'Al pasar el ratón']]} alCambiar={(v) => cambiarAjuste({ glosas: v })} />
        </Fila>
        <Fila etq="Color de acento" teclas={['Alt', '+', 'C']}>
          <Selector etiqueta="Color de acento" valor={a.colorAcento} opciones={[['ninguno', 'Ninguno'], ['alPasar', 'Al pasar el ratón'], ['siempre', 'Siempre']]} alCambiar={(v) => cambiarAjuste({ colorAcento: v })} />
        </Fila>
        <div class="leyenda">
          <span class="ac-heiban">Heiban</span>
          <span class="ac-atamadaka">Atamadaka</span>
          <span class="ac-nakadaka">Nakadaka</span>
          <span class="ac-odaka">Odaka</span>
        </div>
      </div>
      <TituloGrupo>Análisis</TituloGrupo>
      <div class="grupo">
        <Fila etq="Mostrar gramática" ayuda="Puntos gramaticales bajo cada línea">
          <Interruptor on={a.mostrarGramatica} etiqueta="Mostrar gramática" alCambiar={(v) => cambiarAjuste({ mostrarGramatica: v })} />
        </Fila>
        <Fila etq="Partículas como conocidas">
          <Interruptor on={a.particulasConocidas} etiqueta="Partículas como conocidas" alCambiar={(v) => cambiarAjuste({ particulasConocidas: v })} />
        </Fila>
        <Fila etq="Buscar compuestos" ayuda="Palabras formadas con la siguiente">
          <Interruptor on={a.busquedaCompuesta} etiqueta="Buscar compuestos" alCambiar={(v) => cambiarAjuste({ busquedaCompuesta: v })} />
        </Fila>
      </div>
    </div>
  );
}

// ---------- Video ----------

export type PestanaVideo = 'reproduccion' | 'subtitulos' | 'sincronia' | 'interaccion';
/** Pestaña abierta del panel de video. Se puede fijar desde fuera para abrirlo en un punto concreto. */
export const pestanaVideo = signal<PestanaVideo>('reproduccion');

const PESTANAS_VIDEO: [PestanaVideo, string, NombreIcono][] = [
  ['reproduccion', 'Reproducción', 'reproducir'],
  ['subtitulos', 'Subtítulos', 'subtitulos'],
  ['sincronia', 'Sincronizar', 'reloj'],
  ['interaccion', 'Interacción', 'cursor'],
];

const MODOS_ORDEN: IdModo[] = ['normal', 'escuchaPreparada', 'lecturaIntensiva', 'escuchaIntensiva', 'hibridoIntensivo', 'alPausar', 'enfoque1d', 'personalizado'];

const ICONO_MODO: Record<IdModo, NombreIcono> = {
  normal: 'reproducir',
  escuchaPreparada: 'oido',
  lecturaIntensiva: 'libro',
  escuchaIntensiva: 'ondas',
  hibridoIntensivo: 'intercambiar',
  alPausar: 'pausa',
  enfoque1d: 'objetivo',
  personalizado: 'controles',
};

const OBJETIVOS: [ObjetivoFrase, string][] = [
  ['todas', 'Todas las frases'],
  ['1d', 'Una palabra desconocida (1D)'],
  ['recomendadas', 'Recomendadas'],
  ['desconocidas', 'Con palabras desconocidas'],
  ['rastreadas', 'Con palabras rastreadas'],
  ['aprendiendo', 'Con palabras en aprendizaje'],
  ['2mas', 'Con 2 o más desconocidas'],
  ['conocidas', 'Todas conocidas'],
];

const REVELAR: [RevelarEnPausa, string][] = [
  ['manual', 'Pausa manual'],
  ['auto', 'Pausa automática'],
  ['primeraAuto', 'Primera pausa automática'],
  ['primeraAutoYDurante', 'Primera pausa y durante la reproducción'],
  ['segundaAuto', 'Segunda pausa automática'],
  ['cualquiera', 'Cualquier pausa'],
];

function Marcas<T extends string>({ opciones, valor, alCambiar }: { opciones: [T, string][]; valor: T[]; alCambiar: (v: T[]) => void }) {
  return (
    <div class="casillas">
      {opciones.map(([v, n]) => (
        <label key={v} class="casilla">
          <input type="checkbox" checked={valor.includes(v)} onChange={(e) => alCambiar(e.currentTarget.checked ? [...valor, v] : valor.filter((x) => x !== v))} />
          {n}
        </label>
      ))}
    </div>
  );
}

function ControlVelo({ titulo, clave, cfg, alCambiar }: { titulo: string; clave: 'velarObjetivo' | 'velarSecundario'; cfg: ConfigModo; alCambiar: (c: ConfigModo) => void }) {
  const v = cfg[clave];
  const set = (c: Partial<typeof v>) => alCambiar({ ...cfg, [clave]: { ...v, ...c } });
  return (
    <>
      <Fila etq={titulo}>
        <div class="segmentado" role="radiogroup" aria-label={titulo}>
          {([['no', 'No'], ['difuminar', 'Difuminar'], ['ocultar', 'Ocultar']] as [ModoVelo, string][]).map(([m, n]) => (
            <button key={m} role="radio" aria-checked={v.modo === m} class={v.modo === m ? 'activo' : ''} onClick={() => set({ modo: m })}>{n}</button>
          ))}
        </div>
      </Fila>
      {v.modo !== 'no' && (
        <div class="velo-opciones">
          <div class="ayuda velo-titulo">Revelar según la pausa</div>
          <Marcas opciones={REVELAR} valor={v.revelarEnPausa} alCambiar={(r) => set({ revelarEnPausa: r })} />
          <div class="ayuda velo-titulo">Revelar según la frase</div>
          <Marcas opciones={OBJETIVOS.filter(([o]) => o !== 'todas')} valor={v.revelarPorEstado} alCambiar={(r) => set({ revelarPorEstado: r })} />
          <div class="casillas">
            <label class="casilla">
              <input type="checkbox" checked={v.revelarAlPasar} onChange={(e) => set({ revelarAlPasar: e.currentTarget.checked })} />
              Revelar al pasar el ratón
            </label>
          </div>
        </div>
      )}
    </>
  );
}

function ControlPista({ titulo, icono, valor, idioma, alElegir, destino, puedeExportar }: { titulo: string; icono: NombreIcono; valor: string | null; idioma: string; alElegir: (id: string | null) => void; destino: 'objetivo' | 'secundaria'; puedeExportar: boolean }) {
  const entrada = useRef<HTMLInputElement>(null);
  const lista = pistas.value;
  const base = idioma.split('-')[0];
  const ordenadas = [...lista].sort((x, y) => Number(y.idioma.startsWith(base)) - Number(x.idioma.startsWith(base)));
  return (
    <div class="pista">
      <div class="pista-cab"><span class="hoja-icono chica"><Icono n={icono} t={17} /></span>{titulo}</div>
      <select class="selector ancho" aria-label={titulo} value={valor ?? ''} onChange={(e) => alElegir(e.currentTarget.value || null)}>
        <option value="">Ninguno</option>
        {ordenadas.map((p) => <option key={p.id} value={p.id}>{p.nombre}{p.automatica ? ' (automáticos)' : ''}</option>)}
      </select>
      <div class="pista-acciones">
        <button class="btn chico" onClick={() => entrada.current?.click()}><Icono n="archivo-subir" t={15} /> Importar</button>
        <button class="btn chico" disabled={!puedeExportar} onClick={() => exportarSrt(destino)}><Icono n="exportar" t={15} /> Exportar SRT</button>
        {destino === 'secundaria' && <button class="btn chico ia" disabled={!lineasObjetivo.value.length || !!generacion.value} onClick={() => generarSecundarios()}><Icono n="traducir" t={15} /> Traducir con Claude</button>}
      </div>
      <input ref={entrada} type="file" accept=".srt,.vtt,.ass,.ssa,.ttml,.dfxp,.xml" hidden aria-label={`Importar ${titulo}`} onChange={(e) => {
        const f = e.currentTarget.files?.[0];
        if (f) importarArchivo(f, destino);
        e.currentTarget.value = '';
      }} />
    </div>
  );
}

function ControlSincronia({ titulo, pista, disponible }: { titulo: string; pista: 'objetivo' | 'secundaria'; disponible: boolean }) {
  const s = sincronias.value[pista];
  const segundos = s.desfaseMs / 1000;
  return (
    <div class="sinc">
      <div class="sinc-cab">
        <b>{titulo}</b>
        <button class="btn-icono chico" title="Volver a cero" aria-label={`Restablecer sincronización de ${titulo}`} disabled={s.desfaseMs === 0 && s.escala === 1} onClick={() => reiniciarSincronia(pista)}><Icono n="historial" t={15} /></button>
      </div>
      <div class="sinc-valor">
        {segundos > 0 ? '+' : segundos < 0 ? '−' : ''}{Math.abs(segundos).toFixed(2)} s
        <small>{s.escala !== 1 ? `Velocidad ×${s.escala.toFixed(4)}` : s.desfaseMs === 0 ? 'Sin ajuste' : segundos > 0 ? 'Aparecen más tarde' : 'Aparecen antes'}</small>
      </div>
      <div class="sinc-botones">
        {[-1000, -100, 100, 1000].map((d) => (
          <button key={d} class="btn chico" disabled={!disponible} aria-label={`${titulo}: mover ${d} milisegundos`} onClick={() => ajustarDesfase(pista, d)}>{d > 0 ? '+' : '−'}{Math.abs(d) / 1000} s</button>
        ))}
      </div>
      <div class="sinc-pistas"><span>Más pronto</span><span>Más tarde</span></div>
    </div>
  );
}

function PanelVideo() {
  const a = ajustes.value;
  const personal = a.modoPersonalizado;
  const setPersonal = (c: ConfigModo) => cambiarAjuste({ modoPersonalizado: c });
  const p = pestanaVideo.value;
  return (
    <div class={`panel-flotante panel-video ${claseNavegador()}`} role="dialog" aria-label="Ajustes de video">
      <Cabecera titulo="Video y subtítulos" icono="subtitulos" />
      <div class="segmentado panel-pestanas" role="tablist" aria-label="Secciones">
        {PESTANAS_VIDEO.map(([id, nombre, icono]) => (
          <button key={id} role="tab" aria-selected={p === id} class={p === id ? 'activo' : ''} onClick={() => (pestanaVideo.value = id)}><Icono n={icono} t={15} /> {nombre}</button>
        ))}
      </div>

      {p === 'reproduccion' && (
        <>
          <div class="modos" role="radiogroup" aria-label="Modo de reproducción">
            {MODOS_ORDEN.map((m) => (
              <button key={m} role="radio" aria-checked={a.modo === m} class={`modo ${a.modo === m ? 'activo' : ''}`} onClick={() => cambiarAjuste({ modo: m })}>
                <span class="modo-icono"><Icono n={ICONO_MODO[m]} t={22} /></span>
                <b>{NOMBRES_MODO[m].titulo}</b>
                <span class="modo-texto">{NOMBRES_MODO[m].descripcion}</span>
              </button>
            ))}
          </div>
          {a.modo === 'personalizado' && (
            <div class="grupo modo-personal">
              <div class="ayuda velo-titulo">Pausar automáticamente en</div>
              <Marcas opciones={OBJETIVOS} valor={personal.objetivosPausa} alCambiar={(o) => setPersonal({ ...personal, objetivosPausa: o })} />
              <Fila etq="Momento de la pausa">
                <Selector<DisparadorPausa> etiqueta="Momento de la pausa" valor={personal.disparador} opciones={[['ninguno', 'Nunca'], ['antes', 'Antes de la frase'], ['despues', 'Después de la frase'], ['antesYDespues', 'Antes y después'], ['rebobinar', 'Retroceder y pausar']]} alCambiar={(d) => setPersonal({ ...personal, disparador: d })} />
              </Fila>
              <ControlVelo titulo="Velo sobre el japonés" clave="velarObjetivo" cfg={personal} alCambiar={setPersonal} />
              <ControlVelo titulo="Velo sobre la traducción" clave="velarSecundario" cfg={personal} alCambiar={setPersonal} />
              <Fila etq="Ajuste de la pausa" ayuda="En milisegundos">
                <Paso etiqueta="ajuste de la pausa" valor={a.desfasePausaMs} paso={50} alCambiar={(v) => cambiarAjuste({ desfasePausaMs: v })} />
              </Fila>
            </div>
          )}
          <TituloGrupo>Escenas sin diálogo</TituloGrupo>
          <div class="grupo">
            <Fila etq="Acelerar o saltar">
              <div class="segmentado" role="radiogroup" aria-label="Saltar escenas sin diálogo">
                {(['no', '2', '4', '6', '8', 'saltar'] as const).map((m) => (
                  <button key={m} role="radio" aria-checked={a.salto === m} class={a.salto === m ? 'activo' : ''} onClick={() => cambiarAjuste({ salto: m })}>
                    {m === 'no' ? 'No' : m === 'saltar' ? 'Saltar' : `${m}×`}
                  </button>
                ))}
              </div>
            </Fila>
            <Fila etq="Ignorar acotaciones" ayuda="Las líneas entre corchetes cuentan como silencio">
              <Interruptor on={a.quitarAcotaciones} etiqueta="Ignorar acotaciones" alCambiar={(v) => cambiarAjuste({ quitarAcotaciones: v })} />
            </Fila>
          </div>
        </>
      )}

      {p === 'subtitulos' && (
        <>
          <div class="columnas">
            <ControlPista titulo="Subtítulos en japonés" icono="subtitulos" valor={idObjetivo.value} idioma={a.idiomaObjetivo} destino="objetivo" alElegir={seleccionarObjetivo} puedeExportar={lineasObjetivo.value.length > 0} />
            <ControlPista titulo="Subtítulos secundarios" icono="traducir" valor={idSecundaria.value} idioma={a.idiomaSecundario} destino="secundaria" alElegir={seleccionarSecundaria} puedeExportar={lineasSecundarias.value.length > 0} />
          </div>
          <p class="nota-grupo">También puedes arrastrar un archivo SRT, VTT, ASS o TTML directamente sobre el video.</p>
          <div class="columnas separada">
            <div class="grupo">
              <Fila etq="Mostrar japonés"><Interruptor on={!a.ocultarObjetivo} etiqueta="Mostrar japonés" alCambiar={(v) => cambiarAjuste({ ocultarObjetivo: !v })} /></Fila>
              <Fila etq="Tamaño"><Paso etiqueta="tamaño del japonés" valor={a.escalaObjetivo} paso={10} min={40} max={250} unidad="%" alCambiar={(v) => cambiarAjuste({ escalaObjetivo: v })} /></Fila>
            </div>
            <div class="grupo">
              <Fila etq="Mostrar secundarios"><Interruptor on={!a.ocultarSecundario} etiqueta="Mostrar secundarios" alCambiar={(v) => cambiarAjuste({ ocultarSecundario: !v })} /></Fila>
              <Fila etq="Tamaño"><Paso etiqueta="tamaño de secundarios" valor={a.escalaSecundario} paso={10} min={40} max={250} unidad="%" alCambiar={(v) => cambiarAjuste({ escalaSecundario: v })} /></Fila>
            </div>
          </div>
          <TituloGrupo>Fondo</TituloGrupo>
          <div class="grupo">
            <Fila etq="Fondo detrás del texto"><Interruptor on={a.sombra} etiqueta="Fondo sombreado" alCambiar={(v) => cambiarAjuste({ sombra: v })} /></Fila>
            {a.sombra && (
              <Fila etq="Opacidad">
                <input class="deslizador" type="range" min="0" max="1" step="0.05" aria-label="Opacidad del fondo" value={a.opacidadSombra} onInput={(e) => cambiarAjuste({ opacidadSombra: Number(e.currentTarget.value) })} />
              </Fila>
            )}
          </div>
        </>
      )}

      {p === 'sincronia' && (
        <>
          <p class="panel-intro">¿Los subtítulos no coinciden con lo que se dice? Muévelos a mano, o márcalos escuchando para una sincronía exacta.</p>
          <div class="columnas">
            <ControlSincronia titulo="Japonés" pista="objetivo" disponible={lineasObjetivo.value.length > 0} />
            <ControlSincronia titulo="Secundarios" pista="secundaria" disponible={lineasSecundarias.value.length > 0} />
          </div>
          <p class="nota-grupo">Atajos para el japonés: <Teclas t={['Alt', '+', 'I', '/', 'O']} /></p>
          <TituloGrupo>Sincronizar escuchando</TituloGrupo>
          <div class="grupo">
            <ol class="pasos-sinc">
              <li><span>Pausa justo cuando empieza a sonar una línea y, en el <b>navegador de subtítulos</b>, pulsa su <b>reloj</b>.</span></li>
              <li><span>Repite con otra línea lejana: así también se corrige la <b>velocidad</b> de los archivos hechos para otra versión del video.</span></li>
            </ol>
            <div class="fila">
              <span class="etq"><span class="etq-doble">{anclas.value.length === 1 ? '1 marca' : `${anclas.value.length} marcas`}<small>{anclas.value.length ? 'Ajuste aplicado' : 'Aún no has marcado ninguna línea'}</small></span></span>
              <button class={`btn chico ${a.navegadorAbierto ? 'fantasma' : ''}`} onClick={() => cambiarAjuste({ navegadorAbierto: !a.navegadorAbierto })}>
                <Icono n="panel" t={15} /> {a.navegadorAbierto ? 'Cerrar el navegador' : 'Abrir el navegador'}
              </button>
            </div>
          </div>
        </>
      )}

      {p === 'interaccion' && (
        <div class="columnas columnas-arriba">
          <div>
            <TituloGrupo>Diccionario emergente</TituloGrupo>
            <div class="grupo">
              <Fila etq="Abrir al pasar el ratón"><Interruptor on={a.popupAlPasar} etiqueta="Abrir al pasar el ratón" alCambiar={(v) => cambiarAjuste({ popupAlPasar: v })} /></Fila>
              <Fila etq="Solo con palabras desconocidas"><Interruptor on={a.popupSoloDesconocidas} etiqueta="Solo con palabras desconocidas" alCambiar={(v) => cambiarAjuste({ popupSoloDesconocidas: v })} /></Fila>
              <Fila etq="Consultar al pausar" ayuda="Abre la primera palabra desconocida"><Interruptor on={a.autoConsultaAlPausar} etiqueta="Consultar al pausar" alCambiar={(v) => cambiarAjuste({ autoConsultaAlPausar: v })} /></Fila>
            </div>
            <TituloGrupo>Pausar al interactuar</TituloGrupo>
            <div class="grupo">
              <Fila etq="Cuándo">
                <Selector etiqueta="Pausar al interactuar" valor={a.pausaInteraccion} opciones={[['nunca', 'Nunca'], ['alPasarSubtitulo', 'Al pasar por el subtítulo'], ['consultaPalabra', 'Al consultar una palabra']]} alCambiar={(v) => cambiarAjuste({ pausaInteraccion: v })} />
              </Fila>
              <Fila etq="Reanudar al terminar"><Interruptor on={a.reanudarAlTerminar} etiqueta="Reanudar al terminar" alCambiar={(v) => cambiarAjuste({ reanudarAlTerminar: v })} /></Fila>
              <Fila etq="Esperar al final de la línea"><Interruptor on={a.pausaDiferida} etiqueta="Pausar al final de la línea" alCambiar={(v) => cambiarAjuste({ pausaDiferida: v })} /></Fila>
            </div>
          </div>
          <div>
            <TituloGrupo>Pausa automática</TituloGrupo>
            <div class="grupo">
              <Fila etq="Reanudar tras un tiempo"><Interruptor on={a.reanudarTras} etiqueta="Reanudar tras un tiempo" alCambiar={(v) => cambiarAjuste({ reanudarTras: v })} /></Fila>
              {a.reanudarTras && <Fila etq="Segundos"><Paso etiqueta="segundos" valor={a.reanudarSegundos} paso={1} min={1} max={60} alCambiar={(v) => cambiarAjuste({ reanudarSegundos: v })} /></Fila>}
              <Fila etq="Según lo que tardas en leer"><Interruptor on={a.reanudarDinamico} etiqueta="Reanudar dinámico" alCambiar={(v) => cambiarAjuste({ reanudarDinamico: v })} /></Fila>
              {a.reanudarDinamico && (
                <>
                  <Fila etq="Palabras por segundo"><Paso etiqueta="palabras por segundo" valor={a.velocidadLectura} paso={1} min={1} max={15} alCambiar={(v) => cambiarAjuste({ velocidadLectura: v })} /></Fila>
                  <Fila etq="Pausa mínima" ayuda="En segundos"><Paso etiqueta="pausa mínima" valor={a.duracionMinimaPausa} paso={1} min={0} max={20} alCambiar={(v) => cambiarAjuste({ duracionMinimaPausa: v })} /></Fila>
                </>
              )}
            </div>
            <TituloGrupo>Audio de las tarjetas</TituloGrupo>
            <div class="grupo">
              <Fila etq="Margen inicial" ayuda="Milisegundos antes de la línea"><Paso etiqueta="margen inicial" valor={a.rellenoInicioMs} paso={100} min={0} max={3000} alCambiar={(v) => cambiarAjuste({ rellenoInicioMs: v })} /></Fila>
              <Fila etq="Margen final" ayuda="Milisegundos después de la línea"><Paso etiqueta="margen final" valor={a.rellenoFinMs} paso={100} min={0} max={3000} alCambiar={(v) => cambiarAjuste({ rellenoFinMs: v })} /></Fila>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Atajos ----------

const ATAJOS: { titulo: string; filas: [string, string[]][] }[][] = [
  [
    {
      titulo: 'Barra',
      filas: [
        ['Fijar o soltar la barra', ['Alt', '+', 'X']],
        ['Mostrarla mientras se mantiene', ['Alt', '+', 'Z']],
        ['Abrir el traductor', ['Alt', '+', 'T']],
      ],
    },
    {
      titulo: 'Estado de la palabra',
      filas: [
        ['Marcar desconocida', ['1', '/', 'U']],
        ['Rastrear', ['2', '/', 'T']],
        ['Marcar conocida', ['3', '/', 'K']],
        ['Ignorar', ['4', '/', 'I']],
      ],
    },
    {
      titulo: 'Diccionario',
      filas: [
        ['Consultar en el diccionario', ['Alt', '+', 'S']],
        ['Consultar en un enlace', ['Shift', '+', 'ratón']],
      ],
    },
  ],
  [
    {
      titulo: 'Tarjetas',
      filas: [
        ['Crear tarjeta', ['Q']],
        ['Enviar al creador', ['E']],
        ['Cancelar la creación', ['Ctrl', '+', 'X']],
        ['Permitir captura de audio', ['Alt', '+', 'R']],
      ],
    },
    {
      titulo: 'Selección',
      filas: [
        ['Marcar el subtítulo', ['B']],
        ['Seleccionar el subtítulo', ['L']],
        ['Unir seleccionados', ['J']],
        ['Limpiar selección', ['X']],
      ],
    },
  ],
  [
    {
      titulo: 'Video',
      filas: [
        ['Subtítulo anterior', ['←', '/', 'A']],
        ['Subtítulo siguiente', ['→', '/', 'D']],
        ['Repetir el subtítulo', ['↓', '/', 'S']],
        ['Avanzar 5 s', ['Alt', '+', '→']],
        ['Retroceder 5 s', ['Alt', '+', '←']],
        ['Seleccionado anterior', ['Shift', '+', '←']],
        ['Seleccionado siguiente', ['Shift', '+', '→']],
      ],
    },
  ],
  [
    {
      titulo: 'Subtítulos',
      filas: [
        ['Mostrar u ocultar todo', ['R']],
        ['Mostrar u ocultar japonés', ['↑', '/', 'W']],
        ['Mostrar u ocultar secundarios', ['Shift', '+', '↑']],
        ['Desfase del japonés', ['Alt', '+', 'I', '/', 'O']],
        ['Desfase de secundarios', ['Alt', '+', 'Shift', '+', 'I', '/', 'O']],
        ['Generar secundarios', ['Alt', '+', 'Shift', '+', 'G']],
        ['Navegador de subtítulos', ['G']],
        ['Copiar el subtítulo', ['C']],
        ['Siguiente palabra desconocida', ['N']],
        ['Siguiente palabra', ['Alt', '+', 'N']],
      ],
    },
  ],
];

function PanelAtajos() {
  return (
    <div class={`panel-flotante panel-atajos ${claseNavegador()}`} role="dialog" aria-label="Atajos de teclado">
      <Cabecera titulo="Atajos de teclado" icono="teclado" />
      <div class="columnas-atajos">
        {ATAJOS.map((col, i) => (
          <div class="atajos-col" key={i}>
            {col.map((g) => (
              <div key={g.titulo}>
                <TituloGrupo>{g.titulo}</TituloGrupo>
                <div class="grupo grupo-atajos">
                  {g.filas.map(([n, t]) => (
                    <div class="atajo" key={n}>
                      <span>{n}</span>
                      <Teclas t={t} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Generar ----------

const AYUDA_INTENSIDAD: Record<Ajustes['whisperIntensidad'], string> = {
  auto: 'Equilibra velocidad y fluidez, y acelera cuando te alejas',
  suave: 'La mínima carga, por si estás jugando o editando video',
  rapida: 'Siempre a la máxima velocidad segura',
};

function textoRestante(s: number | null | undefined): string {
  if (s === null || s === undefined || s <= 0) return '';
  if (s < 90) return ' · queda menos de 2 min';
  return ` · quedan unos ${Math.round(s / 60)} min`;
}

function ProgresoWhisper() {
  const w = whisper.value!;
  const conPorcentaje = w.porcentaje !== undefined ? `: ${Math.round(w.porcentaje)} %` : '…';
  const detalle = w.fase === 'descargando'
    ? `Descargando el modelo${conPorcentaje}`
    : w.fase === 'extrayendo'
      ? `Extrayendo el audio${conPorcentaje}`
      : w.fase === 'bajando'
        ? `Bajando el audio del video${conPorcentaje}`
      : w.fase === 'preparando'
        ? 'Preparando el modelo…'
        : w.fase === 'terminando'
          ? w.desdeArchivo ? 'Deteniendo…' : 'Terminando lo que ya se oyó…'
          : w.fase === 'recuperando'
            ? 'La tarjeta gráfica se reinició. Retomando con calma…'
            : w.pausado
              ? 'En pausa: la tarjeta gráfica está libre'
              : w.fase === 'procesando'
                ? `Transcribiendo${w.desdeArchivo ? conPorcentaje : '…'}${w.desdeArchivo ? textoRestante(w.restanteS) : ''}`
                : 'Escuchando el video…';
  const conBarra = w.porcentaje !== undefined && (w.fase === 'descargando' || w.fase === 'extrayendo' || w.fase === 'bajando' || (w.desdeArchivo && w.fase === 'procesando'));
  return (
    <div class="progreso-linea">
      <div class="fila-texto">
        <span>{detalle}</span>
        {w.fase !== 'terminando' && (
          <span class="botones-whisper">
            <button class="btn chico" onClick={() => pausarWhisper(!w.pausado)}><Icono n={w.pausado ? 'reproducir' : 'pausa'} t={13} /> {w.pausado ? 'Seguir' : 'Pausar'}</button>
            <button class="btn chico" onClick={detenerWhisper}><Icono n="detener" t={13} /> Detener</button>
          </span>
        )}
      </div>
      {conBarra ? (
        <div class="barra-progreso"><div style={{ width: `${w.porcentaje}%` }} /></div>
      ) : (
        <div class="ayuda">{w.lineas} {w.lineas === 1 ? 'línea' : 'líneas'}{w.dispositivo ? ` · ${w.dispositivo}` : ''}</div>
      )}
    </div>
  );
}

function SeccionWhisper() {
  const a = ajustes.value;
  const w = whisper.value;
  const archivo = transcribeArchivo.value;
  const conAyudante = !archivo && !!ayudante.value;
  const enteroDeUnaVez = archivo || conAyudante;
  useEffect(() => {
    if (!archivo) actualizarAyudante();
  }, [archivo]);
  return (
    <>
      <TituloGrupo icono="ondas">Generar con Whisper, en tu equipo</TituloGrupo>
      <div class="grupo">
        <div class="bloque-generar">
          <p>{enteroDeUnaVez ? 'Transcribe el audio entero sin esperar a reproducirlo: 30 minutos tardan unos 5. El audio no sale de tu equipo.' : 'Escucha el video mientras se reproduce, así que los subtítulos llegan con unos segundos de retraso.'}</p>
        </div>
        <Fila etq="Modelo">
          <select class="selector" aria-label="Modelo de transcripción" title={MODELOS_WHISPER[a.whisperModelo]?.descripcion} value={a.whisperModelo} disabled={!!w} onChange={(e) => cambiarAjuste({ whisperModelo: e.currentTarget.value as ModeloWhisper })}>
            {(Object.entries(MODELOS_WHISPER) as [ModeloWhisper, (typeof MODELOS_WHISPER)[ModeloWhisper]][]).map(([id, m]) => <option key={id} value={id}>{m.nombre} · {m.mb >= 1000 ? `${(m.mb / 1000).toFixed(1)} GB` : `${m.mb} MB`}</option>)}
          </select>
        </Fila>
        {enteroDeUnaVez && (
          <Fila etq="Intensidad" ayuda={AYUDA_INTENSIDAD[a.whisperIntensidad]}>
            <div class="segmentado" role="radiogroup" aria-label="Intensidad de la transcripción">
              {([['auto', 'Automática'], ['suave', 'Suave'], ['rapida', 'Rápida']] as const).map(([v, n]) => (
                <button key={v} class={a.whisperIntensidad === v ? 'activo' : ''} role="radio" aria-checked={a.whisperIntensidad === v} onClick={() => cambiarAjuste({ whisperIntensidad: v })}>{n}</button>
              ))}
            </div>
          </Fila>
        )}
        <Fila etq="Corregir con Claude" ayuda="Kanji y homófonos del resultado">
          <Interruptor on={a.whisperCorregir} etiqueta="Corregir con Claude" alCambiar={(v) => cambiarAjuste({ whisperCorregir: v })} />
        </Fila>
        {w ? (
          <ProgresoWhisper />
        ) : (
          <div class="bloque-generar">
            <button class="btn bloque" onClick={() => iniciarWhisper()}><Icono n={enteroDeUnaVez ? 'ondas' : 'microfono'} t={16} /> {archivo ? 'Transcribir el archivo' : conAyudante ? 'Transcribir el video' : 'Empezar a transcribir'}</button>
            {conAyudante && <button class="btn chico fantasma bloque" onClick={() => iniciarWhisper(true)}><Icono n="microfono" t={14} /> Transcribir mientras se reproduce</button>}
            {!enteroDeUnaVez && !capturaActiva.value && <p class="nota-grupo">Necesita oír el video: activa antes la captura de audio con <Teclas t={['Alt', '+', 'R']} /></p>}
            {!enteroDeUnaVez && <p class="nota-grupo">Con el ayudante local no hace falta reproducirlo: mira cómo instalarlo en <button class="enlace" onClick={() => fondo.abrirApp('ajustes')}>Ajustes</button>.</p>}
          </div>
        )}
      </div>
    </>
  );
}

function PanelGenerar() {
  const a = ajustes.value;
  const g = generacion.value;
  const r = analisisEnCurso.value;
  const c = correccion.value;
  const hayObjetivo = lineasObjetivo.value.length > 0;
  const haySecundaria = lineasSecundarias.value.length > 0;
  const sitio = infoVideo.value?.sitio;
  const nombreObjetivo = pistas.value.find((p) => p.id === idObjetivo.value);
  const nombreSecundaria = pistas.value.find((p) => p.id === idSecundaria.value)?.nombre;
  return (
    <div class={`panel-flotante panel-generar ${claseNavegador()}`} role="dialog" aria-label="Generar subtítulos">
      <Cabecera titulo="Subtítulos con IA" icono="varita" />

      <TituloGrupo icono="traducir" ia>Traducir al idioma de apoyo</TituloGrupo>
      <div class="grupo">
        <Fila etq="Idioma">
          <Selector<string> etiqueta="Idioma de la traducción" valor={a.idiomaSecundario} opciones={[['es', 'Español'], ['en', 'Inglés'], ['pt', 'Portugués'], ['fr', 'Francés'], ['de', 'Alemán']]} alCambiar={(v) => {
            const nombres: Record<string, string> = { es: 'español', en: 'inglés', pt: 'portugués', fr: 'francés', de: 'alemán' };
            cambiarAjuste({ idiomaSecundario: v, idiomaTraduccion: nombres[v] });
          }} />
        </Fila>
        {g?.tipo === 'secundarios' ? (
          <div class="progreso-linea">
            <div class="fila-texto"><span>Traduciendo {g.hechas} de {g.total}, empezando por donde vas…</span><button class="btn chico" onClick={cancelarGeneracion}>Cancelar</button></div>
            <div class="progreso-ia"><div style={{ width: `${(g.hechas / Math.max(g.total, 1)) * 100}%` }} /></div>
          </div>
        ) : (
          <div class="bloque-generar">
            <button class="btn primario bloque" disabled={!hayObjetivo || !!g} onClick={() => generarSecundarios()}><Icono n="traducir" t={16} /> Traducir al {nombreIdioma(a.idiomaSecundario).toLowerCase()}</button>
            {!hayObjetivo && <p class="nota-grupo">Primero necesitas subtítulos en japonés.</p>}
          </div>
        )}
      </div>

      {hayObjetivo && (
        <>
          <TituloGrupo icono="sello" ia>Corregir errores de reconocimiento</TituloGrupo>
          <div class="grupo">
            <div class="bloque-generar">
              <p>Arregla homófonos y palabras mal oídas de los subtítulos automáticos, usando el título y todo el texto como contexto. No te pregunta nada y empieza por donde vas.</p>
            </div>
            {sitio !== 'netflix' && (
              <Fila etq="Corregir los automáticos al abrirlos">
                <Interruptor on={a.corregirAutomaticos} etiqueta="Corregir los automáticos al abrirlos" alCambiar={(v) => cambiarAjuste({ corregirAutomaticos: v })} />
              </Fila>
            )}
            {c ? (
              <div class="progreso-linea">
                <div class="fila-texto"><span>Revisadas {c.hechas} de {c.total} · {c.cambiadas} corregidas</span><button class="btn chico" onClick={cancelarCorreccion}>Cancelar</button></div>
                <div class="progreso-ia"><div style={{ width: `${(c.hechas / Math.max(c.total, 1)) * 100}%` }} /></div>
              </div>
            ) : (
              <div class="bloque-generar">
                <button class="btn ia bloque" onClick={() => corregirSubtitulos(true)}><Icono n="sello" t={16} /> Corregir estos subtítulos</button>
                {originales.value.size > 0 && <p class="nota-grupo">{originales.value.size} {originales.value.size === 1 ? 'línea corregida' : 'líneas corregidas'}{nombreObjetivo ? ` en ${nombreObjetivo.nombre}` : ''}. En el navegador de subtítulos puedes ver qué decían antes.</p>}
              </div>
            )}
          </div>
        </>
      )}

      {hayObjetivo && (
        <>
          <TituloGrupo icono="ia" ia>Revisar lecturas y gramática</TituloGrupo>
          <div class="grupo">
            <div class="bloque-generar">
              <p>Corrige el furigana, detecta los usos figurados y marca la gramática de cada línea. Lo revisado se guarda, así que solo se hace una vez.</p>
            </div>
            <Fila etq="Revisar automáticamente">
              <Interruptor on={a.analisisAutomatico} etiqueta="Revisar automáticamente" alCambiar={(v) => cambiarAjuste({ analisisAutomatico: v })} />
            </Fila>
            {r ? (
              <div class="progreso-linea">
                <div class="fila-texto"><span>Revisando {r.hechas} de {r.total} líneas…</span></div>
                <div class="progreso-ia"><div style={{ width: `${(r.hechas / Math.max(r.total, 1)) * 100}%` }} /></div>
              </div>
            ) : (
              <div class="bloque-generar">
                <button class="btn ia bloque" onClick={() => iniciarAnalisisProfundo(true)}><Icono n="ia" t={16} /> Revisar ahora</button>
              </div>
            )}
          </div>
        </>
      )}

      <TituloGrupo icono="traducir" ia>Crear japonés desde otro idioma</TituloGrupo>
      <div class="grupo">
        <div class="bloque-generar">
          <p>Para cuando solo hay subtítulos en otro idioma y no encuentras un SRT en japonés. Es una traducción de una traducción, así que no coincidirá del todo con lo que se oye.</p>
        </div>
        {g?.tipo === 'objetivo' ? (
          <div class="progreso-linea">
            <div class="fila-texto"><span>Traduciendo {g.hechas} de {g.total}…</span><button class="btn chico" onClick={cancelarGeneracion}>Cancelar</button></div>
            <div class="progreso-ia"><div style={{ width: `${(g.hechas / Math.max(g.total, 1)) * 100}%` }} /></div>
          </div>
        ) : (
          <div class="bloque-generar">
            <button class="btn ia bloque" disabled={!haySecundaria || !!g} onClick={() => traducirAlJapones()}><Icono n="traducir" t={16} /> {nombreSecundaria ? `Traducir «${nombreSecundaria}» al japonés` : 'Traducir al japonés'}</button>
            {!haySecundaria && <p class="nota-grupo">Elige primero unos subtítulos secundarios en la pestaña Subtítulos.</p>}
          </div>
        )}
      </div>

      {/* Netflix casi siempre trae subtítulos y su audio no se puede procesar por adelantado. */}
      {sitio !== 'netflix' && <SeccionWhisper />}
    </div>
  );
}

// ---------- Traductor ----------

function PanelTraductor() {
  const texto = useSignal('');
  const salida = useSignal('');
  const error = useSignal('');
  const cargando = useSignal(false);
  const traducir = async () => {
    if (!texto.value.trim()) return;
    cargando.value = true;
    salida.value = '';
    error.value = '';
    try {
      await flujoMotor('traducir', [{ frase: texto.value }, false], (t) => (salida.value = t));
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      cargando.value = false;
    }
  };
  return (
    <div class={`panel-flotante panel-traductor ${claseNavegador()}`} role="dialog" aria-label="Traductor">
      <Cabecera titulo="Traductor" icono="traducir" ia />
      <textarea class="campo" lang="ja" aria-label="Texto a traducir" placeholder="ここに書いてください" value={texto.value} onInput={(e) => (texto.value = e.currentTarget.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) traducir(); e.stopPropagation(); }} />
      <div class="accion-traducir">
        <Teclas t={['Ctrl', '+', 'Enter']} />
        <button class="btn ia" disabled={cargando.value || !texto.value.trim()} onClick={traducir}><Icono n="ia" t={16} /> Traducir</button>
      </div>
      {error.value && (
        <div class="panel-ia-error separada" role="alert">
          <Icono n="aviso" t={16} />
          <span>{error.value}</span>
          <button class="btn chico" onClick={traducir}>Reintentar</button>
        </div>
      )}
      {cargando.value && !salida.value && (
        <div class="salida-traductor" aria-hidden="true">
          <span class="esqueleto larga" />
          <span class="esqueleto corta" />
        </div>
      )}
      {salida.value && <div class={`salida-traductor ${cargando.value ? 'cursor-ia' : ''}`}>{salida.value}</div>}
    </div>
  );
}

// ---------- Comprensión ----------

function PanelComprension() {
  const e = estadisticas.value;
  const a: Ajustes = ajustes.value;
  const u = e.unicas;
  const total = Math.max(u.conocidas + u.desconocidas + u.ignoradas, 1);
  const prioritarias = palabrasPrioritarias(lineasObjetivo.value, 12);
  return (
    <div class={`panel-flotante panel-comprension ${claseNavegador()}`} role="dialog" aria-label="Comprensión">
      <Cabecera titulo="Comprensión" icono="rosca" />
      <div class="comp-hero">
        <Anillo valor={e.comprension} t={88} grosor={8}>{e.comprension}<small>%</small></Anillo>
        <div>
          <h4>{NOMBRES_NIVEL[e.nivel]}</h4>
          <p>
            {e.recomendadas.toLocaleString('es')} {e.recomendadas === 1 ? 'frase recomendada' : 'frases recomendadas'}
            {e.frecuenciaMedia !== undefined && <><br />Frecuencia media de esas palabras: {e.frecuenciaMedia.toLocaleString('es')}</>}
          </p>
        </div>
      </div>
      <TituloGrupo>Palabras únicas</TituloGrupo>
      <div class="grupo comp-caja">
        <div class="grafico-comp" aria-hidden="true">
          <div class="p-conocida" style={{ width: `${(u.conocidas / total) * 100}%` }} />
          <div class="p-desconocida" style={{ width: `${(u.desconocidas / total) * 100}%` }} />
          <div class="p-ignorada" style={{ width: `${(u.ignoradas / total) * 100}%` }} />
        </div>
        <div class="comp-leyenda">
          <div class="comp-dato"><b><i class="p-conocida" />{u.conocidas.toLocaleString('es')}</b><span>Conocidas</span></div>
          <div class="comp-dato"><b><i class="p-desconocida" />{u.desconocidas.toLocaleString('es')}</b><span>Desconocidas</span></div>
          <div class="comp-dato"><b><i class="p-ignorada" />{u.ignoradas.toLocaleString('es')}</b><span>Ignoradas</span></div>
        </div>
      </div>
      <TituloGrupo>Frases</TituloGrupo>
      <div class="grupo">
        <div class="dato"><span>Todas las palabras conocidas</span><b>{e.frases.conocidas.toLocaleString('es')}</b></div>
        <div class="dato"><span>Una palabra desconocida</span><b>{e.frases.unaDesconocida.toLocaleString('es')}</b></div>
        <div class="dato"><span>Varias desconocidas</span><b>{e.frases.variasDesconocidas.toLocaleString('es')}</b></div>
      </div>
      {prioritarias.length > 0 && (
        <>
          <TituloGrupo>Las que más te ayudarían aquí</TituloGrupo>
          <div class="chips-palabras">
            {prioritarias.map(({ palabra, veces }) => (
              <span class="chip-palabra" key={palabra.clave} title={palabra.glosa} lang="ja">{palabra.lema} <small>×{veces}</small></span>
            ))}
          </div>
        </>
      )}
      <ResumenGramatica />
      <p class="nota-grupo pie">Las frases recomendadas tienen una sola palabra nueva, de las {a.frecuenciaMaxRecomendada.toLocaleString('es')} más frecuentes.</p>
    </div>
  );
}

/** Toda la gramática del video, por nivel; al pulsar un patrón se salta a su primer ejemplo. */
function ResumenGramatica() {
  const porPatron = new Map<string, { nivel?: string; significado: string; veces: number; primera: (typeof lineasObjetivo.value)[number] }>();
  for (const l of lineasObjetivo.value) {
    for (const g of l.gramatica ?? []) {
      const e = porPatron.get(g.patron);
      if (e) e.veces++;
      else porPatron.set(g.patron, { nivel: g.nivel, significado: g.significado, veces: 1, primera: l });
    }
  }
  if (!porPatron.size) return null;
  const orden = ['N1', 'N2', 'N3', 'N4', 'N5'];
  const lista = [...porPatron.entries()].sort((a, b) => orden.indexOf(a[1].nivel ?? '') - orden.indexOf(b[1].nivel ?? '') || b[1].veces - a[1].veces);
  return (
    <>
      <TituloGrupo>Gramática de este video</TituloGrupo>
      <div class="chips-palabras">
        {lista.slice(0, 40).map(([patron, e]) => (
          <button key={patron} class={`chip-gram n-${e.nivel ?? ''}`} title={`${e.significado}. Ir al primer ejemplo.`} onClick={() => irALinea(e.primera)}>
            <span lang="ja">{patron}</span>{e.nivel && <small>{e.nivel}</small>}{e.veces > 1 && <small>×{e.veces}</small>}
          </button>
        ))}
      </div>
    </>
  );
}

export function PanelesFlotantes() {
  switch (panel.value) {
    case 'visual':
      return <PanelVisual />;
    case 'video':
      return <PanelVideo />;
    case 'atajos':
      return <PanelAtajos />;
    case 'generar':
      return <PanelGenerar />;
    case 'traductor':
      return <PanelTraductor />;
    case 'comprension':
      return <PanelComprension />;
    default:
      return null;
  }
}
