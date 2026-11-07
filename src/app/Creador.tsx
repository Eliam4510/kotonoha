// Creador de tarjetas: rellena a mano, con la IA o con lo que llega desde el video o el diccionario.
// Vive en un panel lateral de toda la ventana: se abre al recibir algo y se puede dejar fijo.

import { useEffect, useRef, useState } from 'preact/hooks';
import type { Ajustes } from '../compartido/ajustes';
import { flujoMotor, motor } from '../compartido/rpc';
import type { BorradorTarjeta, MedioTarjeta } from '../compartido/tipos';
import { alRecibirBorrador, borradorVacio, type ParcialBorrador } from '../ui/borrador';
import { Icono, type NombreIcono } from '../ui/iconos';
import { creadorAbierto, creadorFijado, estadoAnki, guardarPreferencia, refrescarAnki, useMedia } from './estadoApp';
import { Mensaje } from './Piezas';
import { tr } from '../compartido/i18n';
import { lengua } from '../ui/lengua';

/** Acción de un campo. En glicina solo si la hace Claude. */
function AccionCampo({ texto, icono, alPulsar, ocupado, ia }: { texto: string; icono: NombreIcono; alPulsar: () => void; ocupado: boolean; ia?: boolean }) {
  return (
    <button class={`ap-accion-campo ${ia ? 'ia' : ''}`} disabled={ocupado} onClick={alPulsar}>
      <Icono n={ocupado ? 'espera' : ia ? 'ia' : icono} t={14} />
      {ocupado ? tr('Un momento…') : texto}
    </button>
  );
}

const reproducirMedio = (m: MedioTarjeta) => new Audio(m.datos ? `data:${m.tipo};base64,${m.datos}` : m.url).play().catch(() => {});

function Audios({ lista, alQuitar, vacio }: { lista: MedioTarjeta[]; alQuitar: (id: string) => void; vacio: string }) {
  if (!lista.length) return <p class="ap-medio-vacio">{vacio}</p>;
  return (
    <div class="ap-audios">
      {lista.map((m) => (
        <div class="ap-audio" key={m.id}>
          <button class="btn-icono chico relleno" aria-label={tr('Reproducir {0}', m.etiqueta ?? m.nombre)} onClick={() => reproducirMedio(m)}><Icono n="reproducir" t={14} /></button>
          <span>{m.etiqueta ?? tr('Audio')}</span>
          <button class="btn-icono chico" aria-label={tr('Quitar {0}', m.etiqueta ?? m.nombre)} onClick={() => alQuitar(m.id)}><Icono n="cerrar" t={13} /></button>
        </div>
      ))}
    </div>
  );
}

/**
 * Campo con formato para los textos que llevan HTML sencillo: la palabra en negrita de la frase o los
 * saltos de línea de las definiciones. Así se ven como quedarán en la tarjeta, no como etiquetas.
 * El DOM solo se reescribe si el valor cambia desde fuera, para no mover el cursor mientras se escribe.
 */
function CampoRico({ id, valor, alCambiar, placeholder, enLengua, etiqueta }: { id: string; valor: string; alCambiar: (v: string) => void; placeholder: string; enLengua?: boolean; etiqueta: string }) {
  const caja = useRef<HTMLDivElement>(null);
  const propio = useRef(valor);
  const ultimaEscritura = useRef(0);
  useEffect(() => {
    // Al escribir deprisa, el valor que llega puede ser una pulsación anterior: no debe pisar el texto.
    if (caja.current && valor !== propio.current && Date.now() - ultimaEscritura.current > 400) {
      propio.current = valor;
      caja.current.innerHTML = valor;
    }
  }, [valor]);
  useEffect(() => {
    if (caja.current) caja.current.innerHTML = valor;
  }, []);
  return (
    <div
      id={id}
      ref={caja}
      class={`campo ap-campo-rico ${enLengua ? 'ap-campo-lengua' : ''}`}
      lang={enLengua ? lengua.value.id : undefined}
      contentEditable={'plaintext-only' as unknown as boolean}
      role="textbox"
      aria-multiline="true"
      aria-label={etiqueta}
      data-placeholder={placeholder}
      onInput={(e) => {
        const c = e.currentTarget;
        // Un campo vaciado deja a veces un salto suelto, que impediría ver el texto de ejemplo.
        if (c.textContent === '' || c.innerHTML === '<br>' || c.innerHTML === '\n') c.innerHTML = '';
        const html = c.innerHTML.replace(/\n/g, '<br>');
        propio.current = html;
        ultimaEscritura.current = Date.now();
        alCambiar(html);
      }}
    />
  );
}

function aBase64(archivo: File): Promise<string> {
  return new Promise((ok, mal) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1]);
    r.onerror = () => mal(r.error);
    r.readAsDataURL(archivo);
  });
}

export function Creador({ ajustes }: { ajustes: Ajustes }) {
  const [b, fijarB] = useState<BorradorTarjeta>(borradorVacio());
  const [ocupado, fijarOcupado] = useState<Record<string, boolean>>({});
  const [mensaje, fijarMensaje] = useState<{ texto: string; error?: boolean } | null>(null);
  const [destino, fijarDestino] = useState(ajustes.destino);
  const entradaAudioFrase = useRef<HTMLInputElement>(null);
  const entradaImagen = useRef<HTMLInputElement>(null);
  const estrecha = useMedia('(max-width: 1240px)');
  const abierto = creadorAbierto.value;
  const mazos = estadoAnki.value?.mazos ?? [];
  const ankiListo = estadoAnki.value?.conectado ?? null;

  useEffect(() => fijarDestino(ajustes.destino), [ajustes.destino]);

  // Anki puede abrirse o cerrarse en cualquier momento: se comprueba cada vez que se abre el panel.
  useEffect(() => {
    if (abierto) refrescarAnki();
  }, [abierto]);

  useEffect(() => {
    return alRecibirBorrador((p: ParcialBorrador) => {
      const { _sello: _s, ...datos } = p;
      fijarB((actual) => {
        // Los medios se acumulan; los textos que llegan sustituyen a los anteriores.
        const siguiente = { ...actual, ...datos } as BorradorTarjeta;
        if (datos.imagenes && actual.imagenes.length) siguiente.imagenes = [...actual.imagenes, ...datos.imagenes];
        if (datos.audioPalabra && actual.audioPalabra.length) siguiente.audioPalabra = [...actual.audioPalabra, ...datos.audioPalabra];
        return siguiente;
      });
      fijarMensaje(null);
      creadorAbierto.value = true;
    });
  }, []);

  const set = (c: Partial<BorradorTarjeta>) => fijarB((x) => ({ ...x, ...c }));
  const conOcupado = async (k: string, fn: () => Promise<void>) => {
    fijarOcupado((o) => ({ ...o, [k]: true }));
    fijarMensaje(null);
    try {
      await fn();
    } catch (e) {
      fijarMensaje({ texto: e instanceof Error ? e.message : String(e), error: true });
    } finally {
      fijarOcupado((o) => ({ ...o, [k]: false }));
    }
  };

  const fraseLimpia = () => b.frase.replace(/<[^>]+>/g, '');
  const contexto = () => ({ lema: b.palabra, lectura: b.lectura, frase: fraseLimpia() });

  const crearFrase = () => conOcupado('frase', async () => {
    if (!b.palabra) throw new Error(tr('Escribe primero la palabra.'));
    set({ frase: await motor.generarFraseEjemplo(b.palabra) });
  });
  const crearTraduccion = () => conOcupado('traduccion', async () => {
    if (!b.frase) throw new Error(tr('Escribe primero la frase.'));
    set({ traduccion: await flujoMotor('traducir', [contexto(), false], (t) => set({ traduccion: t })) });
  });
  const buscarDefinicion = () => conOcupado('definicion', async () => {
    if (!b.palabra) throw new Error(tr('Escribe primero la palabra.'));
    const r = await motor.buscar(b.palabra, b.lectura || undefined);
    set({ definicion: [...new Set(r.entradas.flatMap((e) => e.glosas))].slice(0, 5).join('<br>'), lectura: b.lectura || r.lectura });
  });
  const crearAudioFrase = () => conOcupado('audioFrase', async () => {
    if (!b.frase) throw new Error(tr('Escribe primero la frase.'));
    const datos = await motor.vozFrase(fraseLimpia(), ajustes.vocesFrase[0]);
    set({ audioFrase: [{ id: `voz${Date.now()}`, nombre: `kotonoha_voz_${Date.now()}.mp3`, tipo: 'audio/mpeg', datos, etiqueta: tr('Voz') }] });
  });
  const buscarAudioPalabra = () => conOcupado('audioPalabra', async () => {
    if (!b.palabra) throw new Error(tr('Escribe primero la palabra.'));
    const r = await motor.audiosPalabra(b.palabra, b.lectura || b.palabra);
    if (!r.length) throw new Error(tr('No hay grabaciones de esta palabra.'));
    const m = await motor.descargarMedio(r[0].url);
    set({ audioPalabra: [{ id: r[0].url, nombre: `kotonoha_${b.palabra}.mp3`, tipo: m.tipo, datos: m.datos, etiqueta: r[0].etiqueta }] });
  });
  const buscarImagen = () => conOcupado('imagenes', async () => {
    const consulta = await motor.consultaImagen(b.palabra || fraseLimpia(), fraseLimpia());
    const r = await motor.imagenes(consulta);
    if (!r.length) throw new Error(tr('Sin imágenes para esta búsqueda.'));
    const elegida = r[Math.floor(Math.random() * Math.min(r.length, 6))];
    const m = await motor.descargarMedio(elegida.miniatura);
    set({ imagenes: [{ id: elegida.url, nombre: `kotonoha_${Date.now()}.jpg`, tipo: m.tipo, datos: m.datos }] });
  });
  const buscarEjemplos = () => conOcupado('ejemplos', async () => {
    if (!b.palabra) throw new Error(tr('Escribe primero la palabra.'));
    const e = await motor.ejemplos(b.palabra);
    set({ ejemplos: e.slice(0, 3).map((x) => x.texto).join('<br>') });
  });
  const crearNotas = () => conOcupado('notas', async () => {
    if (!b.palabra || !b.frase) throw new Error(tr('Hacen falta la palabra y la frase.'));
    set({ notas: await flujoMotor('explicar', [contexto(), false, false], (t) => set({ notas: t })) });
  });
  const generarTodo = () => {
    if (!b.frase && b.palabra) crearFrase();
    if (b.frase && !b.traduccion) crearTraduccion();
    if (b.palabra && !b.definicion) buscarDefinicion();
    if (b.palabra && !b.audioPalabra.length) buscarAudioPalabra();
    if (b.palabra && !b.notas && b.frase) crearNotas();
  };

  const crearTarjeta = () => conOcupado('crear', async () => {
    if (!b.frase && !b.palabra) throw new Error(tr('La tarjeta está vacía.'));
    await motor.crearTarjeta(b, destino);
    fijarMensaje({ texto: destino === 'anki' ? tr('Tarjeta añadida a Anki.') : tr('Tarjeta añadida a Memoria.') });
    fijarB(borradorVacio());
  });

  const flotante = estrecha || !creadorFijado.value;

  return (
    <div class={`ap-creador-marco ${abierto ? 'abierto' : ''} ${flotante ? 'flotante' : ''}`} inert={!abierto}>
      <aside class="ap-creador" aria-label={tr('Creador de tarjetas')}>
        <header class="ap-creador-cab">
          <h2>{tr('Nueva tarjeta')}</h2>
          <div class="ap-creador-botones">
            {!estrecha && (
              <button
                class={`btn-icono chico ${creadorFijado.value ? 'activo' : ''}`}
                aria-pressed={creadorFijado.value}
                aria-label={creadorFijado.value ? tr('Dejar de fijar el panel') : tr('Fijar el panel')}
                data-tip={creadorFijado.value ? tr('Dejar de fijar') : tr('Fijar el panel')}
                data-tip-lado="izq"
                onClick={() => {
                  creadorFijado.value = !creadorFijado.value;
                  guardarPreferencia('creadorFijado', creadorFijado.value);
                }}
              >
                <Icono n="fijar" t={16} />
              </button>
            )}
            <button class="btn-icono chico" aria-label={tr('Cerrar el creador')} data-tip={tr('Cerrar')} data-tip-lado="izq" onClick={() => (creadorAbierto.value = false)}>
              <Icono n="cerrar" t={15} />
            </button>
          </div>
        </header>

        <div class="ap-creador-cuerpo">
          <div class="ap-creador-modo">
            <div class="segmentado" role="radiogroup" aria-label={tr('Tipo de tarjeta')}>
              {(['frase', 'palabra'] as const).map((t) => (
                <button key={t} role="radio" aria-checked={b.tipo === t} class={b.tipo === t ? 'activo' : ''} onClick={() => set({ tipo: t })}>{t === 'frase' ? tr('Frase') : tr('Palabra')}</button>
              ))}
            </div>
            <select class="selector" aria-label={tr('Destino')} value={destino} onChange={(e) => fijarDestino(e.currentTarget.value as Ajustes['destino'])}>
              <option value="anki">{tr('Anki')}{mazos.length ? ` · ${ajustes.ankiMazo}` : ''}</option>
              <option value="memoria">{tr('Memoria')}</option>
            </select>
          </div>
          {destino === 'anki' && ankiListo === false && (
            <p class="ap-creador-aviso">
              <Icono n="aviso" t={15} />
              <span>{tr('Anki no está abierto.')}</span>
              <button onClick={() => fijarDestino('memoria')}>{tr('Guardar en Memoria')}</button>
            </p>
          )}

          <button class="btn ia bloque" onClick={generarTodo} disabled={!b.palabra && !b.frase}>
            <Icono n="ia" t={16} /> {tr('Completar lo que falta con Claude')}
          </button>

          <section class="ap-campos">
            <div class="ap-dos-campos">
              <div class="ap-campo">
                <label for="k-palabra">{tr('Palabra')}</label>
                <input id="k-palabra" class="campo ap-campo-lengua" lang={lengua.value.id} value={b.palabra} placeholder={lengua.value.ejemplos.palabra} onInput={(e) => set({ palabra: e.currentTarget.value })} />
              </div>
              <div class="ap-campo">
                <label for="k-lectura">{tr('Lectura')}</label>
                <input id="k-lectura" class="campo ap-campo-lengua" lang={lengua.value.id} value={b.lectura} placeholder={lengua.value.ejemplos.lectura} onInput={(e) => set({ lectura: e.currentTarget.value })} />
              </div>
            </div>
            <div class="ap-campo">
              <div class="ap-campo-etq">
                <label for="k-def">{tr('Definición')}</label>
                <AccionCampo texto={tr('Buscar en el diccionario')} icono="diccionario" ocupado={!!ocupado.definicion} alPulsar={buscarDefinicion} />
              </div>
              <CampoRico id="k-def" etiqueta={tr('Definición')} valor={b.definicion} placeholder={tr('Significado de la palabra')} alCambiar={(v) => set({ definicion: v })} />
            </div>
          </section>

          <section class="ap-campos">
            <div class="ap-campo">
              <div class="ap-campo-etq">
                <label for="k-frase">{tr('Frase')}</label>
                <AccionCampo ia texto={tr('Crear con Claude')} icono="ia" ocupado={!!ocupado.frase} alPulsar={crearFrase} />
              </div>
              <CampoRico id="k-frase" etiqueta={tr('Frase')} enLengua valor={b.frase} placeholder={tr('La frase donde aparece')} alCambiar={(v) => set({ frase: v })} />
            </div>
            <div class="ap-campo">
              <div class="ap-campo-etq">
                <label for="k-trad">{tr('Traducción')}</label>
                <AccionCampo ia texto={tr('Traducir con Claude')} icono="ia" ocupado={!!ocupado.traduccion} alPulsar={crearTraduccion} />
              </div>
              <textarea id="k-trad" class="campo" value={b.traduccion} placeholder={tr('Traducción de la frase')} onInput={(e) => set({ traduccion: e.currentTarget.value })} />
            </div>
          </section>

          <section class="ap-campos">
            <div class="ap-campo">
              <div class="ap-campo-etq">
                <span class="etq">{tr('Audio de la frase')}</span>
                <span class="ap-campo-acciones">
                  <AccionCampo texto={tr('Voz')} icono="voz" ocupado={!!ocupado.audioFrase} alPulsar={crearAudioFrase} />
                  <button class="ap-accion-campo" onClick={() => entradaAudioFrase.current?.click()}><Icono n="mas" t={14} />{tr('Archivo')}</button>
                </span>
              </div>
              <Audios vacio={tr('Se añade solo si la tarjeta sale de un video.')} lista={b.audioFrase} alQuitar={(id) => set({ audioFrase: b.audioFrase.filter((m) => m.id !== id) })} />
              <input ref={entradaAudioFrase} type="file" accept="audio/*" hidden aria-label={tr('Añadir audio')} onChange={async (e) => {
                const f = e.currentTarget.files?.[0];
                if (f) set({ audioFrase: [...b.audioFrase, { id: f.name, nombre: f.name, tipo: f.type, datos: await aBase64(f), etiqueta: f.name }] });
              }} />
            </div>
            <div class="ap-campo">
              <div class="ap-campo-etq">
                <span class="etq">{tr('Audio de la palabra')}</span>
                <AccionCampo texto={tr('Buscar grabación')} icono="ondas" ocupado={!!ocupado.audioPalabra} alPulsar={buscarAudioPalabra} />
              </div>
              <Audios vacio={tr('Grabaciones de nativos, cuando existen.')} lista={b.audioPalabra} alQuitar={(id) => set({ audioPalabra: b.audioPalabra.filter((m) => m.id !== id) })} />
            </div>
            <div class="ap-campo">
              <div class="ap-campo-etq">
                <span class="etq">{tr('Imágenes')}</span>
                <AccionCampo ia texto={tr('Buscar con Claude')} icono="imagen" ocupado={!!ocupado.imagenes} alPulsar={buscarImagen} />
              </div>
              <div class="ap-imagenes">
                {b.imagenes.map((m) => (
                  <div class="ap-imagen" key={m.id}>
                    <img src={m.datos ? `data:${m.tipo};base64,${m.datos}` : m.url} alt="" />
                    <button class="btn-icono chico relleno" aria-label={tr('Quitar la imagen')} onClick={() => set({ imagenes: b.imagenes.filter((x) => x.id !== m.id) })}><Icono n="cerrar" t={12} /></button>
                  </div>
                ))}
                <button class="ap-imagen-anadir" aria-label={tr('Añadir una imagen desde un archivo')} onClick={() => entradaImagen.current?.click()}><Icono n="imagen" t={20} /><span>{tr('Añadir')}</span></button>
              </div>
              <input ref={entradaImagen} type="file" accept="image/*" hidden aria-label={tr('Añadir imagen')} onChange={async (e) => {
                const f = e.currentTarget.files?.[0];
                if (f) set({ imagenes: [...b.imagenes, { id: f.name, nombre: f.name, tipo: f.type, datos: await aBase64(f) }] });
              }} />
            </div>
          </section>

          <section class="ap-campos">
            <div class="ap-campo">
              <div class="ap-campo-etq">
                <label for="k-ej">{tr('Frases de ejemplo')}</label>
                <AccionCampo texto={tr('De lo que has visto')} icono="frases" ocupado={!!ocupado.ejemplos} alPulsar={buscarEjemplos} />
              </div>
              <CampoRico id="k-ej" etiqueta={tr('Frases de ejemplo')} enLengua valor={b.ejemplos} placeholder={tr('Ejemplos adicionales')} alCambiar={(v) => set({ ejemplos: v })} />
            </div>
            <div class="ap-campo">
              <div class="ap-campo-etq">
                <label for="k-notas">{tr('Notas')}</label>
                <AccionCampo ia texto={tr('Explicar con Claude')} icono="ia" ocupado={!!ocupado.notas} alPulsar={crearNotas} />
              </div>
              <textarea id="k-notas" class="campo" value={b.notas} placeholder={tr('Algún truco para recordarla')} onInput={(e) => set({ notas: e.currentTarget.value })} />
            </div>
          </section>
        </div>

        <footer class="ap-creador-pie">
          {mensaje && <Mensaje error={mensaje.error}>{mensaje.texto}</Mensaje>}
          <div class="ap-creador-botones-pie">
            <button class="btn fantasma" onClick={() => { fijarB(borradorVacio()); fijarMensaje(null); }}>{tr('Limpiar')}</button>
            <button class="btn primario ap-creador-crear" disabled={!!ocupado.crear} onClick={crearTarjeta}>
              <Icono n="tarjetas" t={16} /> {ocupado.crear ? tr('Creando…') : tr('Crear tarjeta')}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
