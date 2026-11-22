// Memoria: el repaso espaciado propio, para quien no usa Anki (y el destino de las tarjetas por omisión). Tres vistas:
// repasar lo de hoy, todas las tarjetas, y el progreso.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { type Card, fsrs, type Grade } from 'ts-fsrs';
import { type Ajustes, guardarAjustes } from '../compartido/ajustes';
import { motor } from '../compartido/rpc';
import type { BorradorTarjeta, TarjetaMemoria } from '../compartido/tipos';
import { bcp47Actual, numero, tm, tr } from '../compartido/i18n';
import { estadoDe, type EstadoMemoria, masNuevasHoy } from '../nucleo/memoria';
import { Icono } from '../ui/iconos';
import { lengua } from '../ui/lengua';
import { Pista } from '../ui/Pista';
import { useEsperar } from '../ui/preparacion';
import { creadorAbierto } from './estadoApp';
import { BotonBorrar, Cabecera, Vacio } from './Piezas';
import { ProgresoMemoria } from './ProgresoMemoria';

const programador = fsrs({ enable_fuzz: false });

/** «<1 min», «10 min», «3 d»: lo justo para decidir. */
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
  return `${numero(d / 365, { maximumFractionDigits: 1 })} a`;
}

/** Cuándo volverá la tarjeta con cada respuesta. Con el azar del motor, es orientativo. */
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

const NOMBRE_ESTADO_MEMORIA: Record<EstadoMemoria, string> = {
  nueva: tm('Nueva'),
  aprendiendo: tm('Aprendiendo'),
  repaso: tm('En repaso'),
  suspendida: tm('Suspendida'),
};

const medio = (m: { tipo: string; datos?: string; url?: string }) => (m.datos ? `data:${m.tipo};base64,${m.datos}` : m.url);

/**
 * Un botón pulsado con el ratón no se queda con el foco: Espacio y las teclas del repaso siguen siendo del repaso, y no
 * vuelven a pulsar «Suspender» en la tarjeta siguiente. Con el teclado se sigue pudiendo llegar a él.
 */
const sinFoco = (e: MouseEvent) => e.preventDefault();

type Vista = 'repasar' | 'tarjetas' | 'progreso';

export function Memoria({ ajustes }: { ajustes: Ajustes }) {
  const [vista, fijarVista] = useState<Vista>('repasar');
  const VISTAS: { id: Vista; nombre: string; icono: 'tarjetas' | 'lista' | 'grafico' }[] = [
    { id: 'repasar', nombre: tr('Repasar'), icono: 'tarjetas' },
    { id: 'tarjetas', nombre: tr('Tarjetas'), icono: 'lista' },
    { id: 'progreso', nombre: tr('Progreso'), icono: 'grafico' },
  ];
  return (
    <div class="ap-lienzo ap-memoria">
      <Cabecera titulo={tr('Memoria')} sub={tr('Repaso espaciado con FSRS para las tarjetas que no envías a Anki.')}>
        <div class="segmentado ap-memoria-vistas" role="tablist" aria-label={tr('Memoria')}>
          {VISTAS.map((v) => (
            <button key={v.id} role="tab" aria-selected={vista === v.id} class={vista === v.id ? 'activo' : ''} onMouseDown={sinFoco} onClick={() => fijarVista(v.id)}>
              <Icono n={v.icono} t={15} /> {v.nombre}
            </button>
          ))}
        </div>
      </Cabecera>
      {vista === 'repasar' && <Repasar ajustes={ajustes} />}
      {vista === 'tarjetas' && <ListaTarjetas />}
      {vista === 'progreso' && <ProgresoMemoria />}
    </div>
  );
}

// ---------- Repasar ----------

function Repasar({ ajustes }: { ajustes: Ajustes }) {
  const [cola, fijarCola] = useState<TarjetaMemoria[]>([]);
  const [resumen, fijarResumen] = useState<Awaited<ReturnType<typeof motor.memoriaResumen>> | null>(null);
  const [volteada, fijarVolteada] = useState(false);
  const [cargada, fijarCargada] = useState(false);
  const [deshacer, fijarDeshacer] = useState(false);
  const [editando, fijarEditando] = useState<TarjetaMemoria | null>(null);
  const esperar = useEsperar();
  const audio = useRef<HTMLAudioElement | null>(null);

  const cargar = async (primero?: string) => {
    let lista = await motor.memoriaPendientes(50);
    // Lo deshecho vuelve delante, aunque por su vencimiento le tocara más tarde.
    if (primero) {
      const t = lista.find((x) => x.id === primero) ?? (await motor.memoriaObtener(primero));
      if (t) lista = [t, ...lista.filter((x) => x.id !== primero)];
    }
    fijarCola(lista);
    fijarResumen(await motor.memoriaResumen());
    fijarVolteada(false);
    fijarCargada(true);
    // Otra tarjeta: un botón que se quedó con el foco (Eliminar pide confirmación) no debe recibir el Espacio siguiente.
    const foco = document.activeElement;
    if (foco instanceof HTMLElement && foco.closest('.ap-repaso, .ap-memoria-fin')) foco.blur();
  };
  useEffect(() => {
    esperar(cargar()).catch(console.error);
  }, []);

  const t = cola[0];
  const plazos = useMemo(() => (t ? intervalos(t) : null), [t?.id, t?.vence]);
  const sonar = () => {
    const a = t?.borrador.audioFrase[0] ?? t?.borrador.audioPalabra[0];
    if (!a) return;
    audio.current?.pause();
    audio.current = new Audio(medio(a));
    audio.current.play().catch(() => {});
  };
  // La frase suena sola al enseñar la tarjeta, si así se quiere.
  useEffect(() => {
    if (t && ajustes.memoriaAudio) sonar();
    return () => audio.current?.pause();
  }, [t?.id]);

  const responder = async (nota: 1 | 2 | 3 | 4) => {
    if (!t) return;
    await motor.memoriaResponder(t.id, nota);
    fijarDeshacer(true);
    await cargar();
  };
  const alDeshacer = async () => {
    const id = await motor.memoriaDeshacer();
    fijarDeshacer(false);
    if (id) await cargar(id);
  };
  const alSuspender = async () => {
    if (!t) return;
    await motor.memoriaSuspender(t.id, true);
    fijarDeshacer(false);
    await cargar();
  };

  // Espacio para ver la respuesta y del 1 al 4 para valorarla, como en Anki; Z deshace, E edita y R repite el audio.
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || editando) return;
      const objetivo = e.composedPath()[0] as HTMLElement | undefined;
      if (objetivo && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(objetivo.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && deshacer) {
        e.preventDefault();
        alDeshacer();
        return;
      }
      if (!t) return;
      if (!volteada && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        e.stopPropagation();
        fijarVolteada(true);
      } else if (volteada && /^[1-4]$/.test(e.key)) {
        e.stopPropagation();
        responder(Number(e.key) as 1 | 2 | 3 | 4);
      } else if (k === 'e') {
        e.preventDefault();
        fijarEditando(t);
      } else if (k === 'r') {
        e.preventDefault();
        sonar();
      }
    };
    window.addEventListener('keydown', alPulsar, true);
    return () => window.removeEventListener('keydown', alPulsar, true);
  }, [t?.id, volteada, deshacer, editando]);

  const hoy = resumen?.hoy;
  // Con el límite del día cumplido y nuevas esperando, se pueden pedir unas cuantas más, solo por hoy.
  const masHoy = Math.min(10, resumen?.nuevasEsperan ?? 0);
  const estudiarMas = async () => {
    await guardarAjustes((a) => ({ memoriaExtra: masNuevasHoy(a.memoriaExtra, Date.now(), masHoy) }));
    await cargar();
  };
  return (
    <>
      <Pista a={ajustes} id="memoria">
        {tr('Aquí repasas tus tarjetas: pulsa «Ver respuesta» (Espacio) y di cuánto te costó, del 1 al 4. Eso decide cuándo vuelve cada una.')}
      </Pista>
      {resumen && resumen.total > 0 && (
        <dl class="ap-memoria-hoy">
          <div><dd class="num">{numero(resumen.pendientes)}</dd><dt>{tr('Por repasar')}</dt></div>
          <div><dd class="num">{numero(resumen.nuevasQuedan)}</dd><dt>{tr('Nuevas hoy')}</dt></div>
          <div><dd class="num">{numero(hoy?.repasos ?? 0)}</dd><dt>{tr('Repasadas hoy')}</dt></div>
          <div><dd class="num">{numero(resumen.total)}</dd><dt>{tr('En total')}</dt></div>
        </dl>
      )}

      {cargada && !t ? (
        <Vacio icono="sello" titulo={resumen?.total ? tr('Todo al día') : tr('Todavía no hay tarjetas')}>
          {resumen?.total ? (
            <p>
              {hoy?.repasos
                ? tr('Hoy has repasado {0}: {1} a la primera o casi. Las demás volverán cuando toque.', numero(hoy.repasos), numero(hoy.aciertos))
                : tr('No queda nada por repasar ahora mismo. Las tarjetas volverán cuando toque.')}
            </p>
          ) : (
            <p>{tr('Las tarjetas que crees con destino Memoria aparecerán aquí.')}</p>
          )}
          <div class="ap-memoria-fin">
            {deshacer && <button class="btn" onClick={alDeshacer}><Icono n="deshacer" t={15} /> {tr('Deshacer')} <kbd class="tecla">Z</kbd></button>}
            {masHoy > 0 && (
              <button class="btn" onClick={estudiarMas} data-tip={tr('Solo por hoy: mañana vuelve el límite de Ajustes.')}>
                <Icono n="mas" t={15} /> {masHoy === 1 ? tr('Estudiar 1 nueva más hoy') : tr('Estudiar {0} nuevas más hoy', numero(masHoy))}
              </button>
            )}
            <button class="btn primario" onClick={() => (creadorAbierto.value = true)}><Icono n="mas" t={15} /> {tr('Crear tarjeta')}</button>
          </div>
        </Vacio>
      ) : t ? (
        <div class="ap-repaso">
          <div class={`ap-naipe ${volteada ? 'volteada' : ''} ${cola.length > 1 ? 'mazo' : ''}`} key={t.id}>
            {estadoDe(t as never) === 'nueva' && <span class="chip ap-naipe-nueva">{tr('Nueva')}</span>}
            <div class="ap-naipe-frente" lang={lengua.value.id} dangerouslySetInnerHTML={{ __html: t.frente }} />
            {(t.borrador.audioFrase[0] || t.borrador.audioPalabra[0]) && (
              <button class="btn chico" onMouseDown={sinFoco} onClick={sonar}><Icono n="altavoz" t={15} /> {tr('Escuchar')} <kbd class="tecla">R</kbd></button>
            )}
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
            <div class="ap-notas" role="group" aria-label={tr('¿Cómo te ha ido?')}>
              {NOTAS.map((n) => (
                <button key={n.nota} class={`ap-nota ${n.clase}`} onClick={() => responder(n.nota)}>
                  <b>{tr(n.nombre)}</b>
                  <span class="num">{plazos?.[n.nota]}</span>
                  <kbd class="tecla">{n.nota}</kbd>
                </button>
              ))}
            </div>
          )}
          <div class="ap-repaso-herramientas">
            <button class="btn fantasma chico" disabled={!deshacer} onMouseDown={sinFoco} onClick={alDeshacer}><Icono n="deshacer" t={14} /> {tr('Deshacer')} <kbd class="tecla">Z</kbd></button>
            <button class="btn fantasma chico" onMouseDown={sinFoco} onClick={() => fijarEditando(t)}><Icono n="lapiz" t={14} /> {tr('Editar')} <kbd class="tecla">E</kbd></button>
            <button class="btn fantasma chico" onMouseDown={sinFoco} onClick={alSuspender} data-tip={tr('No vuelve a salir hasta que la reactives en Tarjetas')}><Icono n="pausa" t={14} /> {tr('Suspender')}</button>
            <BotonBorrar etiqueta={tr('Eliminar esta tarjeta')} texto={tr('Eliminar')} clase="btn fantasma chico" alBorrar={async () => { await motor.memoriaEliminar(t.id); fijarDeshacer(false); await cargar(); }} />
          </div>
        </div>
      ) : null}
      {editando && <EditarTarjeta t={editando} alCerrar={() => fijarEditando(null)} alGuardar={async () => { fijarEditando(null); await cargar(t?.id); }} />}
    </>
  );
}

// ---------- Editar ----------

const CAMPOS: { id: keyof BorradorTarjeta; nombre: string; largo?: boolean; lengua?: boolean }[] = [
  { id: 'palabra', nombre: tm('Palabra'), lengua: true },
  { id: 'lectura', nombre: tm('Lectura'), lengua: true },
  { id: 'frase', nombre: tm('Frase'), largo: true, lengua: true },
  { id: 'traduccion', nombre: tm('Traducción'), largo: true },
  { id: 'notas', nombre: tm('Notas'), largo: true },
];

export function EditarTarjeta({ t, alCerrar, alGuardar }: { t: TarjetaMemoria; alCerrar: () => void; alGuardar: () => void }) {
  const [valores, fijarValores] = useState(() => Object.fromEntries(CAMPOS.map((c) => [c.id, String(t.borrador[c.id] ?? '')])) as Record<string, string>);
  const [guardando, fijarGuardando] = useState(false);
  const primero = useRef<HTMLInputElement>(null);
  // Antes de pintar: un diálogo que ya se ve tiene que atender a Escape desde el primer momento, y la primera tecla, ir
  // al primer campo. Escape no llega al repaso, que lo tomaría por suyo.
  useLayoutEffect(() => {
    primero.current?.focus();
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      alCerrar();
    };
    window.addEventListener('keydown', escape, true);
    return () => window.removeEventListener('keydown', escape, true);
  }, []);
  const guardar = async (e: Event) => {
    e.preventDefault();
    fijarGuardando(true);
    try {
      await motor.memoriaEditar(t.id, valores);
      alGuardar();
    } finally {
      fijarGuardando(false);
    }
  };
  return (
    <div class="ap-modal-fondo" role="presentation" onClick={(e) => e.target === e.currentTarget && alCerrar()}>
      <div class="ap-modal ap-dialogo ap-editar-tarjeta" role="dialog" aria-modal="true" aria-label={tr('Editar la tarjeta')}>
        <button type="button" class="btn-icono chico ap-modal-cerrar" aria-label={tr('Cerrar')} onClick={alCerrar}><Icono n="cerrar" t={15} /></button>
        <h2>{tr('Editar la tarjeta')}</h2>
        <form class="ap-dialogo-form" onSubmit={guardar}>
          {CAMPOS.map((c, i) => (
            <label key={c.id} class="ap-dialogo-campo">
              <span>{tr(c.nombre)}</span>
              {c.largo ? (
                <textarea class="campo" rows={c.id === 'frase' ? 3 : 2} lang={c.lengua ? lengua.value.id : undefined} value={valores[c.id]} onInput={(e) => fijarValores({ ...valores, [c.id]: e.currentTarget.value })} />
              ) : (
                <input ref={i === 0 ? primero : undefined} class="campo" lang={c.lengua ? lengua.value.id : undefined} value={valores[c.id]} onInput={(e) => fijarValores({ ...valores, [c.id]: e.currentTarget.value })} />
              )}
            </label>
          ))}
          <div class="ap-dialogo-botones">
            <button type="button" class="btn fantasma" onClick={alCerrar}>{tr('Cancelar')}</button>
            <button type="submit" class="btn primario" disabled={guardando}>{tr('Guardar')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------- Todas las tarjetas ----------

type Filtro = EstadoMemoria | 'todas';
const FILTROS: { id: Filtro; nombre: string }[] = [
  { id: 'todas', nombre: tm('Todas') },
  { id: 'nueva', nombre: tm('Nuevas') },
  { id: 'aprendiendo', nombre: tm('Aprendiendo') },
  { id: 'repaso', nombre: tm('En repaso') },
  { id: 'suspendida', nombre: tm('Suspendidas') },
];

/** «Hoy», «mañana», «dentro de 5 días»: cuándo vuelve, en el idioma de la interfaz y no en el del navegador. */
function cuandoVuelve(vence: number, ahora = Date.now()): string {
  const dias = Math.round((new Date(vence).setHours(0, 0, 0, 0) - new Date(ahora).setHours(0, 0, 0, 0)) / 86400000);
  if (dias <= 0) return tr('Hoy');
  return new Intl.RelativeTimeFormat(bcp47Actual(), { numeric: 'auto' }).format(dias, 'day');
}

function ListaTarjetas() {
  const [tarjetas, fijarTarjetas] = useState<TarjetaMemoria[]>([]);
  const [filtro, fijarFiltro] = useState<Filtro>('todas');
  const [busqueda, fijarBusqueda] = useState('');
  const [orden, fijarOrden] = useState<'vence' | 'creada'>('vence');
  const [editando, fijarEditando] = useState<TarjetaMemoria | null>(null);
  const [limite, fijarLimite] = useState(200);
  const esperar = useEsperar();
  const cargar = async () => fijarTarjetas(await motor.memoriaListar());
  useEffect(() => {
    esperar(cargar()).catch(console.error);
  }, []);

  const q = busqueda.trim().toLowerCase();
  const filtradas = useMemo(
    () =>
      tarjetas
        .filter((t) => filtro === 'todas' || estadoDe(t as never) === filtro)
        .filter((t) => !q || [t.borrador.palabra, t.borrador.lectura, t.borrador.frase, t.borrador.traduccion].some((x) => x?.toLowerCase().includes(q)))
        // Por cuándo vuelven: las suspendidas no vuelven, y van al final.
        .sort((a, b) => (orden === 'vence' ? Number(!!a.suspendida) - Number(!!b.suspendida) || a.vence - b.vence : b.creada - a.creada)),
    [tarjetas, filtro, q, orden]
  );
  const cuantas = useMemo(() => {
    const c: Record<Filtro, number> = { todas: tarjetas.length, nueva: 0, aprendiendo: 0, repaso: 0, suspendida: 0 };
    for (const t of tarjetas) c[estadoDe(t as never)]++;
    return c;
  }, [tarjetas]);

  if (!tarjetas.length) {
    return (
      <Vacio icono="tarjetas" titulo={tr('Todavía no hay tarjetas')}>
        <p>{tr('Las tarjetas que crees con destino Memoria aparecerán aquí.')}</p>
      </Vacio>
    );
  }
  return (
    <>
      <div class="ap-filtros">
        <label class="ap-busqueda-mini">
          <Icono n="buscar" t={16} />
          <input aria-label={tr('Buscar tarjeta')} placeholder={tr('Buscar')} value={busqueda} onInput={(e) => fijarBusqueda(e.currentTarget.value)} />
        </label>
        <div class="segmentado" role="radiogroup" aria-label={tr('Filtrar por estado')}>
          {FILTROS.map((f) => (
            <button key={f.id} role="radio" aria-checked={filtro === f.id} class={filtro === f.id ? 'activo' : ''} onClick={() => fijarFiltro(f.id)}>
              {tr(f.nombre)} <span class="num">{numero(cuantas[f.id])}</span>
            </button>
          ))}
        </div>
        <select class="selector" aria-label={tr('Ordenar')} value={orden} onChange={(e) => fijarOrden(e.currentTarget.value as typeof orden)}>
          <option value="vence">{tr('Por cuándo vuelven')}</option>
          <option value="creada">{tr('Más recientes')}</option>
        </select>
      </div>
      <ol class="ap-lista-tarjetas">
        {filtradas.slice(0, limite).map((t) => {
          const estado = estadoDe(t as never);
          return (
            <li key={t.id} class={`ap-fila-tarjeta ${estado}`}>
              <div class="ap-fila-tarjeta-texto">
                <b lang={lengua.value.id}>{t.borrador.palabra || t.borrador.frase}</b>
                {t.borrador.palabra && t.borrador.frase && <span lang={lengua.value.id}>{t.borrador.frase}</span>}
              </div>
              <span class={`chip ap-estado-memoria ${estado}`}>{tr(NOMBRE_ESTADO_MEMORIA[estado])}</span>
              <span class="ap-fila-tarjeta-vuelve num">{estado === 'suspendida' ? '—' : cuandoVuelve(t.vence)}</span>
              <div class="ap-fila-tarjeta-acciones">
                <button class="btn-icono chico" aria-label={tr('Editar')} data-tip={tr('Editar')} onClick={() => fijarEditando(t)}><Icono n="lapiz" t={15} /></button>
                {estado === 'suspendida' ? (
                  <button class="btn-icono chico" aria-label={tr('Reactivar')} data-tip={tr('Reactivar')} onClick={async () => { await motor.memoriaSuspender(t.id, false); await cargar(); }}><Icono n="reproducir" t={15} /></button>
                ) : (
                  <button class="btn-icono chico" aria-label={tr('Suspender')} data-tip={tr('Suspender')} onClick={async () => { await motor.memoriaSuspender(t.id, true); await cargar(); }}><Icono n="pausa" t={15} /></button>
                )}
                {estado !== 'nueva' && (
                  <button class="btn-icono chico" aria-label={tr('Empezar de cero')} data-tip={tr('Empezar de cero')} onClick={async () => { await motor.memoriaReiniciar(t.id); await cargar(); }}><Icono n="reiniciar" t={15} /></button>
                )}
                <BotonBorrar etiqueta={tr('Eliminar esta tarjeta')} clase="btn-icono chico" lado="izq" alBorrar={async () => { await motor.memoriaEliminar(t.id); await cargar(); }} />
              </div>
            </li>
          );
        })}
      </ol>
      {filtradas.length > limite && <div class="ap-ver-mas"><button class="btn" onClick={() => fijarLimite(limite + 300)}>{tr('Ver más ({0})', numero(filtradas.length - limite))}</button></div>}
      {editando && <EditarTarjeta t={editando} alCerrar={() => fijarEditando(null)} alGuardar={async () => { fijarEditando(null); await cargar(); }} />}
    </>
  );
}
