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
| [Kuromoji](https://github.com/takuyaa/kuromoji.js) | 形态分析，使用 IPADIC 词典 | Apache-2.0，以及 IPADIC 自身的许可证 |
| [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript) | Claude API 客户端 | Apache-2.0 |
| [Transformers.js](https://github.com/huggingface/transformers.js) 和 [ONNX Runtime](https://onnxruntime.ai) | 运行 Whisper | Apache-2.0 和 MIT |
| [Whisper large-v3-turbo](https://huggingface.co/onnx-community/whisper-large-v3-turbo) | 转录模型，使用时下载 | MIT |
| [Haas-ja-v1.0](https://huggingface.co/third-intelligence/Haas-ja-v1.0)，Third Intelligence 出品，使用 [Sanami 的 ONNX 转换版](https://huggingface.co/Sanami/haas-ja-onnx) | 日语转录模型，使用时下载 | Apache-2.0 |
| [Parakeet TDT 0.6B v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3)，NVIDIA 出品，使用 [istupakov](https://huggingface.co/istupakov/parakeet-tdt-0.6b-v3-onnx) 和 [ysdede](https://huggingface.co/ysdede/parakeet-tdt-0.6b-v3-onnx) 的 ONNX 转换版 | 英语和德语转录模型，使用时下载 | CC-BY-4.0 |
| [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm)，`@ffmpeg/ffmpeg` | 读取本地文件 | MIT |
| [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm)，`@ffmpeg/core` | FFmpeg 核心，编译时复制 | GPL-2.0-or-later |
| [lamejs](https://github.com/gideonstele/lamejs)，`@breezystack/lamejs` | MP3 编码 | LGPL-3.0 |
| [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) | 复习计划 | MIT |
| [fflate](https://github.com/101arrowz/fflate) | 读取 ZIP 文件 | MIT |
| [wink-nlp](https://github.com/winkjs/wink-nlp) | 英语形态分析 | MIT |
| [wink-eng-lite-web-model](https://github.com/winkjs/wink-eng-lite-web-model) | wink-nlp 的英语模型 | MIT |
| [Phosphor Icons](https://phosphoricons.com) | 图标 | MIT |
| [Nunito](https://fonts.google.com/specimen/Nunito) 和 [Zen Maru Gothic](https://fonts.google.com/specimen/Zen+Maru+Gothic) | 字体 | OFL-1.1 |

本仓库的代码不包含第三方二进制文件：它们在安装时从 npm 获取。`dist` 文件夹和每个版本的编译包确实包含 `@ffmpeg/core` 和 `lamejs`，并在 `licencias` 文件夹中附有所有组件的文本和声明。

相应的源代码位于 [ffmpeg.wasm v0.12.10](https://github.com/ffmpegwasm/ffmpeg.wasm/tree/v0.12.10)（用其库编译 [FFmpeg n5.1.4](https://github.com/FFmpeg/FFmpeg/tree/n5.1.4)）和 [lamejs](https://github.com/gideonstele/lamejs)。重新分发这些包的人必须遵守 GPL 和 LGPL，包括提供这些源代码。

## 使用扩展时下载的数据

这些数据都不属于本仓库。扩展按需下载。

| 数据 | 来源 | 条件 |
|---|---|---|
| JMdict 和 JMnedict | [EDRDG](https://www.edrdg.org/edrdg/licence.html)，[jmdict-yomitan](https://github.com/yomidevs/jmdict-yomitan) 格式 | CC BY-SA 4.0 |
| 音调重音 | [Kanjium](https://github.com/mifunetoshiro/kanjium) | 以该项目的说明为准 |
| 频率 | [JPDB](https://jpdb.io)，[yomitan-dictionaries](https://github.com/Kuuuube/yomitan-dictionaries) 格式 | 以该项目的说明为准 |
| 笔顺 | [KanjiVG](https://kanjivg.tagaini.net)，作者 Ulrich Apel，原始文件由 jsDelivr 提供 | CC BY-SA 3.0 |
| 单词音频 | JapanesePod101 和 [Lingua Libre](https://lingualibre.org) | 以各来源为准 |
| 图片 | [Openverse](https://openverse.org) | 以每张图片的许可证为准 |
| 英语和德语词典和发音 | [Wiktionary](https://www.wiktionary.org)，由 [wiktionary-to-yomitan](https://github.com/yomidevs/wiktionary-to-yomitan) 根据 [kaikki.org](https://kaikki.org) 整理，从 Hugging Face 提供 | CC BY-SA 4.0 |
| 英语和德语频率 | Hermit Dave 的 [FrequencyWords](https://github.com/hermitdave/FrequencyWords)，基于 OpenSubtitles | CC BY-SA 4.0 |
| 英语和德语单词音频 | Wikimedia Commons 和 [Lingua Libre](https://lingualibre.org) | 各录音的条款 |

## 外部程序

本地助手使用 [yt-dlp](https://github.com/yt-dlp/yt-dlp)（Unlicense）和 [FFmpeg](https://ffmpeg.org)（LGPL 或 GPL，取决于编译方式）。它们不包含在本仓库及其软件包中：使用的是电脑上已安装的版本。

## 负责任的使用

Kotonoha 是供个人使用的学习工具。

- 它不规避复制保护系统。它读取播放器已提供给用户会话的字幕。
- 本地助手只应用于用户有权下载的内容，并遵守各网站的条款。
- 遵守各视频服务的使用条款是用户的责任。
- 字幕和其他作品可能受版权保护，未经许可不得重新分发。

## 商标

YouTube、Netflix、Disney+、Crunchyroll、Viki、Bilibili、iQIYI、Prime Video、Anki、Claude 和 Anthropic 是其各自所有者的商标。本项目是独立的，与它们没有隶属、赞助或认可关系。
