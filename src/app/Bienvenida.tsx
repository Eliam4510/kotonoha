// La primera vez: qué idioma hablas, qué nivel tienes y qué quieres usar. Todo se puede saltar y cambiar después.

import { useEffect, useState } from 'preact/hooks';
import { type Ajustes, CLAVE_API, guardarAjustes } from '../compartido/ajustes';
import { type CodigoIdioma, IDIOMAS_INTERFAZ, idiomaActual, lenguaDe, resolverIdioma, tm, tr } from '../compartido/i18n';
import { alRecibirEvento, fondo, motor } from '../compartido/rpc';
import type { FuenteBiblioteca, InfoDiccionario, ProgresoInstalacion } from '../compartido/tipos';
import { fuentesRecomendadas } from '../nucleo/diccionariosRecomendados';
import { Icono, Marca, type NombreIcono } from '../ui/iconos';
import { Interruptor, Mensaje } from './Piezas';
import { PAQUETES } from '../lenguas';
import { estudiarLengua, lengua } from '../ui/lengua';

type Paso = 'idioma' | 'lengua' | 'nivel' | 'diccionarios' | 'claude' | 'tarjetas' | 'listo';
const PASOS: Paso[] = ['idioma', 'lengua', 'nivel', 'diccionarios', 'claude', 'tarjetas', 'listo'];

const guardar = (c: Partial<Ajustes>) => guardarAjustes(c).catch(console.error);

/** El idioma de la interfaz arrastra el de las explicaciones y las traducciones. */
function elegirIdioma(id: CodigoIdioma, objetivo: string) {
  const l = lenguaDe(id, objetivo);
  guardar({ idiomaInterfaz: id, idiomaExplicaciones: l.explicaciones, idiomaTraduccion: l.traducciones, idiomaSecundario: l.secundaria });
}

function PasoIdioma({ a }: { a: Ajustes }) {
  const actual = resolverIdioma(a.idiomaInterfaz);
  return (
    <>
      <h1>{tr('¿Qué idioma hablas?')}</h1>
      <p>{tr('Lo usaremos en la interfaz, en las explicaciones y en las traducciones.')}</p>
      <div class="ap-bv-opciones ap-bv-idiomas" role="radiogroup" aria-label={tr('Idioma')}>
        {IDIOMAS_INTERFAZ.map((i) => (
          <button key={i.id} lang={i.bcp47} role="radio" aria-checked={actual === i.id} class={`ap-bv-opcion ${actual === i.id ? 'activa' : ''}`} onClick={() => elegirIdioma(i.id, a.idiomaObjetivo)}>
            <b>{i.nombre}</b>
            <span>{i.pregunta}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function PasoLengua({ a }: { a: Ajustes }) {
  return (
    <>
      <h1>{tr('¿Qué idioma quieres estudiar?')}</h1>
      <p>{tr('Podrás cambiarlo cuando quieras: cada idioma guarda sus propias palabras, diccionarios y tarjetas.')}</p>
      <div class="ap-bv-opciones" role="radiogroup" aria-label={tr('Idioma que estudias')}>
        {PAQUETES.map((p) => (
          <button key={p.id} role="radio" aria-checked={a.idiomaObjetivo === p.id} class={`ap-bv-opcion ${a.idiomaObjetivo === p.id ? 'activa' : ''}`} onClick={() => estudiarLengua(a, p.id).catch(console.error)}>
            <b>{tr(p.textos.nombre)}{tr(p.textos.nombre) !== p.nombrePropio && <> · <span lang={p.id}>{p.nombrePropio}</span></>}</b>
            <span>{tr(p.presentacion)}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function PasoNivel({ a }: { a: Ajustes }) {
  const { principiante, niveles, lectura, textos } = lengua.value;
  const sencillo = lectura.formatoSencillo;
  return (
    <>
      <h1>{tr(textos.nivelPregunta)}</h1>
      <p>{tr(textos.nivelAyuda)}</p>
      <div class="ap-bv-opciones" role="radiogroup" aria-label={tr('Nivel')}>
        {[principiante, ...niveles].map((n) => (
          <button key={n.valor} role="radio" aria-checked={a.nivel === n.valor} class={`ap-bv-opcion ${a.nivel === n.valor ? 'activa' : ''}`} onClick={() => guardar({ nivel: n.valor, furigana: n.lectura, lectorFurigana: n.lectura, ...(sencillo ? { formatoLectura: n.valor === principiante.valor ? sencillo.id : lectura.formatoInicial } : {}) })}>
            <b>{tr(n.nombre)}</b>
            <span>{tr(n.ayuda)}</span>
          </button>
        ))}
      </div>
      {sencillo && (
        <div class="ap-bv-interruptor">
          <span>{tr(sencillo.pregunta)}</span>
          <Interruptor etiqueta={tr(sencillo.etiqueta)} on={a.formatoLectura === sencillo.id} alCambiar={(v) => guardar({ formatoLectura: v ? sencillo.id : lectura.formatoInicial })} />
        </div>
      )}
    </>
  );
}

function PasoDiccionarios() {
  const [fuentes, fijarFuentes] = useState<FuenteBiblioteca[]>([]);
  const [instalados, fijarInstalados] = useState<InfoDiccionario[]>([]);
  const [progreso, fijarProgreso] = useState<Record<string, ProgresoInstalacion>>({});
  const idioma = idiomaActual();
  const cargar = () => motor.estado().then((e) => fijarInstalados(e.diccionarios)).catch(console.error);
  useEffect(() => {
    cargar();
    motor.fuentesDiccionario().then(fijarFuentes).catch(console.error);
    return alRecibirEvento((e) => {
      if (e.tipo === 'instalacion') fijarProgreso((p) => ({ ...p, [e.progreso.id]: e.progreso }));
      if (e.tipo === 'diccionarios') cargar();
    });
  }, []);
  const recomendadas = fuentesRecomendadas(fuentes, idioma);
  const faltan = recomendadas.filter((f) => !instalados.some((d) => d.id === f.id));
  const enMarcha = faltan.some((f) => progreso[f.id] && progreso[f.id].fase !== 'error' && progreso[f.id].fase !== 'listo');
  const sinPropio = fuentes.length > 0 && !fuentes.some((f) => f.tipo === 'terminos' && f.idioma === idioma);
  return (
    <>
      <h1>{tr('Diccionarios')}</h1>
      <p>{tr('Se guardan en tu navegador y funcionan sin conexión. Son gratuitos y no necesitan ninguna clave.')}</p>
      {sinPropio && <Mensaje>{tr('Aún no hay un diccionario abierto en tu idioma: se instala el inglés, y Claude puede explicar cada palabra en tu idioma.')}</Mensaje>}
      <div class="ap-bv-lista">
        {recomendadas.map((f) => {
          const hecho = instalados.some((d) => d.id === f.id);
          const p = progreso[f.id];
          return (
            <div class="ap-bv-fila" key={f.id}>
              <span class={`ap-paso-marca ${hecho ? 'hecho' : ''}`}>{hecho ? <Icono n="ok" t={14} /> : <Icono n="diccionario" t={14} />}</span>
              <div>
                <b>{tr(f.titulo)}</b>
                <span>{tr(f.descripcion)}</span>
                {p && !hecho && p.fase !== 'error' && <div class="barra-progreso"><div style={{ width: `${p.avance * 100}%` }} /></div>}
                {p?.fase === 'error' && <span class="ap-texto-error">{p.error}</span>}
              </div>
            </div>
          );
        })}
      </div>
      {faltan.length > 0 && (
        <button class="btn primario" disabled={enMarcha} onClick={async () => {
          for (const f of faltan) await motor.instalarDiccionario(f.id).catch(() => {});
        }}>
          <Icono n={enMarcha ? 'espera' : 'descargar'} t={16} /> {enMarcha ? tr('Instalando…') : tr('Instalar todo')}
        </button>
      )}
      {enMarcha && <p class="ayuda">{tr('Sigue en segundo plano: puedes continuar con lo demás.')}</p>}
    </>
  );
}

function PasoClaude({ a }: { a: Ajustes }) {
  const [clave, fijarClave] = useState('');
  const [guardada, fijarGuardada] = useState(false);
  useEffect(() => {
    chrome.storage.local.get(CLAVE_API).then((d) => fijarGuardada(!!d[CLAVE_API]));
  }, []);
  return (
    <>
      <h1>{tr('Claude, si quieres')}</h1>
      <p>{tr('Es opcional. Sin él funcionan los subtítulos, el diccionario, los colores y las tarjetas. Con tu clave añade explicaciones en contexto, traducciones y corrección de subtítulos. Pagas lo que uses directamente a Anthropic.')}</p>
      {guardada ? (
        <Mensaje>{tr('Clave guardada.')}</Mensaje>
      ) : (
        <form class="ap-clave-form" onSubmit={async (e) => {
          e.preventDefault();
          if (!clave.trim()) return;
          await chrome.storage.local.set({ [CLAVE_API]: clave.trim() });
          fijarClave('');
          fijarGuardada(true);
        }}>
          <input class="campo" type="password" autocomplete="off" aria-label={tr('Clave de la API de Claude')} placeholder="sk-ant-..." value={clave} onInput={(e) => fijarClave(e.currentTarget.value)} />
          <button class="btn primario" type="submit" disabled={!clave.trim()}>{tr('Guardar')}</button>
        </form>
      )}
      <a class="ap-bv-enlace" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer noopener">{tr('Conseguir una clave')} <Icono n="externo" t={13} /></a>
      <div class="ap-bv-interruptor">
        <span>
          <b>{tr('Tope de gasto al mes, en dólares')}</b><br />
          {tr('Al llegar, Claude deja de usarse hasta el mes siguiente. Con 0 no hay tope.')}
        </span>
        <input class="campo ap-campo-corto" type="number" min="0" step="1" aria-label={tr('Tope de gasto al mes, en dólares')} value={a.limiteGasto} onInput={(ev) => guardar({ limiteGasto: Math.max(0, Number(ev.currentTarget.value) || 0) })} />
      </div>
    </>
  );
}

const DESTINOS: { id: Ajustes['destino']; nombre: string; ayuda: string; icono: NombreIcono }[] = [
  { id: 'memoria', nombre: tm('Memoria'), ayuda: tm('El repaso integrado. No hay que instalar nada.'), icono: 'tarjetas' },
  { id: 'anki', nombre: 'Anki', ayuda: tm('Envía las tarjetas a tus mazos. Necesita Anki abierto, con AnkiConnect.'), icono: 'carpeta' },
];

function PasoTarjetas({ a }: { a: Ajustes }) {
  return (
    <>
      <h1>{tr('¿Dónde guardamos tus tarjetas?')}</h1>
      <p>{tr('Podrás cambiarlo cuando quieras en Ajustes.')}</p>
      <div class="ap-bv-opciones" role="radiogroup" aria-label={tr('Destino de las tarjetas')}>
        {DESTINOS.map((d) => (
          <button key={d.id} role="radio" aria-checked={a.destino === d.id} class={`ap-bv-opcion ${a.destino === d.id ? 'activa' : ''}`} onClick={() => guardar({ destino: d.id })}>
            <b><Icono n={d.icono} t={16} /> {tr(d.nombre)}</b>
            <span>{tr(d.ayuda)}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function PasoListo() {
  const [atajos, fijarAtajos] = useState<Record<string, string>>({});
  useEffect(() => {
    fondo.atajos().then(fijarAtajos).catch(() => {});
  }, []);
  const captura = atajos['alternar-captura'];
  return (
    <>
      <h1>{tr('Todo listo')}</h1>
      <p>{tr('Así se usa:')}</p>
      <div class="ap-bv-lista">
        <div class="ap-bv-fila">
          <span class="ap-paso-marca"><Icono n="video" t={14} /></span>
          <div><b>{tr('En un video')}</b><span>{tr('Abre YouTube o Netflix: los subtítulos aparecen sobre el video. Pasa el ratón por una palabra para ver su ficha.')}</span></div>
        </div>
        <div class="ap-bv-fila">
          <span class="ap-paso-marca"><Icono n="lector" t={14} /></span>
          <div><b>{tr('En una página')}</b><span>{tr(lengua.value.textos.bienvenidaPagina)}</span></div>
        </div>
        <div class="ap-bv-fila">
          <span class="ap-paso-marca"><Icono n="microfono" t={14} /></span>
          <div><b>{tr('Audio en tus tarjetas')}</b><span>{captura ? tr('Pulsa {0} en la pestaña del video para grabar la frase.', captura) : tr('Activa la captura en el menú de la extensión para grabar la frase.')}</span></div>
        </div>
      </div>
      <p class="ayuda">{tr('Esta extensión aprende qué palabras conoces a medida que las marcas. Si ya sabes bastante, puedes evaluar tu nivel en Palabras: ahorra mucho tiempo.')}</p>
    </>
  );
}

export function Bienvenida({ a }: { a: Ajustes }) {
  const [i, fijarI] = useState(0);
  const paso = PASOS[i];
  const terminar = () => guardar({ bienvenidaVista: true });
  // Quien no toque nada, o se salte la bienvenida, también ha de tener las explicaciones en el idioma que se le muestra.
  useEffect(() => {
    if (a.idiomaInterfaz === 'auto') elegirIdioma(resolverIdioma('auto'), a.idiomaObjetivo);
  }, []);
  return (
    <div class="ap-bienvenida" role="dialog" aria-modal="true" aria-label={tr('Bienvenida')}>
      <div class="ap-bv-marco">
        <div class="ap-bv-cab">
          <Marca t={26} />
          <div class="ap-bv-puntos" aria-hidden="true">
            {PASOS.map((p, k) => <i key={p} class={k === i ? 'activo' : k < i ? 'hecho' : ''} />)}
          </div>
          {paso !== 'listo' && <button class="btn fantasma chico" onClick={terminar}>{tr('Saltar')}</button>}
        </div>
        <div class="ap-bv-cuerpo">
          {paso === 'idioma' && <PasoIdioma a={a} />}
          {paso === 'lengua' && <PasoLengua a={a} />}
          {paso === 'nivel' && <PasoNivel a={a} />}
          {paso === 'diccionarios' && <PasoDiccionarios />}
          {paso === 'claude' && <PasoClaude a={a} />}
          {paso === 'tarjetas' && <PasoTarjetas a={a} />}
          {paso === 'listo' && <PasoListo />}
        </div>
        <div class="ap-bv-pie">
          {i > 0 ? <button class="btn fantasma" onClick={() => fijarI(i - 1)}>{tr('Atrás')}</button> : <span />}
          {paso === 'listo' ? <button class="btn primario" onClick={terminar}>{tr('Empezar')}</button> : <button class="btn primario" onClick={() => fijarI(i + 1)}>{tr('Siguiente')}</button>}
        </div>
      </div>
    </div>
  );
}
