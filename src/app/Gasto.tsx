// Cuánto se lleva gastado en Claude este mes: la cifra, una gráfica por días y el registro de peticiones.
// Solo cuenta lo que pidió esta extensión en este navegador, con los tokens que la propia API informa.

import { useEffect, useMemo, useState } from 'preact/hooks';
import { motor } from '../compartido/rpc';
import { agruparRegistro, claveDia, claveMes, dolares, type DiaConsumo, type FilaConsumo, NOMBRE_TAREA, resumirConsumo, tokensLegibles } from '../nucleo/precios';
import { Icono } from '../ui/iconos';

/** El color sigue al modelo, no a su posición: filtrar o cambiar de mes no repinta nada. */
const CLASE_MODELO: Record<string, string> = { 'Sonnet 5.5': 'm-sonnet', 'Opus 5.5': 'm-opus', 'Haiku 5.5': 'm-haiku' };
const claseModelo = (m: string) => CLASE_MODELO[m] ?? 'm-otro';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const nombreMes = (mes: string) => {
  const [a, m] = mes.split('-').map(Number);
  return `${MESES[m - 1]} de ${a}`;
};

function mesVecino(mes: string, paso: number): string {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(a, m - 1 + paso, 1);
  return claveMes(d.getTime());
}

/** Un eje con cifras redondas: el tope es el siguiente número limpio por encima del máximo. */
function topeLimpio(maximo: number): number {
  if (maximo <= 0) return 1;
  const orden = 10 ** Math.floor(Math.log10(maximo));
  for (const f of [1, 2, 2.5, 5, 10]) if (f * orden >= maximo) return f * orden;
  return 10 * orden;
}

function Columnas({ dias, modelos, hoy }: { dias: DiaConsumo[]; modelos: string[]; hoy: string }) {
  const [activo, fijarActivo] = useState<DiaConsumo | null>(null);
  const tope = topeLimpio(Math.max(...dias.map((d) => d.coste)));
  const iActivo = activo ? dias.indexOf(activo) : -1;
  // El globo va al lado de la columna, sin taparla, y hacia donde hay sitio.
  const ladoGlobo = iActivo > dias.length / 2 ? 'der' : '';
  return (
    <div class="ap-gasto-grafica" role="img" aria-label={`Gasto por día: ${dias.filter((d) => d.coste > 0).map((d) => `día ${Number(d.dia.slice(8))}, ${dolares(d.coste)}`).join('; ') || 'sin gasto'}`}>
      <div class="ap-gasto-eje" aria-hidden="true">
        <span class="num">{dolares(tope)}</span>
        <span class="num">{dolares(tope / 2)}</span>
        <span class="num">USD 0</span>
      </div>
      <div class="ap-gasto-lienzo" onMouseLeave={() => fijarActivo(null)}>
        <i class="ap-gasto-rejilla" style={{ top: '0%' }} />
        <i class="ap-gasto-rejilla" style={{ top: '50%' }} />
        <i class="ap-gasto-rejilla base" style={{ top: '100%' }} />
        <div class="ap-gasto-columnas">
          {dias.map((d) => (
            <div key={d.dia} class={`ap-gasto-dia ${d.dia === hoy ? 'hoy' : ''} ${activo?.dia === d.dia ? 'activo' : ''}`} onMouseEnter={() => fijarActivo(d.coste > 0 ? d : null)}>
              <div class="ap-gasto-pila">
                {modelos.filter((m) => d.porModelo[m]).map((m) => (
                  <i key={m} class={claseModelo(m)} style={{ height: `${(d.porModelo[m] / tope) * 100}%` }} />
                ))}
              </div>
            </div>
          ))}
        </div>
        {activo && activo.coste > 0 && (
          <div class={`ap-gasto-globo ${ladoGlobo}`} style={{ left: `${((iActivo + 0.5) / dias.length) * 100}%` }}>
            <b>Día {Number(activo.dia.slice(8))}: {dolares(activo.coste)}</b>
            {modelos.filter((m) => activo.porModelo[m]).map((m) => (
              <span key={m}><i class={claseModelo(m)} />{m}: {dolares(activo.porModelo[m])}</span>
            ))}
          </div>
        )}
      </div>
      <div class="ap-gasto-fechas" aria-hidden="true">
        <span class="num">1</span>
        <span class="num">{Math.ceil(dias.length / 2)}</span>
        <span class="num">{dias.length}</span>
      </div>
    </div>
  );
}

export function TarjetaGasto({ credito }: { credito: number }) {
  const mesActual = claveMes(Date.now());
  const [mes, fijarMes] = useState(mesActual);
  const [filas, fijarFilas] = useState<FilaConsumo[] | null>(null);
  const [todo, fijarTodo] = useState(false);

  const cargar = () => {
    const [a, m] = mes.split('-').map(Number);
    motor.consumo(new Date(a, m - 1, 1).getTime()).then(fijarFilas).catch(() => fijarFilas([]));
  };
  useEffect(() => {
    cargar();
    // Lo que se gaste en otra pestaña aparece al volver a esta, o poco después si sigue a la vista.
    const t = setInterval(() => {
      if (!document.hidden) cargar();
    }, 20000);
    const alVolver = () => {
      if (!document.hidden) cargar();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [mes]);

  const delMes = useMemo(() => (filas ?? []).filter((f) => f.mes === mes), [filas, mes]);
  const r = useMemo(() => resumirConsumo(delMes, mes), [delMes, mes]);
  const registro = useMemo(() => agruparRegistro(delMes), [delMes]);
  const modelos = r.porModelo.map((g) => g.nombre);
  const hoy = claveDia(Date.now());
  const cache = r.cacheEscritura5m + r.cacheEscritura1h + r.cacheLectura;
  const parte = credito > 0 ? Math.min(100, (r.coste / credito) * 100) : 0;
  const visibles = todo ? registro : registro.slice(0, 6);

  return (
    <section class="tarjeta ap-c12 ap-gasto" aria-labelledby="ap-t-gasto">
      <div class="ap-tarjeta-cab ap-gasto-cab">
        <span class="hoja-icono chica"><Icono n="ia" t={18} /></span>
        <h2 id="ap-t-gasto">Gasto en Claude</h2>
        <div class="ap-gasto-mes">
          <button class="btn-icono chico" aria-label="Mes anterior" onClick={() => fijarMes(mesVecino(mes, -1))}><Icono n="flecha-izq" t={15} /></button>
          <span>{nombreMes(mes)}</span>
          <button class="btn-icono chico" aria-label="Mes siguiente" disabled={mes >= mesActual} onClick={() => fijarMes(mesVecino(mes, 1))}><Icono n="flecha" t={15} /></button>
        </div>
      </div>

      {filas === null ? (
        <div class="esqueleto ap-gasto-cargando" aria-hidden="true" />
      ) : !delMes.length ? (
        <p class="ayuda">Aún no hay gasto registrado este mes. Cuando le preguntes algo a Claude, aparecerá aquí, con los tokens y el modelo de cada petición.</p>
      ) : (
        <>
          <div class="ap-gasto-cuerpo">
            <div class="ap-gasto-resumen">
              <div class="ap-cifra-grande">
                <b class="num">{dolares(r.coste)}</b>
                <span>{credito > 0 ? `de USD ${credito} de crédito` : 'este mes'}</span>
              </div>
              {credito > 0 && <div class="barra-progreso ap-gasto-credito" role="progressbar" aria-valuenow={Math.round(parte)} aria-valuemin={0} aria-valuemax={100} aria-label="Crédito gastado"><div style={{ width: `${Math.max(parte, 0.5)}%` }} /></div>}
              <dl class="ap-cifras-menores ap-gasto-tokens">
                <div><dt>Entrada</dt><dd class="num">{tokensLegibles(r.entrada)}</dd></div>
                <div><dt>Salida</dt><dd class="num">{tokensLegibles(r.salida)}</dd></div>
                <div><dt>Caché</dt><dd class="num">{tokensLegibles(cache)}</dd></div>
                <div><dt>Peticiones</dt><dd class="num">{r.peticiones.toLocaleString('es')}</dd></div>
              </dl>
            </div>
            <div class="ap-gasto-columna-grafica">
              <Columnas dias={r.porDia} modelos={modelos} hoy={hoy} />
              <ul class="ap-gasto-leyenda">
                {r.porModelo.map((g) => (
                  <li key={g.clave}><i class={claseModelo(g.nombre)} aria-hidden="true" /><span>{g.nombre}</span><b class="num">{dolares(g.coste)}</b><small class="num">{tokensLegibles(g.entrada + g.salida + g.cacheEscritura5m + g.cacheEscritura1h + g.cacheLectura)} tokens</small></li>
                ))}
              </ul>
              <details class="ap-gasto-tabla">
                <summary>Ver como tabla</summary>
                <table>
                  <thead>
                    <tr><th scope="col">Día</th>{modelos.map((m) => <th key={m} scope="col" class="num">{m}</th>)}<th scope="col" class="num">Total</th></tr>
                  </thead>
                  <tbody>
                    {r.porDia.filter((d) => d.coste > 0).map((d) => (
                      <tr key={d.dia}><th scope="row" class="num">{Number(d.dia.slice(8))}</th>{modelos.map((m) => <td key={m} class="num">{d.porModelo[m] ? dolares(d.porModelo[m]) : ''}</td>)}<td class="num"><b>{dolares(d.coste)}</b></td></tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </div>
          </div>

          <div class="ap-gasto-detalle">
            <div>
              <h3>En qué se va</h3>
              <ul class="ap-gasto-tareas">
                {r.porTarea.map((g) => (
                  <li key={g.clave}>
                    <span>{g.nombre}</span>
                    <small class="num">{g.peticiones.toLocaleString('es')} {g.peticiones === 1 ? 'petición' : 'peticiones'}</small>
                    <b class="num">{dolares(g.coste)}</b>
                    <i class="ap-gasto-parte" aria-hidden="true"><i style={{ width: `${(g.coste / Math.max(r.coste, 1e-9)) * 100}%` }} /></i>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Registro</h3>
              <ul class="ap-gasto-registro">
                {visibles.map((e) => (
                  <li key={e.inicio}>
                    <time class="num">{new Date(e.inicio).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time>
                    <span class="ap-gasto-que">
                      <b>{NOMBRE_TAREA[e.tarea] ?? e.tarea}</b>
                      {e.titulo && <small title={e.titulo}>{e.titulo}</small>}
                    </span>
                    <small class="num ap-gasto-uso">{e.modelos.join(', ')} · {tokensLegibles(e.tokens)}{e.peticiones > 1 ? ` · ${e.peticiones} peticiones` : ''}</small>
                    <b class="num">{dolares(e.coste)}</b>
                  </li>
                ))}
              </ul>
              {registro.length > 6 && <button class="btn fantasma chico" onClick={() => fijarTodo(!todo)}>{todo ? 'Ver menos' : `Ver los ${registro.length}`}</button>}
            </div>
          </div>
          <p class="ayuda ap-gasto-nota">Calculado con los tokens que informa la API y sus precios públicos. Incluye solo lo pedido desde esta extensión en este navegador.</p>
        </>
      )}
    </section>
  );
}

