// El panel de una línea que el OCR leyó en la página: su texto con furigana y palabras que se pueden consultar, como un
// subtítulo, y debajo la ficha de la palabra elegida. Las líneas de alrededor van como contexto para Claude.

import { useEffect, useState } from 'preact/hooks';
import type { Ajustes } from '../compartido/ajustes';
import { tr } from '../compartido/i18n';
import { alRecibirEvento, motor } from '../compartido/rpc';
import type { PalabraToken } from '../compartido/tipos';
import { motorDe } from '../lenguas/motor';
import { fraseConNegrita } from '../nucleo/frases';
import type { LineaOcr } from '../nucleo/ocr';
import { enviarAlCreador } from '../ui/borrador';
import { Ficha } from '../ui/Ficha';
import { Icono } from '../ui/iconos';
import { lecturaDeTarjeta, lengua } from '../ui/lengua';

export function PanelLinea({ lineas, indice, ajustes, titulo, alMover, alCerrar }: {
  lineas: LineaOcr[];
  indice: number;
  ajustes: Ajustes;
  titulo: string;
  alMover: (paso: number) => void;
  alCerrar: () => void;
}) {
  const linea = lineas[indice];
  const [tokens, fijarTokens] = useState<PalabraToken[]>([]);
  const [elegida, fijarElegida] = useState<number | null>(null);

  const analizar = () =>
    motor
      .analizarTexto(linea.texto)
      .then((t) => fijarTokens(t[0] ?? []))
      .catch(console.error);

  useEffect(() => {
    fijarElegida(null);
    fijarTokens([]);
    analizar();
    return alRecibirEvento((e) => {
      if (e.tipo === 'palabras' || e.tipo === 'palabrasRecargar') analizar();
    });
  }, [linea.texto]);

  const palabra = elegida !== null ? tokens[elegida] : null;
  const antes = lineas.slice(Math.max(0, indice - 6), indice).map((l) => l.texto);
  const despues = lineas.slice(indice + 1, indice + 7).map((l) => l.texto);

  return (
    <aside class="vs-panel vs-panel-linea" aria-label={tr('Texto de la página')}>
      <div class="vs-panel-cab">
        <button class="btn-icono chico" aria-label={tr('Línea anterior')} data-tip={tr('Línea anterior')} disabled={indice === 0} onClick={() => alMover(-1)}><Icono n="flecha-arriba" t={15} /></button>
        <span class="num">{indice + 1} / {lineas.length}</span>
        <button class="btn-icono chico" aria-label={tr('Línea siguiente')} data-tip={tr('Línea siguiente')} disabled={indice >= lineas.length - 1} onClick={() => alMover(1)}><Icono n="flecha-abajo" t={15} /></button>
        <button class="btn-icono chico vs-cerrar" aria-label={tr('Cerrar')} onClick={alCerrar}><Icono n="cerrar" t={15} /></button>
      </div>
      <p class="vs-linea-texto" lang={lengua.value.id}>
        {tokens.length
          ? tokens.map((p, k) =>
              p.esPalabra ? (
                <span
                  key={k}
                  class={['pal', `est-${p.estado}`, p.rastreada ? 'rastreada' : '', p.patron && ajustes.colorAcento !== 'ninguno' ? `ac-${p.patron}` : '', elegida === k ? 'ap-elegida' : ''].join(' ')}
                  onClick={() => fijarElegida(k)}
                >
                  {p.furigana.map((s, j) =>
                    s.lectura && ajustes.furigana !== 'ninguna' ? (
                      <ruby key={j}>{s.texto}<rt>{lengua.value.lectura.visible(s.lectura, ajustes.formatoLectura)}</rt></ruby>
                    ) : (
                      <span key={j}>{s.texto}</span>
                    )
                  )}
                </span>
              ) : (
                <span key={k}>{lengua.value.escritura.pegarSignos(p.superficie)}</span>
              )
            )
          : linea.texto}
      </p>
      {palabra ? (
        <div class="vs-ficha">
          <Ficha
            key={`${indice}-${elegida}`}
            lema={palabra.lema}
            lectura={palabra.lecturaLema}
            superficie={palabra.superficie}
            flexion={palabra.flexion}
            ajustes={ajustes}
            gramatica={motorDe(lengua.value.id).detectarGramatica(linea.texto)}
            contexto={{ frase: linea.texto, antes, despues, titulo }}
            alCorregirLectura={analizar}
            alEnviar={(r) =>
              enviarAlCreador(
                {
                  palabra: r.lema,
                  lectura: lecturaDeTarjeta(r),
                  frase: fraseConNegrita(tokens, palabra.clave) || linea.texto,
                  definicion: [...new Set(r.entradas.flatMap((e) => e.glosas))].slice(0, 5).join('<br>'),
                  fuente: titulo,
                },
                false
              )
            }
          />
        </div>
      ) : (
        <p class="ayuda vs-pista">{tr('Toca una palabra para ver su ficha.')}</p>
      )}
    </aside>
  );
}
