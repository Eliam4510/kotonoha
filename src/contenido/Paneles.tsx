// Paneles flotantes de la isla: visualización, video, atajos, generación, traductor y comprensión.

import { signal, useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import type { Ajustes, ConfigModo, DisparadorPausa, IdModo, ModeloWhisper, ModoVelo, ObjetivoFrase, RevelarEnPausa } from '../compartido/ajustes';
import { MODELO_AUTOMATICO, MODELOS_WHISPER, modeloSirveParaLengua, NOMBRES_MODO, type OpcionModelo } from '../compartido/ajustes';
import { flujoMotor, fondo } from '../compartido/rpc';
import { NOMBRES_NIVEL, palabrasPrioritarias } from '../nucleo/frases';
import { versosDeLetra } from '../nucleo/letra';
import { Icono, type NombreIcono } from '../ui/iconos';
import {
  ajustarDesfase,
  ajustarLetra,
  modeloQueTranscribiria,
  pistaObjetivoEsLetra,
  cancelarGeneracion,
  detenerWhisper,
  pausarWhisper,
  exportarSrt,
  actualizarAyudante,
  cancelarCorreccion,
  corregirSubtitulos,
  generarSecundarios,
  traducirALengua,
  iniciarAnalisisProfundo,
  iniciarWhisper,
  importarArchivo,
  irALinea,
  nombreIdioma,
  reiniciarSincronia,
  seleccionarObjetivo,
  seleccionarSecundaria,
} from './controlador';
import { ajustandoLetra, ajustes, analisisEnCurso, anclas, letraPegada, atajosChrome, ayudante, capturaActiva, correccion, estadisticas, generacion, idObjetivo, infoVideo, originales, idSecundaria, lineasObjetivo, lineasSecundarias, panel, pistas, sinAceleracion, sincronias, transcribeArchivo, whisper } from './estado';
import { cambiarAjuste } from './Reproductor';
import { LENGUAS, lenguasTraduccion, numero, tm, tr } from '../compartido/i18n';
import { estudiarLengua, lengua } from '../ui/lengua';
import { PAQUETES } from '../lenguas';
import type { TextosLengua } from '../lenguas/tipos';

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
          <kbd class="tecla" key={i} aria-label={FLECHAS[x] ? x : undefined}>{FLECHAS[x] ? <Icono n={FLECHAS[x]} t={11} /> : tr(x)}</kbd>
        )
      )}
    </span>
  );
}

/** La tecla real de la captura, o dónde activarla si Chrome no le ha dado ninguna. */
function teclasCaptura(): string[] {
  const t = atajosChrome.value['alternar-captura'];
  return t ? t.split('+').flatMap((x, i) => (i ? ['+', x] : [x])) : [tr('Menú de la extensión')];
}

function Cabecera({ titulo, icono, detalle, ia }: { titulo: string; icono: NombreIcono; detalle?: string; ia?: boolean }) {
  return (
    <div class="panel-cab">
      <span class={`hoja-icono chica ${ia ? 'ia' : ''}`}><Icono n={icono} t={18} /></span>
      <h3>{titulo}{detalle && <small>{detalle}</small>}</h3>
      <button class="btn-icono chico" aria-label={tr('Cerrar panel')} onClick={() => (panel.value = null)}><Icono n="cerrar" t={16} /></button>
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
      <button aria-label={tr('Reducir {0}', etiqueta)} onClick={() => alCambiar(lim(valor - paso))}><Icono n="menos" t={14} /></button>
      <span>{valor}{unidad}</span>
      <button aria-label={tr('Aumentar {0}', etiqueta)} onClick={() => alCambiar(lim(valor + paso))}><Icono n="mas" t={14} /></button>
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
    <div class={`panel-flotante panel-visual ${claseNavegador()}`} role="dialog" aria-label={tr('Ajustes de visualización')}>
      <Cabecera titulo={tr('Visualización')} icono="ojo" />
      <div class="grupo">
        <Fila etq={tr('Estado de aprendizaje')} teclas={[tr('Alt'), '+', 'L']}>
          <Interruptor on={a.mostrarEstado} etiqueta={tr('Estado de aprendizaje')} alCambiar={(v) => cambiarAjuste({ mostrarEstado: v })} />
        </Fila>
        <div class="leyenda">
          <span><i class="p-desconocida" />{tr('Desconocida')}</span>
          <span><i class="p-aprendiendo" />{tr('Aprendiendo')}</span>
          <span><i class="p-rastreada" />{tr('Rastreada')}</span>
        </div>
      </div>
      <TituloGrupo>{tr('Sobre cada palabra')}</TituloGrupo>
      <div class="grupo">
        <Fila etq={tr(lengua.value.textos.lectura)}>
          <Selector etiqueta={tr(lengua.value.textos.lectura)} valor={a.furigana} opciones={[['ninguna', tr('Ninguna')], ['todas', tr('Todas las palabras')], ['desconocidas', tr('Desconocidas')], ['alPasar', tr('Al pasar el ratón')]]} alCambiar={(v) => cambiarAjuste({ furigana: v })} />
        </Fila>
        <Fila etq={tr('Traducción de palabras')}>
          <Selector etiqueta={tr('Traducción de palabras')} valor={a.glosas} opciones={[['ninguna', tr('Ninguna')], ['desconocidas', tr('Desconocidas')], ['alPasar', tr('Al pasar el ratón')]]} alCambiar={(v) => cambiarAjuste({ glosas: v })} />
        </Fila>
        <Fila etq={tr('Color de acento')} teclas={[tr('Alt'), '+', 'C']}>
          <Selector etiqueta={tr('Color de acento')} valor={a.colorAcento} opciones={[['ninguno', tr('Ninguno')], ['alPasar', tr('Al pasar el ratón')], ['siempre', tr('Siempre')]]} alCambiar={(v) => cambiarAjuste({ colorAcento: v })} />
        </Fila>
        <div class="leyenda">
          {lengua.value.acento?.leyenda.map((l) => <span key={l.clase} class={`ac-${l.clase}`}>{tr(l.nombre)}</span>)}
        </div>
      </div>
      <TituloGrupo>{tr('Análisis')}</TituloGrupo>
      <div class="grupo">
        <Fila etq={tr('Mostrar gramática')} ayuda={tr('Puntos gramaticales bajo cada línea')}>
          <Interruptor on={a.mostrarGramatica} etiqueta={tr('Mostrar gramática')} alCambiar={(v) => cambiarAjuste({ mostrarGramatica: v })} />
        </Fila>
        <Fila etq={tr(lengua.value.textos.gramaticaConocida)}>
          <Interruptor on={a.particulasConocidas} etiqueta={tr(lengua.value.textos.gramaticaConocida)} alCambiar={(v) => cambiarAjuste({ particulasConocidas: v })} />
        </Fila>
        <Fila etq={tr(lengua.value.textos.compuestosActivar)} ayuda={tr(lengua.value.textos.compuestosAyuda)}>
          <Interruptor on={a.busquedaCompuesta} etiqueta={tr(lengua.value.textos.compuestosActivar)} alCambiar={(v) => cambiarAjuste({ busquedaCompuesta: v })} />
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
  ['reproduccion', tm('Reproducción'), 'reproducir'],
  ['subtitulos', tm('Subtítulos'), 'subtitulos'],
  ['sincronia', tm('Sincronizar'), 'reloj'],
  ['interaccion', tm('Interacción'), 'cursor'],
];

const MODOS_ORDEN: IdModo[] = ['normal', 'escuchaPreparada', 'lecturaIntensiva', 'escuchaIntensiva', 'dictado', 'hibridoIntensivo', 'alPausar', 'enfoque1d', 'personalizado'];

const ICONO_MODO: Record<IdModo, NombreIcono> = {
  normal: 'reproducir',
  escuchaPreparada: 'oido',
  lecturaIntensiva: 'libro',
  escuchaIntensiva: 'ondas',
  hibridoIntensivo: 'intercambiar',
  alPausar: 'pausa',
  enfoque1d: 'objetivo',
  dictado: 'teclado',
  personalizado: 'controles',
};

const OBJETIVOS: [ObjetivoFrase, string][] = [
  ['todas', tm('Todas las frases')],
  ['1d', tm('Una palabra desconocida (1D)')],
  ['recomendadas', tm('Recomendadas')],
  ['desconocidas', tm('Con palabras desconocidas')],
  ['rastreadas', tm('Con palabras rastreadas')],
  ['aprendiendo', tm('Con palabras en aprendizaje')],
  ['2mas', tm('Con 2 o más desconocidas')],
  ['conocidas', tm('Todas conocidas')],
];

const REVELAR: [RevelarEnPausa, string][] = [
  ['manual', tm('Pausa manual')],
  ['auto', tm('Pausa automática')],
  ['primeraAuto', tm('Primera pausa automática')],
  ['primeraAutoYDurante', tm('Primera pausa y durante la reproducción')],
  ['segundaAuto', tm('Segunda pausa automática')],
  ['cualquiera', tm('Cualquier pausa')],
];

function Marcas<T extends string>({ opciones, valor, alCambiar }: { opciones: [T, string][]; valor: T[]; alCambiar: (v: T[]) => void }) {
  return (
    <div class="casillas">
      {opciones.map(([v, n]) => (
        <label key={v} class="casilla">
          <input type="checkbox" checked={valor.includes(v)} onChange={(e) => alCambiar(e.currentTarget.checked ? [...valor, v] : valor.filter((x) => x !== v))} />
          {tr(n)}
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
          {([['no', tr('No')], ['difuminar', tr('Difuminar')], ['ocultar', tr('Ocultar')]] as [ModoVelo, string][]).map(([m, n]) => (
            <button key={m} role="radio" aria-checked={v.modo === m} class={v.modo === m ? 'activo' : ''} onClick={() => set({ modo: m })}>{n}</button>
          ))}
        </div>
      </Fila>
      {v.modo !== 'no' && (
        <div class="velo-opciones">
          <div class="ayuda velo-titulo">{tr('Revelar según la pausa')}</div>
          <Marcas opciones={REVELAR} valor={v.revelarEnPausa} alCambiar={(r) => set({ revelarEnPausa: r })} />
          <div class="ayuda velo-titulo">{tr('Revelar según la frase')}</div>
          <Marcas opciones={OBJETIVOS.filter(([o]) => o !== 'todas')} valor={v.revelarPorEstado} alCambiar={(r) => set({ revelarPorEstado: r })} />
          <div class="casillas">
            <label class="casilla">
              <input type="checkbox" checked={v.revelarAlPasar} onChange={(e) => set({ revelarAlPasar: e.currentTarget.checked })} />
              {tr('Revelar al pasar el ratón')}
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
        <option value="">{tr('Ninguno')}</option>
        {ordenadas.map((p) => <option key={p.id} value={p.id}>{p.nombre}{p.automatica ? tr(' (automáticos)') : ''}</option>)}
      </select>
      <div class="pista-acciones">
        <button class="btn chico" onClick={() => entrada.current?.click()}><Icono n="archivo-subir" t={15} /> {tr('Importar')}</button>
        <button class="btn chico" disabled={!puedeExportar} onClick={() => exportarSrt(destino)}><Icono n="exportar" t={15} /> {tr('Exportar SRT')}</button>
        {destino === 'secundaria' && <button class="btn chico ia" disabled={!lineasObjetivo.value.length || !!generacion.value} onClick={() => generarSecundarios()}><Icono n="traducir" t={15} /> {tr('Traducir con Claude')}</button>}
      </div>
      <input ref={entrada} type="file" accept=".srt,.vtt,.ass,.ssa,.ttml,.dfxp,.xml" hidden aria-label={tr('Importar {0}', titulo)} onChange={(e) => {
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
        <button class="btn-icono chico" title={tr('Volver a cero')} aria-label={tr('Restablecer sincronización de {0}', titulo)} disabled={s.desfaseMs === 0 && s.escala === 1} onClick={() => reiniciarSincronia(pista)}><Icono n="historial" t={15} /></button>
      </div>
      <div class="sinc-valor">
        {segundos > 0 ? '+' : segundos < 0 ? '−' : ''}{Math.abs(segundos).toFixed(2)} s
        <small>{s.escala !== 1 ? tr('Velocidad ×{0}', s.escala.toFixed(4)) : s.desfaseMs === 0 ? tr('Sin ajuste') : segundos > 0 ? tr('Aparecen más tarde') : tr('Aparecen antes')}</small>
      </div>
      <div class="sinc-botones">
        {[-1000, -100, 100, 1000].map((d) => (
          <button key={d} class="btn chico" disabled={!disponible} aria-label={tr('{0}: mover {1} milisegundos', titulo, d)} onClick={() => ajustarDesfase(pista, d)}>{d > 0 ? '+' : '−'}{Math.abs(d) / 1000} s</button>
        ))}
      </div>
      <div class="sinc-pistas"><span>{tr('Más pronto')}</span><span>{tr('Más tarde')}</span></div>
    </div>
  );
}

function PanelVideo() {
  const a = ajustes.value;
  const personal = a.modoPersonalizado;
  const setPersonal = (c: ConfigModo) => cambiarAjuste({ modoPersonalizado: c });
  const p = pestanaVideo.value;
  return (
    <div class={`panel-flotante panel-video ${claseNavegador()}`} role="dialog" aria-label={tr('Ajustes de video')}>
      <Cabecera titulo={tr('Video y subtítulos')} icono="subtitulos" />
      <div class="segmentado panel-pestanas" role="tablist" aria-label={tr('Secciones')}>
        {PESTANAS_VIDEO.map(([id, nombre, icono]) => (
          <button key={id} role="tab" aria-selected={p === id} class={p === id ? 'activo' : ''} onClick={() => (pestanaVideo.value = id)}><Icono n={icono} t={15} /> {tr(nombre)}</button>
        ))}
      </div>

      {p === 'reproduccion' && (
        <>
          <div class="modos" role="radiogroup" aria-label={tr('Modo de reproducción')}>
            {MODOS_ORDEN.map((m) => (
              <button key={m} role="radio" aria-checked={a.modo === m} class={`modo ${a.modo === m ? 'activo' : ''}`} onClick={() => cambiarAjuste({ modo: m })}>
                <span class="modo-icono"><Icono n={ICONO_MODO[m]} t={22} /></span>
                <b>{tr(NOMBRES_MODO[m].titulo)}</b>
                <span class="modo-texto">{tr(NOMBRES_MODO[m].descripcion)}</span>
              </button>
            ))}
          </div>
          {a.modo === 'personalizado' && (
            <div class="grupo modo-personal">
              <div class="ayuda velo-titulo">{tr('Pausar automáticamente en')}</div>
              <Marcas opciones={OBJETIVOS} valor={personal.objetivosPausa} alCambiar={(o) => setPersonal({ ...personal, objetivosPausa: o })} />
              <Fila etq={tr('Momento de la pausa')}>
                <Selector<DisparadorPausa> etiqueta={tr('Momento de la pausa')} valor={personal.disparador} opciones={[['ninguno', tr('Nunca')], ['antes', tr('Antes de la frase')], ['despues', tr('Después de la frase')], ['antesYDespues', tr('Antes y después')], ['rebobinar', tr('Retroceder y pausar')]]} alCambiar={(d) => setPersonal({ ...personal, disparador: d })} />
              </Fila>
              <ControlVelo titulo={tr(lengua.value.textos.velo)} clave="velarObjetivo" cfg={personal} alCambiar={setPersonal} />
              <ControlVelo titulo={tr('Velo sobre la traducción')} clave="velarSecundario" cfg={personal} alCambiar={setPersonal} />
              <Fila etq={tr('Ajuste de la pausa')} ayuda={tr('En milisegundos')}>
                <Paso etiqueta={tr('ajuste de la pausa')} valor={a.desfasePausaMs} paso={50} alCambiar={(v) => cambiarAjuste({ desfasePausaMs: v })} />
              </Fila>
            </div>
          )}
          <TituloGrupo>{tr('Escenas sin diálogo')}</TituloGrupo>
          <div class="grupo">
            <Fila etq={tr('Acelerar o saltar')}>
              <div class="segmentado" role="radiogroup" aria-label={tr('Saltar escenas sin diálogo')}>
                {(['no', '2', '4', '6', '8', 'saltar'] as const).map((m) => (
                  <button key={m} role="radio" aria-checked={a.salto === m} class={a.salto === m ? 'activo' : ''} onClick={() => cambiarAjuste({ salto: m })}>
                    {m === 'no' ? tr('No') : m === 'saltar' ? tr('Saltar') : `${m}×`}
                  </button>
                ))}
              </div>
            </Fila>
            <Fila etq={tr('Ignorar acotaciones')} ayuda={tr('Las líneas entre corchetes cuentan como silencio')}>
              <Interruptor on={a.quitarAcotaciones} etiqueta={tr('Ignorar acotaciones')} alCambiar={(v) => cambiarAjuste({ quitarAcotaciones: v })} />
            </Fila>
          </div>
        </>
      )}

      {p === 'subtitulos' && (
        <>
          {PAQUETES.length > 1 && (
            <div class="grupo">
              <Fila etq={tr('Idioma que estudias')}>
                <div class="segmentado" role="radiogroup" aria-label={tr('Idioma que estudias')}>
                  {PAQUETES.map((paquete) => (
                    <button key={paquete.id} role="radio" aria-checked={a.idiomaObjetivo === paquete.id} class={a.idiomaObjetivo === paquete.id ? 'activo' : ''} onClick={() => estudiarLengua(a, paquete.id).catch(console.error)}>{tr(paquete.textos.nombre)}</button>
                  ))}
                </div>
              </Fila>
            </div>
          )}
          <div class="columnas">
            <ControlPista titulo={tr(lengua.value.textos.subtitulos)} icono="subtitulos" valor={idObjetivo.value} idioma={a.idiomaObjetivo} destino="objetivo" alElegir={seleccionarObjetivo} puedeExportar={lineasObjetivo.value.length > 0} />
            <ControlPista titulo={tr('Subtítulos secundarios')} icono="traducir" valor={idSecundaria.value} idioma={a.idiomaSecundario} destino="secundaria" alElegir={seleccionarSecundaria} puedeExportar={lineasSecundarias.value.length > 0} />
          </div>
          <p class="nota-grupo">{tr('También puedes arrastrar un archivo SRT, VTT, ASS o TTML directamente sobre el video.')}</p>
          <div class="columnas separada">
            <div class="grupo">
              <Fila etq={tr(lengua.value.textos.mostrar)}><Interruptor on={!a.ocultarObjetivo} etiqueta={tr(lengua.value.textos.mostrar)} alCambiar={(v) => cambiarAjuste({ ocultarObjetivo: !v })} /></Fila>
              <Fila etq={tr('Tamaño')}><Paso etiqueta={tr(lengua.value.textos.tamano)} valor={a.escalaObjetivo} paso={10} min={40} max={250} unidad="%" alCambiar={(v) => cambiarAjuste({ escalaObjetivo: v })} /></Fila>
            </div>
            <div class="grupo">
              <Fila etq={tr('Mostrar secundarios')}><Interruptor on={!a.ocultarSecundario} etiqueta={tr('Mostrar secundarios')} alCambiar={(v) => cambiarAjuste({ ocultarSecundario: !v })} /></Fila>
              <Fila etq={tr('Tamaño')}><Paso etiqueta={tr('tamaño de secundarios')} valor={a.escalaSecundario} paso={10} min={40} max={250} unidad="%" alCambiar={(v) => cambiarAjuste({ escalaSecundario: v })} /></Fila>
            </div>
          </div>
          <TituloGrupo>{tr('Posición')}</TituloGrupo>
          <div class="grupo">
            <Fila etq={tr('Dónde van los subtítulos')} ayuda={tr('Arrástralos sobre el video para moverlos')}>
              <button class="btn chico" disabled={!a.subsPosicion} onClick={() => cambiarAjuste({ subsPosicion: null })}>{tr('Volver a su sitio')}</button>
            </Fila>
          </div>
          <TituloGrupo>{tr('Fondo')}</TituloGrupo>
          <div class="grupo">
            <Fila etq={tr('Fondo detrás del texto')}><Interruptor on={a.sombra} etiqueta={tr('Fondo sombreado')} alCambiar={(v) => cambiarAjuste({ sombra: v })} /></Fila>
            {a.sombra && (
              <Fila etq={tr('Opacidad')}>
                <input class="deslizador" type="range" min="0" max="1" step="0.05" aria-label={tr('Opacidad del fondo')} value={a.opacidadSombra} onInput={(e) => cambiarAjuste({ opacidadSombra: Number(e.currentTarget.value) })} />
              </Fila>
            )}
          </div>
        </>
      )}

      {p === 'sincronia' && (
        <>
          <p class="panel-intro">{tr('¿Los subtítulos no coinciden con lo que se dice? Muévelos a mano, o márcalos escuchando para una sincronía exacta.')}</p>
          <div class="columnas">
            <ControlSincronia titulo={tr(lengua.value.textos.nombre)} pista="objetivo" disponible={lineasObjetivo.value.length > 0} />
            <ControlSincronia titulo={tr('Secundarios')} pista="secundaria" disponible={lineasSecundarias.value.length > 0} />
          </div>
          <p class="nota-grupo">{tr(lengua.value.textos.atajos)} <Teclas t={['Alt', '+', 'I', '/', 'O']} /></p>
          <TituloGrupo>{tr('Sincronizar escuchando')}</TituloGrupo>
          <div class="grupo">
            <ol class="pasos-sinc">
              <li><span>{tr('Pausa justo cuando empieza a sonar una línea y, en el navegador de subtítulos, pulsa su reloj.')}</span></li>
              <li><span>{tr('Repite con otra línea lejana: así también se corrige la velocidad de los archivos hechos para otra versión del video.')}</span></li>
            </ol>
            <div class="fila">
              <span class="etq"><span class="etq-doble">{anclas.value.length === 1 ? tr('1 marca') : `${anclas.value.length} marcas`}<small>{anclas.value.length ? tr('Ajuste aplicado') : tr('Aún no has marcado ninguna línea')}</small></span></span>
              <button class={`btn chico ${a.navegadorAbierto ? 'fantasma' : ''}`} onClick={() => cambiarAjuste({ navegadorAbierto: !a.navegadorAbierto })}>
                <Icono n="panel" t={15} /> {a.navegadorAbierto ? tr('Cerrar el navegador') : tr('Abrir el navegador')}
              </button>
            </div>
          </div>
        </>
      )}

      {p === 'interaccion' && (
        <div class="columnas columnas-arriba">
          <div>
            <TituloGrupo>{tr('Diccionario emergente')}</TituloGrupo>
            <div class="grupo">
              <Fila etq={tr('Abrir al pasar el ratón')}><Interruptor on={a.popupAlPasar} etiqueta={tr('Abrir al pasar el ratón')} alCambiar={(v) => cambiarAjuste({ popupAlPasar: v })} /></Fila>
              {/* Solo cuenta al abrir al pasar el ratón: con un clic, la ficha se abre siempre. */}
              {a.popupAlPasar && <Fila etq={tr('Solo con palabras desconocidas')}><Interruptor on={a.popupSoloDesconocidas} etiqueta={tr('Solo con palabras desconocidas')} alCambiar={(v) => cambiarAjuste({ popupSoloDesconocidas: v })} /></Fila>}
              <Fila etq={tr('Consultar al pausar')} ayuda={tr('Abre la primera palabra desconocida')}><Interruptor on={a.autoConsultaAlPausar} etiqueta={tr('Consultar al pausar')} alCambiar={(v) => cambiarAjuste({ autoConsultaAlPausar: v })} /></Fila>
            </div>
            <TituloGrupo>{tr('Pausar al interactuar')}</TituloGrupo>
            <div class="grupo">
              <Fila etq={tr('Cuándo')}>
                <Selector etiqueta={tr('Pausar al interactuar')} valor={a.pausaInteraccion} opciones={[['nunca', tr('Nunca')], ['alPasarSubtitulo', tr('Al pasar por el subtítulo')], ['consultaPalabra', tr('Al consultar una palabra')]]} alCambiar={(v) => cambiarAjuste({ pausaInteraccion: v })} />
              </Fila>
              {/* Con «Nunca» no hay pausa que reanudar; esperar al final de la línea solo vale al consultar una palabra. */}
              {a.pausaInteraccion !== 'nunca' && <Fila etq={tr('Reanudar al terminar')}><Interruptor on={a.reanudarAlTerminar} etiqueta={tr('Reanudar al terminar')} alCambiar={(v) => cambiarAjuste({ reanudarAlTerminar: v })} /></Fila>}
              {a.pausaInteraccion === 'consultaPalabra' && <Fila etq={tr('Esperar al final de la línea')}><Interruptor on={a.pausaDiferida} etiqueta={tr('Pausar al final de la línea')} alCambiar={(v) => cambiarAjuste({ pausaDiferida: v })} /></Fila>}
            </div>
          </div>
          <div>
            <TituloGrupo>{tr('Pausa automática')}</TituloGrupo>
            <div class="grupo">
              {/* Una cosa u otra: con las dos encendidas mandaba la segunda, y los segundos de la primera no hacían nada. */}
              <Fila etq={tr('Reanudar tras un tiempo')}><Interruptor on={a.reanudarTras && !a.reanudarDinamico} etiqueta={tr('Reanudar tras un tiempo')} alCambiar={(v) => cambiarAjuste({ reanudarTras: v, ...(v ? { reanudarDinamico: false } : {}) })} /></Fila>
              {a.reanudarTras && !a.reanudarDinamico && <Fila etq={tr('Segundos')}><Paso etiqueta="segundos" valor={a.reanudarSegundos} paso={1} min={1} max={60} alCambiar={(v) => cambiarAjuste({ reanudarSegundos: v })} /></Fila>}
              <Fila etq={tr('Según lo que tardas en leer')}><Interruptor on={a.reanudarDinamico} etiqueta={tr('Reanudar dinámico')} alCambiar={(v) => cambiarAjuste({ reanudarDinamico: v, ...(v ? { reanudarTras: false } : {}) })} /></Fila>
              {a.reanudarDinamico && (
                <>
                  <Fila etq={tr('Palabras por segundo')}><Paso etiqueta={tr('palabras por segundo')} valor={a.velocidadLectura} paso={1} min={1} max={15} alCambiar={(v) => cambiarAjuste({ velocidadLectura: v })} /></Fila>
                  <Fila etq={tr('Pausa mínima')} ayuda={tr('En segundos')}><Paso etiqueta={tr('pausa mínima')} valor={a.duracionMinimaPausa} paso={1} min={0} max={20} alCambiar={(v) => cambiarAjuste({ duracionMinimaPausa: v })} /></Fila>
                </>
              )}
            </div>
            <TituloGrupo>{tr('Audio de las tarjetas')}</TituloGrupo>
            <div class="grupo">
              <Fila etq={tr('Margen inicial')} ayuda={tr('Milisegundos antes de la línea')}><Paso etiqueta={tr('margen inicial')} valor={a.rellenoInicioMs} paso={100} min={0} max={3000} alCambiar={(v) => cambiarAjuste({ rellenoInicioMs: v })} /></Fila>
              <Fila etq={tr('Margen final')} ayuda={tr('Milisegundos después de la línea')}><Paso etiqueta={tr('margen final')} valor={a.rellenoFinMs} paso={100} min={0} max={3000} alCambiar={(v) => cambiarAjuste({ rellenoFinMs: v })} /></Fila>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Atajos ----------

const FILA_CAPTURA = tm('Permitir captura de audio');

const atajosDe = (textos: TextosLengua): { titulo: string; filas: [string, string[]][] }[][] => [
  [
    {
      titulo: tm('Barra'),
      filas: [
        [tm('Fijar o soltar la barra'), [tm('Alt'), '+', 'X']],
        [tm('Mostrarla mientras se mantiene'), [tm('Alt'), '+', 'V']],
        [tm('Abrir el traductor'), [tm('Alt'), '+', 'T']],
      ],
    },
    {
      titulo: tm('Estado de la palabra'),
      filas: [
        [tm('Marcar desconocida'), ['1', '/', 'U']],
        [tm('Rastrear'), ['2', '/', 'T']],
        [tm('Marcar conocida'), ['3', '/', 'K']],
        [tm('Ignorar'), ['4', '/', 'I']],
      ],
    },
    {
      titulo: tm('Diccionario'),
      filas: [
        [tm('Consultar en el diccionario'), [tm('Alt'), '+', 'S']],
        [tm('Consultar en un enlace'), [tm('Shift'), '+', tm('ratón')]],
      ],
    },
  ],
  [
    {
      titulo: tm('Tarjetas'),
      filas: [
        [tm('Crear tarjeta'), ['Q']],
        [tm('Enviar al creador'), ['E']],
        [tm('Cancelar la creación'), [tm('Ctrl'), '+', 'X']],
        [FILA_CAPTURA, []],
      ],
    },
    {
      titulo: tm('Selección'),
      filas: [
        [tm('Marcar el subtítulo'), ['B']],
        [tm('Seleccionar el subtítulo'), ['L']],
        [tm('Unir seleccionados'), ['J']],
        [tm('Limpiar selección'), ['X']],
      ],
    },
  ],
  [
    {
      titulo: tm('Video'),
      filas: [
        [tm('Subtítulo anterior'), ['←', '/', 'A']],
        [tm('Subtítulo siguiente'), ['→', '/', 'D']],
        [tm('Repetir el subtítulo'), ['↓', '/', 'S']],
        [tm('Avanzar 5 s'), [tm('Alt'), '+', '→']],
        [tm('Retroceder 5 s'), [tm('Alt'), '+', '←']],
        [tm('Seleccionado anterior'), [tm('Shift'), '+', '←']],
        [tm('Seleccionado siguiente'), [tm('Shift'), '+', '→']],
      ],
    },
  ],
  [
    {
      titulo: tm('Subtítulos'),
      filas: [
        [tm('Mostrar u ocultar todo'), ['R']],
        [textos.mostrarUOcultar, ['↑', '/', 'W']],
        [tm('Mostrar u ocultar secundarios'), [tm('Shift'), '+', '↑']],
        [textos.desfase, [tm('Alt'), '+', 'I', '/', 'O']],
        [tm('Desfase de secundarios'), [tm('Alt'), '+', tm('Shift'), '+', 'I', '/', 'O']],
        [tm('Generar secundarios'), [tm('Alt'), '+', tm('Shift'), '+', 'G']],
        [tm('Navegador de subtítulos'), ['G']],
        [tm('Copiar el subtítulo'), ['C']],
        [tm('Siguiente palabra desconocida'), ['N']],
        [tm('Siguiente palabra'), [tm('Alt'), '+', 'N']],
      ],
    },
  ],
];

function PanelAtajos() {
  return (
    <div class={`panel-flotante panel-atajos ${claseNavegador()}`} role="dialog" aria-label={tr('Atajos de teclado')}>
      <Cabecera titulo={tr('Atajos de teclado')} icono="teclado" />
      <div class="columnas-atajos">
        {atajosDe(lengua.value.textos).map((col, i) => (
          <div class="atajos-col" key={i}>
            {col.map((g) => (
              <div key={g.titulo}>
                <TituloGrupo>{tr(g.titulo)}</TituloGrupo>
                <div class="grupo grupo-atajos">
                  {g.filas.map(([n, t]) => (
                    <div class="atajo" key={n}>
                      <span>{tr(n)}</span>
                      <Teclas t={n === FILA_CAPTURA ? teclasCaptura() : t} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <p class="nota-grupo pie">{tr('Si un atajo de Chrome no responde, puede que otra extensión lo tenga reservado:')} <button class="enlace" onClick={() => fondo.abrirAtajos()}>{tr('revisar los atajos')}</button>.</p>
    </div>
  );
}

// ---------- Generar ----------

const AYUDA_INTENSIDAD: Record<Ajustes['whisperIntensidad'], string> = {
  auto: tm('Equilibra velocidad y fluidez, y acelera cuando te alejas'),
  suave: tm('La mínima carga, por si estás jugando o editando video'),
  rapida: tm('Siempre a la máxima velocidad segura'),
};

function textoRestante(s: number | null | undefined): string {
  if (s === null || s === undefined || s <= 0) return '';
  if (s < 90) return tr(' · queda menos de 2 min');
  return tr(' · quedan unos {0} min', Math.round(s / 60));
}

function ProgresoWhisper() {
  const w = whisper.value!;
  const conPorcentaje = w.porcentaje !== undefined ? `: ${Math.round(w.porcentaje)} %` : '…';
  const detalle = w.fase === 'descargando'
    ? tr('Descargando el modelo{0}', conPorcentaje)
    : w.fase === 'extrayendo'
      ? tr('Extrayendo el audio{0}', conPorcentaje)
      : w.fase === 'bajando'
        ? tr('Bajando el audio del video{0}', conPorcentaje)
      : w.fase === 'preparando'
        ? tr('Preparando el modelo…')
        : w.fase === 'terminando'
          ? w.desdeArchivo ? tr('Deteniendo…') : tr('Terminando lo que ya se oyó…')
          : w.fase === 'recuperando'
            ? tr('La tarjeta gráfica se reinició. Retomando con calma…')
            : w.pausado
              ? tr('En pausa: la tarjeta gráfica está libre')
              : w.fase === 'procesando'
                ? tr('Transcribiendo{0}{1}', w.desdeArchivo ? conPorcentaje : '…', w.desdeArchivo ? textoRestante(w.restanteS) : '')
                : tr('Escuchando el video…');
  const conBarra = w.porcentaje !== undefined && (w.fase === 'descargando' || w.fase === 'extrayendo' || w.fase === 'bajando' || (w.desdeArchivo && w.fase === 'procesando'));
  return (
    <div class="progreso-linea">
      <div class="fila-texto">
        <span>{detalle}</span>
        {w.fase !== 'terminando' && (
          <span class="botones-whisper">
            <button class="btn chico" onClick={() => pausarWhisper(!w.pausado)}><Icono n={w.pausado ? 'reproducir' : 'pausa'} t={13} /> {w.pausado ? tr('Seguir') : tr('Pausar')}</button>
            <button class="btn chico" onClick={detenerWhisper}><Icono n="detener" t={13} /> {tr('Detener')}</button>
          </span>
        )}
      </div>
      {conBarra && <div class="barra-progreso"><div style={{ width: `${w.porcentaje}%` }} /></div>}
      <div class="ayuda">{w.lineas === 1 ? tr('1 línea') : tr('{0} líneas', w.lineas)}{w.modelo ? ` · ${tr(w.modelo)}` : ''}{w.dispositivo ? ` · ${tr(w.dispositivo)}` : ''}</div>
    </div>
  );
}

function SeccionWhisper() {
  const a = ajustes.value;
  const w = whisper.value;
  const archivo = transcribeArchivo.value;
  const conAyudante = !archivo && !!ayudante.value;
  const enteroDeUnaVez = archivo || conAyudante;
  // Haas-ja y Parakeet hacen en un minuto lo que Whisper en cinco: el aviso dice lo que tardará este video.
  const modeloRapido = !!MODELOS_WHISPER[modeloQueTranscribiria()].tdt;
  useEffect(() => {
    if (!archivo) actualizarAyudante();
  }, [archivo]);
  return (
    <>
      <TituloGrupo icono="ondas">{tr('Transcribir en tu equipo')}</TituloGrupo>
      <div class="grupo">
        <div class="bloque-generar">
          <p>{enteroDeUnaVez ? (modeloRapido ? tr('Transcribe el audio entero sin esperar a reproducirlo: 30 minutos tardan alrededor de uno. El audio no sale de tu equipo.') : tr('Transcribe el audio entero sin esperar a reproducirlo: 30 minutos tardan unos 5. El audio no sale de tu equipo.')) : tr('Escucha el video mientras se reproduce, así que los subtítulos llegan con unos segundos de retraso.')}</p>
          {sinAceleracion.value && <p class="nota-grupo">{tr('Con la aceleración por hardware apagada, el navegador no ofrece la GPU: Whisper correrá en el procesador y tardará mucho más.')}</p>}
        </div>
        <Fila etq={tr('Modelo')}>
          <select class="selector" aria-label={tr('Modelo de transcripción')} title={a.whisperModelo === 'auto' ? tr(MODELO_AUTOMATICO) : tr(MODELOS_WHISPER[a.whisperModelo]?.descripcion ?? '')} value={a.whisperModelo} disabled={!!w} onChange={(e) => cambiarAjuste({ whisperModelo: e.currentTarget.value as OpcionModelo })}>
            <option value="auto">{tr('Automático')}</option>
            {(Object.entries(MODELOS_WHISPER) as [ModeloWhisper, (typeof MODELOS_WHISPER)[ModeloWhisper]][]).filter(([id]) => modeloSirveParaLengua(id, a.idiomaObjetivo)).map(([id, m]) => <option key={id} value={id}>{tr(m.nombre)} · {m.mb >= 1000 ? `${(m.mb / 1000).toFixed(1)} GB` : `${m.mb} MB`}</option>)}
          </select>
        </Fila>
        {enteroDeUnaVez && (
          <Fila etq={tr('Intensidad')} ayuda={tr(AYUDA_INTENSIDAD[a.whisperIntensidad])}>
            <div class="segmentado" role="radiogroup" aria-label={tr('Intensidad de la transcripción')}>
              {([['auto', tr('Automática')], ['suave', tr('Suave')], ['rapida', tr('Rápida')]] as const).map(([v, n]) => (
                <button key={v} class={a.whisperIntensidad === v ? 'activo' : ''} role="radio" aria-checked={a.whisperIntensidad === v} onClick={() => cambiarAjuste({ whisperIntensidad: v })}>{n}</button>
              ))}
            </div>
          </Fila>
        )}
        <Fila etq={tr('Corregir con Claude')} ayuda={tr(lengua.value.textos.corregirResultado)}>
          <Interruptor on={a.whisperCorregir} etiqueta={tr('Corregir con Claude')} alCambiar={(v) => cambiarAjuste({ whisperCorregir: v })} />
        </Fila>
        {w ? (
          <ProgresoWhisper />
        ) : (
          <div class="bloque-generar">
            <button class="btn bloque" onClick={() => iniciarWhisper()}><Icono n={enteroDeUnaVez ? 'ondas' : 'microfono'} t={16} /> {archivo ? tr('Transcribir el archivo') : conAyudante ? tr('Transcribir el video') : tr('Empezar a transcribir')}</button>
            {conAyudante && <button class="btn chico fantasma bloque" onClick={() => iniciarWhisper(true)}><Icono n="microfono" t={14} /> {tr('Transcribir mientras se reproduce')}</button>}
            {!enteroDeUnaVez && !capturaActiva.value && <p class="nota-grupo">{tr('Necesita oír el video: activa antes la captura de audio con')} <Teclas t={teclasCaptura()} /></p>}
            {!enteroDeUnaVez && <p class="nota-grupo">{tr('Con el ayudante local no hace falta reproducirlo: mira cómo instalarlo en')} <button class="enlace" onClick={() => fondo.abrirApp('ajustes')}>{tr('Ajustes')}</button>.</p>}
          </div>
        )}
      </div>
    </>
  );
}

/** Whisper acierta los tiempos pero no siempre las palabras; la letra verdadera suele estar en un comentario. */
function SeccionLetra() {
  const hayLetra = versosDeLetra(letraPegada.value).length > 0;
  const transcribiendo = !!whisper.value;
  const hayTiempos = lineasObjetivo.value.length > 0;
  return (
    <>
      <TituloGrupo icono="musica" ia>{tr('Letra de la canción')}</TituloGrupo>
      <div class="grupo">
        <div class="bloque-generar">
          <p>{tr('Whisper acierta los tiempos, pero no siempre las palabras. Pega aquí la letra, por ejemplo la de un comentario, y Claude la coloca sobre esos tiempos. Las palabras salen tal cual de tu letra.')}</p>
          <textarea class="campo area-letra" lang={lengua.value.id} rows={5} aria-label={tr('Letra de la canción')} placeholder={tr('Un verso por línea…')} value={letraPegada.value} disabled={ajustandoLetra.value} onInput={(e) => (letraPegada.value = e.currentTarget.value)} onKeyDown={(e) => e.stopPropagation()} />
          {ajustandoLetra.value ? (
            <p class="nota-grupo">{tr('Ajustando la letra a los tiempos…')}</p>
          ) : transcribiendo ? (
            hayLetra && <p class="nota-grupo">{tr('Cuando termine la transcripción, la letra se ajustará sola.')}</p>
          ) : (
            <button class="btn ia bloque" disabled={!hayLetra} onClick={() => (hayTiempos ? ajustarLetra() : iniciarWhisper())}><Icono n="musica" t={16} /> {hayTiempos ? tr('Ajustar la letra a estos tiempos') : tr('Transcribir y ajustar la letra')}</button>
          )}
        </div>
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
  const nombreSecundaria = pistas.value.find((p) => p.id === idSecundaria.value)?.nombre;
  const generarConVoz = sitio !== 'netflix' && (
    <>
      <SeccionWhisper />
      <SeccionLetra />
    </>
  );
  return (
    <div class={`panel-flotante panel-generar ${claseNavegador()}`} role="dialog" aria-label={tr('Generar subtítulos')}>
      <Cabecera titulo={tr('Subtítulos con IA')} icono="varita" />

      {!hayObjetivo && generarConVoz}

      <TituloGrupo icono="traducir" ia>{tr('Traducir al idioma de apoyo')}</TituloGrupo>
      <div class="grupo">
        <Fila etq={tr('Idioma')}>
          <Selector<string> etiqueta={tr('Idioma de la traducción')} valor={a.idiomaSecundario} opciones={lenguasTraduccion(a.idiomaObjetivo).map((l) => [l.id, tr(l.nombre)] as [string, string])} alCambiar={(v) => {
            cambiarAjuste({ idiomaSecundario: v, idiomaTraduccion: LENGUAS.find((l) => l.id === v)?.valor ?? v });
          }} />
        </Fila>
        {g?.tipo === 'secundarios' ? (
          <div class="progreso-linea">
            <div class="fila-texto"><span>{tr('Traduciendo {0} de {1}, empezando por donde vas…', g.hechas, g.total)}</span><button class="btn chico" onClick={cancelarGeneracion}>{tr('Cancelar')}</button></div>
            <div class="progreso-ia"><div style={{ width: `${(g.hechas / Math.max(g.total, 1)) * 100}%` }} /></div>
          </div>
        ) : (
          <div class="bloque-generar">
            <button class="btn primario bloque" disabled={!hayObjetivo || !!g} onClick={() => generarSecundarios()}><Icono n="traducir" t={16} /> {tr('Traducir al')} {nombreIdioma(a.idiomaSecundario).toLowerCase()}</button>
            {!hayObjetivo && <p class="nota-grupo">{tr(lengua.value.textos.primeroNecesitas)}</p>}
          </div>
        )}
      </div>

      {hayObjetivo && (
        <>
          <TituloGrupo icono="sello" ia>{tr('Corregir errores de reconocimiento')}</TituloGrupo>
          <div class="grupo">
            <div class="bloque-generar">
              <p>{tr('Arregla homófonos y palabras mal oídas de los subtítulos automáticos, usando el título y todo el texto como contexto. No te pregunta nada y empieza por donde vas.')}</p>
            </div>
            {sitio !== 'netflix' && (
              <Fila etq={tr('Corregir los automáticos al abrirlos')}>
                <Interruptor on={a.corregirAutomaticos} etiqueta={tr('Corregir los automáticos al abrirlos')} alCambiar={(v) => cambiarAjuste({ corregirAutomaticos: v })} />
              </Fila>
            )}
            {pistaObjetivoEsLetra() ? (
              <div class="bloque-generar">
                <p class="nota-grupo">{tr('Esta pista sale de la letra que pegaste, así que no hay nada que corregir.')}</p>
              </div>
            ) : c ? (
              <div class="progreso-linea">
                <div class="fila-texto"><span>{tr('Revisadas {0} de {1} · {2} corregidas', c.hechas, c.total, c.cambiadas)}</span><button class="btn chico" onClick={cancelarCorreccion}>{tr('Cancelar')}</button></div>
                <div class="progreso-ia"><div style={{ width: `${(c.hechas / Math.max(c.total, 1)) * 100}%` }} /></div>
              </div>
            ) : (
              <div class="bloque-generar">
                <button class="btn ia bloque" onClick={() => corregirSubtitulos(true)}><Icono n="sello" t={16} /> {tr('Corregir estos subtítulos')}</button>
                {originales.value.size > 0 && <p class="nota-grupo">{originales.value.size === 1 ? tr('1 línea corregida.') : tr('{0} líneas corregidas.', originales.value.size)} {tr('En el navegador de subtítulos puedes ver qué decían antes.')}</p>}
              </div>
            )}
          </div>
        </>
      )}

      {hayObjetivo && (
        <>
          <TituloGrupo icono="ia" ia>{tr('Revisar lecturas y gramática')}</TituloGrupo>
          <div class="grupo">
            <div class="bloque-generar">
              <p>{tr(lengua.value.textos.revisionAyuda)}</p>
            </div>
            <Fila etq={tr('Revisar a medida que avanza')}>
              <Interruptor on={a.analisisAutomatico} etiqueta={tr('Revisar a medida que avanza')} alCambiar={(v) => cambiarAjuste({ analisisAutomatico: v })} />
            </Fila>
            {r ? (
              <div class="progreso-linea">
                <div class="fila-texto"><span>{tr('Revisando {0} de {1} líneas…', r.hechas, r.total)}</span></div>
                <div class="progreso-ia"><div style={{ width: `${(r.hechas / Math.max(r.total, 1)) * 100}%` }} /></div>
              </div>
            ) : (
              <div class="bloque-generar">
                <button class="btn ia bloque" onClick={() => iniciarAnalisisProfundo(true)}><Icono n="ia" t={16} /> {tr('Revisar todo el video')}</button>
              </div>
            )}
          </div>
        </>
      )}

      <TituloGrupo icono="traducir" ia>{tr(lengua.value.textos.crearDesdeOtro)}</TituloGrupo>
      <div class="grupo">
        <div class="bloque-generar">
          <p>{tr(lengua.value.textos.crearDesdeOtroAyuda)}</p>
        </div>
        {g?.tipo === 'objetivo' ? (
          <div class="progreso-linea">
            <div class="fila-texto"><span>{tr('Traduciendo {0} de {1}…', g.hechas, g.total)}</span><button class="btn chico" onClick={cancelarGeneracion}>{tr('Cancelar')}</button></div>
            <div class="progreso-ia"><div style={{ width: `${(g.hechas / Math.max(g.total, 1)) * 100}%` }} /></div>
          </div>
        ) : (
          <div class="bloque-generar">
            <button class="btn ia bloque" disabled={!haySecundaria || !!g} onClick={() => traducirALengua()}><Icono n="traducir" t={16} /> {nombreSecundaria ? tr(lengua.value.textos.traducirPista, nombreSecundaria) : tr(lengua.value.textos.traducirA)}</button>
            {!haySecundaria && <p class="nota-grupo">{tr('Elige primero unos subtítulos secundarios en la pestaña Subtítulos.')}</p>}
          </div>
        )}
      </div>

      {/* Netflix casi siempre trae subtítulos y su audio no se puede procesar por adelantado. */}
      {hayObjetivo && generarConVoz}
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
    <div class={`panel-flotante panel-traductor ${claseNavegador()}`} role="dialog" aria-label={tr('Traductor')}>
      <Cabecera titulo={tr('Traductor')} icono="traducir" ia />
      <textarea class="campo" lang={lengua.value.id} aria-label={tr('Texto a traducir')} placeholder={lengua.value.ejemplos.escribir} value={texto.value} onInput={(e) => (texto.value = e.currentTarget.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) traducir(); e.stopPropagation(); }} />
      <div class="accion-traducir">
        <Teclas t={['Ctrl', '+', 'Enter']} />
        <button class="btn ia" disabled={cargando.value || !texto.value.trim()} onClick={traducir}><Icono n="ia" t={16} /> {tr('Traducir')}</button>
      </div>
      {error.value && (
        <div class="panel-ia-error separada" role="alert">
          <Icono n="aviso" t={16} />
          <span>{error.value}</span>
          <button class="btn chico" onClick={traducir}>{tr('Reintentar')}</button>
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
    <div class={`panel-flotante panel-comprension ${claseNavegador()}`} role="dialog" aria-label={tr('Comprensión')}>
      <Cabecera titulo={tr('Comprensión')} icono="rosca" />
      <div class="comp-hero">
        <Anillo valor={e.comprension} t={88} grosor={8}>{e.comprension}<small>%</small></Anillo>
        <div>
          <h4>{NOMBRES_NIVEL[e.nivel]}</h4>
          <p>
            {e.recomendadas === 1 ? tr('1 frase recomendada') : tr('{0} frases recomendadas', numero(e.recomendadas))}
            {e.frecuenciaMedia !== undefined && <><br />{tr('Frecuencia media de esas palabras: {0}', numero(e.frecuenciaMedia))}</>}
          </p>
        </div>
      </div>
      <TituloGrupo>{tr('Palabras únicas')}</TituloGrupo>
      <div class="grupo comp-caja">
        <div class="grafico-comp" aria-hidden="true">
          <div class="p-conocida" style={{ width: `${(u.conocidas / total) * 100}%` }} />
          <div class="p-desconocida" style={{ width: `${(u.desconocidas / total) * 100}%` }} />
          <div class="p-ignorada" style={{ width: `${(u.ignoradas / total) * 100}%` }} />
        </div>
        <div class="comp-leyenda">
          <div class="comp-dato"><b><i class="p-conocida" />{numero(u.conocidas)}</b><span>{tr('Conocidas')}</span></div>
          <div class="comp-dato"><b><i class="p-desconocida" />{numero(u.desconocidas)}</b><span>{tr('Desconocidas')}</span></div>
          <div class="comp-dato"><b><i class="p-ignorada" />{numero(u.ignoradas)}</b><span>{tr('Ignoradas')}</span></div>
        </div>
      </div>
      <TituloGrupo>{tr('Frases')}</TituloGrupo>
      <div class="grupo">
        <div class="dato"><span>{tr('Todas las palabras conocidas')}</span><b>{numero(e.frases.conocidas)}</b></div>
        <div class="dato"><span>{tr('Una palabra desconocida')}</span><b>{numero(e.frases.unaDesconocida)}</b></div>
        <div class="dato"><span>{tr('Varias desconocidas')}</span><b>{numero(e.frases.variasDesconocidas)}</b></div>
      </div>
      {prioritarias.length > 0 && (
        <>
          <TituloGrupo>{tr('Las que más te ayudarían aquí')}</TituloGrupo>
          <div class="chips-palabras">
            {prioritarias.map(({ palabra, veces }) => (
              <span class="chip-palabra" key={palabra.clave} title={palabra.glosa} lang={lengua.value.id}>{palabra.lema} <small>×{veces}</small></span>
            ))}
          </div>
        </>
      )}
      <ResumenGramatica />
      <p class="nota-grupo pie">{tr('Las frases recomendadas tienen una sola palabra nueva, de las {0} más frecuentes.', numero(a.frecuenciaMaxRecomendada))}</p>
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
      <TituloGrupo>{tr('Gramática de este video')}</TituloGrupo>
      <div class="chips-palabras">
        {lista.slice(0, 40).map(([patron, e]) => (
          <button key={patron} class={`chip-gram n-${e.nivel ?? ''}`} title={tr('{0}. Ir al primer ejemplo.', tr(e.significado))} onClick={() => irALinea(e.primera)}>
            <span lang={lengua.value.id}>{patron}</span>{e.nivel && <small>{e.nivel}</small>}{e.veces > 1 && <small>×{e.veces}</small>}
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
