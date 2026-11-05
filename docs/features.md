<p align="right"><a href="funciones.md">Español</a> · <b>English</b></p>

# Features

Status of each feature in version 0.2.1, along with how it has been verified.

| Verification | Meaning |
|---|---|
| Automated | Tested end to end with Edge and the extension loaded |
| Simulator | The real code runs in full, against a fake Claude API or AnkiConnect server |
| Imitation page | Also on a page with the same player structure as Netflix or YouTube |
| Pending | Requires a real site session or personal credentials |

## On top of the video

| Feature | Verification |
|---|---|
| Floating bar with known words, comprehension and recommended sentences | Automated |
| The bar appears when the pointer rests at the top, stays while it is near and ignores passing movements | Automated |
| Subtitles that can be dragged anywhere on the video, with magnets and without leaving it | Automated |
| Line changes without flicker, and slightly smaller text for long paragraphs | Automated |
| Subtitles stay with the video when the page scrolls, without jitter | Imitation page |
| A line appearing under a resting pointer neither opens a card nor pauses the video | Automated |
| Subtitles with furigana, pitch accent colors and status underlines | Automated |
| Furigana, gloss and color modes: always, on hover, unknown only, never | Automated |
| Word card: definitions, status, frequency, audio, images, examples and links | Automated |
| The card opens with the dictionary, with no request to Claude | Simulator |
| Meaning in this sentence, explain, break down and translate with Claude, on request | Simulator |
| Every answer is stored: the same word in the same sentence is never requested again | Simulator |
| Free questions about a word or sentence | Simulator |
| JLPT grammar: about 100 rules confirmed by Claude, with a per-video summary | Simulator |
| Priority words: the unknown words repeated most in the video | Automated |
| Playback modes: intensive listening and reading, hybrid, single-word focus and custom | Automated |
| Veils over the subtitles | Automated |
| Speeding up or skipping scenes without dialogue | Automated |
| Subtitle navigator: filters, bookmarks, selection and line merging | Automated |
| Floating translator | Simulator |
| Keyboard shortcuts | Automated |

## Subtitles

| Feature | Verification |
|---|---|
| YouTube: tracks signed by the player | Imitation page. A real session is pending, since the site does not serve subtitles to an automated browser |
| Netflix: player tracks, TTML | Imitation page. A real session is pending |
| Disney+, Crunchyroll, Viki, Bilibili, iQIYI and Prime Video, through generic detection | Pending |
| Second track in the support language | Automated |
| Translation with Claude, in batches, starting at the playback position, resumable after cancelling | Imitation page |
| Correction of automatic subtitles, with the original text available | Imitation page |
| Creating Japanese from another language | Imitation page |
| Importing SRT, VTT, ASS, SSA, TTML and DFXP, saved per title | Imitation page |
| Exporting to SRT, with synchronization applied | Imitation page |
| Japanese tracks remembered across Netflix regions | Imitation page. Real sessions must still confirm that the title identifier matches |
| Synchronization by offset or with one or two marks | Automated |

## Transcription

| Feature | Verification |
|---|---|
| Whisper on the GPU through WebGPU, for local files | Automated, with real videos |
| Real-time Whisper from tab capture | Automated, with real audio |
| Recovery of speech skipped under music | Automated, with real videos |
| Load control: rest periods, automatic intensity and pause | Automated, with smoothness measurements |
| Recovery from GPU loss | Automated, by destroying the WebGPU device |
| Local helper with yt-dlp and FFmpeg | Automated, with a local download. The real browser registration and a real YouTube download are still pending |
| Correction of the result with Claude | Simulator |

## Flashcards

| Feature | Verification |
|---|---|
| One-click creation | Simulator |
| Creator with every field | Simulator |
| Sending to Anki through AnkiConnect, with a custom note type or the extension's own | Simulator |
| Sentence audio recorded from the video, as MP3 | Automated, with simulated audio |
| Video frame capture, including with DRM | Automated |
| Word audio: JapanesePod101 and Lingua Libre | Automated |
| Azure neural voices, with a personal key | Pending |
| Images from Openverse | Automated |
| Creating several cards from selected lines | Simulator |
| Known words from Anki decks | Simulator |
| Built-in review with FSRS | Automated |

## Application window

| Feature | Verification |
|---|---|
| Home with vocabulary and review summary | Automated |
| Claude spending: monthly total, chart by day and model, tasks and request log | Simulator |
| Dictionary with free search and conjugated forms | Automated |
| Reader for pasted text | Automated |
| Library: EPUB, TXT and SRT | Automated |
| Stories generated for the user's level | Simulator |
| Player for local files | Automated |
| Embedded MKV subtitles and audio track selection, with ffmpeg.wasm | Automated |
| Word explorer by status | Automated |
| Level assessment | Automated |
| Full settings and editable prompts | Automated |
| Backups | Automated |

## Web pages

| Feature | Verification |
|---|---|
| Word lookup with `Shift` and the pointer | Automated |
| Status underlining, without modifying the page | Automated |
| Sending the selection or an image to the creator with `E` | Automated |
| Bulk marking of selected text with `Alt+K`, `Alt+U` and `Alt+I` | Automated |

## Design principles

| Principle | How it applies |
|---|---|
| Meaning depends on the sentence | The "En esta frase" block gives the meaning in context, flags figurative or poetic use, and comes first on the card |
| Correct readings | Claude reviews the readings of each line, and any of them can be corrected by hand |
| Broad context | Claude receives 40 lines around the sentence and the translation. The full script is sent for correction, and is optional for queries |
| Nothing is paid for twice | Every answer is stored by word and sentence, and reviewed results by line text. An interrupted answer is finished and stored, and two identical queries at once share one request |
| Claude only when needed | The card opens with the dictionary, and the review covers the stretch about to be watched instead of the whole video |
| Start with what is on screen | Translation, correction and review order their batches by the playback position |
| The computer stays usable | Transcription rests, adapts to use and stops on repeated failures |
| Pages are left untouched | Web underlining uses the CSS Custom Highlight API, without rewriting the DOM |
| Local data | Everything stays in the browser, and transcription audio never leaves the computer |

## Known limitations

| Limitation | Detail |
|---|---|
| Study language | Japanese only: the analysis logic is specific to this language |
| Interface language | Spanish only. Claude's explanations can be requested in Spanish, English or simple Japanese |
| Platforms | Desktop Chrome and Edge. The local helper is prepared for Windows |
| Synchronization | No server: moving between computers is done with a backup |
| Background music | Whisper can miss quiet conversation under loud music |
