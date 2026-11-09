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
| [Kuromoji](https://github.com/takuyaa/kuromoji.js) | 形態素解析、IPADIC 辞書を使用 | Apache-2.0 と IPADIC 独自のライセンス |
| [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript) | Claude API のクライアント | Apache-2.0 |
| [Transformers.js](https://github.com/huggingface/transformers.js) と [ONNX Runtime](https://onnxruntime.ai) | Whisper の実行 | Apache-2.0 と MIT |
| [Whisper large-v3-turbo](https://huggingface.co/onnx-community/whisper-large-v3-turbo) | 文字起こしのモデル、使用時にダウンロード | MIT |
| [Haas-ja-v1.0](https://huggingface.co/third-intelligence/Haas-ja-v1.0)、Third Intelligence 作、[Sanami による ONNX 変換](https://huggingface.co/Sanami/haas-ja-onnx) | 日本語の文字起こしモデル、使用時にダウンロード | Apache-2.0 |
| [Parakeet TDT 0.6B v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3)、NVIDIA 作、[istupakov](https://huggingface.co/istupakov/parakeet-tdt-0.6b-v3-onnx) と [ysdede](https://huggingface.co/ysdede/parakeet-tdt-0.6b-v3-onnx) による ONNX 変換 | 英語とドイツ語の文字起こしモデル、使用時にダウンロード | CC-BY-4.0 |
| [PP-OCRv5](https://github.com/PaddlePaddle/PaddleOCR)、PaddlePaddle 製、[nakamura196 による ONNX 変換](https://huggingface.co/nakamura196/ppocrv5-mobile-web-onnx) | 本の文字行の検出。使うときにダウンロード | Apache-2.0 |
| [PP-OCRv6 small](https://huggingface.co/PaddlePaddle/PP-OCRv6_small_rec_onnx)、PaddlePaddle 製 | 本の文字認識。使うときにダウンロード。辞書は拡張機能に同梱（`modelos/`） | Apache-2.0 |
| [manga-ocr](https://github.com/kha-white/manga-ocr)、kha-white 製、[onnx-community による ONNX 変換](https://huggingface.co/onnx-community/manga-ocr-base-ONNX)、および [ogkalu の吹き出し検出器](https://huggingface.co/ogkalu/comic-text-and-bubble-detector) | 漫画の文字認識。使うときにダウンロード | Apache-2.0 |
| [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm)、`@ffmpeg/ffmpeg` | 手元のファイルの読み取り | MIT |
| [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm)、`@ffmpeg/core` | FFmpeg のコア、コンパイル時にコピー | GPL-2.0-or-later |
| [lamejs](https://github.com/gideonstele/lamejs)、`@breezystack/lamejs` | MP3 のエンコード | LGPL-3.0 |
| [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) | 復習の計画 | MIT |
| [fflate](https://github.com/101arrowz/fflate) | ZIP ファイルの読み取り | MIT |
| [pdf.js](https://github.com/mozilla/pdf.js)、`pdfjs-dist` | ビューアーでの PDF の読み取り。PDFium の JBIG2 デコーダー（BSD-3-Clause）、OpenJPEG（BSD-2-Clause）、qcms（MIT）を含む | Apache-2.0 |
| [wink-nlp](https://github.com/winkjs/wink-nlp) | 英語の形態素解析 | MIT |
| [wink-eng-lite-web-model](https://github.com/winkjs/wink-eng-lite-web-model) | wink-nlp 用の英語モデル | MIT |
| [Phosphor Icons](https://phosphoricons.com) | アイコン | MIT |
| [Nunito](https://fonts.google.com/specimen/Nunito) と [Zen Maru Gothic](https://fonts.google.com/specimen/Zen+Maru+Gothic) | フォント | OFL-1.1 |

このリポジトリのコードに第三者のバイナリは含まれません。インストール時に npm から取得します。`dist` フォルダと各バージョンのコンパイル済みパッケージには `@ffmpeg/core` と `lamejs` が含まれ、`licencias` フォルダにすべてのコンポーネントの文書と告知があります。

対応するソースコードは [ffmpeg.wasm v0.12.10](https://github.com/ffmpegwasm/ffmpeg.wasm/tree/v0.12.10)（ライブラリとともに [FFmpeg n5.1.4](https://github.com/FFmpeg/FFmpeg/tree/n5.1.4) をコンパイル）と [lamejs](https://github.com/gideonstele/lamejs) にあります。これらのパッケージを再配布する場合は、そのソースコードの提供を含め、GPL と LGPL に従う必要があります。

## 拡張機能の使用時にダウンロードするデータ

これらのデータはいずれもリポジトリに含まれません。拡張機能が必要に応じてダウンロードします。

| データ | 出所 | 条件 |
|---|---|---|
| JMdict と JMnedict | [EDRDG](https://www.edrdg.org/edrdg/licence.html)、[jmdict-yomitan](https://github.com/yomidevs/jmdict-yomitan) の形式 | CC BY-SA 4.0 |
| ピッチアクセント | [Kanjium](https://github.com/mifunetoshiro/kanjium) | プロジェクトの定めるとおり |
| 頻度 | [JPDB](https://jpdb.io)、[yomitan-dictionaries](https://github.com/Kuuuube/yomitan-dictionaries) の形式 | プロジェクトの定めるとおり |
| 書き順 | [KanjiVG](https://kanjivg.tagaini.net)、Ulrich Apel、jsDelivr が配信する元のファイル | CC BY-SA 3.0 |
| 単語の音声 | JapanesePod101 と [Lingua Libre](https://lingualibre.org) | 各出所の条件 |
| 画像 | [Openverse](https://openverse.org) | 各画像のライセンス |
| 英語とドイツ語の辞書と発音 | [Wiktionary](https://www.wiktionary.org)。[kaikki.org](https://kaikki.org) をもとに [wiktionary-to-yomitan](https://github.com/yomidevs/wiktionary-to-yomitan) が整形し、Hugging Face から配信 | CC BY-SA 4.0 |
| 英語とドイツ語の頻度 | Hermit Dave の [FrequencyWords](https://github.com/hermitdave/FrequencyWords)、OpenSubtitles に基づく | CC BY-SA 4.0 |
| 英語とドイツ語の単語の音声 | Wikimedia Commons、[Lingua Libre](https://lingualibre.org) | 各録音の条件 |

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
