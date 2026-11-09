<p align="right"><a href="guia.md">Español</a> · <b>English</b> · <a href="de/guide.md">Deutsch</a> · <a href="zh/guide.md">简体中文</a> · <a href="ko/guide.md">한국어</a> · <a href="ja/guide.md">日本語</a></p>

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
- [Studying English](#studying-english)
- [Studying German](#studying-german)
- [Claude spending](#claude-spending)
- [Data and backups](#data-and-backups)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Troubleshooting](#troubleshooting)

## Getting started

The first time, a welcome screen asks for the language, the one to study and the level, and suggests installing the dictionaries, adding a Claude key and choosing where cards go. It can be skipped, and seen again from **Settings, Appearance**. Everything is configured afterwards under **Settings**, in the extension window, which opens with `Alt+Shift+K`.

| Step | Where | Purpose |
|---|---|---|
| Dictionaries | Settings, Dictionaries | JMdict in Spanish, English or German, Kanjium pitch accent and JPDB frequency. They are downloaded once and stay in the browser |
| Claude API key | Settings, Claude | Explanations, reading review, translation and correction. It is stored only in the browser |
| Other AI providers | Settings, Other AI providers | OpenRouter, DeepSeek or OpenAI with their key, or LM Studio and Ollama on the computer itself, for the tasks chosen. Claude remains the default |
| Language and level | Settings, Language and level | The interface language and, separately, that of explanations and translations. The level adapts the explanations and decides how much furigana is shown at first |
| Language you're studying | **Home** and the sidebar, Settings, Language and level, the extension menu, or **Video settings, Subtitles** on the video itself | Japanese, English or German. Each keeps its own words, dictionaries, cards and settings |
| Anki | Settings, Cards and Anki | Optional. Requires Anki to be open with the AnkiConnect add-on |

The extension works without a Claude key: subtitles, the dictionary, furigana, colors, flashcards and Whisper do not need one.

**Other AI providers.** In **Settings, Other AI providers**, add OpenRouter, DeepSeek or OpenAI, with their key, or LM Studio and Ollama on the computer itself, without one. **See its models** lists what each one offers, and **Test the connection** sends it a minimal request. Then, in **Model and effort per task**, each task can use one of their models. Structured answers are requested with their JSON schema and, if the provider does not support it, as DeepSeek does not, in JSON mode with the schema in the instructions; if it does not allow that many answer tokens, fewer are requested. Spending is recorded with the cost the provider reports (OpenRouter does), and models on the computer itself count as zero. Keys are stored separately, like Claude’s, and never reach the pages. The instructions are tuned for Claude: with other models, answers may be worse. Ollama only answers extensions if it is started with `OLLAMA_ORIGINS=chrome-extension://*`.

### Making it yours

| Option | Where | Purpose |
|---|---|---|
| Readings in rōmaji | Settings, Language and level | For those who cannot read kana yet. It applies to subtitles, word panels and pages |
| Word colors | Settings, Appearance | Three palettes: the usual one, one for color blindness that does not rely on red or green, and a high-contrast one |
| Shortcuts | Settings, Keyboard shortcuts | Those over the video are changed there. Those used by the browser, such as audio capture, on its shortcuts page |
| Spending limit | Settings, Claude | When it is reached, Claude is not used again until the next month |
| Sites without the reader | Settings, Page reader, or the button at the edge of the page | Turns it off only where it gets in the way |

## On top of the video

When a video with Japanese subtitles opens, a floating bar appears at the top. It shows the estimated comprehension, the recommended sentences, the known words and the playback mode. It hides by itself, comes back when the pointer rests near the top edge, and stays while the pointer is close.

**Subtitles.** Each word has furigana, a color for its pitch accent and an underline for its status: unknown, tracked, known or ignored. Identified grammar points appear as tags.

**Moving the subtitles.** Drag them from anywhere, even from a word, to the height and side you prefer. The position is kept for every video, in proportion to the video's size, including theater mode. A double click on the background, or **Put back in place** in the display settings, puts them back.

**Word panel.** Hovering over a word opens its panel, with no request to Claude, showing definitions, frequency, audio, images, examples, stroke order and links to Jisho, JapanDict, Weblio, Goo, Kotobank, Wiktionary, Forvo and Massif. The JapanDict link opens the exact JMdict entry, not a list of homographs.

**In this sentence.** With a Claude key, the **What does it mean in this sentence?** button gives the meaning of the word in that context and flags figurative or poetic use. Claude receives 40 lines around the sentence and the translation. The **Explain**, **Breakdown** and **Translate** tabs work the same way: they ask when pressed. Every answer is stored, so coming back to that word in that sentence costs nothing, and the panel says so with **Saved, no cost**. The **Go deeper** button repeats the query with Opus 5.5.

**Share as image.** The word panel’s **Share as image** button, next to the frequency, draws a card with the word, its furigana and pitch accent, what it means in that sentence (or what the dictionary says, if Claude has not been asked), the sentence it appeared in with the word highlighted and the title of the video or book, and copies it to the clipboard: just paste it into a chat with Ctrl+V. Each point under **Grammar in this sentence** has the same button, with the pattern, its level, its meaning and the first point of Claude’s explanation. The card comes in **Ink** or **Paper**, like the themes, and remembers the last style; **Save image** downloads it as a PNG. It is drawn in the browser, without sending anything.

**Strokes.** The **Strokes** tab on the word panel shows how each kanji in the word is written: strokes are drawn one by one, in a loop, with their numbers. It can be paused, stepped through and sped up or slowed down. The data comes from [KanjiVG](https://kanjivg.tagaini.net): each kanji is downloaded the first time and stays in the browser. Below, **With these kanji you already know** gathers, for each kanji, the words that contain it and are already marked as known or learning (冷蔵庫: 冷たい, 車庫, 金庫), known ones first: the new kanji is remembered through what you already know.

**Subtitle navigator.** `G` opens a side panel with every line, filters, bookmarks and multiple selection. It can also merge lines, create several cards and synchronize.

**Playback modes.**

| Mode | Behavior |
|---|---|
| Normal | Plays without stopping or hiding subtitles |
| Escucha preparada (prepared listening) | Pauses before each sentence and shows the translation |
| Lectura intensiva (intensive reading) | Pauses before each sentence so it can be read and then heard |
| Escucha intensiva (intensive listening) | Hides subtitles until the sentence is spoken, then pauses and shows them |
| Dictado (dictation) | Hides the subtitles and pauses at the end of each line to type what you heard; then marks what you got right |
| Híbrido intensivo (intensive hybrid) | Pauses after each sentence, with subtitles visible |
| Mostrar al pausar (show on pause) | Shows subtitles only while paused |
| Enfoque 1D (1-unknown focus) | Stops on sentences with exactly one unknown word |
| Personalizado (custom) | Pauses and veils can be adjusted |

**Dictation and Repeat in your voice.** In **Dictation** mode, at the end of each line the video stops and, where the subtitle would be, you type what you heard. **Check** shows the line with each word in green if you got it, yellow if half and underlined if not, and the score. In Japanese the reading is what counts: you can type in kana, and if a word with kanji has another dictionary reading that matches what you typed (後 as あと), it counts. **Hear it again** repeats the line and **Continue**, or Enter, goes on. **Repeat in your voice**, in the result, or the `P` key over any subtitle, opens pitch accent practice with that line in the Kotonoha window: listen in the video with `S`, say it the same way and compare the intonation.

Scenes without dialogue can be sped up or skipped from the video panel.

## Subtitles

### Choosing tracks

The **Video and subtitles** panel, **Subtitles** tab, selects the Japanese track and the secondary one. By default, hand-made subtitles are preferred over automatic ones, and imported files over everything else.

### Translating with Claude

The translate button in the **AI subtitles** panel, or **Translate with Claude** next to the secondary track, translates the Japanese subtitles into the support language: Spanish, English, Portuguese, French or German.

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

Each track has **Import** and **Export SRT** buttons. A file can also be dragged onto the video. SRT, VTT, ASS, SSA, TTML and DFXP are supported.

- Imported files are saved for that title and take priority over the site's tracks.
- Exports include the synchronization adjustments.

### Netflix regions

Japanese subtitles from a Netflix title are saved when watched, along with its identifier. If the catalog of another region offers the same title without that track, Kotonoha presents it as "Japanese (saved)", with that region's own subtitles as secondary. Exporting to SRT and importing the file covers the same case manually.

### Synchronizing

The **Sync** tab adjusts the offset of each track. **Sync: this line is playing now** in the navigator also works: one mark corrects the offset, and two also correct the speed. The offset is adjusted with `Alt+I` and `Alt+O`.

## Whisper transcription

Whisper generates Japanese subtitles when a video has none. It runs on the graphics card through WebGPU, and the audio never leaves the computer. The first run downloads the model, which stays in the browser. It is not offered on Netflix, since its titles almost always have subtitles.

| Source | What is needed | Speed |
|---|---|---|
| Local file, in the application's player | Nothing | About 5 minutes per 30 minutes of video |
| Online video, with the local helper | Installing the helper | About 5 minutes per 30 minutes of video, plus the download |
| Online video, without the helper | Enabling audio capture with `Alt+Shift+M` or the switch in the extension menu | Real time, a few seconds behind |

**Models.**

| Model | Download | Use |
|---|---|---|
| Automatic | | Default. Haas-ja for Japanese speech, Parakeet for English and German speech, and Whisper Turbo for songs |
| Haas-ja | 1.3 GB | Japanese only. The most accurate and fastest with spoken voice, even with background music, and it adds punctuation |
| Parakeet | 1.3 GB | English and German. The most accurate and fastest with spoken voice, even with background music, with punctuation and the most precise timing |
| Whisper Turbo | 1.5 GB | The best for songs |
| Whisper Turbo ligero (light) | 564 MB | Slightly less accurate, with less video memory |
| Whisper Base | 165 MB | For computers without a powerful GPU |

In automatic mode, a video counts as a song if its lyrics have been pasted, if the site classifies it as music, or if the title says so, such as "MV" or "歌ってみた". With Japanese speech, Haas-ja makes 3 % errors against 9 % for Whisper Turbo, and transcribes 30 minutes in about a minute, against about 5. With songs it writes only part of what is sung, and there Whisper Turbo is better. The same happens in English with Parakeet: 6.8 % errors against 9.6 % for Whisper Turbo, and timing three times more precise. While transcribing, the panel shows which model is working.

Models are stored in the browser and are not downloaded again: each time they load from disk, which can take a few seconds. **Settings, Speech transcription, Saved models** shows the space each one takes and allows it to be deleted. Uninstalling the extension also deletes them.

**Intensity.** Sets the fraction of time the graphics card works. The rest is idle, and the idle time grows by itself if another application is using the card.

| Intensity | Occupancy | 30 minutes of video |
|---|---|---|
| Automática (automatic) | 75 % while the computer is in use, 90 % after two minutes idle | About 5 minutes |
| Suave (gentle) | 30 % | About 12 minutes |
| Rápida (fast) | 90 % | About 4 minutes |

Transcription can be paused to free the card at once and resumed from the same point. If the video driver restarts, Whisper waits 20 seconds, reloads the model and continues at the lowest intensity. On a second failure it stops, and what has been transcribed stays saved.

### Song lyrics

Whisper gets the timing right, but in a song it misses many words. If someone has published the lyrics, for example in a comment on the video, they can be pasted into **Song lyrics**, in the **AI subtitles** panel, and Claude places them on that timing.

- Claude only says which verse sounds over which lines of the transcription. The words come exactly from the lyrics, and the timing from Whisper.
- If the lyrics are pasted before or during transcription, they are aligned automatically at the end, and nothing is spent correcting or reviewing what Whisper heard. If the video already has a track, it can also serve as the timing reference, with **Align the lyrics to this timing**.
- A chorus written only once is placed wherever it sounds. What is not sung, such as section marks, rōmaji or translations, is ignored.
- A verse Whisper did not pick up gets an estimated time, and the final notice says how many there are. In that case, **Sync: this line is playing now**, in the navigator, fine-tunes the timing.
- The result is one more track, "Japanese (lyrics)", saved for that video. The original transcription stays available. Each song takes a single request to Claude, and repeating the alignment with the same lyrics costs nothing.
- On an online video without the local helper, Whisper has to hear the whole song: when the video ends, transcription stops by itself and the lyrics are aligned.

### Local helper

An extension cannot download the audio of a video by itself. The helper is a small local program written in PowerShell, which comes with Windows: neither Python nor FFmpeg needs to be installed. It downloads the audio with [yt-dlp](https://github.com/yt-dlp/yt-dlp) and also updates the extension (see **New versions**, under [Data and backups](#data-and-backups)). It is downloaded from the latest version's page, as `kotonoha-X.Y.Z-ayudante.zip`, unzipped into any folder, and started by double-clicking `Instalar.cmd`. The installer:

- copies the helper to `%LOCALAPPDATA%\Kotonoha\ayudante`, so the unzipped folder is no longer needed;
- downloads yt-dlp and QuickJS, which yt-dlp uses to solve the YouTube challenge, from their official GitHub pages, and checks the SHA-256 of each;
- looks for Kotonoha in Chrome, Edge, Brave and Chromium, and registers the helper for every copy it finds;
- if it finds none, offers to install the extension too, with a fixed ID, and explains how to load it.

Its status can be checked under **Settings, Transcription**. If the installer does not find a copy, Settings shows the command with its ID, to run in the helper's folder:

```bash
powershell -ExecutionPolicy Bypass -File instalar.ps1 -Extension EXTENSION_ID
```

| Aspect | Behavior |
|---|---|
| Scope | Only the extension can call it, and it only accepts http or https addresses |
| Registry | Adds a per-user key under `HKCU`, without administrator rights |
| Conversion | With FFmpeg on the computer, the helper converts the audio. Without it, the extension converts it with its own FFmpeg, somewhat more slowly |
| yt-dlp | Updates itself once a week: YouTube changes often |
| Files | Uses a temporary folder that is deleted on completion or cancellation |
| Removal | Double-click `Desinstalar.cmd`. The extension and its data are not touched |

If a video cannot be downloaded, for example because it is private or age-restricted, the notice offers to transcribe it while it plays.

## Flashcards

| Shortcut | Action |
|---|---|
| `Q`, `Alt+Q` | Creates a card with the current word and sentence |
| `E` | Sends the word, the selection or the image under the pointer to the card creator |

Cards can be sent to Anki through AnkiConnect, with a custom note type or the one the extension creates, or saved in **Memory**, the built-in FSRS review. Fields include sentence, furigana, translation, definitions, audio, image and notes. Audio capture is enabled with `Alt+Shift+M` or the switch in the extension menu.

**Audio and image from the video.** To record the sentence audio, capture must be enabled in the video's tab, with `Alt+Shift+M` or the switch in the extension menu. Capture only covers that tab: if it is active in another one, the microphone icon appears off and the card is created without audio. When a card is created, the line plays again at normal speed while it records, and the video then stays where it was. The image includes nothing from the interface. On sites with DRM, such as Netflix, the browser delivers the frame in black: the card then carries the episode's official image, or none if the site does not offer one. A protected site may also withhold its sound: the card is created without audio and, after two silent sentences in a row in a video, the line is no longer replayed to record it.

## Audio, images and examples

| Item | Source | Key required? |
|---|---|---|
| Word audio | JapanesePod101 and Lingua Libre, through Wikimedia Commons | No |
| Sentence audio | Recorded from the tab with `tabCapture`, on the computer itself, and converted to MP3 | No |
| Synthetic voices | Azure Speech, if configured. Otherwise the browser's voices: the best one it offers, or another chosen in **Settings, Voices**, for listening only | Azure only |
| Local voice | AivisSpeech or VOICEVOX, running on the computer itself, Japanese only: it reads with the dictionary’s accent, and its audio also works for cards | No |
| Images | Openverse, searching for the first English JMdict gloss | No |
| Video frame | Captured from the video, on the computer itself | No |
| Examples | Sentences the user has already seen, stored in the browser | No |
| Example sentence for a card | Claude, only when the card has no sentence | Claude |

## Web pages, reader and library

**Web pages.** On any page with Japanese text, the reader underlines words according to how well they are known and adds furigana. Clicking a word opens its panel. On links and buttons the click still belongs to the site, and the panel opens when the pointer rests on them, or at once with `Shift`. Dragging still selects text, and with the panel open `1` to `4` and `Q` work.

The button on the right edge adjusts colors and furigana without leaving the page, and the extension menu turns the reader on and off. Furigana has four modes: on all words, only on new ones, on hover or never. **Settings, Page reader** can make the panel always open on hover, or make clicks on links look words up too.

None of this adds anything to the page's content. Colors use the CSS Custom Highlight API and readings live in a separate layer, so selecting, copying and searching work as usual, and it does not interfere with applications such as those built with React. It also works on what scrolls inside a box, like a chat conversation: furigana moves with the text and passes under the message box. It leaves text fields and Chinese or Korean text alone.

**Space out lines.** Many pages leave little room between lines, and furigana would collide with the line above. There, the line spacing of that text is opened just enough, and that is the only thing the reader may move on a page. It is not done on buttons or menus, nor where the text would overflow a fixed-height box: in those cases, if there is no room at all, furigana is left for hovering. The **Space out lines** switch, on the edge button, turns it off, and then the layout does not move at all.

`Alt+K`, `Alt+U` and `Alt+I` mark the selected text in bulk as known, unknown or ignored.

**Notebook.** What used to be the Clipboard: a full-width page to write and paste formatted text, and to read it with the same aids as subtitles. At the top, **Edit** and **Read** switch modes on the same page. While editing, the block selector sets **Text**, **Heading**, **Subheading**, **Minor heading** or **Code**, and the buttons add a **List**, a **Numbered list**, a **Quote** and **Bold**. The usual shortcuts work too: `# ` at the start of a line for a heading, `- ` (or ・ in Japanese) for a list, `1. ` for a numbered one, `> ` for a quote, Tab for a sub-item and Ctrl+B for bold. Text pasted from a page keeps its structure and leaves out that page’s furigana, and Markdown copied from the Claude chat comes in formatted. **Organize** asks Claude to add a title, subheadings, paragraphs and lists to text pasted as one block, without changing the words; if it did change any, it says so, and Ctrl+Z puts it back. What you write is saved in the browser by itself; **Save to the library** takes it to the library, and from then on it is saved there too. **New note** starts a blank one without losing the previous one: if it was not in the library, it goes there. A library text can be edited again with **Edit in the Notebook**. Everything is stored as Markdown, which is still text: it reads the same in the library and in the backup.

**Web mode.** The application window has no tabs, so it cannot join the browser’s split view. The Notebook’s **Web mode** button opens it in a regular tab, without the sidebar, and **Open the Notebook next to this tab**, in the extension menu, puts it right next to the page being viewed (Chrome 155 or later). In that tab, **Follow the clipboard** adds at the end whatever you copy anywhere in the language you study, while the tab is in view. **Open the selection in the Notebook**, in the menu of selected text on any page, also adds it at the end. It is a page of the extension itself: it needs no server, works offline and the text never leaves the computer.

**Dictation.** **Dictate**, in the Notebook, records from the microphone and adds what was said at the end, in a paragraph of its own, and shows it already analysed and with furigana. While recording, the time and the microphone level are shown; **Finish** ends the recording and **Cancel** discards it. Transcription happens on the computer with the model chosen in **Settings**, under “Speech transcription”: in automatic mode, Haas-ja for Japanese and Parakeet for English and German. The model loads while you speak, so once you finish, transcription takes a few seconds. Neither the recording nor the text leaves the computer. The recording stays above its paragraph so it can be played again, and it goes with the text when saved to the library. While editing, the recording is a “Dictation recording” block: if it is removed, the paragraph stays and the recording is deleted later, a week after it was made. The first time, the browser asks for permission to use the microphone. Each recording lasts ten minutes at most.

**Read aloud.** In the Notebook, in library texts and in the viewer’s text view, **Read aloud**, in the bar at the bottom, reads the text sentence by sentence with the sentence voice: the local one, the neural one, Azure’s or the browser’s. The speed button cycles through 0.6×, 0.8×, 1× and 1.2×, and the mode button through **Continuous**, **Sentence by sentence**, which stops at the end of each sentence, and **Repeat**, which repeats the same sentence with a short pause so you can say it along. Both are remembered. Selecting any part of the text with the mouse shows **Listen**, which reads it, and in Japanese **Practice**, which opens pitch accent practice with that part: a word, half a sentence or several sentences.

**Practice pitch accent.** In the Notebook, in the Library’s texts and in the viewer’s text view, **Practice**, in the bar at the bottom, opens practice for the current sentence; **Previous sentence** and **Next sentence** move to another one. Each word’s accent is drawn above it: a line, high or low on each mora, that falls after the accent nucleus. **Hear the sentence** reads it with the Azure voice, if there is a key, or with the browser’s voice. **Record** records the sentence read aloud, for twenty seconds at most. Kotonoha measures the pitch of the recording in the browser itself and transcribes it on the computer with Haas-ja, which tells where each word is spoken. The chart lays the pitch curve of the voice over the expected accent, and each word gets a verdict: **Good**, if the pitch falls where it should; **Check**, if it falls somewhere else or does not fall, with where it should have fallen and where it did; **Not judged**, for conjugated forms whose accent is not known; and **Not recognized**, if the word does not appear in the recording. Long pauses between words within a sentence are pointed out as well. **Play your recording** plays it back and **Record again** repeats the attempt. What is judged is where the pitch falls, which is what distinguishes the accent: the initial rise, which connected speech sometimes skips, does not count, nor does the last mora before a pause, which carries the sentence’s intonation. Each word’s accent comes from the “Pitch accent (Kanjium)” dictionary; without it, only polite forms in 〜ます are judged, since their nucleus does not depend on the verb. It is a guide: with read-aloud sentences, automatic measurement is not always right. Neither the recording nor the text leaves the computer, and the recording is not kept. The speech model loads when practice opens and stays loaded while it is open: the first recording waits for it to finish loading, about thirty seconds on the development computer, and the following ones are analysed in under a second.

**Special morae.** With **Also check っ, ん and long vowels**, in the practice panel, Kotonoha also checks whether a special mora is missing or extra in the recording: a っ that cannot be heard (きて for きって), a ん (かじ for かんじ), a long vowel said short (おばさん for おばあさん) or an extra one (おばあさん for おばさん). Each warning, labelled **Mora**, says in which word, and the mora is highlighted in the expected accent; with no warnings, **Morae** says none is missing or extra. It is heard by narabas, a Japanese phoneme model that runs on your computer: on the GPU if it calculates the same as the processor, and otherwise on the processor. The first time, 1.26 GB are downloaded from its author’s release on GitHub, checked against their SHA-256 and kept in the browser; **Settings, Speech transcription**, under **Saved models**, deletes them. A っ before s, sh, z, j, h or f is not judged, since the model does not mark it, and neither is a phrase that was said differently or not recognized. A lengthened vowel or a pause at the end of a word does not count either: those are hesitations, not mistakes in the word. Measured with minimal pairs said by two synthetic voices: it caught 17 of 22 missing morae and 10 of 10 extra ones, and gave no warning on 22 of 24 sentences said correctly.

**Local voice.** With AivisSpeech or VOICEVOX open on the computer, Kotonoha reads Japanese sentences with them: read aloud, **Hear the sentence** in the practice, the word panel and the audio for cards. In **Settings, Voices**, **Local voice** says whether it found one on their usual ports (10101 for AivisSpeech, 50021 for VOICEVOX); it is turned on with **Read sentences with the local voice**, and the **Voice and style** is chosen there. With **Dictionary accent**, before reading it corrects each word’s accent with the accent dictionary, so the model voice says what the dictionary says. The audio is cached: a sentence already read plays instantly. If the program is closed, sentences are read with Azure, if there is a key, or with the browser’s voice. AivisSpeech is free and nothing leaves the computer.

**Library.** Stores EPUB, CBZ and PDF books and image folders, which open in the viewer, and texts and SRT subtitles, with the reading position and the structure of each chapter. It can also generate stories with Claude, matched to the configured level.

**Viewer.** Image-based EPUBs, such as manga and scanned books, CBZ files and PDFs open in the viewer, in a tab of their own, as in a PDF reader. It has zoom (**Zoom in**, **Zoom out**, **Fit to width** and **Whole page**, also with Ctrl and the mouse wheel), three views (**Single page**, **Two-page spread** and **Continuous scrolling**), **Thumbnails**, the book's **Contents** and **Full screen**. A book that declares a right-to-left reading order, as manga does, is shown that way: the left arrow moves forward, and in a two-page spread the cover can stand on its own so that the pairs match the printed volume. The arrow keys, Home and End turn pages, and F toggles full screen. The file is stored as is in the browser's storage and read piece by piece, never loaded whole, and the viewer remembers each book's page, view and zoom.

**Image folders.** Manga that comes as images is imported with **Choose an image folder** or by dragging the folder in. Each folder with images is a book. If it only holds subfolders that look like volumes, by their name (“第01巻”, “Vol. 2”, “v03”) or by holding around two hundred images, each volume comes in on its own, with the series name in front when its own name is just the number; if they look like chapters, they become the table of contents of a single book. Pages follow natural order, with the cover first even when it is called “cover.jpg”; anything that is not an image is ignored, and a ComicInfo.xml provides the title and the reading direction. Each book is stored as a CBZ, without recompressing the images or copying them into memory. In **Two-page spread**, a landscape page, which is a spread scanned in one piece, stands on its own.

**Collections and progress.** Books are grouped into collections, such as a series with its volumes or the books on a topic. A folder with several volumes comes in as a collection with its name, and a new volume from that folder is added to it. **New collection** creates one by hand, with its name, its type (**Manga**, **Novel**, **Study** or **Other**) and a description. Inside a collection, **Add books** brings books from the shelf, **Import here** imports files straight into it, **Cover** picks the cover of one of its books or an image of one's own, and **Remove the collection** leaves its books on the shelf. Each book shows how much has been read and becomes **Finished** when its last page is reached; its menu moves it to another collection, changes its cover, marks it as finished or starts it over. **Keep reading**, at the top of the shelf, leads to what is being read, and the **Reading**, **Not started** and **Finished** filters show each group, including the books inside collections. A PDF has its cover and page count as soon as it is imported, and in the viewer **Use this page as the cover** turns any page into the cover.

**Page text.** The **Read the text on the pages** button recognizes the text of image pages on your own computer, with the GPU, and places it over the page: hovering highlights each line, and tapping it opens it at the side with furigana and words to look up, with their word panel and card creation. There are two modes: **Book**, for printed books and scanned PDFs, and **Manga**, for speech bubbles and vertical text, which does not mistake furigana for text. In **Book**, printed furigana is kept out of the text and a two-column page is read column by column; in **Manga**, bubbles follow the order of the panels, and watermarks and page numbers are left out. A book that reads right to left starts in **Manga** mode. In a PDF that already has its own text, that text is used; if it is the layer of another OCR program, with errors, turning off **PDF text** makes Kotonoha read those pages too. In a scanned PDF, OCR reads the scanned image as it is, at its own resolution, rather than the page as drawn on screen, so it makes far fewer mistakes. The first time, the models are downloaded, 25 MB for books and 178 MB for manga, and each page is read only once, in one or two seconds. OCR can confuse similar characters or lose the subscripts of a formula; the original image stays in view. The next pages are read before you reach them, so when you turn the page its text is already there. If a line comes out with a wrong character, **Edit**, in the line panel, lets you type its text by hand: the edit is stored separately, is not lost if the page is read again, and **Restore** goes back to the text that was read. From each book's card in the Library, **Process** reads all its pages with OCR at once, with the progress in view; it can be paused and continued later without losing anything, and when it finishes the book shows **Text ready** and has OCR turned on.

**Notes and bookmarks.** In page books, **Bookmark this page** hangs a ribbon on the page, also shown in the thumbnails. In a line's panel, **Highlight** colours it in one of four colours, and **Underline** underlines it; with a word picked, or a stretch selected by dragging, just that part can be marked. Each highlight can carry a comment, with **Comment**. **Add a note** leaves a note on the spot of the page that is tapped: a slip of paper that opens to read or change it. The **Notes and bookmarks** panel gathers everything by page, leads to each item, edits it or removes it, and **Copy** puts it on the clipboard as text. Highlights are stored on the page image, so they stay in place even if OCR reads the page again, and everything is included in the backup.

**Search the book.** **Search the book**, or Ctrl+F, looks for a word on every page that has text: the text the PDF brings and the text read by OCR, with edits on top. It ignores case, character width and the difference between hiragana and katakana, and in Japanese it also finds a word split across two lines. Results are listed by page, with a little text around them; Enter goes to the next one and Shift+Enter to the previous one, and the match is marked on the page. Pages that OCR has not read yet are not searched: the panel says how many there are, and **Process** reads them all at once.

**Text view.** **View as text** replaces the page image with its text, with the lines joined into paragraphs and headings set apart, and with the Notebook's reading help: furigana, colours, comprehension, **Read aloud** and the word panel to create cards. In a manga, each speech bubble is a paragraph. Pages turn as with the image, and **View the pages** goes back to it. Each book remembers the view it was left in.

**Review with Claude.** **Review the text with Claude** sends Claude the page image and the text that was read, and Claude suggests only the lines that do not match the image. Each change is shown letter by letter, you choose which ones to apply, and nothing changes until you press **Apply**. A reviewed line shows "Reviewed with Claude" in its panel, and **Restore** puts it back as it was. The Claude key is needed. The task uses Claude Haiku 5.5, which costs less than one US cent per page, and its model can be changed in **Settings**, under "Reviewing the text of pages". Reviewing the same page again with the same text is not paid for again. The reviewed page is sent to Claude, like any other request; the rest of the book does not leave the computer.

**Text books.** A text EPUB, such as a novel, opens in the viewer in its own format: its chapters, CSS, ruby, illustrations and vertical writing. The page reader goes on top, as on the web: colours, furigana and a click on a word to open its word panel. The arrows, Page Up, Page Down and the wheel turn the page; in a vertical book the text advances to the left, and the end of a chapter leads to the next one. **Contents** takes you to each chapter, the book’s own links work, **Zoom in** and **Zoom out** change the text size and **Vertical text** lets you read a vertical book horizontally. The viewer remembers the chapter and the exact spot. Nothing the book contains runs or loads anything from the internet.

**PDFs with text.** If a PDF contains its text, it is used directly, without OCR or downloads: just tap a line. Tapping a word on the page, in a PDF with text or on a page read in **Book** mode, opens its word panel directly and marks the word on the page.

**Local player.** Plays local files, with the embedded subtitles of an MKV and a choice of audio track, through ffmpeg.wasm.

**Words and assessment.** The explorer lists vocabulary by status, and the level assessment estimates the initial known words.

**JLPT.** The **JLPT** entry in the sidebar brings together the vocabulary, kanji and grammar of each level, from N5 to N1, with what you already know of each: each level card counts the known words and kanji, and a ring shows how much of the vocabulary is known. In **Vocabulary**, each word shows its status, which you change on its own row or in bulk: **Select all … in the list** and a status mark, for example, every N5 word you already know at once. In **Kanji**, a kanji counts as known when a known word contains it; tapping it shows its readings, its meaning, its stroke order and the words of the level that use it. In **Grammar**, each point shows its meaning and, when opened, the sentences from the videos, pages and books you have seen where it appears, with the pattern highlighted; **Explain with Claude** explains it with examples. There are no official JLPT lists: the vocabulary and kanji are Jonathan Waller’s lists (CC BY), the ones in common use, and the grammar is the project’s own list of about 500 points.

**Dictionary.** Besides looking up a word, the dictionary searches by meaning: written in English or Spanish, such as “dog”, it gives the common Japanese words that mean it, with the gloss that matches. What you search is also compared with the JLPT grammar, by its form (わけ) or by its meaning (“although”), and each point opens with its examples and explanation. Below each word’s panel are its kanji, with their JLPT level, readings and meaning; **Same meaning**, the common words with the same meaning, such as 食う and 召し上がる for 食べる, taken from the dictionary itself; the words read the same way, such as 箸 and 端 for 橋; and **Similar words and how they differ**, which asks Claude. On the start page, **Explore the dictionary** gathers onomatopoeia, four-kanji expressions, proverbs, idioms, literary and archaic words, colloquial words and respectful language, according to the JMdict tags, with common ones first. The first search by meaning or the first category builds an index in a few seconds, which lasts while the browser stays open.

**Grammar you already know.** Each grammar point is marked as **New**, **Learning** or **Known**: in the bubble that opens when you tap it under a subtitle, on a word panel, on the **JLPT** screen and in the dictionary. Known points are no longer flagged under subtitles, and those you are learning get a yellow line. Each time a video line contains a point, Kotonoha notes it: **Where you’ve seen it** shows the videos and the last sentence it appeared in. **Multiple-choice card** prepares in the card creator a card with the sentence with a gap and four options, three of them points that are confused with the right one, chosen by Claude, and on the back the answer with why the others don’t fit. In **Settings, Anki**, **Import grammar from Anki** looks in a field of a deck for the points Kotonoha knows, the 501 of the JLPT lists: those on cards with an interval of 21 days or more are marked as known.

**Immersion hours.** Kotonoha counts the time spent listening to and reading the language you study: a playing video with subtitles in that language, including your own files; a book open in the viewer; and the Notebook or a library text while you read, that is, with the page in view and something done on it in the last three minutes. A paused video does not count. **Home** shows the hours for today, the last seven days and in total, the **Streak** of days in a row with at least five minutes, one bar per day of the week, and what you have watched and read the most. Each language keeps its own count, and the backup includes it.

## Studying English

The language is chosen in the welcome screen, under **Settings, Language and level** or in the extension menu. Each one has its own words, dictionaries, cards, library and reading settings, and going back to another finds everything where it was. The interface, the Claude key and the spending are shared.

Everything this guide explains works the same way, with these differences:

| Element | In English |
|---|---|
| Dictionaries | Wiktionary in the interface language, in two parts: definitions and short translations. With the interface in English, the English-English one is suggested, which takes about 110 MB to download and about 220 MB on disk |
| Pronunciation | American and British IPA in the word panel. Over the words it starts off, and is turned on in the **Display** panel. Which of the two is written is chosen under **Settings, Language and level** |
| How it really sounds | The **How it sounds** tab on the word panel shows the sentence as it is said in connected speech, with the spoken form above each part: reductions (*going to* → *gonna*), weak forms (*to* → *tə*), linking (*turn off* → *tur‿noff*), t or d with *you* (*meet you* → *meechu*) and the American soft t (*get it* → *ge‿dit*), with a legend. They are rules, without Claude |
| Accent color | Shows the stressed syllable: the first, a middle one or the last. It also starts off |
| Forms | The panel says which word each one comes from: *went* opens *go*, and *didn't*, *do* |
| Phrasal verbs | The panel looks for them even when they are split: *picked it up* brings up *pick up*. The same goes for set phrases |
| Grammar | Points from A1 to C2, with the same confirmation by Claude |
| Page reader | It starts off, because English is on almost every page. It is turned on in the extension menu or under **Settings, Page reader** |
| Strokes and reading correction | Not offered |
| Comics | In the viewer, **Comic** mode (**Manga** in Japanese) reads each speech balloon with the book recognizer, in panel order and from left to right. Measured: 0.4 % character error on test pages and 12 % on a hand-lettered 1922 *Krazy Kat* page |
| Book OCR | Measured with a real 19th-century scan: 1.5 % character error, almost all of it in the page header |
| Sentence voice | In **Settings, Voices**, **Neural voice in the browser** reads sentences with Kokoro, on your own computer and with no key, with six voices from the United States and the United Kingdom. The first time it downloads 92 MB; each new sentence takes a few seconds on the processor and is saved afterwards |

## Studying German

It is chosen like English, and everything works the same way, with these differences:

| Element | In German |
|---|---|
| Dictionaries | Wiktionary in the interface language, with definitions and short translations, plus German–English, which is always suggested because it brings the conjugated and declined forms of each word: about 17 MB to download. With the interface in German, German–German is suggested too, about 55 MB |
| Forms | The panel opens the word each form comes from and says which form it is: *ging* opens *gehen*, in the simple past, and *Häuser*, *Haus*, in the plural. If a form can come from two words, such as *schönen*, the more frequent one wins. Articles go to *der* and *ein*, and the forms of *sein*, to *sein* |
| Separable verbs | The panel looks for them even when the particle sits at the end of the clause: *fängt morgen an* brings up *anfangen*. The same goes for set phrases |
| Pronunciation | IPA in the word panel, without regional variants. Over the words it starts off, as does the accent color, which shows the stressed syllable |
| Grammar | Points from A1 to C2, such as the Perfekt, the Konjunktiv, the passive or subordinate clauses with the verb at the end, with the same confirmation by Claude |
| Transcription | Parakeet for speech and Whisper Turbo for songs. With a real recording, Parakeet wrote with capitals and punctuation in less than half of Whisper's time |
| Page reader | It starts off. It is turned on in the extension menu or under **Settings, Page reader** |
| Strokes and reading correction | Not offered |
| Comics | **Comic** mode, as in English, with ä, ö, ü and ß: 0.4 % error on test pages |
| Book OCR | Reads modern type well: 0.03 % error on test pages in four typefaces. The blackletter (Fraktur) of old books is not read: on a 1919 page it missed three letters out of four |
| Sentence voice | **Neural voice in the browser** reads sentences with Piper, in Thorsten’s voice, on your own computer and with no key. The first time it downloads 63 MB, and it reads a sentence in under a second |

## Claude spending

The home screen has a **Claude spending** card with this month's spending against the credit set in Settings, a chart by day and model, the split by task and a log of every request with its tokens. The cost is worked out from the tokens reported by the API and its public prices, and only counts what was requested from this extension in this browser.

What costs the most per video is the correction of automatic subtitles, followed by translation and by the review of readings, meanings and grammar. The review covers a few minutes ahead of the playback position and continues as the video advances, and reviewed lines stay stored. It can be turned off in **Generate subtitles**, or requested for the whole video with **Review the whole video**. The [cost study](costs.md) gives measured figures, per video and per month.

Three settings decide how much word queries are used:

| Setting | Where | Default | Effect |
|---|---|---|---|
| Ask for the meaning when opening a word | Settings, Claude | Off | Every new word opened would be a request |
| Full script as context | Settings, Claude | Off | More context for names and references, at a higher cost per query |
| Initial tab | Settings, Dictionaries | Dictionary only | A Claude tab would ask on every word opened |

## Data and backups

All data is stored in the browser, in IndexedDB. **Settings, Your data** exports and imports a single file with the words, cards, library with its collections and notes, generated subtitles and corrections, immersion hours and what has been marked in grammar for every language that has been used, along with the settings and the spending log. API keys and dictionaries are not included. A backup from before version 0.4.0 is restored as Japanese.

**Full copy.** **Export to a folder** also saves the book files, what the OCR read and what was edited, and the dictations, in a folder named with the date. **Restore from a folder** puts everything into another copy without deleting what it already has. It serves to move Kotonoha to another computer, or to a copy installed with the fixed ID, because each copy keeps its data separately. Dictionaries and models are installed again from Settings.

**New versions.** Once a day, Kotonoha asks GitHub for the latest published version. If it is newer than the installed one, it says so on **Home** and in the extension menu, with a link to its page. The notice for a version can be closed and does not return until the next one. **Settings, Version** shows the installed version, checks by hand and turns the notices off with **Notify about new versions**. With the helper installed, in a copy loaded from a folder, the notice and **Settings, Version** offer **Update now**: the helper downloads the package, checks its SHA-256 against the version's `SHA256SUMS.txt`, copies it over the extension's folder keeping its ID, and the extension reloads itself as soon as nothing is running. Store copies update themselves.

## Keyboard shortcuts

The full reference is in the shortcuts panel, on top of the video. They can be changed under **Settings, Keyboard shortcuts**, and also work with Korean or Russian keyboards or with Japanese input on, because they follow the physical key.

| Group | Shortcut | Action |
|---|---|---|
| Bar | `Alt+X` | Pin or release the bar |
| | `Alt+V` | Show it while held |
| | `Alt+T` | Open the translator |
| Word | `1` or `U` | Mark as unknown |
| | `2` or `T` | Track |
| | `3` or `K` | Mark as known |
| | `4` or `I` | Ignore |
| | `N` | Go to the next unknown word |
| | `Alt+S` | Look up in the dictionary |
| Cards | `Q`, `Alt+Q` | Create a card |
| | `E` | Send to the creator |
| | `Alt+Shift+M` | Allow audio capture |
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
| Application | `Alt+Shift+K` | Open the Kotonoha window |

## Troubleshooting

| Symptom | Cause and solution |
|---|---|
| Nothing changes after building | The browser keeps the previous service worker. Press **Reload** on the extensions page |
| "To hear the video you need to turn on audio capture" | Chrome requires a user action to capture a tab. Use `Alt+Shift+M` or the switch in the extension menu, in the video's tab |
| A shortcut among `Alt+Shift+M`, `Alt+Shift+K` or `Alt+Q` does not respond | Chrome does not assign an extension a key another one already holds, even a disabled one, and gives no warning. The extension menu and the shortcuts panel show the real key, which can be changed at `chrome://extensions/shortcuts` |
| `Alt+R` or `Alt+Z` open Radeon Software | They are shortcuts of that application on machines with an AMD graphics card. Kotonoha uses `Alt+Shift+M` and `Alt+V` |
| The interface appears without blur | With hardware acceleration off, blur over the video drops frames, so the extension replaces it with a denser background |
| Whisper is very slow | The browser is not offering GPU access. Check the hardware acceleration option in its settings |
| The helper does not show as installed | The extension must be reloaded after running the installer. If it was loaded from another folder, pass its identifier with `-Extension` |
| A video cannot be downloaded | Age-restricted, private or paid videos are out of reach for yt-dlp. It can still be transcribed while it plays |
| YouTube returns empty subtitles | Its requests are signed by the player. Playing the video for a few seconds is enough |
| Anki does not connect | Anki must be open with AnkiConnect, and its configuration must allow the extension's origin. The extension asks for permission the first time |
