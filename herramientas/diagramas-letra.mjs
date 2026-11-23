// Genera los dos diagramas de cómo se coloca la letra de una canción (sección de letras de docs/*/architecture.md), uno
// por idioma, y comprueba en Edge que cada texto cabe en su caja.
// Uso: node herramientas/diagramas-letra.mjs
//      KK_VISTAS=carpeta node herramientas/diagramas-letra.mjs   (además, capturas en claro y en oscuro para mirarlas)
//
// Son SVG autónomos: llevan su propia tarjeta de fondo y cambian de colores con prefers-color-scheme, así que se leen igual
// con el tema claro y el oscuro de GitHub. Una imagen no puede cargar fuentes externas: van las del sistema, con la CJK de
// cada idioma delante para que los caracteres chinos tengan la forma de esa lengua.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = join(RAIZ, 'docs', 'img');

const TEXTOS = {
  es: {
    flujo: {
      titulo: 'Cómo se coloca la letra de una canción',
      desc: 'El audio de la canción va a Whisper Turbo, que oye qué se canta y cuándo, y a Demucs, que separa la voz. La letra pegada se casa letra a letra con lo que oyó Whisper, y eso da la zona de cada verso. narabas busca en esa zona, sobre la voz sola, dónde empiezan sus fonemas. Si se le pide, o si la letra apenas casa, Claude dice qué versos se cantan y en qué orden. letra.ts reúne los tiempos y genera la pista de la letra, que se analiza y se traduce.',
      letra: ['Letra pegada', 'Versos, sin tiempos'],
      audio: ['Audio de la canción', 'Entero, a 16 kHz'],
      whisper: ['Whisper Turbo', 'Qué se oye y cuándo'],
      demucs: ['Demucs', 'Solo la voz'],
      casar: ['Letra a letra', 'La zona de cada verso'],
      narabas: ['narabas', 'Dónde empieza cada fonema'],
      claude: ['Claude', 'Qué se canta'],
      letrats: ['letra.ts pone los tiempos', 'Reglas fijas, sin IA'],
      pista: ['Pista de la letra', 'Se analiza y se traduce'],
      leyenda: ['En el navegador', 'Claude, por la API'],
    },
    voz: {
      titulo: 'Dónde cae un verso que Whisper no oyó',
      desc: 'Línea de tiempo de 24 segundos. YAMNet detecta canto de 0 a 12 s y de 20 a 24 s; de 12 a 20 s hay un pasaje instrumental. Whisper oyó los versos 1, 2 y 4, pero no el 3. Antes, el verso 3 se pegaba al 4 y caía en el pasaje instrumental, de 16 a 20 s. Ahora solo cuenta el tiempo con voz, y cae de 8 a 12 s, donde se canta.',
      pasaje: 'Pasaje instrumental',
      filas: ['Voz (YAMNet)', 'Whisper oyó', 'Antes (0.33)', 'Ahora (0.34)'],
      verso: (n) => `Verso ${n}`,
      segundos: (n) => `${n} s`,
      leyenda: ['Tramo de 2 s con voz', 'Tramo sin voz'],
    },
  },
  en: {
    flujo: {
      titulo: 'How song lyrics are placed',
      desc: "The song's audio goes to Whisper Turbo, which hears what is sung and when, and to Demucs, which separates the voice. The pasted lyrics are matched letter by letter with what Whisper heard, which gives each verse's zone. In that zone, narabas finds on the voice alone where its phonemes start. If asked, or if the lyrics barely match, Claude says which verses are sung and in what order. letra.ts combines the timing and produces the lyrics track, which is analyzed and translated.",
      letra: ['Pasted lyrics', 'Verses, no timing'],
      audio: ['Song audio', 'Whole, at 16 kHz'],
      whisper: ['Whisper Turbo', 'What is heard, and when'],
      demucs: ['Demucs', 'Only the voice'],
      casar: ['Letter by letter', "Each verse's zone"],
      narabas: ['narabas', 'Where each phoneme starts'],
      claude: ['Claude', 'What is sung'],
      letrats: ['letra.ts sets the timing', 'Fixed rules, no AI'],
      pista: ['Lyrics track', 'Analyzed and translated'],
      leyenda: ['In the browser', 'Claude, through the API'],
    },
    voz: {
      titulo: 'Where a verse Whisper did not hear is placed',
      desc: 'A 24-second timeline. YAMNet detects singing from 0 to 12 s and from 20 to 24 s; from 12 to 20 s there is an instrumental passage. Whisper heard verses 1, 2 and 4, but not verse 3. Before, verse 3 was attached to verse 4 and landed in the instrumental passage, from 16 to 20 s. Now only time with singing counts, and it lands from 8 to 12 s, where it is sung.',
      pasaje: 'Instrumental passage',
      filas: ['Singing (YAMNet)', 'Whisper heard', 'Before (0.33)', 'Now (0.34)'],
      verso: (n) => `Verse ${n}`,
      segundos: (n) => `${n} s`,
      leyenda: ['2 s segment with singing', 'Segment without singing'],
    },
  },
  de: {
    flujo: {
      titulo: 'Wie ein Liedtext platziert wird',
      desc: 'Das Audio des Liedes geht an Whisper Turbo, das hört, was wann gesungen wird, und an Demucs, das die Stimme freistellt. Der eingefügte Liedtext wird Buchstabe für Buchstabe mit dem von Whisper Gehörten abgeglichen; das ergibt den Bereich jedes Verses. Darin sucht narabas auf der freigestellten Stimme, wo seine Phoneme beginnen. Wenn gewünscht oder wenn der Text kaum passt, sagt Claude, welche Verse in welcher Reihenfolge gesungen werden. letra.ts verbindet die Zeiten und erzeugt die Liedtext-Spur, die analysiert und übersetzt wird.',
      letra: ['Liedtext', 'Eingefügt, ohne Zeiten'],
      audio: ['Audio des Liedes', 'Vollständig, mit 16 kHz'],
      whisper: ['Whisper Turbo', 'Was wann zu hören ist'],
      demucs: ['Demucs', 'Nur die Stimme'],
      casar: ['Buchstabenabgleich', 'Bereich jedes Verses'],
      narabas: ['narabas', 'Wo jedes Phonem beginnt'],
      claude: ['Claude', 'Was gesungen wird'],
      letrats: ['letra.ts setzt die Zeiten', 'Feste Regeln, ohne KI'],
      pista: ['Liedtext-Spur', 'Analysiert und übersetzt'],
      leyenda: ['Im Browser', 'Claude, über die API'],
    },
    voz: {
      titulo: 'Wo ein Vers landet, den Whisper nicht gehört hat',
      desc: 'Eine Zeitleiste von 24 Sekunden. YAMNet erkennt Gesang von 0 bis 12 s und von 20 bis 24 s; von 12 bis 20 s gibt es eine Instrumentalpassage. Whisper hörte die Verse 1, 2 und 4, aber nicht Vers 3. Vorher wurde Vers 3 an Vers 4 angehängt und landete in der Instrumentalpassage, von 16 bis 20 s. Jetzt zählt nur die Zeit mit Gesang, und er landet bei 8 bis 12 s, wo er gesungen wird.',
      pasaje: 'Instrumentalpassage',
      filas: ['Gesang (YAMNet)', 'Whisper hörte', 'Vorher (0.33)', 'Jetzt (0.34)'],
      verso: (n) => `Vers ${n}`,
      segundos: (n) => `${n} s`,
      leyenda: ['2-s-Abschnitt mit Gesang', 'Abschnitt ohne Gesang'],
    },
  },
  zh: {
    flujo: {
      titulo: '歌词如何放到歌曲上',
      desc: '歌曲音频交给 Whisper Turbo，由它听出唱了什么、何时唱；同时交给 Demucs，由它分离出人声。粘贴的歌词与 Whisper 听到的内容逐字对照，得出每一句所在的范围。narabas 在这个范围内、在分离出的人声上找出其音素开始的位置。在要求时，或歌词几乎对不上时，由 Claude 指出哪些句子按什么顺序演唱。letra.ts 汇总时间，生成歌词字幕轨，并进行分析和翻译。',
      letra: ['粘贴的歌词', '只有句子，没有时间'],
      audio: ['歌曲音频', '完整音频，16 kHz'],
      whisper: ['Whisper Turbo', '听到什么、何时听到'],
      demucs: ['Demucs', '只留人声'],
      casar: ['逐字对照', '每句所在的范围'],
      narabas: ['narabas', '每个音素从哪里开始'],
      claude: ['Claude', '唱的是什么'],
      letrats: ['letra.ts 计算时间', '固定规则，不用 AI'],
      pista: ['歌词字幕轨', '分析并翻译'],
      leyenda: ['在浏览器中', 'Claude，通过 API'],
    },
    voz: {
      titulo: 'Whisper 没听到的句子放在哪里',
      desc: '24 秒的时间轴。YAMNet 在 0–12 秒和 20–24 秒检测到歌声，12–20 秒是间奏。Whisper 听到了第 1、2、4 句，没有听到第 3 句。以前，第 3 句紧贴在第 4 句之前，落进 16–20 秒的间奏。现在只计算有歌声的时间，它落在 8–12 秒，也就是实际演唱的位置。',
      pasaje: '间奏',
      filas: ['歌声（YAMNet）', 'Whisper 听到的', '以前（0.33）', '现在（0.34）'],
      verso: (n) => `第 ${n} 句`,
      segundos: (n) => `${n} 秒`,
      leyenda: ['有歌声的 2 秒片段', '没有歌声的片段'],
    },
  },
  ko: {
    flujo: {
      titulo: '노래 가사를 배치하는 방법',
      desc: '노래 오디오는 무엇이 언제 들리는지 듣는 Whisper Turbo와, 목소리를 분리하는 Demucs로 갑니다. 붙여넣은 가사를 Whisper가 들은 내용과 글자 단위로 대조해 소절마다 구간을 정합니다. narabas는 그 구간 안에서, 분리한 목소리로 음소가 시작되는 곳을 찾습니다. 요청하거나 가사가 거의 맞지 않으면 Claude가 어떤 소절을 어떤 순서로 부르는지 알려 줍니다. letra.ts는 시간을 모아 가사 트랙을 만들고, 이 트랙은 분석되고 번역됩니다.',
      letra: ['붙여넣은 가사', '소절만, 시간 없음'],
      audio: ['노래 오디오', '전체를 16kHz로'],
      whisper: ['Whisper Turbo', '무엇이 언제 들리는지'],
      demucs: ['Demucs', '목소리만'],
      casar: ['글자 단위 대조', '소절마다 구간'],
      narabas: ['narabas', '각 음소가 시작되는 곳'],
      claude: ['Claude', '부르는 내용'],
      letrats: ['letra.ts의 시간 계산', '고정 규칙, AI 없음'],
      pista: ['가사 트랙', '분석과 번역'],
      leyenda: ['브라우저에서', 'Claude, API로'],
    },
    voz: {
      titulo: 'Whisper가 듣지 못한 소절이 놓이는 곳',
      desc: '24초 길이의 타임라인입니다. YAMNet은 0~12초와 20~24초에서 노랫소리를 감지하고, 12~20초는 간주입니다. Whisper는 1, 2, 4소절은 들었지만 3소절은 듣지 못했습니다. 이전에는 3소절을 4소절 바로 앞에 붙여 16~20초의 간주에 놓였습니다. 지금은 노랫소리가 있는 시간만 세어, 실제로 부르는 8~12초에 놓입니다.',
      pasaje: '간주',
      filas: ['노랫소리 (YAMNet)', 'Whisper가 들은 것', '이전 (0.33)', '현재 (0.34)'],
      verso: (n) => `${n}소절`,
      segundos: (n) => `${n}초`,
      leyenda: ['노랫소리가 있는 2초 구간', '노랫소리가 없는 구간'],
    },
  },
  ja: {
    flujo: {
      titulo: '曲の歌詞をどう配置するか',
      desc: '曲の音声は、何がいつ歌われているかを聞き取る Whisper Turbo と、声を取り出す Demucs に渡ります。貼り付けた歌詞を Whisper が聞いた内容と一文字ずつ照らし合わせ、各フレーズの範囲を決めます。narabas はその範囲で、取り出した声から音素が始まる位置を探します。頼んだときや歌詞がほとんど一致しないときは、どのフレーズをどの順番で歌うかを Claude が示します。letra.ts はタイミングをまとめて歌詞トラックを作り、それを解析して翻訳します。',
      letra: ['貼り付けた歌詞', 'フレーズのみ、時間なし'],
      audio: ['曲の音声', '全体を 16 kHz で'],
      whisper: ['Whisper Turbo', '何がいつ聞こえるか'],
      demucs: ['Demucs', '声だけ'],
      casar: ['一文字ずつ照合', 'フレーズごとの範囲'],
      narabas: ['narabas', '各音素が始まる位置'],
      claude: ['Claude', '歌われる内容'],
      letrats: ['letra.ts の時間計算', '固定ルール、AI なし'],
      pista: ['歌詞トラック', '解析して翻訳'],
      leyenda: ['ブラウザー内', 'Claude（API 経由）'],
    },
    voz: {
      titulo: 'Whisper が聞き取れなかったフレーズの置き場所',
      desc: '24 秒のタイムライン。YAMNet は 0〜12 秒と 20〜24 秒で歌声を検出し、12〜20 秒は間奏です。Whisper はフレーズ 1、2、4 を聞き取りましたが、3 は聞き取れませんでした。以前はフレーズ 3 をフレーズ 4 の直前に付け、16〜20 秒の間奏に置いていました。現在は歌声のある時間だけを数え、実際に歌われている 8〜12 秒に置きます。',
      pasaje: '間奏',
      filas: ['歌声（YAMNet）', 'Whisper の認識', '以前（0.33）', '現在（0.34）'],
      verso: (n) => `フレーズ${n}`,
      segundos: (n) => `${n} 秒`,
      leyenda: ['歌声のある 2 秒の区間', '歌声のない区間'],
    },
  },
};

const LATINA = "system-ui, -apple-system, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif";
const CJK = {
  ja: "'Hiragino Sans', 'Yu Gothic UI', 'Yu Gothic', Meiryo, 'Noto Sans CJK JP', 'Noto Sans JP'",
  zh: "'PingFang SC', 'Microsoft YaHei UI', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Noto Sans SC'",
  ko: "'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans CJK KR', 'Noto Sans KR'",
};

const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Ancho aproximado, solo para centrar las leyendas: la comprobación del final mide el de verdad. */
const estimar = (texto, tam) =>
  [...texto].reduce((a, c) => a + (/[ᄀ-ᇿ⺀-鿿가-힯豈-﫿＀-￯]/u.test(c) ? tam : /[A-Z]/.test(c) ? 0.68 * tam : c === ' ' ? 0.28 * tam : 0.56 * tam), 0);

// Rampas de colores: relleno claro con texto oscuro de la misma rampa, y al revés con el tema oscuro.
const estilo = (id) => `<style>
text { font-family: ${CJK[id] ? `${CJK[id]}, ${LATINA}` : LATINA}; }
.fondo { fill: #ffffff; stroke: #d0d7de; stroke-width: 1; }
.t { font-size: 14px; font-weight: 600; }
.s, .e { font-size: 12px; }
.e { fill: #59636e; }
g rect { stroke-width: 1; }
.gris rect { fill: #f1efe8; stroke: #5f5e5a; } .gris .t { fill: #444441; } .gris .s { fill: #5f5e5a; }
.verde rect { fill: #e1f5ee; stroke: #0f6e56; } .verde .t { fill: #085041; } .verde .s { fill: #0f6e56; }
.coral rect { fill: #faece7; stroke: #993c1d; } .coral .t { fill: #712b13; } .coral .s { fill: #993c1d; }
.morado rect { fill: #eeedfe; stroke: #534ab7; } .morado .s { fill: #3c3489; }
.rojo rect { fill: #fcebeb; stroke: #a32d2d; } .rojo .s { fill: #791f1f; }
.flecha { fill: none; stroke: #59636e; stroke-width: 1.5; }
.punta { fill: none; stroke: #59636e; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
.guia { stroke: #8c959f; stroke-width: 1; stroke-dasharray: 4 4; }
.eje { stroke: #8c959f; stroke-width: 1; }
.canto { fill: #7f77dd; }
.sin-canto { fill: none; stroke: #888780; stroke-dasharray: 3 3; }
@media (prefers-color-scheme: dark) {
  .fondo { fill: #0d1117; stroke: #30363d; }
  .e { fill: #9198a1; }
  .gris rect { fill: #444441; stroke: #b4b2a9; } .gris .t { fill: #f1efe8; } .gris .s { fill: #d3d1c7; }
  .verde rect { fill: #085041; stroke: #5dcaa5; } .verde .t { fill: #e1f5ee; } .verde .s { fill: #9fe1cb; }
  .coral rect { fill: #712b13; stroke: #f0997b; } .coral .t { fill: #faece7; } .coral .s { fill: #f5c4b3; }
  .morado rect { fill: #3c3489; stroke: #afa9ec; } .morado .s { fill: #eeedfe; }
  .rojo rect { fill: #791f1f; stroke: #f09595; } .rojo .s { fill: #fcebeb; }
  .flecha, .punta { stroke: #9198a1; }
  .guia, .eje { stroke: #6e7681; }
  .sin-canto { stroke: #9198a1; }
}
</style>`;

const documento = (id, alto, t, cuerpo) => `<svg xmlns="http://www.w3.org/2000/svg" xml:lang="${id}" width="680" height="${alto}" viewBox="0 0 680 ${alto}" role="img" aria-labelledby="titulo desc">
<title id="titulo">${xml(t.titulo)}</title>
<desc id="desc">${xml(t.desc)}</desc>
${estilo(id)}
<defs><marker id="punta" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path class="punta" d="M2 1L8 5L2 9"/></marker></defs>
<rect class="fondo" x="0.5" y="0.5" width="679" height="${alto - 1}" rx="12"/>
${cuerpo.flat().join('\n')}
</svg>
`;

/** Una fila de leyendas centrada: cada una, su muestra y su texto. */
function leyenda(y, elementos) {
  const anchos = elementos.map((e) => e.ancho + 8 + estimar(e.texto, 12));
  let x = Math.round(340 - (anchos.reduce((a, b) => a + b, 0) + 40 * (elementos.length - 1)) / 2);
  return elementos.map((e, i) => {
    const g = `<g data-leyenda="">${e.muestra(x, y)}<text class="e" x="${x + e.ancho + 8}" y="${y}" dominant-baseline="central">${xml(e.texto)}</text></g>`;
    x += Math.round(anchos[i]) + 40;
    return g;
  });
}

/** El recorrido entero: qué pieza hace qué y de dónde sale cada cosa. */
function flujo(id, t) {
  const caja = (clase, x, y, ancho, [titulo, sub]) => `<g class="${clase}" data-caja="">
<rect x="${x}" y="${y}" width="${ancho}" height="56" rx="8"/>
<text class="t" x="${x + ancho / 2}" y="${y + 19}" text-anchor="middle" dominant-baseline="central">${xml(titulo)}</text>
<text class="s" x="${x + ancho / 2}" y="${y + 39}" text-anchor="middle" dominant-baseline="central">${xml(sub)}</text>
</g>`;
  // El audio va a Whisper y a Demucs; la letra y lo que oyó Whisper se casan letra a letra, y eso da a narabas la zona de
  // cada verso, que busca sobre la voz sola. Sin la voz, lo casado va directo a letra.ts, y si apenas casa, pasa por
  // Claude. Ninguna flecha cruza una caja.
  const flechas = ['M540 96 V122 H340 V148', 'M540 96 V148', 'M140 96 V258', 'M340 206 V232 H240 V258', 'M540 206 V258', 'M280 288 H398', 'M520 316 V342 H400 V368', 'M200 316 V342 H280 V368', 'M100 316 V368', 'M190 398 H218', 'M340 426 V478'];
  const cuadro = (clase) => (x, y) => `<g class="${clase}"><rect x="${x}" y="${y - 6}" width="12" height="12" rx="3"/></g>`;
  return documento(id, 600, t, [
    caja('gris', 40, 40, 200, t.letra),
    caja('gris', 440, 40, 200, t.audio),
    flechas.map((d) => `<path class="flecha" d="${d}" marker-end="url(#punta)"/>`),
    caja('verde', 240, 150, 200, t.whisper),
    caja('verde', 460, 150, 160, t.demucs),
    caja('verde', 40, 260, 240, t.casar),
    caja('verde', 400, 260, 240, t.narabas),
    caja('coral', 20, 370, 170, t.claude),
    caja('verde', 220, 370, 240, t.letrats),
    caja('gris', 240, 480, 200, t.pista),
    leyenda(566, [
      { ancho: 12, muestra: cuadro('verde'), texto: t.leyenda[0] },
      { ancho: 12, muestra: cuadro('coral'), texto: t.leyenda[1] },
    ]),
  ]);
}

/** Un verso que Whisper no oyó, antes y después de tener en cuenta dónde se canta. */
function voz(id, t) {
  const X = (s) => 160 + 20 * s;
  const tramos = Array.from({ length: 12 }, (_, k) => `<rect class="${k < 6 || k >= 10 ? 'canto' : 'sin-canto'}" x="${X(2 * k) + 2}" y="56" width="36" height="16" rx="3"/>`);
  const bloque = (clase, desde, y, n) => `<g class="${clase}" data-caja="">
<rect x="${X(desde) + 1}" y="${y}" width="78" height="28" rx="4"/>
<text class="s" x="${X(desde) + 40}" y="${y + 14}" text-anchor="middle" dominant-baseline="central">${xml(t.verso(n))}</text>
</g>`;
  return documento(id, 310, t, [
    `<text class="e" x="${X(16)}" y="40" text-anchor="middle" dominant-baseline="central">${xml(t.pasaje)}</text>`,
    [64, 106, 160, 210].map((y, i) => `<text class="e" x="148" y="${y}" text-anchor="end" dominant-baseline="central">${xml(t.filas[i])}</text>`),
    `<g>${tramos.join('')}</g>`,
    [12, 20].map((s) => `<line class="guia" x1="${X(s)}" y1="80" x2="${X(s)}" y2="232"/>`),
    bloque('gris', 0, 92, 1),
    bloque('gris', 4, 92, 2),
    bloque('gris', 20, 92, 4),
    bloque('rojo', 16, 146, 3),
    bloque('morado', 8, 196, 3),
    `<line class="eje" x1="${X(0)}" y1="246" x2="${X(24)}" y2="246"/>`,
    [0, 4, 8, 12, 16, 20, 24].map((s) => `<line class="eje" x1="${X(s)}" y1="246" x2="${X(s)}" y2="251"/>
<text class="e" x="${X(s)}" y="264" text-anchor="middle" dominant-baseline="central">${xml(t.segundos(s))}</text>`),
    leyenda(288, [
      { ancho: 20, muestra: (x, y) => `<rect class="canto" x="${x}" y="${y - 5}" width="20" height="10" rx="2"/>`, texto: t.leyenda[0] },
      { ancho: 20, muestra: (x, y) => `<g><rect class="sin-canto" x="${x}" y="${y - 5}" width="20" height="10" rx="2"/></g>`, texto: t.leyenda[1] },
    ]),
  ]);
}

mkdirSync(SALIDA, { recursive: true });
const archivos = [];
for (const [id, t] of Object.entries(TEXTOS)) {
  const sufijo = id === 'es' ? '' : `.${id}`;
  for (const [nombre, dibujo, textos] of [['letra-flujo', flujo, t.flujo], ['letra-voz', voz, t.voz]]) {
    const archivo = join(SALIDA, `${nombre}${sufijo}.svg`);
    writeFileSync(archivo, dibujo(id, textos));
    archivos.push(archivo);
  }
}

// Medir de verdad: una caja que se queda corta en un idioma no se ve hasta que alguien abre ese documento.
const navegador = await chromium.launch({ channel: process.env.KK_CANAL ?? 'msedge', headless: true, args: ['--mute-audio'] });
const pagina = await navegador.newPage({ deviceScaleFactor: 2 });
const errores = [];
for (const archivo of archivos) {
  await pagina.goto(pathToFileURL(archivo).href);
  const fallos = await pagina.evaluate(async () => {
    await document.fonts?.ready;
    const svg = document.documentElement;
    const { width: ancho, height: alto } = svg.viewBox.baseVal;
    const salida = [];
    for (const g of svg.querySelectorAll('[data-caja]')) {
      const caja = g.querySelector('rect').getBBox();
      for (const texto of g.querySelectorAll('text')) {
        const b = texto.getBBox();
        if (b.x < caja.x + 8 || b.x + b.width > caja.x + caja.width - 8) salida.push(`«${texto.textContent}» no cabe en su caja: ${Math.ceil(b.width)} px de ${caja.width - 16}`);
      }
    }
    for (const texto of svg.querySelectorAll('text')) {
      const b = texto.getBBox();
      if (b.x < 10 || b.x + b.width > ancho - 10 || b.y < 6 || b.y + b.height > alto - 6) salida.push(`«${texto.textContent}» se sale de la tarjeta`);
    }
    const leyendas = [...svg.querySelectorAll('[data-leyenda]')].map((g) => g.getBBox());
    for (let i = 1; i < leyendas.length; i++) {
      if (leyendas[i].x < leyendas[i - 1].x + leyendas[i - 1].width + 16) salida.push('las leyendas se pisan');
    }
    return salida;
  });
  errores.push(...fallos.map((f) => `${basename(archivo)}: ${f}`));
}

if (process.env.KK_VISTAS) {
  const carpeta = resolve(process.env.KK_VISTAS);
  mkdirSync(carpeta, { recursive: true });
  await pagina.goto('about:blank'); // setContent no puede reescribir el documento SVG que se acaba de medir
  for (const archivo of archivos) {
    const svg = readFileSync(archivo, 'utf8');
    const alto = Number(svg.match(/height="(\d+)"/)[1]);
    for (const esquema of ['light', 'dark']) {
      // Como en GitHub: el SVG va de imagen sobre la página, con su color de fondo.
      await pagina.emulateMedia({ colorScheme: esquema });
      await pagina.setViewportSize({ width: 712, height: alto + 32 });
      await pagina.setContent(`<!doctype html><body style="margin:0;padding:16px;background:${esquema === 'dark' ? '#0d1117' : '#ffffff'}"><img width="680" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></body>`);
      await pagina.waitForFunction(() => document.images[0].complete);
      await pagina.screenshot({ path: join(carpeta, `${basename(archivo, '.svg')}.${esquema}.png`) });
    }
  }
}
await navegador.close();

for (const archivo of archivos) console.log(archivo.slice(RAIZ.length + 1).replaceAll('\\', '/'));
if (errores.length) {
  for (const e of errores) console.error(`✗ ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✓ ${archivos.length} diagramas: cada texto cabe en su caja`);
}
