<p align="right"><a href="arquitectura.md">Español</a> · <b>English</b></p>

# Architecture

Kotonoha (言の葉, "leaves of words") is a Manifest V3 extension for learning Japanese from real video and text. This document describes how the work is divided among its parts, the main flows and the measurements behind the technical decisions. Code, identifiers and comments are in Spanish, so folder and file names are kept as they are.

## Overview

```mermaid
flowchart TB
  subgraph Pagina["Site page (MAIN world)"]
    AD["Adapters<br/>YouTube, Netflix, generic"]
  end
  subgraph Contenido["Content script (isolated world, Shadow DOM)"]
    UI["Bar, subtitles, navigator,<br/>word card, panels, shortcuts"]
    MODO["Playback modes<br/>and scene skipping"]
    WEB["Web page reader"]
  end
  subgraph SW["Service worker"]
    RUTA["Commands, capture permissions,<br/>image capture, event broadcast,<br/>bridge to the helper"]
  end
  subgraph Motor["Engine (offscreen document)"]
    TOK["Kuromoji tokenizer"]
    DIC["Dictionaries, accent, frequencies"]
    PAL["Words and statistics"]
    IA["Claude client"]
    ANKI["AnkiConnect"]
    REC["Audio recording and MP3"]
    WH["Whisper"]
    DB[("IndexedDB")]
  end
  subgraph Trabajador["Whisper worker"]
    GPU["Transformers.js and ONNX<br/>on WebGPU"]
  end
  subgraph App["Application window"]
    PANT["Home, dictionary, card creator, reader,<br/>library, player, memory, words, settings"]
    FF["ffmpeg.wasm for local files"]
  end
  AD <-->|postMessage| UI
  UI --> MODO
  UI <-->|RPC and ports| Motor
  UI <--> SW
  App <-->|RPC and ports| Motor
  App <--> SW
  SW <--> Motor
  SW <-->|Native Messaging| AY["Local helper<br/>yt-dlp and FFmpeg"]
  WH <--> GPU
  IA --> CL["Claude API"]
  ANKI --> AN["Anki"]
```

## Division of responsibilities

| Part | Responsibility | Reason |
|---|---|---|
| **Adapters (MAIN)** | Talking to each site's player: tracks, seeking, playback | `#movie_player` or `netflix` can only be reached from the page |
| **Content script** | The whole interface on top of the video | The isolated world and Shadow DOM prevent interference with the site in both directions |
| **Service worker** | APIs nothing else can use: commands, `tabCapture`, `captureVisibleTab`, `connectNative` | Chrome stops it when idle, so it holds no state |
| **Engine (offscreen)** | Tokenizer, database, Claude, Anki and recording | The heavy, long-running work. An offscreen document does not stop halfway through a response |
| **Whisper worker** | Loading the model and transcribing on the GPU | Very heavy, and it would block the engine. It is bundled separately and loaded only when used |
| **Local helper** | Downloading the audio of an online video | An extension cannot do this alone. Only the extension can call it, and it only accepts http or https addresses |
| **Application window** | Management screens and local player | A regular extension page that uses the same engine over RPC |
| **Core (`src/nucleo`)** | Pure logic: parsers, tokens, modes, statistics, grammar, synchronization, transcription and batches | No browser dependencies, tested with Vitest |

## Flow of a subtitle

1. The adapter detects the video and lists its tracks.
2. The content script chooses the Japanese track and the secondary one. Imported tracks take priority, and hand-made ones are preferred over automatic ones.
3. The adapter downloads the text with the page's session. This matters on YouTube, where addresses are signed by the player.
4. The core converts the format (TTML, WebVTT, SRT, ASS or json3) into timed lines.
5. The engine tokenizes, joins conjugations, computes furigana, accent, frequency and status for each word, and detects grammar with rules.
6. For an automatic track, Claude first corrects its recognition errors: analyzing text with errors would be wasted effort.
7. Claude reviews each new line in the background: it corrects readings, flags figurative use and confirms grammar. The result is stored per line and requested only once.
8. The interface paints each word: the text color shows the accent, and the underline, the learning status.

## Translation and correction with Claude

A whole video takes time to process, but what matters is the part being watched. So the work is divided into batches, starting with the batch at the playback position (`src/nucleo/lotes.ts`).

| | Translation | Correction |
|---|---|---|
| Batch size | 80 lines | 120 lines |
| Claude's response | Every line | Only the lines that change, usually few |
| Context | Title and neighboring lines | Title and full text, in a prompt-cached block |
| First batch | In parallel with the others | Alone: it writes the cache the others reuse |
| If interrupted | What is translated is saved, and work continues with what is missing | What is corrected is saved, and it is marked complete at the end |

Correction never asks: Claude decides from the context and leaves doubtful lines as they are. If a line is a sentence invented by the recognizer, it returns it empty and the line disappears. Each correction keeps the original text, available in the subtitle navigator.

Generated tracks are stored per video and language, with their origin: Whisper, Claude, imported or saved. A track remembered from another Netflix region only appears if the current region lacks it.

## Whisper transcription

Claude does not transcribe audio, so this part runs on the local computer.

| Source | How the audio arrives | Speed |
|---|---|---|
| Local file | ffmpeg.wasm extracts the chosen track in the application window. The file is mounted without copying, so it works for whole films | Whatever the GPU allows |
| Online video, with the helper | yt-dlp downloads the audio and FFmpeg converts it to a temporary file, which the engine reads in parts through the service worker | Whatever the GPU allows |
| Online video, without the helper | Tab capture during playback. The player reports the video time four times per second, which maps samples to video time despite pauses or seeks | Real time |

Netflix is left out on purpose: it almost always has subtitles, and its audio cannot be processed in advance.

1. The audio is cut at silences before reaching Whisper's 30 s window. Stretches without speech are discarded, since that is where Whisper tends to invent text.
2. Whisper transcribes on the GPU. The text is cleaned of hallucinations and loops, and split into lines.
3. Each stretch of 6 s or more without text is transcribed again on its own. With background music, Whisper can end a chunk early, or start it late, and skip real speech. If the decoder gets stuck repeating itself, 10 s windows are tried. From these second passes only what is clearly a sentence is accepted, because most of those stretches contain only music.
4. Claude corrects homophones and kanji: at the end for files, and every ten lines in real time.

### Load control

Working without pauses keeps the GPU at 100 % for hours, which makes the desktop stutter and can restart the video driver.

| Measure | How it works |
|---|---|
| One chunk at a time | A two-hour film is never sent at once, and video memory does not grow with duration |
| Rest periods | After each chunk the GPU rests in proportion to how long it took. If another application is using the GPU, the chunk takes longer and the rest grows by itself |
| Automatic intensity | Busy 75 % of the time while the computer is in use and 90 % after two minutes idle. Gentle mode stays at 30 % |
| Pause | Frees the card at once and keeps the position |
| Watchdog | A hung chunk is aborted after 90 s |
| GPU loss | Waits 20 s, reloads the model and continues in gentle mode. On a second failure it stops, with the transcribed text saved |
| Resuming | A new transcription of the same file continues where it left off |

## Technical decisions

| Decision | Choice | Reason |
|---|---|---|
| Interface | Preact and signals | Very light, which matters because it is injected into every video page |
| Bundling | esbuild with a custom script | Fast and explicit, with the manifest in plain view |
| Database | Dexie on IndexedDB | Indexes and queries without programming IndexedDB directly |
| Tokenizer | Kuromoji behind its own interface | Works in the browser and can be replaced without touching the rest |
| Dictionaries | Yomitan format: JMdict in Spanish and English, Kanjium accent, JPDB frequency | An open format, which also allows importing others from a file |
| AI | Official `@anthropic-ai/sdk` from the engine | The key never reaches scripts running in pages |
| Transcription | Whisper large-v3-turbo with Transformers.js and WebGPU, with a 16-bit encoder and a quantized decoder | The most accurate of those compared, with nothing to install |
| Audio from online videos | yt-dlp and FFmpeg in a local program, over Native Messaging | The only way to process it without waiting for playback. It downloads to a temporary file instead of streaming, so it is read at the GPU's pace and nothing stalls |
| Local files | ffmpeg.wasm | Embedded subtitles and MKV audio tracks, without external programs |
| Flashcards | AnkiConnect and a built-in FSRS review | Integration with Anki, or review inside the application |
| Card audio | `tabCapture` and `MediaRecorder`, exported to MP3 | Works on any site without downloading the video |
| Web pages | CSS Custom Highlight API | Does not modify the DOM, so it does not interfere with React applications and the like |
| Icons | Phosphor, duotone version | A consistent set, of which only what the code uses is bundled |
| Typography | Nunito for Latin and Zen Maru Gothic for Japanese | Both rounded. Loaded as data so that each site's security policy does not block them |

## Claude models

Each task uses `claude-sonnet-5-5` by default, and the model and effort can be changed per task in Settings. The "Profundizar" button on the card repeats the query with `claude-opus-5-5` and high effort. Requests enable `fallbacks: "default"`, so a safety refusal is retried on another model. This can be disabled in Settings. Structured responses use `output_config.format` with JSON schemas, and the full script is sent in a cached system block.

## Reference measurements

Computer: Radeon RX 9060 XT 16 GB, 16 GB of RAM, 4K 60 Hz monitor, Windows 11 and Edge. They can be reproduced with `pruebas/whisper-comparar.mjs`, `whisper-carga.mjs`, `whisper-video.mjs` and `whisper-larga.mjs`.

**Accuracy.** Character error rate on 126 real sentences from JSUT, Common Voice and ReazonSpeech, not counting punctuation or digits. Lower is better.

| Model | Total | JSUT | Common Voice | ReazonSpeech | Sentences with punctuation | Video memory |
|---|---|---|---|---|---|---|
| Whisper Turbo, 16-bit encoder | 8.8 | 5.5 | 6.5 | 15.0 | 36 of 126 | 3.7 GB |
| Whisper Turbo, quantized | 9.8 | 5.7 | 7.2 | 17.4 | 30 of 126 | 1.5 GB |
| Kotoba Whisper v2.2, quantized | 10.4 | 6.4 | 7.6 | 17.9 | 12 of 126 | 2.2 GB |
| Kotoba Whisper v2.2, 16-bit | 10.5 | 7.8 | 7.8 | 16.4 | 10 of 126 | 3.3 GB |

On real videos, Turbo's advantage was larger on homophones and proper nouns, and Kotoba tended to stretch lines over music.

**Speed on real videos**, with recovery of skipped stretches:

| Video | Length | Time | Speed | Equivalent for 30 minutes | Desktop 99th percentile |
|---|---|---|---|---|---|
| Conversation with background music | 23.1 min | 223 s | 6.1 times | 4.9 min | 17.4 ms |
| Spoken presentation | 13.3 min | 125 s | 6.4 times | 4.7 min | 17.5 ms |

At 75 % occupancy, with no frames over 33 ms and no driver restarts.

**Smoothness.** Time between desktop compositions, in milliseconds, measured with `DwmFlush` and an animated window. The norm at 60 Hz is 16.7.

| Occupancy | 99th percentile | Maximum | Frames over 33 ms |
|---|---|---|---|
| Without Whisper | 18.2 | 19.3 | 0 |
| 30 % | 18.6 | 19.5 | 0 |
| 60 % | 18.7 | 20.0 | 0 |
| 95 % | 19.1 | 20.5 | 0 |

While playing a 1080p video with Whisper running, at 90 % and 95 % occupancy: 0 dropped frames out of 749. Without Whisper, also 0 of 749.

**Long runs.** Two hours of real audio in a row, in automatic mode: 19.7 minutes, 6.1 times faster than real time.

| Minute | Progress | Video memory | Browser RAM | 99th percentile | Frames over 33 ms | Driver restarts |
|---|---|---|---|---|---|---|
| Before starting | | 5.28 GB | 1.11 GB | | | |
| 1.4 | 7 % | 7.50 GB | 5.64 GB | 18.6 | 0 | 0 |
| 6.4 | 33 % | 7.67 GB | 5.25 GB | 18.6 | 0 | 0 |
| 11.5 | 56 % | 7.51 GB | 3.11 GB | 18.7 | 0 | 0 |
| 16.5 | 84 % | 7.33 GB | 2.64 GB | 18.7 | 0 | 0 |

Memory does not grow over time, and the pace holds. Video memory includes the whole system's.

**Recovery.** Destroying the WebGPU device produces the same event as a driver restart. Whisper resumes work after 27 s, without losing or reordering what was transcribed, and on a second failure it stops with a notice.

## Folder structure

```
src/
  nucleo/       Pure, tested logic: subtitles, tokens, modes, grammar, synchronization, transcription, batches
  compartido/   Types, settings and RPC between contexts
  pagina/       MAIN world adapters
  contenido/    Interface on top of the video and web page reader
  fondo/        Service worker
  motor/        Offscreen document: database, tokenizer, Claude, Anki, recording, Whisper
  app/          Application window
  popup/        Extension icon menu
  ui/           Design system, word card, icons and brand
herramientas/   Icon, brand and banner generators; local helper in ayudante/
pruebas/        Screenshot bench, end-to-end tests and simulated servers
docs/           Documentation in Spanish and English
```
