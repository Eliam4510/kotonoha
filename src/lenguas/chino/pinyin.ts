// El pinyin: sus sílabas, sus tonos y cómo se escribe sobre cada carácter. Lógica pura: se puede probar sin navegador.
//
// Los diccionarios escriben la lectura de una palabra junta y con marcas de tono, y el neutro sin marca: 银行 es
// «yínháng», 意思 es «yìsi» y 有点儿 es «yǒudiǎnr». Sobre los caracteres va una sílaba en cada uno, así que hay que
// partirla: con la tabla de sílabas del mandarín y sabiendo cuántas tienen que salir.

/** Las sílabas del mandarín, sin tono. La «r» sola es la del 儿 que se pega a la sílaba anterior (点儿, diǎnr). */
const TABLA = `a ai an ang ao e ei en eng er o ou
ba bai ban bang bao bei ben beng bi bia bian biao bie bin bing bo bu
pa pai pan pang pao pei pen peng pi pian piao pie pin ping po pou pu
ma mai man mang mao me mei men meng mi mian miao mie min ming miu mo mou mu
fa fan fang fei fen feng fo fou fu
da dai dan dang dao de dei den deng di dia dian diao die ding diu dong dou du duan dui dun duo
ta tai tan tang tao te tei teng ti tian tiao tie ting tong tou tu tuan tui tun tuo
na nai nan nang nao ne nei nen neng ni nian niang niao nie nin ning niu nong nou nu nuan nun nuo nü nüe
la lai lan lang lao le lei leng li lia lian liang liao lie lin ling liu lo long lou lu luan lun luo lü lüe
ga gai gan gang gao ge gei gen geng gong gou gu gua guai guan guang gui gun guo
ka kai kan kang kao ke kei ken keng kong kou ku kua kuai kuan kuang kui kun kuo
ha hai han hang hao he hei hen heng hong hou hu hua huai huan huang hui hun huo
ji jia jian jiang jiao jie jin jing jiong jiu ju juan jue jun
qi qia qian qiang qiao qie qin qing qiong qiu qu quan que qun
xi xia xian xiang xiao xie xin xing xiong xiu xu xuan xue xun
zha zhai zhan zhang zhao zhe zhei zhen zheng zhi zhong zhou zhu zhua zhuai zhuan zhuang zhui zhun zhuo
cha chai chan chang chao che chen cheng chi chong chou chu chua chuai chuan chuang chui chun chuo
sha shai shan shang shao she shei shen sheng shi shou shu shua shuai shuan shuang shui shun shuo
ran rang rao re ren reng ri rong rou ru rua ruan rui run ruo
za zai zan zang zao ze zei zen zeng zi zong zou zu zuan zui zun zuo
ca cai can cang cao ce cen ceng ci cong cou cu cuan cui cun cuo
sa sai san sang sao se sen seng si song sou su suan sui sun suo
ya yan yang yao ye yi yin ying yo yong you yu yuan yue yun
wa wai wan wang wei wen weng wo wu
m n ng hm hng ê r`;

export const SILABAS: ReadonlySet<string> = new Set(TABLA.split(/\s+/));
const MAS_LARGA = 6;

/** Cada vocal con tono, sin él y con su número. La ü se queda como ü: lǜ (绿) no es lù (路). */
const TONOS: Record<string, [string, number]> = {};
for (const [base, conTono] of Object.entries({ a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', ü: 'ǖǘǚǜ', A: 'ĀÁǍÀ', E: 'ĒÉĚÈ', I: 'ĪÍǏÌ', O: 'ŌÓǑÒ', U: 'ŪÚǓÙ', Ü: 'ǕǗǙǛ' })) {
  [...conTono].forEach((c, i) => (TONOS[c] = [base, i + 1]));
}
// Las interjecciones de m, n y ê: solo algunos de sus tonos tienen letra propia (嗯 ńg, 呣 ḿ).
Object.assign(TONOS, { ḿ: ['m', 2], ń: ['n', 2], ň: ['n', 3], ǹ: ['n', 4], ế: ['ê', 2], ề: ['ê', 4] });

/** El carácter sin tono, en minúscula. Cada carácter da uno: así las posiciones de la lectura y de su forma sin tonos casan. */
function baseDe(c: string): string {
  return (TONOS[c]?.[0] ?? c).toLowerCase();
}

/** El tono de una sílaba: del 1 al 4, o 5 si es neutro (sin marca). */
export function tonoDe(silaba: string): number {
  for (const c of silaba.normalize('NFC')) {
    const t = TONOS[c];
    if (t) return t[1];
  }
  return 5;
}

/** La lectura sin tonos y en minúscula, para buscar: «Běijīng» da «beijing», y «lǜ», «lü». */
export function sinTonos(lectura: string): string {
  return [...lectura.normalize('NFC').replace(/u:|v/gi, 'ü')].map(baseDe).join('').replace(/[\s'’·-]/g, '');
}

/** Las que solo van sueltas: interjecciones como 嗯 (ńg) o 呣 (m). */
const SUELTAS = new Set(['m', 'n', 'ng', 'hm', 'hng', 'ê']);

/**
 * Si una sílaba puede ir en ese sitio, según la ortografía del pinyin: la que empieza por a, o, e no va pegada a otra sin
 * apóstrofo (fāng'àn), las interjecciones van solas y la «r» del 儿 cierra la sílaba anterior (diǎnr).
 */
function cabeAqui(silaba: string, alPrincipio: boolean, alFinal: boolean): boolean {
  // También en medio (今儿个, jīnrge) o sola, la del propio 儿.
  if (silaba === 'r') return !alPrincipio || alFinal;
  if (SUELTAS.has(silaba)) return alPrincipio && alFinal;
  return alPrincipio || !/^[aoeê]/.test(silaba);
}

/**
 * Las sílabas de una lectura escrita junta: «yínháng» da yín y háng. Con `n`, las que den justo `n` sílabas (xian, con
 * n = 2, es xi y an: 西安). Entre varias maneras, la de sílabas más largas. Sin ninguna que valga, null.
 */
export function silabas(lectura: string, n?: number): string[] | null {
  const texto = lectura.normalize('NFC').trim();
  // Lo que separa sílabas por sí solo: los espacios, el apóstrofo de Xī'ān y los guiones.
  const caracteres: string[] = [];
  const corte = new Set<number>();
  for (const c of texto) {
    if (/[\s'’·-]/.test(c)) corte.add(caracteres.length);
    else caracteres.push(c);
  }
  const bases = caracteres.map(baseDe);
  const largo = caracteres.length;
  if (!largo) return n === undefined || n === 0 ? [] : null;
  // camino[i][k]: el largo de la última sílaba si se llega a i con k sílabas; se queda la primera, que es la más larga.
  const maximo = n ?? largo;
  const camino: Map<number, number>[] = Array.from({ length: largo + 1 }, () => new Map());
  camino[0].set(0, 0);
  for (let i = 0; i < largo; i++) {
    for (const k of camino[i].keys()) {
      if (k >= maximo) continue;
      for (let l = Math.min(MAS_LARGA, largo - i); l >= 1; l--) {
        // Una sílaba no cruza un separador.
        let cruza = false;
        for (let j = i + 1; j < i + l; j++) if (corte.has(j)) cruza = true;
        const silaba = bases.slice(i, i + l).join('');
        if (cruza || !SILABAS.has(silaba) || !cabeAqui(silaba, i === 0 || corte.has(i), i + l === largo || corte.has(i + l))) continue;
        if (!camino[i + l].has(k + 1)) camino[i + l].set(k + 1, l);
      }
    }
  }
  const final = camino[largo];
  const k = n ?? Math.min(...final.keys());
  if (!final.has(k) || !Number.isFinite(k)) return null;
  const salida: string[] = [];
  let i = largo;
  for (let quedan = k; quedan > 0; quedan--) {
    const l = camino[i].get(quedan)!;
    salida.unshift(caracteres.slice(i - l, i).join(''));
    i -= l;
  }
  return salida;
}

const HAN = /[㐀-鿿豈-﫿]|[\u{20000}-\u{3134f}]/u;

/**
 * Reparte la lectura sobre los caracteres de la palabra: una sílaba en cada ideograma, y nada sobre lo demás (cifras,
 * letras). Si las sílabas no casan con los caracteres, la lectura entera va sobre la palabra entera.
 */
export function repartirPinyin(superficie: string, lectura: string): { texto: string; lectura?: string }[] {
  const caracteres = [...superficie];
  const conSilaba = caracteres.map((c) => HAN.test(c));
  const n = conSilaba.filter(Boolean).length;
  const partes = n ? silabas(lectura, n) : null;
  if (!partes) return lectura ? [{ texto: superficie, lectura }] : [{ texto: superficie }];
  const salida: { texto: string; lectura?: string }[] = [];
  let s = 0;
  caracteres.forEach((c, i) => {
    if (conSilaba[i]) salida.push({ texto: c, lectura: partes[s++] });
    else if (salida.length && salida[salida.length - 1].lectura === undefined) salida[salida.length - 1].texto += c;
    else salida.push({ texto: c });
  });
  return salida;
}

/** Dónde va la marca de tono: en la a o la e; en «ou», la o; si no, en la última vocal. */
function conMarca(silaba: string, tono: number): string {
  if (tono < 1 || tono > 4) return silaba;
  const vocales = [...silaba].map((c, i) => ({ c: c.toLowerCase(), i })).filter((x) => 'aeiouü'.includes(x.c));
  if (!vocales.length) return silaba;
  const objetivo = vocales.find((x) => x.c === 'a' || x.c === 'e') ?? (silaba.toLowerCase().includes('ou') ? vocales.find((x) => x.c === 'o') : undefined) ?? vocales[vocales.length - 1];
  const letras = [...silaba];
  const original = letras[objetivo.i];
  const marcadas = original === original.toUpperCase() && original !== original.toLowerCase()
    ? { A: 'ĀÁǍÀ', E: 'ĒÉĚÈ', I: 'ĪÍǏÌ', O: 'ŌÓǑÒ', U: 'ŪÚǓÙ', Ü: 'ǕǗǙǛ' }[original]
    : { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', ü: 'ǖǘǚǜ' }[original];
  if (marcadas) letras[objetivo.i] = [...marcadas][tono - 1];
  return letras.join('');
}

/** «ni3hao3» o «ni3 hao3» con marcas: nǐhǎo. El 5 y el 0 son el neutro. Lo que no lleve números queda igual. */
export function numerosAMarcas(texto: string): string {
  return texto.normalize('NFC').replace(/(u:|v)/gi, (m) => (m[0] === m[0].toUpperCase() ? 'Ü' : 'ü')).replace(/([a-zA-ZüÜê]+)([0-5])/g, (_, s: string, t: string) => conMarca(s, Number(t)));
}

/** La sílaba con su número en lugar de la marca: hǎo da hao3; el neutro va sin número. */
function aNumero(silaba: string): string {
  const tono = tonoDe(silaba);
  const base = [...silaba.normalize('NFC')].map((c) => TONOS[c]?.[0] ?? c).join('');
  return tono === 5 ? base : `${base}${tono}`;
}

/** La lectura como la quiere ver cada cual: con marcas, como la dan los diccionarios, o con números (yin2hang2). */
export function pinyinVisible(lectura: string, formato: string | undefined): string {
  if (formato !== 'numeros') return lectura;
  const partes = silabas(lectura);
  return partes ? partes.map(aNumero).join('') : lectura;
}

/**
 * La forma en que se guardan las lecturas, para compararlas: con marcas y sin espacios, como en CC-CEDICT. Wiktionary
 * separa las sílabas (nǐ hǎo): se juntan, y donde la siguiente empieza por a, o, e, con el apóstrofo que pide la
 * ortografía (fāng àn es fāng'àn), para que se sigan pudiendo partir.
 */
export function normalizarPinyin(lectura: string): string {
  return numerosAMarcas(lectura.trim())
    .replace(/’/g, "'")
    .replace(/[\s·-]+(?=[aoeêāáǎàōóǒòēéěèếềAOEÊĀÁǍÀŌÓǑÒĒÉĚÈ])/g, "'")
    .replace(/[\s·-]+/g, '');
}

/** Si un texto es solo pinyin (con o sin tonos): entonces se busca por la lectura. «bank» no lo es; «nihao», sí. */
export function esSoloPinyin(texto: string): boolean {
  const t = texto.trim();
  if (!t || !/^[\p{Script=Latin}\s'’·0-5:-]+$/u.test(t)) return false;
  return silabas(normalizarPinyin(t)) !== null;
}
