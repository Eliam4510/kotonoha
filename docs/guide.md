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
| Language and level | Settings, Language and level | The interface language and, separately, that of explanations and translations. The level adapts the explanations and decides how much furigana is shown at first |
| Language you're studying | Settings, Language and level, the extension menu, or **Video settings, Subtitles** on the video itself | Japanese, English or German. Each keeps its own words, dictionaries, cards and settings |
| Anki | Settings, Cards and Anki | Optional. Requires Anki to be open with the AnkiConnect add-on |

The extension works without a Claude key: subtitles, the dictionary, furigana, colors, flashcards and Whisper do not need one.

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

**Strokes.** The **Strokes** tab on the word panel shows how each kanji in the word is written: strokes are drawn one by one, in a loop, with their numbers. It can be paused, stepped through and sped up or slowed down. The data comes from [KanjiVG](https://kanjivg.tagaini.net): each kanji is downloaded the first time and stays in the browser.

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

An extension cannot download the audio of a video by itself. The helper is a small local program that does so with [yt-dlp](https://github.com/yt-dlp/yt-dlp) and FFmpeg. It requires Python, and its installer adds yt-dlp if missing. It is installed once from the project folder:

```bash
powershell -ExecutionPolicy Bypass -File herramientas\ayudante\instalar.ps1
```

The extension must then be reloaded at `edge://extensions` or `chrome://extensions`. Its status can be checked under **Settings, Transcription**.

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
| `Q`, `Alt+Q` | Creates a card with the current word and sentence |
| `E` | Sends the word, the selection or the image under the pointer to the card creator |

Cards can be sent to Anki through AnkiConnect, with a custom note type or the one the extension creates, or saved in **Memory**, the built-in FSRS review. Fields include sentence, furigana, translation, definitions, audio, image and notes. Audio capture is enabled with `Alt+Shift+M` or the switch in the extension menu.

**Audio and image from the video.** To record the sentence audio, capture must be enabled in the video's tab, with `Alt+Shift+M` or the switch in the extension menu. Capture only covers that tab: if it is active in another one, the microphone icon appears off and the card is created without audio. When a card is created, the line plays again at normal speed while it records, and the video then stays where it was. The image includes nothing from the interface. On sites with DRM, such as Netflix, the browser delivers the frame in black: the card then carries the episode's official image, or none if the site does not offer one. A protected site may also withhold its sound: the card is created without audio and, after two silent sentences in a row in a video, the line is no longer replayed to record it.

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

**Web pages.** On any page with Japanese text, the reader underlines words according to how well they are known and adds furigana. Clicking a word opens its panel. On links and buttons the click still belongs to the site, and the panel opens when the pointer rests on them, or at once with `Shift`. Dragging still selects text, and with the panel open `1` to `4` and `Q` work.

The button on the right edge adjusts colors and furigana without leaving the page, and the extension menu turns the reader on and off. Furigana has four modes: on all words, only on new ones, on hover or never. **Settings, Page reader** can make the panel always open on hover, or make clicks on links look words up too.

None of this adds anything to the page's content. Colors use the CSS Custom Highlight API and readings live in a separate layer, so selecting, copying and searching work as usual, and it does not interfere with applications such as those built with React. It also works on what scrolls inside a box, like a chat conversation: furigana moves with the text and passes under the message box. It leaves text fields and Chinese or Korean text alone.

**Space out lines.** Many pages leave little room between lines, and furigana would collide with the line above. There, the line spacing of that text is opened just enough, and that is the only thing the reader may move on a page. It is not done on buttons or menus, nor where the text would overflow a fixed-height box: in those cases, if there is no room at all, furigana is left for hovering. The **Space out lines** switch, on the edge button, turns it off, and then the layout does not move at all.

`Alt+K`, `Alt+U` and `Alt+I` mark the selected text in bulk as known, unknown or ignored.

**Clipboard.** Displays any pasted or copied text with the same aids as subtitles, and keeps its structure: paragraphs, line breaks, headings, lists, quotes, code, tables and bold. Text copied from a page leaves out that page's furigana, and Markdown copied from the Claude chat keeps its formatting.

**Web mode.** The application window has no tabs, so it cannot join the browser's split view. The Clipboard's **Web mode** button opens it in a regular tab, without the sidebar, and **Open the Clipboard next to this tab**, in the extension menu, places it right beside the page you are viewing (Chrome 155 or later). In that tab, **Follow the clipboard** appends the Japanese you copy anywhere, while the tab is in view. It is a page of the extension itself: it needs no server, works offline, and the text stays on your computer.

**Reading assistant.** Stores EPUB books, texts and SRT subtitles, with the reading position and the structure of each chapter. It can also generate stories with Claude, matched to the configured level.

**Local player.** Plays local files, with the embedded subtitles of an MKV and a choice of audio track, through ffmpeg.wasm.

**Words and assessment.** The explorer lists vocabulary by status, and the level assessment estimates the initial known words.

## Studying English

The language is chosen in the welcome screen, under **Settings, Language and level** or in the extension menu. Each one has its own words, dictionaries, cards, library and reading settings, and going back to another finds everything where it was. The interface, the Claude key and the spending are shared.

Everything this guide explains works the same way, with these differences:

| Element | In English |
|---|---|
| Dictionaries | Wiktionary in the interface language, in two parts: definitions and short translations. With the interface in English, the English-English one is suggested, which takes about 110 MB to download and about 220 MB on disk |
| Pronunciation | American and British IPA in the word panel. Over the words it starts off, and is turned on in the **Display** panel. Which of the two is written is chosen under **Settings, Language and level** |
| Accent color | Shows the stressed syllable: the first, a middle one or the last. It also starts off |
| Forms | The panel says which word each one comes from: *went* opens *go*, and *didn't*, *do* |
| Phrasal verbs | The panel looks for them even when they are split: *picked it up* brings up *pick up*. The same goes for set phrases |
| Grammar | Points from A1 to C2, with the same confirmation by Claude |
| Page reader | It starts off, because English is on almost every page. It is turned on in the extension menu or under **Settings, Page reader** |
| Strokes and reading correction | Not offered |

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

All data is stored in the browser, in IndexedDB. **Settings, Your data** exports and imports a single file with the words, cards, library, generated subtitles and corrections of every language that has been used, along with the settings and the spending log. The Claude key and the dictionaries are not included. A backup from before version 0.4.0 is restored as Japanese.

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
