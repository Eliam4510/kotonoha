// El progreso de la Memoria: la racha, cuánto se acierta en las tarjetas de repaso, lo de hoy, y dos gráficas de una sola
// serie (repasos de los últimos 30 días y lo que vence en los próximos 14), con su tabla al lado para no depender del ratón.
// Las columnas siguen el método de visualización del proyecto: de 24 px como mucho, 2 px de aire entre ellas, la punta
// redondeada y la base recta; el color, validado en cada tema (ver app.css, --serie-memoria).

import { useEffect, useState } from 'preact/hooks';
import { bcp47Actual, numero, tr } from '../compartido/i18n';
import { motor } from '../compartido/rpc';
import type { Estadisticas } from '../nucleo/memoria';
import { useEsperar } from '../ui/preparacion';

/** Una escala limpia para el eje: 1, 2 o 5 por una potencia de diez, por encima del máximo. */
export function topeLimpio(maximo: number): number {
  if (maximo <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(maximo));
  for (const m of [1, 2, 5, 10]) if (m * p >= maximo) return m * p;
  return 10 * p;
}

const fecha = (dia: string, o: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) => {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(a, m - 1, d, 12).toLocaleDateString(bcp47Actual(), o);
};

interface Columna {
  dia: string;
  valor: number;
  detalle?: string;
}

/** Columnas de una serie, con su eje, la cifra de una sola columna y la ayuda al pasar por cada una. */
function Columnas({ titulo, columnas, unidad, rotular, etiquetaFin }: { titulo: string; columnas: Columna[]; unidad: (n: number) => string; rotular: number; etiquetaFin: string }) {
  const [encima, fijarEncima] = useState<number | null>(null);
  const tope = topeLimpio(Math.max(0, ...columnas.map((c) => c.valor)));
  const c = encima !== null ? columnas[encima] : null;
  return (
    <figure class="ap-grafica" aria-label={titulo}>
      <figcaption>{titulo}</figcaption>
      <div class="ap-grafica-zona">
        <div class="ap-grafica-eje" aria-hidden="true">
          {[tope, tope / 2, 0].map((v) => (
            <span key={v} class="num">{numero(v)}</span>
          ))}
        </div>
        <div class="ap-grafica-plano" onMouseLeave={() => fijarEncima(null)}>
          <div class="ap-grafica-rejilla" aria-hidden="true"><i /><i /><i /></div>
          {columnas.map((col, i) => (
            <div key={col.dia} class={`ap-grafica-columna ${encima === i ? 'encima' : ''}`} onMouseEnter={() => fijarEncima(i)} aria-hidden="true">
              {col.valor > 0 && <span class="ap-grafica-barra" style={{ height: `${(col.valor / tope) * 100}%` }} />}
              {i === rotular && col.valor > 0 && <b class="ap-grafica-cifra num" style={{ bottom: `calc(${(col.valor / tope) * 100}% + 4px)` }}>{numero(col.valor)}</b>}
            </div>
          ))}
          {c && encima !== null && (
            <div class="ap-grafica-ayuda" style={{ left: `${((encima + 0.5) / columnas.length) * 100}%` }} role="status">
              <b class="num">{unidad(c.valor)}</b>
              <span>{c.detalle ? `${c.detalle} · ` : ''}{fecha(c.dia, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
            </div>
          )}
        </div>
      </div>
      <div class="ap-grafica-fechas" aria-hidden="true">
        <span>{fecha(columnas[0].dia)}</span>
        <span>{etiquetaFin}</span>
      </div>
      <details class="ap-grafica-tabla">
        <summary>{tr('Ver como tabla')}</summary>
        <table>
          <tbody>
            {columnas.map((col) => (
              <tr key={col.dia}>
                <th scope="row">{fecha(col.dia, { weekday: 'short', day: 'numeric', month: 'short' })}</th>
                <td class="num">{unidad(col.valor)}{col.detalle ? ` · ${col.detalle}` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

export function ProgresoMemoria() {
  const [e, fijarE] = useState<Estadisticas | null>(null);
  const esperar = useEsperar();
  useEffect(() => {
    esperar(motor.memoriaEstadisticas().then(fijarE)).catch(console.error);
  }, []);
  if (!e) return null;
  const total = e.porEstado.nueva + e.porEstado.aprendiendo + e.porEstado.repaso + e.porEstado.suspendida;
  const repasos = e.porDia.map((d) => ({ dia: d.dia, valor: d.repasos, detalle: d.repasos ? tr('{0} acertados', numero(d.aciertos)) : undefined }));
  const vencen = e.vencen.map((d) => ({ dia: d.dia, valor: d.tarjetas }));
  const maxRepasos = repasos.reduce((m, c, i) => (c.valor > repasos[m].valor ? i : m), 0);
  return (
    <div class="ap-progreso-memoria">
      <dl class="ap-memoria-cifras">
        <div class="ap-memoria-cifra">
          <dt>{tr('Racha')}</dt>
          <dd>{e.racha === 1 ? tr('1 día') : tr('{0} días', numero(e.racha))}</dd>
        </div>
        <div class="ap-memoria-cifra">
          <dt>{tr('Aciertos en repaso')}</dt>
          <dd>{e.retencion === null ? '—' : `${numero(Math.round(e.retencion * 100))} %`}</dd>
          <small>{tr('Últimos 30 días, sin contar las nuevas')}</small>
        </div>
        <div class="ap-memoria-cifra">
          <dt>{tr('Repasadas hoy')}</dt>
          <dd>{numero(e.hoy.repasos)}</dd>
          {e.hoy.repasos > 0 && <small>{tr('{0} acertados', numero(e.hoy.aciertos))}</small>}
        </div>
        <div class="ap-memoria-cifra">
          <dt>{tr('Tarjetas')}</dt>
          <dd>{numero(total)}</dd>
          <small>{tr('{0} nuevas · {1} aprendiendo · {2} en repaso', numero(e.porEstado.nueva), numero(e.porEstado.aprendiendo), numero(e.porEstado.repaso))}</small>
        </div>
      </dl>
      <div class="ap-graficas">
        <Columnas titulo={tr('Repasos de los últimos 30 días')} columnas={repasos} rotular={maxRepasos} etiquetaFin={tr('Hoy')} unidad={(n) => (n === 1 ? tr('1 repaso') : tr('{0} repasos', numero(n)))} />
        <Columnas titulo={tr('Lo que vence en los próximos 14 días')} columnas={vencen} rotular={0} etiquetaFin={fecha(vencen[vencen.length - 1].dia)} unidad={(n) => (n === 1 ? tr('1 tarjeta') : tr('{0} tarjetas', numero(n)))} />
      </div>
    </div>
  );
}
