// El contenido real de las imágenes del README, con su procedencia: nada está escrito para la ocasión.
// - Un tramo del 施政方針演説 del 20 de febrero de 2026 en la Dieta, del canal de YouTube del 首相官邸, con su texto oficial y
//   la traducción oficial al inglés. Licencia PDL 1.0 (公共データ利用規約, compatible con CC BY 4.0): se cita la fuente y
//   se dice que se ha editado. Las traducciones a los demás idiomas son de Kotonoha, como las que hace al ver un video.
// - El primer minuto de «What’s Up: November 2026 Skywatching Tips from NASA», con los subtítulos de la propia NASA: obra
//   del gobierno de EE. UU., de dominio público (NASA/JPL-Caltech).
// - Clásicos de dominio público: el Genji de Yosano Akiko y 『羅生門』, del Aozora Bunko; la edición de 1866 de «Alice’s
//   Adventures in Wonderland», escaneada en Wikimedia Commons; el comienzo de «Pride and Prejudice» (1813), y el prefacio
//   en kana del 古今和歌集 (905), de donde viene «言の葉».
// Los archivos grandes los baja herramientas/contenido-readme.mjs a contenido-libre/, que no va en git.

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RAIZ = resolve(import.meta.dirname, '..', '..');
const LIBRE = join(RAIZ, 'contenido-libre');

/** La ruta de un archivo de contenido-libre/, que tiene que haberse bajado antes. */
export function archivoLibre(nombre) {
  const ruta = join(LIBRE, nombre);
  if (!existsSync(ruta)) throw new Error(`Falta contenido-libre/${nombre}: node herramientas/contenido-readme.mjs`);
  return ruta;
}

/** Un archivo de contenido-libre/ servido como lo serviría un servidor de video: con rangos. */
export function servirVideo(datos, rango, responder) {
  const r = /bytes=(\d+)-(\d*)/.exec(rango ?? '');
  if (!r) return responder(200, datos, { 'content-type': 'video/webm', 'accept-ranges': 'bytes' });
  const desde = Number(r[1]);
  const hasta = r[2] ? Number(r[2]) : datos.length - 1;
  return responder(206, datos.subarray(desde, hasta + 1), { 'content-type': 'video/webm', 'accept-ranges': 'bytes', 'content-range': `bytes ${desde}-${hasta}/${datos.length}` });
}

const tiempo = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const x = (s % 60).toFixed(3).padStart(6, '0');
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${x}`;
};
/** Unas líneas [inicio, fin, texto] como WebVTT. */
export const vtt = (lineas) => `WEBVTT\n\n${lineas.map(([a, b, t]) => `${tiempo(a)} --> ${tiempo(b)}\n${t}`).join('\n\n')}\n`;
/** Unas líneas [inicio, fin, texto] como los subtítulos de YouTube (json3). */
export const json3 = (lineas) => JSON.stringify({ events: lineas.map(([a, b, t]) => ({ tStartMs: Math.round(a * 1000), dDurationMs: Math.round((b - a) * 1000), segs: [{ utf8: t }] })) });

// ---------- El discurso en la Dieta ----------

export const DIETA = {
  titulo: '第221回国会における高市内閣総理大臣施政方針演説',
  idVideo: 'alk-cIHwTIU',
  url: 'https://www.youtube.com/watch?v=alk-cIHwTIU',
  texto: 'https://www.kantei.go.jp/jp/105/statement/2026/0220shiseihoshin.html',
  textoIngles: 'https://japan.kantei.go.jp/105/statement/202602/20shiseihoshin.html',
  video: 'dieta.webm',
  // El apartado «３ 技術力», como lo publica el 首相官邸, en líneas de subtítulo. Los tiempos, en segundos desde 25:58 del
  // video: las palabras con tiempo de sus subtítulos automáticos y las pausas del audio (el aplauso va de 5,5 a 12 s).
  lineas: [
    [12.4, 17.1, '「強い経済」の基盤となるのは、優れた科学技術力です。'],
    [17.8, 20.0, '大学改革を進めるとともに、'],
    [20.1, 24.1, '基礎研究を含めた科学技術研究の基盤を強化し、'],
    [24.3, 29.9, 'イノベーションを通じた経済成長や国際的地位の確保を達成する'],
    [30.4, 32.6, '「新技術立国」を目指します。'],
    [33.1, 36.4, '日本には優れた研究成果が数多くあります。'],
    [38.0, 40.6, 'ＡＩ・先端ロボットやバイオなど、'],
    [40.9, 42.9, '成長が見込まれ、かつ、'],
    [43.0, 47.5, '難易度が高い技術領域における研究開発について、'],
    [48.1, 51.4, '税制や規制改革を一体的に講ずることで、'],
    [51.8, 56.8, '投資を強力に促進していくための認定制度を創設します。'],
    [57.8, 62.7, 'スタートアップは、技術を実用化していく主要な担い手です。'],
    [63.6, 66.5, '「スタートアップ育成５か年計画」を強化し、'],
    [66.8, 70.3, '先端技術の社会実装を加速させます。'],
    [70.9, 74.3, 'そのため、国内外からのベンチャー投資の促進、'],
    [74.6, 78.5, '規制改革、人材育成、官公庁による調達といった'],
    [78.6, 82.3, '多角的観点からの総合支援策を講じます。'],
    [82.7, 85.3, 'また、支援体制の拡充を図り、'],
    [85.6, 89.3, '多数のグローバル・ユニコーンの創出を目指します。'],
  ],
  // La traducción, por frases: la inglesa es la oficial; las demás, de Kotonoha.
  traducciones: {
    en: [
      'Outstanding scientific and technological capabilities form the foundation of a strong economy.',
      'We will advance university reform and strengthen the foundations of our scientific and technological research, including in the area of basic research,',
      'and aim to build a new kind of technology-driven nation that achieves economic growth through innovation and secures Japan’s position in the international community.',
      'Japan has produced many outstanding research achievements.',
      'With regard to research and development in technological fields where strong growth is expected and the level of technical difficulty is high, such as AI, advanced robotics, and biotechnology,',
      'we will establish a certification system to vigorously promote investment by implementing tax and regulatory reforms in an integrated manner.',
      'Startups are key drivers in bringing technologies into practical use.',
      'We will strengthen the Five-year Plan for Promoting Startups and accelerate the social implementation of advanced technologies.',
      'To this end, we will implement comprehensive support measures from multiple perspectives, including the promotion of domestic and international investment in ventures,',
      'regulatory reform, human resource development, and procurement by government agencies.',
      'In addition, we will expand our support framework and aim to create a large number of global unicorns.',
    ],
    es: [
      'Una capacidad científica y tecnológica sobresaliente es la base de una economía fuerte.',
      'Impulsaremos la reforma universitaria y reforzaremos la base de la investigación científica y tecnológica, incluida la investigación básica,',
      'con el objetivo de ser una «nación de nueva tecnología» que logre crecimiento económico mediante la innovación y asegure su posición internacional.',
      'Japón cuenta con numerosos resultados de investigación sobresalientes.',
      'Para la investigación y el desarrollo en campos con gran potencial de crecimiento y alta dificultad técnica, como la IA, la robótica avanzada o la biotecnología,',
      'crearemos un sistema de certificación que impulse con fuerza la inversión, con reformas fiscales y regulatorias a la vez.',
      'Las startups son las principales encargadas de llevar la tecnología a la práctica.',
      'Reforzaremos el «Plan quinquenal de fomento de startups» y aceleraremos la implantación social de las tecnologías avanzadas.',
      'Para ello, aplicaremos medidas de apoyo integrales desde varios ángulos: el fomento de la inversión de capital riesgo nacional y extranjera,',
      'la reforma regulatoria, la formación de personal y las compras de la administración pública.',
      'Además, ampliaremos el sistema de apoyo con el objetivo de crear numerosos unicornios globales.',
    ],
    de: [
      'Herausragende wissenschaftliche und technologische Fähigkeiten sind die Grundlage einer starken Wirtschaft.',
      'Wir werden die Hochschulreform vorantreiben und die Grundlagen der wissenschaftlichen und technologischen Forschung, einschließlich der Grundlagenforschung, stärken,',
      'mit dem Ziel einer „neuen Technologienation“, die durch Innovation Wirtschaftswachstum erreicht und ihre internationale Stellung sichert.',
      'Japan hat zahlreiche herausragende Forschungsergebnisse.',
      'Für Forschung und Entwicklung in Bereichen mit hohem Wachstumspotenzial und hohem Schwierigkeitsgrad, etwa KI, fortgeschrittene Robotik und Biotechnologie,',
      'schaffen wir ein Zertifizierungssystem, das Investitionen durch abgestimmte Steuer- und Regulierungsreformen kräftig fördert.',
      'Start-ups sind die wichtigsten Träger, die Technologien in die Praxis bringen.',
      'Wir stärken den „Fünfjahresplan zur Förderung von Start-ups“ und beschleunigen die gesellschaftliche Umsetzung fortschrittlicher Technologien.',
      'Dazu ergreifen wir umfassende Fördermaßnahmen aus mehreren Blickwinkeln: die Förderung in- und ausländischer Risikokapitalinvestitionen,',
      'Regulierungsreformen, Fachkräfteentwicklung und die Beschaffung durch Behörden.',
      'Außerdem bauen wir die Unterstützungsstrukturen aus und wollen zahlreiche globale Einhörner hervorbringen.',
    ],
    zh: [
      '“强大经济”的基础是卓越的科学技术实力。',
      '我们将推进大学改革，强化包括基础研究在内的科学技术研究基础，',
      '目标是成为通过创新实现经济增长、确保国际地位的“新技术立国”。',
      '日本拥有众多优秀的研究成果。',
      '对于人工智能、先进机器人、生物技术等有望增长且难度很高的技术领域的研究开发，',
      '我们将一体推进税制和规制改革，创设大力促进投资的认定制度。',
      '初创企业是将技术投入实用的主要力量。',
      '我们将强化“初创企业培育五年计划”，加速先进技术的社会应用。',
      '为此，我们将从多个角度出台综合支持措施，包括促进国内外风险投资、',
      '规制改革、人才培养以及政府机关的采购。',
      '此外，我们将扩充支持体制，力争培育众多全球独角兽企业。',
    ],
    ko: [
      '‘강한 경제’의 기반은 뛰어난 과학기술력입니다.',
      '대학 개혁을 추진하는 동시에, 기초 연구를 포함한 과학기술 연구의 기반을 강화하여',
      '혁신을 통한 경제 성장과 국제적 지위 확보를 이루는 ‘신기술 입국’을 지향합니다.',
      '일본에는 뛰어난 연구 성과가 많이 있습니다.',
      'AI·첨단 로봇이나 바이오 등 성장이 기대되고 난이도가 높은 기술 영역의 연구 개발에 대해,',
      '세제와 규제 개혁을 일체적으로 강구하여 투자를 강력히 촉진하는 인증 제도를 만들겠습니다.',
      '스타트업은 기술을 실용화해 나가는 주요한 주체입니다.',
      '‘스타트업 육성 5개년 계획’을 강화하고 첨단 기술의 사회 구현을 가속하겠습니다.',
      '이를 위해 국내외 벤처 투자 촉진,',
      '규제 개혁, 인재 육성, 관공청 조달 등 다각적인 관점의 종합 지원책을 마련하겠습니다.',
      '또한 지원 체제를 확충하여 다수의 글로벌 유니콘 창출을 목표로 합니다.',
    ],
  },
  // Cuándo va cada frase de la traducción.
  tiemposTraduccion: [[12.4, 17.1], [17.8, 24.1], [24.3, 32.6], [33.1, 36.4], [38.0, 47.5], [48.1, 56.8], [57.8, 62.7], [63.6, 70.3], [70.9, 78.5], [78.6, 82.3], [82.7, 89.3]],
};
/** La traducción del discurso como líneas [inicio, fin, texto]. */
export const traduccionDieta = (id) => DIETA.tiemposTraduccion.map(([a, b], i) => [a, b, (DIETA.traducciones[id] ?? DIETA.traducciones.en)[i]]);

// ---------- La NASA ----------

export const NASA = {
  titulo: 'What’s Up: November 2026 Skywatching Tips from NASA',
  idVideo: 'PN-iD6VTmyc',
  url: 'https://www.youtube.com/watch?v=PN-iD6VTmyc',
  video: 'nasa.webm',
  // La pista en-US del propio video, sin el rótulo de quien habla.
  lineas: [
    [0.0, 1.835, 'A month of meteor showers ...'],
    [1.968, 4.103, 'a close pairing of Mars and Jupiter ...'],
    [4.103, 6.038, 'and a supermoon!'],
    [6.038, 8.407, 'That’s What’s Up for November.'],
    [8.407, 11.31, 'November offers a buffet of opportunities'],
    [11.31, 14.313, 'to see a meteor streak across the sky!'],
    [14.513, 17.717, 'The Southern Taurids peak around November 5th,'],
    [18.118, 21.488, 'followed by the Northern Taurids around November 12th.'],
    [21.888, 25.491, 'Those names refer to the two areas in the constellation'],
    [25.491, 28.627, 'Taurus, where the meteors appear to originate.'],
    [28.994, 30.93, 'Each Taurid shower produces'],
    [30.93, 33.166, 'only a handful of meteors per hour'],
    [33.466, 35.768, 'around five, under ideal conditions'],
    [36.102, 38.537, 'but an occasional bright fireball'],
    [38.537, 40.273, 'can make the wait worthwhile.'],
    [40.973, 43.142, 'Next up are the Leonids.'],
    [43.142, 46.879, 'For the best viewing times, try the early morning hours'],
    [46.879, 50.95, 'of November 17th and 18th, after the Moon sets.'],
    [51.584, 54.954, 'Under ideal conditions, the shower could produce around'],
    [54.954, 59.192, '15 meteors per hour, though most viewers will see fewer.'],
    [59.626, 61.794, 'To level up your viewing experience,'],
    [61.794, 65.498, 'you will want to find a dark location, give your eyes about'],
  ],
  // La traducción, por frases (de Kotonoha).
  tiemposTraduccion: [[0.0, 6.038], [6.038, 8.407], [8.407, 14.313], [14.513, 21.488], [21.888, 28.627], [28.994, 40.273], [40.973, 43.142], [43.142, 50.95], [51.584, 59.192], [59.626, 65.498]],
  traducciones: {
    es: ['Un mes de lluvias de meteoros, Marte y Júpiter muy juntos… y una superluna.', 'Esto es What’s Up de noviembre.', 'Noviembre ofrece un sinfín de ocasiones de ver un meteoro cruzar el cielo.', 'Las Táuridas del Sur tienen su máximo hacia el 5 de noviembre, y las del Norte, hacia el 12.', 'Esos nombres se refieren a las dos zonas de la constelación de Tauro de donde parecen salir los meteoros.', 'Cada lluvia de las Táuridas da solo un puñado de meteoros por hora, unos cinco en condiciones ideales, pero alguna bola de fuego brillante puede hacer que la espera merezca la pena.', 'Luego vienen las Leónidas.', 'Para verlas mejor, prueba de madrugada el 17 y el 18 de noviembre, cuando se ponga la Luna.', 'En condiciones ideales, la lluvia podría dar unos 15 meteoros por hora, aunque la mayoría verá menos.', 'Para mejorar la observación, busca un lugar oscuro y da a tus ojos una media hora para acostumbrarse.'],
    de: ['Ein Monat voller Meteorschauer, Mars und Jupiter dicht beieinander … und ein Supermond!', 'Das ist What’s Up im November.', 'Der November bietet eine Fülle von Gelegenheiten, eine Sternschnuppe über den Himmel ziehen zu sehen.', 'Die südlichen Tauriden erreichen um den 5. November ihren Höhepunkt, die nördlichen um den 12.', 'Die Namen beziehen sich auf die zwei Bereiche im Sternbild Stier, aus denen die Meteore zu kommen scheinen.', 'Jeder Tauriden-Schauer bringt nur eine Handvoll Meteore pro Stunde, etwa fünf unter idealen Bedingungen, aber ein gelegentlicher heller Feuerball kann das Warten lohnen.', 'Als Nächstes kommen die Leoniden.', 'Am besten sieht man sie in den frühen Morgenstunden des 17. und 18. November, nachdem der Mond untergegangen ist.', 'Unter idealen Bedingungen könnte der Schauer rund 15 Meteore pro Stunde bringen, die meisten sehen aber weniger.', 'Für ein besseres Erlebnis such dir einen dunklen Ort und gib deinen Augen etwa eine halbe Stunde, um sich anzupassen.'],
    zh: ['一整个月的流星雨，火星与木星紧紧相伴……还有一轮超级月亮！', '这就是十一月的 What’s Up。', '十一月有大把机会看到流星划过夜空！', '南金牛座流星雨在11月5日前后达到高峰，北金牛座流星雨则在11月12日前后。', '这两个名字指的是金牛座中流星看似发源的两个区域。', '每场金牛座流星雨每小时只有寥寥几颗流星，理想条件下约五颗，但偶尔出现的明亮火流星会让等待值得。', '接下来是狮子座流星雨。', '最佳观测时间是11月17日和18日凌晨，月亮落下之后。', '理想条件下，这场流星雨每小时约有15颗流星，不过大多数人看到的会少一些。', '想看得更好，就找个黑暗的地方，让眼睛用大约半小时适应。'],
    ko: ['유성우가 이어지는 한 달, 바짝 붙은 화성과 목성… 그리고 슈퍼문!', '11월의 What’s Up입니다.', '11월에는 유성이 하늘을 가로지르는 모습을 볼 기회가 아주 많습니다!', '남쪽 황소자리 유성우는 11월 5일 무렵, 북쪽 황소자리 유성우는 11월 12일 무렵 절정입니다.', '이 이름은 유성이 시작되는 것처럼 보이는 황소자리의 두 영역을 가리킵니다.', '황소자리 유성우는 각각 시간당 유성이 몇 개뿐이라 이상적인 조건에서도 다섯 개 정도지만, 가끔 나오는 밝은 화구가 기다림을 보람 있게 해 줍니다.', '다음은 사자자리 유성우입니다.', '가장 잘 보이는 때는 11월 17일과 18일 이른 새벽, 달이 진 뒤입니다.', '이상적인 조건이라면 시간당 15개 정도의 유성이 보일 수 있지만, 대부분은 그보다 적게 봅니다.', '더 잘 보려면 어두운 곳을 찾고, 눈이 적응하도록 30분쯤 기다리세요.'],
    ja: ['流星群が続く一か月、火星と木星の大接近…そしてスーパームーン！', '11月の What’s Up です。', '11月は、流れ星が空を横切るのを見るチャンスがたくさんあります！', 'おうし座南流星群は11月5日ごろ、おうし座北流星群は11月12日ごろに極大を迎えます。', 'この名前は、流星が飛び出してくるように見える、おうし座の二つの領域を指しています。', 'おうし座流星群はどちらも1時間に数個ほど、条件がよくても5個くらいですが、ときおり現れる明るい火球が待つ価値を生みます。', '次はしし座流星群です。', 'いちばんの見ごろは、11月17日と18日の明け方、月が沈んだあとです。', '条件がよければ1時間に15個ほど流れるかもしれませんが、たいていはそれより少なく見えるでしょう。', 'もっとよく見るには、暗い場所を探し、目が慣れるまで30分ほど待ちましょう。'],
  },
};
/** La traducción del video de la NASA como líneas [inicio, fin, texto]. */
export const traduccionNasa = (id) => NASA.tiemposTraduccion.map(([a, b], i) => [a, b, (NASA.traducciones[id] ?? NASA.traducciones.es)[i]]);

// ---------- Los clásicos ----------

/** 《》 y ｜ del Aozora Bunko, como <ruby>: la lectura va sobre el ｜ que la abre o sobre los kanji de delante. */
function rubyAozora(linea) {
  return linea
    .replace(/｜([^《]+)《([^》]+)》/g, '<ruby>$1<rt>$2</rt></ruby>')
    .replace(/([々〆一-鿿ヶ]+)《([^》]+)》/gu, '<ruby>$1<rt>$2</rt></ruby>');
}

/** Los primeros párrafos de un texto del Aozora Bunko, sin su cabecera, sus notas ni su pie, con su ruby. */
export function parrafosAozora(texto, cuantos) {
  const lineas = texto.replace(/\r/g, '').split('\n');
  const fin = lineas.findIndex((l, i) => i > 0 && l.startsWith('-----'));
  const cuerpo = lineas.slice(lineas.findIndex((l, i) => i > fin && l.startsWith('-----')) + 1);
  const salida = [];
  for (const l of cuerpo) {
    if (l.startsWith('底本：')) break;
    if (!l.trim() || l.includes('［＃')) continue;
    salida.push(rubyAozora(l.replace(/^　/, '')));
    if (salida.length >= cuantos) break;
  }
  return salida;
}

/** El comienzo de 桐壺, el primer capítulo del Genji, en la versión moderna de Yosano Akiko (Aozora Bunko). */
export const genji = (cuantos = 5) => parrafosAozora(readFileSync(archivoLibre('genji-kiritsubo.txt'), 'utf8'), cuantos);
export const GENJI = { titulo: '源氏物語', autor: '紫式部・與謝野晶子訳', capitulo: '桐壺', carta: 'https://www.aozora.gr.jp/cards/000052/card5016.html' };

/**
 * El volumen 1 de 『源氏物語』 en su edición ilustrada de 1650 (慶安3年, 山本春正), de la Biblioteca Nacional de la Dieta,
 * dominio público: la tapa (きりつほ, un 桐壺 escrito a mano) y trece dobles páginas recortadas de sus fotos
 * (herramientas/contenido-readme.mjs). La 12 es la de la dama en la galería bajo la luna, con anotaciones en rojo. El
 * título del CBZ no contiene el del EPUB del Genji, porque las tapas se buscan por lo que contiene su etiqueta.
 */
export const GENJI_1650 = { titulo: '絵入源氏 · 1650', archivo: 'genji-1650.cbz', carpeta: 'genji-1650', paginas: 14, abrir: 12, fuente: 'https://dl.ndl.go.jp/pid/2579509' };

/**
 * Una noticia de NHK ONE con su foto, para el lector de páginas: la sonda Voyager 1 a un día luz de la Tierra (2026-11-17).
 * Se carga en vivo. Sus derechos son de NHK: se publica con su crédito, como las páginas de los libros de 聖臣. Las nuevas y
 * las que se siguen son palabras de su titular y su entradilla; el resto de la página queda conocida.
 */
export const NHK_VOYAGER = {
  url: 'https://news.web.nhk/newsweb/na/nd-20261116de76380',
  titulo: '地球から1光日 259億キロ離れた宇宙を進むボイジャー1号の旅',
  nuevas: ['探査機', '打ち上げ', '到達', '観測', '成果', '木星', '土星', '無人'],
  seguidas: ['宇宙'],
};

/** 『羅生門』 de Akutagawa en el Aozora Bunko: la página de verdad y su hoja de estilo. */
export const RASHOMON = { url: 'https://www.aozora.gr.jp/cards/000879/files/127_15260.html', pagina: 'rashomon.html', css: 'aozora.css' };

/** La primera página del capítulo I de «Alice’s Adventures in Wonderland» en la edición de 1866 (Wikimedia Commons). */
export const ALICE_1866 = { imagen: 'alice-1866-p21.jpg', fuente: "https://commons.wikimedia.org/wiki/File:Carroll_-_Alice's_adventures_in_Wonderland,_1866.djvu", palabra: 'tired' };

/** «Alice’s Adventures in Wonderland» (1866), capítulo I, en Wikisource: una página de verdad en inglés. */
export const ALICE_WIKISOURCE = "https://en.wikisource.org/wiki/Alice%27s_Adventures_in_Wonderland_(1866)/Chapter_1";

/** El comienzo de «Pride and Prejudice», de Jane Austen (1813). */
export const AUSTEN =
  'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.\n\nHowever little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.';

/** El prefacio en kana del 古今和歌集 (905), de Ki no Tsurayuki: de aquí sale «言の葉». */
export const KOKINSHU = 'やまとうたは、人の心を種として、よろづの言の葉とぞなれりける。';
