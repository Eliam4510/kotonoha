// Texto interactivo para el lector y la biblioteca, con consulta de palabras y lectura en voz alta.

import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Ajustes } from '../compartido/ajustes';
import { alRecibirEvento, motor } from '../compartido/rpc';
import type { PalabraToken } from '../compartido/tipos';
import { fraseConNegrita } from '../nucleo/frases';
import { detectarGramatica, type PuntoGramatica } from '../nucleo/gramatica';
import { pegarSignos } from '../nucleo/tokens';
import { enviarAlCreador } from '../ui/borrador';
import { Ficha } from '../ui/Ficha';
import { Icono } from '../ui/iconos';
import { guardarPreferencia, leerPreferencia } from './estadoApp';
import { Anillo } from './Piezas';

interface Abierta {
  palabra: PalabraToken;
  frase: string;
  antes: string[];
  despues: string[];
  gramatica: PuntoGramatica[];
  /** Posición de la palabra en el texto, para resaltarla mientras la consultas. */
  sitio: string;
}

const FIN_DE_FRASE = /(?<=[。！？!?])/;
const TAMANO_MIN = 16;
const TAMANO_MAX = 34;

/** Parte el texto en párrafos y estos en frases, que es la unidad de la lectura en voz alta. */
export function partirFrases(texto: string): string[] {
  return texto.split(/\r?\n/).flatMap((p) => (p.trim() ? p.split(FIN_DE_FRASE) : [''])).filter((f, i, l) => f || (l[i - 1] && l[i - 1] !== ''));
}

export function TextoInteractivo({ texto, ajustes, titulo, tamano = 22, inicioBarra, pie }: {
  texto: string;
  ajustes: Ajustes;
  titulo?: string;
  tamano?: number;
  /** Lo que va al principio de la barra de lectura: volver, título. */
  inicioBarra?: ComponentChildren;
  /** Lo que va debajo del texto: paginación. */
  pie?: ComponentChildren;
}) {
  const frases = useMemo(() => partirFrases(texto), [texto]);
  const [tokens, fijarTokens] = useState<PalabraToken[][]>([]);
  const [abierta, fijarAbierta] = useState<Abierta | null>(null);
  const [actual, fijarActual] = useState(-1);
  const [sonando, fijarSonando] = useState(false);
  const [tam, fijarTam] = useState(() => leerPreferencia('tamanoLectura', tamano));
  const audio = useRef<HTMLAudioElement | null>(null);
  const parar = useRef(false);

  const analizar = () => motor.analizarTexto(frases.join('\n')).then(fijarTokens).catch(console.error);
  useEffect(() => {
    analizar();
    return alRecibirEvento((e) => {
      if (e.tipo === 'palabras' || e.tipo === 'palabrasRecargar') analizar();
    });
  }, [texto]);

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

  const decir = async (i: number): Promise<void> => {
    const f = frases[i];
    if (!f?.trim()) return;
    if (ajustes.azureClave) {
      const datos = await motor.vozFrase(f, ajustes.vocesFrase[0]);
      await new Promise<void>((ok) => {
        const a = new Audio(`data:audio/mpeg;base64,${datos}`);
        audio.current = a;
        a.onended = () => ok();
        a.onerror = () => ok();
        a.play().catch(() => ok());
      });
    } else {
      await new Promise<void>((ok) => {
        const u = new SpeechSynthesisUtterance(f);
        u.lang = 'ja-JP';
        u.onend = () => ok();
        u.onerror = () => ok();
        speechSynthesis.speak(u);
      });
    }
  };

  const reproducirDesde = async (i: number) => {
    parar.current = false;
    fijarSonando(true);
    for (let k = Math.max(i, 0); k < frases.length && !parar.current; k++) {
      fijarActual(k);
      await decir(k);
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

  return (
    <div class={`ap-lectura ${abierta ? 'con-ficha' : ''}`}>
      <div class="ap-lectura-principal">
        <div class="ap-lectura-barra">
          <div class="ap-lectura-inicio">{inicioBarra}</div>
          <div class="ap-lectura-datos">
            {tokens.length > 0 && (
              <span class="ap-comprension" data-tip={`${comprension.total.toLocaleString('es')} palabras en este texto`}>
                <Anillo valor={comprension.porcentaje} t={26} grosor={3.5} />
                <b class="num">{comprension.porcentaje} %</b> de comprensión
              </span>
            )}
            <div class="ap-tamano" role="group" aria-label="Tamaño del texto">
              <button class="btn-icono chico" aria-label="Reducir el texto" disabled={tam <= TAMANO_MIN} onClick={() => cambiarTam(-2)}><Icono n="menos" t={14} /></button>
              <span aria-hidden="true">あ</span>
              <button class="btn-icono chico" aria-label="Aumentar el texto" disabled={tam >= TAMANO_MAX} onClick={() => cambiarTam(2)}><Icono n="mas" t={14} /></button>
            </div>
          </div>
        </div>

        <article class="ap-papel" lang="ja" style={{ fontSize: `${tam}px` }} onClick={() => fijarAbierta(null)}>
          {tokens.length === 0 && (
            <div aria-hidden="true">
              <span class="esqueleto" style={{ width: '96%' }} />
              <span class="esqueleto" style={{ width: '88%' }} />
              <span class="esqueleto" style={{ width: '92%' }} />
              <span class="esqueleto" style={{ width: '60%' }} />
            </div>
          )}
          {frases.map((f, i) => (
            <span key={i} class={i === actual ? 'oracion-activa' : ''}>
              {!f.trim() && <br />}
              {(tokens[i] ?? []).map((p, k) =>
                p.esPalabra ? (
                  <span
                    key={k}
                    class={['pal', `est-${p.estado}`, p.rastreada ? 'rastreada' : '', p.patron && ajustes.colorAcento !== 'ninguno' ? `ac-${p.patron}` : '', abierta?.sitio === `${i}-${k}` ? 'ap-elegida' : ''].join(' ')}
                    onClick={(e) => {
                      e.stopPropagation();
                      fijarAbierta({
                        palabra: p,
                        frase: f,
                        antes: frases.slice(Math.max(0, i - 6), i),
                        despues: frases.slice(i + 1, i + 7),
                        gramatica: detectarGramatica(f),
                        sitio: `${i}-${k}`,
                      });
                    }}
                  >
                    {p.furigana.map((s, j) =>
                      s.lectura && ajustes.furigana !== 'ninguna' ? (
                        <ruby key={j}>{s.texto}<rt>{s.lectura}</rt></ruby>
                      ) : (
                        <span key={j}>{s.texto}</span>
                      )
                    )}
                  </span>
                ) : (
                  <span key={k}>{pegarSignos(p.superficie)}</span>
                )
              )}
            </span>
          ))}
        </article>

        {pie}

        <div class="ap-dock">
          <div>
            <button class="btn-icono" aria-label="Frase anterior" data-tip="Frase anterior" data-tip-lado="arriba" onClick={() => { detener(); fijarActual((a) => Math.max(a - 1, 0)); }}><Icono n="anterior" /></button>
            {sonando ? (
              <button class="btn primario" onClick={detener}><Icono n="detener" t={15} /> Detener</button>
            ) : (
              <button class="btn primario" onClick={() => reproducirDesde(actual)}><Icono n="altavoz" t={16} /> Leer en voz alta</button>
            )}
            <button class="btn-icono" aria-label="Frase siguiente" data-tip="Frase siguiente" data-tip-lado="arriba" onClick={() => { detener(); fijarActual((a) => Math.min(a + 1, frases.length - 1)); }}><Icono n="siguiente" /></button>
          </div>
        </div>
      </div>

      {abierta && (
        <div class="ap-lectura-ficha" role="dialog" aria-label={`Consulta de ${abierta.palabra.lema}`} key={abierta.sitio}>
          <button class="btn-icono chico ap-lectura-cerrar" aria-label="Cerrar la consulta" onClick={() => fijarAbierta(null)}><Icono n="cerrar" t={15} /></button>
          <Ficha
            lema={abierta.palabra.lema}
            lectura={abierta.palabra.lecturaLema}
            superficie={abierta.palabra.superficie}
            flexion={abierta.palabra.flexion}
            ajustes={ajustes}
            gramatica={abierta.gramatica}
            // Contexto amplio: las frases alrededor y el texto entero para documentos no muy largos.
            contexto={{ frase: abierta.frase, antes: abierta.antes, despues: abierta.despues, titulo, guion: texto.length < 60000 ? texto : undefined }}
            alCorregirLectura={analizar}
            alEnviar={(r) =>
              enviarAlCreador(
                {
                  palabra: r.lema,
                  lectura: r.lectura,
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
