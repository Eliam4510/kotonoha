// Texto interactivo para el lector y la biblioteca, con consulta de palabras y lectura en voz alta.

import { type ComponentChildren, Fragment, type JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { type Ajustes, hayVozSintetica } from '../compartido/ajustes';
import { alRecibirEvento, motor } from '../compartido/rpc';
import type { PalabraToken } from '../compartido/tipos';
import { type Bloque, type ElementoLista, type FraseDeLinea, frasesDeBloques, type Linea, leerEstructura, textoPlano } from '../nucleo/estructura';
import { fraseConNegrita } from '../nucleo/frases';
import { motorDe } from '../lenguas/motor';
import type { PuntoGramatica } from '../lenguas/tipos';
import { enviarAlCreador } from '../ui/borrador';
import { Ficha } from '../ui/Ficha';
import { Icono, type NombreIcono } from '../ui/iconos';
import { GrabacionDictada } from './Dictado';
import { guardarPreferencia, leerPreferencia } from './estadoApp';
import { Anillo } from './Piezas';
import { Practica } from './Practica';
import { numero, tm, tr } from '../compartido/i18n';
import { lecturaDeTarjeta, lengua } from '../ui/lengua';
import { decirConNavegador } from '../ui/vozNavegador';

interface Abierta {
  palabra: PalabraToken;
  frase: string;
  antes: string[];
  despues: string[];
  gramatica: PuntoGramatica[];
  /** Posición de la palabra en el texto, para resaltarla mientras la consultas. */
  sitio: string;
}

const TAMANO_MIN = 16;
const TAMANO_MAX = 34;

interface NodoLista {
  e: ElementoLista;
  hijos: NodoLista[];
}

/** Los elementos de una lista, que llegan en orden con su nivel, como árbol: cada uno con los que cuelgan de él. */
function arbolDeLista(elementos: ElementoLista[]): NodoLista[] {
  const raices: NodoLista[] = [];
  const pila: NodoLista[] = [];
  for (const e of elementos) {
    const nodo = { e, hijos: [] };
    while (pila.length && pila[pila.length - 1].e.nivel >= e.nivel) pila.pop();
    (pila.length ? pila[pila.length - 1].hijos : raices).push(nodo);
    pila.push(nodo);
  }
  return raices;
}

/** Los hermanos seguidos del mismo tipo van en la misma lista. */
function tramosDeLista(nodos: NodoLista[]): NodoLista[][] {
  const tramos: NodoLista[][] = [];
  for (const n of nodos) {
    const ultimo = tramos[tramos.length - 1];
    if (ultimo && ultimo[0].e.ordenada === n.e.ordenada) ultimo.push(n);
    else tramos.push([n]);
  }
  return tramos;
}

/** Cómo sigue la lectura en voz alta tras una frase: con la siguiente, parándose, o con la misma otra vez. */
type ModoVoz = 'seguido' | 'frase' | 'repetir';
const MODOS_VOZ: { id: ModoVoz; nombre: string; ayuda: string; icono: NombreIcono }[] = [
  { id: 'seguido', nombre: tm('Seguido'), ayuda: tm('Lee todo seguido'), icono: 'continua' },
  { id: 'frase', nombre: tm('Frase a frase'), ayuda: tm('Se para al acabar cada frase'), icono: 'pausa' },
  { id: 'repetir', nombre: tm('Repetir'), ayuda: tm('Repite la frase una y otra vez, para decirla a la vez'), icono: 'repetir' },
];
/** Lo más largo que se practica de una vez: unas pocas frases. */
const MAXIMO_SELECCION = 300;
const VELOCIDADES = [0.6, 0.8, 1, 1.2];
/** El respiro entre una repetición y la siguiente. */
const PAUSA_REPETIR_MS = 900;

export function TextoInteractivo({ texto, bloques: hechos, ajustes, titulo, tamano = 22, inicioBarra, pie, completo = false }: {
  texto: string;
  /** Los bloques ya hechos, en lugar de leerlos de `texto`: el texto de una página del visor, que no es Markdown. */
  bloques?: Bloque[];
  ajustes: Ajustes;
  titulo?: string;
  tamano?: number;
  /** Lo que va al principio de la barra de lectura: volver, título. */
  inicioBarra?: ComponentChildren;
  /** Lo que va debajo del texto: paginación. */
  pie?: ComponentChildren;
  /** A todo lo ancho, sin la hoja: el Cuaderno. */
  completo?: boolean;
}) {
  const bloques = useMemo(() => hechos ?? leerEstructura(texto), [hechos, texto]);
  const { frases, deLinea } = useMemo(() => frasesDeBloques(bloques, lengua.value.escritura.frase.partir), [bloques, lengua.value.id]);
  // Lo analizado va con las frases que se analizaron. Al abrir la pestaña, la lengua llega después que el texto: las frases
  // se vuelven a partir con sus reglas, y lo analizado con las de antes no debe pintarse en otro sitio.
  const clave = frases.join('\n');
  const [analizado, fijarAnalizado] = useState<{ clave: string; tokens: PalabraToken[][] }>({ clave: '', tokens: [] });
  const tokens = analizado.clave === clave ? analizado.tokens : [];
  const [abierta, fijarAbierta] = useState<Abierta | null>(null);
  /** La práctica del acento ocupa el sitio de la consulta, con la frase en curso del texto. */
  const [practicando, fijarPracticando] = useState(false);
  /** Un trozo seleccionado que se practica en lugar de la frase en curso. */
  const [trozoPractica, fijarTrozoPractica] = useState<string | null>(null);
  const [seleccion, fijarSeleccion] = useState<{ texto: string; x: number; y: number } | null>(null);
  const papelRef = useRef<HTMLElement>(null);
  const [actual, fijarActual] = useState(-1);
  const [sonando, fijarSonando] = useState(false);
  const [tam, fijarTam] = useState(() => leerPreferencia('tamanoLectura', tamano));
  const audio = useRef<HTMLAudioElement | null>(null);
  const parar = useRef(false);
  // Cómo se lee en voz alta: a qué velocidad, y si sigue, se para tras cada frase o la repite.
  const [velocidad, fijarVelocidad] = useState<number>(() => leerPreferencia('velocidadLectura', 1));
  const [modoVoz, fijarModoVoz] = useState<ModoVoz>(() => leerPreferencia('modoLectura', 'seguido'));
  const velocidadRef = useRef(velocidad);
  velocidadRef.current = velocidad;
  const modoVozRef = useRef(modoVoz);
  modoVozRef.current = modoVoz;

  const analizar = () =>
    motor
      .analizarTexto(clave)
      .then((t) => fijarAnalizado({ clave, tokens: t }))
      .catch(console.error);
  useEffect(() => {
    analizar();
    return alRecibirEvento((e) => {
      if (e.tipo === 'palabras' || e.tipo === 'palabrasRecargar') analizar();
    });
  }, [clave]);

  useEffect(() => {
    if (!abierta) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fijarAbierta(null);
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [!!abierta]);

  const comprension = useMemo(() => {
    let total = 0;
    let conocidas = 0;
    for (const l of tokens) {
      for (const p of l) {
        if (!p.esPalabra || p.estado === 'ignorada') continue;
        total++;
        if (p.estado !== 'desconocida') conocidas++;
      }
    }
    return { total, porcentaje: total ? Math.round((conocidas / total) * 100) : 0 };
  }, [tokens]);

  const decir = (i: number): Promise<void> => decirTexto(frases[i] ?? '');

  /** Lee un texto con la voz de las frases, a la velocidad elegida. */
  const decirTexto = async (f: string): Promise<void> => {
    if (!f.trim()) return;
    if (hayVozSintetica(ajustes)) {
      // La voz local o la de Azure; si no contestan (el programa cerrado), la del navegador.
      const datos = await motor.vozFrase(f, ajustes.vocesFrase[0]).catch(() => null);
      if (datos) {
        await new Promise<void>((ok) => {
          const a = new Audio(`data:audio/mpeg;base64,${datos}`);
          audio.current = a;
          a.playbackRate = velocidadRef.current;
          a.onended = () => ok();
          a.onerror = () => ok();
          a.play().catch(() => ok());
        });
        return;
      }
    }
    await decirConNavegador(f, undefined, velocidadRef.current);
  };

  const reproducirDesde = async (i: number) => {
    parar.current = false;
    fijarSonando(true);
    let k = Math.max(i, 0);
    while (k < frases.length && !parar.current) {
      fijarActual(k);
      await decir(k);
      if (parar.current) break;
      const modo = modoVozRef.current;
      // Repetir: la misma frase otra vez, tras un respiro para repetirla en voz alta.
      if (modo === 'repetir') {
        await new Promise((ok) => setTimeout(ok, PAUSA_REPETIR_MS));
        continue;
      }
      // Frase a frase: se para, y la siguiente queda lista para el próximo «Leer».
      if (modo === 'frase') {
        fijarActual(Math.min(k + 1, frases.length - 1));
        break;
      }
      k++;
    }
    fijarSonando(false);
  };

  const detener = () => {
    parar.current = true;
    audio.current?.pause();
    speechSynthesis.cancel();
    fijarSonando(false);
  };

  useEffect(() => detener, []);

  const cambiarTam = (d: number) => {
    const n = Math.max(TAMANO_MIN, Math.min(TAMANO_MAX, tam + d));
    fijarTam(n);
    guardarPreferencia('tamanoLectura', n);
  };

  const pintarPalabra = (p: PalabraToken, i: number, k: number) => (
    <span
      key={k}
      class={['pal', `est-${p.estado}`, p.rastreada ? 'rastreada' : '', p.patron && ajustes.colorAcento !== 'ninguno' ? `ac-${p.patron}` : '', abierta?.sitio === `${i}-${k}` ? 'ap-elegida' : ''].join(' ')}
      onClick={(e) => {
        e.stopPropagation();
        const f = frases[i];
        fijarPracticando(false);
        fijarAbierta({
          palabra: p,
          frase: f,
          antes: frases.slice(Math.max(0, i - 6), i),
          despues: frases.slice(i + 1, i + 7),
          gramatica: motorDe(lengua.value.id).detectarGramatica(f),
          sitio: `${i}-${k}`,
        });
      }}
    >
      {p.furigana.map((s, j) =>
        s.lectura && ajustes.furigana !== 'ninguna' ? (
          <ruby key={j}>{s.texto}<rt>{lengua.value.lectura.visible(s.lectura, ajustes.formatoLectura)}</rt></ruby>
        ) : (
          <span key={j}>{s.texto}</span>
        )
      )}
    </span>
  );

  /**
   * Una frase con sus palabras. Lo que el análisis no cubre (espacios, sangría) se pinta tal cual entre ellas; si algún
   * trozo no aparece en el texto, se pintan solo las piezas, como antes. Las negritas se miden sobre el texto de la línea.
   */
  const pintarFrase = ({ indice, inicio }: FraseDeLinea, negritas: [number, number][]) => {
    const texto = frases[indice];
    const piezas = tokens[indice] ?? [];
    const salida: JSX.Element[] = [];
    let cursor = 0;
    let alineado = true;
    piezas.forEach((p, k) => {
      const pos = alineado ? texto.indexOf(p.superficie, cursor) : -1;
      if (pos < 0) alineado = false;
      else {
        if (pos > cursor) salida.push(<span key={`h${k}`}>{texto.slice(cursor, pos)}</span>);
        cursor = pos + p.superficie.length;
      }
      const pieza = p.esPalabra ? pintarPalabra(p, indice, k) : <span key={k}>{lengua.value.escritura.pegarSignos(p.superficie)}</span>;
      const negrita = pos >= 0 && negritas.some(([a, b]) => a < inicio + cursor && b > inicio + pos);
      salida.push(negrita ? <b key={`b${k}`}>{pieza}</b> : pieza);
    });
    if (alineado && cursor < texto.length) salida.push(<span key="fin">{texto.slice(cursor)}</span>);
    return <span key={indice} class={indice === actual ? 'oracion-activa' : ''}>{salida}</span>;
  };

  // Se practica una frase con palabras: la lengua tiene que saber partirla en frases acentuales.
  const puedePracticar = !!lengua.value.acento?.practica && tokens.length > 0;
  const frasePractica = Math.max(actual, 0);
  const practicar = () => {
    if (practicando && !trozoPractica) {
      fijarPracticando(false);
      return;
    }
    detener();
    fijarAbierta(null);
    fijarTrozoPractica(null);
    fijarActual(frasePractica);
    fijarPracticando(true);
  };
  /** Practicar un trozo cualquiera: una palabra, media frase o varias, seleccionadas con el ratón. */
  const practicarTrozo = (texto: string) => {
    detener();
    fijarAbierta(null);
    fijarTrozoPractica(texto);
    fijarPracticando(true);
    fijarSeleccion(null);
  };

  const cambiarVelocidad = () => {
    const v = VELOCIDADES[(VELOCIDADES.indexOf(velocidad) + 1) % VELOCIDADES.length] ?? 1;
    fijarVelocidad(v);
    guardarPreferencia('velocidadLectura', v);
    // Lo que suena ya cambia de velocidad; con la voz del navegador, desde la frase siguiente.
    if (audio.current) audio.current.playbackRate = v;
  };
  const cambiarModoVoz = () => {
    const m = MODOS_VOZ[(MODOS_VOZ.findIndex((x) => x.id === modoVoz) + 1) % MODOS_VOZ.length].id;
    fijarModoVoz(m);
    guardarPreferencia('modoLectura', m);
  };
  const modoActual = MODOS_VOZ.find((m) => m.id === modoVoz) ?? MODOS_VOZ[0];

  /** Lo seleccionado en el texto, sin el furigana: el texto de cada palabra, no su lectura. */
  const leerSeleccion = () => {
    const s = getSelection();
    const papel = papelRef.current;
    if (!s || s.isCollapsed || !s.rangeCount || !papel) return fijarSeleccion(null);
    const rango = s.getRangeAt(0);
    if (!papel.contains(rango.commonAncestorContainer)) return fijarSeleccion(null);
    const copia = rango.cloneContents();
    copia.querySelectorAll('rt, rp').forEach((x) => x.remove());
    const texto = (copia.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!texto || texto.length > MAXIMO_SELECCION) return fijarSeleccion(null);
    const caja = rango.getBoundingClientRect();
    fijarSeleccion({ texto, x: caja.left + caja.width / 2, y: caja.top });
  };
  useEffect(() => {
    if (!seleccion) return;
    const quitar = () => {
      const s = getSelection();
      if (!s || s.isCollapsed) fijarSeleccion(null);
    };
    const alMover = () => fijarSeleccion(null);
    const principal = document.querySelector('.ap-principal');
    document.addEventListener('selectionchange', quitar);
    principal?.addEventListener('scroll', alMover, { passive: true });
    return () => {
      document.removeEventListener('selectionchange', quitar);
      principal?.removeEventListener('scroll', alMover);
    };
  }, [seleccion]);

  const pintarLinea = (l: Linea) => (deLinea.get(l) ?? []).map((f) => pintarFrase(f, l.negritas));
  const conSaltos = (lineas: Linea[], salto: () => ComponentChildren) => lineas.map((l, j) => <Fragment key={j}>{j > 0 && salto()}{pintarLinea(l)}</Fragment>);

  const pintarLista = (nodos: NodoLista[]): JSX.Element[] =>
    tramosDeLista(nodos).map((tramo, t) => {
      const elementos = tramo.map((n, j) => (
        <li key={j}>
          {conSaltos(n.e.lineas, () => <br />)}
          {n.hijos.length > 0 && pintarLista(n.hijos)}
        </li>
      ));
      return tramo[0].e.ordenada ? <ol key={t} start={tramo[0].e.numero || 1}>{elementos}</ol> : <ul key={t}>{elementos}</ul>;
    });

  const pintarBloque = (b: Bloque, i: number) => {
    switch (b.tipo) {
      case 'parrafo':
        return <p key={i} class="ap-p">{conSaltos(b.lineas, () => <br />)}</p>;
      case 'titulo': {
        const Titulo = (['h2', 'h3', 'h4'] as const)[b.nivel - 1];
        return <Titulo key={i} class="ap-t">{pintarLinea(b.linea)}</Titulo>;
      }
      case 'lista':
        return <Fragment key={i}>{pintarLista(arbolDeLista(b.elementos))}</Fragment>;
      case 'cita':
        return <blockquote key={i} class="ap-cita">{conSaltos(b.lineas, () => <br />)}</blockquote>;
      case 'codigo':
        return <pre key={i} class="ap-codigo">{conSaltos(b.lineas, () => '\n')}</pre>;
      case 'tabla':
        return (
          <div key={i} class="ap-tabla">
            <table>
              {b.cabecera && <thead><tr>{b.cabecera.map((c, j) => <th key={j}>{pintarLinea(c)}</th>)}</tr></thead>}
              <tbody>{b.filas.map((f, r) => <tr key={r}>{f.map((c, j) => <td key={j}>{pintarLinea(c)}</td>)}</tr>)}</tbody>
            </table>
          </div>
        );
      case 'separador':
        return <hr key={i} class="ap-sep" />;
      case 'dictado':
        return <GrabacionDictada key={i} id={b.id} />;
    }
  };

  return (
    <div class={`ap-lectura ${completo ? 'completo' : ''} ${abierta || (practicando && puedePracticar) ? 'con-ficha' : ''}`}>
      <div class="ap-lectura-principal">
        <div class="ap-lectura-barra">
          <div class="ap-lectura-inicio">{inicioBarra}</div>
          <div class="ap-lectura-datos">
            {tokens.length > 0 && (
              <span class="ap-comprension" data-tip={tr('{0} palabras en este texto', numero(comprension.total))}>
                <Anillo valor={comprension.porcentaje} t={26} grosor={3.5} />
                <b class="num">{comprension.porcentaje} %</b> {tr('de comprensión')}
              </span>
            )}
            <div class="ap-tamano" role="group" aria-label={tr('Tamaño del texto')}>
              <button class="btn-icono chico" aria-label={tr('Reducir el texto')} disabled={tam <= TAMANO_MIN} onClick={() => cambiarTam(-2)}><Icono n="menos" t={14} /></button>
              <span aria-hidden="true">{lengua.value.ejemplos.letra}</span>
              <button class="btn-icono chico" aria-label={tr('Aumentar el texto')} disabled={tam >= TAMANO_MAX} onClick={() => cambiarTam(2)}><Icono n="mas" t={14} /></button>
            </div>
          </div>
        </div>

        <article ref={papelRef} class="ap-papel" lang={lengua.value.id} style={{ fontSize: `${tam}px` }} onClick={() => fijarAbierta(null)} onMouseUp={() => setTimeout(leerSeleccion, 0)} onKeyUp={() => setTimeout(leerSeleccion, 0)}>
          {/* Un texto sin frases, como una grabación cuyo párrafo se borró, no espera ningún análisis. */}
          {tokens.length === 0 && frases.length > 0 ? (
            <div aria-hidden="true">
              <span class="esqueleto" style={{ width: '96%' }} />
              <span class="esqueleto" style={{ width: '88%' }} />
              <span class="esqueleto" style={{ width: '92%' }} />
              <span class="esqueleto" style={{ width: '60%' }} />
            </div>
          ) : (
            bloques.map(pintarBloque)
          )}
        </article>

        {pie}

        <div class="ap-dock">
          <div>
            <button class="btn-icono" aria-label={tr('Frase anterior')} data-tip={tr('Frase anterior')} data-tip-lado="arriba" onClick={() => { detener(); fijarActual((a) => Math.max(a - 1, 0)); }}><Icono n="anterior" /></button>
            {sonando ? (
              <button class="btn primario" onClick={detener}><Icono n="detener" t={15} /> {tr('Detener')}</button>
            ) : (
              <button class="btn primario" onClick={() => reproducirDesde(actual)}><Icono n="altavoz" t={16} /> {tr('Leer en voz alta')}</button>
            )}
            <button class="btn-icono" aria-label={tr('Frase siguiente')} data-tip={tr('Frase siguiente')} data-tip-lado="arriba" onClick={() => { detener(); fijarActual((a) => Math.min(a + 1, frases.length - 1)); }}><Icono n="siguiente" /></button>
            <span class="ap-dock-separacion" aria-hidden="true" />
            <button class="btn-icono ap-dock-velocidad num" aria-label={tr('Velocidad de la voz: {0}', `${numero(velocidad)}×`)} data-tip={tr('Velocidad de la voz')} data-tip-lado="arriba" onClick={cambiarVelocidad}>{numero(velocidad)}×</button>
            <button class={`btn-icono ${modoVoz !== 'seguido' ? 'activo' : ''}`} aria-label={`${tr(modoActual.nombre)}: ${tr(modoActual.ayuda)}`} data-tip={`${tr(modoActual.nombre)} · ${tr(modoActual.ayuda)}`} data-tip-lado="arriba" onClick={cambiarModoVoz}><Icono n={modoActual.icono} /></button>
            {puedePracticar && (
              <button class={`btn ${practicando ? 'activo' : ''}`} aria-pressed={practicando} data-tip={tr('Lee la frase en voz alta y mira dónde cae el tono en cada palabra')} data-tip-lado="arriba" onClick={practicar}>
                <Icono n="ondas" t={16} /> {tr('Practicar')}
              </button>
            )}
          </div>
        </div>
      </div>

      {practicando && puedePracticar && !abierta && (
        <div class="ap-lectura-ficha ap-lectura-practica" role="dialog" aria-label={tr('Practicar el acento')} key={`practica-${trozoPractica ?? frasePractica}`}>
          <Practica
            frase={trozoPractica ?? frases[frasePractica] ?? ''}
            palabras={trozoPractica ? [] : tokens[frasePractica] ?? []}
            ajustes={ajustes}
            alCerrar={() => {
              fijarPracticando(false);
              fijarTrozoPractica(null);
            }}
          />
        </div>
      )}

      {seleccion && (
        <div class="ap-seleccion" role="toolbar" aria-label={tr('Lo seleccionado')} style={{ left: `${seleccion.x}px`, top: `${seleccion.y}px` }} onMouseDown={(e) => e.preventDefault()}>
          <button class="btn chico fantasma" onClick={() => void decirTexto(seleccion.texto)}><Icono n="altavoz" t={14} /> {tr('Escuchar')}</button>
          {lengua.value.acento?.practica && <button class="btn chico fantasma" onClick={() => practicarTrozo(seleccion.texto)}><Icono n="ondas" t={14} /> {tr('Practicar')}</button>}
        </div>
      )}

      {abierta && (
        <div class="ap-lectura-ficha" role="dialog" aria-label={tr('Consulta de {0}', abierta.palabra.lema)} key={abierta.sitio}>
          <button class="btn-icono chico ap-lectura-cerrar" aria-label={tr('Cerrar la consulta')} onClick={() => fijarAbierta(null)}><Icono n="cerrar" t={15} /></button>
          <Ficha
            lema={abierta.palabra.lema}
            lectura={abierta.palabra.lecturaLema}
            superficie={abierta.palabra.superficie}
            flexion={abierta.palabra.flexion}
            compuestos={lengua.value.frasesEnLector ? (() => {
              const linea = tokens[frases.indexOf(abierta.frase)] ?? [];
              return linea.slice(Math.max(0, linea.indexOf(abierta.palabra))).map((x) => x.superficie);
            })() : undefined}
            ajustes={ajustes}
            gramatica={abierta.gramatica}
            // Contexto amplio: las frases alrededor y el texto entero para documentos no muy largos.
            contexto={{ frase: abierta.frase, antes: abierta.antes, despues: abierta.despues, titulo, guion: (hechos ? frases.join('').length : texto.length) < 60000 ? textoPlano(bloques) : undefined }}
            alCorregirLectura={analizar}
            alEnviar={(r) =>
              enviarAlCreador(
                {
                  palabra: r.lema,
                  lectura: lecturaDeTarjeta(r),
                  frase: fraseConNegrita(tokens[frases.indexOf(abierta.frase)] ?? [], abierta.palabra.clave) || abierta.frase,
                  definicion: [...new Set(r.entradas.flatMap((e) => e.glosas))].slice(0, 5).join('<br>'),
                  fuente: titulo,
                },
                false
              )
            }
          />
        </div>
      )}
    </div>
  );
}
