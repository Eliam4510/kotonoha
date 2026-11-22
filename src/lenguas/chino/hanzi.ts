// Los hanzi: sus trazos y su diccionario, de Make Me a Hanzi (Shaunak Kishore). Los trazos, en la versión de Hanzi Writer
// (hanzi-writer-data), salen de dos letras de Arphic y van con su licencia (Arphic Public License); el diccionario sale de
// Unihan y CJKlib y va con la LGPL-3.0. Ninguno va en el paquete de la extensión: se bajan al usarlos, de versiones fijadas.

import type { FichaCaracter } from '../../compartido/tipos';
import type { DatosTrazos, PiezaCaracter } from '../../nucleo/trazos';
import type { ArchivoDiccionario } from '../tipos';
import { sinTonos } from './pinyin';

// ---------- Trazos ----------

const VERSION_TRAZOS = '2.0.1';
export const urlTrazos = (c: string) => `https://cdn.jsdelivr.net/npm/hanzi-writer-data@${VERSION_TRAZOS}/${encodeURIComponent(c)}.json`;
export const urlTrazosAlternativa = (c: string) => `https://unpkg.com/hanzi-writer-data@${VERSION_TRAZOS}/${encodeURIComponent(c)}.json`;

interface Punto {
  x: number;
  y: number;
}

/** Make Me a Hanzi dibuja en un lienzo de 1024, con la y hacia arriba y la base en 900; KanjiVG, en uno de 109 hacia abajo. */
const ESCALA = 109 / 1024;
const aLienzo = ([x, y]: number[]): Punto => ({ x: x * ESCALA, y: (900 - y) * ESCALA });
const redondo = (v: number) => Math.round(v * 10) / 10;
const par = (p: Punto) => `${redondo(p.x)},${redondo(p.y)}`;

/** Una línea suave que pasa por todos los puntos de la línea central del trazo (Catmull-Rom), como un trazo de KanjiVG. */
function trazado(ps: Punto[]): string {
  let d = `M${par(ps[0])}`;
  for (let i = 0; i + 1 < ps.length; i++) {
    const p0 = ps[i - 1] ?? ps[i];
    const p1 = ps[i];
    const p2 = ps[i + 1];
    const p3 = ps[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${par(c1)} ${par(c2)} ${par(p2)}`;
  }
  return d;
}

/** Dónde va el número de un trazo: un poco antes de donde empieza, para no taparlo. */
function sitioDelNumero(ps: Punto[]): Punto {
  const [a, b = a] = ps;
  const largo = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const x = a.x - ((b.x - a.x) / largo) * 5;
  const y = a.y - ((b.y - a.y) / largo) * 5;
  return { x: redondo(Math.min(104, Math.max(4, x))), y: redondo(Math.min(106, Math.max(8, y))) };
}

/**
 * Los trazos de un archivo de Hanzi Writer, como los de KanjiVG: la línea central de cada uno (sus «medians»), en el
 * orden en que se escriben y en el lienzo de 109. Así los dibuja, los anima y los corrige lo mismo que en japonés.
 */
export function leerTrazosHanzi(archivo: string): DatosTrazos | null {
  let d: { medians?: unknown };
  try {
    d = JSON.parse(archivo);
  } catch {
    return null;
  }
  if (!Array.isArray(d.medians)) return null;
  const lineas = d.medians
    .map((m) => (Array.isArray(m) ? m.filter((p): p is number[] => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)).map(aLienzo) : []))
    .filter((ps) => ps.length);
  if (!lineas.length) return null;
  // Las piezas las trae el diccionario de hanzi, no los trazos: la lista vacía dice que no hay que volver a pedirlos.
  return { trazos: lineas.map((ps) => (ps.length === 1 ? `M${par(ps[0])} L${par(ps[0])}` : trazado(ps))), numeros: lineas.map(sitioDelNumero), componentes: [] };
}

// ---------- Radicales ----------

/** Los 214 radicales de Kangxi, en su orden: su número es su puesto. Y lo que significa cada uno, en inglés (Unicode). */
const KANGXI = [...'一丨丶丿乙亅二亠人儿入八冂冖冫几凵刀力勹匕匚匸十卜卩厂厶又口囗土士夂夊夕大女子宀寸小尢尸屮山巛工己巾干幺广廴廾弋弓彐彡彳心戈戶手支攴文斗斤方无日曰月木欠止歹殳毋比毛氏气水火爪父爻爿片牙牛犬玄玉瓜瓦甘生用田疋疒癶白皮皿目矛矢石示禸禾穴立竹米糸缶网羊羽老而耒耳聿肉臣自至臼舌舛舟艮色艸虍虫血行衣襾見角言谷豆豕豸貝赤走足身車辛辰辵邑酉釆里金長門阜隶隹雨靑非面革韋韭音頁風飛食首香馬骨高髟鬥鬯鬲鬼魚鳥鹵鹿麥麻黃黍黑黹黽鼎鼓鼠鼻齊齒龍龜龠'];
const SIGNIFICADO_KANGXI =
  'one|line|dot|slash|second|hook|two|lid|man|legs|enter|eight|down box|cover|ice|table|open box|knife|power|wrap|spoon|right open box|hiding enclosure|ten|divination|seal|cliff|private|again|mouth|enclosure|earth|scholar|go|go slowly|evening|big|woman|child|roof|inch|small|lame|corpse|sprout|mountain|river|work|oneself|turban|dry|short thread|dotted cliff|long stride|two hands|shoot|bow|snout|bristle|step|heart|halberd|door|hand|branch|rap|script|dipper|axe|square|not|sun|say|moon|tree|lack|stop|death|weapon|do not|compare|fur|clan|steam|water|fire|claw|father|double x|half tree trunk|slice|fang|cow|dog|profound|jade|melon|tile|sweet|life|use|field|bolt of cloth|sickness|dotted tent|white|skin|dish|eye|spear|arrow|stone|spirit|track|grain|cave|stand|bamboo|rice|silk|jar|net|sheep|feather|old|and|plow|ear|brush|meat|minister|self|arrive|mortar|tongue|oppose|boat|stopping|color|grass|tiger|insect|blood|walk enclosure|clothes|west|see|horn|speech|valley|bean|pig|badger|shell|red|run|foot|body|cart|bitter|morning|walk|city|wine|distinguish|village|gold|long|gate|mound|slave|short tailed bird|rain|blue|wrong|face|leather|tanned leather|leek|sound|leaf|wind|fly|eat|head|fragrant|horse|bone|tall|hair|fight|sacrificial wine|cauldron|ghost|fish|bird|salt|deer|wheat|hemp|yellow|millet|black|embroidery|frog|tripod|drum|rat|nose|even|tooth|dragon|turtle|flute'.split(
    '|'
  );
const NUMERO_KANGXI = new Map(KANGXI.map((c, i) => [c, i + 1]));

/**
 * Las formas que toma un radical como pieza, y las simplificadas: 氵 es 水, 讠 es 言, 门 es 門. El 阝 es 阜 a la izquierda y
 * 邑 a la derecha: se decide por dónde va.
 */
const FORMA_DE: Record<string, string> = {
  氵: '水', 氺: '水', 亻: '人', 扌: '手', 忄: '心', 㣺: '心', 讠: '言', 訁: '言', 钅: '金', 釒: '金', 饣: '食', 飠: '食', 纟: '糸',
  糹: '糸', 艹: '艸', '⺾': '艸', 辶: '辵', '⻌': '辵', 犭: '犬', 礻: '示', 衤: '衣', 刂: '刀', 灬: '火', 罒: '网', 攵: '攴', 王: '玉',
  '⺼': '肉', '⺮': '竹', '⻊': '足', 门: '門', 马: '馬', 鸟: '鳥', 鱼: '魚', 车: '車', 贝: '貝', 见: '見', 页: '頁', 风: '風',
  齿: '齒', 龙: '龍', 麦: '麥', 韦: '韋', 长: '長', 飞: '飛', 黾: '黽', 龟: '龜', 卤: '鹵', 齐: '齊', 黄: '黃', 青: '靑', 爫: '爪',
  牜: '牛', 耂: '老', 覀: '襾', 乚: '乙', 㔾: '卩', 彑: '彐',
};

/** Cómo se llama cada pieza en clase, en chino (偏旁): con el nombre se dice cómo se escribe un carácter. */
const NOMBRE_PIEZA: Record<string, string> = {
  氵: '三点水', 冫: '两点水', 亻: '单人旁', 彳: '双人旁', 扌: '提手旁', 忄: '竖心旁', 讠: '言字旁', 钅: '金字旁', 饣: '食字旁',
  纟: '绞丝旁', 艹: '草字头', 辶: '走之底', 犭: '反犬旁', 礻: '示字旁', 衤: '衣字旁', 刂: '立刀旁', 宀: '宝盖头', 冖: '秃宝盖',
  灬: '四点底', 罒: '四字头', 攵: '反文旁', 疒: '病字旁', 广: '广字旁', 厂: '厂字旁', 尸: '尸字头', 门: '门字框', 囗: '国字框',
  冂: '同字框', 勹: '包字头', 廴: '建之旁', '⺮': '竹字头', 雨: '雨字头', 口: '口字旁', 日: '日字旁', 月: '月字旁', '⺼': '肉月旁',
  木: '木字旁', 火: '火字旁', 土: '提土旁', 王: '王字旁', 女: '女字旁', 石: '石字旁', 目: '目字旁', 禾: '禾木旁', 米: '米字旁',
  '⻊': '足字旁', 车: '车字旁', 贝: '贝字旁', 马: '马字旁', 虫: '虫字旁', 心: '心字底', 山: '山字旁', 弓: '弓字旁', 巾: '巾字旁',
  页: '页字旁', 鸟: '鸟字旁', 鱼: '鱼字旁', 酉: '酉字旁', 耳: '耳字旁', 舟: '舟字旁', 皿: '皿字底', 力: '力字旁', 子: '子字旁',
  寸: '寸字旁', 欠: '欠字旁', 隹: '隹字旁', 革: '革字旁', 爫: '爪字头', 耂: '老字头', 覀: '西字头', 虍: '虎字头', 癶: '登字头',
  穴: '穴宝盖', 立: '立字旁', 田: '田字旁', 白: '白字旁', 矢: '矢字旁', 牜: '牛字旁', 方: '方字旁', 歹: '歹字旁', 角: '角字旁',
  身: '身字旁', 齿: '齿字旁', 夂: '折文', 又: '又字旁', 衣: '衣字底',
};

/** Las formas que toma cada radical como pieza, para encontrar los caracteres que lo llevan: 水 está en 江 como 氵. */
const FORMAS_COMO_PIEZA = new Map<string, string[]>();
for (const [forma, base] of Object.entries(FORMA_DE)) FORMAS_COMO_PIEZA.set(base, [...(FORMAS_COMO_PIEZA.get(base) ?? []), forma]);

// ---------- El diccionario ----------

const MMAH = 'https://raw.githubusercontent.com/skishore/makemeahanzi/bddc96d41bef78427ed0e034e9f7e31d71fd1b92/dictionary.txt';

/** Lo que se baja: el diccionario de Make Me a Hanzi, una línea JSON por carácter (unos 2,5 MB). */
export const ARCHIVOS_HANZI: ArchivoDiccionario[] = [{ nombre: 'makemeahanzi', url: MMAH }];

/**
 * Lo que se lee al instalarlo: lo que se baja y, del paquete de la extensión, los hanzi de las listas del HSK, con su
 * nivel y sus lecturas de CC-CEDICT por orden de uso. Make Me a Hanzi trae a menudo una sola, y no siempre la más
 * usada: 地 solo como de, 长 solo como zhǎng, 吧 como bā.
 */
export function archivosHanzi(): ArchivoDiccionario[] {
  const enPaquete = typeof chrome !== 'undefined' && chrome.runtime?.getURL ? [{ nombre: 'hsk', url: chrome.runtime.getURL('datos/hsk/kanji.json') }] : [];
  return [...ARCHIVOS_HANZI, ...enPaquete];
}

/** Los hanzi de las listas del HSK: el nivel de cada uno y sus lecturas, la más usada primero. */
function leerListasHsk(texto: string | undefined): Map<string, { nivel: string; lecturas: string[] }> {
  const salida = new Map<string, { nivel: string; lecturas: string[] }>();
  if (!texto) return salida;
  try {
    const datos = JSON.parse(texto) as { niveles?: Record<string, unknown> };
    for (const [nivel, filas] of Object.entries(datos.niveles ?? {})) {
      if (!Array.isArray(filas)) continue;
      for (const f of filas) {
        if (!Array.isArray(f) || typeof f[0] !== 'string' || salida.has(f[0])) continue;
        salida.set(f[0], { nivel, lecturas: typeof f[1] === 'string' ? f[1].split('、').map((l) => l.trim()).filter(Boolean) : [] });
      }
    }
  } catch {
    // Sin las listas, valen las lecturas de Make Me a Hanzi.
  }
  return salida;
}

interface FilaHanzi {
  character: string;
  definition?: string;
  pinyin?: string[];
  decomposition?: string;
  etymology?: { type?: string; hint?: string; phonetic?: string | null; semantic?: string | null } | null;
  radical?: string;
  matches?: unknown[];
}

const FORMACIONES: Record<string, string> = { pictographic: 'pictograma', ideographic: 'compuesto', pictophonetic: 'fonosemantico' };

const ES_HAN = /^[\p{Script=Han}⺀-⻳]$/u;
const valido = (c: string | null | undefined): c is string => !!c && [...c].length === 1 && ES_HAN.test(c);

/** Los operadores de las secuencias de descripción ideográfica (⿰ izquierda y derecha, ⿱ arriba y abajo…) y cuántas piezas juntan. */
const OPERADORES: Record<string, number> = { '⿰': 2, '⿱': 2, '⿲': 3, '⿳': 3, '⿴': 2, '⿵': 2, '⿶': 2, '⿷': 2, '⿸': 2, '⿹': 2, '⿺': 2, '⿻': 2 };

interface NodoIds {
  c?: string;
  op?: string;
  hijos: NodoIds[];
}

/** Una secuencia de descripción ideográfica como árbol: ⿰氵工 es una pieza a la izquierda y otra a la derecha. */
export function leerIds(ids: string | undefined): NodoIds | null {
  if (!ids) return null;
  const cs = [...ids];
  let i = 0;
  const nodo = (): NodoIds | null => {
    const c = cs[i++];
    if (c === undefined) return null;
    const n = OPERADORES[c];
    if (!n) return { c, hijos: [] };
    const hijos: NodoIds[] = [];
    for (let k = 0; k < n; k++) {
      const h = nodo();
      if (!h) return null;
      hijos.push(h);
    }
    return { op: c, hijos };
  };
  return nodo();
}

/** Las piezas que se ven a primera vista: las del primer nivel, atravesando los grupos sin nombre (la mitad derecha de 树). */
function primeras(n: NodoIds, propio: string): string[] {
  if (n.c !== undefined) return valido(n.c) && n.c !== propio ? [n.c] : [];
  return [...new Set(n.hijos.flatMap((h) => primeras(h, propio)))];
}

export function leerDiccionarioHanzi(textos: Record<string, string>): FichaCaracter[] {
  const filas = new Map<string, FilaHanzi>();
  for (const linea of (textos.makemeahanzi ?? '').split(/\r?\n/)) {
    if (!linea.trim()) continue;
    try {
      const f = JSON.parse(linea) as FilaHanzi;
      if (valido(f.character)) filas.set(f.character, f);
    } catch {
      // Una línea rota no estropea las demás.
    }
  }
  // Las lecturas: las de las listas del HSK primero, por orden de uso; después, las demás de Make Me a Hanzi.
  const hsk = leerListasHsk(textos.hsk);
  const lecturas = (c: string) => {
    const deLista = hsk.get(c)?.lecturas ?? [];
    const propias = (filas.get(c)?.pinyin ?? []).map((p) => p.normalize('NFC').trim()).filter(Boolean);
    return [...deLista, ...propias.filter((p) => !deLista.includes(p))];
  };

  // Lo que se oye igual: por lectura con su tono, y por la sílaba sin él.
  const porLectura = new Map<string, string[]>();
  const porSilaba = new Map<string, string[]>();
  for (const c of filas.keys()) {
    for (const l of lecturas(c)) {
      porLectura.set(l, [...(porLectura.get(l) ?? []), c]);
      const s = sinTonos(l);
      if (!porSilaba.get(s)?.includes(c)) porSilaba.set(s, [...(porSilaba.get(s) ?? []), c]);
    }
  }
  // Los que dan su sonido a otros.
  const conFonetico = new Map<string, string[]>();
  for (const f of filas.values()) {
    const ph = f.etymology?.type === 'pictophonetic' ? f.etymology.phonetic : null;
    if (valido(ph) && ph !== f.character) conFonetico.set(ph, [...(conFonetico.get(ph) ?? []), f.character]);
  }

  const arbol = new Map<string, NodoIds | null>();
  const arbolDe = (c: string) => {
    if (!arbol.has(c)) arbol.set(c, leerIds(filas.get(c)?.decomposition));
    return arbol.get(c) ?? null;
  };
  /** Las piezas que se ven, con las suyas dentro, hasta tres niveles. */
  const piezasDe = (c: string, profundidad: number, radical?: string): PiezaCaracter[] => {
    const a = arbolDe(c);
    if (!a || a.c !== undefined) return [];
    return primeras(a, c).map((p) => ({
      caracter: p,
      ...(FORMA_DE[p] ? { original: FORMA_DE[p] } : {}),
      ...(radical && p === radical ? { radical: true } : {}),
      piezas: profundidad < 2 ? piezasDe(p, profundidad + 1) : [],
    }));
  };
  /** Todas las piezas que lleva dentro, a cualquier profundidad: así se encuentra en lo que la lleva. */
  const todas = (c: string): string[] => {
    const salida = new Set<string>();
    const pendientes = [c];
    while (pendientes.length && salida.size < 40) {
      const x = pendientes.pop()!;
      const a = arbolDe(x);
      if (!a || a.c !== undefined) continue;
      for (const p of primeras(a, x)) {
        if (p === c || salida.has(p)) continue;
        salida.add(p);
        pendientes.push(p);
      }
    }
    return [...salida];
  };

  const fichas: FichaCaracter[] = [];
  for (const f of filas.values()) {
    const c = f.character;
    const propias = lecturas(c);
    const ety = f.etymology ?? undefined;
    const a = arbolDe(c);
    // El radical, por su número de Kangxi: 阝 a la izquierda es 阜; a la derecha, 邑.
    const formaRadical = valido(f.radical) ? f.radical : undefined;
    let base = formaRadical ? (FORMA_DE[formaRadical] ?? formaRadical) : undefined;
    if (formaRadical === '阝') base = a?.op === '⿰' && a.hijos[1]?.c === '阝' ? '邑' : '阜';
    const numero = base ? NUMERO_KANGXI.get(base) : undefined;
    const nombrePieza = formaRadical ? (NOMBRE_PIEZA[formaRadical] ?? (formaRadical === '阝' ? (base === '邑' ? '右耳旁' : '左耳旁') : undefined)) : undefined;
    const tradicional = /Simplified form of (\p{Script=Han})/u.exec(ety?.hint ?? '')?.[1];
    const familia = conFonetico.get(c);
    const silabasPropias = new Set(propias.map(sinTonos));
    const comparten = familia?.filter((x) => lecturas(x).some((l) => silabasPropias.has(sinTonos(l)))).length ?? 0;
    const homonimos: FichaCaracter['homonimos'] = [];
    for (const l of propias) {
      const iguales = (porLectura.get(l) ?? []).filter((x) => x !== c).slice(0, 12);
      if (iguales.length) homonimos.push({ lectura: l, caracteres: iguales, mismoAcento: true });
      const otrosTonos = (porSilaba.get(sinTonos(l)) ?? []).filter((x) => x !== c && !lecturas(x).includes(l)).slice(0, 8);
      if (otrosTonos.length && !homonimos.some((h) => h.lectura === sinTonos(l))) homonimos.push({ lectura: sinTonos(l), caracteres: otrosTonos, mismoAcento: false });
    }
    fichas.push({
      caracter: c,
      significados: f.definition ? { en: f.definition.split(/\s*;\s*/).filter(Boolean) } : {},
      on: { oficiales: propias.map((texto) => ({ texto })), otras: [] },
      kun: { oficiales: [], otras: [] },
      nombres: [],
      ...(hsk.has(c) ? { nivel: hsk.get(c)!.nivel } : {}),
      ...(Array.isArray(f.matches) && f.matches.length ? { trazos: f.matches.length } : {}),
      ...(ety?.type && FORMACIONES[ety.type] ? { formacion: FORMACIONES[ety.type] } : {}),
      ...(base && numero
        ? {
            radical: {
              caracter: base,
              ...(formaRadical && formaRadical !== base ? { forma: formaRadical } : {}),
              numero,
              nombres: nombrePieza ? [nombrePieza] : [],
              significado: SIGNIFICADO_KANGXI[numero - 1] ?? '',
            },
          }
        : {}),
      ...(ety?.type === 'pictophonetic' && valido(ety.phonetic) && ety.phonetic !== c ? { fonetico: ety.phonetic } : {}),
      ...(familia && familia.length >= 2
        ? { daSonido: { lecturas: [...silabasPropias], tipo: comparten === familia.length ? ('siempre' as const) : comparten >= familia.length * 0.6 ? ('casi' as const) : ('varias' as const) } }
        : {}),
      variantes: { antiguas: [], nuevas: [], otras: [], ...(tradicional && tradicional !== c ? { tradicional } : {}) },
      piezas: todas(c),
      formasComoPieza: FORMAS_COMO_PIEZA.get(c) ?? [],
      componentes: piezasDe(c, 0, formaRadical),
      opuestos: [],
      sinonimos: [],
      parecidos: [],
      homonimos,
      enOtrasLenguas: {},
      ...(ety?.hint ? { pista: ety.hint } : {}),
      ...(ety?.type === 'pictophonetic' && valido(ety.semantic) ? { semantico: ety.semantic } : {}),
    });
  }
  return fichas;
}
