<p align="right"><a href="../../AVISOS.md">Español · English</a> · <a href="../de/notices.md">Deutsch</a> · <a href="../zh/notices.md">简体中文</a> · <a href="../ko/notices.md">한국어</a> · <b>日本語</b></p>

# 告知

参考訳です。[AVISOS.md](../../AVISOS.md) の原文が優先します。

## プロジェクトのライセンス

Kotonoha のコードは [MIT ライセンス](../../LICENSE)で公開しています。第三者のコンポーネントはそれぞれのライセンスに従います。

## 第三者のコンポーネント

| コンポーネント | 用途 | ライセンス |
|---|---|---|
| [Preact](https://preactjs.com) と Preact Signals | 画面 | MIT |
| [Dexie](https://dexie.org) | ローカルデータベース | Apache-2.0 |
| [ProseMirror](https://prosemirror.net) | ノートのエディター | MIT |
| [Kuromoji](https://github.com/takuyaa/kuromoji.js) | 形態素解析、IPADIC 辞書を使用 | Apache-2.0 と IPADIC 独自のライセンス |
| [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript) | Claude API のクライアント | Apache-2.0 |
| [Transformers.js](https://github.com/huggingface/transformers.js) と [ONNX Runtime](https://onnxruntime.ai) | Whisper の実行 | Apache-2.0 と MIT |
| [Whisper large-v3-turbo](https://huggingface.co/onnx-community/whisper-large-v3-turbo) | 文字起こしのモデル、使用時にダウンロード | MIT |
| [Haas-ja-v1.0](https://huggingface.co/third-intelligence/Haas-ja-v1.0)、Third Intelligence 作、[Sanami による ONNX 変換](https://huggingface.co/Sanami/haas-ja-onnx) | 日本語の文字起こしモデル、使用時にダウンロード | Apache-2.0 |
| [Parakeet TDT 0.6B v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3)、NVIDIA 作、[istupakov](https://huggingface.co/istupakov/parakeet-tdt-0.6b-v3-onnx) と [ysdede](https://huggingface.co/ysdede/parakeet-tdt-0.6b-v3-onnx) による ONNX 変換 | 英語とドイツ語の文字起こしモデル、使用時にダウンロード | CC-BY-4.0 |
| [PP-OCRv5](https://github.com/PaddlePaddle/PaddleOCR)、PaddlePaddle 製、[nakamura196 による ONNX 変換](https://huggingface.co/nakamura196/ppocrv5-mobile-web-onnx) | 本の文字行の検出。使うときにダウンロード | Apache-2.0 |
| [PP-OCRv6 small](https://huggingface.co/PaddlePaddle/PP-OCRv6_small_rec_onnx)、PaddlePaddle 製 | 本の文字認識。使うときにダウンロード。辞書は拡張機能に同梱（`modelos/`） | Apache-2.0 |
| [manga-ocr](https://github.com/kha-white/manga-ocr)、kha-white 製、[onnx-community による ONNX 変換](https://huggingface.co/onnx-community/manga-ocr-base-ONNX)、および [ogkalu の吹き出し検出器](https://huggingface.co/ogkalu/comic-text-and-bubble-detector) | 漫画の文字認識。使うときにダウンロード | Apache-2.0 |
| [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M)、hexgrad 製、[onnx-community による ONNX 変換](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX)、および [Thorsten の声](https://huggingface.co/rhasspy/piper-voices)の [Piper](https://github.com/rhasspy/piper) | 英語とドイツ語のニューラル音声、使うときにダウンロード | Apache-2.0 と MIT。Thorsten の声は CC0 のデータセットで学習 |
| [narabas](https://github.com/darashi/narabas)、darashi 製、ReazonSpeech コーパスで学習した[モデル](https://github.com/darashi/narabas-models/releases/tag/v0) | アクセントの練習でモーラを確認する日本語の音素モデル。ツール自体と同じく、使うときに作者の公開ページからダウンロード。Kotonoha は再配布しない | ツールは MIT。モデルは独自のライセンスなしで公開 |
| [AivisHub の音声](https://hub.aivis-project.com)（Style-Bert-VITS2 JP-Extra）、ku-nlp の BERT [DeBERTa-v2-large-japanese-char-wwm](https://huggingface.co/ku-nlp/deberta-v2-large-japanese-char-wwm)（[tsukumijima による ONNX 変換](https://huggingface.co/tsukumijima/deberta-v2-large-japanese-char-wwm-onnx)）、[yomi の形式](https://huggingface.co/datasets/hdae/yomi-dict)の辞書 [naist-jdic](https://github.com/jpreprocess/naist-jdic) | 日本語のニューラル音声。設定の「音声」からインストールするときにダウンロードし、Kotonoha は再配布しない | 音声ごとのライセンス（インストール前に表示：ACML 1.0、ACML-NC 1.0、CC0、独自）。BERT は CC BY-SA 4.0、辞書は BSD-3-Clause |
| [yomi](https://jsr.io/@hdae/yomi) 0.4.2 | AivisHub の音声のための読み、アクセント、アクセント句。src/lenguas/japones/voz/yomi に LICENSE と NOTICE ごと取り込み | MIT |
| [pinyin-pro](https://github.com/zh-lx/pinyin-pro) | 中国語の文脈に応じたピンイン：一つの漢字の読み（长 の cháng と zhǎng）から、その文での読みを選ぶ | MIT |
| [opencc-js](https://github.com/nk2028/opencc-js)、[OpenCC](https://github.com/BYVoid/OpenCC) の変換表（`opencc-data`）とともに | 繁体字の字幕トラックと Whisper の書き起こしを簡体字に変換。告知は `licencias/AVISO-opencc.txt` | コードは MIT、変換表は Apache-2.0 |
| [krmanik/HSK-3.0](https://github.com/krmanik/HSK-3.0)（Mani 氏）の HSK リスト。2025 年版 HSK 大綱によるもので、[CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cc-cedict) のピンインと訳を付けています | HSK 画面の各級の語彙・漢字・文法（`datos/hsk`）。`herramientas/hsk.mjs` で作成し、文法の説明は本プロジェクト独自のもの | CC BY-SA 4.0（派生したリストも） |
| [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm)、`@ffmpeg/ffmpeg` | 手元のファイルの読み取り | MIT |
| [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm)、`@ffmpeg/core` | FFmpeg のコア、コンパイル時にコピー | GPL-2.0-or-later |
| [piper-phonemize](https://github.com/rhasspy/piper-phonemize) と [eSpeak NG](https://github.com/espeak-ng/espeak-ng)、`@diffusionstudio/piper-wasm` | ニューラル音声の音素、コンパイル時に英語とドイツ語の辞書だけを入れてコピー | MIT と GPL-3.0-or-later |
| [lamejs](https://github.com/gideonstele/lamejs)、`@breezystack/lamejs` | MP3 のエンコード | LGPL-3.0 |
| [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) | 復習の計画 | MIT |
| [fflate](https://github.com/101arrowz/fflate) | ZIP ファイルの読み取り | MIT |
| [pdf.js](https://github.com/mozilla/pdf.js)、`pdfjs-dist` | ビューアーでの PDF の読み取り。PDFium の JBIG2 デコーダー（BSD-3-Clause）、OpenJPEG（BSD-2-Clause）、qcms（MIT）を含む | Apache-2.0 |
| [wink-nlp](https://github.com/winkjs/wink-nlp) | 英語の形態素解析 | MIT |
| [wink-eng-lite-web-model](https://github.com/winkjs/wink-eng-lite-web-model) | wink-nlp 用の英語モデル | MIT |
| [Phosphor Icons](https://phosphoricons.com) | アイコン | MIT |
| [Nunito](https://fonts.google.com/specimen/Nunito) と [Zen Maru Gothic](https://fonts.google.com/specimen/Zen+Maru+Gothic) | フォント | OFL-1.1 |

このリポジトリのコードに第三者のバイナリは含まれません。インストール時に npm から取得します。`dist` フォルダと各バージョンのコンパイル済みパッケージには `@ffmpeg/core`、`lamejs`、eSpeak NG が含まれ、`licencias` フォルダにすべてのコンポーネントの文書と告知があります。

対応するソースコードは [ffmpeg.wasm v0.12.10](https://github.com/ffmpegwasm/ffmpeg.wasm/tree/v0.12.10)（ライブラリとともに [FFmpeg n5.1.4](https://github.com/FFmpeg/FFmpeg/tree/n5.1.4) をコンパイル）と [lamejs](https://github.com/gideonstele/lamejs) にあります。これらのパッケージを再配布する場合は、そのソースコードの提供を含め、GPL と LGPL に従う必要があります。

## 拡張機能の使用時にダウンロードするデータ

これらのデータはいずれもリポジトリに含まれません。拡張機能が必要に応じてダウンロードします。

| データ | 出所 | 条件 |
|---|---|---|
| JMdict、JMnedict、KANJIDIC | [EDRDG](https://www.edrdg.org/edrdg/licence.html)、[jmdict-yomitan](https://github.com/yomidevs/jmdict-yomitan) の形式 | CC BY-SA 4.0 |
| ピッチアクセントと漢字辞典 | Uros O. 氏の [Kanjium](https://github.com/mifunetoshiro/kanjium)：アクセント表記、音符、同訓異字、および EDICT、KANJIDIC、KRADFILE へのその他の追加・変更は同氏のフリーデータベースによるもので、それ以外は EDRDG のものです。中国語の読みは CC-CEDICT、韓国語の読みは libhangul（Choe Hwanjin、三条項 BSD）によります | CC BY-SA 4.0 |
| 頻度 | [JPDB](https://jpdb.io)、[yomitan-dictionaries](https://github.com/Kuuuube/yomitan-dictionaries) の形式 | プロジェクトの定めるとおり |
| 書き順 | [KanjiVG](https://kanjivg.tagaini.net)、Ulrich Apel、jsDelivr が配信する元のファイル（ない場合はプロジェクトの GitHub リポジトリから取得） | CC BY-SA 3.0 |
| 中国語の書き順 | David Chanin 氏の [Hanzi Writer](https://github.com/chanind/hanzi-writer-data)。Shaunak Kishore 氏の [Make Me a Hanzi](https://github.com/skishore/makemeahanzi) をもとに、Arphic フォントの字画を使っています。jsDelivr から、応答がなければ unpkg から配信 | Arphic Public License |
| 漢字辞書（中国語） | Shaunak Kishore 氏の [Make Me a Hanzi](https://github.com/skishore/makemeahanzi)。Unihan と CJKlib をもとにしたもので、GitHub からダウンロード | LGPL-3.0 |
| 単語の音声 | JapanesePod101 と [Lingua Libre](https://lingualibre.org) | 各出所の条件 |
| 画像 | [Openverse](https://openverse.org) | 各画像のライセンス |
| 英語とドイツ語の辞書と発音、中国語の短い訳語 | [Wiktionary](https://www.wiktionary.org)。[kaikki.org](https://kaikki.org) をもとに [wiktionary-to-yomitan](https://github.com/yomidevs/wiktionary-to-yomitan) が整形し、Hugging Face から配信 | CC BY-SA 4.0 |
| CC-CEDICT | [MDBG](https://www.mdbg.net/chinese/dictionary?page=cc-cedict)、[cc-cedict-yomitan](https://github.com/MarvNC/cc-cedict-yomitan) の形式で、GitHub に毎日公開 | CC BY-SA 4.0 |
| 英語、ドイツ語、中国語の頻度 | Hermit Dave の [FrequencyWords](https://github.com/hermitdave/FrequencyWords)、OpenSubtitles に基づく | CC BY-SA 4.0 |
| 英語、ドイツ語、中国語の単語の音声 | Wikimedia Commons、[Lingua Libre](https://lingualibre.org) | 各録音の条件 |

## 外部プログラム

ローカルヘルパーは [yt-dlp](https://github.com/yt-dlp/yt-dlp)（Unlicense）と [QuickJS-NG](https://github.com/quickjs-ng/quickjs)（MIT）を使います。どちらもインストーラーが GitHub の公式ページからダウンロードし、SHA-256 を確認します。パソコンに [FFmpeg](https://ffmpeg.org)（ビルドにより LGPL または GPL）がインストールされていれば、それも使います。いずれもこのリポジトリやパッケージには含まれません。

## 責任ある利用

Kotonoha は個人利用の学習ツールです。

- コピー防止の仕組みを回避しません。プレーヤーがユーザーのセッションにすでに提供している字幕を読み取ります。
- ローカルヘルパーは、ユーザーがダウンロードする権利を持つコンテンツにのみ、各サイトの規約を守って使ってください。
- 各動画サービスの利用規約を守ることはユーザーの責任です。
- 字幕やその他の著作物は著作権で保護されている場合があり、許可なく再配布してはいけません。

## 商標

YouTube、Netflix、Disney+、Crunchyroll、Viki、Bilibili、iQIYI、Prime Video、Anki、Claude、Anthropic は各所有者の商標です。このプロジェクトは独立しており、これらと提携せず、後援や保証も受けていません。
