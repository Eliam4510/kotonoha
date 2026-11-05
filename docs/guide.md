<p align="right"><a href="guia.md">Español</a> · <b>English</b></p>

# User guide

This guide covers day-to-day use of Kotonoha. Installation is described in the [README](../README.en.md#installation), and the full feature list is in [features.md](features.md). The interface is currently in Spanish, so its labels are quoted here as they appear on screen, with their meaning in parentheses where needed.

## Contents

- [Getting started](#getting-started)
- [On top of the video](#on-top-of-the-video)
- [Subtitles](#subtitles)
- [Whisper transcription](#whisper-transcription)
- [Flashcards](#flashcards)
- [Audio, images and examples](#audio-images-and-examples)
- [Web pages, reader and library](#web-pages-reader-and-library)
- [Claude spending](#claude-spending)
- [Data and backups](#data-and-backups)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Troubleshooting](#troubleshooting)

## Getting started

Everything is configured under **Ajustes** (Settings), in the extension window, which opens with `Alt+Shift+W`.

| Step | Where | Purpose |
|---|---|---|
| Dictionaries | Ajustes, Diccionarios | JMdict in Spanish and English, Kanjium pitch accent and JPDB frequency. They are downloaded once and stay in the browser |
| Claude API key | Ajustes, Claude | Explanations, reading review, translation and correction. It is stored only in the browser |
| Level and language | Ajustes, Tu nivel e idioma | Adapts the explanations, which can be requested in Spanish, English or simple Japanese |
| Anki | Ajustes, Tarjetas y Anki | Optional. Requires Anki to be open with the AnkiConnect add-on |

The extension works without a Claude key: subtitles, the dictionary, furigana, flashcards and Whisper do not need one.

## On top of the video

When a video with Japanese subtitles opens, a floating bar appears at the top. It shows the estimated comprehension, the recommended sentences, the known words and the playback mode. It hides by itself, comes back when the pointer rests near the top edge, and stays while the pointer is close.

**Subtitles.** Each word has furigana, a color for its pitch accent and an underline for its status: unknown, tracked, known or ignored. Identified grammar points appear as tags.

**Moving the subtitles.** Drag them from anywhere, even from a word, to the height and side you prefer. The position is kept for every video, in proportion to the video's size, including theater mode. A double click on the background, or **Volver a su sitio** (back to its place) in the display settings, puts them back.

**Word card.** Hovering over a word opens its card, with no request to Claude, showing definitions, frequency, audio, images, examples and links to Jisho, JapanDict, Weblio, Goo, Kotobank, Wiktionary, Forvo and Massif. The JapanDict link opens the exact JMdict entry, not a list of homographs.

**In this sentence.** With a Claude key, the **¿Qué significa en esta frase?** (what does it mean in this sentence) button gives the meaning of the word in that context and flags figurative or poetic use. Claude receives 40 lines around the sentence and the translation. The **Explicar**, **Desglose** and **Traducir** tabs work the same way: they ask when pressed. Every answer is stored, so coming back to that word in that sentence costs nothing, and the card says so with **Guardada, sin gasto** (stored, no cost). The "Profundizar" (go deeper) button repeats the query with Opus 5.5.

**Subtitle navigator.** `G` opens a side panel with every line, filters, bookmarks and multiple selection. It can also merge lines, create several cards and synchronize.

**Playback modes.**

| Mode | Behavior |
|---|---|
| Normal | Plays without stopping or hiding subtitles |
| Escucha preparada (prepared listening) | Pauses before each sentence and shows the translation |
| Lectura intensiva (intensive reading) | Pauses before each sentence so it can be read and then heard |
| Escucha intensiva (intensive listening) | Hides subtitles until the sentence is spoken, then pauses and shows them |
| Híbrido intensivo (intensive hybrid) | Pauses after each sentence, with subtitles visible |
| Mostrar al pausar (show on pause) | Shows subtitles only while paused |
| Enfoque 1D (1-unknown focus) | Stops on sentences with exactly one unknown word |
| Personalizado (custom) | Pauses and veils can be adjusted |

Scenes without dialogue can be sped up or skipped from the video panel.

## Subtitles

### Choosing tracks

The **Video y subtítulos** panel, **Subtítulos** tab, selects the Japanese track and the secondary one. By default, hand-made subtitles are preferred over automatic ones, and imported files over everything else.

### Translating with Claude

The **Traducir al español** button in the **Subtítulos con IA** panel, or **Traducir con Claude** next to the secondary track, translates the Japanese subtitles into the support language: Spanish, English, Portuguese, French or German.

- Work starts with the part being watched, so that part is ready within seconds.
- Results appear as they arrive.
- If it is cancelled, what has been translated is kept, and pressing the button again only requests the missing lines.

### Correcting automatic subtitles

Automatic subtitles often confuse homophones. Claude corrects them using the title and the full text as context, without asking any questions.

- It is enabled by default for automatic tracks, and can be turned off in the panel.
- It only changes what is clearly wrong. A line Claude considers invented by the recognizer is removed.
- Corrections are saved and never requested twice.
- The navigator marks corrected lines and shows the original text.

### Creating Japanese from another language

When subtitles exist only in another language, Claude can adapt them to Japanese. This is a translation of a translation, so it will not fully match what is heard. A real Japanese subtitle file, if one exists, will always be better.

### Importing and exporting

Each track has **Importar** (import) and **Exportar SRT** (export) buttons. A file can also be dragged onto the video. SRT, VTT, ASS, SSA, TTML and DFXP are supported.

- Imported files are saved for that title and take priority over the site's tracks.
- Exports include the synchronization adjustments.

### Netflix regions

Japanese subtitles from a Netflix title are saved when watched, along with its identifier. If the catalog of another region offers the same title without that track, Kotonoha presents it as "Japonés (guardados)" (Japanese, saved), with that region's own subtitles as secondary. Exporting to SRT and importing the file covers the same case manually.

### Synchronizing

The **Sincronizar** tab adjusts the offset of each track. **Esta línea suena ahora** (this line is playing now) in the navigator also works: one mark corrects the offset, and two also correct the speed. The offset is adjusted with `Alt+I` and `Alt+O`.

## Whisper transcription

Whisper generates Japanese subtitles when a video has none. It runs on the graphics card through WebGPU, and the audio never leaves the computer. The first run downloads the model, which stays in the browser. It is not offered on Netflix, since its titles almost always have subtitles.

| Source | What is needed | Speed |
|---|---|---|
| Local file, in the application's player | Nothing | About 5 minutes per 30 minutes of video |
| Online video, with the local helper | Installing the helper | About 5 minutes per 30 minutes of video, plus the download |
| Online video, without the helper | Enabling audio capture with `Alt+R` | Real time, a few seconds behind |

**Models.**

| Model | Download | Use |
|---|---|---|
| Whisper Turbo | 1.5 GB | Default. The highest measured accuracy |
| Whisper Turbo ligero (light) | 564 MB | Slightly less accurate, with less video memory |
| Whisper Base | 165 MB | For computers without a powerful GPU |

**Intensity.** Sets the fraction of time the graphics card works. The rest is idle, and the idle time grows by itself if another application is using the card.

| Intensity | Occupancy | 30 minutes of video |
|---|---|---|
| Automática (automatic) | 75 % while the computer is in use, 90 % after two minutes idle | About 5 minutes |
| Suave (gentle) | 30 % | About 12 minutes |
| Rápida (fast) | 90 % | About 4 minutes |

Transcription can be paused to free the card at once and resumed from the same point. If the video driver restarts, Whisper waits 20 seconds, reloads the model and continues at the lowest intensity. On a second failure it stops, and what has been transcribed stays saved.

### Local helper

An extension cannot download the audio of a video by itself. The helper is a small local program that does so with [yt-dlp](https://github.com/yt-dlp/yt-dlp) and FFmpeg. It requires Python, and its installer adds yt-dlp if missing. It is installed once from the project folder:

```bash
powershell -ExecutionPolicy Bypass -File herramientas\ayudante\instalar.ps1
```

The extension must then be reloaded at `edge://extensions` or `chrome://extensions`. Its status can be checked under **Ajustes, Transcripción**.

| Aspect | Behavior |
|---|---|
| Scope | Only the extension can call it, and it only accepts http or https addresses |
| Registry | Adds a per-user key under `HKCU`, without administrator rights |
| Files | Uses a temporary folder that is deleted on completion or cancellation |
| Identifier | If the extension is loaded from another folder its identifier changes: it is passed with `-Extension`, and shown on the extensions page |
| Removal | The same command with `-Quitar` |

If a video cannot be downloaded, for example because it is private or age-restricted, the notice offers to transcribe it while it plays.

## Flashcards

| Shortcut | Action |
|---|---|
| `Q` | Creates a card with the current word and sentence |
| `E` | Sends the word, the selection or the image under the pointer to the card creator |

Cards can be sent to Anki through AnkiConnect, with a custom note type or the one the extension creates, or saved in **Memoria**, the built-in FSRS review. Fields include sentence, furigana, translation, definitions, audio, image and notes. Audio capture is enabled with `Alt+R`.

## Audio, images and examples

| Item | Source | Key required? |
|---|---|---|
| Word audio | JapanesePod101 and Lingua Libre, through Wikimedia Commons | No |
| Sentence audio | Recorded from the tab with `tabCapture`, on the computer itself, and converted to MP3 | No |
| Synthetic voices | Azure Speech, if configured. Otherwise the system voices, for listening only | Azure only |
| Images | Openverse, searching for the first English JMdict gloss | No |
| Video frame | Captured from the video, on the computer itself | No |
| Examples | Sentences the user has already seen, stored in the browser | No |
| Example sentence for a card | Claude, only when the card has no sentence | Claude |

## Web pages, reader and library

**Web pages.** Holding `Shift` and hovering over a Japanese word opens its card on any page. Status underlining does not modify the document: it uses the CSS Custom Highlight API, so it does not interfere with applications such as those built with React. `Alt+K`, `Alt+U` and `Alt+I` mark the selected text in bulk as known, unknown or ignored.

**Reader.** Displays any pasted text with the same aids as subtitles.

**Library.** Stores EPUB books, texts and SRT subtitles, with the reading position. It can also generate stories with Claude, matched to the configured level.

**Local player.** Plays local files, with the embedded subtitles of an MKV and a choice of audio track, through ffmpeg.wasm.

**Words and assessment.** The explorer lists vocabulary by status, and the level assessment estimates the initial known words.

## Claude spending

The home screen has a **Gasto en Claude** card with this month's spending against the credit set in Settings, a chart by day and model, the split by task and a log of every request with its tokens. The cost is worked out from the tokens reported by the API and its public prices, and only counts what was requested from this extension in this browser.

What costs the most per video is the review of readings, meanings and grammar, followed by translation. The review covers a few minutes ahead of the playback position and continues as the video advances, and reviewed lines stay stored. It can be turned off in **Generar subtítulos**, or requested for the whole video with **Revisar todo el video**.

Three settings under **Comportamiento** (behavior) decide how much Claude is used:

| Setting | Default | Effect |
|---|---|---|
| Ask for the meaning when opening a word | Off | Every new word opened would be a request |
| Tab on open | Dictionary only | A Claude tab would ask on every word opened |
| Full script as context | Off | More context for names and references, at a higher cost per query |

## Data and backups

All data is stored in the browser, in IndexedDB. **Ajustes, Tus datos** exports and imports a backup with words, cards, library, settings, generated subtitles, corrections and the spending log.

## Keyboard shortcuts

The full reference is in the shortcuts panel, on top of the video.

| Group | Shortcut | Action |
|---|---|---|
| Bar | `Alt+X` | Pin or release the bar |
| | `Alt+Z` | Show it while held |
| | `Alt+T` | Open the translator |
| Word | `1` or `U` | Mark as unknown |
| | `2` or `T` | Track |
| | `3` or `K` | Mark as known |
| | `4` or `I` | Ignore |
| | `N` | Go to the next unknown word |
| | `Alt+S` | Look up in the dictionary |
| Cards | `Q` | Create a card |
| | `E` | Send to the creator |
| | `Alt+R` | Allow audio capture |
| Selection | `B` | Bookmark the subtitle |
| | `L` | Select the subtitle |
| | `J` | Merge the selected lines |
| Video | `A` or `←` | Previous subtitle |
| | `D` or `→` | Next subtitle |
| | `S` or `↓` | Repeat the subtitle |
| | `Alt+→`, `Alt+←` | Skip forward or back 5 seconds |
| Subtitles | `R` | Show or hide everything |
| | `W` or `↑` | Show or hide Japanese |
| | `G` | Subtitle navigator |
| | `C` | Copy the subtitle |
| | `Alt+Shift+G` | Generate secondary subtitles |
| Application | `Alt+Shift+W` | Open the Kotonoha window |

## Troubleshooting

| Symptom | Cause and solution |
|---|---|
| Nothing changes after building | The browser keeps the previous service worker. Press **Reload** on the extensions page |
| "Para oír el video activa la captura de audio" (enable audio capture to hear the video) | Chrome requires a user action to capture a tab. Press `Alt+R` in the video's tab |
| Whisper is very slow | The browser is not offering GPU access. Check the hardware acceleration option in its settings |
| The helper does not show as installed | The extension must be reloaded after running the installer. If it was loaded from another folder, pass its identifier with `-Extension` |
| A video cannot be downloaded | Age-restricted, private or paid videos are out of reach for yt-dlp. It can still be transcribed while it plays |
| YouTube returns empty subtitles | Its requests are signed by the player. Playing the video for a few seconds is enough |
| Anki does not connect | Anki must be open with AnkiConnect, and its configuration must allow the extension's origin. The extension asks for permission the first time |
