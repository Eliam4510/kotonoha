// La página de un carácter suelto (un kanji): cómo se escribe, y practicarlo; qué significa; todas sus lecturas, con las
// de fuera de la lista oficial y las de nombres; su radical, sus piezas y cómo se formó; su familia por el sonido y los
// que lo llevan dentro; los que se le parecen, se le oponen o se leen igual; sus formas antiguas; las palabras que lo
// llevan y dónde lo has visto. Lo que trae el diccionario de caracteres solo sale si está instalado: sin él, la página se
// queda con lo de las listas y los trazos, y ofrece instalarlo.

import { useEffect, useRef, useState } from 'preact/hooks';
import type { Ajustes } from '../compartido/ajustes';
import { idiomaActual, numero, tr } from '../compartido/i18n';
import { alRecibirEvento, motor } from '../compartido/rpc';
import type { CaracterBreve, CaracterConNivel, FichaCaracter, FuenteBiblioteca, LecturaCaracter, LecturasCaracter, ProgresoInstalacion } from '../compartido/tipos';
import type { DiccionarioCaracteresLengua, RotuloConAyuda } from '../lenguas/tipos';
import type { EntradaBreve } from '../nucleo/explorar';
import type { DatosTrazos, PiezaCaracter } from '../nucleo/trazos';
import { PanelFlujo } from '../ui/Ficha';
import { Icono } from '../ui/iconos';
import { lengua } from '../ui/lengua';
import { useEsperar } from '../ui/preparacion';
import { PanelTrazos } from '../ui/Trazos';
import { type ModoEscritura, PracticaEscritura } from './Escritura';
import { guardarPreferencia, leerPreferencia } from './estadoApp';
import { FrasesVistas, referenciasDe } from './FrasesVistas';
import { buscarPalabra, SeccionTarjetas } from './TarjetaPalabra';

/** Lo que significa en el idioma de la interfaz. Si el diccionario no lo trae en él, en inglés, que casi siempre está. */
export function significadoDe(s: Record<string, string[]> | undefined): { textos: string[]; lang?: string } {
  const propio = s?.[idiomaActual()];
  if (propio?.length) return { textos: propio };
  return { textos: s?.en ?? [], lang: 'en' };
}

/** Una lectura, con lo que va tras el punto (el kana que sigue al carácter) más suave y la época de la que viene. */
function Lectura({ l, d }: { l: LecturaCaracter; d?: DiccionarioCaracteresLengua }) {
  const [raiz, cola] = l.texto.split('.');
  const origen = l.origen ? d?.origenes[l.origen] : undefined;
  return (
    <span class={`dic-lectura ${l.poco ? 'poco' : ''}`} lang={lengua.value.id} data-tip={l.poco ? tr('Oficial, pero solo en unas pocas palabras') : undefined}>
      {raiz}
      {cola && <span class="dic-lectura-cola">{cola}</span>}
      {origen && <span class="dic-lectura-origen" lang={idiomaActual()} data-tip={tr(origen.ayuda)}>{tr(origen.nombre)}</span>}
    </span>
  );
}

/** Cuántas lecturas de fuera de la lista se enseñan antes de pedir el resto: hay kanji con veinte. */
const OTRAS_A_LA_VISTA = 6;

/** Una clase de lecturas: las oficiales y, más suaves, las demás. Si el carácter no tiene ninguna oficial, todas son las suyas. */
function FilaLecturas({ rotulo, l, sinLista, d }: { rotulo: RotuloConAyuda; l: LecturasCaracter; sinLista: boolean; d?: DiccionarioCaracteresLengua }) {
  const [todas, fijarTodas] = useState(false);
  const principales = sinLista ? l.otras : l.oficiales;
  const otras = sinLista ? [] : l.otras;
  if (!principales.length && !otras.length) return null;
  const vistas = todas ? otras : otras.slice(0, OTRAS_A_LA_VISTA);
  return (
    <div class="dic-lecturas-fila">
      <dt data-tip={tr(rotulo.ayuda)}>{tr(rotulo.nombre)}</dt>
      <dd>
        {principales.map((x) => <Lectura key={x.texto} l={x} d={d} />)}
        {!principales.length && <span class="dic-lecturas-ninguna">{tr('Ninguna oficial')}</span>}
        {otras.length > 0 && d && (
          <span class="dic-lecturas-otras">
            <span class="dic-lecturas-otras-rotulo" data-tip={tr(d.otras.ayuda)}>{tr(d.otras.nombre)}</span>
            {vistas.map((x) => <Lectura key={x.texto} l={x} d={d} />)}
            {otras.length > vistas.length && <button class="btn-texto" onClick={() => fijarTodas(true)}>{tr('+{0} más', otras.length - vistas.length)}</button>}
          </span>
        )}
      </dd>
    </div>
  );
}

/** Las lecturas de nombres de persona, que pueden ser muchas: unas pocas a la vista y el resto al pedirlas. */
function FilaNombres({ rotulo, nombres }: { rotulo: RotuloConAyuda; nombres: string[] }) {
  const [todas, fijarTodas] = useState(false);
  if (!nombres.length) return null;
  const vistas = todas ? nombres : nombres.slice(0, 8);
  return (
    <div class="dic-lecturas-fila">
      <dt data-tip={tr(rotulo.ayuda)}>{tr(rotulo.nombre)}</dt>
      <dd>
        {vistas.map((n) => <span key={n} class="dic-lectura nombre" lang={lengua.value.id}>{n}</span>)}
        {nombres.length > vistas.length && <button class="btn-texto" onClick={() => fijarTodas(true)}>{tr('+{0} más', nombres.length - vistas.length)}</button>}
      </dd>
    </div>
  );
}

function Piezas({ piezas, fonetico }: { piezas: PiezaCaracter[]; fonetico?: string }) {
  const id = lengua.value.id;
  return (
    <div class="dic-piezas">
      <span class="dic-etiqueta">{tr('Piezas')}</span>
      <div class="dic-piezas-lista">
        {piezas.filter((p, i) => piezas.findIndex((q) => q.caracter === p.caracter) === i).map((p) => (
          <button key={p.caracter} class={`dic-pieza ${p.radical ? 'radical' : ''}`} onClick={() => buscarPalabra(p.original ?? p.caracter)}>
            <b lang={id}>{p.caracter}</b>
            {p.original && <small>{tr('forma de {0}', p.original)}</small>}
            {p.radical && <small class="dic-pieza-radical">{tr('Radical')}</small>}
          </button>
        ))}
        {fonetico && (
          <button class="dic-pieza-fonetico" data-tip={tr('La pieza que le da su lectura')} onClick={() => buscarPalabra(fonetico)}>
            {tr('Da el sonido')} <b lang={id}>{fonetico}</b>
          </button>
        )}
      </div>
    </div>
  );
}

/** El mismo carácter en las letras de la lengua: impresa, de libro y la de escribir a mano. */
function FormasCaracter({ caracter }: { caracter: string }) {
  const paquete = lengua.value;
  const l = paquete.letras;
  if (!l) return null;
  const formas: [string, string][] = [[tr('Impresa'), l.gotica], [tr('De libro'), l.libro], ...(l.escuela ? [[tr('A mano'), l.escuela] as [string, string]] : [])];
  return (
    <section class="dic-seccion" aria-label={tr('Así se ve')}>
      <h3 class="dic-seccion-titulo">{tr('Así se ve')}</h3>
      {paquete.paginaCaracter && <p class="ayuda dic-seccion-ayuda">{tr(paquete.paginaCaracter.formas)}</p>}
      <div class="dic-formas">
        {formas.map(([nombre, letra]) => (
          <figure key={nombre} class="dic-forma">
            <span lang={paquete.id} style={{ fontFamily: letra }}>{caracter}</span>
            <figcaption>{nombre}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/** Sus formas antiguas, las de hoy si él es antiguo, otras variantes y cómo se escribe en chino si es distinto. */
function FormasAntiguas({ ficha, d }: { ficha: FichaCaracter; d: DiccionarioCaracteresLengua }) {
  const paquete = lengua.value;
  const v = ficha.variantes;
  const rotulos = new Map<string, string[]>();
  const anotar = (cs: (string | undefined)[], rotulo: string) => {
    for (const c of cs) if (c) rotulos.set(c, [...(rotulos.get(c) ?? []), rotulo]);
  };
  anotar(v.antiguas, tr('Forma antigua'));
  anotar(v.nuevas, tr('Forma de hoy'));
  anotar(v.otras, tr('Variante'));
  anotar([v.tradicional], tr('Chino tradicional'));
  anotar([v.simplificada], tr('Chino simplificado'));
  if (!rotulos.size) return null;
  return (
    <section class="dic-seccion" aria-label={tr('Formas antiguas y variantes')}>
      <h3 class="dic-seccion-titulo">{tr('Formas antiguas y variantes')}</h3>
      {v.antiguas.length > 0 && <p class="ayuda dic-seccion-ayuda">{tr(d.antiguas)}</p>}
      <div class="dic-formas variantes">
        {[...rotulos].map(([c, rs]) => (
          <button key={c} class="dic-forma dic-variante" onClick={() => buscarPalabra(c)}>
            <span lang={paquete.id} style={paquete.letras ? { fontFamily: paquete.letras.libro } : undefined}>{c}</span>
            <small>{rs.join(' · ')}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

/** Un carácter emparentado, en una tarjeta: él en grande, su lectura principal y lo que significa. */
function TarjetaCaracter({ c }: { c: CaracterBreve }) {
  const id = lengua.value.id;
  const s = significadoDe(c.significados);
  const [raiz, cola] = (c.lectura ?? '').split('.');
  const glosa = s.textos.slice(0, 3).join(', ');
  return (
    <button class="dic-kanji" onClick={() => buscarPalabra(c.caracter)} aria-label={glosa ? `${c.caracter}: ${glosa}` : c.caracter}>
      <b lang={id}>{c.caracter}</b>
      <span class="dic-kanji-texto">
        {c.lectura && (
          <span class="dic-kanji-lectura" lang={id}>
            {raiz}
            {cola && <span class="dic-lectura-cola">{cola}</span>}
          </span>
        )}
        {glosa && <small lang={s.lang}>{glosa}</small>}
      </span>
    </button>
  );
}

function SeccionCaracteres({ titulo, ayuda, xs, total, alVerMas }: { titulo: string; ayuda?: string; xs: CaracterBreve[] | null | undefined; total?: number; alVerMas?: () => void }) {
  if (!xs?.length) return null;
  return (
    <section class="dic-seccion" aria-label={titulo}>
      <h3 class="dic-seccion-titulo">
        {titulo}
        <span class="dic-cuenta num">{numero(total ?? xs.length)}</span>
      </h3>
      {ayuda && <p class="ayuda dic-seccion-ayuda">{ayuda}</p>}
      <div class="dic-kanjis">{xs.map((c) => <TarjetaCaracter key={c.caracter} c={c} />)}</div>
      {alVerMas && total !== undefined && total > xs.length && (
        <button class="btn fantasma chico ver-mas" onClick={alVerMas}>{tr('Ver más ({0})', numero(total - xs.length))} <Icono n="abajo" t={12} /></button>
      )}
    </section>
  );
}

/** Lo que explica una familia por el sonido: qué pieza lo da y si todos suenan igual. */
function ayudaFamilia(cabeza: string, propia: boolean, sonido: FichaCaracter['daSonido']): string {
  const lecturas = sonido?.lecturas.join(', ') ?? '';
  if (propia) {
    if (!sonido) return tr('Es la pieza que les da el sonido.');
    return sonido.tipo === 'siempre'
      ? tr('Es la pieza que les da el sonido: todos se leen {0}.', lecturas)
      : sonido.tipo === 'casi'
        ? tr('Es la pieza que les da el sonido: casi todos se leen {0}.', lecturas)
        : tr('Es la pieza que les da el sonido: se leen {0}.', lecturas);
  }
  if (!sonido) return tr('Llevan {0}, la pieza que les da el sonido.', cabeza);
  return sonido.tipo === 'siempre'
    ? tr('Llevan {0}, la pieza que les da el sonido, y todos se leen {1}.', cabeza, lecturas)
    : sonido.tipo === 'casi'
      ? tr('Llevan {0}, la pieza que les da el sonido, y casi todos se leen {1}.', cabeza, lecturas)
      : tr('Llevan {0}, la pieza que les da el sonido. Se leen {1}.', cabeza, lecturas);
}

/** Invita a instalar el diccionario de caracteres desde la misma página, con su avance. */
function InvitarAInstalar({ texto }: { texto: string }) {
  const [fuente, fijarFuente] = useState<FuenteBiblioteca | null>(null);
  const [progreso, fijarProgreso] = useState<ProgresoInstalacion | null>(null);
  const idFuente = useRef('');
  useEffect(() => {
    motor
      .fuentesDiccionario()
      .then((fs) => {
        const f = fs.find((x) => x.tipo === 'caracteres') ?? null;
        idFuente.current = f?.id ?? '';
        fijarFuente(f);
      })
      .catch(() => {});
    return alRecibirEvento((e) => {
      if (e.tipo === 'instalacion' && e.progreso.id === idFuente.current) fijarProgreso(e.progreso);
    });
  }, []);
  if (!fuente) return null;
  const activo = !!progreso && progreso.fase !== 'listo' && progreso.fase !== 'error';
  return (
    <div class="dic-instalar">
      <Icono n="descargar" t={18} />
      <div class="dic-instalar-texto">
        <p>{tr(texto)}</p>
        {activo ? (
          <div class="ap-instalando">
            <div class="barra-progreso"><div style={{ width: `${Math.round(progreso!.avance * 100)}%` }} /></div>
            <span class="num">{progreso!.fase === 'descargando' ? tr('Descargando') : tr('Guardando')} {Math.round(progreso!.avance * 100)} %</span>
          </div>
        ) : (
          <button class="btn chico primario" onClick={() => motor.instalarDiccionario(fuente.id).catch(() => {})}>{tr('Instalar')}</button>
        )}
        {progreso?.fase === 'error' && <span class="ap-texto-error">{progreso.error}</span>}
        <small class="ayuda">{tr(fuente.titulo)} · {fuente.licencia}</small>
      </div>
    </div>
  );
}

type VistaTrazos = 'orden' | 'practica';

export function PaginaCaracter({ caracter, ajustes }: { caracter: string; ajustes: Ajustes }) {
  const paquete = lengua.value;
  const pc = paquete.paginaCaracter!;
  const d = pc.diccionario;
  const listas = paquete.listasNivel;
  const [info, fijarInfo] = useState<CaracterConNivel | null>(null);
  const [trazos, fijarTrazos] = useState<DatosTrazos | null | undefined>(undefined);
  const [ficha, fijarFicha] = useState<FichaCaracter | null | undefined>(undefined);
  const [hayDic, fijarHayDic] = useState(true);
  const [breves, fijarBreves] = useState<Map<string, CaracterBreve>>(new Map());
  const [familia, fijarFamilia] = useState<{ cabeza: string; filas: CaracterBreve[]; total: number; sonido?: FichaCaracter['daSonido'] } | null>(null);
  const [contienen, fijarContienen] = useState<{ filas: CaracterBreve[]; total: number } | null>(null);
  const [limiteContienen, fijarLimiteContienen] = useState(18);
  const [comunes, fijarComunes] = useState<{ filas: EntradaBreve[]; total: number } | null>(null);
  const [limite, fijarLimite] = useState(24);
  const [tuyas, fijarTuyas] = useState<EntradaBreve[] | null>(null);
  const [opuestos, fijarOpuestos] = useState<EntradaBreve[]>([]);
  const [especiales, fijarEspeciales] = useState<EntradaBreve[]>([]);
  const [origen, fijarOrigen] = useState(false);
  const [recarga, fijarRecarga] = useState(0);
  // Cada carácter se abre enseñando cómo se escribe: practicar es algo que se pide.
  const [vista, fijarVista] = useState<VistaTrazos>('orden');
  const [modo, fijarModo] = useState<ModoEscritura>(() => leerPreferencia<ModoEscritura>('modoEscritura', 'calcar'));
  // Lo que la página carga al abrirse: en el diccionario, se enseña cuando lo tiene todo (ui/preparacion.tsx).
  const esperar = useEsperar();

  // Al terminar de instalar el diccionario, la página se completa sola.
  useEffect(() => alRecibirEvento((e) => e.tipo === 'diccionarios' && fijarRecarga((n) => n + 1)), []);

  useEffect(() => {
    let vivo = true;
    if (listas) esperar(motor.caracteresConNivel(listas.carpeta, [caracter])).then(([k]) => vivo && fijarInfo(k ?? null)).catch(() => {});
    esperar(motor.trazos(caracter)).then((x) => vivo && fijarTrazos(x)).catch(() => vivo && fijarTrazos(null));
    esperar(motor.palabrasConCaracteres([caracter], caracter, 24))
      .then(async (l) => {
        const ps = l[caracter] ?? [];
        const xs = ps.length ? await esperar(motor.entradasDe(ps.map((p) => ({ termino: p.lema, lectura: p.lectura })))) : [];
        if (vivo) fijarTuyas(xs);
      })
      .catch(() => vivo && fijarTuyas([]));
    if (pc.lecturasEspeciales) esperar(motor.categoriaConCaracter(pc.lecturasEspeciales.categoria, caracter, 24)).then((x) => vivo && fijarEspeciales(x)).catch(() => {});
    esperar(
      motor.buscar(caracter).then((r) => {
        const refs = referenciasDe(r).filter((x) => x.tipo === 'opuesto');
        return refs.length ? motor.entradasDe(refs) : [];
      })
    )
      .then((x) => vivo && fijarOpuestos(x))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [caracter]);

  useEffect(() => {
    let vivo = true;
    fijarBreves(new Map());
    fijarFamilia(null);
    if (!d) {
      fijarFicha(null);
      return;
    }
    esperar(motor.estado()).then((e) => vivo && fijarHayDic(e.diccionarios.some((x) => x.tipo === 'caracteres'))).catch(() => {});
    esperar(motor.fichaCaracter(caracter))
      .then((f) => {
        if (!vivo) return;
        fijarFicha(f);
        if (!f) return;
        const emparentados = [f.radical?.caracter, ...f.opuestos, ...f.sinonimos, ...f.parecidos, ...f.homonimos.flatMap((h) => h.caracteres)];
        const unicos = [...new Set(emparentados.filter((x): x is string => !!x && x !== caracter))];
        esperar(motor.caracteresBreves(unicos)).then((xs) => vivo && fijarBreves(new Map(xs.map((x) => [x.caracter, x])))).catch(() => {});
        // Si él da el sonido a otros, su familia es la suya; si lo recibe de otra pieza, la de esa pieza.
        const cabeza = f.fonetico && f.fonetico !== caracter ? f.fonetico : f.daSonido ? caracter : null;
        if (cabeza) {
          esperar(Promise.all([motor.familiaFonetica(cabeza, 48), cabeza === caracter ? Promise.resolve(f) : motor.fichaCaracter(cabeza)]))
            .then(([fam, fc]) => {
              if (!vivo) return;
              const filas = fam.filas.filter((x) => x.caracter !== caracter);
              fijarFamilia({ cabeza, filas, total: fam.total - (fam.filas.length - filas.length), sonido: fc?.daSonido });
            })
            .catch(() => {});
        }
      })
      .catch(() => vivo && fijarFicha(null));
    return () => {
      vivo = false;
    };
  }, [caracter, recarga]);

  useEffect(() => {
    let vivo = true;
    if (!ficha) {
      fijarContienen(null);
      return;
    }
    // Los de su familia por el sonido ya salen en su lista: aquí van los demás.
    const deFamilia = familia?.cabeza === caracter ? familia.filas.map((x) => x.caracter) : [];
    esperar(motor.caracteresConPieza([caracter, ...ficha.formasComoPieza], [caracter, ...deFamilia], limiteContienen))
      .then((x) => vivo && fijarContienen(x))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [ficha, familia, limiteContienen]);

  useEffect(() => {
    let vivo = true;
    esperar(motor.palabrasConCaracter(caracter, limite)).then((x) => vivo && fijarComunes(x)).catch(() => vivo && fijarComunes({ filas: [], total: 0 }));
    return () => {
      vivo = false;
    };
  }, [caracter, limite]);

  const cambiarModo = (m: ModoEscritura) => {
    fijarModo(m);
    guardarPreferencia('modoEscritura', m);
  };

  const partir = (s: string | undefined) => (s ? s.split(/[、,]\s*/).map((x) => x.trim()).filter(Boolean) : []);
  // Sin el diccionario, las lecturas de las listas, todas como oficiales.
  const deLista = (s: string | undefined): LecturasCaracter => ({ oficiales: partir(s).map((texto) => ({ texto })), otras: [] });
  const on = ficha ? ficha.on : deLista(info?.on);
  const kun = ficha ? ficha.kun : deLista(info?.kun);
  const sinLista = !!ficha && !ficha.on.oficiales.length && !ficha.kun.oficiales.length;
  const nTrazos = ficha?.trazos ?? trazos?.trazos.length;
  const nivel = info?.nivel ?? ficha?.nivel;
  const lista = ficha?.lista ? d?.lista(ficha.lista) : undefined;
  const significado = ficha ? significadoDe(ficha.significados) : { textos: info?.glosa ? [info.glosa] : [], lang: info?.glosa ? 'en' : undefined };
  const enTuIdioma = ficha?.enOtrasLenguas[idiomaActual()];
  const formacion = ficha?.formacion ? d?.formaciones[ficha.formacion] : undefined;
  const fonetico = ficha?.fonetico && ficha.fonetico !== caracter ? ficha.fonetico : trazos?.fonetico;
  const radical = ficha?.radical;
  // Lo que significa el radical: en el idioma de la interfaz si el diccionario lo trae; si no, el nombre corto de la
  // lista de radicales, mejor que la glosa del radical como carácter («box or enclosure radical (no. 31)»).
  const idioma = idiomaActual();
  const delRadicalComoCaracter = radical ? (radical.caracter === caracter ? ficha?.significados : breves.get(radical.caracter)?.significados) : undefined;
  const significadoRadical = radical ? (idioma !== 'en' && delRadicalComoCaracter?.[idioma]?.[0]) || radical.significado : undefined;
  const breve = (cs: string[]) => cs.map((c) => breves.get(c)).filter((x): x is CaracterBreve => !!x);
  // Las palabras que ya conoces no se repiten en la lista de las comunes.
  const conocidas = new Set((tuyas ?? []).map((x) => `${x.termino}|${x.lectura}`));
  const comunesSinTuyas = comunes?.filas.filter((x) => !conocidas.has(`${x.termino}|${x.lectura}`)) ?? null;
  const id = paquete.id;

  return (
    <div class="dic-caracter">
      <header class="dic-caracter-cab">
        <div class="dic-caracter-trazos">
          <div class="segmentado dic-trazos-vista" role="radiogroup" aria-label={tr('Escritura')}>
            <button role="radio" aria-checked={vista === 'orden'} class={vista === 'orden' ? 'activo' : ''} onClick={() => fijarVista('orden')}>
              <Icono n="trazos" t={14} /> {tr('Trazos')}
            </button>
            <button role="radio" aria-checked={vista === 'practica'} class={vista === 'practica' ? 'activo' : ''} disabled={trazos === null} onClick={() => fijarVista('practica')}>
              <Icono n="lapiz" t={14} /> {tr('Practicar')}
            </button>
          </div>
          {vista === 'practica' && trazos ? (
            <PracticaEscritura key={caracter} caracter={caracter} datos={trazos} modo={modo} alCambiarModo={cambiarModo} />
          ) : vista === 'practica' && trazos === undefined ? (
            <span class="esqueleto escritura-esqueleto" />
          ) : (
            <PanelTrazos palabra={caracter} solo />
          )}
        </div>
        <div class="dic-caracter-datos">
          <div class="dic-caracter-titulo">
            <span class="dic-caracter-glifo" lang={id}>{caracter}</span>
            <span class="dic-caracter-tipo">{tr(pc.nombre)}</span>
            {nivel && <span class="chip-nivel">{listas?.examen} {nivel}</span>}
            {lista && <span class="dic-dato dic-dato-lista" data-tip={tr(lista.ayuda)}>{tr(lista.nombre, lista.dato)}</span>}
            {nTrazos ? <span class="dic-dato num">{nTrazos === 1 ? tr('1 trazo') : tr('{0} trazos', nTrazos)}</span> : null}
            {ficha?.frecuencia && <span class="dic-dato num" data-tip={tr('Su puesto entre los más usados en textos')}>{tr('N.º {0} en uso', numero(ficha.frecuencia))}</span>}
            {ficha?.kanken && d && <span class="dic-dato" data-tip={tr(d.examen.ayuda)}>{tr(d.examen.nombre)} <span lang={id}>{d.examen.nivel(ficha.kanken)}</span></span>}
          </div>
          <p class="dic-caracter-significado" lang={significado.lang}>{significado.textos.length ? significado.textos.slice(0, 6).join(', ') : info ? tr('Fuera de las listas') : ''}</p>
          {!!ficha?.variantes.nuevas.length && (
            <p class="dic-caracter-aviso">
              <Icono n="historial" t={15} />
              <span>
                {tr('Es una forma antigua. Hoy se escribe')}{' '}
                {ficha.variantes.nuevas.map((c) => <button key={c} class="dic-caracter-aviso-forma" lang={id} onClick={() => buscarPalabra(c)}>{c}</button>)}
              </span>
            </p>
          )}
          {enTuIdioma && <p class="dic-caracter-otra-lengua">{tr('En tu idioma se lee {0}', enTuIdioma)}</p>}
          {(on.oficiales.length > 0 || on.otras.length > 0 || kun.oficiales.length > 0 || kun.otras.length > 0 || (ficha?.nombres.length ?? 0) > 0) && (
            <dl class="dic-lecturas">
              <FilaLecturas rotulo={pc.lecturas.on} l={on} sinLista={sinLista} d={d} />
              <FilaLecturas rotulo={pc.lecturas.kun} l={kun} sinLista={sinLista} d={d} />
              {ficha && d && <FilaNombres rotulo={d.nombres} nombres={ficha.nombres} />}
              {radical && d && (
                <div class="dic-lecturas-fila">
                  <dt data-tip={tr(d.radical.ayuda)}>{tr(d.radical.nombre)}</dt>
                  <dd>
                    <button class="dic-radical" onClick={() => buscarPalabra(radical.caracter)}>
                      <b lang={id}>{radical.forma ?? radical.caracter}</b>
                      <span>
                        <span lang={id}>{radical.nombres.join(' · ')}</span>
                        <small>
                          {[significadoRadical, radical.forma ? tr('forma de {0}', radical.caracter) : '', tr('n.º {0}', radical.numero)].filter(Boolean).join(' · ')}
                        </small>
                      </span>
                    </button>
                  </dd>
                </div>
              )}
              {formacion && (
                <div class="dic-lecturas-fila">
                  <dt>{tr('Cómo se formó')}</dt>
                  <dd><span class="dic-formacion" data-tip={tr(formacion.ayuda)}>{tr(formacion.nombre)}</span></dd>
                </div>
              )}
            </dl>
          )}
          {(!!trazos?.componentes?.length || fonetico) && <Piezas piezas={trazos?.componentes ?? []} fonetico={fonetico} />}
          {d && ficha === null && !hayDic && <InvitarAInstalar texto={d.instalar} />}
        </div>
      </header>

      <div class="dic-caracter-cuerpo">
        <div class="dic-caracter-principal">
          <SeccionTarjetas titulo={tr('Tus palabras con {0}', caracter)} ayuda={tr('Las que ya conoces o estás aprendiendo: con ellas se recuerda mejor.')} xs={tuyas} />
          <SeccionTarjetas
            titulo={tr('Palabras con {0}', caracter)}
            xs={comunesSinTuyas}
            total={comunes ? comunes.total - (comunes.filas.length - (comunesSinTuyas?.length ?? 0)) : undefined}
            alVerMas={() => fijarLimite((n) => n + 48)}
            cargando={comunes === null}
          />
          {pc.lecturasEspeciales && <SeccionTarjetas titulo={tr(pc.lecturasEspeciales.titulo, caracter)} ayuda={tr(pc.lecturasEspeciales.ayuda)} xs={especiales} />}
          {familia && (
            <SeccionCaracteres
              titulo={familia.cabeza === caracter ? tr('Da su sonido a') : tr('Familia por el sonido')}
              ayuda={ayudaFamilia(familia.cabeza, familia.cabeza === caracter, familia.sonido)}
              xs={familia.filas}
            />
          )}
          {d && (
            <SeccionCaracteres
              titulo={tr(familia?.cabeza === caracter && familia.filas.length ? d.titulos.contienenOtros : d.titulos.contienen)}
              xs={contienen?.filas}
              total={contienen?.total}
              alVerMas={() => fijarLimiteContienen((n) => n + 36)}
            />
          )}
          <FrasesVistas
            clave={caracter}
            titulo={tr('Donde lo has visto')}
            cargar={() => motor.frasesConCaracter(caracter)}
            resaltar={(t) => t.superficie.includes(caracter)}
            ajustes={ajustes}
            vacio={tr('Aún no lo has visto en ninguna frase. Irán apareciendo aquí conforme lo encuentres.')}
          />
        </div>
        <aside class="dic-caracter-lado">
          {ficha && d && (
            <>
              <SeccionCaracteres titulo={tr(d.titulos.parecidos)} ayuda={tr('Fíjate en lo que los distingue: se confunden al leer.')} xs={breve(ficha.parecidos)} />
              <SeccionCaracteres titulo={tr(d.titulos.opuestos)} xs={breve(ficha.opuestos)} />
            </>
          )}
          <SeccionTarjetas titulo={tr('Opuestos')} xs={opuestos} />
          {ficha && d && (
            <>
              <SeccionCaracteres titulo={tr(d.titulos.sinonimos)} xs={breve(ficha.sinonimos)} />
              {ficha.homonimos.length > 0 && (
                <section class="dic-seccion" aria-label={tr(d.titulos.homonimos)}>
                  <h3 class="dic-seccion-titulo">{tr(d.titulos.homonimos)}</h3>
                  {ficha.homonimos.map((h) => (
                    <div key={h.lectura} class="dic-homonimo">
                      <div class="dic-homonimo-cab">
                        <span class="dic-lectura" lang={id}>{h.lectura}</span>
                        <small data-tip={h.mismoAcento ? tr('Suenan igual: solo se distinguen por cómo se escriben.') : tr('Se distinguen al oído por el acento.')}>
                          {h.mismoAcento ? tr('Mismo acento') : tr('Otro acento')}
                        </small>
                      </div>
                      <div class="dic-kanjis">{breve(h.caracteres).map((c) => <TarjetaCaracter key={c.caracter} c={c} />)}</div>
                    </div>
                  ))}
                </section>
              )}
              <FormasAntiguas ficha={ficha} d={d} />
            </>
          )}
          <FormasCaracter caracter={caracter} />
          <section class="dic-seccion" aria-label={tr('Origen y cómo recordarlo')}>
            <h3 class="dic-seccion-titulo">{tr('Origen y cómo recordarlo')}</h3>
            {origen ? (
              <PanelFlujo metodo="preguntar" args={[{ lema: caracter, lectura: '' }, tr(pc.preguntaOrigen, caracter)]} titulo={tr('Origen y cómo recordarlo')} />
            ) : (
              <button class="btn chico ia" onClick={() => fijarOrigen(true)}><Icono n="ia" t={14} /> {tr('Pregúntale a Claude')}</button>
            )}
          </section>
          <section class="dic-seccion" aria-label={tr('Consultar en')}>
            <h3 class="dic-seccion-titulo">{tr('Consultar en')}</h3>
            <div class="enlaces">
              {pc.enlaces.map((e) => (
                <a key={e.nombre} class="chip" href={e.url(caracter)} target="_blank" rel="noreferrer noopener">{tr(e.nombre)} <Icono n="externo" t={12} /></a>
              ))}
            </div>
          </section>
          {paquete.trazos && (
            <p class="trazos-credito">
              <a href={paquete.trazos.credito.url} target="_blank" rel="noreferrer noopener">{paquete.trazos.credito.nombre}</a>
              {` · ${paquete.trazos.credito.licencia}`}
              {ficha && d && (
                <>
                  <br />
                  <a href={d.credito.url} target="_blank" rel="noreferrer noopener">{d.credito.nombre}</a>
                  {` · ${d.credito.licencia}`}
                </>
              )}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
