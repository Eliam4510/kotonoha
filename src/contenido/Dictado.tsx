// El modo «Dictado» sobre el video: al final de cada frase, que se oyó sin verla, se escribe lo oído y se compara con el
// subtítulo. En japonés cuenta cómo se lee, así que vale escribir en kana; en las demás lenguas, palabra a palabra.

import { useEffect, useRef, useState } from 'preact/hooks';
import { tr } from '../compartido/i18n';
import { fondo, motor } from '../compartido/rpc';
import type { LineaAnalizada } from '../compartido/tipos';
import { evaluarConLecturas, evaluarDictado, palabrasDe, type ParteDictado, type ResultadoDictado } from '../nucleo/ejercicioDictado';
import { Icono } from '../ui/iconos';
import { lengua } from '../ui/lengua';
import { reproducir } from './controlador';

/** Lo que se oye de un trozo en la lengua que distingue lecturas: su lectura en hiragana, sin signos ni espacios. */
function lecturaDe(texto: string, lectura: string, esPalabra: boolean): string {
  const paquete = lengua.value;
  if (!esPalabra && !paquete.escritura.tieneTexto(texto)) return '';
  return [...paquete.lectura.normalizar(lectura || texto)].filter((c) => /[\p{L}\p{N}]/u.test(c)).join('');
}

async function evaluar(l: LineaAnalizada, escrito: string): Promise<ResultadoDictado> {
  if (lengua.value.lectura.distingue) {
    const partes: ParteDictado[] = l.palabras.map((p) => ({ texto: p.superficie, clave: lecturaDe(p.superficie, p.lectura, p.esPalabra) }));
    // Lo escrito se analiza igual que el subtítulo: 猫 y ねこ se leen igual.
    const tokens = (await motor.analizarTexto(escrito)).flat();
    const leido = tokens.map((t) => lecturaDe(t.superficie, t.lectura, t.esPalabra)).join('');
    // Una palabra con kanji y sin conjugar puede leerse como diga el diccionario: 後 es あと, のち o ご según la frase,
    // y el analizador no siempre acierta cuál.
    const otras = await Promise.all(
      l.palabras.map(async (p) => {
        if (!p.esPalabra || p.superficie !== p.lema || !/\p{Script=Han}/u.test(p.superficie)) return undefined;
        const r = await motor.buscar(p.lema).catch(() => null);
        return [...new Set((r?.entradas ?? []).filter((e) => e.termino === p.lema).map((e) => lecturaDe(e.lectura, e.lectura, true)))];
      })
    );
    return evaluarConLecturas(partes, otras, [...leido], (clave) => [...clave]);
  }
  const partes: ParteDictado[] = l.palabras.map((p) => ({ texto: p.superficie, clave: palabrasDe(p.superficie).join(' ') }));
  return evaluarDictado(partes, palabrasDe(escrito), (clave) => (clave ? clave.split(' ') : []));
}

export function EjercicioDictado({ l, alRepetir }: { l: LineaAnalizada; alRepetir: () => void }) {
  const [escrito, fijarEscrito] = useState('');
  const [resultado, fijarResultado] = useState<ResultadoDictado | null>(null);
  const [comprobando, fijarComprobando] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const botonSeguir = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    fijarEscrito('');
    fijarResultado(null);
    // Para escribir sin tocar el ratón: la frase acaba de sonar.
    setTimeout(() => campo.current?.focus(), 30);
  }, [l.id]);

  const comprobar = async () => {
    if (comprobando) return;
    fijarComprobando(true);
    try {
      fijarResultado(await evaluar(l, escrito));
      // Enter sigue con la próxima frase.
      setTimeout(() => botonSeguir.current?.focus(), 30);
    } finally {
      fijarComprobando(false);
    }
  };
  const seguir = () => {
    fijarResultado(null);
    reproducir().catch(() => {});
  };

  return (
    // Las teclas se quedan aquí: escribir no debe saltar a los atajos del video ni a los del sitio.
    <div class="dictado-video" onKeyDown={(e) => e.stopPropagation()} onKeyUp={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      {!resultado ? (
        <form class="dictado-escribir" onSubmit={(e) => { e.preventDefault(); comprobar(); }}>
          <Icono n="oido" t={18} />
          <input
            ref={campo}
            class="campo"
            lang={lengua.value.id}
            value={escrito}
            placeholder={tr('Escribe lo que has oído')}
            aria-label={tr('Escribe lo que has oído')}
            onInput={(e) => fijarEscrito(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') seguir();
            }}
          />
          <button type="button" class="btn-icono chico" data-tip={tr('Oír otra vez')} aria-label={tr('Oír otra vez')} onClick={alRepetir}><Icono n="repetir" t={16} /></button>
          <button type="submit" class="btn chico primario" disabled={comprobando}>{tr('Comprobar')}</button>
        </form>
      ) : (
        <div class="dictado-resultado">
          <div class="dictado-frase" lang={lengua.value.id}>
            {resultado.partes.map((p, i) => <span key={i} class={`dictado-${p.acierto}`}>{p.texto}</span>)}
          </div>
          <div class="dictado-pie">
            <b class={`dictado-nota ${resultado.nota >= 0.9 ? 'alta' : resultado.nota >= 0.6 ? 'media' : 'baja'}`}>{Math.round(resultado.nota * 100)} %</b>
            {escrito && <span class="dictado-escrito" lang={lengua.value.id}>{tr('Escribiste: {0}', escrito)}</span>}
            <span class="dictado-hueco" />
            <button class="btn chico" onClick={alRepetir}><Icono n="repetir" t={14} /> {tr('Oír otra vez')}</button>
            {lengua.value.acento?.practica && (
              <button class="btn chico" onClick={() => fondo.abrirApp(`practicar?t=${encodeURIComponent(l.texto)}`)}><Icono n="microfono" t={14} /> {tr('Repetir con tu voz')}</button>
            )}
            <button ref={botonSeguir} class="btn chico primario" onClick={seguir}>{tr('Seguir')} <kbd class="tecla">Enter</kbd></button>
          </div>
        </div>
      )}
    </div>
  );
}
