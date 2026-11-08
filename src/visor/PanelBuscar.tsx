// Buscar en todo el libro: un panel al lado de las páginas con lo que se busca y lo encontrado, por páginas. Intro lleva
// al siguiente y Mayúsculas+Intro al anterior. Lo encontrado se marca en la página.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { numero, tr } from '../compartido/i18n';
import { buscarEnPagina, consultaDe, type Hallazgo, type IndicePagina, indiceDe } from '../nucleo/busqueda';
import { Icono } from '../ui/iconos';
import { lengua } from '../ui/lengua';

/** Más que esto no ayuda a encontrar nada: hay que buscar algo más concreto. */
const MAXIMO = 1000;

export function PanelBuscar({ paginas, total, hechas, consulta, alCambiarConsulta, sinEspacios, ocrActivo, alElegir, alCerrar }: {
  /** El texto de cada página que lo tiene, por su número. */
  paginas: Map<number, { lineas: { texto: string }[] }>;
  total: number;
  /** Cuántas páginas se han preparado ya: hasta llegar a `total`, el texto del libro se sigue preparando. */
  hechas: number;
  consulta: string;
  alCambiarConsulta: (q: string) => void;
  /** Japonés: se busca sin espacios. */
  sinEspacios: boolean;
  ocrActivo: boolean;
  alElegir: (h: Hallazgo) => void;
  alCerrar: () => void;
}) {
  const campo = useRef<HTMLInputElement>(null);
  useEffect(() => {
    campo.current?.focus();
    campo.current?.select();
  }, []);

  // Se busca un momento después de dejar de escribir: un libro largo tiene mucho texto.
  const [q, fijarQ] = useState(consulta);
  useEffect(() => {
    const t = setTimeout(() => fijarQ(consulta), 150);
    return () => clearTimeout(t);
  }, [consulta]);

  // El índice de cada página se hace una vez y sirve para todo lo que se busque después.
  const indices = useRef(new WeakMap<object, IndicePagina>());
  const buscada = consultaDe(q, { sinEspacios });
  const { hallazgos, mas } = useMemo(() => {
    const o = { sinEspacios };
    const salida: Hallazgo[] = [];
    if (!buscada) return { hallazgos: salida, mas: false };
    for (const n of [...paginas.keys()].sort((a, b) => a - b)) {
      const lineas = paginas.get(n)!.lineas;
      let ind = indices.current.get(lineas);
      if (!ind) {
        ind = indiceDe(lineas, o);
        indices.current.set(lineas, ind);
      }
      salida.push(...buscarEnPagina(n, lineas, buscada, o, ind, MAXIMO + 1 - salida.length));
      if (salida.length > MAXIMO) break;
    }
    return { hallazgos: salida.slice(0, MAXIMO), mas: salida.length > MAXIMO };
  }, [buscada, paginas, sinEspacios]);

  const [activo, fijarActivo] = useState(-1);
  useEffect(() => fijarActivo(-1), [buscada]);
  const elegir = (i: number) => {
    const h = hallazgos[i];
    if (!h) return;
    fijarActivo(i);
    alElegir(h);
  };
  const mover = (paso: number) => {
    const n = hallazgos.length;
    if (n) elegir(activo < 0 ? (paso > 0 ? 0 : n - 1) : (activo + paso + n) % n);
  };
  const lista = useRef<HTMLOListElement>(null);
  useEffect(() => {
    lista.current?.querySelector('.activo')?.scrollIntoView({ block: 'nearest' });
  }, [activo]);

  // Lo encontrado, por páginas, sin perder el número de cada uno en la lista entera.
  const grupos: { pagina: number; desde: number; hallazgos: Hallazgo[] }[] = [];
  hallazgos.forEach((h, i) => {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.pagina === h.pagina) ultimo.hallazgos.push(h);
    else grupos.push({ pagina: h.pagina, desde: i, hallazgos: [h] });
  });

  const preparando = hechas < total;
  const sinTexto = preparando ? 0 : total - paginas.size;
  const n = hallazgos.length;
  const estado = !buscada
    ? tr('Escribe una palabra para buscarla en todo el libro.')
    : n === 0
      ? tr('Sin resultados.')
      : mas
        ? tr('Más de {0} resultados: busca algo más concreto.', numero(MAXIMO))
        : n === 1
          ? tr('1 resultado.')
          : grupos.length === 1
            ? tr('{0} resultados en 1 página.', numero(n))
            : tr('{0} resultados en {1} páginas.', numero(n), numero(grupos.length));

  return (
    <aside class="vs-panel vs-panel-buscar" aria-label={tr('Buscar en el libro')}>
      <div class="vs-buscar-cab">
        <span class="vs-buscar-campo">
          <Icono n="buscar" t={14} />
          <input
            ref={campo}
            class="campo"
            type="search"
            lang={lengua.value.id}
            placeholder={tr('Buscar en el libro')}
            aria-label={tr('Buscar en el libro')}
            value={consulta}
            onInput={(e) => alCambiarConsulta(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.isComposing) {
                e.preventDefault();
                mover(e.shiftKey ? -1 : 1);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                alCerrar();
              }
            }}
          />
        </span>
        <button class="btn-icono chico" aria-label={tr('Resultado anterior')} data-tip={tr('Resultado anterior')} disabled={!n} onClick={() => mover(-1)}><Icono n="flecha-arriba" t={15} /></button>
        <button class="btn-icono chico" aria-label={tr('Resultado siguiente')} data-tip={tr('Resultado siguiente')} disabled={!n} onClick={() => mover(1)}><Icono n="flecha-abajo" t={15} /></button>
        <button class="btn-icono chico" aria-label={tr('Cerrar')} onClick={alCerrar}><Icono n="cerrar" t={15} /></button>
      </div>
      <p class="ayuda vs-buscar-estado" role="status">
        {activo >= 0 && n > 0 && <span class="num vs-buscar-posicion">{activo + 1} / {n}</span>}
        {estado}
      </p>
      {preparando && <p class="ayuda vs-buscar-preparando">{tr('Preparando el texto del libro: {0} de {1} páginas…', numero(hechas), numero(total))}</p>}
      {grupos.length > 0 && (
        <ol class="vs-resultados" ref={lista}>
          {grupos.map((g) => (
            <li key={g.pagina}>
              <span class="vs-resultados-pagina">{tr('Página {0}', g.pagina + 1)}</span>
              <ul>
                {g.hallazgos.map((h, k) => {
                  const i = g.desde + k;
                  return (
                    <li key={k}>
                      <button class={`vs-resultado ${i === activo ? 'activo' : ''}`} lang={lengua.value.id} aria-current={i === activo ? 'true' : undefined} onClick={() => elegir(i)}>
                        {h.antes}
                        <mark>{h.texto}</mark>
                        {h.despues}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}
      {sinTexto > 0 && (
        <p class="ayuda vs-buscar-aviso">
          {sinTexto === total
            ? tr('Las páginas de este libro aún no tienen texto.')
            : sinTexto === 1
              ? tr('1 página aún no tiene texto, y no se busca en ella.')
              : tr('{0} páginas aún no tienen texto, y no se busca en ellas.', numero(sinTexto))}{' '}
          {ocrActivo ? tr('El OCR lee cada página al abrirla; para leerlas todas de una vez, usa «Procesar» en la estantería.') : tr('Activa «Leer el texto de las páginas» para leerlas con el OCR.')}
        </p>
      )}
    </aside>
  );
}
