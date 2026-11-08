<p align="right"><a href="../../AVISOS.md">Español · English</a> · <a href="../de/notices.md">Deutsch</a> · <a href="../zh/notices.md">简体中文</a> · <b>한국어</b> · <a href="../ja/notices.md">日本語</a></p>

# 고지

참고용 번역입니다. [AVISOS.md](../../AVISOS.md)의 원문이 우선합니다.

## 프로젝트 라이선스

Kotonoha의 코드는 [MIT 라이선스](../../LICENSE)로 공개됩니다. 서드파티 구성 요소는 각자의 라이선스를 유지합니다.

## 서드파티 구성 요소

| 구성 요소 | 용도 | 라이선스 |
|---|---|---|
| [Preact](https://preactjs.com)와 Preact Signals | 인터페이스 | MIT |
| [Dexie](https://dexie.org) | 로컬 데이터베이스 | Apache-2.0 |
| [Kuromoji](https://github.com/takuyaa/kuromoji.js) | 형태소 분석, IPADIC 사전 사용 | Apache-2.0 및 IPADIC 자체 라이선스 |
| [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript) | Claude API 클라이언트 | Apache-2.0 |
| [Transformers.js](https://github.com/huggingface/transformers.js)와 [ONNX Runtime](https://onnxruntime.ai) | Whisper 실행 | Apache-2.0 및 MIT |
| [Whisper large-v3-turbo](https://huggingface.co/onnx-community/whisper-large-v3-turbo) | 전사 모델, 사용 시 다운로드 | MIT |
| [Haas-ja-v1.0](https://huggingface.co/third-intelligence/Haas-ja-v1.0), Third Intelligence 제작, [Sanami의 ONNX 변환](https://huggingface.co/Sanami/haas-ja-onnx) | 일본어 전사 모델, 사용할 때 다운로드 | Apache-2.0 |
| [Parakeet TDT 0.6B v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3), NVIDIA 제작, [istupakov](https://huggingface.co/istupakov/parakeet-tdt-0.6b-v3-onnx)와 [ysdede](https://huggingface.co/ysdede/parakeet-tdt-0.6b-v3-onnx)의 ONNX 변환 | 영어와 독일어 전사 모델, 사용할 때 다운로드 | CC-BY-4.0 |
| [PP-OCRv5](https://github.com/PaddlePaddle/PaddleOCR), PaddlePaddle 제작, [nakamura196의 ONNX 변환](https://huggingface.co/nakamura196/ppocrv5-mobile-web-onnx) | 책의 문자 인식, 사용할 때 내려받음 | Apache-2.0 |
| [manga-ocr](https://github.com/kha-white/manga-ocr), kha-white 제작, [onnx-community의 ONNX 변환](https://huggingface.co/onnx-community/manga-ocr-base-ONNX), 그리고 [ogkalu의 말풍선 감지기](https://huggingface.co/ogkalu/comic-text-and-bubble-detector) | 만화의 문자 인식, 사용할 때 내려받음 | Apache-2.0 |
| [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm), `@ffmpeg/ffmpeg` | 내 파일 읽기 | MIT |
| [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm), `@ffmpeg/core` | FFmpeg 코어, 컴파일 시 복사 | GPL-2.0-or-later |
| [lamejs](https://github.com/gideonstele/lamejs), `@breezystack/lamejs` | MP3 인코딩 | LGPL-3.0 |
| [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) | 복습 일정 | MIT |
| [fflate](https://github.com/101arrowz/fflate) | ZIP 파일 읽기 | MIT |
| [pdf.js](https://github.com/mozilla/pdf.js), `pdfjs-dist` | 뷰어에서 PDF 읽기, PDFium의 JBIG2 디코더(BSD-3-Clause), OpenJPEG(BSD-2-Clause), qcms(MIT) 포함 | Apache-2.0 |
| [wink-nlp](https://github.com/winkjs/wink-nlp) | 영어 형태소 분석 | MIT |
| [wink-eng-lite-web-model](https://github.com/winkjs/wink-eng-lite-web-model) | wink-nlp용 영어 모델 | MIT |
| [Phosphor Icons](https://phosphoricons.com) | 아이콘 | MIT |
| [Nunito](https://fonts.google.com/specimen/Nunito)와 [Zen Maru Gothic](https://fonts.google.com/specimen/Zen+Maru+Gothic) | 글꼴 | OFL-1.1 |

이 저장소의 코드에는 서드파티 바이너리가 없습니다. 설치할 때 npm에서 가져옵니다. `dist` 폴더와 각 버전의 컴파일된 패키지에는 `@ffmpeg/core`와 `lamejs`가 들어 있으며, `licencias` 폴더에 모든 구성 요소의 텍스트와 고지가 있습니다.

해당 소스 코드는 [ffmpeg.wasm v0.12.10](https://github.com/ffmpegwasm/ffmpeg.wasm/tree/v0.12.10)([FFmpeg n5.1.4](https://github.com/FFmpeg/FFmpeg/tree/n5.1.4)를 라이브러리와 함께 컴파일)과 [lamejs](https://github.com/gideonstele/lamejs)에 있습니다. 이 패키지를 재배포하는 사람은 해당 소스 코드 제공을 포함해 GPL과 LGPL을 준수해야 합니다.

## 확장 프로그램 사용 시 내려받는 데이터

이 데이터는 모두 저장소에 포함되지 않습니다. 확장 프로그램이 필요할 때 내려받습니다.

| 데이터 | 출처 | 조건 |
|---|---|---|
| JMdict와 JMnedict | [EDRDG](https://www.edrdg.org/edrdg/licence.html), [jmdict-yomitan](https://github.com/yomidevs/jmdict-yomitan) 형식 | CC BY-SA 4.0 |
| 고저 악센트 | [Kanjium](https://github.com/mifunetoshiro/kanjium) | 프로젝트가 명시한 조건 |
| 빈도 | [JPDB](https://jpdb.io), [yomitan-dictionaries](https://github.com/Kuuuube/yomitan-dictionaries) 형식 | 프로젝트가 명시한 조건 |
| 획순 | [KanjiVG](https://kanjivg.tagaini.net), Ulrich Apel, jsDelivr가 제공하는 원본 파일 | CC BY-SA 3.0 |
| 단어 오디오 | JapanesePod101과 [Lingua Libre](https://lingualibre.org) | 각 출처의 조건 |
| 이미지 | [Openverse](https://openverse.org) | 각 이미지의 라이선스 |
| 영어와 독일어 사전과 발음 | [Wiktionary](https://www.wiktionary.org), [kaikki.org](https://kaikki.org)를 바탕으로 [wiktionary-to-yomitan](https://github.com/yomidevs/wiktionary-to-yomitan)이 정리, Hugging Face에서 제공 | CC BY-SA 4.0 |
| 영어와 독일어 빈도 | Hermit Dave의 [FrequencyWords](https://github.com/hermitdave/FrequencyWords), OpenSubtitles 기반 | CC BY-SA 4.0 |
| 영어와 독일어 단어 오디오 | Wikimedia Commons, [Lingua Libre](https://lingualibre.org) | 각 녹음의 조건 |

## 외부 프로그램

로컬 도우미는 [yt-dlp](https://github.com/yt-dlp/yt-dlp)(Unlicense)와 [FFmpeg](https://ffmpeg.org)(빌드에 따라 LGPL 또는 GPL)를 사용합니다. 이 저장소나 패키지에 포함되지 않으며, 컴퓨터에 설치된 것을 사용합니다.

## 책임 있는 사용

Kotonoha는 개인 학습용 도구입니다.

- 복제 방지 시스템을 우회하지 않습니다. 플레이어가 사용자 세션에 이미 제공하는 자막을 읽습니다.
- 로컬 도우미는 사용자가 내려받을 권리가 있는 콘텐츠에만, 각 사이트의 약관을 지키며 사용해야 합니다.
- 각 영상 서비스의 이용 약관을 지키는 것은 사용자의 책임입니다.
- 자막과 그 밖의 저작물은 저작권으로 보호될 수 있으며 허가 없이 재배포해서는 안 됩니다.

## 상표

YouTube, Netflix, Disney+, Crunchyroll, Viki, Bilibili, iQIYI, Prime Video, Anki, Claude, Anthropic은 각 소유자의 상표입니다. 이 프로젝트는 독립적이며 이들과 제휴하거나 후원 또는 보증을 받지 않습니다.
