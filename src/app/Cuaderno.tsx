// El Cuaderno, lo que antes era el Portapapeles: una página a todo lo ancho donde se escribe y se pega texto en la lengua
// que se estudia, con formato (títulos, listas, citas), y se lee con todas las ayudas. Editar y Leer son dos modos de la
// misma página. Lo escrito se guarda solo; con «Guardar en la biblioteca» la nota queda en la biblioteca y desde entonces
// se guarda también allí. «Organizar» le pide a Claude que ponga títulos, párrafos y listas a un texto pegado de corrido.

import { useEffect, useRef, useState } from 'preact/hooks';
import type { Ajustes } from '../compartido/ajustes';
import type { ElementoBiblioteca } from '../compartido/tipos';
import { tr } from '../compartido/i18n';
import { fondo, motor } from '../compartido/rpc';
import { alCambiarNotaCuaderno, alCambiarTextoLector, guardarNotaCuaderno, guardarTextoLector, leerNotaCuaderno, leerTextoLector } from '../compartido/textoLector';
import { anadirDictado } from '../nucleo/dictado';
import { leerEstructura, normalizarTextoPlano, textoConEstructura, textoPlano } from '../nucleo/estructura';
import { Icono } from '../ui/iconos';
import { lengua } from '../ui/lengua';
import { useRelojLectura } from '../ui/relojLectura';
import { Dictado, limpiarDictadosSiToca } from './Dictado';
import { navegar } from './estadoApp';
import { type ApiEditor, EditorCuaderno } from './EditorCuaderno';
import { TextoInteractivo } from './Lectura';
import { Mensaje } from './Piezas';

/** Lo que se espera sin escribir antes de guardar: guardar a cada tecla movería la biblioteca sin necesidad. */
const ESPERA_GUARDADO_MS = 600;

/** Lo copiado, con su estructura cuando trae HTML; si el navegador no deja leer el HTML, el texto como siempre. */
async function pegadoConEstructura(): Promise<string> {
  try {
    for (const item of await navigator.clipboard.read()) {
      const leer = async (tipo: string) => (item.types.includes(tipo) ? (await item.getType(tipo)).text() : '');
      const html = await leer('text/html');
      const texto = await leer('text/plain');
      if (html || texto) return textoConEstructura(html, texto);
    }
  } catch {
    // Sigue abajo con el texto plano.
  }
  return normalizarTextoPlano(await navigator.clipboard.readText());
}

/** El título de una nota: su primer título, o el principio de su primera línea. */
export function tituloDeNota(md: string): string {
  const bloques = leerEstructura(md);
  const titulo = bloques.find((b) => b.tipo === 'titulo');
  const texto = titulo?.tipo === 'titulo' ? titulo.linea.texto : textoPlano(bloques).split('\n').find((l) => l.trim()) ?? '';
  return texto.trim().slice(0, 40);
}

/** Lo que dice el texto, sin marcas ni espacios: para ver si «Organizar» cambió alguna palabra. */
const soloTexto = (md: string) => textoPlano(leerEstructura(md)).replace(/\s+/g, '');

/** Cuánto se parecen dos textos, por los caracteres que tienen (de 0 a 1). */
function parecido(a: string, b: string): number {
  const cuenta = new Map<string, number>();
  for (const c of a) cuenta.set(c, (cuenta.get(c) ?? 0) + 1);
  let comunes = 0;
  for (const c of b) {
    const n = cuenta.get(c) ?? 0;
    if (n > 0) {
      comunes++;
      cuenta.set(c, n - 1);
    }
  }
  return a.length + b.length ? (2 * comunes) / (a.length + b.length) : 1;
}

/**
 * Abre un texto de la biblioteca en el Cuaderno para seguir escribiendo en él. Lo que hubiera en el Cuaderno sin guardar no
 * se pierde: va antes a la biblioteca.
 */
export async function abrirEnCuaderno(e: ElementoBiblioteca): Promise<void> {
  const [actual, enlazada] = await Promise.all([leerTextoLector(), leerNotaCuaderno()]);
  if (actual.trim() && !enlazada && actual.trim() !== e.texto.trim()) {
    await motor.bibliotecaGuardar({ id: crypto.randomUUID(), titulo: tituloDeNota(actual) || tr('Sin título'), texto: actual, origen: 'pegado', creado: Date.now() });
  }
  await guardarTextoLector(e.texto);
  await guardarNotaCuaderno(e.id);
  navegar('lector?editar=1');
}

export function Cuaderno({ ajustes, inicial, editar = false, web = false }: { ajustes: Ajustes; inicial: string; editar?: boolean; web?: boolean }) {
  /** Lo que se enseña al leer y con lo que empieza el editor. null mientras se carga. */
  const [texto, fijarTexto] = useState<string | null>(null);
  const [modo, fijarModo] = useState<'editar' | 'leer'>('leer');
  /** La nota de la biblioteca en la que se guarda, si se guardó. */
  const [nota, fijarNota] = useState<string | null>(null);
  const [mensaje, fijarMensaje] = useState<{ texto: string; error?: boolean } | null>(null);
  const [organizando, fijarOrganizando] = useState(false);
  /** Si hay algo escrito: lo que se teclea va a una referencia, y esto solo cambia al pasar de vacío a con texto. */
  const [conTexto, fijarConTexto] = useState(false);
  /** Cambia para volver a montar el editor con otro texto (otra nota). */
  const [vez, fijarVez] = useState(0);
  const textoActual = useRef('');
  const ultimoGuardado = useRef<string | null>(null);
  const notaActual = useRef<string | null>(null);
  const editor = useRef<ApiEditor | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  notaActual.current = nota;

  useRelojLectura(modo === 'leer' && texto?.trim() ? 'portapapeles' : null, '', ajustes.idiomaObjetivo);

  const alFinal = () => setTimeout(() => document.querySelector('.ap-principal')?.scrollTo({ top: 1e9, behavior: 'smooth' }), 350);

  /** Guarda lo escrito: en el Cuaderno siempre, y en su nota de la biblioteca si la tiene. */
  const guardar = async (md: string) => {
    ultimoGuardado.current = md;
    await guardarTextoLector(md);
    const id = notaActual.current;
    if (id) await motor.bibliotecaCambiar(id, { texto: md, titulo: tituloDeNota(md) || tr('Sin título') }).catch(() => {});
  };
  const programarGuardado = (md: string) => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => {
      temporizador.current = null;
      guardar(md).catch(console.error);
    }, ESPERA_GUARDADO_MS);
  };
  // Lo pendiente se guarda al salir.
  useEffect(
    () => () => {
      if (temporizador.current) {
        clearTimeout(temporizador.current);
        guardar(textoActual.current).catch(() => {});
      }
    },
    []
  );

  /** Pone un texto entero: en el editor si se está editando, y en lo que se lee. */
  const poner = (md: string, guardarlo = true) => {
    textoActual.current = md;
    fijarConTexto(!!md.trim());
    fijarTexto(md);
    if (guardarlo) programarGuardado(md);
  };

  // Al abrir: lo que había en el Cuaderno. Lo que llega del menú contextual («Abrir la selección en el Cuaderno») se añade al
  // final, como lo que se copia con «Seguir lo copiado».
  useEffect(() => {
    let vivo = true;
    Promise.all([leerTextoLector(), leerNotaCuaderno()]).then(async ([guardado, id]) => {
      if (!vivo) return;
      let t = guardado;
      const nuevo = inicial.trim();
      if (nuevo && !guardado.includes(nuevo)) t = guardado.trim() ? `${guardado.trimEnd()}\n\n${nuevo}` : nuevo;
      // Una nota que ya no está en la biblioteca deja de estar enlazada.
      const existe = id ? !!(await motor.bibliotecaObtener(id).catch(() => undefined)) : false;
      if (!vivo) return;
      fijarNota(existe ? id : null);
      if (id && !existe) await guardarNotaCuaderno(null);
      textoActual.current = t;
      ultimoGuardado.current = guardado;
      fijarConTexto(!!t.trim());
      fijarTexto(t);
      fijarModo(t.trim() && !editar ? 'leer' : 'editar');
      fijarVez((v) => v + 1);
      if (t !== guardado) {
        guardar(t).catch(console.error);
        alFinal();
      }
    });
    return () => {
      vivo = false;
    };
  }, [inicial, editar]);

  // Lo que cambia en otra pestaña (la otra copia del Cuaderno, o lo copiado con «Seguir lo copiado»).
  useEffect(
    () =>
      alCambiarTextoLector((t) => {
        if (t === textoActual.current || t === ultimoGuardado.current) return;
        const anterior = textoActual.current;
        textoActual.current = t;
        ultimoGuardado.current = t;
        fijarConTexto(!!t.trim());
        const base = anterior.trimEnd();
        if (editor.current) {
          if (base && t.startsWith(base)) editor.current.anadir(t.slice(base.length).trim());
          else editor.current.reemplazar(t);
        }
        fijarTexto(t);
        if (base && t.startsWith(base) && t.length > base.length) alFinal();
      }),
    []
  );
  // Guardar en la biblioteca, o empezar otra nota, en la otra copia del Cuaderno.
  useEffect(() => alCambiarNotaCuaderno(fijarNota), []);

  // Las grabaciones de dictados que ya nadie usa se borran de vez en cuando; las de lo que hay abierto, nunca.
  useEffect(() => {
    const reloj = setTimeout(async () => {
      const abiertos = [textoActual.current, await leerTextoLector().catch(() => '')];
      await limpiarDictadosSiToca(abiertos);
    }, 5000);
    return () => clearTimeout(reloj);
  }, []);

  const alEditar = (md: string) => {
    textoActual.current = md;
    fijarConTexto(!!md.trim());
    programarGuardado(md);
  };

  const cambiarModo = (m: 'editar' | 'leer') => {
    if (m === modo) return;
    // Al leer se enseña lo último escrito; al editar, el editor empieza con eso mismo.
    fijarTexto(textoActual.current);
    if (m === 'editar') fijarVez((v) => v + 1);
    fijarModo(m);
  };

  /** Lo dictado va al final, en su propio párrafo, con su grabación encima, y se lee ya analizado. */
  const dictar = (id: string, dictado: string) => {
    poner(anadirDictado(textoActual.current, id, dictado));
    fijarModo('leer');
    alFinal();
  };

  const pegar = async () => {
    const md = await pegadoConEstructura().catch(() => '');
    if (!md) return;
    if (editor.current) editor.current.insertar(md);
    else poner(textoActual.current.trim() ? `${textoActual.current.trimEnd()}\n\n${md}` : md);
  };

  const organizar = async () => {
    const actual = textoActual.current;
    if (!actual.trim()) return;
    fijarOrganizando(true);
    fijarMensaje(null);
    try {
      const md = await motor.organizarTexto(actual);
      if (!md.trim()) throw new Error(tr('Claude no devolvió nada.'));
      // Si alguien escribió mientras tanto, no se pisa lo nuevo.
      if (textoActual.current !== actual) throw new Error(tr('El texto cambió mientras se organizaba. Vuelve a pulsar «Organizar».'));
      if (editor.current) editor.current.reemplazar(md);
      else poner(md);
      const igual = parecido(soloTexto(actual), soloTexto(md));
      fijarMensaje(
        igual >= 0.97
          ? { texto: tr('Organizado. Si no te convence, Ctrl+Z lo deja como estaba.') }
          : { texto: tr('Organizado, pero Claude cambió parte del texto. Revísalo; Ctrl+Z lo deja como estaba.'), error: true }
      );
    } catch (e) {
      fijarMensaje({ texto: e instanceof Error ? e.message : String(e), error: true });
    } finally {
      fijarOrganizando(false);
    }
  };

  /** Guarda la nota en la biblioteca; desde entonces, lo que se escriba se guarda también allí. */
  const guardarEnBiblioteca = async () => {
    const md = textoActual.current;
    if (!md.trim()) return;
    const id = crypto.randomUUID();
    await motor.bibliotecaGuardar({ id, titulo: tituloDeNota(md) || tr('Sin título'), texto: md, origen: 'pegado', creado: Date.now() });
    await guardarNotaCuaderno(id);
    fijarNota(id);
    fijarMensaje({ texto: tr('Guardada en la biblioteca. Lo que escribas se guardará también allí.') });
  };

  /** Una nota nueva, en blanco. La de ahora no se pierde: si no estaba en la biblioteca, se guarda en ella. */
  const notaNueva = async () => {
    const md = textoActual.current;
    if (temporizador.current) {
      clearTimeout(temporizador.current);
      temporizador.current = null;
      await guardar(md);
    }
    if (md.trim() && !notaActual.current) await motor.bibliotecaGuardar({ id: crypto.randomUUID(), titulo: tituloDeNota(md) || tr('Sin título'), texto: md, origen: 'pegado', creado: Date.now() });
    await guardarNotaCuaderno(null);
    fijarNota(null);
    textoActual.current = '';
    ultimoGuardado.current = '';
    fijarConTexto(false);
    await guardarTextoLector('');
    fijarTexto('');
    fijarModo('editar');
    fijarVez((v) => v + 1);
    fijarMensaje(md.trim() ? { texto: tr('La nota anterior está en la biblioteca.') } : null);
  };

  const botonWeb = !web && (
    <button class="btn chico fantasma" data-tip-lado="izq" data-tip={tr('Abre el Cuaderno en una pestaña normal del navegador, para ponerlo en vista dividida junto a otra página.')} onClick={async () => {
      if (temporizador.current) {
        clearTimeout(temporizador.current);
        temporizador.current = null;
        await guardar(textoActual.current);
      }
      await fondo.abrirLectorWeb();
    }}><Icono n="dividir" t={15} /> {tr('Modo web')}</button>
  );

  if (texto === null) return <div class="ap-lienzo cu-pagina" aria-busy="true" />;
  const hayTexto = conTexto;

  return (
    <div class={`ap-lienzo cu-pagina ${modo}`}>
      <header class="cu-cabeza">
        <div class="cu-nombre">
          <h1>{tr('Cuaderno')}</h1>
          {nota ? (
            <span class="cu-estado"><Icono n="check" t={13} /> {tr('En la biblioteca')}</span>
          ) : (
            <span class="cu-estado">{tr('Se guarda solo en este navegador')}</span>
          )}
        </div>
        <div class="segmentado cu-modo" role="radiogroup" aria-label={tr('Modo del Cuaderno')}>
          <button role="radio" aria-checked={modo === 'editar'} class={modo === 'editar' ? 'activo' : ''} onClick={() => cambiarModo('editar')}><Icono n="lapiz" t={14} /> {tr('Editar')}</button>
          <button role="radio" aria-checked={modo === 'leer'} class={modo === 'leer' ? 'activo' : ''} disabled={!hayTexto} onClick={() => cambiarModo('leer')}><Icono n="lector" t={14} /> {tr('Leer')}</button>
        </div>
        <div class="cu-acciones">
          <button class="btn chico fantasma" onClick={() => void notaNueva()}><Icono n="mas" t={15} /> {tr('Nota nueva')}</button>
          {!nota && <button class="btn chico fantasma" disabled={!hayTexto} onClick={() => void guardarEnBiblioteca()}><Icono n="biblioteca" t={15} /> {tr('Guardar en la biblioteca')}</button>}
          {botonWeb}
        </div>
      </header>
      {mensaje && <Mensaje error={mensaje.error}>{mensaje.texto}</Mensaje>}

      {modo === 'editar' ? (
        <EditorCuaderno
          key={vez}
          inicial={textoActual.current}
          alCambiar={alEditar}
          api={editor}
          ejemplo={tr(lengua.value.textos.cuadernoVacio)}
          extra={
            <>
              <button class="btn chico fantasma" disabled={organizando} data-tip-lado="izq" data-tip={tr('Claude pone título, subtítulos, párrafos y listas al texto, sin cambiar las palabras.')} onClick={() => void organizar()}><Icono n="varita" t={15} /> {organizando ? tr('Organizando…') : tr('Organizar')}</button>
              <button class="btn chico fantasma" onClick={() => void pegar()}><Icono n="portapapeles" t={15} /> {tr('Pegar')}</button>
              <Dictado alDictar={dictar} />
            </>
          }
        />
      ) : (
        <TextoInteractivo texto={texto} ajustes={ajustes} titulo={tituloDeNota(texto) || tr('Cuaderno')} completo inicioBarra={<Dictado alDictar={dictar} />} />
      )}
    </div>
  );
}
