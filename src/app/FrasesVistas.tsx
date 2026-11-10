// Lo que comparten la página de una palabra y la de un carácter: las frases donde se ha visto, con su minuto, y las
// referencias que el diccionario mete entre las definiciones (sus opuestos, las que hay que ver).

import { Fragment } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { Ajustes } from '../compartido/ajustes';
import { numero } from '../compartido/i18n';
import { motor } from '../compartido/rpc';
import type { FraseEjemplo, PalabraToken, ResultadoBusqueda } from '../compartido/tipos';
import type { ReferenciaGlosa } from '../lenguas/tipos';
import { momentoLegible } from '../nucleo/momento';
import { BotonMomento, momentoDe } from '../ui/Ficha';
import { Icono } from '../ui/iconos';
import { lengua } from '../ui/lengua';
import { clasesPalabras } from '../ui/palabras';
import { sinCortes } from '../ui/sinCorte';
import { buscarPalabra } from './TarjetaPalabra';

/** Las referencias de una entrada (sus opuestos, las que hay que ver), sin repetir y sin ella misma. */
export function referenciasDe(r: ResultadoBusqueda): ReferenciaGlosa[] {
  const refDe = lengua.value.referenciaEnGlosa;
  if (!refDe) return [];
  const xs = r.entradas.flatMap((e) => e.glosas).flatMap((g) => refDe(g) ?? []);
  return xs.filter((x, i) => x.termino !== r.lema && xs.findIndex((y) => y.tipo === x.tipo && y.termino === x.termino) === i);
}

/**
 * Frases que ya has visto, con su lectura encima de las palabras y lo buscado resaltado. Las de un video llevan su
 * minuto y un botón para volver a ese momento. Al pulsar una palabra, se busca.
 */
export function FrasesVistas({ clave, titulo, cargar, resaltar, ajustes, vacio }: {
  clave: string;
  titulo: string;
  cargar: () => Promise<FraseEjemplo[]>;
  resaltar: (t: PalabraToken) => boolean;
  ajustes: Ajustes;
  vacio: string;
}) {
  const [filas, fijarFilas] = useState<FraseEjemplo[] | null>(null);
  const [tokens, fijarTokens] = useState<PalabraToken[][] | null>(null);
  useEffect(() => {
    let vivo = true;
    fijarFilas(null);
    fijarTokens(null);
    cargar()
      .then(async (fs) => {
        if (!vivo) return;
        fijarFilas(fs);
        if (!fs.length) return;
        // Una línea por frase: el análisis las devuelve en el mismo orden.
        const t = await motor.analizarTexto(fs.map((f) => f.texto.replace(/\s*\r?\n\s*/g, ' ')).join('\n')).catch(() => null);
        if (vivo && t && t.length === fs.length) fijarTokens(t);
      })
      .catch(() => vivo && fijarFilas([]));
    return () => {
      vivo = false;
    };
  }, [clave]);

  const id = lengua.value.id;
  const furigana = ajustes.furigana !== 'ninguna';
  return (
    <section class="dic-seccion dic-frases" aria-label={titulo}>
      <h3 class="dic-seccion-titulo">{titulo}{filas && filas.length > 0 && <span class="dic-cuenta num">{numero(filas.length)}</span>}</h3>
      {filas === null && <div class="dic-frases-lista">{[0, 1].map((i) => <span key={i} class="esqueleto dic-frase-esqueleto" />)}</div>}
      {filas?.length === 0 && <p class="ayuda">{vacio}</p>}
      {filas && filas.length > 0 && (
        <div class="dic-frases-lista">
          {filas.map((f, i) => {
            const m = momentoDe(f);
            return (
              <article key={i} class="dic-frase">
                <p class={`dic-frase-texto ${clasesPalabras(ajustes)}`} lang={id}>
                  {tokens?.[i]
                    ? sinCortes(tokens[i].map((t, j) => {
                        const contenido = t.furigana?.length
                          ? t.furigana.map((s, k) => (s.lectura && furigana ? <ruby key={k}>{s.texto}<rt>{lengua.value.lectura.visible(s.lectura, ajustes.formatoLectura)}</rt></ruby> : <Fragment key={k}>{s.texto}</Fragment>))
                          : t.superficie;
                        return t.esPalabra ? (
                          <span key={j} class={`pal est-${t.estado} ${resaltar(t) ? 'dic-resaltada' : ''}`} onClick={() => buscarPalabra(t.lema)}>{contenido}</span>
                        ) : (
                          <span key={j} class={resaltar(t) ? 'dic-resaltada' : undefined}>{contenido}</span>
                        );
                      }), tokens[i].map((t) => (t.esPalabra ? null : lengua.value.escritura.pegarSignos(t.superficie))))
                    : f.texto}
                </p>
                <div class="dic-frase-pie">
                  {f.fuente && <span class="dic-frase-fuente"><Icono n={m ? 'video' : 'libro'} t={13} /> <span>{f.fuente}</span></span>}
                  {m && <span class="dic-frase-momento num">{momentoLegible(m.ms)}</span>}
                  <BotonMomento f={f} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
