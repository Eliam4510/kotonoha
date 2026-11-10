<p align="right"><a href="../../AVISOS.md">Español · English</a> · <a href="../de/notices.md">Deutsch</a> · <b>简体中文</b> · <a href="../ko/notices.md">한국어</a> · <a href="../ja/notices.md">日本語</a></p>

# 声明

本译文仅供参考，以 [AVISOS.md](../../AVISOS.md) 中的原文为准。

## 项目许可证

Kotonoha 的代码以 [MIT 许可证](../../LICENSE)发布。第三方组件保留各自的许可证。

## 第三方组件

| 组件 | 用途 | 许可证 |
|---|---|---|
| [Preact](https://preactjs.com) 和 Preact Signals | 界面 | MIT |
| [Dexie](https://dexie.org) | 本地数据库 | Apache-2.0 |
| [ProseMirror](https://prosemirror.net) | 笔记本的编辑器 | MIT |
| [Kuromoji](https://github.com/takuyaa/kuromoji.js) | 形态分析，使用 IPADIC 词典 | Apache-2.0，以及 IPADIC 自身的许可证 |
| [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript) | Claude API 客户端 | Apache-2.0 |
| [Transformers.js](https://github.com/huggingface/transformers.js) 和 [ONNX Runtime](https://onnxruntime.ai) | 运行 Whisper | Apache-2.0 和 MIT |
| [Whisper large-v3-turbo](https://huggingface.co/onnx-community/whisper-large-v3-turbo) | 转录模型，使用时下载 | MIT |
| [Haas-ja-v1.0](https://huggingface.co/third-intelligence/Haas-ja-v1.0)，Third Intelligence 出品，使用 [Sanami 的 ONNX 转换版](https://huggingface.co/Sanami/haas-ja-onnx) | 日语转录模型，使用时下载 | Apache-2.0 |
| [Parakeet TDT 0.6B v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3)，NVIDIA 出品，使用 [istupakov](https://huggingface.co/istupakov/parakeet-tdt-0.6b-v3-onnx) 和 [ysdede](https://huggingface.co/ysdede/parakeet-tdt-0.6b-v3-onnx) 的 ONNX 转换版 | 英语和德语转录模型，使用时下载 | CC-BY-4.0 |
| [PP-OCRv5](https://github.com/PaddlePaddle/PaddleOCR)，PaddlePaddle 出品，使用 [nakamura196 的 ONNX 转换](https://huggingface.co/nakamura196/ppocrv5-mobile-web-onnx) | 书籍文字行的检测，使用时下载 | Apache-2.0 |
| [PP-OCRv6 small](https://huggingface.co/PaddlePaddle/PP-OCRv6_small_rec_onnx)，PaddlePaddle 出品 | 书籍的文字识别，使用时下载；字典随扩展程序附带（`modelos/`） | Apache-2.0 |
| [manga-ocr](https://github.com/kha-white/manga-ocr)，kha-white 出品，使用 [onnx-community 的 ONNX 转换](https://huggingface.co/onnx-community/manga-ocr-base-ONNX)，以及 [ogkalu 的对话框检测器](https://huggingface.co/ogkalu/comic-text-and-bubble-detector) | 漫画的文字识别，使用时下载 | Apache-2.0 |
| [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M)，hexgrad 出品，使用 [onnx-community 的 ONNX 转换](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX)，以及带 [Thorsten 声音](https://huggingface.co/rhasspy/piper-voices)的 [Piper](https://github.com/rhasspy/piper) | 英语和德语的神经网络语音，使用时下载 | Apache-2.0 和 MIT；Thorsten 的声音用 CC0 数据集训练 |
| [narabas](https://github.com/darashi/narabas)，darashi 出品，及其用 ReazonSpeech 语料库训练的[模型](https://github.com/darashi/narabas-models/releases/tag/v0) | 日语音素模型，用于在音调重音练习中检查音拍；使用时从作者的发布下载，与该工具本身的做法相同；Kotonoha 不再分发 | 工具为 MIT；模型发布时未附带自己的许可证 |
| [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm)，`@ffmpeg/ffmpeg` | 读取本地文件 | MIT |
| [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm)，`@ffmpeg/core` | FFmpeg 核心，编译时复制 | GPL-2.0-or-later |
| [piper-phonemize](https://github.com/rhasspy/piper-phonemize) 与 [eSpeak NG](https://github.com/espeak-ng/espeak-ng)，`@diffusionstudio/piper-wasm` | 神经网络语音的音素，编译时复制，只含英语和德语词典 | MIT 和 GPL-3.0-or-later |
| [lamejs](https://github.com/gideonstele/lamejs)，`@breezystack/lamejs` | MP3 编码 | LGPL-3.0 |
| [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) | 复习计划 | MIT |
| [fflate](https://github.com/101arrowz/fflate) | 读取 ZIP 文件 | MIT |
| [pdf.js](https://github.com/mozilla/pdf.js)，`pdfjs-dist` | 在查看器中读取 PDF，包括 PDFium 的 JBIG2 解码器（BSD-3-Clause）、OpenJPEG（BSD-2-Clause）和 qcms（MIT） | Apache-2.0 |
| [wink-nlp](https://github.com/winkjs/wink-nlp) | 英语形态分析 | MIT |
| [wink-eng-lite-web-model](https://github.com/winkjs/wink-eng-lite-web-model) | wink-nlp 的英语模型 | MIT |
| [Phosphor Icons](https://phosphoricons.com) | 图标 | MIT |
| [Nunito](https://fonts.google.com/specimen/Nunito) 和 [Zen Maru Gothic](https://fonts.google.com/specimen/Zen+Maru+Gothic) | 字体 | OFL-1.1 |

本仓库的代码不包含第三方二进制文件：它们在安装时从 npm 获取。`dist` 文件夹和每个版本的编译包确实包含 `@ffmpeg/core`、`lamejs` 和 eSpeak NG，并在 `licencias` 文件夹中附有所有组件的文本和声明。

相应的源代码位于 [ffmpeg.wasm v0.12.10](https://github.com/ffmpegwasm/ffmpeg.wasm/tree/v0.12.10)（用其库编译 [FFmpeg n5.1.4](https://github.com/FFmpeg/FFmpeg/tree/n5.1.4)）和 [lamejs](https://github.com/gideonstele/lamejs)。重新分发这些包的人必须遵守 GPL 和 LGPL，包括提供这些源代码。

## 使用扩展时下载的数据

这些数据都不属于本仓库。扩展按需下载。

| 数据 | 来源 | 条件 |
|---|---|---|
| JMdict、JMnedict 和 KANJIDIC | [EDRDG](https://www.edrdg.org/edrdg/licence.html)，[jmdict-yomitan](https://github.com/yomidevs/jmdict-yomitan) 格式 | CC BY-SA 4.0 |
| 音调重音和汉字词典 | [Kanjium](https://github.com/mifunetoshiro/kanjium)，作者 Uros O.：音调标记、声旁、同训字以及对 EDICT、KANJIDIC 和 KRADFILE 的其他增补和修改来自他的自由数据库，其余部分属于 EDRDG。汉语读音来自 CC-CEDICT，韩语读音来自 libhangul（Choe Hwanjin，BSD 三条款许可） | CC BY-SA 4.0 |
| 频率 | [JPDB](https://jpdb.io)，[yomitan-dictionaries](https://github.com/Kuuuube/yomitan-dictionaries) 格式 | 以该项目的说明为准 |
| 笔顺 | [KanjiVG](https://kanjivg.tagaini.net)，作者 Ulrich Apel，原始文件由 jsDelivr 提供；它没有的文件由该项目的 GitHub 仓库提供 | CC BY-SA 3.0 |
| 单词音频 | JapanesePod101 和 [Lingua Libre](https://lingualibre.org) | 以各来源为准 |
| 图片 | [Openverse](https://openverse.org) | 以每张图片的许可证为准 |
| 英语和德语词典和发音 | [Wiktionary](https://www.wiktionary.org)，由 [wiktionary-to-yomitan](https://github.com/yomidevs/wiktionary-to-yomitan) 根据 [kaikki.org](https://kaikki.org) 整理，从 Hugging Face 提供 | CC BY-SA 4.0 |
| 英语和德语频率 | Hermit Dave 的 [FrequencyWords](https://github.com/hermitdave/FrequencyWords)，基于 OpenSubtitles | CC BY-SA 4.0 |
| 英语和德语单词音频 | Wikimedia Commons 和 [Lingua Libre](https://lingualibre.org) | 各录音的条款 |

## 外部程序

本地助手使用 [yt-dlp](https://github.com/yt-dlp/yt-dlp)（Unlicense）和 [QuickJS-NG](https://github.com/quickjs-ng/quickjs)（MIT），由其安装程序从它们在 GitHub 上的官方页面下载并校验 SHA-256；如果电脑上装有 [FFmpeg](https://ffmpeg.org)（LGPL 或 GPL，取决于编译方式），也会使用它。它们都不包含在本仓库及其软件包中。

## 负责任的使用

Kotonoha 是供个人使用的学习工具。

- 它不规避复制保护系统。它读取播放器已提供给用户会话的字幕。
- 本地助手只应用于用户有权下载的内容，并遵守各网站的条款。
- 遵守各视频服务的使用条款是用户的责任。
- 字幕和其他作品可能受版权保护，未经许可不得重新分发。

## 商标

YouTube、Netflix、Disney+、Crunchyroll、Viki、Bilibili、iQIYI、Prime Video、Anki、Claude 和 Anthropic 是其各自所有者的商标。本项目是独立的，与它们没有隶属、赞助或认可关系。
