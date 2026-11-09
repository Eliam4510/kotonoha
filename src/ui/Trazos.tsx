// Cómo se escribe una palabra, trazo a trazo. Va en bucle como los GIF de los diccionarios, pero es un SVG animado:
// se ve nítido a cualquier tamaño, sigue el tema claro u oscuro, y se puede parar y avanzar de uno en uno.

import { useEffect, useMemo, useState } from 'preact/hooks';
import { tm, tr } from '../compartido/i18n';
import type { PalabraConocida } from '../compartido/api';
import { motor } from '../compartido/rpc';
import { type DatosTrazos, hechosPorCaracter } from '../nucleo/trazos';
import { Icono } from './iconos';
import { lengua } from './lengua';

/** Lo que tarda un trazo a velocidad normal, en milisegundos. */
const DURACION = 520;
const PAUSA_TRAZO = 120;
const PAUSA_CARACTER = 450;
const PAUSA_FINAL = 1600;
const VELOCIDADES = [0.5, 1, 2];

interface Cargado {
  caracter: string;
  datos: DatosTrazos | null;
}

function Lienzo({ k, hechos, dibujando, duracion, ultimo }: { k: Cargado; hechos: number; dibujando: boolean; duracion: number; ultimo: boolean }) {
  const total = k.datos?.trazos.length ?? 0;
  if (!k.datos) {
    return (
      <figure class="trazo-kanji sin-datos">
        <div class="trazo-vacio" lang={lengua.value.id}>{k.caracter}</div>
        <figcaption>{tr('Sin datos de trazos')}</figcaption>
      </figure>
    );
  }
  const { trazos, numeros } = k.datos;
  return (
    <figure class={`trazo-kanji ${dibujando ? 'activo' : ''}`}>
      <svg viewBox="0 0 109 109" role="img" aria-label={tr('Orden de los trazos de {0}', k.caracter)}>
        <path class="trazo-guia" d="M54.5 3V106M3 54.5H106" />
        {trazos.map((d, i) => <path key={i} class="trazo-fondo" d={d} />)}
        {trazos.slice(0, hechos).map((d, i) => <path key={i} class={`trazo-hecho ${ultimo && i === hechos - 1 ? 'ultimo' : ''}`} d={d} />)}
        {dibujando && hechos < total && <path key={`d${hechos}`} class="trazo-dibujando" pathLength={1} d={trazos[hechos]} style={{ animationDuration: `${duracion}ms` }} />}
        {numeros.slice(0, hechos + (dibujando ? 1 : 0)).map((n, i) => <text key={i} class="trazo-numero" x={n.x} y={n.y}>{i + 1}</text>)}
      </svg>
      <figcaption>
        <b lang={lengua.value.id}>{k.caracter}</b> · {total === 1 ? tr('1 trazo') : tr('{0} trazos', total)}
      </figcaption>
    </figure>
  );
}

/** Las que salen junto a los trazos: las conocidas y las que se están aprendiendo. */
const NOMBRE_ESTADO: Record<string, string> = { conocida: tm('Conocida'), aprendiendo: tm('Aprendiendo') };

/** El carácter resaltado dentro de la palabra: 冷 en 冷たい. */
function conResaltado(lema: string, caracter: string) {
  const partes = lema.split(caracter);
  return partes.flatMap((p, i) => (i ? [<b key={i}>{caracter}</b>, p] : [p]));
}

/**
 * Las palabras que ya se conocen, o se están aprendiendo, con los mismos caracteres que la que se consulta: el kanji
 * nuevo se recuerda a partir de lo que ya se sabe (冷蔵庫: 冷たい, 金庫).
 */
function Conocidas({ palabra }: { palabra: string }) {
  const conf = lengua.value.trazos?.conocidas;
  const caracteres = useMemo(() => conf?.caracteres(palabra) ?? [], [palabra, conf]);
  const [lista, fijarLista] = useState<Record<string, PalabraConocida[]> | null>(null);
  useEffect(() => {
    let vivo = true;
    fijarLista(null);
    if (caracteres.length) {
      motor
        .palabrasConCaracteres(caracteres, palabra)
        .then((l) => vivo && fijarLista(l))
        .catch(() => {});
    }
    return () => {
      vivo = false;
    };
  }, [palabra, caracteres.join('')]);
  if (!conf || !caracteres.length || !lista) return null;
  const con = caracteres.filter((c) => lista[c]?.length);
  return (
    <section class="trazos-conocidas" aria-label={tr(conf.titulo)}>
      <h4>{tr(conf.titulo)}</h4>
      {con.length ? (
        con.map((c) => (
          <div class="trazos-conocidas-fila" key={c}>
            <span class="trazos-conocidas-caracter" lang={lengua.value.id}>{c}</span>
            <ul>
              {lista[c].map((p) => (
                <li key={`${p.lema}|${p.lectura}`} class={p.estado} title={NOMBRE_ESTADO[p.estado] ? tr(NOMBRE_ESTADO[p.estado]) : undefined}>
                  <span lang={lengua.value.id}>{conResaltado(p.lema, c)}</span>
                  {p.lectura && p.lectura !== p.lema && <small lang={lengua.value.id}>{p.lectura}</small>}
                </li>
              ))}
            </ul>
          </div>
        ))
      ) : (
        <p class="ayuda">{tr(conf.ninguna, caracteres.join(' '))}</p>
      )}
    </section>
  );
}

/** `solo`: sin las palabras conocidas ni el crédito, para la página de un carácter, que los enseña a su manera. */
export function PanelTrazos({ palabra, solo }: { palabra: string; solo?: boolean }) {
  const fuente = lengua.value.trazos;
  const caracteres = useMemo(() => fuente?.caracteres(palabra) ?? [], [palabra, fuente]);
  const [cargados, fijarCargados] = useState<Cargado[] | null>(null);
  const [fallo, fijarFallo] = useState(false);
  const [intento, fijarIntento] = useState(0);
  const [sonando, fijarSonando] = useState(true);
  const [paso, fijarPaso] = useState(0);
  const [velocidad, fijarVelocidad] = useState(1);

  useEffect(() => {
    let vivo = true;
    fijarCargados(null);
    fijarFallo(false);
    fijarPaso(0);
    Promise.all(caracteres.map(async (caracter) => ({ caracter, datos: await motor.trazos(caracter) })))
      .then((lista) => {
        if (!vivo) return;
        fijarCargados(lista);
        // Quien pide menos movimiento ve el kanji entero, con sus números, y avanza a mano. Para los demás, cada palabra
        // nueva empieza a dibujarse aunque la anterior se quedara en pausa.
        const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
        fijarSonando(!quieto);
        if (quieto) fijarPaso(lista.reduce((s, k) => s + (k.datos?.trazos.length ?? 0), 0));
      })
      .catch(() => vivo && fijarFallo(true));
    return () => {
      vivo = false;
    };
  }, [palabra, intento]);

  const conteos = useMemo(() => (cargados ?? []).map((k) => k.datos?.trazos.length ?? 0), [cargados]);
  const total = conteos.reduce((s, c) => s + c, 0);
  const hechos = hechosPorCaracter(conteos, paso);
  const activo = paso < total ? hechos.findIndex((h, i) => h < conteos[i]) : -1;

  useEffect(() => {
    if (!sonando || !total) return;
    let espera = PAUSA_FINAL;
    if (activo >= 0) {
      // Al terminar un kanji se respira un poco antes de empezar el siguiente, como cuando se escribe.
      espera = DURACION / velocidad + (hechos[activo] + 1 === conteos[activo] ? PAUSA_CARACTER : PAUSA_TRAZO);
    }
    const t = setTimeout(() => fijarPaso(paso < total ? paso + 1 : 0), espera);
    return () => clearTimeout(t);
  }, [sonando, paso, total, velocidad]);

  if (fallo) {
    return (
      <div class="trazos">
        <p class="ayuda">{tr('No se pudieron cargar los trazos. Comprueba la conexión.')}</p>
        <button class="btn chico fantasma" onClick={() => fijarIntento((n) => n + 1)}><Icono n="recargar" t={14} /> {tr('Reintentar')}</button>
      </div>
    );
  }
  if (!cargados) {
    return (
      <div class="trazos" aria-busy="true">
        <div class="trazos-lienzos">
          {caracteres.map((c) => <span key={c} class="esqueleto trazo-esqueleto" />)}
        </div>
      </div>
    );
  }
  if (!cargados.length) return <p class="ayuda">{tr('Sin datos de trazos')}</p>;

  const parar = (siguiente: number) => {
    fijarSonando(false);
    fijarPaso(Math.max(0, Math.min(total, siguiente)));
  };

  return (
    <div class="trazos">
      <div class={`trazos-lienzos ${solo ? 'enormes' : cargados.length <= 2 ? 'grandes' : ''}`}>
        {cargados.map((k, i) => (
          <Lienzo key={k.caracter} k={k} hechos={hechos[i]} dibujando={sonando && i === activo} duracion={DURACION / velocidad} ultimo={!sonando && hechos[i] > 0 && (i === activo - 1 || i === activo || (activo === -1 && i === cargados.length - 1))} />
        ))}
      </div>
      {total > 0 && (
        <div class="trazos-controles">
          <button class="btn-icono chico" aria-label={tr('Volver a empezar')} data-tip={tr('Volver a empezar')} onClick={() => { fijarPaso(0); fijarSonando(true); }}><Icono n="reiniciar" t={15} /></button>
          <button class="btn-icono chico" aria-label={tr('Trazo anterior')} data-tip={tr('Trazo anterior')} disabled={paso <= 0} onClick={() => parar(paso - 1)}><Icono n="anterior" t={15} /></button>
          <button class="btn-icono chico" aria-label={sonando ? tr('Pausar') : tr('Reproducir')} data-tip={sonando ? tr('Pausar') : tr('Reproducir')} onClick={() => { if (!sonando && paso >= total) fijarPaso(0); fijarSonando(!sonando); }}><Icono n={sonando ? 'pausa' : 'reproducir'} t={15} /></button>
          <button class="btn-icono chico" aria-label={tr('Trazo siguiente')} data-tip={tr('Trazo siguiente')} disabled={paso >= total} onClick={() => parar(paso + 1)}><Icono n="siguiente" t={15} /></button>
          <span class="trazos-cuenta num">{tr('Trazo {0} de {1}', Math.min(paso + (sonando ? 1 : 0), total), total)}</span>
          <div class="segmentado trazos-velocidad" role="radiogroup" aria-label={tr('Velocidad de los trazos')}>
            {VELOCIDADES.map((v) => <button key={v} role="radio" aria-checked={velocidad === v} class={velocidad === v ? 'activo' : ''} onClick={() => fijarVelocidad(v)}>{v}×</button>)}
          </div>
        </div>
      )}
      {!solo && <Conocidas palabra={palabra} />}
      {fuente && !solo && <p class="trazos-credito"><a href={fuente.credito.url} target="_blank" rel="noreferrer noopener">{fuente.credito.nombre}</a>{` · ${fuente.credito.licencia}`}</p>}
    </div>
  );
}
