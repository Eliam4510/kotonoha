// El corpus con que se mide el acento de la voz neuronal del japonés: 60 frases de hoy, escritas para esto, y 150 de
// 『吾輩は猫である』 (Aozora Bunko, dominio público), con las frases acentuales que da AivisSpeech (pyopenjtalk-plus), que
// es la referencia: sus voces se entrenaron con ese análisis. Escribe src/lenguas/japones/voz/corpus-acento.json, que usa
// acento.test.ts. Necesita el motor de AivisSpeech abierto.
// Uso: node herramientas/corpus-acento.mjs [http://127.0.0.1:10101]

import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RAIZ = resolve(import.meta.dirname, '..');
const MOTOR = (process.argv[2] ?? 'http://127.0.0.1:10101').replace(/\/+$/, '');
const NOVELA = 'https://www.aozora.gr.jp/cards/000148/files/789_14547.html';

const MODERNAS = `今日はいい天気ですね。
明日の朝、駅の前で会いましょう。
このラーメン、めちゃくちゃおいしい！
宿題はもう終わったの？
電車が遅れているので、少し遅刻します。
日本語の勉強を始めてから二年になります。
週末は友達と映画を見に行く予定です。
ちょっと待って、財布を忘れちゃった。
彼女は毎朝六時に起きて走っている。
新しいスマホを買ったけど、使い方がよくわからない。
先生、質問してもいいですか？
雨が降りそうだから、傘を持っていったほうがいいよ。
この本はとても面白くて、一晩で読んでしまった。
お腹が空いたから、何か食べに行こう。
東京は人が多すぎて疲れる。
子供のころ、よくこの公園で遊んでいました。
会議は三時から始まる予定でしたが、延期になりました。
本当にありがとうございました。
気をつけて帰ってね。
来年こそ富士山に登りたいと思っている。
図書館で静かに勉強するのが好きです。
彼の言っていることは、さっぱり意味がわからない。
窓を開けてもいいですか？
昨日の夜、変な夢を見た。
駅までどのくらいかかりますか？
猫が机の上で寝ている。
母は料理がとても上手です。
試験に合格して、本当に嬉しかった。
もっとゆっくり話してください。
この町には古いお寺がたくさんあります。
春になると、桜がきれいに咲きます。
弟はゲームばかりしていて、全然勉強しない。
私の夢は世界中を旅することです。
すみません、トイレはどこですか？
仕事が忙しくて、なかなか休みが取れない。
将来、日本で働きたいと考えています。
冷蔵庫に牛乳が残っているか見てくれる？
夏休みに家族で海へ行きました。
あの人は誰だか知っていますか？
失敗を恐れずに挑戦することが大切だ。
部屋を片付けないと、お母さんに怒られるよ。
新幹線で大阪まで二時間半くらいです。
風邪をひいたみたいで、頭が痛い。
彼はいつも約束の時間に遅れてくる。
日本の文化について、もっと知りたいです。
コーヒーと紅茶、どっちがいい？
今度の土曜日、一緒に買い物に行かない？
この問題は思ったより難しかった。
空がだんだん暗くなってきた。
心配しないで、きっと大丈夫だから。
学校の近くに新しいカフェができたらしい。
自分の気持ちを言葉にするのは難しい。
電話番号を教えてもらえますか？
雪が積もって、道が真っ白になった。
お誕生日おめでとう！
私たちは同じ大学の出身です。
その映画は去年の冬に公開された。
犬の散歩に行ってきます。
疲れたから、今日は早く寝よう。
大切なのは、毎日少しずつ続けることです。`.split('\n');

/** 150 frases de la novela, repartidas por todo el texto: las de 8 a 45 caracteres, sin cifras ni letras latinas. */
async function frasesDeLaNovela() {
  const r = await fetch(NOVELA);
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${NOVELA}`);
  const html = new TextDecoder('shift_jis').decode(await r.arrayBuffer());
  const cuerpo = html.slice(html.indexOf('<div class="main_text">'), html.indexOf('<div class="bibliographical_information">'));
  const limpio = cuerpo
    .replace(/<rt>[^<]*<\/rt>|<rp>[^<]*<\/rp>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/［＃[^］]*］/g, '')
    .replace(/[「」『』\s]/g, '');
  const frases = limpio.split(/(?<=[。！？])/).filter((f) => f.length >= 8 && f.length <= 45 && !/[0-9０-９a-zA-Zａ-ｚＡ-Ｚ]/.test(f));
  const paso = Math.max(1, Math.floor(frases.length / 150));
  return frases.filter((_, i) => i % paso === 0).slice(0, 150);
}

/** Las frases acentuales de AivisSpeech: sus moras (sin la de la pausa) y su acento, como en la consulta de VOICEVOX. */
async function frasesDelMotor(texto, estilo) {
  const r = await fetch(`${MOTOR}/audio_query?speaker=${estilo}&text=${encodeURIComponent(texto)}`, { method: 'POST' });
  if (!r.ok) throw new Error(`audio_query ${r.status}`);
  const q = await r.json();
  return q.accent_phrases.map((f) => ({ m: f.moras.filter((m) => m.vowel !== 'pau').map((m) => m.text), a: f.accent }));
}

const version = await (await fetch(`${MOTOR}/version`)).json();
const [hablante] = await (await fetch(`${MOTOR}/speakers`)).json();
const estilo = hablante.styles[0].id;
const corpus = { fuente: `AivisSpeech Engine ${version}`, frases: [] };
for (const [grupo, lista] of [['moderna', MODERNAS], ['novela', await frasesDeLaNovela()]]) {
  for (const texto of lista) corpus.frases.push({ grupo, texto, frases: await frasesDelMotor(texto, estilo) });
}
const salida = join(RAIZ, 'src', 'lenguas', 'japones', 'voz', 'corpus-acento.json');
writeFileSync(salida, `${JSON.stringify(corpus, null, 0).replace(/\{"grupo"/g, '\n{"grupo"')}\n`);
console.log(`${corpus.frases.length} frases de ${corpus.fuente} en ${salida}`);
